import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { compileFunction, runInNewContext } from "node:vm";
import * as crypto from "node:crypto";
import { md5 } from "js-md5";
import ts from "typescript";

function trackerFixture({ stored = [], fail = false, entry = {} } = {}) {
    const storage = new Map([
        ["flip-zoo-share-events", structuredClone(stored)],
    ]);
    const calls = [];
    const timers = new Map();
    const listeners = new Set();
    let timerId = 0;
    let ready = 0;
    let identity = "test-owner";
    const wx = {
        getStorageSync: (key) => structuredClone(storage.get(key)),
        setStorageSync: (key, value) =>
            storage.set(key, structuredClone(value)),
        getEnterOptionsSync: () => entry,
        getLaunchOptionsSync: () => ({
            query: { share_channel: "b".repeat(32) },
        }),
        onShow: (callback) => listeners.add(callback),
        offShow: (callback) => listeners.delete(callback),
    };
    const exports = {};
    const source = ts.transpileModule(
        readFileSync(
            new URL(
                "../assets/scripts/services/share-tracking.ts",
                import.meta.url,
            ),
            "utf8",
        ),
        {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
            },
        },
    ).outputText;
    compileFunction(source, [
        "exports",
        "require",
        "wx",
        "setTimeout",
        "clearTimeout",
        "console",
    ])(
        exports,
        (name) =>
            name === "js-md5"
                ? { md5 }
                : {
                      callCloud: async (name, data) => {
                          assert.equal(name, "flipZooShares");
                          calls.push(structuredClone(data));
                          if (fail) throw Error("offline");
                          return data.action === "identity"
                              ? { openid: identity }
                              : { status: "recorded", channel: data.channel };
                      },
                  },
        wx,
        (callback) => {
            const id = ++timerId;
            timers.set(id, callback);
            return id;
        },
        (id) => timers.delete(id),
        { warn() {} },
    );
    return {
        ...exports,
        calls,
        timers,
        listeners,
        start: () => exports.startShareTracking(() => ready++),
        show: (options) =>
            [...listeners].forEach((callback) => callback(options)),
        retry: () => {
            fail = false;
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach((callback) => callback());
        },
        setIdentity: (value) => (identity = value),
        get ready() {
            return ready;
        },
        get pending() {
            return storage.get("flip-zoo-share-events");
        },
    };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("only cold and warm opens with a valid share channel are recorded", async () => {
    const channel = "a".repeat(32);
    const f = trackerFixture({ entry: { query: { share_channel: channel } } });
    const stop = f.start();
    await tick();
    assert.equal(f.ready, 1);
    f.show({ query: { share_channel: "c".repeat(32) } });
    f.show({});
    f.show({ query: { share_channel: "not-md5" } });
    await tick();
    assert.deepEqual(
        f.calls.filter((e) => e.action === "open").map((e) => e.channel),
        [channel, "c".repeat(32)],
    );
    assert.equal(f.pending.length, 0);
    stop();
    assert.equal(f.listeners.size, 0);
});

test("every share click gets a separate persisted channel, even within one millisecond", async () => {
    const f = trackerFixture();
    f.start();
    await tick();
    const first = f.recordShareClick();
    const second = f.recordShareClick();
    assert.notEqual(first, second);
    assert.doesNotMatch(first, /test-owner/);
    await tick();
    const events = f.calls.filter((e) => e.action === "share");
    assert.equal(events.length, 2);
    for (const event of events)
        assert.equal(
            event.channel,
            crypto
                .createHash("md5")
                .update(`test-owner:${event.time}:${event.eventId}`)
                .digest("hex"),
        );
    assert.equal(first, `share_channel=${events[0].channel}`);
    assert.equal(second, `share_channel=${events[1].channel}`);
});

test("offline clicks persist, retry with the same identity and event ID, and survive restart", async () => {
    const f = trackerFixture({ fail: true });
    const stop = f.start();
    assert.throws(() => f.recordShareClick(), /not ready/);
    await tick();
    const stored = structuredClone(f.pending);
    const share = stored.find((e) => e.action === "share");
    assert.ok(share);
    assert.ok(f.timers.size);
    stop();
    assert.equal(f.timers.size, 0);
    const next = trackerFixture({ stored });
    next.start();
    await tick();
    assert.equal(next.pending.length, 0);
    const saved = next.calls.find((e) => e.action === "share");
    assert.equal(saved.eventId, share.eventId);
    assert.equal(saved.time, share.time);
});

test("events belonging to another account are retained without being sent under the new owner", async () => {
    const event = {
        eventId: "f".repeat(32),
        action: "share",
        time: 123,
        channel: "e".repeat(32),
        owner: "another-owner",
    };
    const f = trackerFixture({ stored: [event] });
    f.start();
    await tick();
    assert.equal(f.calls.filter((e) => e.action === "share").length, 0);
    assert.equal(f.pending.length, 1);
    assert.equal(f.pending[0].owner, "another-owner");
});

function serverFixture() {
    const rows = { flipZooShares: new Map(), flipZooShareOpens: new Map() };
    let lost = false;
    let identity = { OPENID: "server-owner", APPID: "server-app" };
    const evaluate = (value, row) => {
        if (typeof value === "string" && value.startsWith("$"))
            return row[value.slice(1)];
        if (value?.op === "eq")
            return evaluate(value.arg[0], row) === evaluate(value.arg[1], row);
        if (value?.op === "cond")
            return evaluate(
                value.arg[evaluate(value.arg[0], row) ? 1 : 2],
                row,
            );
        return value;
    };
    const aggregate = Object.fromEntries(
        ["sum", "min", "max", "eq", "cond"].map((op) => [
            op,
            (arg) => ({ op, arg }),
        ]),
    );
    const group = (rows, spec) => {
        const buckets = new Map();
        for (const row of rows) {
            const key = evaluate(spec._id, row);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(row);
        }
        return [...buckets].map(([key, values]) =>
            Object.fromEntries(
                Object.entries(spec).map(([name, operation]) => {
                    if (name === "_id") return [name, key];
                    const operands = values.map((row) =>
                        evaluate(operation.arg, row),
                    );
                    return [
                        name,
                        operation.op === "sum"
                            ? operands.reduce((a, b) => a + b, 0)
                            : operation.op === "min"
                              ? Math.min(...operands)
                              : Math.max(...operands),
                    ];
                }),
            ),
        );
    };
    const matches = (row, filter) =>
        Object.entries(filter).every(([key, value]) => row[key] === value);
    const db = {
        command: { aggregate },
        collection: (name) => ({
            async add({ data }) {
                if (rows[name].has(data._id)) throw Error("duplicate");
                rows[name].set(data._id, data);
                if (lost) throw Error("response lost");
            },
            where: (filter) => ({
                limit: (count) => ({
                    get: async () => ({
                        data: [...rows[name].values()]
                            .filter((row) => matches(row, filter))
                            .slice(0, count),
                    }),
                }),
            }),
            aggregate() {
                let current = [...rows[name].values()];
                const pipeline = {
                    match(filter) {
                        current = current.filter((row) => matches(row, filter));
                        return pipeline;
                    },
                    group(spec) {
                        current = group(current, spec);
                        return pipeline;
                    },
                    end: async () => ({ list: current }),
                };
                return pipeline;
            },
        }),
    };
    const exports = {};
    runInNewContext(
        readFileSync(
            new URL(
                "../cloud-functions/flip-zoo-shares/index.js",
                import.meta.url,
            ),
            "utf8",
        ),
        {
            exports,
            require: (name) =>
                name === "node:crypto"
                    ? crypto
                    : {
                          init() {},
                          database: () => db,
                          getWXContext: () => identity,
                      },
        },
    );
    return {
        main: exports.main,
        rows,
        loseResponse: () => (lost = true),
        setIdentity: (value) => (identity = value),
    };
}
const shareEvent = () => {
    const event = {
        action: "share",
        eventId: crypto.randomBytes(16).toString("hex"),
        time: Date.now(),
    };
    return {
        ...event,
        channel: md5(`server-owner:${event.time}:${event.eventId}`),
    };
};

test("cloud identity and MD5 are authoritative; retries create exactly one record", async () => {
    const f = serverFixture();
    const event = shareEvent();
    f.loseResponse();
    const result = await f.main({
        ...event,
        openid: "forged-owner",
        APPID: "forged-app",
    });
    assert.equal(result.status, "recorded");
    await f.main(event);
    assert.equal(f.rows.flipZooShares.size, 1);
    const [row] = f.rows.flipZooShares.values();
    assert.equal(row.openid, "server-owner");
    assert.equal(row.appid, "server-app");
    assert.equal(row.shareTime, event.time);
    assert.equal(row.channel, event.channel);
    assert.equal(
        (await f.main({ ...event, channel: "0".repeat(32) })).status,
        "invalid",
    );
    assert.equal(f.rows.flipZooShares.size, 1);
});

test("each opener is recorded using its own identity and received source channel", async () => {
    const f = serverFixture();
    const share = shareEvent();
    await f.main(share);
    f.setIdentity({ OPENID: "recipient", APPID: "server-app" });
    const opening = {
        action: "open",
        eventId: "a".repeat(32),
        time: Date.now(),
        channel: share.channel,
        openid: "forged",
    };
    assert.equal((await f.main(opening)).status, "recorded");
    await f.main(opening);
    const [row] = f.rows.flipZooShareOpens.values();
    assert.equal(row.openid, "recipient");
    assert.equal(row.channel, share.channel);
    assert.equal(f.rows.flipZooShareOpens.size, 1);
    assert.equal(
        (await f.main({ ...opening, eventId: "b".repeat(32), channel: null }))
            .status,
        "ignored",
    );
    assert.equal(
        (await f.main({ ...opening, channel: "malformed" })).status,
        "invalid",
    );
});

test("direct opens neither queue nor upload a referral, including old pending null entries", async () => {
    const f = trackerFixture({
        stored: [
            { eventId: "d".repeat(32), action: "open", time: 1, channel: null },
        ],
    });
    f.start();
    await tick();
    assert.equal(f.ready, 1);
    f.show({});
    f.show({ query: { share_channel: [] } });
    await tick();
    assert.equal(f.calls.filter((event) => event.action === "open").length, 0);
    const server = serverFixture();
    const result = await server.main({ action: "open", channel: null });
    assert.equal(result.status, "ignored");
    assert.equal(server.rows.flipZooShareOpens.size, 0);
});

test("per-channel stats close the loop and separate repeat visitors and self-opens", async () => {
    const f = serverFixture();
    const share = shareEvent();
    await f.main(share);
    const query = { action: "stats", channel: share.channel };
    let stats = await f.main(query);
    assert.equal(stats.openCount, 0);
    assert.equal(stats.returnUsers, 0);
    assert.equal(stats.hasReturn, false);
    const open = async (
        owner,
        index,
        time,
        channel = share.channel,
        appid = "server-app",
    ) => {
        f.setIdentity({ OPENID: owner, APPID: appid });
        return f.main({
            action: "open",
            eventId: String(index).padStart(32, "0"),
            time,
            channel,
        });
    };
    await open("server-owner", 1, 10);
    await open("friend-a", 2, 20);
    await open("friend-a", 2, 20); // transport retry, not a new visit
    await open("friend-a", 3, 30);
    await open("friend-b", 4, 40);
    await open("friend-b", 5, 50, "e".repeat(32));
    await open("friend-b", 6, 60, share.channel, "other-app");
    assert.equal((await f.main(query)).status, "not-found");
    f.setIdentity({ OPENID: "server-owner", APPID: "server-app" });
    stats = await f.main(query);
    assert.equal(stats.openCount, 4);
    assert.equal(stats.uniqueOpenUsers, 3);
    assert.equal(stats.selfOpenCount, 1);
    assert.equal(stats.returnCount, 3);
    assert.equal(stats.returnUsers, 2);
    assert.equal(stats.hasReturn, true);
    assert.equal(stats.firstOpenTime, 10);
    assert.equal(stats.lastOpenTime, 40);
    assert.equal(JSON.stringify(stats).includes("friend-a"), false);
    assert.equal(
        (await f.main({ action: "stats", channel: [] })).status,
        "invalid",
    );
});
