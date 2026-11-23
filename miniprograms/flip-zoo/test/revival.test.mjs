import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import * as rules from "../assets/scripts/gameplay/round.ts";

const exports = {};
const modules = {
    "node:crypto": crypto,
    "wx-server-sdk": { init() {}, database: () => ({}) },
    "./rules/gameplay/round.js": rules,
    "./rules/services/main-board-pool.js": {},
    "./gift-api.js": { createGiftApi: () => ({}) },
    "./gifts.js": { createGiftHandler: () => () => {} },
};
runInNewContext(
    readFileSync(
        new URL(
            "../cloud-functions/flip-zoo-fragments/index.js",
            import.meta.url,
        ),
        "utf8",
    ) + "\nexports.verifyWin = verifyWin;",
    { exports, require: (name) => modules[name], process: { env: {} } },
);

test("cloud replay accepts a real loss followed by revival and a cleared board", () => {
    const deal = {
        kinds: Array.from({ length: 18 }, (_, id) => Math.floor(id / 3)),
        layout: [[[0, 0, 18, 1]]],
        bindings: [],
    };
    const loss = [0, 3, 6, 9, 12, 15];
    assert.equal(
        exports.verifyWin(deal, [...loss, rules.REVIVE_ACTION], true),
        true,
    );
    assert.equal(exports.verifyWin(deal, loss, true), false);
    assert.equal(
        exports.verifyWin(deal, [rules.REVIVE_ACTION, ...loss], true),
        false,
    );
    assert.equal(
        exports.verifyWin(
            deal,
            [...loss, rules.REVIVE_ACTION, rules.REVIVE_ACTION],
            true,
        ),
        false,
    );
});

test("cloud replay preserves complete bindings when revival needs two matching triples", () => {
    const deal = {
        kinds: [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2],
        layout: [[[0, 0, 12, 1]]],
        bindings: [
            [2, 3],
            [4, 5],
        ],
    };
    assert.equal(
        exports.verifyWin(deal, [0, 1, 6, 7, 9, 10, rules.REVIVE_ACTION], true),
        true,
    );
});

test("cloud replay clears both kinds of an advanced pair during revival", () => {
    const deal = {
        kinds: [0, 0, 1, 1, 2, 2, 0, 1, 2],
        layout: [[[0, 0, 9, 1]]],
        bindings: [[6, 7]],
    };
    assert.equal(
        exports.verifyWin(deal, [0, 1, 2, 3, 4, 5, rules.REVIVE_ACTION], true),
        true,
    );
});

test("cloud replay requires the slot unlock before a five-slot advanced-pair move", () => {
    const deal = {
        kinds: [0, 0, 1, 1, 2, 0, 1, 2, 2],
        layout: [[[0, 0, 9, 1]]],
        bindings: [[5, 6]],
    };
    assert.equal(
        exports.verifyWin(
            deal,
            [0, 1, 2, 3, 4, rules.SHARE_SLOT_ACTION, 5, 7, 8],
            true,
        ),
        true,
    );
    assert.equal(
        exports.verifyWin(deal, [0, 1, 2, 3, 4, 5, 7, 8], true),
        false,
    );
});

test("cloud replay accepts the reference solution for every current fixed board", async () => {
    const { MAIN_BOARD_POOL } =
        await import("../assets/scripts/services/main-board-pool.ts");
    const { default: orders } = await import(
        "./fixed-board-clear-orders.json",
        { with: { type: "json" } }
    );
    for (const [index, deal] of MAIN_BOARD_POOL.entries()) {
        const round = new rules.Round(
            2,
            "C",
            deal.kinds,
            undefined,
            deal.layout,
            true,
            deal.bindings,
            true,
        );
        const actions = [];
        for (const id of orders[index]) {
            if (!round.isOnBoard(round.cards[id])) continue;
            assert.notEqual(round.take(id), null, deal.name);
            actions.push(id);
        }
        assert.equal(exports.verifyWin(deal, actions, true), true, deal.name);
    }
});
