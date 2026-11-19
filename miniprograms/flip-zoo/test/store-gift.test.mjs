import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { EventEmitter } from "node:events";
import { createGiftHandler } from "../cloudfunctions/flipZooFragments/gifts.js";
import {
    readGiftConfig,
    resolveGiftSku,
    createGiftApi,
    GIFT_ANIMALS,
    giftAvailability,
} from "../cloudfunctions/flipZooFragments/gift-api.js";
import {
    supportsStoreGift,
    openStoreGift,
    giftEnabled,
} from "../assets/scripts/services/store-gift.ts";

const config = {
    activity_id: "123",
    shop_appid: "wx0000000000000001",
    product_id: "17000000000000",
    sku_id: "12345",
    cost: 1,
};
const presentOrderId = "4226341196275658752";
const openid = "caller-openid";

function fixture(balance = 20, counts) {
    let time = Date.UTC(2026, 10, 19, 0);
    const rows = new Map([
        [
            "wallet-test",
            {
                balances: [balance, 0, 0, 0, 0, 0],
                ...(counts ? { giftCounts: counts } : {}),
            },
        ],
    ]);
    let failWrite = () => false;
    const collection = {
        doc(id) {
            return {
                async get() {
                    return { data: structuredClone(rows.get(id)) };
                },
                async set({ data }) {
                    rows.set(id, structuredClone(data));
                },
                async update({ data }) {
                    if (failWrite(data))
                        throw new Error("Database write failed");
                    rows.set(id, { ...rows.get(id), ...structuredClone(data) });
                },
            };
        },
    };
    let tail = Promise.resolve();
    const db = {
        collection: () => collection,
        runTransaction(fn) {
            const task = tail.then(async () => {
                const before = structuredClone(rows);
                try {
                    return await fn(db);
                } catch (error) {
                    rows.clear();
                    before.forEach((value, key) => rows.set(key, value));
                    throw error;
                }
            });
            tail = task.catch(() => {});
            return task;
        },
    };
    const requests = [];
    let orderStatus = 12;
    let create = async () => ({ errcode: 0, present_order_id: presentOrderId });
    const api = {
        async activity() {
            return {
                errcode: 0,
                activity: {
                    activity_id: config.activity_id,
                    status: 2,
                    info: {
                        prize_info: {
                            product_info_list: [
                                {
                                    product_id: config.product_id,
                                    sku_id: config.sku_id,
                                    can_use_stock_num: "1000",
                                },
                            ],
                        },
                    },
                },
            };
        },
        async create(body) {
            requests.push(body);
            return create(body);
        },
        async get(id) {
            return {
                errcode: 0,
                present: {
                    present_order_id: id,
                    activity_id: "123",
                    sub_order_list: [{ openid, status: orderStatus }],
                },
            };
        },
    };
    let activeConfig = config;
    let activeAnimal = 0;
    return {
        rows,
        requests,
        api,
        wallet: () => structuredClone(rows.get("wallet-test")),
        advanceDay: () => {
            time += 86400000;
        },
        setStatus: (value) => {
            orderStatus = value;
        },
        setCreate: (fn) => {
            create = fn;
        },
        setAnimal: (value) => {
            activeAnimal = value;
        },
        setBalance: (animal, value) => {
            rows.get("wallet-test").balances[animal] = value;
        },
        setConfig: (value) => {
            activeConfig = value;
        },
        setFailWrite: (fn) => {
            failWrite = fn;
        },
        call(action = "redeem-gift") {
            return createGiftHandler({
                db,
                collection: "test",
                api,
                config: activeConfig,
                animal: activeAnimal,
                now: () => time,
            })({ walletId: "wallet-test", openid, action });
        },
    };
}

test("unconfigured and insufficient requests do not reserve or call WeChat", async () => {
    const f = fixture(0);
    f.setConfig(null);
    assert.equal((await f.call()).status, "unconfigured");
    f.setConfig(config);
    assert.equal((await f.call()).status, "insufficient");
    assert.equal(f.wallet().balances[0], 0);
    assert.equal(f.requests.length, 0);
});

test("database failure after successful WeChat creation does not deduct again on retry", async () => {
    const f = fixture();
    f.setFailWrite((data) => data.state === "ready");
    assert.equal((await f.call()).status, "pending");
    assert.equal(f.wallet().balances[0], 19);
    f.setFailWrite(() => false);
    assert.equal((await f.call()).status, "ready");
    assert.equal(f.wallet().balances[0], 19);
    assert.equal(f.requests[0].idempotent_id, f.requests[1].idempotent_id);
});

test("uncertain errors and unsafe numeric IDs keep the original reservation", async () => {
    const f = fixture();
    f.setCreate(async () => ({ errcode: -1 }));
    assert.equal((await f.call()).status, "pending");
    f.setCreate(async () => ({
        errcode: 0,
        present_order_id: Number(presentOrderId),
    }));
    assert.equal((await f.call()).status, "pending");
    assert.equal(f.wallet().balances[0], 19);
    assert.equal(f.requests[0].idempotent_id, f.requests[1].idempotent_id);
});

test("cloud function dispatch uses the trusted identity, not client-supplied recipient or wallet", async () => {
    let captured;
    const exports = {};
    const modules = {
        "wx-server-sdk": {
            init() {},
            getWXContext: () => ({
                APPID: "trusted-app",
                OPENID: "trusted-user",
            }),
            database: () => ({
                collection: () => ({
                    where: () => ({ get: async () => ({ data: [{}] }) }),
                }),
            }),
        },
        "node:crypto": await import("node:crypto"),
        "./rules/gameplay/round.js": {},
        "./rules/services/main-board-pool.js": {},
        "./gift-api.js": {
            GIFT_ANIMALS,
            createGiftApi: () => ({}),
            readGiftConfig: () => null,
        },
        "./gifts.js": {
            createGiftHandler: () => async (args) => {
                captured = args;
                return { status: "unconfigured" };
            },
        },
    };
    runInNewContext(
        readFileSync(
            new URL(
                "../cloudfunctions/flipZooFragments/index.js",
                import.meta.url,
            ),
            "utf8",
        ),
        {
            exports,
            require: (name) => modules[name],
            process: { env: {} },
        },
    );
    assert.equal(
        (
            await exports.main({
                action: "redeem-gift",
                animal: 0,
                openid: "attacker",
                walletId: "other",
            })
        ).status,
        "unconfigured",
    );
    assert.equal(captured.openid, "trusted-user");
    assert.notEqual(captured.walletId, "other");
    assert.match(captured.walletId, /^wallet-[a-f0-9]{64}$/);
});

test("concurrent requests reserve once, send the trusted recipient and reuse one idempotency key", async () => {
    const f = fixture();
    const results = await Promise.all(
        Array.from({ length: 8 }, () => f.call()),
    );
    assert.ok(results.every((result) => result.status === "ready"));
    assert.equal(f.wallet().balances[0], 19);
    assert.equal(f.wallet().giftCounts.cat, 1);
    assert.equal(
        new Set(f.requests.map((request) => request.idempotent_id)).size,
        1,
    );
    assert.ok(
        f.requests.every(
            (request) =>
                request.openid === openid &&
                request.product_id === config.product_id,
        ),
    );
});

test("lost creation response retries the persisted request, even after configuration changes", async () => {
    const f = fixture();
    f.setCreate(async () => {
        throw new Error("network timeout with token=secret");
    });
    assert.deepEqual(await f.call(), { status: "pending" });
    assert.equal(f.wallet().balances[0], 19);
    f.setConfig({ ...config, activity_id: "999", cost: 100 });
    f.setCreate(async () => ({ errcode: 0, present_order_id: presentOrderId }));
    assert.equal((await f.call("gift-status")).status, "ready");
    assert.deepEqual(f.requests[0], f.requests[1]);
    assert.equal(f.wallet().balances[0], 19);
});

test("explicit inventory rejection refunds once; transient errors retain the reservation", async () => {
    const f = fixture();
    f.setCreate(async () => ({ errcode: 108001 }));
    assert.equal((await f.call()).status, "rejected");
    assert.equal(f.wallet().balances[0], 20);
    assert.equal(f.wallet().giftCounts.total, 0);
    assert.equal((await f.call("gift-status")).status, "rejected");
    f.setCreate(async () => ({ errcode: 6011104 }));
    assert.equal((await f.call()).status, "pending");
    assert.equal(f.wallet().balances[0], 19);
});

test("UI opening is not receipt; only trusted server state marks a gift claimed", async () => {
    const f = fixture();
    await f.call();
    assert.equal((await f.call("gift-status")).status, "ready");
    f.setStatus(20);
    assert.equal((await f.call("gift-status")).status, "claimed");
    assert.equal((await f.call()).status, "ready");
    assert.equal(f.wallet().giftCounts.cat, 2);
});

test("expiration restores the original cost and quotas exactly once, without refunding completed after-sales", async () => {
    const f = fixture();
    await f.call();
    f.setConfig({ ...config, cost: 100 });
    f.setStatus(180);
    const results = await Promise.all([
        f.call("gift-status"),
        f.call("gift-status"),
    ]);
    assert.ok(results.every((value) => value.status === "expired"));
    assert.equal(f.wallet().balances[0], 20);
    assert.equal(f.wallet().giftCounts.total, 0);
    f.setConfig(config);
    f.setStatus(200);
    await f.call();
    assert.equal((await f.call("gift-status")).status, "claimed");
    assert.equal(f.wallet().balances[0], 19);
});

test("unknown or foreign order status cannot refund fragments or open a different user's order", async () => {
    const f = fixture();
    await f.call();
    f.api.get = async () => ({
        errcode: 0,
        present: {
            present_order_id: presentOrderId,
            activity_id: "123",
            sub_order_list: [{ openid: "other", status: 180 }],
        },
    });
    assert.equal((await f.call("gift-status")).status, "pending");
    assert.equal(f.wallet().balances[0], 19);
});

test("same-animal and total limits apply even with the one-fragment debugging cost", async () => {
    for (const counts of [
        { cat: 3, total: 3, day: "", daily: 0 },
        { cat: 1, total: 6, day: "", daily: 0 },
    ]) {
        const f = fixture(20, counts);
        assert.equal((await f.call()).status, "limit");
        assert.equal(f.requests.length, 0);
        assert.equal(f.wallet().balances[0], 20);
    }
});

test("cat configuration accepts only the authorized game", () => {
    const env = {
        FLIP_ZOO_WECHAT_GAME_APP_ID: "wx0000000000000002",
        FLIP_ZOO_WECHAT_GAME_APP_SECRET: "test-secret",
        FLIP_ZOO_WECHAT_SHOP_APP_ID: config.shop_appid,
        FLIP_ZOO_CAT_GIFT_ACTIVITY_ID: config.activity_id,
        FLIP_ZOO_CAT_GIFT_PRODUCT_ID: config.product_id,
        FLIP_ZOO_CAT_GIFT_SKU_ID: config.sku_id,
        FLIP_ZOO_CAT_GIFT_FRAGMENT_COST: "1",
    };
    assert.deepEqual(
        readGiftConfig(env, env.FLIP_ZOO_WECHAT_GAME_APP_ID),
        config,
    );
    const withoutSku = { ...env, FLIP_ZOO_CAT_GIFT_SKU_ID: "" };
    const expected = { ...config };
    delete expected.sku_id;
    assert.deepEqual(
        readGiftConfig(withoutSku, env.FLIP_ZOO_WECHAT_GAME_APP_ID),
        expected,
    );
    assert.equal(
        readGiftConfig(
            { ...env, FLIP_ZOO_CAT_GIFT_SKU_ID: "invalid" },
            env.FLIP_ZOO_WECHAT_GAME_APP_ID,
        ),
        null,
    );
    assert.equal(readGiftConfig(env, "wx0000000000000003"), null);
});

test("configured SKU skips lookup; missing SKU selects the first item for the configured product", async () => {
    let queries = 0;
    const api = {
        activity: async (body) => {
            queries++;
            assert.deepEqual(body, {
                shop_appid: config.shop_appid,
                activity_id: config.activity_id,
            });
            return {
                errcode: 0,
                activity: {
                    activity_id: config.activity_id,
                    info: {
                        prize_info: {
                            product_info_list: [
                                { product_id: "other-product", sku_id: "999" },
                                {
                                    product_id: config.product_id,
                                    sku_id: "5678",
                                },
                                {
                                    product_id: config.product_id,
                                    sku_id: "7890",
                                },
                            ],
                        },
                    },
                },
            };
        },
    };
    assert.equal(await resolveGiftSku(config, api), config.sku_id);
    assert.equal(queries, 0);
    assert.equal(
        await resolveGiftSku({ ...config, sku_id: undefined }, api),
        "5678",
    );
    assert.equal(queries, 1);
});

test("failed or empty SKU lookup cannot spend fragments or create an order", async () => {
    for (const response of [
        { errcode: 40097 },
        {
            errcode: 0,
            activity: {
                activity_id: config.activity_id,
                info: { prize_info: { product_info_list: [] } },
            },
        },
        {
            errcode: 0,
            activity: {
                activity_id: config.activity_id,
                info: {
                    prize_info: {
                        product_info_list: [
                            { product_id: config.product_id, sku_id: "" },
                            { product_id: config.product_id, sku_id: "7890" },
                        ],
                    },
                },
            },
        },
    ]) {
        const f = fixture();
        f.setConfig({ ...config, sku_id: undefined });
        f.api.activity = async () => response;
        assert.equal((await f.call()).status, "disabled");
        assert.equal(f.wallet().balances[0], 20);
        assert.equal(f.wallet().activeCatGift, undefined);
        assert.equal(f.requests.length, 0);
    }
});

test("automatically selected SKU is persisted and never queried again for a pending retry", async () => {
    const f = fixture();
    f.setConfig({ ...config, sku_id: undefined });
    let queries = 0;
    f.api.activity = async () => {
        queries++;
        return {
            errcode: 0,
            activity: {
                activity_id: config.activity_id,
                status: 2,
                info: {
                    prize_info: {
                        product_info_list: [
                            {
                                product_id: config.product_id,
                                sku_id: 5678,
                                can_use_stock_num: 1000,
                            },
                        ],
                    },
                },
            },
        };
    };
    f.setCreate(async () => {
        throw new Error("Lost response");
    });
    assert.equal((await f.call()).status, "pending");
    f.api.activity = async () => {
        throw new Error("Must not query again");
    };
    f.setCreate(async () => ({ errcode: 0, present_order_id: presentOrderId }));
    assert.equal((await f.call()).status, "ready");
    assert.equal(queries, 1);
    assert.equal(f.requests[0].sku_id, "5678");
    assert.deepEqual(f.requests[0], f.requests[1]);
    assert.equal(f.wallet().balances[0], 19);
});

test("WeChat API caches tokens, invalidates expired tokens and preserves long order IDs", async () => {
    const calls = [];
    let responseCode = 0;
    const api = createGiftApi(
        {
            FLIP_ZOO_WECHAT_GAME_APP_ID: "appid",
            FLIP_ZOO_WECHAT_GAME_APP_SECRET: "secret",
        },
        async (url, options) => {
            calls.push({ url, body: options.body });
            return {
                ok: true,
                json: async () =>
                    url.endsWith("/cgi-bin/stable_token")
                        ? { access_token: "test-token", expires_in: 7200 }
                        : {
                              errcode: responseCode,
                              present_order_id: presentOrderId,
                          },
            };
        },
    );
    assert.equal((await api.create({})).present_order_id, presentOrderId);
    await api.get(presentOrderId);
    assert.equal(calls.length, 3);
    assert.equal(JSON.parse(calls[2].body).present_order_id, presentOrderId);
    responseCode = 42001;
    await api.get(presentOrderId);
    responseCode = 0;
    await api.get(presentOrderId);
    assert.equal(
        calls.filter((call) => call.url.endsWith("/cgi-bin/stable_token"))
            .length,
        2,
    );
});

test("unsupported clients and malformed orders never open a gift; opening does not mark it claimed", async () => {
    assert.equal(supportsStoreGift({}), false);
    let opens = 0;
    const platform = {
        createStoreGift: () => ({
            getOrderInfo: async () => ({ orderStatus: 12 }),
            isSupported: () => true,
            open: async () => {
                opens++;
            },
        }),
    };
    assert.equal(supportsStoreGift(platform), true);
    await assert.rejects(
        openStoreGift(platform, {
            status: "ready",
            presentOrderId: "123",
            openid,
        }),
    );
    const result = { status: "ready", presentOrderId, openid };
    await openStoreGift(platform, result);
    assert.equal(opens, 1);
    assert.equal(result.status, "ready");
});

test("gift order loading failure is reported before opening and preserves the order", async () => {
    let opens = 0;
    const error = { errCode: -1000, errMsg: "订单加载失败，请重试" };
    const result = { status: "ready", presentOrderId, openid };
    await assert.rejects(
        openStoreGift(
            {
                createStoreGift: () => ({
                    getOrderInfo: async () => {
                        throw error;
                    },
                    isSupported: () => true,
                    open: async () => {
                        opens++;
                    },
                }),
            },
            result,
        ),
        (actual) => actual === error,
    );
    assert.equal(opens, 0);
    assert.equal(result.status, "ready");
});

test("each animal reads only its own configuration group", () => {
    const shared = {
        FLIP_ZOO_WECHAT_GAME_APP_ID: "wx0000000000000002",
        FLIP_ZOO_WECHAT_GAME_APP_SECRET: "test-secret",
        FLIP_ZOO_WECHAT_SHOP_APP_ID: config.shop_appid,
    };
    for (const [animal, key] of GIFT_ANIMALS.entries()) {
        const env = {
            ...shared,
            [`FLIP_ZOO_${key}_GIFT_ACTIVITY_ID`]: config.activity_id,
            [`FLIP_ZOO_${key}_GIFT_PRODUCT_ID`]: config.product_id,
        };
        assert.ok(
            readGiftConfig(env, shared.FLIP_ZOO_WECHAT_GAME_APP_ID, animal),
        );
        assert.equal(
            readGiftConfig(
                env,
                shared.FLIP_ZOO_WECHAT_GAME_APP_ID,
                (animal + 1) % 6,
            ),
            null,
        );
    }
});

test("missing configuration and invalid activity/product/SKU/stock keep redemption disabled", async () => {
    assert.deepEqual(await giftAvailability(null, {}), { enabled: false });
    for (const variant of [
        "expired",
        "other-product",
        "other-sku",
        "empty-stock",
    ]) {
        const f = fixture();
        const original = f.api.activity;
        f.api.activity = async () => {
            const result = await original();
            const item = result.activity.info.prize_info.product_info_list[0];
            if (variant === "expired") result.activity.status = 5;
            if (variant === "other-product") item.product_id = "999";
            if (variant === "other-sku") item.sku_id = "999";
            if (variant === "empty-stock") item.can_use_stock_num = "0";
            return result;
        };
        assert.equal((await f.call("gift-status")).enabled, false);
        assert.equal((await f.call()).status, "disabled");
        assert.equal(f.wallet().balances[0], 20);
        assert.equal(f.requests.length, 0);
    }
    assert.equal(giftEnabled({ status: "idle", enabled: false }), false);
    assert.equal(giftEnabled({ status: "idle", enabled: true }), true);
});

test("same-day pig redemption after another animal preserves cumulative quotas and refunds", async () => {
    const f = fixture(20, { cat: 1, total: 1, day: "2026-11-19", daily: 1 });
    f.setAnimal(5);
    f.setBalance(5, 2);
    assert.equal((await f.call()).status, "ready");
    assert.equal(f.wallet().balances[5], 1);
    assert.equal(f.wallet().balances[0], 20);
    assert.equal(f.wallet().giftCounts.pig, 1);
    assert.equal(f.wallet().giftCounts.cat, 1);
    assert.equal(f.wallet().giftCounts.total, 2);
    f.setStatus(180);
    assert.equal((await f.call("gift-status")).status, "expired");
    assert.equal(f.wallet().balances[5], 2);
    assert.equal(f.wallet().giftCounts.cat, 1);
    assert.equal(f.wallet().giftCounts.pig, 0);
    assert.equal(f.wallet().giftCounts.total, 1);
});

test("existing gift remains claimable when new redemption configuration is removed", async () => {
    const f = fixture();
    await f.call();
    f.setConfig(null);
    const result = await f.call("gift-status");
    assert.equal(result.status, "ready");
    assert.equal(giftEnabled(result), true);
    assert.equal(f.wallet().balances[0], 19);
});

test("cloud HTTP client initializes and sends requests without global fetch or AbortSignal", async () => {
    const requests = [];
    const module = { exports: {} };
    const https = {
        request(url, options, callback) {
            const request = new EventEmitter();
            request.destroy = (error) => {
                request.emit("error", error);
                request.emit("close");
            };
            request.end = (body) => {
                requests.push({ url, options, body });
                queueMicrotask(() => {
                    const response = new EventEmitter();
                    response.statusCode = 200;
                    callback(response);
                    const value = url.endsWith("/stable_token")
                        ? { access_token: "test-token", expires_in: 7200 }
                        : { errcode: 0, present_order_id: presentOrderId };
                    response.emit("data", Buffer.from(JSON.stringify(value)));
                    response.emit("end");
                    request.emit("close");
                });
            };
            return request;
        },
    };
    runInNewContext(
        readFileSync(
            new URL(
                "../cloudfunctions/flipZooFragments/gift-api.js",
                import.meta.url,
            ),
            "utf8",
        ),
        {
            module,
            Buffer,
            setTimeout,
            clearTimeout,
            require(name) {
                assert.equal(name, "node:https");
                return https;
            },
        },
    );
    const api = module.exports.createGiftApi({
        FLIP_ZOO_WECHAT_GAME_APP_ID: "test",
        FLIP_ZOO_WECHAT_GAME_APP_SECRET: "test-secret",
    });
    const result = await api.create({ openid, idempotent_id: "test-key" });
    assert.equal(result.present_order_id, presentOrderId);
    assert.equal(requests.length, 2);
    assert.equal(JSON.parse(requests[0].body).force_refresh, false);
    assert.equal(JSON.parse(requests[1].body).idempotent_id, "test-key");
});
