import { test, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire, Module } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = mkdtempSync(join(tmpdir(), "pretzel-home-view-"));
after(() => rmSync(out, { recursive: true, force: true }));
execFileSync(process.execPath, [
    "node_modules/typescript/bin/tsc",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2020",
    "--module",
    "CommonJS",
    "--types",
    "@cocos/creator-types/engine",
    "--outDir",
    out,
    "assets/scripts/home-view.ts",
]);
class Node {
    static EventType = {
        TOUCH_START: "start",
        TOUCH_END: "end",
        TOUCH_CANCEL: "cancel",
    };
    constructor(name) {
        this.name = name;
        this.children = [];
        this.components = new Map();
        this.events = new Map();
        this.isValid = true;
    }
    addChild(child) {
        this.children.push(child);
        child.parent = this;
    }
    addComponent(Type) {
        const component = new Type();
        component.node = this;
        this.components.set(Type, component);
        return component;
    }
    getComponent(Type) {
        return this.components.get(Type);
    }
    getChildByName(name) {
        return this.children.find((child) => child.name === name);
    }
    setPosition() {}
    setSiblingIndex() {}
    on(type, fn) {
        this.events.set(type, [...(this.events.get(type) ?? []), fn]);
    }
    emit(type, value) {
        for (const fn of this.events.get(type) ?? []) fn(value);
    }
    destroy() {
        this.isValid = false;
    }
}
class UITransform {
    setContentSize(width, height) {
        this.width = typeof width === "number" ? width : width.width;
        this.height = height ?? width.height;
        this.contentSize = { width: this.width, height: this.height };
    }
}
class Color {
    static WHITE = new Color().fromHEX("#ffffff");
    fromHEX(hex) {
        this.hex = hex;
        return this;
    }
}
class Graphics {
    clear() {}
    roundRect() {}
    fill() {}
    stroke() {}
    ellipse() {}
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
}
class Label {
    static HorizontalAlign = { CENTER: 0, LEFT: 1, RIGHT: 2 };
    static VerticalAlign = { CENTER: 0 };
    static Overflow = { CLAMP: 0, NONE: 1 };
    isValid = true;
    updateRenderData() {
        this.node
            .getComponent(UITransform)
            .setContentSize(
                this.string.length * this.fontSize,
                this.lineHeight,
            );
    }
}
class Sprite {
    static SizeMode = { CUSTOM: 0 };
    static Type = { SIMPLE: 0 };
}
class SpriteFrame {}
class Texture2D {}
class Size {}
class Rect {}
class Mask {}
class ScrollView {}
class UIOpacity {}
const cc = {
    Node,
    UITransform,
    Color,
    Graphics,
    Label,
    Sprite,
    SpriteFrame,
    Texture2D,
    Size,
    Rect,
    Mask,
    ScrollView,
    UIOpacity,
    resources: {
        load(_path, _type, done) {
            done(null, { width: 600, height: 400 });
        },
    },
};
const require = createRequire(import.meta.url);
const originalLoad = Module._load;
let renderHome;
try {
    Module._load = function (name, ...args) {
        return name === "cc" ? cc : originalLoad.call(this, name, ...args);
    };
    ({ renderHome } = require(join(out, "home-view.js")));
} finally {
    Module._load = originalLoad;
}
const walk = (root) => [root, ...root.children.flatMap(walk)];
const event = (distance = 0) => ({
    getStartLocation: () => ({ subtract: () => ({ length: () => distance }) }),
    getLocation: () => ({ x: distance }),
});
function mount(start = async () => {}) {
    const parent = new Node("Home");
    renderHome(
        parent,
        {
            width: 390,
            height: 844,
            scale: 1,
            safeTop: 47,
            safeBottom: 34,
            capsuleBottom: 76,
        },
        {
            weekId: "2026-11-02",
            items: [
                {
                    animal: { id: "a", name: "鱼", artworkKey: "A01" },
                    receivedCount: 1,
                },
            ],
            run: null,
            reserve: 0,
            claim: false,
            page: 0,
        },
        {
            blocked: () => false,
            bag() {},
            settings() {},
            start,
            claim: async () => {},
            detail() {},
            collection() {},
            rank() {},
            page() {},
        },
    );
    return parent;
}
test("home restores start caption when action finishes without navigating, including a caught failure", async () => {
    let finish;
    const parent = mount(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const nodes = walk(parent);
    const caption = nodes
        .map((node) => node.getComponent(Label))
        .find((label) => label?.string === "开始挑战");
    nodes.find((node) => node.name === "Start challenge").emit("end", event());
    assert.equal(caption.string, "正在准备…");
    finish();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(caption.string, "开始挑战");
});
test("animal feedback resets on moved touch-end and cancellation before click dispatch", async () => {
    const nodes = walk(mount());
    await Promise.resolve();
    const target = nodes.find((node) => node.name === "Animal detail target");
    const art = nodes.find((node) => node.name === "Animal a");
    const sprite = art.getChildByName("Skin").getComponent(Sprite);
    for (const type of ["end", "cancel"]) {
        target.emit("start", event());
        assert.equal(sprite.color.hex, "#eef8dd");
        target.emit(type, event(30));
        assert.equal(sprite.color.hex, "#ffffff");
    }
});
