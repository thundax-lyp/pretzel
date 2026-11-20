import {
    Graphics,
    Node,
    Sprite,
    UITransform,
    Vec3,
    type EventTouch,
    type SpriteFrame,
} from "cc";
import type { ZooAudio, VolumeChannel } from "../services/zoo-audio";
import { color, label, picture, uiNode } from "../ui/nodes";
import { ButtonPress, scaleButton } from "../ui/button-press";

interface SettingsActions {
    version: string | undefined;
    contact(): void;
    feedback(): void;
    privacy(): void;
    abandon?(): void;
    back(): void;
}

export class SettingsView {
    constructor(
        private readonly audio: ZooAudio,
        private readonly sprites: readonly SpriteFrame[],
    ) {}

    show(dialog: Node, actions: SettingsActions): Node {
        const footerShift = actions.abandon ? 0 : 160;
        const artwork = uiNode(dialog, "SettingsArtwork", 1152, 2048);
        picture(
            artwork,
            "SettingsPanel",
            this.sprites[0],
            850,
            1150 - footerShift,
        ).node.setPosition(0, -14 + footerShift / 2);
        this.dialogTitle(artwork, "设置", 495, actions.back);
        for (const [index, text, y] of [
            [7, "音效高低", 345],
            [8, "音乐高低", 205],
        ] as const) {
            picture(
                artwork,
                text + "图标",
                this.sprites[index],
                85,
                85,
            ).node.setPosition(-291, y);
            const caption = label(artwork, text, 42, "#56351C");
            caption.isBold = true;
            caption.node.setPosition(-130, y);
        }
        this.createVolumeRow(artwork, "sfx", 345);
        this.createVolumeRow(artwork, "music", 205);
        const feedback = this.rowButton(
            artwork,
            "问题反馈",
            34,
            4,
            actions.feedback,
        );
        this.rowButton(artwork, "联系客服", -127, 5, actions.contact);
        if (actions.abandon) {
            this.rowButton(artwork, "放弃挑战", -293, 6, actions.abandon);
        }
        const privacy = label(
            artwork,
            "儿童隐私保护声明及监护人须知",
            30,
            "#386B8F",
        );
        privacy.node.name = "ChildPrivacyLink";
        privacy.isUnderline = true;
        privacy.node.setPosition(0, -429 + footerShift);
        privacy.node.getComponent(UITransform)!.setContentSize(680, 75);
        const press = privacy.node.addComponent(ButtonPress);
        const scale = scaleButton(privacy.node, 0.98);
        press.action = actions.privacy;
        press.showPressed = (pressed) => {
            if (!privacy.isValid) return;
            privacy.color = color(pressed ? "#20425B" : "#386B8F");
            scale(pressed);
        };
        const version = actions.version?.trim();
        if (version) {
            label(artwork, "版本 " + version, 24, "#886849").node.setPosition(
                0,
                -480 + footerShift,
            );
        }
        return feedback;
    }

    private dialogTitle(
        parent: Node,
        text: string,
        y: number,
        onClose: () => void,
    ): void {
        const sign = picture(parent, "DialogTitle", this.sprites[1], 490, 188);
        sign.node.setPosition(0, y);
        const caption = label(sign.node, text, 52, "#FFFFFF");
        caption.isBold = true;
        caption.node.getComponent(UITransform)!.setContentSize(360, 90);
        this.imageButton(
            parent,
            "关闭对话框",
            369,
            y - 16,
            110,
            110,
            3,
            onClose,
        );
    }

    private imageButton(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        index: number,
        action: () => void,
    ): Node {
        const sprite = picture(
            parent,
            name,
            this.sprites[index],
            width,
            height,
        );
        sprite.node.setPosition(x, y);
        const press = sprite.node.addComponent(ButtonPress);
        const scale = scaleButton(sprite.node, 0.96);
        press.action = action;
        press.showPressed = (pressed) => {
            if (!sprite.isValid) return;
            sprite.color = color(pressed ? "#D9CDBB" : "#FFFFFF");
            scale(pressed);
        };
        return sprite.node;
    }

    private rowButton(
        parent: Node,
        text: string,
        y: number,
        icon: number,
        action: () => void,
    ): Node {
        const button = this.imageButton(
            parent,
            text,
            0,
            y,
            490,
            160,
            2,
            action,
        );
        picture(
            button,
            text + "图标",
            this.sprites[icon],
            88,
            88,
        ).node.setPosition(-117, 0);
        const caption = label(button, text, 44, "#56351C");
        caption.isBold = true;
        caption.node.setPosition(55, 0);
        return button;
    }

    confirmAbandon(
        dialog: Node,
        onCancel: () => void,
        onAbandon: () => void,
    ): void {
        const artwork = uiNode(dialog, "SettingsArtwork", 1152, 2048);
        const frame = this.sprites[0];
        frame.insetLeft = 100;
        frame.insetRight = 100;
        frame.insetTop = 100;
        frame.insetBottom = 100;
        const panel = picture(artwork, "AbandonCard", frame, 850, 500);
        panel.type = Sprite.Type.SLICED;
        this.dialogTitle(artwork, "放弃挑战？", 250, onCancel);
        label(artwork, "结束本局并返回首页", 42, "#56351C").node.setPosition(
            0,
            60,
        );
        for (const [text, x, action, ink] of [
            ["继续挑战", -200, onCancel, "#56351C"],
            ["放弃挑战", 200, onAbandon, "#8A3523"],
        ] as const) {
            const button = this.imageButton(
                artwork,
                text,
                x,
                -105,
                340,
                116,
                2,
                action,
            );
            const caption = label(button, text, 42, ink);
            caption.isBold = true;
        }
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
