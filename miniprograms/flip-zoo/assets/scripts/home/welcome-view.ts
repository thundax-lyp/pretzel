import type { Node, SpriteFrame } from "cc";
import { color, picture, screenArtwork, uiNode } from "../ui/nodes";
import { ButtonPress, scaleButton } from "../ui/button-press";
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
    frame: SpriteFrame,
    buttons: readonly SpriteFrame[],
    controls: ScreenControls,
    actions: WelcomeActions,
): Node {
    const artwork = screenArtwork(welcome, "WelcomeArtwork", frame);
    for (const [index, name, x, y, width, height, action] of [
        [0, "开始游戏", 576, 1506, 705, 206, actions.play],
        [1, "家园", 320, 1766, 196, 208, actions.home],
        [2, "排行榜", 576, 1766, 196, 208, actions.leaderboard],
        [3, "分享", 832, 1766, 196, 208, actions.share],
    ] as const) {
        const button = uiNode(artwork, name, width, height);
        button.setPosition(x - 576, 1024 - y);
        const image = picture(
            button,
            "ButtonImage",
            buttons[index],
            width,
            height,
        );
        const press = button.addComponent(ButtonPress);
        const scale = scaleButton(image.node, 0.96);
        press.action = action;
        press.showPressed = (pressed) => {
            if (!image.isValid) return;
            image.color = color(pressed ? "#D8D8D8" : "#FFFFFF");
            scale(pressed);
        };
    }
    const menu = controls.button(
        "菜单",
        -297,
        584,
        100,
        actions.settings,
        welcome,
        76,
    );
    menu.caption.fontSize = 25;
    return artwork;
}
