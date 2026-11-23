import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

function fixture({
    self = 9,
    count = 12,
    fail = false,
    history = [],
    deferred = false,
} = {}) {
    const labels = [];
    const fills = [];
    const drawing = {
        clearRect() {
            labels.length = 0;
            fills.length = 0;
        },
        fillText(text) {
            if (["好友排行榜", "本周榜", "历史榜"].includes(text)) return;
            labels.push(text);
        },
        strokeText() {},
        save() {},
        restore() {},
        translate() {},
        beginPath() {},
        moveTo() {},
        arcTo() {},
        closePath() {},
        clip() {},
        drawImage() {},
        fill() {},
        stroke() {},
        arc() {},
        fillRect() {
            fills.push(this.fillStyle);
        },
        measureText(text) {
            return { width: text.length * 16 };
        },
    };
    const canvas = { width: 682, height: 1440, getContext: () => drawing };
    const entries = Array.from({ length: count }, (_, index) => ({
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
    entries.forEach((entry, index) => {
        if (history[index] !== undefined)
            entry.KVDataList.push({
                key: "mgrank_total",
                value: JSON.stringify({
                    wxgame: { score: history[index], update_time: 1 },
                }),
            });
    });
    const storage = new Map(
        (entries[self]?.KVDataList ?? []).map((entry) => [
            entry.key,
            entry.value,
        ]),
    );
    const writes = [];
    const pending = [];
    const friendRequests = [];
    let failWrite = false;
    let receive;
    const wx = {
        onMessage(callback) {
            receive = callback;
        },
        getSharedCanvas() {
            return canvas;
        },
        getFriendCloudStorage(callback) {
            friendRequests.push([...callback.keyList]);
            const respond = () => {
                if (fail) callback.fail();
                else
                    callback.success({
                        data: entries.map((entry) => ({
                            ...entry,
                            KVDataList: entry.KVDataList.filter((value) =>
                                callback.keyList.includes(value.key),
                            ),
                        })),
                    });
            };
            if (deferred) pending.push(respond);
            else respond();
        },
        getUserCloudStorage({ keyList, success }) {
            success({
                KVDataList: keyList
                    .filter((key) => storage.has(key))
                    .map((key) => ({ key, value: storage.get(key) })),
            });
        },
        setUserCloudStorage({ KVDataList, success, fail }) {
            if (failWrite) {
                fail(Error("unavailable"));
                return;
            }
            writes.push(KVDataList);
            for (const entry of KVDataList) {
                storage.set(entry.key, entry.value);
                if (entries[self])
                    entries[self].KVDataList = [
                        ...entries[self].KVDataList.filter(
                            (value) => value.key !== entry.key,
                        ),
                        entry,
                    ];
            }
            success();
        },
        getUserInfo({ success }) {
            success({ data: [{ openId: String(self) }] });
        },
        createImage() {
            return {
                set src(_url) {
                    queueMicrotask(() => this.onload());
                },
            };
        },
    };
    const sandbox = { wx };
    runInNewContext(
        readFileSync(
            new URL("../open-data/index.js", import.meta.url),
            "utf8",
        ) + "\nglobalThis.layout = rankLayout;",
        sandbox,
    );
    return {
        entries,
        canvas,
        layout: () => sandbox.layout(),
        writes,
        storage,
        failWrites: (value) => (failWrite = value),
        failFriends: (value) => (fail = value),
        friendRequests,
        resolveFriends: async (index) => {
            pending[index]();
            await new Promise((resolve) => setImmediate(resolve));
        },
        labels,
        fills,
        async send(message) {
            receive(message);
            await new Promise((resolve) => setImmediate(resolve));
        },
    };
}

test("full leaderboard scrolls and locates the player without changing the result preview", async () => {
    const f = fixture();
    await f.send({ action: "show-week" });
    assert.deepEqual(f.labels.slice(-4), ["10", "我", "本周通关", "3"]);
    assert.ok(f.labels.includes("玩家 5"));
    assert.ok(!f.labels.includes("玩家 6"));
    await f.send({ action: "scroll-rank", rows: 50 });
    assert.ok(f.labels.includes("玩家 12"));
    assert.ok(!f.labels.includes("玩家 1"));
    assert.ok(f.labels.includes("玩家 10（我）"));
    assert.ok(!f.labels.includes("我"));

    await f.send({ action: "show-preview" });
    assert.deepEqual(
        f.labels.filter((label) => label.startsWith("玩家 ")),
        ["玩家 1", "玩家 2", "玩家 3"],
    );
    assert.deepEqual(
        f.labels.filter((label) => /^\d+$/.test(label)),
        ["1", "12", "2", "11", "3", "10", "10", "3"],
    );
    assert.ok(f.labels.includes("我"));
    assert.equal(f.fills.filter((fill) => fill === "#DDF3A2").length, 1);
    const before = [...f.labels];
    await f.send({ action: "scroll-rank", rows: 50 });
    assert.deepEqual(f.labels, before);
});

test("a top-three player is marked in the podium and still has a personal row", async () => {
    const f = fixture({ self: 0 });
    await f.send({ action: "show-preview" });
    assert.ok(f.labels.includes("玩家 1（我）"));
    assert.ok(f.labels.includes("我"));
    assert.equal(f.labels.filter((label) => label === "12").length, 2);
});

test("short and empty result lists do not invent friends or a personal rank", async () => {
    for (const count of [0, 2]) {
        const f = fixture({ count });
        await f.send({ action: "show-preview" });
        assert.equal(
            f.labels.filter((label) => label.startsWith("玩家 ")).length,
            count,
        );
        assert.ok(f.labels.includes("我 · 暂未上榜"));
        assert.ok(f.labels.includes("—"));
        assert.ok(f.labels.includes("0"));
        if (!count) assert.ok(f.labels.includes("本周暂无上榜好友"));
    }
});

test("load failure is displayed instead of an empty or fabricated ranking", async () => {
    const f = fixture({ fail: true });
    await f.send({ action: "show-preview" });
    assert.deepEqual(f.labels, ["排行加载失败，请重新打开"]);
});

test("history ignores weekly expiry, sorts lifetime counts and retains its own scrolling rank", async () => {
    const f = fixture({
        history: Array.from({ length: 12 }, (_, index) => 100 + index),
    });
    await f.send({ action: "show-history" });
    assert.ok(f.labels.includes("累计通关"));
    assert.ok(!f.labels.includes("本周通关"));
    assert.ok(f.labels.includes("玩家 12"));
    assert.ok(!f.labels.includes("玩家 1"));
    await f.send({ action: "scroll-rank", rows: 50 });
    assert.ok(f.labels.includes("玩家 1"));
    assert.ok(f.labels.includes("我"));
    await f.send({ action: "show-week" });
    assert.ok(f.labels.includes("本周通关"));
    assert.ok(f.labels.includes("玩家 1"));
});

test("verified lifetime sync is monotonic and does not replace the weekly counter", async () => {
    const f = fixture({ self: 0, history: [20] });
    await f.send({ action: "sync-history", total: 25 });
    await f.send({ action: "sync-history", total: 22 });
    assert.equal(JSON.parse(f.storage.get("mgrank_total")).wxgame.score, 25);
    assert.equal(JSON.parse(f.storage.get("mgrank")).wxgame.score, 12);
    await Promise.all([
        f.send({ action: "record-win" }),
        f.send({ action: "record-win" }),
    ]);
    assert.equal(JSON.parse(f.storage.get("mgrank")).wxgame.score, 14);
    assert.equal(JSON.parse(f.storage.get("mgrank_total")).wxgame.score, 25);
    await f.send({ action: "show-history" });
    assert.ok(f.labels.includes("25"));
});

test("history failure is visible and refresh can recover without erasing counts", async () => {
    const f = fixture({ self: 0, history: [20] });
    f.failWrites(true);
    await f.send({ action: "sync-history", total: 21 });
    await f.send({ action: "show-history" });
    assert.deepEqual(f.labels, ["累计次数同步失败，请点击刷新"]);
    assert.equal(JSON.parse(f.storage.get("mgrank_total")).wxgame.score, 20);
    f.failWrites(false);
    await f.send({ action: "sync-history", total: 21 });
    await f.send({ action: "show-history" });
    assert.ok(f.labels.includes("21"));
    await f.send({ action: "loading-history" });
    await f.send({ action: "history-error" });
    assert.deepEqual(f.labels, ["累计次数同步失败，请点击刷新"]);
});

test("late history responses cannot overwrite a newer weekly view", async () => {
    const f = fixture({ self: 0, history: [50], deferred: true });
    await f.send({ action: "show-history" });
    await f.send({ action: "show-week" });
    await f.resolveFriends(1);
    assert.ok(f.labels.includes("本周通关"));
    const before = [...f.labels];
    await f.resolveFriends(0);
    assert.deepEqual(f.labels, before);
});

test("unknown lifetime data is not fabricated from a weekly-only score", async () => {
    const f = fixture();
    await f.send({ action: "show-history" });
    assert.ok(f.labels.includes("暂无累计通关好友"));
    assert.ok(f.labels.includes("我 · 暂未上榜"));
    await f.send({ action: "sync-history", total: -1 });
    assert.equal(f.writes.length, 0);
});

test("short and empty boards retain the minimum height and personal row", async () => {
    const own = fixture({ count: 1, self: 0 });
    await own.send({ action: "show-week" });
    assert.equal(own.layout().listHeight, 368);
    const missing = fixture({ count: 1, self: 9 });
    await missing.send({ action: "show-week" });
    assert.equal(missing.layout().listHeight, 368);
    assert.ok(missing.labels.includes("我 · 暂未上榜"));
    const empty = fixture({ count: 0 });
    await empty.send({ action: "show-week" });
    assert.equal(empty.layout().listHeight, 368);
    assert.ok(empty.labels.includes("本周暂无上榜好友"));
});

test("long boards cap their height and resize after scrolling and switching tabs", async () => {
    const f = fixture({ history: [30] });
    await f.send({ action: "show-week" });
    assert.equal(f.layout().listHeight, 652);
    await f.send({ action: "scroll-rank", rows: 50 });
    assert.equal(f.layout().listHeight, 536);
    await f.send({ action: "refresh-rank" });
    assert.equal(f.layout().listHeight, 652);
    await f.send({ action: "show-history" });
    assert.equal(f.layout().listHeight, 368);
    await f.send({ action: "show-week" });
    assert.equal(f.layout().listHeight, 652);
});

test("adaptive panel keeps its button clearance and tab hit area follows its top", async () => {
    const f = fixture({ count: 1, self: 0, history: [20] });
    await f.send({ action: "show-week" });
    const before = f.layout();
    assert.equal(before.bottom - (f.canvas.height / 2 + 250 + 38), 68);
    await f.send({ action: "rank-pointer", x: 482, y: before.top + 124 });
    assert.ok(f.labels.includes("累计通关"));
    await f.send({ action: "refresh-rank" });
    assert.ok(f.labels.includes("累计通关"));
    assert.equal(f.layout().height, 720);
});

test("lifetime refresh failure does not prevent loading the weekly board", async () => {
    const f = fixture();
    await f.send({ action: "show-week" });
    await f.send({ action: "loading-rank" });
    await f.send({ action: "rank-error" });
    assert.ok(f.labels.includes("本周通关"));
    await f.send({ action: "show-history" });
    await f.send({ action: "rank-error" });
    assert.deepEqual(f.labels, ["刷新失败，请重试"]);
});

for (const failure of ["refresh", "write", "friends"]) {
    test(`history ${failure} failure leaves the weekly tab usable`, async () => {
        const f = fixture({ history: [30] });
        await f.send({ action: "show-history" });
        if (failure === "refresh") await f.send({ action: "rank-error" });
        if (failure === "write") {
            f.failWrites(true);
            await f.send({ action: "sync-history", total: 40 });
            await f.send({ action: "show-history" });
        }
        if (failure === "friends") {
            f.failFriends(true);
            await f.send({ action: "show-history" });
            f.failFriends(false);
        }
        const before = f.friendRequests.length;
        await f.send({
            action: "rank-pointer",
            x: 200,
            y: f.layout().top + 124,
        });
        assert.equal(f.friendRequests.length, before + 1);
        assert.deepEqual(f.friendRequests.at(-1), ["mgrank"]);
        assert.ok(f.labels.includes("本周通关"));
    });
}

test("tabs can switch while friend data is pending, and previews ignore tab pointers", async () => {
    const f = fixture({ deferred: true, history: [30] });
    await f.send({ action: "show-week" });
    await f.send({ action: "rank-pointer", x: 482, y: f.layout().top + 124 });
    assert.equal(f.friendRequests.length, 2);
    assert.deepEqual(f.friendRequests[1], ["mgrank_total"]);
    await f.resolveFriends(1);
    await f.resolveFriends(0);
    assert.ok(f.labels.includes("累计通关"));
    await f.send({ action: "show-preview" });
    const before = f.friendRequests.length;
    await f.send({ action: "rank-pointer", x: 482, y: f.layout().top + 124 });
    assert.equal(f.friendRequests.length, before);
});
