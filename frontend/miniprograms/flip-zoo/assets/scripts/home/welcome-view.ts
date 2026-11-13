import type { Node } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { picture, titleLine } from "../ui/nodes";
import type { ScreenControls } from "../ui/screen-controls";

interface WelcomeActions {
    settings(): void;
    play(): void;
    home(): void;
    share(): void;
    leaderboard(): void;
}

export function showWelcome(
    welcome: Node,
    art: ZooArtwork,
    controls: ScreenControls,
    actions: WelcomeActions,
): void {
    controls.button("☰ 菜单", -295, 584, 110, actions.settings, welcome, 80);
    const title = art.title;
    const logo = picture(
        welcome,
        "FlipZooTitle",
        title,
        550,
        (550 * title.originalSize.height) / title.originalSize.width,
    );
    controls.place(logo.node, 0, 347);
    placeMascots(welcome, art, controls.place, 15, 530);

    const play = controls.button(
        "▶  开始游戏",
        0,
        -282,
        468,
        actions.play,
        welcome,
        130,
    );
    play.caption.fontSize = 49;
    play.caption.lineHeight = 62;
    controls.paintButton(play, true);
    const links = [
        ["家园", "⌂", actions.home],
        ["排行榜", "★", actions.leaderboard],
        ["分享", "↗", actions.share],
    ] as const;
    links.forEach(([name, symbol, action], index) => {
        const button = controls.button(
            name,
            (index - 1) * 165,
            -459,
            128,
            action,
            welcome,
            115,
        );
        button.caption.fontSize = 24;
        button.caption.node.setPosition(0, -31);
        const disabled = name === "家园";
        if (disabled) {
            controls.paintButton(button, false, false);
            button.graphic.node.pauseSystemEvents(true);
        }
        const icon = titleLine(
            button.graphic.node,
            symbol,
            16,
            58,
            disabled ? "#E0E7E7" : "#FFF1BD",
            disabled ? "#526D75" : "#174E76",
        );
        icon.lineHeight = 64;
    });
}

function placeMascots(
    parent: Node,
    art: ZooArtwork,
    place: ScreenControls["place"],
    y: number,
    width: number,
): void {
    const frame = art.mascots;
    const { height, width: sourceWidth } = frame.originalSize;
    const animals = picture(
        parent,
        "ZooAnimals",
        frame,
        width,
        (width * height) / sourceWidth,
    );
    place(animals.node, 0, y);
}
