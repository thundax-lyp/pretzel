const { randomUUID } = require("node:crypto");
const { giftAvailability } = require("./gift-api.js");

// Only explicit creation rejections release a reservation. Unknown responses keep
// the same idempotency key so a lost response cannot create a second gift.
const rejectedCodes = new Set([
    40097, 108001, 108002, 608010, 608016, 608021, 6011100, 6011102, 6011103,
    6080060, 6080061,
]);

function createGiftHandler({
    db,
    collection,
    api,
    config,
    animal = 0,
    now = Date.now,
}) {
    const countKey = ["cat", "chihuahua", "capybara", "duck", "sheep", "pig"][
        animal
    ];
    const activeKey = `active${countKey[0].toUpperCase()}${countKey.slice(1)}Gift`;
    const animalName = [
        "公仔猫",
        "吉娃娃",
        "卡皮巴拉",
        "小黄鸭",
        "招财羊",
        "鸡肚猪",
    ][animal];
    const dayAt = (time) =>
        new Date(time + 8 * 3600000).toISOString().slice(0, 10);
    const transaction = (fn) =>
        db.runTransaction((tx) => fn(tx.collection(collection)));

    async function release(records, walletId, gift, state) {
        const doc = records.doc(walletId);
        const { data: wallet } = await doc.get();
        const balances = wallet.balances.slice();
        balances[animal] += gift.cost;
        const counts = { ...wallet.giftCounts };
        counts[countKey] -= 1;
        counts.total -= 1;
        if (counts.day === gift.day) counts.daily -= 1;
        await doc.update({ data: { balances, giftCounts: counts } });
        await records.doc(gift.id).update({ data: { state } });
    }

    async function reconcile(walletId, gift, openid) {
        if (gift.state !== "ready") return gift;
        const result = await api.get(gift.presentOrderId);
        const present = result.present;
        if (
            result.errcode !== 0 ||
            present?.present_order_id !== gift.presentOrderId ||
            String(present.activity_id) !== gift.order.activity_id
        )
            throw new Error("Gift status unavailable");
        const orders = present.sub_order_list;
        // This flow creates exactly one gift for this caller; never trust a client status.
        if (
            !Array.isArray(orders) ||
            orders.length !== 1 ||
            orders[0].openid !== openid
        ) {
            throw new Error("Gift recipient mismatch");
        }
        const status = orders[0].status;
        if (status === 12) return gift;
        const expired = status === 180;
        if (!expired && ![20, 21, 30, 100, 200].includes(status)) {
            throw new Error("Unknown gift order status");
        }
        return transaction(async (records) => {
            const { data: latest } = await records.doc(gift.id).get();
            if (latest.state !== "ready") return latest;
            if (expired) await release(records, walletId, latest, "expired");
            else
                await records
                    .doc(gift.id)
                    .update({ data: { state: "claimed" } });
            return { ...latest, state: expired ? "expired" : "claimed" };
        });
    }

    return async function handle({ walletId, openid, action }) {
        try {
            let { data: wallet } = await db
                .collection(collection)
                .doc(walletId)
                .get();
            let gift;
            if (wallet[activeKey]) {
                ({ data: gift } = await db
                    .collection(collection)
                    .doc(wallet[activeKey])
                    .get());
                gift = await reconcile(walletId, gift, openid);
            }
            if (
                action === "gift-status" &&
                (!gift || !["creating", "ready"].includes(gift.state))
            ) {
                const available = await giftAvailability(config, api);
                return {
                    status: gift?.state ?? "idle",
                    enabled: available.enabled,
                };
            }
            if (action === "gift-status" && gift?.state === "ready") {
                return gift?.state === "ready"
                    ? {
                          status: "ready",
                          presentOrderId: gift.presentOrderId,
                          openid,
                      }
                    : { status: gift?.state ?? "idle" };
            }
            if (!gift || !["creating", "ready"].includes(gift.state)) {
                if (!config) return { status: "unconfigured", enabled: false };
                // Resolve before reserving fragments; a failed lookup must not spend them.
                const available = await giftAvailability(config, api);
                if (!available.enabled)
                    return { status: "disabled", enabled: false };
                const sku = available.sku;
                const id = "gift-" + randomUUID();
                const day = dayAt(now());
                gift = await transaction(async (records) => {
                    const doc = records.doc(walletId);
                    ({ data: wallet } = await doc.get());
                    if (wallet[activeKey]) {
                        const { data: existing } = await records
                            .doc(wallet[activeKey])
                            .get();
                        if (["creating", "ready"].includes(existing.state))
                            return existing;
                    }
                    const counts = wallet.giftCounts ?? {
                        [countKey]: 0,
                        total: 0,
                        day: "",
                        daily: 0,
                    };
                    if ((counts[countKey] ?? 0) >= 3 || counts.total >= 6)
                        return { status: "limit" };
                    if (wallet.balances[animal] < config.cost)
                        return { status: "insufficient", cost: config.cost };
                    const balances = wallet.balances.slice();
                    balances[animal] -= config.cost;
                    const record = {
                        id,
                        state: "creating",
                        day,
                        cost: config.cost,
                        order: {
                            activity_id: config.activity_id,
                            shop_appid: config.shop_appid,
                            product_id: config.product_id,
                            sku_id: sku,
                            wishmessage: `恭喜兑换${animalName}！`,
                        },
                    };
                    await records.doc(id).set({ data: record });
                    await doc.update({
                        data: {
                            balances,
                            [activeKey]: id,
                            giftCounts: {
                                ...counts,
                                [countKey]: (counts[countKey] ?? 0) + 1,
                                total: counts.total + 1,
                                day,
                                daily:
                                    (counts.day === day ? counts.daily : 0) + 1,
                            },
                        },
                    });
                    return record;
                });
            }
            if (gift.status) return gift;
            if (gift.state === "creating") {
                const result = await api.create({
                    ...gift.order,
                    openid,
                    idempotent_id: gift.id,
                });
                if (result.errcode !== 0) {
                    if (!rejectedCodes.has(result.errcode))
                        return { status: "pending" };
                    return transaction(async (records) => {
                        const { data: latest } = await records
                            .doc(gift.id)
                            .get();
                        if (latest.state === "creating") {
                            await release(
                                records,
                                walletId,
                                latest,
                                "rejected",
                            );
                            return { status: "rejected" };
                        }
                        return { status: "pending" };
                    });
                }
                if (
                    typeof result.present_order_id !== "string" ||
                    !/^42\d+$/.test(result.present_order_id)
                ) {
                    return { status: "pending" };
                }
                gift = await transaction(async (records) => {
                    const { data: latest } = await records.doc(gift.id).get();
                    if (latest.state !== "creating") return latest;
                    const update = {
                        state: "ready",
                        presentOrderId: result.present_order_id,
                    };
                    await records.doc(gift.id).update({ data: update });
                    return { ...latest, ...update };
                });
            }
            return gift.state === "ready"
                ? {
                      status: "ready",
                      presentOrderId: gift.presentOrderId,
                      openid,
                  }
                : { status: gift.state };
        } catch {
            // Do not expose API URLs, tokens, recipient identity or upstream errors.
            return { status: "pending" };
        }
    };
}

module.exports = { createGiftHandler };
