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
    const drawing = {
        clearRect() {
            labels.length = 0;
        },
        fillText(text) {
            labels.push(text);
        },
        save() {},
        restore() {},
        strokeText() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        arc() {},
        fill() {},
        stroke() {},
        measureText(text) {
            return { width: text.length * 16 };
        },
    };
    const entries = Array.from({ length: 12 }, (_, index) => ({
        nickname: `玩家 ${index + 1}`,
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

    receive({ action: "show-preview" });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(
        labels.filter((label) => label.startsWith("玩家")),
        ["玩家 1", "玩家 2", "玩家 3"],
    );
    receive({ action: "scroll-week", rows: 1 });
    assert.ok(!labels.includes("玩家 12"));
});
