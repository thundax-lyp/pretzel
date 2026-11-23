import { md5 } from "js-md5";
import { callCloud } from "./cloud-health";

export interface EntryOptions {
    query?: Record<string, unknown>;
}

type ShareEvent = {
    eventId: string;
    action: "share" | "open";
    time: number;
    channel: string | null;
    owner?: string;
};

declare const wx: {
    getStorageSync(key: string): unknown;
    setStorageSync(key: string, value: unknown): void;
    getEnterOptionsSync?: () => EntryOptions;
    getLaunchOptionsSync?: () => EntryOptions;
    onShow?: (handler: (options: EntryOptions) => void) => void;
    offShow?: (handler: (options: EntryOptions) => void) => void;
};

const storageKey = "flip-zoo-share-events";
const hex = /^[a-f0-9]{32}$/;
let owner: string | undefined;
let queue: ShareEvent[] | undefined;
let flushing = false;
let retry: ReturnType<typeof setTimeout> | undefined;
let onReady: (() => void) | undefined;
let running = false;

function events(): ShareEvent[] {
    if (queue) return queue;
    const stored = wx.getStorageSync(storageKey);
    if (!stored) return (queue = []);
    if (
        !Array.isArray(stored) ||
        stored.some(
            (event) =>
                !event ||
                !hex.test(event.eventId ?? "") ||
                !["share", "open"].includes(event.action) ||
                !Number.isSafeInteger(event.time) ||
                event.time < 0 ||
                (event.channel !== null && !hex.test(event.channel ?? "")) ||
                (event.owner !== undefined && typeof event.owner !== "string"),
        )
    )
        throw new Error("Invalid pending share events");
    return (queue = stored.filter(
        (event) => event.action === "share" || event.channel !== null,
    ));
}

function save(): void {
    wx.setStorageSync(storageKey, events());
}

function kick(): void {
    if (flushing) return;
    flushing = true;
    void (async () => {
        if (!owner) {
            const result = await callCloud<{ openid: string }>(
                "flipZooShares",
                { action: "identity" },
            );
            if (typeof result.openid !== "string" || !result.openid)
                throw new Error("Missing share identity");
            owner = result.openid;
            onReady?.();
        }
        let event: ShareEvent | undefined;
        while (
            (event = events().find(
                (value) => !value.owner || value.owner === owner,
            ))
        ) {
            event.owner = owner;
            if (event.action === "share")
                event.channel = md5(`${owner}:${event.time}:${event.eventId}`);
            save();
            const { status, channel } = await callCloud<{
                status: string;
                channel: string | null;
            }>("flipZooShares", {
                action: event.action,
                eventId: event.eventId,
                time: event.time,
                channel: event.channel,
            });
            if (status !== "recorded" || channel !== event.channel)
                throw new Error("Share event was not recorded");
            queue = events().filter(
                (value) => value.eventId !== event!.eventId,
            );
            save();
        }
    })()
        .catch(() => {
            console.warn("Share records pending; will retry");
            if (running && retry === undefined)
                retry = setTimeout(() => {
                    retry = undefined;
                    kick();
                }, 5000);
        })
        .finally(() => {
            flushing = false;
        });
}

function enqueue(
    action: ShareEvent["action"],
    channel: string | null = null,
): ShareEvent {
    const event: ShareEvent = {
        eventId: Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16),
        ).join(""),
        action,
        time: Date.now(),
        channel,
        ...(owner && { owner }),
    };
    if (action === "share" && owner)
        event.channel = md5(`${owner}:${event.time}:${event.eventId}`);
    events().push(event);
    save();
    kick();
    return event;
}

// Menu sharing must return its query synchronously. Persist the click before
// opening the picker; the server recomputes the MD5 using its trusted OPENID.
export function recordShareClick(): string {
    const event = enqueue("share");
    if (!event.channel) throw new Error("Share identity is not ready");
    return `share_channel=${event.channel}`;
}

export function startShareTracking(ready: () => void): () => void {
    onReady = ready;
    running = true;
    const opened = (options: EntryOptions = {}) => {
        const source = options.query?.share_channel;
        if (typeof source === "string" && hex.test(source))
            enqueue("open", source);
    };
    wx.onShow?.(opened);
    opened(wx.getEnterOptionsSync?.() ?? wx.getLaunchOptionsSync?.() ?? {});
    kick();
    if (owner) ready();
    return () => {
        wx.offShow?.(opened);
        running = false;
        onReady = undefined;
        if (retry !== undefined) clearTimeout(retry);
        retry = undefined;
    };
}
