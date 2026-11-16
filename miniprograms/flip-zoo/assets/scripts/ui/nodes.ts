import {
    Color,
    Graphics,
    Label,
    LabelOutline,
    Mask,
    Node,
    Sprite,
    UITransform,
    type SpriteFrame,
} from "cc";
import { ButtonPress } from "./button-press";

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

const imageWidth = 1152;
const imageHeight = 2048;

export function screenArtwork(
    parent: Node,
    name: string,
    frame: SpriteFrame,
): Node {
    return picture(parent, name, frame, imageWidth, imageHeight).node;
}

export function dialogArtwork(
    parent: Node,
    name: string,
    frame: SpriteFrame,
    regions: readonly (readonly [number, number, number, number, number])[],
): Node {
    const artwork = uiNode(parent, name, imageWidth, imageHeight);
    const mask = artwork.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_STENCIL;
    const stencil = mask.subComp as Graphics;
    stencil.clear();
    for (const [x, y, width, height, radius] of regions) {
        stencil.roundRect(
            x - imageWidth / 2,
            imageHeight / 2 - y - height,
            width,
            height,
            radius,
        );
        stencil.fill();
    }
    picture(artwork, "DialogImage", frame, imageWidth, imageHeight);
    return artwork;
}

export function artworkButton(
    artwork: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    action: () => void,
): Node {
    const button = uiNode(artwork, name, width, height);
    button.setPosition(x - imageWidth / 2, imageHeight / 2 - y);
    shadedButton(button, action);
    return button;
}

export function shadedButton(node: Node, action: () => void): ButtonPress {
    const { width, height } = node.getComponent(UITransform)!.contentSize;
    const shade = uiNode(node, "PressedShade");
    const graphic = shade.addComponent(Graphics);
    graphic.fillColor = color("#281D2336");
    graphic.roundRect(
        -width / 2,
        -height / 2,
        width,
        height,
        Math.min(width, height) * 0.28,
    );
    graphic.fill();
    shade.active = false;
    const press = node.addComponent(ButtonPress);
    press.action = action;
    press.showPressed = (pressed) => {
        if (shade.isValid) shade.active = pressed;
    };
    return press;
}
