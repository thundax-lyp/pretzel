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

for (const prop of ["undo", "peek", "remove"]) {
    test(`tapping unclaimed ${prop} shares directly, retries failure and grants once`, () => {
        let calls = 0;
        const notices = [];
        const screen = loadScreen(
            {
                cc: {
                    Component: class {},
                    _decorator: { ccclass: () => (target) => target },
                },
                "cc/env": { WECHAT: true },
                "../services/board-api": { createBoardApi() {} },
                "../gameplay/round": { PROP_LABELS: { [prop]: prop } },
            },
            {
                shareAppMessage() {
                    if (++calls === 1) throw Error("unavailable");
                },
                showToast: ({ title }) => notices.push(title),
            },
            {},
        );
        let grants = 0;
        screen.round = {
            status: "playing",
            canClaimProp: () => grants === 0,
            claimProp: () => (++grants, true),
            propUsesLeft: () => 0,
        };
        screen.openOverlay = () =>
            assert.fail("Sharing must not open a confirmation dialog");
        screen.refresh = () => {};
        screen.message = {};
        screen.fragmentRound = { actions: [] };
        screen.onPropTouch(prop);
        assert.deepEqual(notices, ["暂时无法打开分享"]);
        assert.equal(grants, 0);
        screen.onPropTouch(prop);
        screen.onPropTouch(prop);
        assert.equal(calls, 2);
        assert.equal(grants, 1);
        assert.deepEqual(screen.fragmentRound.actions, ["claim:" + prop]);
    });
}

test("locked slots share directly and never unlock after a failed invocation", () => {
    let calls = 0;
    const screen = loadScreen(
        {
            cc: {
                Component: class {},
                _decorator: { ccclass: () => (target) => target },
            },
            "cc/env": { WECHAT: true },
            "../services/board-api": { createBoardApi() {} },
            "../gameplay/round": { SHARE_SLOT_ACTION: "share-slot" },
        },
        {
            shareAppMessage() {
                if (++calls === 1) throw Error("unavailable");
            },
            showToast() {},
        },
        {},
    );
    let unlocks = 0;
    screen.round = {
        status: "playing",
        slotCapacity: 6,
        unlockNextSlot: () => (++unlocks, true),
    };
    screen.openOverlay = () =>
        assert.fail("Sharing must not open a confirmation dialog");
    screen.refresh = () => {};
    screen.fragmentRound = { actions: [] };
    screen.onSlotTouch(6);
    assert.equal(unlocks, 0);
    screen.onSlotTouch(6);
    assert.equal(calls, 2);
    assert.equal(unlocks, 1);
    assert.deepEqual(screen.fragmentRound.actions, ["share-slot"]);
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
    screen.flyCardToSlot = (card, slot, landed, _lifted, stackLevel = 0) => {
        flights.push(card.id);
        assert.ok(slot < round.slotCapacity);
        landed(stackLevel ? { node: { destroy() {} } } : undefined);
    };
    screen.refreshSlots = (kinds) =>
        assert.ok(kinds.length <= round.slotCapacity);
    screen.playMatch = (kind, indices, stacked = []) => {
        assert.equal(indices.length + stacked.length, 3);
        matches.push(kind);
    };
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

test("revival opens native sharing directly without an intermediate dialog", () => {
    const f = revivalShareFixture();
    f.screen.openOverlay = () =>
        assert.fail("must not open a confirmation dialog");
    f.screen.requestRevive(f.result);
    assert.equal(f.shareCalls, 1);
    assert.equal(f.revivals, 0);
    assert.equal(f.screen.overlay, f.result);
});

test("revival returns without a preceding hide event and completes only once", () => {
    const f = revivalShareFixture();
    f.screen.requestRevive(f.result);
    f.screen.requestRevive(f.result);
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
    f.emit("hide");
    assert.equal(f.revivals, 0);
    f.emit("show");
    assert.equal(f.revivals, 1);
});

test("failed share calls can retry and leaving the result prevents late revival", () => {
    const f = revivalShareFixture();
    const notices = [];
    f.screen.platformNotice = (message) => notices.push(message);
    f.fail();
    f.screen.requestRevive(f.result);
    assert.equal(f.revivals, 0);
    assert.equal(f.lifecycle.show.size, 0);
    assert.deepEqual(notices, ["暂时无法打开分享，请重试"]);
    f.allow();
    f.screen.requestRevive(f.result);
    f.emit("hide");
    const lateReturns = [...f.lifecycle.show];
    f.screen.openOverlay();
    f.emit("show");
    lateReturns.forEach((callback) => callback());
    assert.equal(f.shareCalls, 2);
    assert.equal(f.revivals, 0);
    assert.notEqual(f.screen.overlay, f.result);
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

for (const capacity of [6, 7]) {
    for (const empty of [0, 1]) {
        test(`revival stacks matching cards with ${capacity} slots and ${empty} free, preserving every waiting card`, async () => {
            const rules = await import("../assets/scripts/gameplay/round.ts");
            const occupied = capacity - empty;
            const kinds = Array.from({ length: occupied * 3 }, (_, id) =>
                Math.floor(id / 3),
            );
            const round = new rules.Round(
                2,
                "C",
                kinds,
                undefined,
                [[[0, 0, kinds.length, 1]]],
                true,
                Array.from({ length: occupied }, (_, kind) => [
                    kind * 3 + 1,
                    kind * 3 + 2,
                ]),
                true,
            );
            if (capacity === 7) round.unlockNextSlot();
            for (let kind = 0; kind < occupied; kind++) round.take(kind * 3);
            assert.equal(round.status, "lost");
            assert.equal(round.slots.length, occupied);
            const screen = loadScreen(
                {
                    cc: {
                        Component: class {},
                        _decorator: { ccclass: () => (target) => target },
                    },
                    "cc/env": { WECHAT: true },
                    "../services/board-api": { createBoardApi() {} },
                    "../gameplay/round": rules,
                },
                {},
                {},
            );
            const result = {};
            Object.assign(screen, {
                round,
                overlay: result,
                message: {},
                fragmentRound: { actions: [] },
            });
            screen.closeOverlay = () => (screen.overlay = undefined);
            screen.refreshBoard = () => {};
            const scheduled = [];
            const stacks = new Set();
            let visible = [];
            let expectedCards = occupied;
            let stackFlights = 0;
            let matches = 0;
            let finishes = 0;
            screen.refreshSlots = (frame) => {
                assert.ok(
                    frame.length <= capacity,
                    "must never use locked or extra slots",
                );
                visible = [...frame];
                assert.equal(
                    frame.filter((kind) => kind !== undefined).length +
                        stacks.size,
                    expectedCards,
                );
            };
            screen.flyCardToSlot = (
                card,
                slot,
                landed,
                _lifted,
                stackLevel = 0,
            ) => {
                assert.equal(screen.animatingCards, true);
                assert.ok(slot < capacity);
                expectedCards++;
                let stacked;
                if (stackLevel) {
                    assert.equal(
                        visible[slot],
                        card.kind,
                        "only stack onto the same kind",
                    );
                    stackFlights++;
                    stacked = {
                        node: { destroy: () => stacks.delete(stacked) },
                    };
                    stacks.add(stacked);
                }
                landed(stacked);
            };
            screen.playMatch = (kind, indices, stacked = []) => {
                assert.equal(indices.length + stacked.length, 3);
                assert.ok(indices.every((slot) => visible[slot] === kind));
                assert.equal(stacked.length, stacks.size);
                expectedCards -= 3;
                matches++;
            };
            screen.scheduleOnce = (callback) => scheduled.push(callback);
            screen.finishAction = () => finishes++;
            screen.completeRevive(result, round);
            assert.equal(finishes, 0);
            while (scheduled.length) scheduled.shift()();
            assert.ok(stackFlights > 0);
            assert.equal(matches, occupied);
            assert.equal(expectedCards, 0);
            assert.equal(stacks.size, 0);
            assert.equal(finishes, 1);
            assert.equal(screen.animatingCards, false);
            assert.equal(round.slotCapacity, capacity);
            assert.equal(round.slots.length, 0);
            assert.deepEqual(screen.fragmentRound.actions, [
                rules.REVIVE_ACTION,
            ]);
        });
    }
}
