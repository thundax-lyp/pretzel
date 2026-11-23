import { WECHAT } from "cc/env";
import { recordShareClick, startShareTracking } from "./share-tracking";
import { hasCloudEnvironment } from "./cloud-health";

type RankAction =
    | "show-week"
    | "show-history"
    | "show-preview"
    | "loading-history"
    | "history-error"
    | "sync-history"
    | "record-win"
    | "scroll-rank"
    | "loading-rank"
    | "rank-error"
    | "refresh-rank"
    | "rank-pointer";

interface ShareCard {
    title: string;
    imageUrlId?: string;
    imageUrl?: string;
    query?: string;
}

declare const GameGlobal: { flipZooShareCards?: ShareCard[] };
declare const wx: {
    getAccountInfoSync?: () => { miniProgram?: { version?: string } };
    shareAppMessage?: (card: ShareCard) => void;
    showShareMenu?: (options: { menus: string[] }) => void;
    hideShareMenu?: (options: { menus: string[] }) => void;
    onShareAppMessage?: (handler: () => ShareCard) => void;
    offShareAppMessage?: (handler: () => ShareCard) => void;
    onShow?: (handler: () => void) => void;
    offShow?: (handler: () => void) => void;
    showModal?: (options: {
        title: string;
        content: string;
        confirmText: string;
        cancelText: string;
        success: (result: { confirm: boolean }) => void;
    }) => void;
    setClipboardData?: (options: { data: string }) => void;
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
            action: RankAction;
            rows?: number;
            total?: number;
            x?: number;
            y?: number;
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

let stopShareTracking: (() => void) | undefined;

export function trackedShareCard(won: boolean): ShareCard {
    const card = shareCard(won);
    if (!hasCloudEnvironment()) return card;
    return {
        ...card,
        query: [card.query, recordShareClick()].filter(Boolean).join("&"),
    };
}

export function enableShareMenu(handler: () => ShareCard): void {
    if (!WECHAT) return;
    stopShareTracking?.();
    wx.hideShareMenu?.({ menus: ["shareAppMessage", "shareTimeline"] });
    const enable = () => {
        wx.onShareAppMessage?.(handler);
        wx.showShareMenu?.({ menus: ["shareAppMessage"] });
    };
    stopShareTracking = undefined;
    if (hasCloudEnvironment()) stopShareTracking = startShareTracking(enable);
    else enable();
}

export function disableShareMenu(handler: () => ShareCard): void {
    if (!WECHAT) return;
    stopShareTracking?.();
    stopShareTracking = undefined;
    wx.offShareAppMessage?.(handler);
}

export function openShare(won: boolean): "opened" | "unsupported" | "failed" {
    if (!WECHAT) return "unsupported";
    try {
        const card = trackedShareCard(won);
        if (!wx.shareAppMessage) return "unsupported";
        wx.shareAppMessage(card);
        return "opened";
    } catch {
        return "failed";
    }
}

// The share API has no completion result. The next foreground event is only
// a return signal, not proof that the player sent the card. Do not require
// onHide: a share panel can return without a background notification.
export function openRevivalShare(
    onReturn: () => void,
): (() => void) | undefined {
    if (!WECHAT || !wx.onShow || !wx.offShow) return undefined;
    let active = true;
    const cancel = () => {
        active = false;
        wx.offShow!(show);
    };
    const show = () => {
        if (!active) return;
        cancel();
        onReturn();
    };
    wx.onShow(show);
    if (openShare(false) !== "opened") {
        cancel();
        return undefined;
    }
    return cancel;
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

export function postRankingPointer(x: number, y: number): void {
    if (WECHAT)
        wx.getOpenDataContext?.().postMessage({ action: "rank-pointer", x, y });
}

export function postRankMessage(
    action: RankAction,
    rows?: number,
    total?: number,
): boolean {
    const context = WECHAT ? wx.getOpenDataContext?.() : undefined;
    if (!context) return false;
    context.postMessage({ action, rows, total });
    return true;
}

export function showGiftDiagnostic(content: string): void {
    if (!WECHAT) return;
    const data = `版本：${releaseVersion() ?? "开发版"}\n${content}`;
    wx.showModal?.({
        title: "兑换诊断",
        content: data,
        confirmText: "复制信息",
        cancelText: "关闭",
        success: ({ confirm }) => {
            if (confirm) wx.setClipboardData?.({ data });
        },
    });
}
