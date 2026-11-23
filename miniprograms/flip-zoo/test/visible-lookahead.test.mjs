import assert from "node:assert/strict";
import { test } from "node:test";
import { play } from "../scripts/simulate-round.mjs";
import { Round } from "../assets/scripts/gameplay/round.ts";
import { createLookahead } from "../scripts/visible-lookahead.mjs";

test("lookahead avoids a full tray without reading dark or fully covered faces", () => {
    const cards = [1, 2, null, null].map((kind, id) => ({
        id,
        layer: id === 1 ? 1 : 0,
        x: id === 3 ? 1 : id,
        y: 0,
        left: id === 3 ? 1 : id,
        top: 0,
        get kind() {
            assert.notEqual(kind, null, "read a face the player cannot see");
            return kind;
        },
    }));
    const round = {
        level: 2,
        group: "C",
        bindings: [],
        slots: [1, 1, 2, 3].map((kind) => ({ kind })),
        slotCapacity: 5,
        isOnBoard: () => true,
        exposure: ({ id }) => (id === 3 ? 0 : 15),
        isFaceUp: ({ id }) => id !== 2,
    };
    const scores = createLookahead(cards)(round);
    assert.deepEqual(
        scores.map(({ id }) => id),
        [0, 1, 2],
    );
    assert.ok(scores[0].score > scores[1].score);
    assert.ok(scores[0].score > scores[2].score);
});

test("omniscient lookahead scores dark faces and still excludes covered cards", () => {
    const cards = [
        { id: 0, kind: 1, layer: 0, x: 0, y: 0, left: 0, top: 0 },
        { id: 1, kind: 2, layer: 1, x: 1, y: 0, left: 1, top: 0 },
        { id: 2, kind: 1, layer: 0, x: 1, y: 0, left: 1, top: 0 },
    ];
    const round = {
        level: 2,
        group: "C",
        bindings: [],
        slots: [1, 1, 2, 3, 4].map((kind) => ({ kind })),
        slotCapacity: 6,
        isOnBoard: () => true,
        isFaceUp: () => false,
    };
    const choices = createLookahead(cards, true)(round);
    assert.deepEqual(
        choices.map(({ id, completesMatch }) => [id, completesMatch]),
        [
            [0, true],
            [1, false],
        ],
    );
    assert.ok(choices[0].score > choices[1].score);
});

test("visible lookahead evaluates both different faces of an advanced pair", () => {
    const r = new Round(
        2,
        "B",
        [0, 0, 1, 1, 0, 1],
        undefined,
        [[[0, 0, 6, 1]]],
        false,
        [[4, 5]],
        true,
    );
    for (const id of [0, 1, 2, 3]) r.take(id);
    const scores = createLookahead(r.cards)(r);
    assert.deepEqual(
        scores.map(({ id, completesMatch }) => [id, completesMatch]),
        [
            [4, true],
            [5, true],
        ],
    );
    assert.equal(scores[0].score, scores[1].score);
    assert.equal(r.take(4), 6);
});

test("reusing prepared geometry does not retain state between seeded games", () => {
    const deal = {
        boardKinds: [0, 0, 1, 1, 0, 1, 2, 2, 2],
        layout: [[[0, 0, 9, 1]]],
        bindings: [[4, 5]],
    };
    const template = new Round(
        2,
        "C",
        deal.boardKinds,
        undefined,
        deal.layout,
        false,
        deal.bindings,
        true,
    );
    const strategy = createLookahead(template.cards);
    for (const seed of [1, 2, 3, 4, 1]) {
        const options = {
            ...deal,
            group: "C",
            seed,
            errorRate: 0,
            shareLockedSlot: true,
        };
        assert.deepEqual(play({ ...options, strategy }), play(options));
    }
});
