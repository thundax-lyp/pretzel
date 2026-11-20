import assert from "node:assert/strict";
import { test } from "node:test";
import {
    MAIN_BOARD_CONFIG,
    MAIN_BOARD_POOL,
} from "../assets/scripts/services/main-board-pool.ts";
import { createBoardApi } from "../assets/scripts/services/board-api.ts";
import { isInsideCardOutline } from "../assets/scripts/gameplay/card-outline.ts";
import {
    ANIMAL_KIND_COUNT,
    MAIN_LAYOUTS,
    Round,
    generateMainBoard,
    isBoardKinds,
} from "../assets/scripts/gameplay/round.ts";
import clearOrders from "./fixed-board-clear-orders.json" with { type: "json" };
import { buildBoardKinds } from "../scripts/difficulty.mjs";

function usePreviewOrigin(context) {
    Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: { origin: "http://127.0.0.1:8874" },
    });
    context.after(() => delete globalThis.location);
}

test("the visible right edge of an elevated card extends past its logical footprint", () => {
    const layout = [[[1, 0, 1, 1]], [[0.5, 0, 1, 1]], [[0, 0, 1, 1]]];
    const round = new Round(2, "C", [0, 0, 0], undefined, layout);
    const summit = round.cards[2];
    const width = 88;
    const height = 92;
    const offset = summit.layer * 2;
    const rightEdge = summit.left + 1 + 2 / width;
    const middle = summit.top + 0.5;
    assert.equal(round.cardAt(rightEdge, middle).id, 1);
    assert.ok(round.isSelectable(round.exposure(summit)));
    assert.ok(
        isInsideCardOutline(
            (rightEdge - summit.left - 0.5) * width - offset,
            (summit.top + 0.5 - middle) * height - offset,
            width,
            height,
        ),
    );
    assert.equal(isInsideCardOutline(44, 0, width, height), false);
    assert.equal(isInsideCardOutline(43, 45, width, height), false);
});

test("WeChat draws each saved board without contacting the preview server", async (context) => {
    usePreviewOrigin(context);
    const fetch = context.mock.method(globalThis, "fetch", () => {
        throw new Error("Offline");
    });
    let draw = 0;
    context.mock.method(Math, "random", () => draw);
    const api = createBoardApi(true);
    const boards = new Set();
    const layouts = new Set();
    assert.equal(clearOrders.length, MAIN_BOARD_POOL.length);

    for (const [index, expected] of MAIN_BOARD_POOL.entries()) {
        draw = 0;
        const deal = await api.loadMainBoard();
        assert.deepEqual(deal, expected);
        const { kinds, layout, bindings } = deal;
        boards.add(kinds.join(","));
        const counts = Map.groupBy(kinds, (kind) => kind);
        assert.ok(counts.size >= 10 && counts.size <= ANIMAL_KIND_COUNT);
        assert.ok(
            [...counts.values()].every((cards) => cards.length % 3 === 0),
        );
        const keyKinds = [...counts].filter(([, cards]) => cards.length === 3);
        assert.ok(keyKinds.length <= 3, expected.name);
        assert.ok(bindings.length <= 20, expected.name);
        const round = new Round(
            2,
            "C",
            kinds,
            undefined,
            layout,
            false,
            bindings,
            true,
        );
        assert.equal(round.slotCapacity, 6);
        for (const [kind] of keyKinds) {
            assert.deepEqual(
                round.cards
                    .filter((card) => card.kind === kind)
                    .map((card) => card.layer),
                [0, 1, 2],
                expected.name,
            );
        }
        const faceUp = round.cards.filter((card) => round.isFaceUp(card));
        const boundIds = bindings.flat();
        assert.equal(new Set(boundIds).size, boundIds.length, expected.name);
        const lowerBindings = bindings.filter(
            ([first]) => round.cards[first].layer < 3,
        ).length;
        assert.ok(
            bindings.length === 0 || lowerBindings > bindings.length / 2,
            expected.name,
        );
        for (const [first, second] of bindings) {
            const a = round.cards[first];
            const b = round.cards[second];
            assert.equal(a.kind, b.kind, expected.name);
            assert.equal(a.layer, b.layer, expected.name);
            assert.equal(
                Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
                1,
                expected.name,
            );
        }
        assert.equal(faceUp.length, 12, expected.name);
        assert.ok(
            faceUp.every((card) => round.isSelectable(round.exposure(card))),
            expected.name,
        );
        assert.equal(round.isFaceUp(round.cards.at(-1)), false, expected.name);
        const layoutKey = round.cards
            .map(({ layer, left, top }) => `${layer},${left},${top}`)
            .sort()
            .join(";");
        assert.ok(!layouts.has(layoutKey), expected.name);
        layouts.add(layoutKey);
        const layers = Map.groupBy(round.cards, ({ layer }) => layer);
        assert.equal(round.cards.length, 189, expected.name);
        assert.ok(layers.size >= 2 && layers.size <= 9, expected.name);
        const layerCounts = [...layers.values()].map((cards) => cards.length);
        assert.ok(Math.max(...layerCounts) <= 35, expected.name);
        const waist = Math.min(...layerCounts.slice(1, -1));
        assert.ok(
            waist < layerCounts[0] && waist < layerCounts.at(-1),
            expected.name,
        );
        const overlaps = (a, b) =>
            Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1;
        const coveredLayers = round.cards.filter(
            (card) => card.layer < layers.size - 1,
        );
        const coverCounts = coveredLayers.map(
            (card) =>
                layers
                    .get(card.layer + 1)
                    .filter((upper) => overlaps(card, upper)).length,
        );
        assert.ok(
            coverCounts.filter((count) => count === 1).length /
                coveredLayers.length <=
                0.2,
            expected.name,
        );
        assert.ok(
            coverCounts.filter((count) => count >= 2 && count <= 4).length /
                coveredLayers.length >=
                0.75,
            expected.name,
        );
        for (const [layer, cards] of layers) {
            for (const card of cards) {
                assert.ok(
                    card.left >= 0 &&
                        card.left + 1 <= 7 &&
                        card.top >= 0 &&
                        card.top + 1 <= 8 &&
                        Number.isInteger(card.left * 2) &&
                        Number.isInteger(card.top * 2),
                    expected.name,
                );
                assert.ok(
                    cards.every(
                        (other) => other === card || !overlaps(card, other),
                    ),
                    expected.name,
                );
                if (layer > 0) {
                    assert.ok(
                        layers
                            .get(layer - 1)
                            .some((lower) => overlaps(card, lower)),
                        expected.name,
                    );
                }
            }
        }
        const layerKindCounts = [...layers.values()]
            .reverse()
            .map((cards) => new Set(cards.map(({ kind }) => kind)).size);
        assert.deepEqual(
            layerKindCounts,
            MAIN_BOARD_CONFIG[index].layerKindCounts,
            expected.name,
        );
        for (const id of clearOrders[index]) {
            if (
                bindings.some((pair) => pair.includes(id)) &&
                !round.isOnBoard(round.cards[id])
            )
                continue;
            const card = round.cards[id];
            const partner = round.boundPartner(id);
            const matching = round.slots.filter(
                (held) => held.kind === card.kind,
            );
            matching.push(card);
            if (partner) matching.push(partner);
            assert.notEqual(round.take(id), null, expected.name);
            if (matching.length === 3) {
                const layers = matching.map(({ layer }) => layer);
                assert.ok(
                    Math.max(...layers) - Math.min(...layers) <= 2,
                    expected.name,
                );
            }
        }
        assert.equal(round.status, "won", expected.name);
        assert.equal(round.firstMatchAt, 3);
        assert.equal(round.slotCapacity, 6);
    }
    const last = [...boards].at(-1);
    const nextCycle = new Set();
    draw = 0.999;
    for (let i = 0; i < MAIN_BOARD_POOL.length; i += 1) {
        const { kinds } = await api.loadMainBoard();
        const key = kinds.join(",");
        if (i === 0) assert.notEqual(key, last);
        nextCycle.add(key);
    }
    assert.deepEqual(nextCycle, boards);
    assert.equal(boards.size, 40);
    assert.equal(fetch.mock.callCount(), 0);
});

test("generated deals clear with five slots using the actual Round rules", () => {
    const histogram = (kinds) =>
        kinds.reduce((counts, kind) => {
            counts[kind] += 1;
            return counts;
        }, Array(ANIMAL_KIND_COUNT).fill(0));
    for (let seed = 1; seed <= 60; seed += 1) {
        const count = 2 + (seed % 4);
        let state = seed;
        let first = true;
        const random = () => {
            if (first) {
                first = false;
                return (count - 2 + 0.5) / 4;
            }
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 2 ** 32;
        };
        const { kinds, clearOrder } = generateMainBoard(random);
        assert.ok(isBoardKinds(kinds));
        const counts = histogram(kinds);
        assert.equal(counts.filter((copies) => copies === 3).length, count);
        const round = new Round(2, "C", kinds);
        for (const [kind, copies] of counts.entries()) {
            if (copies !== 3) continue;
            const reserved = round.cards.filter((card) => card.kind === kind);
            assert.deepEqual(
                reserved.map(({ layer }) => layer),
                [0, 1, 2],
            );
            for (const [index, lower] of reserved.entries()) {
                for (const upper of reserved.slice(index + 1)) {
                    assert.ok(
                        Math.abs(upper.left - lower.left) >= 1 ||
                            Math.abs(upper.top - lower.top) >= 1,
                    );
                }
            }
        }
        for (const id of clearOrder) {
            const card = round.cards[id];
            assert.equal(round.cardAt(card.left + 0.5, card.top + 0.5), card);
            assert.notEqual(round.take(id), null, `seed ${seed}, card ${id}`);
        }
        assert.equal(round.status, "won", `seed ${seed}`);
        assert.equal(round.slotCapacity, 5);
    }
});

test("peak layouts open seven slots and cannot expand after a full tray", () => {
    for (const layout of MAIN_LAYOUTS) {
        const kinds = Array.from(
            { length: 189 },
            (_, id) => id % ANIMAL_KIND_COUNT,
        );
        const round = new Round(2, "C", kinds, Math.random, layout);
        const byKind = new Map();
        for (const card of round.cards) {
            if (round.isSelectable(round.exposure(card)))
                byKind.set(card.kind, card);
        }
        const picks = [...byKind.values()].slice(0, 7);
        assert.equal(picks.length, 7);
        for (const card of picks.slice(0, 6)) {
            assert.equal(round.take(card.id), 0);
            assert.equal(round.status, "playing");
        }
        assert.equal(round.take(picks[6].id), 0);
        assert.equal(round.status, "lost");
        assert.equal(round.slots.length, 7);
        assert.equal(round.canRevive, false);
    }
});

test("each peak shape fits the table and clears across all four key-group counts", () => {
    const overlap = (a, b) =>
        Math.max(0, 1 - Math.abs(a.left - b.left)) *
        Math.max(0, 1 - Math.abs(a.top - b.top));
    for (const [index, layout] of MAIN_LAYOUTS.entries()) {
        for (let sample = 0; sample < 20; sample += 1) {
            const count = 2 + (sample % 4);
            let state = 1 + sample + 20 * index;
            let first = true;
            const random = () => {
                if (first) {
                    first = false;
                    return (count - 2 + 0.5) / 4;
                }
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                return state / 2 ** 32;
            };
            const { kinds, clearOrder } = generateMainBoard(
                random,
                undefined,
                layout,
            );
            assert.ok(isBoardKinds(kinds));
            const round = new Round(2, "C", kinds, random, layout);
            const layers = Array.from({ length: 6 }, (_, layer) =>
                round.cards.filter((card) => card.layer === layer),
            );
            assert.ok(layers.every((cards) => cards.length > 0));
            assert.equal(
                round.cards.filter((card) => round.isFaceUp(card)).length,
                Math.min(
                    12,
                    round.cards
                        .slice(0, -1)
                        .filter((card) =>
                            round.isSelectable(round.exposure(card)),
                        ).length,
                ),
            );
            if (sample === 0) {
                for (const [layer, cards] of layers.entries()) {
                    for (const card of cards) {
                        assert.ok(card.left >= 0 && card.left + 1 <= 8);
                        assert.ok(card.top >= 0 && card.top + 1 <= 10);
                        assert.ok(
                            cards.every(
                                (other) =>
                                    other === card ||
                                    overlap(card, other) === 0,
                            ),
                        );
                        if (layer > 0) {
                            assert.ok(
                                layers[layer - 1].some(
                                    (lower) => overlap(card, lower) > 0,
                                ),
                            );
                        }
                    }
                }
                if (layout !== "pyramid") {
                    assert.ok(
                        layers[5].some(
                            (card) =>
                                layers[4].reduce(
                                    (area, lower) =>
                                        area + overlap(card, lower),
                                    0,
                                ) < 1,
                        ),
                    );
                }
                const propRound = new Round(2, "C", kinds, random, layout);
                const dark = propRound.cards.filter(
                    (card) => !propRound.isFaceUp(card),
                );
                const eligible = dark.filter((card) =>
                    propRound.isSelectable(propRound.exposure(card)),
                );
                assert.equal(propRound.use("peek"), true);
                const revealed = dark.filter((card) =>
                    propRound.isFaceUp(card),
                );
                assert.equal(revealed.length, Math.max(3, eligible.length));
                assert.ok(eligible.every((card) => revealed.includes(card)));
            }
            const byKind = Map.groupBy(round.cards, (card) => card.kind);
            const keys = [...byKind.values()].filter(
                (cards) => cards.length === 3,
            );
            assert.equal(byKind.size, ANIMAL_KIND_COUNT);
            assert.equal(keys.length, count);
            for (const cards of keys) {
                assert.deepEqual(
                    cards.map((card) => card.layer),
                    [0, 1, 2],
                );
                assert.equal(
                    overlap(cards[0], cards[1]) +
                        overlap(cards[1], cards[2]) +
                        overlap(cards[0], cards[2]),
                    0,
                );
            }
            const isOrdinary = (card) => byKind.get(card.kind).length > 3;
            assert.equal(round.slotCapacity, 7);
            assert.equal(round.hasProgress, false);
            assert.equal(round.unlockNextSlot(), false);
            for (const id of clearOrder) {
                const card = round.cards[id];
                assert.equal(
                    round.cardAt(card.left + 0.5, card.top + 0.5),
                    card,
                );
                const matchingSlots = round.slots.filter(
                    ({ kind }) => kind === card.kind,
                );
                const taken = round.take(id);
                assert.notEqual(
                    taken,
                    null,
                    `${layout}, sample ${sample}, card ${id}`,
                );
                if (taken === 3 && isOrdinary(card)) {
                    const matchedLayers = [...matchingSlots, card].map(
                        ({ layer }) => layer,
                    );
                    assert.ok(
                        Math.max(...matchedLayers) -
                            Math.min(...matchedLayers) <=
                            2,
                    );
                }
            }
            assert.equal(round.status, "won");
            assert.equal(round.firstMatchAt, 3);
        }
    }
});

test("Web preview loads the existing HTTP payload and surfaces failures", async (context) => {
    usePreviewOrigin(context);
    const board = buildBoardKinds({ keyGroups: 3, overlapGroups: 2 });
    const responses = [
        Response.json(board),
        Response.json({ error: "unavailable" }, { status: 503 }),
        Response.json([0]),
    ];
    const fetch = context.mock.method(globalThis, "fetch", async () =>
        responses.shift(),
    );

    const api = createBoardApi(false);
    assert.deepEqual(await api.loadMainBoard(), { kinds: board });
    assert.equal(fetch.mock.calls[0].arguments[0], "/api/board");
    await assert.rejects(api.loadMainBoard(), /503/);
    await assert.rejects(api.loadMainBoard(), /Invalid board/);
});
