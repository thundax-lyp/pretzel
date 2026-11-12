import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction } from "node:vm";
import ts from "typescript";

const { outputText } = ts.transpileModule(
    readFileSync(
        new URL("../assets/scripts/scene/start-screen.ts", import.meta.url),
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
    const exports = {};
    compileFunction(outputText, ["exports", "require", "wx", "GameGlobal"])(
        exports,
        (name) => imports[name] ?? {},
        { shareAppMessage: (card) => calls.push(card) },
        { flipZooShareCards: cards },
    );
    const screen = new exports.FlipZooStartScreen();
    screen.round = Object.freeze({ status: "lost", slotCapacity: 7 });
    screen.share();
    screen.share(true);
    assert.deepEqual(calls, cards);
    assert.deepEqual(screen.round, { status: "lost", slotCapacity: 7 });
});
