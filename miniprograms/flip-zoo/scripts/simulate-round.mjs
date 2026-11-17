import { Round } from "../assets/scripts/gameplay/round.ts";
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

export function play({
    group,
    seed,
    boardKinds,
    layout,
    bindings,
    level = 2,
    errorRate,
    shareLockedSlot = false,
    omniscient = false,
}) {
    const round = new Round(
        level,
        group,
        boardKinds,
        random(Math.imul(seed, 334214459)),
        layout,
        false,
        bindings,
        shareLockedSlot,
    );
    const tieBreak = random(Math.imul(seed, 1299709));
    const noise = random(Math.imul(seed, 179424673));
    const lookahead = createLookahead(round.cards, omniscient);
    while (round.status === "playing") {
        const scored = lookahead(round);
        if (!scored.length) throw new Error("No action on an unfinished board");
        const best = Math.max(...scored.map(({ score }) => score));
        const preferred = scored.filter(({ score }) => score === best);
        let choice = preferred[Math.floor(tieBreak() * preferred.length)];
        if (noise() < errorRate && scored.length > 1) {
            const alternatives = scored.filter((card) => card.id !== choice.id);
            choice = alternatives[Math.floor(tieBreak() * alternatives.length)];
        }
        const result = round.take(choice.id);
        if (result === null)
            throw new Error("Strategy attempted an illegal move");
    }
    const cleared = round.cards.length - round.remaining;
    return {
        won: round.status === "won",
        reached30: cleared >= Math.ceil(round.cards.length * 0.3),
    };
}
