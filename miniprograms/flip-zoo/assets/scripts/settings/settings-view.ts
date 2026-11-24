import {
    Graphics,
    Node,
    UITransform,
    Vec3,
    type EventTouch,
    type SpriteFrame,
} from "cc";
import type { ZooAudio, VolumeChannel } from "../services/zoo-audio";
import type { ZooArtwork } from "../services/artwork";
import { Dialog } from "../ui/dialog";
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

export class SettingsDialog extends Dialog {
    readonly feedbackControl: Node;

    constructor(
        layer: Node,
        art: ZooArtwork["home"],
        view: SettingsView,
        actions: SettingsActions,
    ) {
        let feedbackControl!: Node;
        super(layer, {
            frame: art.settings[0],
            titleBoard: art.settings[1],
            titleImage: art.settingsTitle,
            content: (body, width) => {
                feedbackControl = view.renderContent(body, width, actions);
            },
            onBackdropPress: actions.back,
        });
        this.feedbackControl = feedbackControl;
    }
}

export class ConfirmAbandonDialog extends Dialog {
    constructor(
        layer: Node,
        art: ZooArtwork["home"],
        onContinue: () => void,
        onAbandon: () => void,
    ) {
        super(layer, {
            frame: art.settings[0],
            titleBoard: art.settings[1],
            titleImage: art.abandonConfirm.title,
            actionHeight: 98,
            content: (body, width) => {
                body.getComponent(UITransform)!.setContentSize(width, 110);
                label(body, "结束本局并返回首页", 38, "#56351C");
            },
            actions: [
                { image: art.abandonConfirm.continue, onPress: onContinue },
                { image: art.abandonConfirm.abandon, onPress: onAbandon },
            ],
        });
    }
}

export class SettingsView {
    constructor(
        private readonly audio: ZooAudio,
        private readonly sprites: readonly SpriteFrame[],
    ) {}

    renderContent(body: Node, width: number, actions: SettingsActions): Node {
        const version = actions.version?.trim();
        const rowPitch = 105;
        const height =
            242 + rowPitch * (actions.abandon ? 3 : 2) + (version ? 36 : 0);
        body.getComponent(UITransform)!.setContentSize(width, height);
        let y = height / 2 - 42;
        for (const [index, text, channel] of [
            [7, "音效高低", "sfx"],
            [8, "音乐高低", "music"],
        ] as const) {
            picture(
                body,
                text + "图标",
                this.sprites[index],
                62,
            ).node.setPosition(-249, y);
            const caption = label(body, text, 33, "#56351C");
            caption.isBold = true;
            caption.node.setPosition(-129, y);
            this.createVolumeRow(body, channel, y);
            y -= 88;
        }
        y -= 15;
        const feedback = this.rowButton(
            body,
            "问题反馈",
            y,
            4,
            actions.feedback,
        );
        y -= rowPitch;
        this.rowButton(body, "联系客服", y, 5, actions.contact);
        if (actions.abandon) {
            y -= rowPitch;
            this.rowButton(body, "放弃挑战", y, 6, actions.abandon);
        }
        y -= 81;
        const privacy = label(
            body,
            "儿童隐私保护声明及监护人须知",
            23,
            "#386B8F",
        );
        privacy.node.name = "ChildPrivacyLink";
        privacy.isUnderline = true;
        privacy.node.setPosition(0, y);
        privacy.node.getComponent(UITransform)!.setContentSize(width - 32, 44);
        const press = privacy.node.addComponent(ButtonPress);
        const scale = scaleButton(privacy.node, 0.98);
        press.action = actions.privacy;
        press.showPressed = (pressed) => {
            if (!privacy.isValid) return;
            privacy.color = color(pressed ? "#20425B" : "#386B8F");
            scale(pressed);
        };
        if (version)
            label(body, "版本 " + version, 19, "#886849").node.setPosition(
                0,
                y - 37,
            );
        return feedback;
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
            390,
            105,
            2,
            action,
        );
        picture(
            button,
            text + "图标",
            this.sprites[icon],
            65,
            65,
        ).node.setPosition(-105, 0);
        const caption = label(button, text, 34, "#56351C");
        caption.isBold = true;
        caption.node.setPosition(42, 0);
        return button;
    }

    private createVolumeRow(
        parent: Node,
        channel: VolumeChannel,
        y: number,
    ): void {
        const name = channel === "music" ? "音乐音量" : "音效音量";
        const width = 258;
        const track = uiNode(parent, name, width + 40, 60);
        track.setPosition(145, y);
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
