import assert from "node:assert/strict";
import { test } from "node:test";
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
