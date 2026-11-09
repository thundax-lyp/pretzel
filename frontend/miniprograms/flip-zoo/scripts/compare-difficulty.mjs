import { GROUPS, Round, SLOT_LIMIT } from "../assets/scripts/round.ts";
import { DEFAULT_DIFFICULTY, buildBoardKinds } from "./difficulty.mjs";

const samples = 60;
const errorRate = 0.1;
const scenarios = [5, 6, 7, "assisted"];

function random(seed) {
    let state = seed;
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

function play(group, scenario, seed, boardKinds) {
    const round = new Round(2, group, boardKinds, random(seed * 334214459));
    const tieBreak = random(seed * 1299709);
    const noise = random(seed * 179424673);
    const assisted = scenario === "assisted";
    let errors = 0;
    let ads = 0;
    let props = 0;
    if (!assisted) {
        while (round.slotCapacity < scenario) round.unlockNextSlot();
    }

    while (round.status === "playing") {
        const choices = playable(round);
        if (choices.length === 0)
            throw new Error("No action on an unfinished board");
        const known = new Set(
            choices
                .filter((card) => round.isFaceUp(card))
                .map((card) => card.id),
        );
        const score = rank(round, choices, known);
        const best = Math.max(...choices.map(score));
        if (
            assisted &&
            best < 100 &&
            round.slots.length === round.slotCapacity - 1
        ) {
            if (known.size < choices.length && round.use("peek")) {
                props += 1;
                continue;
            }
            if (round.slotCapacity < SLOT_LIMIT && round.unlockNextSlot()) {
                ads += 1;
                continue;
            }
            if (
                round.use("remove") ||
                round.use("shuffle") ||
                round.use("undo")
            ) {
                props += 1;
                continue;
            }
        }
        const preferred = choices.filter((card) => score(card) === best);
        let choice = preferred[Math.floor(tieBreak() * preferred.length)];
        if (noise() < errorRate && choices.length > 1) {
            const alternatives = choices.filter(
                (card) => card.id !== choice.id,
            );
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

function sum(values, key) {
    return values.reduce((total, value) => total + Number(value[key]), 0);
}

const compareKeys = process.argv.includes("--key-groups");
const cases = compareKeys
    ? [1, 2, 3].flatMap((keyGroups) =>
          Array.from({ length: keyGroups + 1 }, (_, overlapGroups) =>
              [5, "assisted"].map((scenario) => ({
                  group: "C",
                  scenario,
                  difficulty: { keyGroups, overlapGroups },
              })),
          ).flat(),
      )
    : GROUPS.flatMap((group) =>
          scenarios.map((scenario) => ({
              group,
              scenario,
              difficulty: DEFAULT_DIFFICULTY,
          })),
      );
const results = cases.map(({ group, scenario, difficulty }) => {
    const boardKinds = buildBoardKinds(difficulty);
    const games = Array.from({ length: samples }, (_, index) =>
        play(group, scenario, index + 1, boardKinds),
    );
    const cleared = games.map((game) => game.cleared).sort((a, b) => a - b);
    return {
        group,
        scenario,
        keyGroups: difficulty.keyGroups,
        overlapGroups: difficulty.overlapGroups,
        rounds: samples,
        wins: sum(games, "won"),
        noFirstMatch: samples - sum(games, "first"),
        medianCleared: (cleared[samples / 2 - 1] + cleared[samples / 2]) / 2,
        observedErrorPct: (
            (100 * sum(games, "errors")) /
            sum(games, "moves")
        ).toFixed(1),
        meanAds: (sum(games, "ads") / samples).toFixed(2),
        meanProps: (sum(games, "props") / samples).toFixed(2),
    };
});
console.table(results);
