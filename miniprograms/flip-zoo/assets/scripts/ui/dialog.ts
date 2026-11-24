import {
    BlockInputEvents,
    Graphics,
    Label,
    Node,
    UITransform,
    type SpriteFrame,
} from "cc";
import { ButtonPress, scaleButton } from "./button-press";
import { color, label, picture, uiNode } from "./nodes";

interface Viewport {
    width: number;
    height: number;
}

interface DialogAction {
    image: SpriteFrame;
    onPress: () => void;
}

interface DialogContent {
    content: (container: Node, availableWidth: number) => void;
    actions?: readonly DialogAction[];
}

interface FramedDialog extends DialogContent {
    frame: SpriteFrame;
    titleBoard: SpriteFrame;
    titleImage: SpriteFrame;
    icon?: SpriteFrame;
    titleIllustration?: SpriteFrame;
    footerNote?: string;
    actionHeight?: number;
    onBackdropPress?: () => void;
}

interface CanvasDialog extends DialogContent {
    canvas: {
        height: number;
        actionBottom: number;
        centerY: number;
        scale: (viewport: Viewport) => number;
    };
}

const panelWidth = 682;
const contentWidth = 608;
const headingHeight = 154;
const headingLift = 30;
const iconLift = 82;
const minimumButtonGap = 16;

export class Dialog {
    static open(parent: Node, name: string, dimBackground: boolean): Node {
        const layer = uiNode(parent, name);
        layer.addComponent(BlockInputEvents);
        if (dimBackground)
            uiNode(layer, "DialogBackdrop").addComponent(Graphics);
        return layer;
    }

    static resize(layer: Node, { width, height }: Viewport): void {
        layer.getComponent(UITransform)!.setContentSize(width, height);
        const backdrop = layer.getChildByName("DialogBackdrop");
        if (!backdrop) return;
        backdrop.getComponent(UITransform)!.setContentSize(width, height);
        const shade = backdrop.getComponent(Graphics)!;
        shade.clear();
        shade.fillColor = color("#00000080");
        shade.rect(-width / 2, -height / 2, width, height);
        shade.fill();
    }

    static close(layer: Node): void {
        layer.removeFromParent();
        layer.destroy();
    }

    readonly panel: Node;
    protected readonly icon?: Node;

    constructor(layer: Node, options: FramedDialog | CanvasDialog) {
        this.panel = uiNode(layer, "DialogPanel", panelWidth);
        if ("canvas" in options) {
            this.mountCanvas(layer, options);
            return;
        }
        const backdrop = layer.getChildByName("DialogBackdrop");
        if (options.onBackdropPress && backdrop) {
            this.panel.addComponent(BlockInputEvents);
            const press = backdrop.addComponent(ButtonPress);
            press.action = options.onBackdropPress;
            press.showPressed = () => {};
        }
        if (options.icon) {
            const size = options.icon.originalSize;
            this.icon = picture(
                this.panel,
                "DialogIcon",
                options.icon,
                (230 * size.width) / size.height,
                230,
            ).node;
        }

        const paper = picture(
            this.panel,
            "DialogPaper",
            options.frame,
            panelWidth,
        ).node;
        const heading = picture(
            this.panel,
            "DialogHeading",
            options.titleBoard,
            596,
            headingHeight,
        ).node;
        const title = options.titleImage.originalSize;
        const titleScale = Math.min(386 / title.width, 108 / title.height);
        picture(
            heading,
            "DialogTitleImage",
            options.titleImage,
            title.width * titleScale,
            title.height * titleScale,
        );
        if (options.titleIllustration) {
            const size = options.titleIllustration.originalSize;
            const scale = 72 / Math.max(size.width, size.height);
            picture(
                heading,
                "DialogTitleIllustration",
                options.titleIllustration,
                size.width * scale,
                size.height * scale,
            ).node.setPosition(233, 0);
        }

        const body = uiNode(this.panel, "DialogContent", contentWidth);
        options.content(body, contentWidth);
        const row = options.actions?.length
            ? this.createActionRow(options.actions, options.actionHeight)
            : undefined;
        const note = options.footerNote
            ? label(this.panel, options.footerNote, 23, "#71431F")
            : undefined;
        if (note) {
            note.overflow = Label.Overflow.RESIZE_HEIGHT;
            note.node.getComponent(UITransform)!.setContentSize(574, 0);
            note.updateRenderData(true);
        }

        const layout = () => {
            const headingTop = this.icon ? 150 : headingLift;
            const bodyTop = headingTop + headingHeight + 8;
            const bodyHeight = body.getComponent(UITransform)!.height;
            const rowHeight = row?.getComponent(UITransform)!.height ?? 0;
            const noteHeight =
                note?.node.getComponent(UITransform)!.height ?? 0;
            const rowTop = bodyTop + bodyHeight + (row ? 8 : 0);
            const noteTop = rowTop + rowHeight + (note ? 18 : 0);
            const height = noteTop + noteHeight + (row && !note ? 68 : 32);
            const top = height / 2;
            const paperTop = headingTop + 10;
            this.panel
                .getComponent(UITransform)!
                .setContentSize(panelWidth, height);
            this.icon?.setPosition(0, top - 115 + iconLift);
            paper
                .getComponent(UITransform)!
                .setContentSize(panelWidth, height - paperTop);
            paper.setPosition(0, top - (paperTop + height) / 2);
            heading.setPosition(
                0,
                top - headingTop - headingHeight / 2 + headingLift,
            );
            body.setPosition(0, top - bodyTop - bodyHeight / 2);
            row?.setPosition(0, top - rowTop - rowHeight / 2);
            note?.node.setPosition(0, top - noteTop - noteHeight / 2);

            const viewport = layer.getComponent(UITransform)!.contentSize;
            const fitHeight = height + (this.icon ? 2 * iconLift : 0);
            const scale = Math.max(
                0,
                Math.min(
                    1,
                    (viewport.width - 32) / panelWidth,
                    (viewport.height - 64) / fitHeight,
                ),
            );
            this.panel.setScale(scale, scale, 1);
        };
        body.on(Node.EventType.SIZE_CHANGED, layout, this.panel);
        layer.on(Node.EventType.SIZE_CHANGED, layout, this.panel);
        layout();
    }

    private mountCanvas(layer: Node, options: CanvasDialog): void {
        const { height, actionBottom, centerY, scale } = options.canvas;
        this.panel
            .getComponent(UITransform)!
            .setContentSize(panelWidth, height);
        options.content(this.panel, panelWidth);
        if (options.actions?.length) {
            const row = this.createActionRow(options.actions);
            row.setPosition(
                0,
                actionBottom + row.getComponent(UITransform)!.height / 2,
            );
        }
        const fit = () => {
            const value = scale(layer.getComponent(UITransform)!.contentSize);
            this.panel.setScale(value, value, 1);
            this.panel.setPosition(0, centerY * value);
        };
        layer.on(Node.EventType.SIZE_CHANGED, fit, this.panel);
        fit();
    }

    private createActionRow(
        actions: readonly DialogAction[],
        maxHeight = 88,
    ): Node {
        const ratios = actions.map(({ image }) => {
            const size = image.originalSize;
            return size.width / size.height;
        });
        const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
        // The two half-gaps at the edges count as one full gap.
        const gapUnits = actions.length;
        const height = Math.max(
            0,
            Math.min(
                maxHeight,
                (contentWidth - minimumButtonGap * gapUnits) / totalRatio,
            ),
        );
        const gap = (contentWidth - totalRatio * height) / gapUnits;
        const row = uiNode(this.panel, "DialogActions", contentWidth, height);
        let left = -contentWidth / 2 + gap / 2;
        actions.forEach(({ image, onPress }, index) => {
            const buttonWidth = ratios[index] * height;
            const button = uiNode(row, "DialogAction", buttonWidth, height);
            button.setPosition(left + buttonWidth / 2, 0);
            const visual = picture(
                button,
                "DialogActionImage",
                image,
                buttonWidth,
                height,
            );
            const press = button.addComponent(ButtonPress);
            press.action = onPress;
            press.showPressed = scaleButton(visual.node, 0.95);
            left += buttonWidth + gap;
        });
        return row;
    }
}
