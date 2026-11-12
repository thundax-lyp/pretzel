import type { Node } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { picture } from "../ui/nodes";
import type { ScreenControls } from "../ui/screen-controls";

interface WelcomeActions {
    settings(): void;
    play(): void;
    share?: () => void;
    leaderboard?: () => void;
}

export function showWelcome(
    welcome: Node,
    art: ZooArtwork,
    controls: ScreenControls,
    actions: WelcomeActions,
): void {
    controls.button("⚙", -300, 584, 84, actions.settings, welcome, 84);
    const title = art.title;
    const { width, height } = title.originalSize;
    const logo = picture(
        welcome,
        "FlipZooTitle",
        title,
        554,
        (554 * height) / width,
    );
    controls.place(logo.node, 0, 350);
    placeMascots(welcome, art, controls.place, -24, 604);

    const play = controls.button(
        "▶  开始游戏",
        0,
        -282,
        544,
        actions.play,
        welcome,
        138,
    );
    play.caption.fontSize = 49;
    play.caption.lineHeight = 62;
    controls.paintButton(play, true);
    if (actions.share && actions.leaderboard) {
        controls.button("分享游戏", -148, -422, 264, actions.share, welcome);
        controls.button("排行榜", 148, -422, 264, actions.leaderboard, welcome);
    }
}

export function placeMascots(
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
