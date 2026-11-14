import type { Node, SpriteFrame } from "cc";
import { artworkButton, screenArtwork } from "../ui/nodes";
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
    controls: ScreenControls,
    actions: WelcomeActions,
): Node {
    const artwork = screenArtwork(welcome, "WelcomeArtwork", frame);
    artworkButton(artwork, "开始游戏", 576, 1506, 705, 196, actions.play);
    artworkButton(artwork, "家园", 320, 1766, 190, 196, actions.home);
    artworkButton(artwork, "排行榜", 576, 1766, 190, 196, actions.leaderboard);
    artworkButton(artwork, "分享", 832, 1766, 190, 196, actions.share);
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
