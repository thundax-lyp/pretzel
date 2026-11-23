import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction } from "node:vm";
import ts from "typescript";

function compileModule(file) {
    const { outputText } = ts.transpileModule(
        readFileSync(new URL(file, import.meta.url), "utf8"),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                experimentalDecorators: true,
            },
        },
    );
    return compileFunction(outputText, [
        "exports",
        "require",
        "wx",
        "GameGlobal",
    ]);
}

const compileScreen = compileModule("../assets/scripts/scene/start-screen.ts");
const compilePlatform = compileModule(
    "../assets/scripts/services/wechat-platform.ts",
);

function loadScreen(imports, wx, gameGlobal) {
    const platform = {};
    const exports = {};
    const require = (name) =>
        imports[name] ??
        (name === "./share-tracking"
            ? {
                  recordShareClick: () => "share_channel=test-channel",
              }
            : {});
    compilePlatform(platform, require, wx, gameGlobal);
    compileScreen(exports, (name) =>
        name === "../services/wechat-platform" ? platform : require(name),
    );
    return new exports.FlipZooStartScreen();
}

test("opening the share picker does not mutate the round", () => {
    const calls = [];
    const cards = [
        {
            title: "来翻牌",
            imageUrlId: "default",
            imageUrl: "https://example.com/share.png",
        },
        {
            title: "通关了",
            imageUrlId: "victory",
            imageUrl: "https://example.com/win.png",
        },
    ];
    const imports = {
        cc: {
            Component: class {},
            _decorator: { ccclass: () => (target) => target },
        },
        "cc/env": { WECHAT: true },
        "../services/board-api": { createBoardApi() {} },
    };
    const screen = loadScreen(
        imports,
        { shareAppMessage: (card) => calls.push(card) },
        { flipZooShareCards: cards },
    );
    screen.round = Object.freeze({ status: "lost", slotCapacity: 7 });
    screen.share();
    screen.share(true);
    const tracked = cards.map((card) => ({
        ...card,
        query: "share_channel=test-channel",
    }));
    assert.deepEqual(calls, tracked);
    assert.deepEqual(screen.round, { status: "lost", slotCapacity: 7 });
    screen.overlay = { name: "RoundResult" };
    assert.deepEqual(screen.shareFromMenu(), tracked[0]);
    screen.round = Object.freeze({ status: "won", slotCapacity: 7 });
    assert.deepEqual(screen.shareFromMenu(), tracked[1]);
    screen.overlay = { name: "Leaderboard" };
    assert.deepEqual(screen.shareFromMenu(), tracked[0]);
});

test("claiming a prop requires a successful share invocation and only grants once", () => {
    let shareCalls = 0;
    const notices = [];
    const wx = {
        shareAppMessage() {
            shareCalls += 1;
            if (shareCalls === 1) throw new Error("unavailable");
        },
        showToast({ title }) {
            notices.push(title);
        },
    };
    const imports = {
        cc: {
            Component: class {},
            _decorator: { ccclass: () => (target) => target },
        },
        "cc/env": { WECHAT: true },
        "../services/board-api": { createBoardApi() {} },
    };
    imports["../ui/button-icon"] = { drawButtonIcon() {} };
    imports["../ui/nodes"] = {
        label: () => ({
            node: { getComponent: () => ({ setContentSize() {} }) },
        }),
    };
    imports.cc.Label = { Overflow: { RESIZE_HEIGHT: 0 } };
    const screen = loadScreen(imports, wx, {});
    const dialog = {};
    let claimed = false;
    let grantCount = 0;
    const round = {
        canClaimProp: () => !claimed,
        claimProp() {
            claimed = true;
            grantCount += 1;
            return true;
        },
    };
    screen.round = round;
    screen.gameRoot = {};
    screen.openOverlay = () => (screen.overlay = dialog);
    screen.closeOverlay = () => (screen.overlay = undefined);
    screen.panel = () => ({});
    screen.heading = () => {};
    screen.drawPropIcon = () => ({
        node: { setScale() {}, setPosition() {} },
    });
    screen.paintButton = () => {};
    screen.refresh = () => {};
    screen.message = {};
    const actions = new Map();
    screen.button = (name, _x, _y, _width, action) => {
        actions.set(name, action);
        return { caption: { node: { setPosition() {} } }, graphic: {} };
    };

    screen.showPropClaim("peek");
    actions.get("×  关闭")();
    actions.get("分享")();
    assert.equal(shareCalls, 0);

    screen.showPropClaim("peek");
    const share = actions.get("分享");
    share();
    assert.deepEqual(notices, ["暂时无法打开分享"]);
    assert.equal(grantCount, 0);
    assert.equal(screen.overlay, dialog);

    share();
    share();
    assert.equal(shareCalls, 2);
    assert.equal(grantCount, 1);
    assert.equal(screen.overlay, undefined);
});

test("revival records once, animates every triple, and finishes only after the tray clears", async () => {
    const rules = await import("../assets/scripts/gameplay/round.ts");
    const imports = {
        cc: {
            Component: class {},
            _decorator: { ccclass: () => (target) => target },
        },
        "cc/env": { WECHAT: true },
        "../services/board-api": { createBoardApi() {} },
        "../gameplay/round": rules,
    };
    const screen = loadScreen(imports, {}, {});
    const round = new rules.Round(
        2,
        "C",
        [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2],
        undefined,
        [[[0, 0, 12, 1]]],
        true,
        [
            [2, 3],
            [4, 5],
        ],
        true,
    );
    for (const id of [0, 1, 6, 7, 9, 10]) round.take(id);
    assert.equal(round.status, "lost");
    screen.round = round;
    const result = {};
    screen.overlay = result;
    screen.message = {};
    screen.fragmentRound = { id: "round", actions: [] };
    screen.closeOverlay = () => {
        screen.overlay = undefined;
    };
    const flights = [];
    const matches = [];
    const finishes = [];
    const boardRefreshes = [];
    screen.refreshBoard = () => {
        boardRefreshes.push(
            round.cards
                .filter((card) => round.isOnBoard(card))
                .map((card) => card.id),
        );
    };
    screen.flyCardToSlot = (card, slot, landed) => {
        flights.push(card.id);
        landed();
    };
    screen.refreshSlots = () => {};
    screen.playMatch = (kind) => matches.push(kind);
    const scheduled = [];
    screen.scheduleOnce = (callback) => scheduled.push(callback);
    screen.finishAction = () => finishes.push(round.status);
    screen.completeRevive(result, round);
    assert.equal(screen.animatingCards, true);
    assert.deepEqual(finishes, []);
    screen.completeRevive(result, round);
    assert.deepEqual(screen.fragmentRound.actions, [rules.REVIVE_ACTION]);
    assert.deepEqual(boardRefreshes, [[]]);
    while (scheduled.length) scheduled.shift()();
    assert.deepEqual(flights, [2, 3, 4, 5, 8, 11]);
    assert.deepEqual(matches, [0, 0, 1, 2]);
    assert.deepEqual(finishes, ["won"]);
    assert.equal(screen.animatingCards, false);
    assert.equal(round.slots.length, 0);
});

function revivalShareFixture() {
    const actions = new Map();
    const lifecycle = { hide: new Set(), show: new Set() };
    let shareCalls = 0;
    let fail = false;
    const wx = {
        onHide: (callback) => lifecycle.hide.add(callback),
        offHide: (callback) => lifecycle.hide.delete(callback),
        onShow: (callback) => lifecycle.show.add(callback),
        offShow: (callback) => lifecycle.show.delete(callback),
        shareAppMessage() {
            shareCalls += 1;
            if (fail) throw Error("unavailable");
        },
    };
    const node = () => ({
        setPosition() {},
        getComponent: () => ({ setContentSize() {} }),
    });
    const imports = {
        cc: {
            Component: class {},
            _decorator: { ccclass: () => (target) => target },
        },
        "cc/env": { WECHAT: true },
        "../services/board-api": { createBoardApi() {} },
        "../ui/nodes": {
            picture: () => ({ node: node() }),
            label: () => ({ node: node() }),
            titleLine() {},
        },
    };
    const screen = loadScreen(imports, wx, {});
    const result = {};
    const round = { canRevive: true };
    screen.art = { home: { settings: [{}, {}] } };
    screen.overlay = result;
    screen.round = round;
    screen.openOverlay = () => {
        screen.cancelRevivalShare?.();
        screen.cancelRevivalShare = undefined;
        return (screen.overlay = {});
    };
    screen.showResult = () => {
        screen.cancelRevivalShare?.();
        screen.cancelRevivalShare = undefined;
        screen.overlay = result;
    };
    screen.paintButton = () => {};
    screen.button = (text, _x, _y, _width, action) => {
        actions.set(text, action);
        return {};
    };
    let revivals = 0;
    screen.completeRevive = (dialog, expectedRound) => {
        assert.equal(screen.overlay, dialog);
        assert.equal(screen.round, expectedRound);
        revivals += 1;
        screen.cancelRevivalShare?.();
        screen.overlay = undefined;
    };
    return {
        screen,
        result,
        actions,
        emit: (type) => [...lifecycle[type]].forEach((callback) => callback()),
        get shareCalls() {
            return shareCalls;
        },
        get revivals() {
            return revivals;
        },
        fail: () => (fail = true),
        allow: () => (fail = false),
        lifecycle,
    };
}

test("revival first asks for sharing; cancelling never changes the round", () => {
    const f = revivalShareFixture();
    f.screen.requestRevive(f.result);
    assert.equal(f.shareCalls, 0);
    assert.equal(f.revivals, 0);
    f.actions.get("取消")();
    f.actions.get("分享")();
    assert.equal(f.screen.overlay, f.result);
    assert.equal(f.shareCalls, 0);
    assert.equal(f.revivals, 0);
});

test("revival returns without a preceding hide event and completes only once", () => {
    const f = revivalShareFixture();
    f.screen.requestRevive(f.result);
    const share = f.actions.get("分享");
    share();
    share();
    assert.equal(f.shareCalls, 1);
    assert.equal(f.revivals, 0);
    f.emit("show");
    f.emit("show");
    assert.equal(f.revivals, 1);
    assert.equal(f.lifecycle.hide.size, 0);
    assert.equal(f.lifecycle.show.size, 0);
});

test("revival also completes after a hide/show return", () => {
    const f = revivalShareFixture();
    f.screen.requestRevive(f.result);
    f.actions.get("分享")();
    f.emit("hide");
    assert.equal(f.revivals, 0);
    f.emit("show");
    assert.equal(f.revivals, 1);
});

test("failed share calls can retry and cancelled pending shares cannot revive later", () => {
    const f = revivalShareFixture();
    f.screen.requestRevive(f.result);
    f.fail();
    f.actions.get("分享")();
    assert.equal(f.revivals, 0);
    assert.equal(f.lifecycle.show.size, 0);
    f.allow();
    f.actions.get("分享")();
    f.emit("hide");
    const lateReturns = [...f.lifecycle.show];
    f.actions.get("取消")();
    f.emit("show");
    lateReturns.forEach((callback) => callback());
    assert.equal(f.shareCalls, 2);
    assert.equal(f.revivals, 0);
    assert.equal(f.screen.overlay, f.result);
});

test("menu and direct sharing each create one tracked channel, including failed picker calls", () => {
    let ready;
    let handler;
    let stopped = 0;
    let clicks = 0;
    const sent = [];
    const wx = {
        hideShareMenu() {},
        showShareMenu() {},
        onShareAppMessage: (callback) => (handler = callback),
        offShareAppMessage: () => (handler = undefined),
        shareAppMessage: (card) => sent.push(card),
    };
    const exports = {};
    compilePlatform(
        exports,
        (name) =>
            name === "cc/env"
                ? { WECHAT: true }
                : {
                      recordShareClick: () =>
                          `share_channel=${String(++clicks).padStart(32, "0")}`,
                      startShareTracking(callback) {
                          ready = callback;
                          return () => stopped++;
                      },
                  },
        wx,
        {},
    );
    const menu = () => exports.trackedShareCard(false);
    exports.enableShareMenu(menu);
    assert.equal(handler, undefined);
    ready();
    const first = handler();
    const second = handler();
    assert.notEqual(first.query, second.query);
    assert.equal(exports.openShare(true), "opened");
    assert.equal(clicks, 3);
    assert.equal(sent.length, 1);
    wx.shareAppMessage = () => {
        throw Error("cancelled/unavailable");
    };
    assert.equal(exports.openShare(false), "failed");
    assert.equal(clicks, 4);
    exports.disableShareMenu(menu);
    assert.equal(handler, undefined);
    assert.equal(stopped, 1);
});

test("a second-level round reports one leaderboard win even if its finish callback repeats; tutorial clears do not count", () => {
    const messages = [];
    const screen = loadScreen(
        {
            cc: {
                Component: class {},
                _decorator: { ccclass: () => (target) => target },
            },
            "cc/env": { WECHAT: true },
            "../services/board-api": { createBoardApi() {} },
            "../ui/nodes": { color: (value) => value },
        },
        {
            getOpenDataContext: () => ({
                postMessage: (message) => messages.push(message),
            }),
        },
        {},
    );
    screen.message = {};
    screen.refresh = () => {};
    screen.showResult = () => {};
    screen.scheduleOnce = () => {};
    screen.round = { level: 2, status: "won" };
    screen.finishAction(false);
    screen.finishAction(false);
    assert.deepEqual(
        messages.map((message) => message.action),
        ["record-win"],
    );
    screen.round = { level: 1, status: "won" };
    screen.finishAction(false);
    assert.equal(messages.length, 1);
});
