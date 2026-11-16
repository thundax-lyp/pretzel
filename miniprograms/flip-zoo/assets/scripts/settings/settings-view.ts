import {
    Graphics,
    LabelOutline,
    Node,
    UITransform,
    Vec3,
    type EventTouch,
    type SpriteFrame,
} from "cc";
import type { ZooAudio, VolumeChannel } from "../services/zoo-audio";
import { drawButtonIcon } from "../ui/button-icon";
import {
    artworkButton,
    color,
    label,
    screenArtwork,
    uiNode,
} from "../ui/nodes";
import type { ScreenControls } from "../ui/screen-controls";

interface SettingsActions {
    version: string | undefined;
    contact(): void;
    feedback(): void;
    abandon(): void;
    privacy(): void;
    back(): void;
}

export class SettingsView {
    constructor(
        private readonly controls: ScreenControls,
        private readonly audio: ZooAudio,
        private readonly artwork: SpriteFrame,
    ) {}

    show(dialog: Node, fromWelcome: boolean, actions: SettingsActions): Node {
        if (!fromWelcome) return this.showGameSettings(dialog, actions);
        const version = actions.version?.trim();
        const footerExtra = version ? 36 : 0;
        const height = 480 + footerExtra;
        const settings = this.controls.panel(
            dialog,
            "SettingsCard",
            0,
            600,
            height,
            "#FFF1D4",
            "#8F552B",
        );
        this.controls.heading(
            settings,
            "设置",
            height / 2,
            "#995A2C",
            "#623619",
            "small",
        );
        const close = this.controls.button(
            "×",
            277,
            height / 2,
            65,
            actions.back,
            settings,
            65,
        );
        this.controls.paintButton(close, false, true, "cream");

        for (const [index, channel] of (["sfx", "music"] as const).entries()) {
            this.createVolumeRow(
                settings,
                channel,
                height / 2 - 115 - index * 75,
            );
        }

        const rows = [
            ["问题反馈", "feedback", "#258BD2", actions.feedback],
            ["联系客服", "support", "#258BD2", actions.contact],
        ] as const;
        const buttons = rows.map(([title, icon, fill, action], index) => {
            const button = this.controls.button(
                title,
                0,
                height / 2 - 262 - index * 86,
                320,
                action,
                settings,
            );
            this.controls.paintButton(button, false, true, "cream");
            button.caption.node.setPosition(18, 0);
            drawButtonIcon(button.graphic.node, icon, -105, 0, 39, fill);
            return button;
        });
        const privacy = this.controls.button(
            "儿童隐私保护声明及监护人须知",
            0,
            -height / 2 + 47 + footerExtra,
            455,
            actions.privacy,
            settings,
            50,
        );
        privacy.graphic.clear();
        privacy.caption.fontSize = 22;
        privacy.caption.color = color("#684824");
        privacy.caption.node.getComponent(LabelOutline)!.width = 0;
        if (version) {
            label(settings, `版本 ${version}`, 18, "#886849").node.setPosition(
                0,
                -height / 2 + 39,
            );
        }
        return buttons[0].node;
    }

    private showGameSettings(dialog: Node, actions: SettingsActions): Node {
        const artwork = screenArtwork(dialog, "SettingsArtwork", this.artwork);
        artworkButton(artwork, "关闭设置", 945, 545, 110, 110, actions.back);
        this.createVolumeRow(artwork, "sfx", 345, 170, 340, true);
        this.createVolumeRow(artwork, "music", 205, 170, 340, true);
        artworkButton(
            artwork,
            "联系客服",
            576,
            1151,
            474,
            132,
            actions.contact,
        );
        artworkButton(
            artwork,
            "放弃挑战",
            576,
            1317,
            474,
            132,
            actions.abandon,
        );
        artworkButton(
            artwork,
            "儿童隐私保护声明及监护人须知",
            576,
            1453,
            600,
            75,
            actions.privacy,
        );
        const version = actions.version?.trim();
        if (version) {
            label(artwork, `版本 ${version}`, 24, "#886849").node.setPosition(
                0,
                -480,
            );
        }
        return artworkButton(
            artwork,
            "问题反馈",
            576,
            990,
            474,
            132,
            actions.feedback,
        );
    }

    confirmAbandon(
        dialog: Node,
        onCancel: () => void,
        onAbandon: () => void,
    ): void {
        this.controls.panel(
            dialog,
            "AbandonCard",
            0,
            616,
            315,
            "#FFF9E0",
            "#859F73",
        );
        const title = label(dialog, "放弃挑战？", 42, "#56351C");
        title.isBold = true;
        title.node.setPosition(0, 91);
        label(dialog, "结束本局并返回首页", 25, "#684824").node.setPosition(
            0,
            19,
        );
        const abandon = this.controls.button(
            "是的",
            -136,
            -65,
            212,
            onAbandon,
            dialog,
            88,
        );
        this.controls.paintButton(abandon, false, true, "red");
        const resume = this.controls.button(
            "不是",
            136,
            -65,
            212,
            onCancel,
            dialog,
            88,
        );
        this.controls.paintButton(resume, false, true, "green");
    }

    private createVolumeRow(
        parent: Node,
        channel: VolumeChannel,
        y: number,
        x = 103,
        width = 260,
        onArtwork = false,
    ): void {
        const name = channel === "music" ? "音乐音量" : "音效音量";
        if (!onArtwork)
            label(parent, name, 28, "#56351C").node.setPosition(-166, y);
        const track = uiNode(parent, name, width + 40, 60);
        track.setPosition(x, y);
        const graphic = track.addComponent(Graphics);
        const draw = (volume: number) => {
            const fill = (width * volume) / 100;
            graphic.clear();
            const radius = onArtwork ? 20 : 9;
            if (onArtwork) {
                graphic.fillColor = color("#F3E2BC");
                graphic.roundRect(-width / 2 - 8, -37, width + 16, 74, 16);
                graphic.fill();
            }
            graphic.fillColor = color("#D3C4A6");
            graphic.roundRect(-width / 2, -radius, width, radius * 2, radius);
            graphic.fill();
            if (onArtwork) {
                graphic.strokeColor = color("#A48E6B");
                graphic.lineWidth = 2;
                graphic.stroke();
            }
            if (fill >= radius * 2) {
                graphic.fillColor = color("#80B94F");
                graphic.roundRect(
                    -width / 2,
                    -radius,
                    fill,
                    radius * 2,
                    radius,
                );
                graphic.fill();
            }
            graphic.fillColor = color("#FFF1D2");
            graphic.strokeColor = color("#8D713F");
            graphic.lineWidth = 3;
            graphic.circle(fill - width / 2, 0, onArtwork ? 26 : 15);
            graphic.fill();
            graphic.stroke();
            if (onArtwork) {
                const center = fill - width / 2;
                graphic.fillColor = color("#BC9562");
                graphic.ellipse(center, -5, 9, 8);
                for (const offset of [-12, -4, 4, 12]) {
                    graphic.ellipse(
                        center + offset,
                        9 - Math.abs(offset) / 3,
                        3.5,
                        5,
                    );
                }
                graphic.fill();
            }
        };
        const volumeAt = (event: EventTouch) => {
            const point = event.getUILocation();
            const { x } = track
                .getComponent(UITransform)!
                .convertToNodeSpaceAR(new Vec3(point.x, point.y));
            return Math.max(
                0,
                Math.min(100, Math.round((x / width + 0.5) * 100)),
            );
        };
        track.on(Node.EventType.TOUCH_START, (event: EventTouch) =>
            draw(volumeAt(event)),
        );
        track.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) =>
            draw(volumeAt(event)),
        );
        track.on(Node.EventType.TOUCH_CANCEL, () =>
            draw(this.audio.volume(channel)),
        );
        track.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            this.audio.setVolume(channel, volumeAt(event));
            draw(this.audio.volume(channel));
        });
        draw(this.audio.volume(channel));
    }
}
