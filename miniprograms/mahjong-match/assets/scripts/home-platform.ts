import { sys, view, type Rect } from "cc";
const WECHAT = typeof wx !== "undefined";

type Stats = { week: number; weekly: number; total: number };
const statsKey = "mahjong-match.clear-stats";
const weekLength = 7 * 24 * 60 * 60 * 1000;
const firstMonday = Date.UTC(1970, 0, 5) - 8 * 60 * 60 * 1000;

type FeedbackButton = { show(): void; destroy(): void };
declare const wx: {
    authorize?: (options: {
        scope: string;
        success: () => void;
        fail: () => void;
    }) => void;
    getMenuButtonBoundingClientRect?: () => { bottom: number };
    getWindowInfo?: () => { windowWidth: number; windowHeight: number };
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
    }) => FeedbackButton;
    openCustomerServiceConversation?: (options: { fail: () => void }) => void;
    openPrivacyContract?: (options: { fail: () => void }) => void;
    shareAppMessage?: (options: { title: string }) => void;
    getOpenDataContext?: () => { postMessage: (message: object) => void };
    setUserCloudStorage?: (options: {
        KVDataList: Array<{ key: string; value: string }>;
        success: () => void;
        fail: () => void;
    }) => void;
};

export function wechatMenuBottomRatio(): number {
    if (!WECHAT) return 0;
    const height = wx.getWindowInfo?.()?.windowHeight;
    const bottom = wx.getMenuButtonBoundingClientRect?.()?.bottom;
    return height && bottom && bottom > 0 && bottom < height
        ? bottom / height
        : 0;
}

export function clearStats(): Stats {
    const week = Math.floor((Date.now() - firstMonday) / weekLength);
    try {
        const saved = JSON.parse(sys.localStorage.getItem(statsKey) ?? "{}");
        const count = (value: number) =>
            Number.isSafeInteger(value) && value >= 0 ? value : 0;
        return {
            week,
            weekly: saved.week === week ? count(saved.weekly) : 0,
            total: count(saved.total),
        };
    } catch {
        return { week, weekly: 0, total: 0 };
    }
}

export function recordClear(): void {
    const stats = clearStats();
    stats.weekly++;
    stats.total++;
    sys.localStorage.setItem(statsKey, JSON.stringify(stats));
    void syncRank();
}

let pendingRank: Promise<void> = Promise.resolve();

export function syncRank(): Promise<void> {
    const write = WECHAT ? wx.setUserCloudStorage : undefined;
    if (!write) return pendingRank;
    pendingRank = pendingRank.then(() => {
        const { week, weekly, total } = clearStats();
        if (!total) return;
        return new Promise<void>((resolve) => {
            try {
                write.call(wx, {
                    KVDataList: [
                        {
                            key: "mahjong_weekly",
                            value: JSON.stringify({ week, score: weekly }),
                        },
                        {
                            key: "mahjong_total",
                            value: JSON.stringify({ score: total }),
                        },
                    ],
                    success: resolve,
                    fail: resolve,
                });
            } catch {
                resolve();
            }
        });
    });
    return pendingRank;
}

export function authorizeFriendRank(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!WECHAT || !wx.authorize) {
            resolve(false);
            return;
        }
        try {
            wx.authorize({
                scope: "scope.WxFriendInteraction",
                success: () => resolve(true),
                fail: () => resolve(false),
            });
        } catch {
            resolve(false);
        }
    });
}

export function rankContext() {
    return WECHAT ? wx.getOpenDataContext?.() : undefined;
}

export function shareGame(): string | undefined {
    if (!WECHAT || !wx.shareAppMessage) return "请在微信小游戏中分享";
    try {
        wx.shareAppMessage({ title: "麻将消消乐 · 来挑战清台" });
        return undefined;
    } catch {
        return "暂时无法打开分享，请重试";
    }
}

export function openService(
    service: "contact" | "privacy",
    notice: (message: string) => void,
): void {
    const api = WECHAT
        ? {
              contact: wx.openCustomerServiceConversation,
              privacy: wx.openPrivacyContract,
          }[service]
        : undefined;
    if (!api) {
        notice("请在微信小游戏内使用此功能");
        return;
    }
    try {
        api.call(wx, { fail: () => notice("当前无法打开，请稍后重试") });
    } catch {
        notice("当前无法打开，请稍后重试");
    }
}

export function attachFeedbackButton(rect: Rect): FeedbackButton | undefined {
    const window = WECHAT ? wx.getWindowInfo?.() : undefined;
    if (!window) return undefined;
    const visible = view.getVisibleSize();
    const scaleX = window.windowWidth / visible.width;
    const scaleY = window.windowHeight / visible.height;
    let button: FeedbackButton | undefined;
    try {
        button = wx.createFeedbackButton?.({
            type: "text",
            text: "",
            style: {
                left: rect.x * scaleX,
                top: window.windowHeight - (rect.y + rect.height) * scaleY,
                width: rect.width * scaleX,
                height: rect.height * scaleY,
                backgroundColor: "rgba(0,0,0,0)",
                color: "#ffffff",
            },
        });
        button?.show();
        return button;
    } catch {
        button?.destroy();
        return undefined;
    }
}
