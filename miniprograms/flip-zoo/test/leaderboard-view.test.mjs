import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
    readFileSync(
        new URL("../assets/scripts/ui/leaderboard-view.ts", import.meta.url),
        "utf8",
    ),
    {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
        },
    },
).outputText;
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
    class Node {
        static EventType = {
            TOUCH_START: "start",
            TOUCH_MOVE: "move",
            TOUCH_END: "end",
        };
        children = [];
        handlers = {};
        isValid = true;
        on(event, callback) {
            this.handlers[event] = callback;
        }
        setPosition() {}
        setSiblingIndex() {}
        getComponent() {
            return {
                setContentSize() {},
                convertToNodeSpaceAR: (value) => value,
            };
        }
        addComponent() {
            return { designResolutionSize: { set() {} } };
        }
    }
    const messages = [];
    const pointers = [];
    const pending = [];
    const lists = [];
    const buttons = [];
    const exports = {};
    const cc = {
        Node,
        SubContextView: class {},
        UITransform: class {},
        LabelOutline: class {},
        Vec3: class {
            constructor(x, y, z) {
                Object.assign(this, { x, y, z });
            }
        },
    };
    compileFunction(compiled, ["exports", "require"])(
        exports,
        (name) =>
            ({
                cc,
                "../services/wechat-platform": {
                    hasOpenDataContext: () => true,
                    postRankMessage: (action) => messages.push(action),
                    postRankingPointer: (x, y) => pointers.push([x, y]),
                },
                "../services/leaderboard": {
                    syncLifetimeRank: () =>
                        new Promise((resolve, reject) =>
                            pending.push({ resolve, reject }),
                        ),
                },
                "./nodes": {
                    color: (value) => value,
                    uiNode: () => {
                        const node = new Node();
                        lists.push(node);
                        return node;
                    },
                },
            })[name],
    );
    const controls = {
        button(_text, _x, _y, _width, action) {
            buttons.push(action);
            const parent = new Node(),
                icon = new Node(),
                caption = new Node();
            caption.parent = parent;
            parent.children.push(icon, caption);
            return {
                width: 240,
                height: 76,
                graphic: { clear() {} },
                icon: { node: icon },
                caption: { node: caption },
            };
        },
    };
    return {
        messages,
        pointers,
        pending,
        show(preview = false, history = false) {
            exports.showRankingList(new Node(), controls, preview, history, {
                home: { rankingButtons: [{}, {}] },
            });
            const list = lists.at(-1);
            return {
                list,
                refresh: buttons.at(-1),
                tap() {
                    list.handlers.start();
                    list.handlers.end({
                        getUILocation: () => ({ x: 200, y: 596 }),
                    });
                },
            };
        },
    };
}

test("opening a full leaderboard synchronizes totals and tab taps retry after completion", async () => {
    const f = fixture(),
        view = f.show(false, true);
    assert.deepEqual(f.messages, ["show-history"]);
    assert.equal(f.pending.length, 1);
    view.tap();
    assert.equal(f.pending.length, 1, "join the pending request");
    assert.deepEqual(f.pointers, [[541, 124]]);
    f.pending[0].resolve();
    await flush();
    view.tap();
    assert.equal(f.pending.length, 2);
    f.pending[1].resolve();
    await flush();
});

test("failed initial sync can retry on a tab tap without an old view overwriting a new one", async () => {
    const f = fixture(),
        view = f.show();
    f.pending[0].reject(Error("offline"));
    await flush();
    assert.equal(f.messages.at(-1), "history-error");
    view.tap();
    assert.equal(f.pending.length, 2);
    f.show(false, true);
    const before = f.messages.length;
    f.pending[1].reject(Error("old failure"));
    await flush();
    assert.equal(f.messages.length, before);
    f.pending[2].resolve();
    await flush();
});

test("refresh reuses in-flight sync and closing its view suppresses late refresh messages", async () => {
    const f = fixture(),
        view = f.show(false, true);
    view.refresh();
    assert.equal(f.pending.length, 1);
    assert.equal(f.messages.at(-1), "loading-rank");
    view.list.isValid = false;
    const before = f.messages.length;
    f.pending[0].resolve();
    await flush();
    assert.equal(f.messages.length, before);
});

test("result previews do not trigger lifetime cloud synchronization", () => {
    const f = fixture();
    f.show(true);
    assert.equal(f.pending.length, 0);
    assert.deepEqual(f.messages, ["show-preview"]);
});
