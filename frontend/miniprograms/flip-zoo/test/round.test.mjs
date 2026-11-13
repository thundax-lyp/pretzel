import assert from "node:assert/strict";
import { test } from "node:test";
import {
    DEFAULT_BOARD_KINDS,
    GROUPS,
    Round,
    isBoardKinds,
} from "../assets/scripts/gameplay/round.ts";
import {
    DEFAULT_DIFFICULTY,
    buildBoardKinds,
    isDifficulty,
} from "../scripts/difficulty.mjs";

const difficulties = [1, 2, 3].flatMap((keyGroups) =>
    Array.from({ length: keyGroups + 1 }, (_, overlapGroups) => ({
        keyGroups,
        overlapGroups,
    })),
);

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

test("the default and all nine difficulty settings are valid; bad counts are rejected", () => {
    assert.deepEqual(DEFAULT_DIFFICULTY, { keyGroups: 1, overlapGroups: 0 });
    assert.deepEqual(buildBoardKinds(DEFAULT_DIFFICULTY), DEFAULT_BOARD_KINDS);
    assert.ok(difficulties.every(isDifficulty));
    for (const [keyGroups, overlapGroups] of [
        [0, 0],
        [4, 0],
        [2, 3],
        [1, -1],
        [3, 1.5],
        ["1", 0],
    ]) {
        assert.equal(isDifficulty({ keyGroups, overlapGroups }), false);
    }
});

test("all nine settings reserve exactly three copies per key kind and the requested overlaps", () => {
    for (const difficulty of difficulties) {
        const kindsForRound = buildBoardKinds(difficulty);
        assert.equal(isBoardKinds(kindsForRound), true);
        const round = new Round(2, "A", kindsForRound);
        const base = new Round(
            2,
            "C",
            buildBoardKinds({ ...difficulty, overlapGroups: 0 }),
        );
        assert.equal(round.cards.length, 189);
        const byKind = (cards) => {
            const groups = new Map();
            for (const card of cards) {
                if (!groups.has(card.kind)) groups.set(card.kind, []);
                groups.get(card.kind).push(card);
            }
            return [...groups.entries()].sort(([a], [b]) => a - b);
        };
        const kinds = byKind(round.cards);
        assert.equal(kinds.length, 16);
        assert.ok(kinds.every(([, cards]) => cards.length % 3 === 0));
        assert.deepEqual(
            kinds.map(([kind, cards]) => [kind, cards.length]),
            byKind(base.cards).map(([kind, cards]) => [kind, cards.length]),
        );
        assert.deepEqual(
            round.cards.map(({ id, left, top }) => [id, left, top]),
            base.cards.map(({ id, left, top }) => [id, left, top]),
        );
        const keys = kinds.filter(([, cards]) => cards.length === 3);
        assert.equal(keys.length, difficulty.keyGroups);
        let overlapping = 0;
        for (const [, cards] of keys) {
            assert.deepEqual(
                cards.map(({ layer }) => layer),
                [0, 1, 2],
            );
            const pairs = cards.flatMap((lower, index) =>
                cards
                    .slice(index + 1)
                    .filter(
                        (upper) =>
                            Math.abs(upper.left - lower.left) < 1 &&
                            Math.abs(upper.top - lower.top) < 1,
                    )
                    .map((upper) => [lower.layer, upper.layer]),
            );
            assert.ok(pairs.length <= 1);
            if (pairs.length) {
                assert.deepEqual(pairs[0], [1, 2]);
                overlapping += 1;
            }
        }
        assert.equal(overlapping, difficulty.overlapGroups);
    }
});

function takeWithFullInformation(round, preferTop = false) {
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
        if (preferTop) score = score * 3 + card.layer;
        if (score > bestScore) {
            best = card;
            bestScore = score;
        }
    }
    assert.notEqual(round.take(best.id), null);
}

test("each difficulty has a legal five-slot clear with full information", () => {
    for (const difficulty of difficulties) {
        const round = new Round(2, "B", buildBoardKinds(difficulty));
        while (round.status === "playing") takeWithFullInformation(round);
        assert.equal(round.status, "won", JSON.stringify(difficulty));
        assert.equal(round.moves, 189);
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
        assert.equal(round.canRevive, capacity < 7);
        assert.equal(round.revive(), capacity < 7);
        assert.equal(round.revive(), false);
        assert.equal(round.slotCapacity, Math.min(capacity + 1, 7));
        assert.equal(round.status, capacity < 7 ? "playing" : "lost");
        assert.deepEqual(round.slots, slots);
        assert.equal(round.remaining, remaining);
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
    const round = new Round(2, "C", undefined, () => 0, "pyramid");
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

test("clear slots preserves the board and use when any group cannot be completed", () => {
    const round = new Round(
        2,
        "A",
        buildBoardKinds({ keyGroups: 3, overlapGroups: 1 }),
    );
    assert.equal(round.take(128), 0);
    assert.equal(round.take(173), 0);
    const blocked = [0, 110].map((id) => round.cards[id]);
    assert.ok(
        blocked.every((card) => !round.isSelectable(round.exposure(card))),
    );
    assert.equal(round.use("remove"), false);
    assert.equal(round.propUsesLeft("remove"), 1);
    assert.equal(round.remaining, 189);
    assert.ok(blocked.every((card) => round.isOnBoard(card)));
    assert.equal(round.isOnBoard(round.cards[131]), true);
    assert.equal(round.isOnBoard(round.cards[132]), true);
    assert.deepEqual(
        round.slots.map((card) => card.id),
        [128, 173],
    );
});

test("remove searches lower layers for a complete group", () => {
    const kinds = buildBoardKinds({ keyGroups: 3, overlapGroups: 1 });
    const movedKind = kinds[110];
    kinds[110] = kinds[1];
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
