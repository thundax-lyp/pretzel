import {
    Color,
    Graphics,
    Label,
    Node,
    Sprite,
    type SpriteFrame,
    UITransform,
    Vec3,
    type EventTouch,
} from "cc";
import { Dialog } from "./dialog";

const IVORY = new Color(255, 244, 216);
const GOLD = new Color(235, 194, 106);
const DARK = new Color(4, 30, 23);
type Channel = "music" | "sound";

export interface SettingsArtwork {
    panel: SpriteFrame;
    gold: SpriteFrame;
    jade: SpriteFrame;
    red: SpriteFrame;
}

interface SettingsActions {
    volume(channel: Channel): number;
    setVolume(channel: Channel, value: number): void;
    contact(notice: (message: string) => void): void;
    feedback(notice: (message: string) => void): void;
    privacy(notice: (message: string) => void): void;
    leave?: { label: string; run: () => void };
    close(): void;
}

export class SettingsDialog extends Dialog {
    readonly feedbackControl: Node;

    constructor(parent: Node, art: SettingsArtwork, actions: SettingsActions) {
        const height = actions.leave ? 762 : 664;
        super(parent, "SettingsDialog", 620, height, actions.close, art.panel);
        const top = height / 2;
        const titlePlate = this.node("TitlePlate", 0, top - 65, 274, 72);
        this.decorate(titlePlate, art.gold);
        this.text(titlePlate, "设置", 46, DARK, true);
        this.volumeRow("音乐", "music", top - 178, actions);
        this.volumeRow("音效", "sound", top - 264, actions);

        const divider = this.node("ActionDivider", 0, top - 331, 490, 2);
        this.paint(divider, new Color(123, 113, 67), 0);
        const notice = this.text(
            this.node("Notice", 0, 116 - top, 530, 32),
            "",
            22,
            IVORY,
        );
        const showNotice = (message: string) => {
            if (notice.isValid) notice.string = message;
        };
        this.feedbackControl = this.button(
            "问题反馈",
            -128,
            top - 388,
            236,
            art.jade,
            IVORY,
            () => actions.feedback(showNotice),
        );
        this.button("联系客服", 128, top - 388, 236, art.jade, IVORY, () =>
            actions.contact(showNotice),
        );
        this.button("隐私声明", 0, top - 463, 208, art.jade, IVORY, () =>
            actions.privacy(showNotice),
        );
        if (actions.leave) {
            this.button(
                actions.leave.label,
                0,
                top - 537,
                270,
                art.red,
                IVORY,
                actions.leave.run,
            );
        }
        this.button(
            actions.leave ? "返回牌局" : "返回",
            0,
            64 - top,
            218,
            art.gold,
            DARK,
            actions.close,
        );
    }

    private volumeRow(
        title: string,
        channel: Channel,
        y: number,
        actions: SettingsActions,
    ): void {
        const row = this.node(title, 0, y, 520, 69);
        this.paint(row, new Color(12, 56, 42), 20);
        this.audioIcon(this.nodeIn(row, "AudioIcon", -199, 0, 48, 48), channel);
        const width = 357;
        const track = this.nodeIn(row, "VolumeTrack", 43, 0, width + 40, 66);
        const graphic = track.addComponent(Graphics);
        const draw = (value: number) => {
            graphic.clear();
            graphic.fillColor = DARK;
            graphic.roundRect(-width / 2, -7, width, 14, 7);
            graphic.fill();
            const filled = (width * value) / 100;
            if (filled > 0) {
                graphic.fillColor = GOLD;
                graphic.roundRect(
                    -width / 2,
                    -7,
                    filled,
                    14,
                    Math.min(7, filled / 2),
                );
                graphic.fill();
            }
            graphic.fillColor = IVORY;
            graphic.circle(filled - width / 2, 0, 15);
            graphic.fill();
        };
        const at = (event: EventTouch) => {
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
            draw(at(event)),
        );
        track.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) =>
            draw(at(event)),
        );
        track.on(Node.EventType.TOUCH_CANCEL, () =>
            draw(actions.volume(channel)),
        );
        track.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            actions.setVolume(channel, at(event));
            draw(actions.volume(channel));
        });
        draw(actions.volume(channel));
    }

    private audioIcon(node: Node, channel: Channel): void {
        const icon = node.addComponent(Graphics);
        icon.fillColor = IVORY;
        if (channel === "music") {
            icon.ellipse(-7, -12, 10, 7);
            icon.roundRect(-2, -12, 5, 32, 2);
            icon.moveTo(0, 19);
            icon.bezierCurveTo(5, 18, 11, 13, 17, 14);
            icon.bezierCurveTo(15, 6, 8, 6, 2, 11);
            icon.close();
            icon.fill();
            return;
        }
        icon.moveTo(-20, -7);
        icon.lineTo(-12, -7);
        icon.lineTo(0, -16);
        icon.lineTo(0, 16);
        icon.lineTo(-12, 7);
        icon.lineTo(-20, 7);
        icon.close();
        icon.fill();
        icon.strokeColor = IVORY;
        icon.lineWidth = 4;
        icon.moveTo(6, -7);
        icon.bezierCurveTo(12, -4, 12, 4, 6, 7);
        icon.moveTo(12, -14);
        icon.bezierCurveTo(23, -8, 23, 8, 12, 14);
        icon.stroke();
    }

    private button(
        title: string,
        x: number,
        y: number,
        width: number,
        image: SpriteFrame,
        ink: Color,
        tap: () => void,
    ): Node {
        const { width: sourceWidth, height: sourceHeight } = image.originalSize;
        const node = this.node(
            title,
            x,
            y,
            width,
            (width * sourceHeight) / sourceWidth,
        );
        this.decorate(node, image);
        this.text(node, title, 33, ink, true);
        node.on(Node.EventType.TOUCH_START, () => node.setScale(0.96, 0.96));
        node.on(Node.EventType.TOUCH_CANCEL, () => node.setScale(1, 1));
        node.on(Node.EventType.TOUCH_END, () => {
            node.setScale(1, 1);
            tap();
        });
        return node;
    }

    private decorate(target: Node, image: SpriteFrame): void {
        const { width, height } = target.getComponent(UITransform)!.contentSize;
        const artwork = this.nodeIn(target, "Artwork", 0, 0, width, height);
        const sprite = artwork.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = image;
    }

    private node(
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): Node {
        return this.nodeIn(this.panel, name, x, y, width, height);
    }

    private nodeIn(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
    ): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        return node;
    }

    private paint(node: Node, fill: Color, radius: number): void {
        const { width, height } = node.getComponent(UITransform)!.contentSize;
        const graphic = node.addComponent(Graphics);
        graphic.fillColor = fill;
        graphic.roundRect(-width / 2, -height / 2, width, height, radius);
        graphic.fill();
    }

    private text(
        node: Node,
        title: string,
        size: number,
        color: Color,
        bold = false,
    ): Label {
        const label = this.nodeIn(node, "Label", 0, 0, 0, 0).addComponent(
            Label,
        );
        label.fontSize = size;
        label.lineHeight = size + 8;
        label.color = color;
        label.isBold = bold;
        label.string = title;
        return label;
    }
}
