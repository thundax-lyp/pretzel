import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction } from "node:vm";
import ts from "typescript";

const source = readFileSync(
    new URL("../assets/scripts/ui/button-press.ts", import.meta.url),
    "utf8",
);
const compiled = ts.transpileModule(source, {
    compilerOptions: {
        experimentalDecorators: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
    },
}).outputText;

test("a backdrop press never activates after entering or ending inside its excluded panel", () => {
    const handlers = new Map();
    const exports = {};
    compileFunction(compiled, ["exports", "require"])(exports, () => ({
        _decorator: { ccclass: () => (value) => value },
        Component: class {},
        Event: class {},
        Node: {
            EventType: {
                TOUCH_START: "start",
                TOUCH_MOVE: "move",
                TOUCH_END: "end",
                TOUCH_CANCEL: "cancel",
            },
        },
    }));
    const press = new exports.ButtonPress();
    press.node = {
        on: (name, handler, context) =>
            handlers.set(name, handler.bind(context)),
        dispatchEvent() {},
    };
    press.getComponent = () => ({ hitTest: ({ x }) => x >= 0 && x <= 100 });
    press.excludedRegion = { hitTest: ({ x }) => x >= 30 && x <= 70 };
    press.showPressed = () => {};
    let closed = 0;
    press.action = () => closed++;
    press.onEnable();

    const touch = (type, x) =>
        handlers.get(type)({
            getID: () => 1,
            getLocation: () => ({ x, y: 0 }),
            windowId: 0,
        });

    touch("start", 10);
    touch("end", 50);
    assert.equal(closed, 0, "release inside panel without a move event");

    touch("start", 10);
    touch("move", 50);
    touch("end", 90);
    assert.equal(closed, 0, "crossing the panel cancels the press");

    touch("start", 50);
    touch("end", 10);
    assert.equal(closed, 0, "starting inside the panel does not arm the press");

    touch("start", 10);
    touch("end", 12);
    assert.equal(closed, 1, "tapping the backdrop still closes the dialog");
});
