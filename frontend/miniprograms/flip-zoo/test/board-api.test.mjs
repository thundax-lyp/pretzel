import assert from "node:assert/strict";
import { test } from "node:test";
import { MAIN_BOARD_POOL } from "../assets/scripts/main-board-pool.ts";
import { createBoardApi } from "../assets/scripts/board-api.ts";
import {
    MAIN_LAYOUTS,
    Round,
    generateMainBoard,
    isBoardKinds,
} from "../assets/scripts/round.ts";
import { buildBoardKinds } from "../scripts/difficulty.mjs";

function usePreviewOrigin(context) {
    Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: { origin: "http://127.0.0.1:8874" },
    });
    context.after(() => delete globalThis.location);
}

test("WeChat draws each saved board without contacting the preview server", async (context) => {
    usePreviewOrigin(context);
    const fetch = context.mock.method(globalThis, "fetch", () => {
        throw new Error("Offline");
    });
    let draw = 0;
    context.mock.method(Math, "random", () => draw);
    const api = createBoardApi(true);
    const boards = new Set();

    for (const [index, layout] of MAIN_LAYOUTS.entries()) {
        const saved = MAIN_BOARD_POOL[layout];
        assert.equal(saved.length, 4);
        for (const [variant, expected] of saved.entries()) {
            draw = 0;
            const deal = await api.loadMainBoard();
            const { kinds } = deal;
            assert.equal(deal.layout, layout);
            assert.deepEqual(kinds, expected);
            assert.ok(isBoardKinds(kinds));
            boards.add(kinds.join(","));

            // Reconstruct the reference clear order without shipping it in the game.
            let state = (index + 1) * 100 + variant;
            let first = true;
            const random = () => {
                if (first) {
                    first = false;
                    return (variant + 0.5) / 4;
                }
                state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
                return state / 2 ** 32;
            };
            const proof = generateMainBoard(random, undefined, layout);
            assert.deepEqual(kinds, proof.kinds);
            const round = new Round(2, "C", kinds, random, layout);
            for (const id of proof.clearOrder) {
                assert.notEqual(round.take(id), null);
            }
            assert.equal(round.status, "won");
        }
    }
    const last = [...boards].at(-1);
    const nextCycle = new Set();
    draw = 0.999;
    for (let i = 0; i < 12; i += 1) {
        const { kinds } = await api.loadMainBoard();
        const key = kinds.join(",");
        if (i === 0) assert.notEqual(key, last);
        nextCycle.add(key);
    }
    assert.deepEqual(nextCycle, boards);
    assert.equal(boards.size, 12);
    assert.equal(fetch.mock.callCount(), 0);
});

test("generated deals clear with five slots using the actual Round rules", () => {
    const histogram = (kinds) =>
        kinds.reduce((counts, kind) => {
            counts[kind] += 1;
            return counts;
        }, Array(16).fill(0));
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
                6,
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
                assert.equal(propRound.use("peek"), true);
                assert.ok(layers[5].every((card) => propRound.isFaceUp(card)));
            }
            const byKind = Map.groupBy(round.cards, (card) => card.kind);
            const keys = [...byKind.values()].filter(
                (cards) => cards.length === 3,
            );
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
            for (const id of clearOrder) {
                const card = round.cards[id];
                assert.equal(
                    round.cardAt(card.left + 0.5, card.top + 0.5),
                    card,
                );
                assert.notEqual(
                    round.take(id),
                    null,
                    `${layout}, sample ${sample}, card ${id}`,
                );
            }
            assert.equal(round.status, "won");
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
