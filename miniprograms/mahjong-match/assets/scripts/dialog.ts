import {
    BlockInputEvents,
    Color,
    Graphics,
    Node,
    Sprite,
    UITransform,
    type SpriteFrame,
} from "cc";

const FRAME = new Color(193, 150, 70);
const PANEL = new Color(7, 44, 33);
const INNER_EDGE = new Color(53, 95, 72);

export class Dialog {
    readonly panel: Node;
    private readonly layer: Node;
    private readonly backdrop: Node;

    constructor(
        parent: Node,
        name: string,
        private readonly width: number,
        private readonly height: number,
        dismiss?: () => void,
        artwork?: SpriteFrame,
    ) {
        this.layer = this.child(parent, name);
        this.layer.addComponent(BlockInputEvents);
        this.backdrop = this.child(this.layer, "Backdrop");
        this.backdrop.addComponent(Graphics);
        if (dismiss) this.backdrop.on(Node.EventType.TOUCH_END, dismiss);
        this.panel = this.child(this.layer, "DialogPanel");
        this.panel.getComponent(UITransform)!.setContentSize(width, height);
        this.panel.addComponent(BlockInputEvents);
        if (artwork) {
            const node = this.child(this.panel, "DialogFrameArtwork");
            const sprite = node.addComponent(Sprite);
            sprite.type = Sprite.Type.SLICED;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = artwork;
            node.getComponent(UITransform)!.setContentSize(width, height);
            return;
        }
        const frame = this.panel.addComponent(Graphics);
        this.rounded(frame, width, height, 34, FRAME);
        this.rounded(frame, width - 5, height - 5, 32, PANEL);
        this.rounded(frame, width - 22, height - 22, 26, INNER_EDGE);
        this.rounded(frame, width - 24, height - 24, 25, PANEL);
    }

    resize(width: number, height: number): void {
        this.layer.getComponent(UITransform)!.setContentSize(width, height);
        this.backdrop.getComponent(UITransform)!.setContentSize(width, height);
        const shade = this.backdrop.getComponent(Graphics)!;
        shade.clear();
        shade.fillColor = new Color(0, 13, 9, 194);
        shade.rect(-width / 2, -height / 2, width, height);
        shade.fill();
        const scale = Math.min(
            1,
            (width - 32) / this.width,
            (height - 64) / this.height,
        );
        this.panel.setScale(scale, scale, 1);
    }

    close(): void {
        this.layer.removeFromParent();
        this.layer.destroy();
    }

    private child(parent: Node, name: string): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        node.addComponent(UITransform);
        parent.addChild(node);
        return node;
    }

    private rounded(
        graphic: Graphics,
        width: number,
        height: number,
        radius: number,
        color: Color,
    ): void {
        graphic.fillColor = color;
        graphic.roundRect(-width / 2, -height / 2, width, height, radius);
        graphic.fill();
    }
}
