import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as crypto from "node:crypto";
import { test } from "node:test";
import { compileFunction, runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(
    new URL("../cloud-functions/flip-zoo-rank/index.js", import.meta.url),
    "utf8",
);

test("lifetime rank counts only this user's verified second-level settlements, including reward limits", async () => {
    const identity = { OPENID: "current-user", APPID: "current-app" };
    const owner = createHash("sha256")
        .update("current-app:current-user")
        .digest("hex");
    const records = [
        { owner, outcome: { status: "granted" } },
        { owner, outcome: { status: "limit" } },
        { owner, outcome: { status: "granted" } },
        { owner },
        { owner, outcome: { status: "invalid" } },
        { owner: "another-user", outcome: { status: "granted" } },
    ];
    const exports = {};
    const db = {
        command: { in: (values) => values },
        collection(name) {
            assert.equal(name, "flipZooFragments");
            return {
                where(filter) {
                    return {
                        count: async () => ({
                            total: records.filter(
                                (row) =>
                                    row.owner === filter.owner &&
                                    filter["outcome.status"].includes(
                                        row.outcome?.status,
                                    ),
                            ).length,
                        }),
                    };
                },
            };
        },
    };
    runInNewContext(source, {
        exports,
        require: (name) =>
            name === "node:crypto"
                ? crypto
                : {
                      init() {},
                      database: () => db,
                      getWXContext: () => identity,
                  },
    });
    assert.equal(
        (await exports.main({ openid: "another-user", total: 999 })).total,
        3,
    );
    identity.OPENID = undefined;
    await assert.rejects(exports.main(), /Missing WeChat identity/);
});

test("client lifetime sync validates totals and uses the history-only open-data message", async () => {
    const compiled = ts.transpileModule(
        readFileSync(
            new URL(
                "../assets/scripts/services/leaderboard.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText;
    let total = 23;
    let available = true;
    const sent = [];
    const exports = {};
    compileFunction(compiled, ["exports", "require"])(exports, (name) =>
        name === "./cloud-health"
            ? {
                  callCloud: async (name) => {
                      assert.equal(name, "flipZooRank");
                      return { total };
                  },
              }
            : {
                  postRankMessage: (...message) => {
                      sent.push(message);
                      return available;
                  },
              },
    );
    await exports.syncLifetimeRank();
    assert.deepEqual(sent, [["sync-history", undefined, 23]]);
    for (const value of [-1, 1.5, "23", Number.MAX_SAFE_INTEGER + 1]) {
        total = value;
        await assert.rejects(exports.syncLifetimeRank(), /Invalid lifetime/);
    }
    assert.equal(sent.length, 1);
    total = 24;
    available = false;
    await assert.rejects(exports.syncLifetimeRank(), /context unavailable/);
});

test("normal and retried successful settlements sync the historical count without treating invalid rounds as wins", async () => {
    const compiled = ts.transpileModule(
        readFileSync(
            new URL("../assets/scripts/services/fragments.ts", import.meta.url),
            "utf8",
        ),
        { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText;
    const storage = new Map();
    let status = "granted";
    let syncs = 0;
    const exports = {};
    const modules = {
        cc: {
            sys: {
                localStorage: {
                    getItem: (key) => storage.get(key),
                    setItem: (key, value) => storage.set(key, value),
                },
            },
        },
        "./cloud-health": {
            callCloud: async (_name, data) =>
                data.action === "balances"
                    ? { balances: [0, 0, 0, 0, 0, 0] }
                    : { status, animal: 0 },
        },
        "./leaderboard": { syncLifetimeRank: async () => syncs++ },
    };
    compileFunction(compiled, ["exports", "require"])(
        exports,
        (name) => modules[name],
    );
    await exports.settleFragmentRound("round-a", []);
    assert.equal(syncs, 1);
    status = "limit";
    storage.set(
        "flip-zoo-pending-fragments",
        JSON.stringify({ "round-b": [] }),
    );
    await exports.loadFragmentBalances();
    assert.equal(syncs, 2);
    status = "invalid";
    await exports.settleFragmentRound("round-c", []);
    assert.equal(syncs, 2);
});
