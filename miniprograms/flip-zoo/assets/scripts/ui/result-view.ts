import { Graphics, LabelOutline, Node, UITransform } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { Dialog } from "./dialog";
import { showRankingList } from "./leaderboard-view";
import { color, titleLine, uiNode } from "./nodes";
import type { ScreenControls } from "./screen-controls";

interface ResultActions {
    home: () => void;
    share: () => void;
    retry: () => void;
    revive: () => void;
    leaderboard: () => void;
}

export class RoundResultDialog extends Dialog {
    constructor(
        overlay: Node,
        art: ZooArtwork,
        controls: ScreenControls,
        won: boolean,
        actions: ResultActions,
        feedback?: string,
    ) {
        super(overlay, {
            frame: art.home.settings[0],
            titleBoard: art.home.settings[1],
            icon: won ? art.winPanda : art.sadPanda,
            titleImage: won ? art.victoryTitle : art.defeatTitle,
            content: (body, width) => {
                body.getComponent(UITransform)!.setContentSize(width, 540);
                showResultRanking(body, controls, actions.leaderboard);
            },
            actions: [
                {
                    image: art.resultButtons["home-compact"],
                    onPress: actions.home,
                },
                {
                    image: won
                        ? art.resultButtons.share
                        : art.resultButtons.revive,
                    onPress: won ? actions.share : actions.revive,
                },
                {
                    image: won
                        ? art.resultButtons.challenge
                        : art.resultButtons.restart,
                    onPress: actions.retry,
                },
            ],
            footerNote: feedback,
        });
    }

    get panda(): Node {
        return this.icon!;
    }
}

function showResultRanking(
    summary: Node,
    controls: ScreenControls,
    leaderboard: () => void,
): void {
    titleLine(summary, "好友本周榜", 253, 32, "#71431F", "#FFF1D4");
    const divider = uiNode(summary, "RankingDivider").addComponent(Graphics);
    divider.strokeColor = color("#D7BA81");
    divider.lineWidth = 2;
    for (const side of [-1, 1]) {
        divider.moveTo(side * 120, 253);
        divider.lineTo(side * 252, 253);
    }
    divider.stroke();
    showRankingList(summary, true);
    const all = controls.button(
        "查看全部排行 ›",
        0,
        -225,
        350,
        leaderboard,
        summary,
        55,
    );
    all.graphic.clear();
    all.caption.fontSize = 28;
    all.caption.color = color("#71431F");
    all.caption.node.getComponent(LabelOutline)!.width = 0;
}
