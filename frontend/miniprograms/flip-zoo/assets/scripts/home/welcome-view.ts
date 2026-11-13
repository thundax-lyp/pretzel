import type { Node } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { drawButtonIcon } from "../ui/button-icon";
import { picture } from "../ui/nodes";
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
    const menu = controls.button(
        "菜单",
        -297,
        584,
        100,
        actions.settings,
        welcome,
        96,
    );
    menu.caption.fontSize = 23;
    menu.caption.node.setPosition(0, -25);
    drawButtonIcon(menu.graphic.node, "menu", 0, 15, 43, "#FFFFFF");

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
        -332,
        456,
        actions.play,
        welcome,
        124,
    );
    play.caption.fontSize = 49;
    play.caption.lineHeight = 62;
    controls.paintButton(play, true);
    const links = [
        ["家园", "home", actions.home],
        ["排行榜", "trophy", actions.leaderboard],
        ["分享", "share", actions.share],
    ] as const;
    links.forEach(([name, symbol, action], index) => {
        const button = controls.button(
            name,
            (index - 1) * 168,
            -527,
            120,
            action,
            welcome,
            124,
        );
        button.caption.fontSize = 24;
        button.caption.node.setPosition(0, -31);
        const disabled = name === "家园";
        if (disabled) {
            controls.paintButton(button, false, false);
            button.graphic.node.pauseSystemEvents(true);
        }
        drawButtonIcon(
            button.graphic.node,
            symbol,
            0,
            17,
            55,
            disabled ? "#E0E7E7" : symbol === "trophy" ? "#FFC84F" : "#FFFFFF",
        );
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
