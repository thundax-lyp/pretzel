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
    onStage: (stage: string) => void = () => {},
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
    onStage("createStoreGift");
    const gift = platform.createStoreGift?.({
        presentOrderId: result.presentOrderId,
        openid: result.openid,
    });
    if (!gift) throw new Error("Gift component unavailable");
    onStage("getOrderInfo");
    await gift.getOrderInfo();
    onStage("isSupported");
    if (!gift.isSupported()) throw new Error("Gift component unavailable");
    onStage("open");
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

export function giftDiagnostic(
    stage: string,
    status: string,
    error?: unknown,
): string {
    const value = error as
        | {
              errCode?: unknown;
              code?: unknown;
              errMsg?: unknown;
              message?: unknown;
          }
        | undefined;
    const sanitize = (input: unknown) =>
        String(input ?? "-")
            .replace(/https?:\/\/[^\s]+/gi, "[URL]")
            .replace(/[A-Za-z0-9_-]{16,}/g, "[已脱敏]")
            .replace(/\d{12,}/g, "[已脱敏]")
            .slice(0, 350);
    return [
        "诊断标记：gift-debug-1",
        `时间：${new Date().toISOString()}`,
        `阶段：${stage}`,
        `状态：${status}`,
        `错误码：${sanitize(value?.errCode ?? value?.code)}`,
        `错误：${sanitize(value?.errMsg ?? value?.message ?? error)}`,
    ].join("\n");
}
