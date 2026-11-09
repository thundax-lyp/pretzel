import {
    Color,
    Graphics,
    Node,
    Rect,
    resources,
    Sprite,
    SpriteFrame,
    Size,
    Texture2D,
    UITransform,
} from "cc";

const frames = new Map<string, Promise<SpriteFrame>>();
const requests = new WeakMap<Node, object>();

/** Slice atlas cells through engine metadata, keeping the source image intact. */
export function skin(
    node: Node,
    source: string,
    cell?: number,
    tint = "#ffffff",
) {
    const request = {};
    requests.set(node, request);
    const key = source + ":" + (cell ?? "full");
    let loading = frames.get(key);
    if (!loading) {
        loading = new Promise<SpriteFrame>((resolve, reject) => {
            resources.load(
                "ui/" + source + "/texture",
                Texture2D,
                (error, texture) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    const frame = new SpriteFrame();
                    frame.texture = texture;
                    if (cell !== undefined) {
                        const columns = source === "animal-cutouts" ? 6 : 4;
                        const w = texture.width / columns;
                        const h = texture.height / 4;
                        const padding = source === "ui-atlas" ? 20 : 0;
                        frame.rect = new Rect(
                            (cell % columns) * w + padding,
                            Math.floor(cell / columns) * h + padding,
                            w - padding * 2,
                            h - padding * 2,
                        );
                        frame.originalSize = new Size(
                            w - padding * 2,
                            h - padding * 2,
                        );
                    }
                    resolve(frame);
                },
            );
        });
        frames.set(key, loading);
    }
    void loading
        .then((frame) => {
            if (!node.isValid || requests.get(node) !== request) return;
            let artwork = node.getChildByName("Skin");
            if (!artwork) {
                artwork = new Node("Skin");
                artwork.layer = node.layer;
                node.addChild(artwork);
                artwork.setSiblingIndex(0);
                artwork
                    .addComponent(UITransform)
                    .setContentSize(
                        node.getComponent(UITransform)!.contentSize,
                    );
            }
            const sprite =
                artwork.getComponent(Sprite) ?? artwork.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.color = new Color().fromHEX(tint);
            sprite.type = Sprite.Type.SIMPLE;
            sprite.spriteFrame = frame;
            const fallback = node.getComponent(Graphics);
            if (fallback) fallback.enabled = false;
        })
        .catch(() => {
            frames.delete(key);
        });
}
