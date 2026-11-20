const https = require("node:https");

const GIFT_ANIMALS = ["CAT", "CHIHUAHUA", "CAPYBARA", "DUCK", "SHEEP", "PIG"];
const DEFAULT_GIFT_COST = 1000;

function readGiftConfig(env, appid, animal = 0) {
    if (!Number.isInteger(animal) || !GIFT_ANIMALS[animal]) return null;
    const prefix = `FLIP_ZOO_${GIFT_ANIMALS[animal]}_GIFT_`;
    const names = {
        shop_appid: "FLIP_ZOO_WECHAT_SHOP_APP_ID",
        activity_id: prefix + "ACTIVITY_ID",
        product_id: prefix + "PRODUCT_ID",
        sku_id: prefix + "SKU_ID",
    };
    const config = {};
    for (const [field, name] of Object.entries(names)) {
        const value = env[name]?.trim();
        if (field === "sku_id" && !value) continue;
        if (
            !(field === "shop_appid" ? /^wx[0-9a-f]{16}$/ : /^[1-9]\d*$/).test(
                value ?? "",
            )
        ) {
            return null;
        }
        // IDs remain strings: order IDs can exceed JavaScript's safe integer range.
        config[field] = value;
    }
    const cost = Number(env[prefix + "FRAGMENT_COST"] ?? DEFAULT_GIFT_COST);
    if (
        env.FLIP_ZOO_WECHAT_GAME_APP_ID !== appid ||
        !env.FLIP_ZOO_WECHAT_GAME_APP_SECRET?.trim() ||
        !Number.isSafeInteger(cost) ||
        cost < 1
    )
        return null;
    return { ...config, cost };
}

async function resolveGiftSku(config, api) {
    if (config.sku_id) return config.sku_id;
    const result = await api.activity({
        shop_appid: config.shop_appid,
        activity_id: config.activity_id,
    });
    const activity = result.activity;
    if (
        result.errcode !== 0 ||
        String(activity?.activity_id) !== config.activity_id
    ) {
        throw new Error("Gift activity unavailable");
    }
    const items = activity.info?.prize_info?.product_info_list;
    const item = Array.isArray(items)
        ? items.find((value) => String(value.product_id) === config.product_id)
        : undefined;
    const sku = item?.sku_id;
    if (
        (typeof sku !== "string" && !Number.isSafeInteger(sku)) ||
        !/^[1-9]\d*$/.test(String(sku))
    ) {
        throw new Error("Gift activity has no matching SKU");
    }
    return String(sku);
}

async function giftAvailability(config, api) {
    if (!config) return { enabled: false };
    try {
        const result = await api.activity({
            shop_appid: config.shop_appid,
            activity_id: config.activity_id,
        });
        const activity = result.activity;
        const items = activity?.info?.prize_info?.product_info_list;
        if (
            result.errcode !== 0 ||
            String(activity?.activity_id) !== config.activity_id ||
            activity.status !== 2 ||
            !Array.isArray(items)
        )
            return { enabled: false };
        const item = items.find(
            (value) =>
                String(value.product_id) === config.product_id &&
                (!config.sku_id || String(value.sku_id) === config.sku_id),
        );
        if (!item || !(Number(item.can_use_stock_num) > 0))
            return { enabled: false };
        const sku = await resolveGiftSku(config, {
            activity: async () => result,
        });
        return { enabled: true, sku };
    } catch {
        return { enabled: false };
    }
}

function requestJson(url, options) {
    return new Promise((resolve, reject) => {
        const request = https.request(url, options, (response) => {
            const chunks = [];
            let size = 0;
            response.on("data", (chunk) => {
                size += chunk.length;
                if (size > 1024 * 1024)
                    request.destroy(new Error("WeChat response too large"));
                else chunks.push(chunk);
            });
            response.on("error", reject);
            response.on("end", () => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error("WeChat gift service unavailable"));
                    return;
                }
                try {
                    const value = JSON.parse(
                        Buffer.concat(chunks).toString("utf8"),
                    );
                    resolve({ ok: true, json: async () => value });
                } catch {
                    reject(new Error("Invalid WeChat gift response"));
                }
            });
        });
        const deadline = setTimeout(
            () => request.destroy(new Error("WeChat request timed out")),
            10000,
        );
        request.on("close", () => clearTimeout(deadline));
        request.on("error", reject);
        request.end(options?.body);
    });
}

function createGiftApi(env, fetcher = requestJson) {
    let token;
    let expiresAt = 0;
    async function json(url, options) {
        const response = await fetcher(url, options);
        if (!response.ok) throw new Error("WeChat gift service unavailable");
        return response.json();
    }
    async function accessToken() {
        if (token && Date.now() < expiresAt) return token;
        const result = await json(
            "https://api.weixin.qq.com/cgi-bin/stable_token",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grant_type: "client_credential",
                    appid: env.FLIP_ZOO_WECHAT_GAME_APP_ID,
                    secret: env.FLIP_ZOO_WECHAT_GAME_APP_SECRET,
                    force_refresh: false,
                }),
            },
        );
        if (
            typeof result.access_token !== "string" ||
            !(result.expires_in > 0)
        ) {
            throw new Error("WeChat authentication unavailable");
        }
        token = result.access_token;
        expiresAt = Date.now() + Math.max(0, result.expires_in - 120) * 1000;
        return token;
    }
    async function post(path, body) {
        const result = await json(
            `https://api.weixin.qq.com${path}?access_token=${encodeURIComponent(await accessToken())}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            },
        );
        if ([40001, 40014, 42001].includes(result.errcode)) expiresAt = 0;
        if (!Number.isInteger(result.errcode))
            throw new Error("Invalid WeChat gift response");
        return result;
    }
    return {
        activity: (body) =>
            post("/channels/ec/b2c/activity/info/promoter/get", body),
        create: (body) => post("/channels/ec/order/presentorder/create", body),
        get: (id) =>
            post("/channels/ec/order/present/get", { present_order_id: id }),
    };
}

module.exports = {
    GIFT_ANIMALS,
    readGiftConfig,
    resolveGiftSku,
    giftAvailability,
    createGiftApi,
};
