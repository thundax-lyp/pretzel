import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { compileFunction } from "node:vm";
import ts from "typescript";

const { outputText } = ts.transpileModule(
    readFileSync(
        new URL("../assets/scripts/start-screen.ts", import.meta.url),
        "utf8",
    ),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            experimentalDecorators: true,
        },
    },
);

test("a failed ad load can recover on the next revive request", async () => {
    const calls = [];
    const closeListeners = new Set();
    const errorListeners = new Set();
    let online = false;
    let loaded = false;
    const ad = {
        async show() {
            calls.push("show");
            if (!loaded) {
                for (const listener of errorListeners) listener();
                throw new Error("ad unavailable");
            }
        },
        async load() {
            calls.push("load");
            if (!online) {
                for (const listener of errorListeners) listener();
                throw new Error("offline");
            }
            loaded = true;
        },
        onClose: (listener) => closeListeners.add(listener),
        offClose: (listener) => closeListeners.delete(listener),
        onError: (listener) => errorListeners.add(listener),
        offError: (listener) => errorListeners.delete(listener),
    };
    const imports = {
        cc: {
            Component: class {},
            _decorator: { ccclass: () => (target) => target },
        },
        "cc/env": { WECHAT: true },
        "./board-api": { createBoardApi() {} },
    };
    const exports = {};
    compileFunction(outputText, ["exports", "require", "wx", "GameGlobal"])(
        exports,
        (name) => imports[name] ?? {},
        { createRewardedVideoAd: () => ad },
        { flipZooRewardedAdUnitId: "test-ad" },
    );

    const screen = new exports.FlipZooStartScreen();
    screen.isValid = true;
    screen.overlay = {};
    screen.message = {};
    screen.finishAction = () => {};
    screen.closeOverlay = () => {
        screen.overlay = undefined;
    };
    screen.showResult = (_won, feedback) => {
        screen.message.string = feedback;
        screen.overlay = {};
    };
    screen.round = {
        slotCapacity: 5,
        canRevive: true,
        revive() {
            this.slotCapacity++;
            return true;
        },
    };

    await screen.requestRevive(screen.overlay);
    assert.deepEqual(calls, ["show", "load"]);
    assert.equal(screen.round.slotCapacity, 5);
    assert.match(screen.message.string, /稍后重试/);
    assert.equal(closeListeners.size + errorListeners.size, 0);

    online = true;
    const earlyExit = screen.requestRevive(screen.overlay);
    await setImmediate();
    assert.deepEqual(calls, ["show", "load", "show", "load", "show"]);
    for (const listener of closeListeners) listener({ isEnded: false });
    await earlyExit;
    assert.equal(screen.round.slotCapacity, 5);
    assert.equal(closeListeners.size + errorListeners.size, 0);

    const completed = screen.requestRevive(screen.overlay);
    await setImmediate();
    for (const listener of closeListeners) listener({ isEnded: true });
    await completed;
    assert.equal(screen.round.slotCapacity, 6);
    assert.equal(closeListeners.size + errorListeners.size, 0);
});
