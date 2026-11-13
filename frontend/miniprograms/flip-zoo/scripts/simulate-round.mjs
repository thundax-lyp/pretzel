import { Round, SLOT_LIMIT } from "../assets/scripts/gameplay/round.ts";
import { createLookahead } from "./visible-lookahead.mjs";

function random(seed) {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 2 ** 32;
    };
}

function playable(round) {
    return round.cards.filter(
        (card) =>
            round.isOnBoard(card) && round.isSelectable(round.exposure(card)),
    );
}

function rank(round, choices, known) {
    const held = new Map();
    const shown = new Map();
    for (const { kind } of round.slots)
        held.set(kind, (held.get(kind) ?? 0) + 1);
    for (const { id, kind } of choices) {
        if (known.has(id)) shown.set(kind, (shown.get(kind) ?? 0) + 1);
    }
    return (card) => {
        if (!known.has(card.id)) return 20;
        const inSlot = held.get(card.kind) ?? 0;
        const visible = shown.get(card.kind);
        if (inSlot === 2) return 100;
        if (inSlot + visible >= 3) return 60 + inSlot;
        if (inSlot === 1 || visible === 2) return 30 + inSlot;
        return visible;
    };
}

export function play({
    group,
    scenario,
    seed,
    boardKinds,
    layout,
    level = 2,
    errorRate,
    strategy = scenario === "assisted" ? "greedy" : "lookahead",
}) {
    const round = new Round(
        level,
        group,
        boardKinds,
        random(Math.imul(seed, 334214459)),
        layout,
    );
    const tieBreak = random(Math.imul(seed, 1299709));
    const noise = random(Math.imul(seed, 179424673));
    const assisted = scenario === "assisted";
    let errors = 0;
    let ads = 0;
    let props = 0;
    if (typeof scenario === "number") {
        while (round.slotCapacity < scenario) {
            if (!round.unlockNextSlot())
                throw new Error("Cannot reach the requested slot capacity");
        }
    }

    const lookahead =
        strategy === "lookahead" ? createLookahead(round.cards) : null;
    while (round.status === "playing") {
        let scored = lookahead?.(round);
        let hasDarkChoice = false;
        if (!scored) {
            const choices = playable(round);
            const known = new Set(
                choices
                    .filter((card) => round.isFaceUp(card))
                    .map((card) => card.id),
            );
            hasDarkChoice = known.size < choices.length;
            const greedyScore = rank(round, choices, known);
            scored = choices.map((card) => {
                const score = greedyScore(card);
                return { id: card.id, score, completesMatch: score === 100 };
            });
        }
        if (!scored.length) throw new Error("No action on an unfinished board");
        if (
            assisted &&
            !scored.some(({ completesMatch }) => completesMatch) &&
            round.slots.length === round.slotCapacity - 1
        ) {
            if (hasDarkChoice && round.use("peek")) {
                props += 1;
                continue;
            }
            if (round.slotCapacity < SLOT_LIMIT && round.unlockNextSlot()) {
                ads += 1;
                continue;
            }
            if (round.use("remove") || round.use("undo")) {
                props += 1;
                continue;
            }
        }
        const best = Math.max(...scored.map(({ score }) => score));
        const preferred = scored.filter(({ score }) => score === best);
        let choice = preferred[Math.floor(tieBreak() * preferred.length)];
        if (noise() < errorRate && scored.length > 1) {
            const alternatives = scored.filter((card) => card.id !== choice.id);
            choice = alternatives[Math.floor(tieBreak() * alternatives.length)];
            errors += 1;
        }
        const result = round.take(choice.id);
        if (result === null)
            throw new Error("Strategy attempted an illegal move");
    }
    return {
        won: round.status === "won",
        first: round.firstMatchAt !== null,
        cleared: round.cards.length - round.remaining,
        moves: round.moves,
        errors,
        ads,
        props,
    };
}
