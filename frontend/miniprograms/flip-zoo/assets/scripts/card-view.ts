import { Color, Graphics, Label, Node, UITransform } from "cc";
import { FULL_EXPOSURE } from "./round";

const ANIMALS = [
    ["蛇", "#A9DF9A"],
    ["蛙", "#A9DF9A"],
    ["蟹", "#F7A39D"],
    ["龙", "#F7A39D"],
    ["猪", "#F7A39D"],
    ["象", "#A5D7F1"],
    ["鲸", "#A5D7F1"],
    ["狮", "#FBE194"],
    ["虎", "#FBE194"],
    ["兔", "#F3F1E5"],
    ["熊", "#F3F1E5"],
    ["驴", "#DDC6F2"],
    ["犬", "#DDC6F2"],
    ["獾", "#DABB9D"],
    ["浣", "#DABB9D"],
    ["蟾", "#F0C665"],
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

export class CardView {
    readonly node: Node;
    private readonly body: Graphics;
    private readonly mark: Label;
    private readonly size: number;
    private lastAppearance = "";

    constructor(parent: Node, name: string, size: number) {
        this.size = size;
        this.node = uiNode(parent, name, size, size);
        this.body = this.node.addComponent(Graphics);
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
        const animal = kind === null ? null : ANIMALS[kind];
        this.body.clear();
        this.body.fillColor = color(
            animal?.[1] ?? (selectable ? "#44786C" : "#355750"),
        );
        this.body.rect(-half, -half, this.size, this.size);
        this.body.fill();
        this.body.strokeColor = color(selectable ? "#B5D6C8" : "#507165");
        this.body.lineWidth = 2;
        this.body.rect(-half + 1, -half + 1, this.size - 2, this.size - 2);
        this.body.stroke();

        this.mark.string = animal?.[0] ?? "◇";
        this.mark.color = color(animal ? "#21382E" : "#A6CAB9");
        const partial = exposure !== FULL_EXPOSURE;
        const quadrant = [0, 1, 2, 3].find((index) => exposure & (1 << index))!;
        this.mark.fontSize = partial ? 26 : 42;
        this.mark.lineHeight = partial ? 32 : 50;
        this.mark.node.setPosition(
            partial ? (quadrant % 2 === 0 ? -half : half) / 2 : 0,
            partial ? (quadrant < 2 ? half : -half) / 2 : 0,
        );
    }

    showEmpty(locked = false): void {
        const appearance = locked ? "locked" : "empty";
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;
        this.mark.string = locked ? "广告" : "";
        this.mark.fontSize = 21;
        this.mark.lineHeight = 26;
        this.mark.color = color("#F2D38F");
        this.mark.node.setPosition(0, 0);
        this.body.clear();
        this.body.fillColor = color(locked ? "#3C4434" : "#183B30");
        this.body.strokeColor = color(locked ? "#B28E5A" : "#57806E");
        this.body.lineWidth = 2;
        const half = this.size / 2;
        this.body.roundRect(-half, -half, this.size, this.size, 8);
        this.body.fill();
        this.body.stroke();
    }
}
