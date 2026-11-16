import {
    Graphics,
    Rect,
    Size,
    Node,
    UITransform,
    Vec3,
    type EventTouch,
    SpriteFrame,
} from "cc";
import type { ZooAudio, VolumeChannel } from "../services/zoo-audio";
import {
    artworkButton,
    color,
    label,
    picture,
    dialogArtwork,
    uiNode,
} from "../ui/nodes";
import type { ScreenControls } from "../ui/screen-controls";

interface SettingsActions {
    version: string | undefined;
    contact(): void;
    feedback(): void;
    abandon?(): void;
    privacy(): void;
    back(): void;
}

export class SettingsView {
    constructor(
        private readonly controls: ScreenControls,
        private readonly audio: ZooAudio,
        private readonly artwork: SpriteFrame,
    ) {}

    show(dialog: Node, actions: SettingsActions): Node {
        const footerShift = actions.abandon ? 0 : 160;
        const artwork = dialogArtwork(dialog, "SettingsArtwork", this.artwork, [
            [169, 521, 811, 1033 - footerShift, 58],
            [341, 452, 463, 154, 61],
            [891, 491, 113, 116, 31],
        ]);
        artworkButton(artwork, "关闭设置", 945, 545, 110, 110, actions.back);
        this.createVolumeRow(artwork, "sfx", 345);
        this.createVolumeRow(artwork, "music", 205);
        artworkButton(
            artwork,
            "联系客服",
            576,
            1151,
            474,
            132,
            actions.contact,
        );
        if (actions.abandon) {
            artworkButton(
                artwork,
                "放弃挑战",
                576,
                1317,
                474,
                132,
                actions.abandon,
            );
        } else {
            this.raiseFooterArtwork(artwork, footerShift);
        }
        artworkButton(
            artwork,
            "儿童隐私保护声明及监护人须知",
            576,
            1453 - footerShift,
            600,
            75,
            actions.privacy,
        );
        const version = actions.version?.trim();
        if (version) {
            label(artwork, `版本 ${version}`, 24, "#886849").node.setPosition(
                0,
                -480 + footerShift,
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

    private raiseFooterArtwork(artwork: Node, shift: number): void {
        // Reuse the illustrated footer and frame below the baked challenge row.
        const texture = this.artwork.texture;
        const top = 1400;
        const height = 156;
        const frame = new SpriteFrame();
        const rect = new Rect(
            0,
            (top / 2048) * texture.height,
            texture.width,
            (height / 2048) * texture.height,
        );
        frame.reset({
            texture,
            rect,
            originalSize: new Size(rect.width, rect.height),
        });
        frame.packable = false;
        const footer = picture(
            artwork,
            "HomeSettingsFooter",
            frame,
            1152,
            height,
        ).node;
        footer.setPosition(0, 1024 - top - height / 2 + shift);
        footer.once(Node.EventType.NODE_DESTROYED, () => frame.destroy());
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
    ): void {
        const name = channel === "music" ? "音乐音量" : "音效音量";
        const width = 340;
        const track = uiNode(parent, name, width + 40, 60);
        track.setPosition(170, y);
        const graphic = track.addComponent(Graphics);
        const draw = (volume: number) => {
            const fill = (width * volume) / 100;
            graphic.clear();
            const radius = 20;
            graphic.fillColor = color("#F3E2BC");
            graphic.roundRect(-width / 2 - 8, -37, width + 16, 74, 16);
            graphic.fill();
            graphic.fillColor = color("#D3C4A6");
            graphic.roundRect(-width / 2, -radius, width, radius * 2, radius);
            graphic.fill();
            graphic.strokeColor = color("#A48E6B");
            graphic.lineWidth = 2;
            graphic.stroke();
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
            graphic.circle(fill - width / 2, 0, 26);
            graphic.fill();
            graphic.stroke();
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
