import {
    LabelOutline,
    Node,
    SubContextView,
    UITransform,
    type EventTouch,
} from "cc";
import {
    hasOpenDataContext,
    postRankMessage,
} from "../services/wechat-platform";
import { leaderboardScale } from "./leaderboard-layout";
import { color, label, uiNode } from "./nodes";
import type { ScreenControls } from "./screen-controls";

export function showWeekRanking(
    parent: Node,
    controls: ScreenControls,
    preview = false,
): void {
    const height = preview ? 226 : 1064;
    const width = preview ? 550 : parent.getComponent(UITransform)!.width - 42;
    const list = uiNode(parent, "WeeklyLeaderboard", width, height);
    list.setPosition(0, preview ? 12 : -13);
    if (hasOpenDataContext()) {
        list.active = false;
        const subContext = list.addComponent(SubContextView);
        subContext.designResolutionSize.set(width, height);
        subContext.fps = 12;
        list.active = true;
        if (!preview) {
            const rowDragDistance = Math.round(height * 0.105);
            let distance = 0;
            list.on(Node.EventType.TOUCH_START, () => {
                distance = 0;
            });
            list.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
                distance += event.getUIDelta().y;
                const rows = Math.trunc(distance / rowDragDistance);
                if (!rows) return;
                distance -= rows * rowDragDistance;
                postRankMessage("scroll-week", rows);
            });
        }
        const refresh = controls.button(
            "刷新",
            preview ? -230 : 233,
            preview ? -145 : -586,
            98,
            () => postRankMessage(preview ? "show-preview" : "show-week"),
            parent,
            48,
        );
        refresh.graphic.clear();
        refresh.caption.fontSize = 23;
        refresh.caption.color = color("#56351C");
        refresh.caption.node.getComponent(LabelOutline)!.width = 0;
        postRankMessage(preview ? "show-preview" : "show-week");
    } else {
        label(list, "请在微信小游戏内查看好友周榜", 27, "#56351C");
    }
}

export function showLeaderboardCard(
    overlay: Node,
    controls: ScreenControls,
    screenSize: { width: number; height: number },
    history: boolean,
    selectHistory: (history: boolean) => void,
    back: () => void,
): void {
    const card = controls.panel(
        overlay,
        "LeaderboardCard",
        0,
        682,
        1312,
        "#FFF1D4",
        "#8F552B",
    );
    controls.heading(card, "好友排行榜", 654, "#A66532", "#63381D", "small");
    fitLeaderboardCard(card, screenSize);
    const week = controls.button(
        "本周榜",
        -117,
        569,
        226,
        () => selectHistory(false),
        card,
        58,
    );
    const previous = controls.button(
        "历史榜",
        117,
        569,
        226,
        () => selectHistory(true),
        card,
        58,
    );
    controls.paintButton(week, !history, true, "cream");
    controls.paintButton(previous, false, false, "cream");
    if (history) label(card, "历史榜暂未开放", 32, "#56351C");
    else showWeekRanking(card, controls);
    const close = controls.button("◀ 返回", 0, -586, 244, back, card, 72);
    controls.paintButton(close, true);
}

export function fitLeaderboardCard(
    card: Node,
    screenSize: { width: number; height: number },
): void {
    const bounds = card.getComponent(UITransform)!;
    const heading = card.getChildByName("Heading")!;
    const headingTop =
        heading.position.y + heading.getComponent(UITransform)!.height / 2;
    const scale = leaderboardScale(screenSize, bounds.width, headingTop);
    card.setScale(scale, scale, 1);
}
