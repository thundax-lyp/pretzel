import {
    LabelOutline,
    Node,
    SubContextView,
    UITransform,
    Vec3,
    type EventTouch,
} from "cc";
import {
    hasOpenDataContext,
    postRankMessage,
    postRankingPointer,
} from "../services/wechat-platform";
import type { ZooArtwork } from "../services/artwork";
import { leaderboardScale } from "./leaderboard-layout";
import { syncLifetimeRank } from "../services/leaderboard";
import { color, label, uiNode } from "./nodes";
import type { Control, ScreenControls } from "./screen-controls";

let rankingRequest = 0;

function styleRankingButton(
    control: Control,
    size: number,
    selected = false,
): void {
    control.graphic.clear();
    control
        .icon!.node.getComponent(UITransform)!
        .setContentSize(control.width, control.height);
    control.icon!.node.setPosition(0, 0);
    control.caption.node.setPosition(0, 0);
    control.caption.node.setSiblingIndex(
        control.caption.node.parent!.children.length - 1,
    );
    control.caption.fontSize = size;
    control.caption.lineHeight = Math.ceil(size * 1.2);
    control.caption.color = color(selected ? "#FFF4C4" : "#71431F");
    control.caption.node.getComponent(LabelOutline)!.width = selected ? 2 : 0;
}

export function showRankingList(
    parent: Node,
    controls: ScreenControls,
    preview = false,
    history = false,
    art?: ZooArtwork,
): void {
    const version = ++rankingRequest;
    const height = preview ? 434 : 1440;
    const width = preview ? 550 : 682;
    const list = uiNode(parent, "WeeklyLeaderboard", width, height);
    list.setPosition(0, preview ? -2 : 0);
    list.setSiblingIndex(0);
    let historySync: Promise<void> | undefined;
    let refreshing = false;
    const sync = () => {
        historySync ??= syncLifetimeRank().finally(() => {
            historySync = undefined;
        });
        return historySync;
    };
    const syncOnEntry = () => {
        if (preview || !art) return;
        void sync().catch(() => {
            if (!refreshing && version === rankingRequest && list.isValid)
                postRankMessage("history-error");
        });
    };
    if (hasOpenDataContext()) {
        list.active = false;
        const subContext = list.addComponent(SubContextView);
        subContext.designResolutionSize.set(width, height);
        subContext.fps = 12;
        list.active = true;
        if (!preview) {
            let distance = 0;
            let dragged = 0;
            list.on(Node.EventType.TOUCH_START, () => {
                distance = 0;
                dragged = 0;
            });
            list.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
                const delta = event.getUIDelta().y;
                dragged += Math.abs(delta);
                distance += delta;
                const rows = Math.trunc(distance / 96);
                if (!rows) return;
                distance -= rows * 96;
                postRankMessage("scroll-rank", rows);
            });
            list.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                if (dragged > 8) return;
                const point = event.getUILocation();
                const local = list
                    .getComponent(UITransform)!
                    .convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
                postRankingPointer(local.x + width / 2, height / 2 - local.y);
                // Tabs are hit-tested inside the open-data domain. Recheck the
                // total on taps without reading friend data back into main.
                syncOnEntry();
            });
        }
    }
    if (hasOpenDataContext()) {
        const load = () => {
            if (preview || !art) {
                postRankMessage(preview ? "show-preview" : "show-week");
                return;
            }
            if (refreshing) return;
            refreshing = true;
            postRankMessage("loading-rank");
            void sync()
                .then(() => {
                    if (version === rankingRequest && list.isValid)
                        postRankMessage("refresh-rank");
                })
                .catch(() => {
                    if (version === rankingRequest && list.isValid)
                        postRankMessage("rank-error");
                })
                .finally(() => {
                    refreshing = false;
                });
        };
        if (!preview) {
            const refresh = controls.button(
                "刷新",
                157,
                -250,
                240,
                load,
                parent,
                76,
                art?.home.rankingButtons[1],
            );
            if (art) styleRankingButton(refresh, 30);
        }
        if (!preview) {
            postRankMessage(history ? "show-history" : "show-week");
            syncOnEntry();
        } else load();
    } else {
        label(list, "请在微信小游戏内查看好友榜单", 27, "#56351C");
    }
}

export function showLeaderboardCard(
    overlay: Node,
    controls: ScreenControls,
    art: ZooArtwork,
    screenSize: { width: number; height: number },
    history: boolean,
    back: () => void,
): void {
    const card = uiNode(overlay, "LeaderboardCard", 682, 1440);
    const scale = leaderboardScale(screenSize, 682, 720);
    card.setScale(scale, scale, 1);
    card.setPosition(0, -80 * scale);
    const close = controls.button(
        "返回",
        -157,
        -250,
        240,
        back,
        card,
        76,
        art.home.rankingButtons[1],
    );
    styleRankingButton(close, 30);
    showRankingList(card, controls, false, history, art);
}

export function fitLeaderboardCard(
    card: Node,
    screenSize: { width: number; height: number },
): void {
    const scale = leaderboardScale(screenSize, 682, 720);
    card.setScale(scale, scale, 1);
    card.setPosition(0, -80 * scale);
}
