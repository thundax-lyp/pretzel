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
    private readonly width: number;
    private readonly height: number;
    private lastAppearance = "";

    constructor(
        parent: Node,
        name: string,
        width: number,
        height: number,
        art: ZooArtwork,
    ) {
        this.art = art;
        this.width = width;
        this.height = height;
        this.node = uiNode(parent, name, width, height);
        this.body = this.node.addComponent(Graphics);
        this.portrait = picture(this.node, "Portrait", art.paw, width);
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

        this.mark.string = "";
        const faceDown = kind === null;
        this.paintTile(faceDown, selectable);
        const partial = !faceDown && exposure !== FULL_EXPOSURE;
        const quadrant = [0, 1, 2, 3].find((index) => exposure & (1 << index))!;
        const size =
            (Math.min(this.width, this.height) - 12) *
            (faceDown ? 0.64 : partial ? 0.44 : 0.96);
        this.portrait.node.active = true;
        this.portrait.spriteFrame =
            kind === null ? this.art.paw : this.art.animals[kind];
        this.portrait.color = color(
            faceDown || selectable ? "#FFFFFF" : "#E5E3C5",
        );
        this.portraitSize.setContentSize(size, size);
        this.portrait.node.setPosition(
            partial ? ((quadrant % 2 === 0 ? -1 : 1) * this.width) / 4 : 0,
            partial ? ((quadrant < 2 ? 1 : -1) * this.height) / 4 : 3,
        );
    }

    private paintTile(faceDown: boolean, selectable: boolean): void {
        const { body, width, height } = this;
        const x = -width / 2 + 2;
        const y = -height / 2 + 2;
        const edge = 6;
        body.clear();
        body.lineWidth = 2;
        body.strokeColor = color(selectable ? "#49763F" : "#49674D");

        body.fillColor = color(selectable ? "#83B55A" : "#678662");
        body.roundRect(x, y, width - 4, height - 4, 7);
        body.fill();
        body.stroke();

        body.fillColor = color(
            faceDown
                ? selectable
                    ? "#D6EDAA"
                    : "#9FB48A"
                : selectable
                  ? "#FFF7D9"
                  : "#CFD2AB",
        );
        body.roundRect(x, y + edge, width - 4, height - 4 - edge, 7);
        body.fill();
        body.stroke();
        if (selectable) {
            body.fillColor = new Color(255, 255, 255, 145);
            body.roundRect(x + 8, y + height - 11, width - 20, 3, 1.5);
            body.fill();
        }
    }

    showEmpty(lockedLabel = ""): void {
        const locked = lockedLabel !== "";
        const appearance = lockedLabel || "empty";
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;
        this.portrait.node.active = !locked;
        this.portrait.spriteFrame = this.art.paw;
        this.portrait.color = new Color(255, 255, 255, 72);
        this.portraitSize.setContentSize(30, 30);
        this.portrait.node.setPosition(0, 0);
        this.mark.string = lockedLabel;
        this.mark.fontSize = 21;
        this.mark.lineHeight = 26;
        this.mark.color = color("#476648");
        this.mark.node.setPosition(0, 0);
        this.body.clear();
        this.body.fillColor = color(locked ? "#AEBC95" : "#F3F6D5");
        this.body.strokeColor = color(locked ? "#809A70" : "#96AA76");
        this.body.lineWidth = 2;
        this.body.roundRect(
            -this.width / 2,
            -this.height / 2,
            this.width,
            this.height,
            8,
        );
        this.body.fill();
        this.body.stroke();
    }
}
