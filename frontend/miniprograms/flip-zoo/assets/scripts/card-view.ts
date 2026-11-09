import {
    Color,
    Graphics,
    Label,
    Node,
    Sprite,
    UITransform,
    type SpriteFrame,
} from "cc";
import type { ZooArtwork } from "./artwork";
import { FULL_EXPOSURE } from "./round";

const FACE_COLORS = [
    "#D8EFB4",
    "#E4F2AD",
    "#FFD3B9",
    "#BDE5DC",
    "#FAD5DB",
    "#CEE4F5",
    "#BDDEF2",
    "#F9E0A0",
    "#F8D2A1",
    "#FFF0E1",
    "#EACDB7",
    "#E3D6EE",
    "#F8DEBB",
    "#DDDDE6",
    "#D8DEE6",
    "#F2DEA4",
];

export function color(hex: string): Color {
    return Color.fromHEX(new Color(), hex);
}

export function uiNode(
    parent: Node,
    name: string,
    width = 0,
    height = 0,
): Node {
    const node = new Node(name);
    node.layer = parent.layer;
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    return node;
}

export function label(
    parent: Node,
    text: string,
    size: number,
    hex = "#F4F7E9",
): Label {
    const node = uiNode(parent, "Label");
    const component = node.addComponent(Label);
    component.string = text;
    component.fontSize = size;
    component.lineHeight = Math.ceil(size * 1.2);
    component.horizontalAlign = Label.HorizontalAlign.CENTER;
    component.verticalAlign = Label.VerticalAlign.CENTER;
    component.color = color(hex);
    return component;
}

export function picture(
    parent: Node,
    name: string,
    frame: SpriteFrame,
    width: number,
    height = width,
): Sprite {
    const node = uiNode(parent, name, width, height);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    return sprite;
}

export class CardView {
    readonly node: Node;
    private readonly body: Graphics;
    private readonly art: ZooArtwork;
    private readonly portrait: Sprite;
    private readonly portraitSize: UITransform;
    private readonly mark: Label;
    private readonly size: number;
    private lastAppearance = "";

    constructor(parent: Node, name: string, size: number, art: ZooArtwork) {
        this.art = art;
        this.size = size;
        this.node = uiNode(parent, name, size, size);
        this.body = this.node.addComponent(Graphics);
        this.portrait = picture(this.node, "Portrait", art.paw, size);
        this.portraitSize = this.portrait.node.getComponent(UITransform)!;
        this.mark = label(this.node, "", 36);
        this.mark.isBold = true;
    }

    show(kind: number | null, exposure: number, selectable: boolean): void {
        this.node.active = exposure !== 0;
        if (!this.node.active) return;
        const appearance = `${kind}/${exposure}/${selectable}`;
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;

        const half = this.size / 2;
        this.body.clear();
        this.body.fillColor = color(
            kind === null
                ? selectable
                    ? "#477563"
                    : "#3D6256"
                : FACE_COLORS[kind],
        );
        this.body.roundRect(
            -half + 1,
            -half + 1,
            this.size - 2,
            this.size - 2,
            7,
        );
        this.body.fill();
        this.body.strokeColor = color(selectable ? "#E9CD90" : "#72917D");
        this.body.lineWidth = 2;
        this.body.stroke();

        this.mark.string = "";
        const partial = exposure !== FULL_EXPOSURE;
        const quadrant = [0, 1, 2, 3].find((index) => exposure & (1 << index))!;
        const size = this.size * (partial ? 0.35 : kind === null ? 0.6 : 0.83);
        this.portrait.node.active = true;
        this.portrait.spriteFrame =
            kind === null ? this.art.paw : this.art.animals[kind];
        this.portrait.color = color(selectable ? "#FFFFFF" : "#AEC5B2");
        this.portraitSize.setContentSize(size, size);
        this.portrait.node.setPosition(
            partial ? (quadrant % 2 === 0 ? -half : half) / 2 : 0,
            partial ? (quadrant < 2 ? half : -half) / 2 : 0,
        );
    }

    showEmpty(lockedLabel = ""): void {
        const locked = lockedLabel !== "";
        const appearance = lockedLabel || "empty";
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;
        this.portrait.node.active = false;
        this.mark.string = lockedLabel;
        this.mark.fontSize = 21;
        this.mark.lineHeight = 26;
        this.mark.color = color("#F2D38F");
        this.mark.node.setPosition(0, 0);
        this.body.clear();
        this.body.fillColor = color(locked ? "#576B4F" : "#2E5544");
        this.body.strokeColor = color(locked ? "#C6A86B" : "#668F76");
        this.body.lineWidth = 2;
        const half = this.size / 2;
        this.body.roundRect(-half, -half, this.size, this.size, 8);
        this.body.fill();
        this.body.stroke();
    }
}
