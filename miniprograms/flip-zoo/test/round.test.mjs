import assert from "node:assert/strict";
import { test } from "node:test";
import {
    ANIMAL_KIND_COUNT,
    DEFAULT_BOARD_KINDS,
    GROUPS,
    Round,
    isBoardKinds,
} from "../assets/scripts/gameplay/round.ts";
test("the tutorial has 12 flat tiles, 6 per type, and clears with five slots", () => {
    const round = new Round(1, "A");
    assert.equal(round.unlockNextSlot(), false);
    assert.equal(round.slotCapacity, 5);
    assert.equal(round.hasProgress, false);
    assert.equal(round.remaining, 12);
    const counts = new Map();
    for (const card of round.cards) {
        assert.equal(card.layer, 0);
        assert.equal(round.cardAt(card.left + 0.5, card.top + 0.5), card);
        counts.set(card.kind, (counts.get(card.kind) ?? 0) + 1);
        assert.notEqual(round.take(card.id), null);
    }
    assert.deepEqual([...counts.values()], [6, 6]);
    assert.equal(round.status, "won");
    assert.equal(round.remaining, 0);
});

test("returning to the tutorial from group B preserves neighbor reveals", () => {
    const round = new Round(1, "B");
    assert.equal(round.isFaceUp(round.cards[1]), false);
    assert.equal(round.take(0), 0);
    assert.equal(round.isFaceUp(round.cards[1]), true);
    assert.equal(round.isFaceUp(round.cards[4]), true);
    assert.equal(round.isFaceUp(round.cards[5]), false);
});

test("restart protection includes takes, successful props and slot unlocks", () => {
    const tutorial = new Round(1, "C");
    assert.equal(tutorial.hasProgress, false);
    assert.equal(tutorial.take(0), 0);
    assert.equal(tutorial.hasProgress, true);

    const main = new Round(2, "C");
    assert.equal(main.hasProgress, false);
    assert.equal(main.use("remove"), false);
    assert.equal(main.propUsesLeft("remove"), 1);
    assert.equal(main.hasProgress, false);
    assert.equal(main.use("peek"), true);
    assert.equal(main.propUsesLeft("peek"), 0);
    assert.equal(main.hasProgress, true);

    const expanded = new Round(2, "C");
    assert.equal(expanded.unlockNextSlot(), true);
    assert.equal(expanded.hasProgress, true);
});

test("A/B/C use the same board and expose only their assigned opening tiles", () => {
    const rounds = GROUPS.map((group) => new Round(2, group));
    assert.equal(rounds[0].cards.length, 189);
    assert.equal(
        new Set(rounds[0].cards.map((card) => card.kind)).size,
        ANIMAL_KIND_COUNT,
    );
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
        [0, 63, 12],
    );
    assert.ok(
        rounds[2].cards
            .filter((card) => rounds[2].isFaceUp(card))
            .every(
                (card) =>
                    card.layer === 2 &&
                    [1, 2, 4, 5].includes(card.x) &&
                    [1, 4, 7].includes(card.y),
            ),
    );
});

test("A and C reveal four neighbors while diagonal and still-covered tiles stay hidden", () => {
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
        assert.equal(round.isFaceUp(below), true);
        assert.notEqual(round.take(below.id), null);
    }
});

test("taking a binding reveals all newly uncovered tiles after removing both halves", () => {
    const round = new Round(
        2,
        "A",
        [0, 0, 1, 2, 3, 3, 4],
        undefined,
        [[[0, 0, 4, 1]], [[0.5, 0, 3, 1]]],
        false,
        [
            [0, 1],
            [4, 5],
        ],
    );
    assert.equal(round.take(5), 0);
    assert.deepEqual(
        round.cards.slice(0, 4).map((card) => round.isFaceUp(card)),
        [true, true, false, false],
    );
    assert.equal(round.take(6), 0);
    assert.ok(round.cards.slice(0, 4).every((card) => round.isFaceUp(card)));
});

test("clearing slots reveals tiles exposed by the resolved removal", () => {
    const round = new Round(2, "A", [0, 1, 1, 1], undefined, [
        [[0, 0, 2, 1]],
        [
            [0, 0, 1, 1],
            [3, 0, 1, 1],
        ],
    ]);
    assert.equal(round.take(3), 0);
    assert.equal(round.isFaceUp(round.cards[0]), false);
    assert.ok(round.clearSlots());
    assert.equal(round.isFaceUp(round.cards[0]), true);
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
        assert.equal(round.use("remove"), false);
        assert.equal(round.moves, capacity);
        const slots = [...round.slots];
        const remaining = round.remaining;
        assert.equal(round.canRevive, true);
        const groups = round.revive();
        assert.equal(groups.length, slots.length);
        assert.equal(round.revive(), undefined);
        assert.equal(round.slotCapacity, capacity);
        assert.equal(round.status, "playing");
        assert.deepEqual(round.slots, []);
        assert.equal(round.remaining, remaining - slots.length * 3);
        assert.equal(round.moves, capacity);
        assert.equal(round.propUsesLeft("remove"), 1);
        assert.equal(round.use("undo"), false);
    }
});

test("a matching fifth tile clears before checking for failure", () => {
    const round = new Round(2, "A");
    const top = round.cards.filter((card) => card.layer === 2);
    for (const index of [2, 0, 1, 5])
        assert.equal(round.take(top[index].id), 0);
    assert.deepEqual(round.slots, [top[2], top[5], top[0], top[1]]);
    assert.equal(round.slotInsertionIndex(top[6].kind), 2);
    assert.equal(round.take(top[6].id), 3);
    assert.equal(round.firstMatchAt, 5);
    assert.equal(round.status, "playing");
    assert.deepEqual(round.slots, [top[0], top[1]]);
});

test("undo preserves tile count and can only be used once", () => {
    const round = new Round(2, "A");
    const first = round.cards[128];
    const card = round.cards[131];
    const other = round.cards[126];
    assert.equal(round.use("undo"), false);
    assert.equal(round.take(first.id), 0);
    assert.equal(round.take(other.id), 0);
    assert.equal(round.take(card.id), 0);
    assert.deepEqual(round.slots, [first, card, other]);
    assert.equal(round.use("undo"), true);
    assert.deepEqual(round.slots, [first, other]);
    assert.equal(round.remaining, 189);
    assert.equal(round.isOnBoard(card), true);
    assert.equal(round.isFaceUp(card), true);
    assert.equal(round.use("undo"), false);
});

test("peek reveals all uncovered dark cards and permits immediate takes", () => {
    const round = new Round(2, "C", undefined, () => 0);
    const previouslyVisible = new Set(
        round.cards.filter((card) => round.isFaceUp(card)),
    );
    const expected = round.cards.filter(
        (card) =>
            !previouslyVisible.has(card) &&
            round.isSelectable(round.exposure(card)),
    );
    assert.ok(expected.length > 3);
    assert.equal(round.use("peek"), true);
    assert.deepEqual(
        round.cards.filter(
            (card) => round.isFaceUp(card) && !previouslyVisible.has(card),
        ),
        expected,
    );
    assert.equal(round.take(0), null);
    assert.equal(round.take(126), 0);
    assert.equal(round.isFaceUp(round.cards[128]), true);
    assert.equal(round.use("peek"), false);
});

test("peek includes uncovered lower layers while the summit remains", () => {
    const round = new Round(2, "A", undefined, () => 0, "pyramid");
    const dark = round.cards.filter((card) => !round.isFaceUp(card));
    const expected = dark.filter((card) =>
        round.isSelectable(round.exposure(card)),
    );
    assert.ok(expected.length > 3);
    assert.ok(expected.some((card) => card.layer < 5));
    assert.ok(dark.some((card) => card.layer === 5));
    assert.ok(dark.some((card) => !round.isSelectable(round.exposure(card))));
    assert.equal(round.use("peek"), true);
    assert.deepEqual(
        dark.filter((card) => round.isFaceUp(card)),
        expected,
    );
});

test("peek fills from the highest covered layers when exposed cards are already face up", () => {
    const round = new Round(2, "B", undefined, () => 0, "pyramid");
    const hidden = round.cards.filter((card) => !round.isFaceUp(card));
    const expected = hidden
        .slice()
        .sort((a, b) => b.layer - a.layer)
        .slice(0, 3);
    assert.equal(round.use("peek"), true);
    assert.equal(hidden.filter((card) => round.isFaceUp(card)).length, 3);
    for (const card of expected) {
        assert.equal(round.isFaceUp(card), true);
        assert.equal(round.take(card.id), null);
    }
    assert.equal(round.propUsesLeft("peek"), 0);
});

test("clear slots completes every group in first-entry order", () => {
    const round = new Round(2, "A");
    assert.equal(round.use("remove"), false);
    assert.equal(round.take(126), 0);
    assert.equal(round.take(128), 0);
    assert.equal(round.take(131), 0);
    const groups = round.clearSlots();
    assert.deepEqual(
        groups.map(({ kind, heldCount }) => [kind, heldCount]),
        [
            [round.cards[126].kind, 1],
            [round.cards[128].kind, 2],
        ],
    );
    assert.deepEqual(round.slots, []);
    assert.ok(
        groups.every(({ boardCards }) =>
            boardCards.every((card) => !round.isOnBoard(card)),
        ),
    );
    assert.equal(round.isOnBoard(round.cards[132]), false);
    assert.equal(round.remaining, 183);
    assert.equal(round.moves, 3);
    assert.equal(round.firstMatchAt, "prop");
    assert.equal(round.use("remove"), false);
});

test("clear slots completes a group across layers in highest-first order", () => {
    const round = new Round(2, "A", [...DEFAULT_BOARD_KINDS]);
    assert.equal(round.take(173), 0);
    const matches = [125, 0].map((id) => round.cards[id]);
    assert.notEqual(matches[0].layer, matches[1].layer);
    assert.ok(
        matches.every((card) => !round.isSelectable(round.exposure(card))),
    );
    assert.deepEqual(round.clearSlots(), [
        { kind: round.cards[173].kind, heldCount: 1, boardCards: matches },
    ]);
    assert.deepEqual(round.slots, []);
    assert.ok(matches.every((card) => !round.isOnBoard(card)));
    assert.equal(round.propUsesLeft("remove"), 0);
});

test("clear slots prefers a higher complete binding over lower single tiles", () => {
    const layout = [
        [[0, 0, 6, 1]],
        [
            [0, 0, 2, 1],
            [3, 0, 1, 1],
        ],
    ];
    const round = new Round(
        2,
        "C",
        [0, 0, 0, 1, 1, 1, 0, 0, 0],
        undefined,
        layout,
        false,
        [[6, 7]],
        true,
    );
    assert.equal(round.take(8), 0);
    const [group] = round.clearSlots();
    assert.deepEqual(
        group.boardCards.map(({ id }) => id),
        [6, 7],
    );
    for (const id of [0, 1, 2]) assert.ok(round.isOnBoard(round.cards[id]));
});

test("clear slots preserves every tile and the prop if any type cannot be completed", () => {
    const round = new Round(2, "C", [0, 0, 0, 1, 1, 2], undefined, [
        [[0, 0, 6, 1]],
    ]);
    round.take(0);
    round.take(3);
    assert.equal(round.use("remove"), false);
    assert.equal(round.propUsesLeft("remove"), 1);
    assert.equal(round.remaining, 6);
    assert.ok([1, 2, 4, 5].every((id) => round.isOnBoard(round.cards[id])));
    assert.deepEqual(
        round.slots.map((card) => card.id),
        [0, 3],
    );
});

test("remove searches lower layers for a complete group", () => {
    const kinds = [...DEFAULT_BOARD_KINDS];
    const movedKind = kinds[125];
    kinds[125] = kinds[1];
    kinds[1] = movedKind;
    const round = new Round(2, "A", kinds);
    assert.equal(round.take(173), 0);

    assert.equal(round.use("remove"), true);
    assert.deepEqual(round.slots, []);
    assert.equal(round.isOnBoard(round.cards[0]), false);
    assert.equal(round.isOnBoard(round.cards[1]), false);
    assert.equal(round.isOnBoard(round.cards[188]), true);
    assert.equal(round.propUsesLeft("remove"), 0);
});

test("each claim-mode prop can be acquired and used once per round", () => {
    const round = new Round(2, "A", undefined, Math.random, undefined, true);
    assert.equal(round.propUsesLeft("peek"), 0);
    assert.equal(round.use("peek"), false);
    assert.equal(round.claimProp("peek"), true);
    assert.equal(round.hasProgress, true);
    assert.equal(round.claimProp("peek"), false);
    assert.equal(round.propUsesLeft("peek"), 1);
    assert.equal(round.use("peek"), true);
    assert.equal(round.propUsesLeft("peek"), 0);
    assert.equal(round.claimProp("peek"), false);
    assert.equal(round.claimProp("undo"), true);
    assert.equal(round.use("undo"), false);
    assert.equal(round.propUsesLeft("undo"), 1);
    round.status = "lost";
    assert.equal(round.claimProp("remove"), false);
    assert.equal(new Round(1, "A").claimProp("peek"), false);
});

test("bound tiles reveal together, require both tiles clear, and undo as one move", () => {
    const layout = [[[0, 0, 5, 2]], [[1, 0, 1, 1]]];
    const round = new Round(
        2,
        "A",
        [2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        undefined,
        layout,
        false,
        [[0, 1]],
    );
    assert.equal(round.take(0), null);
    assert.equal(round.take(5), 0);
    assert.equal(round.isFaceUp(round.cards[0]), true);
    assert.equal(round.isFaceUp(round.cards[1]), true);
    assert.equal(round.take(0), null);
    assert.equal(round.take(10), 0);
    assert.equal(round.take(1), 0);
    assert.deepEqual(
        round.slots.map(({ id }) => id),
        [5, 10, 1, 0],
    );
    assert.equal(round.moves, 3);
    assert.equal(round.use("undo"), true);
    assert.deepEqual(
        round.slots.map(({ id }) => id),
        [5, 10],
    );
    assert.ok(
        round.bindings.flat().every((id) => round.isOnBoard(round.cards[id])),
    );
});

test("one empty slot rejects a bound pair even when it would make a match", () => {
    const layout = [[[0, 0, 5, 2]]];
    const round = new Round(
        2,
        "A",
        [2, 2, 2, 3, 4, 5, 6, 7, 8, 9],
        undefined,
        layout,
        false,
        [[0, 1]],
    );
    for (const id of [2, 3, 4, 5, 6, 7]) assert.equal(round.take(id), 0);
    assert.equal(round.take(0), null);
    assert.equal(round.take(1), null);
    assert.equal(round.slots.length, 6);
    assert.equal(round.moves, 6);
    assert.ok(
        round.bindings.flat().every((id) => round.isOnBoard(round.cards[id])),
    );
});

test("taking a bound pair into two matching held tiles removes only three", () => {
    const round = new Round(
        2,
        "A",
        [1, 1, 1, 1, 2],
        undefined,
        [[[0, 0, 5, 1]]],
        false,
        [[0, 1]],
    );
    assert.equal(round.take(2), 0);
    assert.equal(round.take(3), 0);
    assert.equal(round.take(0), 3);
    assert.deepEqual(
        round.slots.map(({ id }) => id),
        [1],
    );
    assert.equal(round.remaining, 2);
    assert.equal(round.use("undo"), false);
});

test("revival can clear the final tiles while preserving bound pairs and prop state", () => {
    const kinds = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2];
    const layout = [[[0, 0, 12, 1]]];
    const round = new Round(
        2,
        "C",
        kinds,
        undefined,
        layout,
        true,
        [
            [2, 3],
            [4, 5],
        ],
        true,
    );
    assert.equal(round.revive(), undefined);
    assert.ok(round.claimProp("peek"));
    assert.ok(round.use("peek"));
    assert.ok(round.claimProp("remove"));
    for (const id of [0, 1, 6, 7, 9, 10]) assert.notEqual(round.take(id), null);
    assert.equal(round.status, "lost");
    const groups = round.revive();
    assert.equal(groups[0].heldCount, 2);
    assert.deepEqual(
        groups[0].boardCards.map((card) => card.id),
        [2, 3, 4, 5],
    );
    assert.equal(round.status, "won");
    assert.equal(round.remaining, 0);
    assert.equal(round.slots.length, 0);
    assert.equal(round.slotCapacity, 6);
    assert.equal(round.propUsesLeft("peek"), 0);
    assert.equal(round.propUsesLeft("remove"), 1);
    assert.equal(round.revive(), undefined);
});

test("a failed revival is atomic and does not consume cards or props", () => {
    const round = new Round(
        2,
        "C",
        [0, 1, 2, 3, 4, 5, 6],
        undefined,
        [[[0, 0, 7, 1]]],
        false,
    );
    for (let id = 0; id < 7; id++) round.take(id);
    assert.equal(round.status, "lost");
    const slots = [...round.slots];
    assert.equal(round.revive(), undefined);
    assert.equal(round.status, "lost");
    assert.deepEqual(round.slots, slots);
    assert.equal(round.propUsesLeft("remove"), 1);
});

test("advanced pairs insert both kinds and can resolve two triples atomically", () => {
    for (const clicked of [4, 5]) {
        const round = new Round(
            2,
            "C",
            [0, 0, 1, 1, 0, 1],
            undefined,
            [[[0, 0, 6, 1]]],
            false,
            [[4, 5]],
            true,
        );
        for (const id of [0, 1, 2, 3]) assert.equal(round.take(id), 0);
        assert.equal(round.take(clicked), 6);
        assert.deepEqual(round.slots, []);
        assert.equal(round.status, "won");
        assert.equal(round.canUse("undo"), false);
    }
});

test("advanced pairs preserve the unmatched partner and undo the complete pair", () => {
    const round = new Round(
        2,
        "C",
        [0, 0, 1, 0, 1, 1],
        undefined,
        [[[0, 0, 6, 1]]],
        false,
        [[3, 4]],
        true,
    );
    assert.equal(round.take(3), 0);
    assert.deepEqual(
        round.slots.map((c) => c.kind),
        [0, 1],
    );
    assert.equal(round.use("undo"), true);
    assert.ok([3, 4].every((id) => round.isOnBoard(round.cards[id])));
    round.take(0);
    round.take(1);
    assert.equal(round.take(4), 3);
    assert.deepEqual(
        round.slots.map((c) => c.kind),
        [1],
    );
    assert.equal(round.canUse("undo"), false);
    round.take(2);
    round.take(5);
    assert.equal(round.status, "won");
});

test("slot clearing completes collateral kinds without splitting advanced pairs", () => {
    const round = new Round(
        2,
        "C",
        [0, 0, 0, 1, 1, 1, 2, 2, 2],
        undefined,
        [[[0, 0, 9, 1]]],
        false,
        [
            [2, 3],
            [5, 6],
        ],
        true,
    );
    round.take(0);
    round.take(1);
    const groups = round.clearSlots();
    assert.ok(groups);
    assert.deepEqual(
        groups.map((g) => g.kind),
        [0, 1, 2],
    );
    assert.equal(
        new Set(groups.flatMap((g) => g.boardCards.map((c) => c.id))).size,
        7,
    );
    for (const g of groups)
        assert.equal((g.heldCount + g.boardCards.length) % 3, 0);
    assert.equal(round.status, "won");
});

test("an advanced pair cannot use a lone empty slot even if a type would match", () => {
    const round = new Round(
        2,
        "C",
        [0, 1, 2, 3, 4, 0, 1, 5],
        undefined,
        [[[0, 0, 8, 1]]],
        false,
        [[5, 6]],
        true,
    );
    for (const id of [0, 1, 2, 3, 4]) round.take(id);
    assert.equal(round.status, "playing");
    assert.equal(round.canTake(5), false);
    assert.equal(round.take(6), null);
    assert.ok([5, 6].every((id) => round.isOnBoard(round.cards[id])));
});

test("precomputed covering masks follow pair removal, undo and clearing", () => {
    const r = new Round(
        2,
        "C",
        [0, 0, 1, 1, 2, 2, 0, 1, 2],
        undefined,
        [[[0, 0, 3, 2]], [[0.5, 0.5, 2, 1]], [[1, 1, 1, 1]]],
        false,
        [[6, 7]],
        true,
    );
    const check = () => {
        for (const card of r.cards) {
            let expected = 0;
            for (const [bit, [x, y]] of [
                [0.25, 0.25],
                [0.75, 0.25],
                [0.25, 0.75],
                [0.75, 0.75],
            ].entries()) {
                const covered = r.cards.some(
                    (upper) =>
                        r.isOnBoard(upper) &&
                        upper.layer > card.layer &&
                        card.left + x >= upper.left &&
                        card.left + x < upper.left + 1 &&
                        card.top + y >= upper.top &&
                        card.top + y < upper.top + 1,
                );
                if (!covered) expected |= 1 << bit;
            }
            assert.equal(r.exposure(card), expected, "card " + card.id);
        }
    };
    check();
    r.take(8);
    check();
    assert.equal(r.use("undo"), true);
    check();
    r.take(8);
    r.take(6);
    check();
    assert.ok(r.clearSlots());
    check();
    assert.equal(r.status, "won");
});

test("unlocking the seventh slot allows an advanced pair to complete both held types", () => {
    const r = new Round(
        2,
        "C",
        [0, 0, 1, 1, 2, 0, 1, 2, 2],
        undefined,
        [[[0, 0, 9, 1]]],
        false,
        [[5, 6]],
        true,
    );
    for (const id of [0, 1, 2, 3, 4]) r.take(id);
    assert.equal(r.take(5), null);
    assert.equal(r.unlockNextSlot(), true);
    assert.equal(r.take(5), 6);
    assert.deepEqual(
        r.slots.map((c) => c.kind),
        [2],
    );
    r.take(7);
    r.take(8);
    assert.equal(r.status, "won");
});

test("the default board has no three-copy reserved animal type", () => {
    assert.equal(isBoardKinds([...DEFAULT_BOARD_KINDS]), true);
    const counts = Map.groupBy(DEFAULT_BOARD_KINDS, (kind) => kind);
    assert.equal(counts.size, ANIMAL_KIND_COUNT);
    assert.ok(
        [...counts.values()].every(
            (cards) => cards.length >= 6 && cards.length % 3 === 0,
        ),
    );
});
