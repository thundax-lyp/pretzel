import assert from "node:assert/strict";
import { test } from "node:test";
import { GROUPS, Round } from "../assets/scripts/round.ts";

test("the tutorial has 36 flat tiles, 12 per type, and clears", () => {
    const round = new Round(1, "A");
    assert.equal(round.remaining, 36);
    const counts = new Map();
    for (const card of round.cards) {
        assert.equal(card.layer, 0);
        assert.equal(round.cardAt(card.left + 0.5, card.top + 0.5), card);
        counts.set(card.kind, (counts.get(card.kind) ?? 0) + 1);
        assert.notEqual(round.take(card.id), null);
    }
    assert.deepEqual([...counts.values()], [12, 12, 12]);
    assert.equal(round.status, "won");
    assert.equal(round.remaining, 0);
});

test("A/B/C use the same board and expose only their assigned opening tiles", () => {
    const rounds = GROUPS.map((group) => new Round(2, group));
    assert.equal(rounds[0].cards.length, 189);
    assert.equal(new Set(rounds[0].cards.map((card) => card.kind)).size, 16);
    for (const layer of [0, 1, 2]) {
        assert.equal(
            rounds[0].cards.filter((card) => card.layer === layer).length,
            63,
        );
    }
    for (const round of rounds) {
        assert.deepEqual(round.cards, rounds[0].cards);
        assert.equal(round.slots.length, 0);
    }
    assert.deepEqual(
        rounds.map(
            (round) =>
                round.cards.filter((card) => round.isFaceUp(card)).length,
        ),
        [0, 63, 6],
    );
    assert.ok(
        rounds[2].cards
            .filter((card) => rounds[2].isFaceUp(card))
            .every(
                (card) =>
                    card.layer === 2 &&
                    [1, 5].includes(card.x) &&
                    [1, 4, 7].includes(card.y),
            ),
    );
});

test("A and C reveal four neighbors on the same layer; diagonal and lower tiles stay hidden", () => {
    for (const group of ["A", "C"]) {
        const round = new Round(2, group);
        const center = round.cards.find(
            (card) => card.layer === 2 && card.x === 3 && card.y === 3,
        );
        const before = new Set(
            round.cards.filter((card) => round.isFaceUp(card)),
        );
        assert.equal(round.take(center.id), 0);
        const revealed = round.cards
            .filter((card) => !before.has(card) && round.isFaceUp(card))
            .map(({ layer, x, y }) => [layer, x, y]);
        assert.deepEqual(revealed, [
            [2, 3, 2],
            [2, 2, 3],
            [2, 4, 3],
            [2, 3, 4],
        ]);
    }
});

test("a tile cannot be taken until all overlapping upper tiles are removed", () => {
    for (const group of GROUPS) {
        const round = new Round(2, group);
        const below = round.cards.find(
            (card) => card.layer === 1 && card.x === 2 && card.y === 2,
        );
        const above = round.cards.filter(
            (card) =>
                card.layer === 2 &&
                [1, 2].includes(card.x) &&
                [1, 2].includes(card.y),
        );
        assert.equal(round.cardAt(2.75, 2.75), above[0]);
        assert.equal(round.take(below.id), null);
        for (const card of above.slice(0, 3)) {
            assert.equal(round.take(card.id), 0);
        }
        assert.equal(round.cardAt(2.75, 2.75), below);
        assert.equal(round.exposure(below), 0b0111);
        assert.equal(round.isFaceUp(below), false);
        assert.equal(round.take(below.id), null);
        assert.equal(round.moves, 3);
        assert.equal(round.slots.length, 3);

        assert.equal(round.take(above[3].id), 0);
        assert.equal(round.isFaceUp(below), group === "B");
        assert.notEqual(round.take(below.id), null);
    }
});

test("the reference route clears the second level in all groups and may match on tile seven", () => {
    for (const group of GROUPS) {
        const round = new Round(2, group);
        for (const layer of [2, 1, 0]) {
            for (const card of round.cards.filter(
                (card) => card.layer === layer,
            )) {
                assert.notEqual(
                    round.take(card.id),
                    null,
                    `blocked tile ${card.id}`,
                );
            }
        }
        assert.equal(round.firstMatchAt, 7);
        assert.equal(round.status, "won");
        assert.equal(round.remaining, 0);
    }
});

test("an unmatched seventh tile loses immediately and freezes the round", () => {
    const round = new Round(2, "A");
    const chosenKinds = new Set();
    for (const card of round.cards.filter((card) => card.layer === 2)) {
        if (chosenKinds.has(card.kind)) continue;
        assert.equal(round.take(card.id), 0);
        chosenKinds.add(card.kind);
        if (chosenKinds.size === 7) break;
        assert.equal(round.status, "playing");
    }
    assert.equal(round.status, "lost");
    assert.equal(round.firstMatchAt, null);
    assert.equal(round.slots.length, 7);
    assert.equal(round.take(round.cards.at(-1).id), null);
    assert.equal(round.moves, 7);
});
