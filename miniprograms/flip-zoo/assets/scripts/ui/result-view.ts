import { Label, LabelOutline, Node, UITransform } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { ButtonPress, scaleButton } from "./button-press";
import { showRankingList } from "./leaderboard-view";
import { color, label, picture, titleLine, uiNode } from "./nodes";
import type { ScreenControls } from "./screen-controls";

export function showResultCard(
    overlay: Node,
    art: ZooArtwork,
    controls: ScreenControls,
    viewport: { width: number; height: number },
    won: boolean,
    actions: {
        home: () => void;
        share: () => void;
        retry: () => void;
        revive: () => void;
        leaderboard: () => void;
    },
    feedback?: string,
): Node {
    const card = uiNode(overlay, "ResultCard", 682, 1300);
    fitResultCard(card, viewport);
    picture(
        card,
        "ResultFrame",
        art.home.settings[0],
        682,
        won ? 1040 : 1080,
    ).node.setPosition(0, won ? -60 : -80);

    const illustration = won ? art.winPanda : art.sadPanda;
    const panda = picture(
        card,
        "ResultPanda",
        illustration,
        (230 * illustration.originalSize.width) /
            illustration.originalSize.height,
        230,
    );
    panda.node.setPosition(0, 515);
    const heading = picture(
        card,
        "ResultHeading",
        art.home.settings[1],
        596,
        154,
    );
    heading.node.setPosition(0, 395);
    titleLine(
        heading.node,
        won ? "游戏胜利" : "失败啦",
        -4,
        76,
        "#FFEFAD",
        "#7B3D17",
    );
    if (won) {
        titleLine(card, "第二关通关！", 291, 35, "#71431F", "#FFF1D4");
    }

    const summary = picture(
        card,
        "ResultRanking",
        art.home.settings[0],
        608,
        572,
    ).node;
    summary.setPosition(0, won ? -37 : -10);
    const sign = picture(
        summary,
        "RankingHeading",
        art.home.settings[1],
        340,
        94,
    );
    sign.node.setPosition(0, 264);
    titleLine(sign.node, "好友本周榜", 0, 34, "#FFF9E0", "#63381D");
    showRankingList(summary, controls, true);
    const all = controls.button(
        "查看全部排行 ›",
        0,
        -246,
        350,
        actions.leaderboard,
        summary,
        55,
    );
    all.graphic.clear();
    all.caption.fontSize = 28;
    all.caption.color = color("#71431F");
    all.caption.node.getComponent(LabelOutline)!.width = 0;

    const button = (
        name: keyof ZooArtwork["resultButtons"],
        text: string,
        x: number,
        y: number,
        width: number,
        action: () => void,
    ) => {
        const frame = art.resultButtons[name];
        const height =
            (width * frame.originalSize.height) / frame.originalSize.width;
        const visual = picture(card, text, frame, width, height).node;
        visual.setPosition(x, y);
        const press = visual.addComponent(ButtonPress);
        press.action = action;
        press.showPressed = scaleButton(visual, 0.95);
    };
    if (won) {
        button("home-compact", "首页", -232, -449, 136, actions.home);
        button("share", "分享", -47, -449, 206, actions.share);
        button("challenge", "再次挑战", 185, -449, 230, actions.retry);
    } else {
        button("home", "首页", -155, -365, 286, actions.home);
        button("revive", "复活", 155, -365, 286, actions.revive);
        button("restart", "重新挑战", 0, -493, 600, actions.retry);
    }
    if (feedback) {
        const notice = label(card, feedback, 23, "#71431F");
        notice.node.name = "SettlementFeedback";
        notice.overflow = Label.Overflow.RESIZE_HEIGHT;
        notice.node.getComponent(UITransform)!.setContentSize(574, 70);
        notice.node.setPosition(0, -548);
    }
    return panda.node;
}

export function fitResultCard(
    card: Node,
    viewport: { width: number; height: number },
): void {
    const scale = Math.min(
        1,
        (viewport.width - 32) / 682,
        (viewport.height - 64) / 1300,
    );
    card.setScale(scale, scale, 1);
}
