import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import { compileFunction } from "node:vm";
import ts from "typescript";
import { ANIMALS } from "../../../../.agents/skills/pretzel-level-design/scripts/catalog.mjs";
import { generate } from "../../../../.agents/skills/pretzel-level-design/scripts/levels.mjs";

const out = mkdtempSync(join(tmpdir(), "pretzel-cocos-client-"));
after(() => rmSync(out, { recursive: true, force: true }));
execFileSync(process.execPath, [
    "node_modules/typescript/bin/tsc",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2020",
    "--module",
    "CommonJS",
    "--outDir",
    out,
    "assets/scripts/preview-api.ts",
    "assets/scripts/http-game-api.ts",
    "assets/scripts/board-layout.ts",
    "assets/scripts/home-layout.ts",
]);
const require = createRequire(import.meta.url);
const { createPreviewApi } = require(join(out, "preview-api.js"));
const { createHttpGameApi, GameApiError } = require(
    join(out, "http-game-api.js"),
);
const { RunState, canPick } = require(join(out, "run-state.js"));

function createGameClient() {
    const { outputText } = ts.transpileModule(
        readFileSync("assets/scripts/game-client.ts", "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                experimentalDecorators: true,
            },
        },
    );
    const exports = {};
    const imports = {
        cc: {
            Component: class {},
            _decorator: { ccclass: () => (target) => target, property() {} },
        },
        "cc/env": { DEBUG: false, PREVIEW: false },
        "./http-game-api": { GameApiError },
    };
    compileFunction(outputText, ["exports", "require"])(
        exports,
        (name) => imports[name] ?? {},
    );
    return new exports.GameClient();
}

test("retrying an accepted abandonment after a lost response returns home", async () => {
    const client = createGameClient();
    const api = createPreviewApi();
    const operate = api.operate;
    let original;
    api.operate = async (id, request) => {
        const result = await operate(id, request);
        if (!original) {
            original = request;
            throw new Error("response lost");
        }
        assert.deepEqual(request, original);
        return result;
    };
    client.state = new RunState(api, await api.start("abandon"), () => "op");
    await assert.rejects(client.state.submit({ type: "ABANDON" }));
    let homeVisits = 0;
    client.home = async () => {
        homeVisits++;
    };
    client.showGame = () => assert.fail("abandoned run reopened");
    await client.retryOperation();
    assert.equal(homeVisits, 1);
    assert.equal(client.state.snapshot.status, "ABANDONED");
});

test("home offers reconnection after expiry and keeps it after a login failure", async () => {
    const client = createGameClient();
    client.scene = "home";
    let reconnect;
    client.showNotice = (_title, _body, action, caption) => {
        assert.equal(caption, "重新连接");
        reconnect = action;
    };
    let attempts = 0;
    client.connect = async () => {
        if (++attempts === 1) throw new Error("微信登录失败");
    };
    await client.work(async () => {
        throw new GameApiError(401, "UNAUTHORIZED", "expired");
    });
    const firstReconnect = reconnect;
    reconnect = undefined;
    firstReconnect();
    await setImmediate();
    assert.equal(typeof reconnect, "function");
    reconnect();
    await setImmediate();
    assert.equal(attempts, 2);
});

async function enterSecond(api) {
    let n = 0;
    const controller = new RunState(
        api,
        await api.start("local-run"),
        () => "op-" + ++n,
    );
    for (let i = 0; i < 12; i++)
        await controller.submit({ type: "PICK_BOARD", cardId: "c-" + i });
    assert.equal(controller.snapshot.status, "LEVEL_1_PASSED");
    await controller.submit({ type: "ENTER_LEVEL_2" });
    return controller;
}

test("preview completes the teaching round and a verified 48-card second stage", async () => {
    const api = createPreviewApi();
    const controller = await enterSecond(api);
    assert.equal(controller.snapshot.cards.length, 48);
    assert.equal(controller.snapshot.questions.length, 12);
    const layout = generate(341, "mixed-bridges");
    for (const i of layout.reference.flat()) {
        assert.equal(canPick(controller.snapshot, "c-" + i), true);
        await controller.submit({ type: "PICK_BOARD", cardId: "c-" + i });
    }
    assert.equal(controller.snapshot.status, "WON");
    assert.deepEqual(await api.settle(controller.snapshot.runId), {
        status: "CONFIRMED",
        outcome: "WON",
        unlockedAnimalIds: Array.from(
            new Set(controller.snapshot.cards.map((card) => card.animalId)),
        ),
    });
    const next = await api.start("new-run");
    assert.equal(next.level, 1);
    assert.equal(next.cards.length, 12);
});

test("covered cards are rejected and removal preserves card identity", async () => {
    const controller = await enterSecond(createPreviewApi());
    const covered = controller.snapshot.cards.find(
        (card) => !canPick(controller.snapshot, card.id),
    );
    await assert.rejects(
        controller.submit({ type: "PICK_BOARD", cardId: covered.id }),
    );
    const open = controller.snapshot.cards.find((card) =>
        canPick(controller.snapshot, card.id),
    );
    await controller.submit({ type: "PICK_BOARD", cardId: open.id });
    await controller.submit({
        type: "USE_PROP",
        propType: "REMOVE",
        selectedCardIds: [open.id],
    });
    assert.deepEqual(controller.snapshot.temporaryCardIds, [open.id]);
    assert.equal(controller.snapshot.inventory.reserve[0].quantity, 0);
    await controller.submit({ type: "RESTORE_BOARD", cardId: open.id });
    assert.deepEqual(controller.snapshot.temporaryCardIds, []);
    assert.deepEqual(controller.snapshot.slotCardIds, []);
    assert.ok(controller.snapshot.boardCardIds.includes(open.id));
    assert.equal(controller.snapshot.inventory.reserve[0].quantity, 0);
});

test("unknown response retries the same operation without a second consumption", async () => {
    const api = createPreviewApi();
    const operate = api.operate;
    let firstRequest;
    let first = true;
    api.operate = async (id, request) => {
        const result = await operate(id, request);
        if (first) {
            first = false;
            firstRequest = request;
            throw new Error("response lost");
        }
        assert.deepEqual(request, firstRequest);
        return result;
    };
    const controller = new RunState(
        api,
        await api.start("loss"),
        () => "original",
    );
    await assert.rejects(
        controller.submit({ type: "PICK_BOARD", cardId: "c-0" }),
    );
    await assert.rejects(
        controller.submit({ type: "PICK_BOARD", cardId: "c-1" }),
    );
    await controller.retry();
    assert.equal(controller.snapshot.version, 1);
    assert.deepEqual(controller.snapshot.slotCardIds, ["c-0"]);
});

test("HTTP client uses the merged route, Bearer credential and server error envelope", async () => {
    const requests = [];
    const api = createHttpGameApi(
        "https://game.example",
        async (url, method, headers, body) => {
            requests.push({ url, method, headers, body });
            if (url.endsWith("/sessions"))
                return {
                    status: 200,
                    body: {
                        data: {
                            playerId: "p",
                            accessToken: "session-test",
                            expiresAt: "2026-11-05T01:00:00Z",
                        },
                    },
                };
            return {
                status: 409,
                body: {
                    error: { code: "VERSION_CONFLICT", message: "对局已更新" },
                },
            };
        },
    );
    await api.login("wx-code");
    await assert.rejects(
        api.operate("a/b", {
            operationId: "x",
            expectedVersion: 4,
            type: "USE_PROP",
            propType: "REMOVE",
            selectedCardIds: ["c-1"],
        }),
        (error) =>
            error instanceof GameApiError &&
            error.status === 409 &&
            error.code === "VERSION_CONFLICT",
    );
    assert.deepEqual(requests[0].body, { code: "wx-code" });
    assert.equal(requests[0].headers.Authorization, undefined);
    assert.equal(
        requests[1].url,
        "https://game.example/pretzel-game-api/api/v1/runs/a%2Fb/operations",
    );
    assert.equal(requests[1].headers.Authorization, "Bearer session-test");
    assert.deepEqual(requests[1].body.selectedCardIds, ["c-1"]);
});

test("seventh mismatched card ends the challenge and disallows recovery props", async () => {
    const api = createPreviewApi();
    let n = 0;
    const controller = new RunState(
        api,
        await api.start("fail"),
        () => "op-" + ++n,
    );
    for (let i = 4; i <= 10; i++)
        await controller.submit({ type: "PICK_BOARD", cardId: "c-" + i });
    assert.equal(controller.snapshot.status, "LOST");
    assert.equal(controller.snapshot.slotCardIds.length, 7);
    const version = controller.snapshot.version;
    await assert.rejects(
        controller.submit({ type: "USE_PROP", propType: "CORRECT" }),
    );
    assert.equal(controller.snapshot.version, version);
    assert.deepEqual(await api.settle("fail"), {
        status: "CONFIRMED",
        outcome: "LOST",
        unlockedAnimalIds: [],
    });
});

test("rejects a server snapshot that duplicates a card between board and slot", async () => {
    const api = createPreviewApi();
    const snapshot = await api.start("malformed");
    snapshot.slotCardIds.push(snapshot.boardCardIds[0]);
    assert.throws(() => new RunState(api, snapshot, () => "op"), /牌区或题目/);
});

test("session reauthentication omits the stale Bearer header", async () => {
    const seen = [];
    const api = createHttpGameApi(
        "https://game.example",
        async (_url, _method, headers) => {
            seen.push(headers.Authorization);
            return {
                status: 200,
                body: {
                    data: {
                        playerId: "p",
                        accessToken: "session-" + seen.length,
                        expiresAt: "2026-11-05T01:00:00Z",
                    },
                },
            };
        },
    );
    await api.login("first");
    await api.login("fresh");
    assert.deepEqual(seen, [undefined, undefined]);
});

const { layoutBoard } = require(join(out, "board-layout.js"));
test("display packing enlarges separate piles and preserves their overlap geometry", async () => {
    const api = createPreviewApi();
    let run = await api.start("layout");
    for (let i = 0; i < 12; i++) {
        run = (
            await api.operate(run.runId, {
                type: "PICK_BOARD",
                cardId: "c-" + i,
                operationId: "layout-" + i,
                expectedVersion: run.version,
            })
        ).snapshot;
    }
    run = (
        await api.operate(run.runId, {
            type: "ENTER_LEVEL_2",
            operationId: "layout-stage2",
            expectedVersion: run.version,
        })
    ).snapshot;
    const layout = layoutBoard(run.cards, 686, 710);
    assert.ok(layout.size > 100);
    assert.equal(layout.positions.size, 48);
    for (const card of run.cards) {
        const position = layout.positions.get(card.id);
        assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y));
        assert.ok(Math.abs(position.x) + layout.size / 2 <= 343 + 0.001);
        assert.ok(
            Math.abs(position.y) + (layout.size * 1.08) / 2 <= 355 + 0.001,
        );
        for (const id of card.coveredBy) {
            const covering = run.cards.find((item) => item.id === id);
            const other = layout.positions.get(id);
            assert.ok(
                Math.abs(
                    other.x - position.x - (covering.x - card.x) * layout.size,
                ) < 0.001,
            );
            assert.ok(
                Math.abs(
                    other.y -
                        position.y +
                        (covering.y - card.y) * layout.size * 1.08,
                ) < 0.001,
            );
        }
    }
});

const { captureRestoreAnchor, restorationState, restoreBoardCard } = require(
    join(out, "board-restoration.js"),
);
async function restorationFixture() {
    const run = await createPreviewApi().start("restoration");
    const card = (id, x, y, layer) => ({
        id,
        animalId: "A01",
        eyes: 2,
        legs: 0,
        x,
        y,
        layer,
        coveredBy: layer === 0 ? ["top"] : [],
    });
    run.level = 2;
    run.cards = [
        card("b0", 0, 0, 0),
        card("b1", 1, 0, 0),
        card("b2", 0, 1, 0),
        card("b3", 1, 1, 0),
        card("top", 0.5, 0.5, 1),
    ];
    run.boardCardIds = ["b0", "b1", "b2", "b3"];
    run.temporaryCardIds = ["top"];
    run.slotCardIds = [];
    run.cards[4].restoreAnchor = captureRestoreAnchor(run, run.cards[4]);
    return run;
}

test("one-over-four waits for all original supports and restores coverage without changing progress or inventory", async () => {
    const run = await restorationFixture();
    assert.equal(restorationState(run, "top").allowed, true);
    const inventory = structuredClone(run.inventory);
    const questionIndex = run.questionIndex;
    const below = run.cards[0];
    below.restoreAnchor = captureRestoreAnchor(run, below);
    run.boardCardIds.splice(run.boardCardIds.indexOf(below.id), 1);
    run.temporaryCardIds.push(below.id);
    assert.deepEqual(restorationState(run, "top").missingCardIds, [below.id]);
    const blocked = structuredClone(run);
    assert.throws(() => restoreBoardCard(run, "top"), /底牌/);
    assert.deepEqual(run, blocked);
    restoreBoardCard(run, below.id);
    assert.equal(restorationState(run, "top").allowed, true);
    restoreBoardCard(run, "top");
    assert.deepEqual(run.temporaryCardIds, []);
    assert.equal(run.boardCardIds.filter((id) => id === "top").length, 1);
    assert.equal(canPick(run, below.id), false);
    assert.equal(canPick(run, "top"), true);
    assert.equal(run.questionIndex, questionIndex);
    assert.deepEqual(run.slotCardIds, []);
    assert.deepEqual(run.inventory, inventory);
    assert.throws(() => restoreBoardCard(run, "top"));
});

test("support instances at swapped positions and an occupied original position block restoration", async () => {
    const run = await restorationFixture();
    [run.cards[0].x, run.cards[1].x] = [run.cards[1].x, run.cards[0].x];
    assert.equal(restorationState(run, "top").allowed, false);
    [run.cards[0].x, run.cards[1].x] = [run.cards[1].x, run.cards[0].x];
    run.cards.push({
        id: "occupant",
        animalId: "A01",
        eyes: 2,
        legs: 0,
        x: 0.5,
        y: 0.5,
        layer: 1,
        coveredBy: [],
    });
    run.boardCardIds.push("occupant");
    assert.match(restorationState(run, "top").reason, /占用/);
    run.status = "LOST";
    assert.equal(restorationState(run, "top").allowed, false);
});

test("preview rejects restoration after a support moves without changing version or inventory", async () => {
    const api = createPreviewApi();
    const controller = await enterSecond(api);
    const run = controller.snapshot;
    let pair;
    for (const top of run.cards.filter((card) => canPick(run, card.id))) {
        const trial = structuredClone(run);
        trial.boardCardIds.splice(trial.boardCardIds.indexOf(top.id), 1);
        const below = trial.cards.find(
            (card) =>
                card.coveredBy.includes(top.id) && canPick(trial, card.id),
        );
        if (below) {
            pair = { top, below };
            break;
        }
    }
    assert.ok(pair);
    await controller.submit({ type: "PICK_BOARD", cardId: pair.top.id });
    await controller.submit({
        type: "USE_PROP",
        propType: "REMOVE",
        selectedCardIds: [pair.top.id],
    });
    await controller.submit({ type: "PICK_BOARD", cardId: pair.below.id });
    const before = structuredClone(controller.snapshot);
    await assert.rejects(
        controller.submit({ type: "RESTORE_BOARD", cardId: pair.top.id }),
        /底牌/,
    );
    assert.deepEqual(await api.run(run.runId), before);
    assert.equal(controller.pending, undefined);
});

test("restoration response loss retries the same operation and leaves one board instance", async () => {
    const api = createPreviewApi();
    const controller = await enterSecond(api);
    const card = controller.snapshot.cards.find((item) =>
        canPick(controller.snapshot, item.id),
    );
    await controller.submit({ type: "PICK_BOARD", cardId: card.id });
    await controller.submit({
        type: "USE_PROP",
        propType: "REMOVE",
        selectedCardIds: [card.id],
    });
    const operate = api.operate;
    let first = true;
    api.operate = async (id, request) => {
        const result = await operate(id, request);
        if (first) {
            first = false;
            throw new Error("response lost");
        }
        return result;
    };
    await assert.rejects(
        controller.submit({ type: "RESTORE_BOARD", cardId: card.id }),
    );
    await controller.retry();
    assert.equal(
        controller.snapshot.boardCardIds.filter((id) => id === card.id).length,
        1,
    );
    assert.deepEqual(controller.snapshot.temporaryCardIds, []);
    assert.deepEqual(controller.snapshot.slotCardIds, []);
});

test("three-level restoration proceeds bottom-up and rejects cleared supports", async () => {
    const run = await restorationFixture();
    run.cards = [
        {
            id: "bottom",
            animalId: "A01",
            eyes: 2,
            legs: 0,
            x: 0,
            y: 0,
            layer: 0,
            coveredBy: ["middle", "top"],
        },
        {
            id: "middle",
            animalId: "A01",
            eyes: 2,
            legs: 0,
            x: 0,
            y: 0,
            layer: 1,
            coveredBy: ["top"],
        },
        {
            id: "top",
            animalId: "A01",
            eyes: 2,
            legs: 0,
            x: 0,
            y: 0,
            layer: 2,
            coveredBy: [],
        },
    ];
    run.cards.forEach((card) => {
        card.restoreAnchor = captureRestoreAnchor(run, card);
    });
    run.boardCardIds = [];
    run.temporaryCardIds = ["top", "middle", "bottom"];
    assert.equal(restorationState(run, "top").allowed, false);
    assert.equal(restorationState(run, "middle").allowed, false);
    restoreBoardCard(run, "bottom");
    assert.equal(restorationState(run, "top").allowed, false);
    restoreBoardCard(run, "middle");
    restoreBoardCard(run, "top");
    assert.equal(canPick(run, "middle"), false);
    assert.equal(canPick(run, "top"), true);
    const cleared = await restorationFixture();
    cleared.boardCardIds.splice(0, 1);
    assert.equal(restorationState(cleared, "top").allowed, false);
});

test("runtime animal attributes match the level catalog and reject inconsistent server cards", async () => {
    const { previewData } = require(join(out, "preview-data.js"));
    assert.deepEqual(
        previewData.animals.map(({ eyes, legs }) => [eyes, legs]),
        ANIMALS.map(([, eyes, legs]) => [eyes, legs]),
    );
    const original = await createPreviewApi().start("attributes");
    for (const attributes of [
        { eyes: 7, legs: 0 },
        { eyes: 2, legs: 7 },
        { eyes: 3, legs: 0 },
    ]) {
        const invalid = structuredClone(original);
        Object.assign(invalid.cards[0], attributes);
        assert.throws(
            () => new RunState(createPreviewApi(), invalid, () => "invalid"),
            /不一致/,
        );
    }
});

test("home layout preserves full animal rows at capacity boundaries and safe bottom", () => {
    const { homeLayout, weekDates, quantityText } = require(
        join(out, "home-layout.js"),
    );
    const long = homeLayout(390, 844, 47, 34, 76);
    const short = homeLayout(375, 667, 0, 0, 44);
    assert.equal(long.capacity, 6);
    assert.equal(long.sceneHeight, 388);
    assert.equal(short.capacity, 3);
    assert.equal(short.sceneHeight, 224);
    for (const layout of [long, short])
        assert.ok(layout.navigation + 44 <= layout.contentHeight - 16);
    for (const [available, capacity] of [
        [223, 3],
        [224, 3],
        [387, 3],
        [388, 6],
    ]) {
        const height = 188 + 180 + 16 + available;
        const layout = homeLayout(375, height, 0, 0, 44);
        assert.equal(layout.capacity, capacity);
        if (available < 224) assert.ok(layout.contentHeight > height);
    }
    assert.equal(weekDates("2026-11-30"), "11月30日—12月6日");
    assert.equal(weekDates("2026-12-28", true), "2026年12月28日—2027年1月3日");
    assert.equal(
        quantityText(12345, (text) => text.length <= 4),
        "1.2万",
    );
    assert.equal(
        quantityText(123456789, (text) => text.length <= 3),
        "1亿",
    );
    assert.equal(
        quantityText(1234567890000, (text) => text.length <= 3),
        "≥1亿",
    );
});

test("preview zoo fixtures cover empty, paged, and long-name large-count states without mutating catalog", async () => {
    for (const zooCount of [0, 3, 9, 12]) {
        const data = await createPreviewApi({ zooCount, stress: true }).zoo();
        assert.equal(data.items.length, zooCount);
        if (zooCount) assert.equal(data.items[0].receivedCount, 123456789);
    }
    const normal = await createPreviewApi().zoo();
    assert.equal(normal.items[0].receivedCount, 1);
    assert.ok(normal.items[0].animal.name.length < 10);
});
