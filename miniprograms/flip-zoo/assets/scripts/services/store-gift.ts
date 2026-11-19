export interface StoreGift {
    getOrderInfo(): Promise<{ orderStatus: unknown; wishMessage?: string }>;
    isSupported(): boolean;
    open(): Promise<unknown>;
}

export interface GiftPlatform {
    createStoreGift?: (options: {
        presentOrderId?: string;
        openid?: string;
    }) => StoreGift;
}

export type GiftResult = {
    status:
        | "idle"
        | "ready"
        | "claimed"
        | "expired"
        | "rejected"
        | "disabled"
        | "unconfigured"
        | "limit"
        | "daily-limit"
        | "insufficient"
        | "pending";
    enabled?: boolean;
    cost?: number;
    presentOrderId?: string;
    openid?: string;
};

export function supportsStoreGift(platform: GiftPlatform): boolean {
    try {
        return platform.createStoreGift?.({}).isSupported() === true;
    } catch {
        return false;
    }
}

export async function openStoreGift(
    platform: GiftPlatform,
    result: GiftResult,
): Promise<void> {
    if (
        result.status !== "ready" ||
        typeof result.presentOrderId !== "string" ||
        !/^42\d+$/.test(result.presentOrderId) ||
        typeof result.openid !== "string" ||
        !result.openid
    ) {
        throw new Error("Invalid gift order");
    }
    const gift = platform.createStoreGift?.({
        presentOrderId: result.presentOrderId,
        openid: result.openid,
    });
    if (!gift) throw new Error("Gift component unavailable");
    await gift.getOrderInfo();
    if (!gift.isSupported()) throw new Error("Gift component unavailable");
    await gift.open();
}

export function giftMessage(result: GiftResult): string {
    switch (result.status) {
        case "disabled":
            return "该动物兑换暂未开放";
        case "unconfigured":
            return "兑换配置尚未完成";
        case "insufficient":
            return `需要${result.cost ?? "更多"}个该动物碎片`;
        case "limit":
            return "已达到累计兑换上限";
        case "daily-limit":
            return "今天已兑换，请明天再来";
        case "rejected":
            return "兑换未成功，碎片已退回";
        case "expired":
            return "礼物已过期，碎片已退回";
        case "claimed":
            return "礼物已领取";
        default:
            return "订单确认中，请稍后重试；不会重复扣碎片";
    }
}

export function giftEnabled(result: GiftResult): boolean {
    return (
        result.enabled === true || ["ready", "pending"].includes(result.status)
    );
}
