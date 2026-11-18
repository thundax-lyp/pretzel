import { WECHAT } from "cc/env";

interface ShareCard {
    title: string;
    imageUrlId?: string;
    imageUrl?: string;
}

declare const GameGlobal: { flipZooShareCards?: ShareCard[] };
declare const wx: {
    getAccountInfoSync?: () => { miniProgram?: { version?: string } };
    shareAppMessage?: (card: ShareCard) => void;
    showShareMenu?: (options: { menus: string[] }) => void;
    onShareAppMessage?: (handler: () => ShareCard) => void;
    offShareAppMessage?: (handler: () => ShareCard) => void;
    showToast?: (options: { title: string; icon: "none" }) => void;
    openCustomerServiceConversation?: (options: { fail: () => void }) => void;
    getWindowInfo?: () => {
        windowWidth: number;
        windowHeight: number;
        safeArea?: { top: number; bottom: number };
    };
    getMenuButtonBoundingClientRect?: () => { top?: number; bottom: number };
    createFeedbackButton?: (options: {
        type: "text";
        text: string;
        style: {
            left: number;
            top: number;
            width: number;
            height: number;
            backgroundColor: string;
            color: string;
        };
    }) => { show(): void; destroy(): void; onTap?(callback: () => void): void };
    getOpenDataContext?: () => {
        postMessage(data: {
            action: "show-week" | "show-preview" | "record-win" | "scroll-week";
            rows?: number;
        }): void;
    };
};

export function shareCard(won: boolean): ShareCard {
    const cards = GameGlobal.flipZooShareCards;
    return cards?.[won ? 1 : 0] ?? { title: "两只眼睛几条腿" };
}

export function releaseVersion(): string | undefined {
    if (!WECHAT) return undefined;
    try {
        return (
            wx.getAccountInfoSync?.()?.miniProgram?.version?.trim() || undefined
        );
    } catch {
        return undefined;
    }
}

export function enableShareMenu(handler: () => ShareCard): void {
    if (!WECHAT) return;
    wx.onShareAppMessage?.(handler);
    wx.showShareMenu?.({ menus: ["shareAppMessage"] });
}

export function disableShareMenu(handler: () => ShareCard): void {
    if (WECHAT) wx.offShareAppMessage?.(handler);
}

export function openShare(won: boolean): "opened" | "unsupported" | "failed" {
    if (!WECHAT || !wx.shareAppMessage) return "unsupported";
    try {
        wx.shareAppMessage(shareCard(won));
        return "opened";
    } catch {
        return "failed";
    }
}

export function openCustomerService(onFailure: () => void): boolean {
    if (!WECHAT || !wx.openCustomerServiceConversation) return false;
    wx.openCustomerServiceConversation({ fail: onFailure });
    return true;
}

export function showToast(message: string): void {
    if (WECHAT) wx.showToast?.({ title: message, icon: "none" });
}

export function windowInfo() {
    return WECHAT ? wx.getWindowInfo?.() : undefined;
}

export function menuButtonRect() {
    return WECHAT ? wx.getMenuButtonBoundingClientRect?.() : undefined;
}

export function supportsFeedback(): boolean {
    return WECHAT && !!wx.createFeedbackButton;
}

export function createFeedbackButton(
    bounds: { left: number; top: number; width: number; height: number },
    onTap: () => void,
): { destroy(): void } | undefined {
    if (!WECHAT) return undefined;
    let button;
    try {
        button = wx.createFeedbackButton?.({
            type: "text",
            text: "",
            style: {
                ...bounds,
                backgroundColor: "rgba(0,0,0,0)",
                color: "#FFFFFF",
            },
        });
        button?.onTap?.(onTap);
        button?.show();
        return button;
    } catch {
        button?.destroy();
        return undefined;
    }
}

export function hasOpenDataContext(): boolean {
    return WECHAT && !!wx.getOpenDataContext?.();
}

export function postRankMessage(
    action: "show-week" | "show-preview" | "record-win" | "scroll-week",
    rows?: number,
): boolean {
    const context = WECHAT ? wx.getOpenDataContext?.() : undefined;
    if (!context) return false;
    context.postMessage({ action, rows });
    return true;
}
