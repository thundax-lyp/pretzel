import assert from "node:assert/strict";
import { test } from "node:test";
import { MAIN_BOARD_POOL } from "../assets/scripts/services/main-board-pool.ts";
import { Round } from "../assets/scripts/gameplay/round.ts";
import {
    createFixedBoardCandidate,
    verifyFixedBoardCandidate,
} from "../scripts/fixed-board-candidate.mjs";

function candidateFor(layout, seed) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
        try {
            return createFixedBoardCandidate(layout, seed + attempt);
        } catch {
            // A geometric candidate without a valid reference is discarded.
        }
    }
    assert.fail("No valid candidate within the fixed seed budget");
}

test("AB-first candidate planning preserves all binding layers, quotas and a six-slot solution", () => {
    for (const index of [0, 17, 34]) {
        const { layout } = MAIN_BOARD_POOL[index];
        const candidate = candidateFor(layout, 870001 + index * 1000);
        assert.deepEqual(
            createFixedBoardCandidate(layout, candidate.seed),
            candidate,
        );
        assert.equal(verifyFixedBoardCandidate(layout, candidate), true);
        const round = new Round(
            2,
            "C",
            candidate.kinds,
            undefined,
            layout,
            false,
            candidate.bindings,
            true,
        );
        const advanced = candidate.bindings.filter(
            ([a, b]) => candidate.kinds[a] !== candidate.kinds[b],
        );
        const ordinary = candidate.bindings.filter(
            ([a, b]) => candidate.kinds[a] === candidate.kinds[b],
        );
        for (const layer of [1, 2, 3])
            assert.ok(advanced.some(([id]) => round.cards[id].layer === layer));
        assert.ok(ordinary.length > 0);
        assert.equal(
            new Set(candidate.bindings.flat()).size,
            candidate.bindings.length * 2,
        );
        assert.ok(
            candidate.bindings.every(([id]) => round.cards[id].layer > 0),
        );
        const counts = Array(20).fill(0);
        candidate.kinds.forEach((kind) => (counts[kind] += 1));
        assert.deepEqual(counts, Array(20).fill(12));
    }
});

test("candidate verification rejects bottom bindings and overlapping reservations", () => {
    const { layout } = MAIN_BOARD_POOL[0];
    const candidate = candidateFor(layout, 870001);
    assert.throws(
        () =>
            verifyFixedBoardCandidate(layout, {
                ...candidate,
                bindings: [[0, 1], ...candidate.bindings],
            }),
        /Bottom layer/,
    );
    assert.throws(
        () =>
            verifyFixedBoardCandidate(layout, {
                ...candidate,
                bindings: [candidate.bindings[0], ...candidate.bindings],
            }),
        /Overlapping/,
    );
});
