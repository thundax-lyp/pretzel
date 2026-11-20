import {
    Graphics,
    JsonAsset,
    Label,
    Mask,
    Node,
    ScrollView,
    UITransform,
    resources,
} from "cc";
import { color, label, uiNode } from "../ui/nodes";
import { ButtonPress, scaleButton } from "../ui/button-press";
import { parsePrivacyDocument, type PrivacyDocument } from "./privacy-document";

export function showPrivacyDocument(
    root: Node,
    size: {
        width: number;
        height: number;
        topInset: number;
        bottomInset: number;
        pixelScale: number;
    },
    onBack: () => void,
): void {
    const { width, height, topInset, bottomInset, pixelScale } = size;
    const background = root.addComponent(Graphics);
    background.fillColor = color("#FFFFFF");
    background.rect(-width / 2, -height / 2, width, height);
    background.fill();
    const headerY = height / 2 - topInset - 16 * pixelScale;
    plainButton(
        root,
        "‹ 返回",
        -width / 2 + 56 * pixelScale,
        headerY,
        pixelScale,
        onBack,
    );
    const status = label(root, "正在加载条款…", 17 * pixelScale, "#262626");

    const load = () => {
        status.string = "正在加载条款…";
        resources.load(
            "privacy/child-privacy-policy",
            JsonAsset,
            (error, asset) => {
                if (!root.isValid) return;
                try {
                    if (error) throw error;
                    const document = parsePrivacyDocument(asset.json);
                    status.node.destroy();
                    renderBody(
                        root,
                        document,
                        width,
                        height,
                        topInset,
                        bottomInset,
                        pixelScale,
                    );
                } catch (failure) {
                    console.error(
                        "Privacy document could not be loaded",
                        failure,
                    );
                    status.string = "条款加载失败，请重试";
                    const retry = plainButton(
                        root,
                        "重试",
                        0,
                        -56 * pixelScale,
                        pixelScale,
                        () => {
                            retry.destroy();
                            load();
                        },
                    );
                }
            },
        );
    };
    load();
}

function renderBody(
    root: Node,
    document: PrivacyDocument,
    width: number,
    height: number,
    topInset: number,
    bottomInset: number,
    pixelScale: number,
): void {
    const top = height / 2 - topInset - 46 * pixelScale;
    const bottom = -height / 2 + bottomInset + 24;
    const viewportHeight = top - bottom;
    const viewportWidth = width - 40;
    const viewport = uiNode(
        root,
        "PrivacyViewport",
        viewportWidth,
        viewportHeight,
    );
    viewport.setPosition(0, (top + bottom) / 2);
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = false;
    scroll.vertical = true;
    const content = uiNode(
        viewport,
        "PrivacyContent",
        viewportWidth,
        viewportHeight,
    );
    const transform = content.getComponent(UITransform)!;
    transform.setAnchorPoint(0.5, 1);
    content.setPosition(0, viewportHeight / 2);
    scroll.content = content;
    let offset = 16;
    const append = (
        text: string,
        fontSize: number,
        bold = false,
        indent = 0,
        gap = 16,
        centered = false,
    ) => {
        const paragraph = label(content, text, fontSize, "#262626");
        paragraph.isBold = bold;
        paragraph.color = color(bold ? "#111111" : "#262626");
        paragraph.lineHeight = Math.ceil(fontSize * 1.6);
        paragraph.horizontalAlign = centered
            ? Label.HorizontalAlign.CENTER
            : Label.HorizontalAlign.LEFT;
        paragraph.verticalAlign = Label.VerticalAlign.TOP;
        paragraph.overflow = Label.Overflow.RESIZE_HEIGHT;
        const box = paragraph.node.getComponent(UITransform)!;
        box.setAnchorPoint(0, 1);
        box.setContentSize(viewportWidth - 32 - indent, 0);
        paragraph.node.setPosition(-viewportWidth / 2 + 16 + indent, -offset);
        paragraph.updateRenderData(true);
        offset += box.height + gap;
    };
    append(
        document.title,
        Math.min(18 * pixelScale, (viewportWidth - 32) / document.title.length),
        true,
        0,
        24,
        true,
    );
    for (const date of document.dates)
        append(
            `${date.label}：${date.value}`,
            16 * pixelScale,
            false,
            0,
            6,
            true,
        );
    offset += 20;
    for (const block of document.blocks) {
        if (block.type === "heading") {
            offset += block.level === 1 ? 24 : 10;
            append(
                block.text,
                (block.level === 1 ? 20 : block.level === 2 ? 18 : 17) *
                    pixelScale,
                true,
            );
        } else {
            append(
                block.type === "paragraph"
                    ? "\u3000\u3000" + block.text
                    : block.text,
                18 * pixelScale,
                false,
                block.type === "list-item" ? 16 : 0,
            );
        }
    }
    transform.setContentSize(
        viewportWidth,
        Math.max(viewportHeight, offset + 16),
    );
    scroll.scrollToTop();
}

function plainButton(
    parent: Node,
    text: string,
    x: number,
    y: number,
    pixelScale: number,
    action: () => void,
): Node {
    const width = 88 * pixelScale;
    const height = 40 * pixelScale;
    const node = uiNode(parent, text, width, height);
    node.setPosition(x, y);
    const graphic = node.addComponent(Graphics);
    graphic.fillColor = color("#FFFFFF");
    graphic.strokeColor = color("#D9D9D9");
    graphic.lineWidth = pixelScale;
    graphic.roundRect(-width / 2, -height / 2, width, height, 8 * pixelScale);
    graphic.fill();
    graphic.stroke();
    label(node, text, 16 * pixelScale, "#262626");
    const press = node.addComponent(ButtonPress);
    press.action = action;
    press.showPressed = scaleButton(node, 0.97);
    return node;
}
