import { Node, SubContextView, UITransform, Vec3, type EventTouch } from "cc";
import {
    hasOpenDataContext,
    postRankMessage,
    postRankingPointer,
} from "../services/wechat-platform";
import type { ZooArtwork } from "../services/artwork";
import {
    leaderboardFooterBottom,
    leaderboardScale,
} from "./leaderboard-layout";
import { syncLifetimeRank } from "../services/leaderboard";
import { Dialog } from "./dialog";
import { label, uiNode } from "./nodes";

let rankingRequest = 0;
const boardWidth = 682;
const boardHeight = 1440;

export function showRankingList(
    parent: Node,
    preview = false,
    history = false,
): (() => void) | undefined {
    const version = ++rankingRequest;
    const height = preview ? 434 : boardHeight;
    const width = preview ? 550 : boardWidth;
    const list = uiNode(parent, "WeeklyLeaderboard", width, height);
    list.setPosition(0, preview ? -2 : 0);
    list.setSiblingIndex(0);
    if (!hasOpenDataContext()) {
        label(list, "请在微信小游戏内查看好友榜单", 27, "#56351C");
        return;
    }
    list.active = false;
    const subContext = list.addComponent(SubContextView);
    subContext.designResolutionSize.set(width, height);
    subContext.fps = 12;
    list.active = true;
    if (preview) {
        postRankMessage("show-preview");
        return;
    }

    let historySync: Promise<void> | undefined;
    let refreshing = false;
    const sync = () => {
        historySync ??= syncLifetimeRank().finally(() => {
            historySync = undefined;
        });
        return historySync;
    };
    const current = () => version === rankingRequest && list.isValid;
    const syncOnEntry = () => {
        void sync().catch(() => {
            if (!refreshing && current()) postRankMessage("history-error");
        });
    };

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
        // The open-data domain owns tab hit-testing and friend data.
        syncOnEntry();
    });

    postRankMessage(history ? "show-history" : "show-week");
    syncOnEntry();
    return () => {
        if (refreshing) return;
        refreshing = true;
        postRankMessage("loading-rank");
        void sync()
            .then(() => {
                if (current()) postRankMessage("refresh-rank");
            })
            .catch(() => {
                if (current()) postRankMessage("rank-error");
            })
            .finally(() => {
                refreshing = false;
            });
    };
}

export class LeaderboardDialog extends Dialog {
    constructor(
        layer: Node,
        art: ZooArtwork,
        history: boolean,
        back: () => void,
    ) {
        let refresh: (() => void) | undefined;
        super(layer, {
            canvas: {
                height: boardHeight,
                actionBottom: leaderboardFooterBottom,
                centerY: -80,
                scale: (viewport) =>
                    leaderboardScale(viewport, boardWidth, boardHeight / 2),
            },
            content: (panel) => {
                refresh = showRankingList(panel, false, history);
            },
            actions: [
                { image: art.home.rankingButtons.back, onPress: back },
                ...(hasOpenDataContext()
                    ? [
                          {
                              image: art.home.rankingButtons.refresh,
                              onPress: () => refresh?.(),
                          },
                      ]
                    : []),
            ],
        });
    }
}
