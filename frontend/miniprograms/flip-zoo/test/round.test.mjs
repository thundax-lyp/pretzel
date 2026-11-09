import assert from "node:assert/strict";
import { test } from "node:test";
import { GROUPS, Round } from "../assets/scripts/round.ts";

test("the tutorial has 36 flat tiles, 18 per type, and clears with five slots", () => {
    const round = new Round(1, "A");
    assert.equal(round.remaining, 36);
    const counts = new Map();
    for (const card of round.cards) {
        assert.equal(card.layer, 0);
        assert.equal(round.cardAt(card.left + 0.5, card.top + 0.5), card);
        counts.set(card.kind, (counts.get(card.kind) ?? 0) + 1);
        assert.notEqual(round.take(card.id), null);
    }
    assert.deepEqual([...counts.values()], [18, 18]);
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

test("the seventh tile can match when both slots have been unlocked", () => {
    for (const group of GROUPS) {
        const round = new Round(2, group);
        assert.equal(round.unlockNextSlot(), true);
        assert.equal(round.unlockNextSlot(), true);
        assert.equal(round.unlockNextSlot(), false);
        for (let id = 126; id < 133; id += 1)
            assert.notEqual(round.take(id), null);
        assert.equal(round.firstMatchAt, 7);
        assert.equal(round.status, "playing");
    }
});

test("filling the active capacity without a match loses immediately", () => {
    for (const capacity of [5, 6, 7]) {
        const round = new Round(2, "A");
        assert.equal(round.slotCapacity, 5);
        while (round.slotCapacity < capacity)
            assert.equal(round.unlockNextSlot(), true);
        const chosenKinds = new Set();
        for (const card of round.cards.filter((card) => card.layer === 2)) {
            if (chosenKinds.has(card.kind)) continue;
            assert.equal(round.take(card.id), 0);
            chosenKinds.add(card.kind);
            if (chosenKinds.size === capacity) break;
            assert.equal(round.status, "playing");
        }
        assert.equal(round.status, "lost");
        assert.equal(round.firstMatchAt, null);
        assert.equal(round.slots.length, capacity);
        assert.equal(round.take(round.cards.at(-1).id), null);
        assert.equal(round.unlockNextSlot(), false);
        assert.equal(round.moves, capacity);
    }
});

test("a matching fifth tile clears before checking for failure", () => {
    const round = new Round(2, "A");
    const top = round.cards.filter((card) => card.layer === 2);
    for (const index of [0, 2, 5, 1])
        assert.equal(round.take(top[index].id), 0);
    assert.equal(round.take(top[6].id), 3);
    assert.equal(round.firstMatchAt, 5);
    assert.equal(round.status, "playing");
    assert.equal(round.slots.length, 2);
});

function takeWithFullInformation(round) {
    const available = round.cards.filter(
        (card) =>
            round.isOnBoard(card) && round.isSelectable(round.exposure(card)),
    );
    assert.ok(available.length > 0);
    let best = available[0];
    let bestScore = -1;
    for (const card of available) {
        const held = round.slots.filter(
            (tile) => tile.kind === card.kind,
        ).length;
        const shown = available.filter(
            (tile) => tile.kind === card.kind,
        ).length;
        let score = shown;
        if (held === 2) score = 100;
        else if (shown + held >= 3) score = 60 + held;
        else if (held === 1 || shown === 2) score = 30 + held;
        if (score > bestScore) {
            best = card;
            bestScore = score;
        }
    }
    assert.notEqual(round.take(best.id), null);
}

test("the default board has a legal five-slot clear with full information", () => {
    const round = new Round(2, "B");
    while (round.status === "playing") takeWithFullInformation(round);
    assert.equal(round.status, "won");
    assert.equal(round.moves, 189);
});
