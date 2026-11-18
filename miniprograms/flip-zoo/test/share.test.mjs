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
    const require = (name) => imports[name] ?? {};
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
    assert.deepEqual(calls, cards);
    assert.deepEqual(screen.round, { status: "lost", slotCapacity: 7 });
    screen.overlay = { name: "RoundResult" };
    assert.equal(screen.shareFromMenu(), cards[0]);
    screen.round = Object.freeze({ status: "won", slotCapacity: 7 });
    assert.equal(screen.shareFromMenu(), cards[1]);
    screen.overlay = { name: "Leaderboard" };
    assert.equal(screen.shareFromMenu(), cards[0]);
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
