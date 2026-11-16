import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(
    new URL("../open-data/index.js", import.meta.url),
    "utf8",
);

test("the weekly leaderboard scrolls past eight friends and keeps the player rank visible", async () => {
    let receive;
    const labels = [];
    const placements = [];
    const portraits = [];
    const drawing = {
        clearRect() {
            labels.length = 0;
            placements.length = 0;
            portraits.length = 0;
        },
        fillText(text, x, y) {
            labels.push(text);
            placements.push({ text, x, y, font: this.font });
        },
        save() {},
        restore() {},
        strokeText() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        arc() {},
        arcTo() {},
        clip() {},
        drawImage(_image, x, _y, size) {
            portraits.push({ center: x + size / 2, size });
        },
        fill() {},
        stroke() {},
        measureText(text) {
            return { width: text.length * 16 };
        },
    };
    const entries = Array.from({ length: 12 }, (_, index) => ({
        nickname: `玩家 ${index + 1}`,
        avatarUrl: `avatar-${index}`,
        openid: String(index),
        KVDataList: [
            {
                key: "mgrank",
                value: JSON.stringify({
                    wxgame: {
                        score: 12 - index,
                        update_time: Math.floor(Date.now() / 1000),
                    },
                }),
            },
        ],
    }));
    const wx = {
        onMessage(callback) {
            receive = callback;
        },
        getSharedCanvas() {
            return { width: 640, height: 960, getContext: () => drawing };
        },
        getFriendCloudStorage({ success }) {
            success({ data: entries });
        },
        getUserInfo({ success }) {
            success({ data: [{ openId: "9" }] });
        },
    };
    runInNewContext(source, { wx });
    receive({ action: "show-week" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(labels.slice(-4), ["10", "我", "累计胜利", "3"]);
    assert.ok(labels.includes("玩家 8"));
    assert.ok(!labels.includes("玩家 9"));
    assert.ok(!labels.includes("玩家 12"));

    receive({ action: "scroll-week", rows: 50 });
    assert.ok(labels.includes("玩家 12"));
    assert.ok(!labels.includes("玩家 1"));
    assert.ok(labels.includes("玩家 10"));
    assert.ok(!labels.includes("我"));

    wx.createImage = () => ({
        set src(_url) {
            this.onload();
        },
    });
    receive({ action: "show-preview" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
        labels.filter((label) => label.startsWith("玩家")),
        ["玩家 1", "玩家 2", "玩家 3"],
    );
    assert.deepEqual(
        labels.filter((label) => /^\d+$/.test(label)),
        ["12", "11", "10"],
    );
    const [first, second, third] = portraits;
    assert.equal(first.center, 320);
    assert.ok(second.center < first.center && third.center > first.center);
    assert.ok(first.size > second.size && second.size === third.size);
    const name = placements.find(({ text }) => text === "玩家 1");
    const score = placements.find(({ text }) => text === "12");
    assert.equal(name.x, score.x);
    assert.ok(name.y < score.y && parseInt(name.font, 10) < 30);
    receive({ action: "scroll-week", rows: 1 });
    assert.ok(!labels.includes("玩家 12"));
});
