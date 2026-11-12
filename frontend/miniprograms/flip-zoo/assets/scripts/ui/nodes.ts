import {
    Color,
    Label,
    LabelOutline,
    Node,
    Sprite,
    UITransform,
    type SpriteFrame,
} from "cc";

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

export function titleLine(
    parent: Node,
    text: string,
    y: number,
    size: number,
    fill: string,
    border: string,
): Label {
    const caption = label(parent, text, size, fill);
    caption.isBold = true;
    caption.node.setPosition(0, y);
    const outline = caption.node.addComponent(LabelOutline);
    outline.color = color(border);
    outline.width = Math.max(2, Math.round(size / 16));
    return caption;
}
