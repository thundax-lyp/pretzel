import {
    Color,
    Graphics,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
    type Node,
} from "cc";
import type { ZooArtwork } from "../services/artwork";
import { color, titleLine, uiNode } from "../ui/nodes";
import { CardView } from "./card-view";
import { FULL_EXPOSURE } from "./round";

export const MATCH_DURATION = 0.36;
const SLOT_MOVE_DURATION = 0.18;
const PICKUP_RISE = 12;
const PICKUP_SCALE = 1.24;

export function liftBoardCards(
    layer: Node,
    art: ZooArtwork,
    cards: readonly { source: Node; kind: number | null }[],
    bound: boolean,
): CardView[] {
    const transform = layer.getComponent(UITransform)!;
    const center = new Vec3();
    const poses = cards.map(({ source, kind }) => {
        const drawing = source.getChildByName("Drawing") ?? source;
        const position = transform.convertToNodeSpaceAR(drawing.worldPosition);
        center.add(position);
        return { source, kind, drawing, position };
    });
    center.multiplyScalar(1 / poses.length);
    return poses.map(({ source, kind, drawing, position }) => {
        const { width, height } = source.getComponent(UITransform)!;
        const scaleX = drawing.worldScale.x / layer.worldScale.x;
        const scaleY = drawing.worldScale.y / layer.worldScale.y;
        const lifted = new CardView(
            layer,
            "LiftedCard",
            width,
            height,
            art,
            drawing.getChildByName("TileSkin") ? 0 : undefined,
        );
        lifted.keepPortraitSquare(scaleX, scaleY);
        lifted.show(kind, FULL_EXPOSURE, true, [], bound);
        lifted.node.setPosition(
            center.x + (position.x - center.x) * PICKUP_SCALE,
            center.y + (position.y - center.y) * PICKUP_SCALE + PICKUP_RISE,
        );
        lifted.node.setScale(scaleX * PICKUP_SCALE, scaleY * PICKUP_SCALE, 1);
        source.active = false;
        return lifted;
    });
}

export function flyCardToSlot(
    layer: Node,
    art: ZooArtwork,
    source: Node,
    target: Node,
    kind: number,
    onLanded: () => void,
    lifted?: CardView,
): void {
    const { width, height } = target.getComponent(UITransform)!;
    const layerTransform = layer.getComponent(UITransform)!;
    const origin = lifted?.node ?? source;
    const drawing = origin.getChildByName("Drawing") ?? origin;
    const start = layerTransform.convertToNodeSpaceAR(drawing.worldPosition);
    const end = layerTransform.convertToNodeSpaceAR(target.worldPosition);
    const position = new Vec3();
    const sourceScale = drawing.worldScale;
    const targetScale = target.worldScale;
    const layerScale = layer.worldScale;
    const startScale = new Vec3(
        (sourceScale.x * origin.getComponent(UITransform)!.width) /
            (layerScale.x * width),
        (sourceScale.y * origin.getComponent(UITransform)!.height) /
            (layerScale.y * height),
        1,
    );
    const endScale = new Vec3(
        targetScale.x / layerScale.x,
        targetScale.y / layerScale.y,
        1,
    );
    const scale = new Vec3();
    const flight =
        lifted ??
        new CardView(
            layer,
            "FlyingCard",
            width,
            height,
            art,
            drawing.getChildByName("TileSkin") ? 0 : undefined,
        );
    flight.show(kind, FULL_EXPOSURE, true);
    flight.node.setPosition(start);
    flight.node.setScale(startScale);
    flight.keepPortraitSquare(startScale.x, startScale.y);
    source.active = false;
    tween({ progress: 0 })
        .to(
            SLOT_MOVE_DURATION,
            { progress: 1 },
            {
                easing: "quadOut",
                onUpdate: (state) => {
                    if (!flight.node.isValid) return;
                    const progress = state!.progress;
                    Vec3.lerp(position, start, end, progress);
                    position.y += 64 * progress * (1 - progress);
                    flight.node.setPosition(position);
                    flight.node.setScale(
                        Vec3.lerp(scale, startScale, endScale, progress),
                    );
                    flight.keepPortraitSquare(scale.x, scale.y);
                },
            },
        )
        .call(() => {
            if (!flight.node.isValid) return;
            flight.node.active = false;
            flight.node.destroy();
            onLanded();
        })
        .start();
}

export function slideSlotCard(
    tray: Node,
    art: ZooArtwork,
    source: Node,
    target: Node,
    kind: number,
): void {
    const { width, height } = source.getComponent(UITransform)!;
    const card = new CardView(
        tray,
        "SlidingCard",
        width,
        height,
        art,
        source.getChildByName("Drawing")?.getChildByName("TileSkin")
            ? 0
            : undefined,
    );
    card.show(kind, FULL_EXPOSURE, true);
    card.node.setPosition(source.position);
    card.node.setScale(source.scale);
    card.keepPortraitSquare(source.scale.x, source.scale.y);
    tween(card.node)
        .to(
            SLOT_MOVE_DURATION,
            { position: target.position.clone() },
            {
                easing: "quadOut",
            },
        )
        .call(() => {
            card.node.active = false;
            card.node.destroy();
        })
        .start();
}

export function playMatch(
    layer: Node,
    tray: Node,
    slots: readonly CardView[],
    art: ZooArtwork,
    kind: number,
    indices: readonly number[],
): void {
    const cue = titleLine(
        layer,
        "三消！",
        tray.position.y + 105,
        47,
        "#FFE379",
        "#85501F",
    );
    const cueOpacity = cue.node.addComponent(UIOpacity);
    tween(cueOpacity)
        .delay(0.12)
        .to(MATCH_DURATION - 0.12, { opacity: 0 })
        .call(() => cue.node.destroy())
        .start();
    for (const index of indices) {
        const slot = slots[index].node;
        const { width, height } = slot.getComponent(UITransform)!;
        const { x: scaleX, y: scaleY } = slot.scale;
        const effect = uiNode(layer, "MatchFlash");
        effect.setPosition(slot.position.x, tray.position.y + slot.position.y);
        effect.setScale(scaleX, scaleY, 1);
        const glow = effect.addComponent(Graphics);
        glow.fillColor = new Color(255, 220, 115, 170);
        glow.roundRect(
            -width / 2 - 5,
            -height / 2 - 5,
            width + 10,
            height + 10,
            11,
        );
        glow.fill();
        glow.strokeColor = color("#FFF4AA");
        glow.lineWidth = 4;
        glow.roundRect(
            -width / 2 - 3,
            -height / 2 - 3,
            width + 6,
            height + 6,
            9,
        );
        glow.stroke();
        glow.fillColor = color("#FFF6BF");
        for (const [x, y] of [
            [-width / 2, height / 2],
            [width / 2, -height / 2],
        ]) {
            glow.moveTo(x, y + 13);
            glow.lineTo(x + 4, y + 4);
            glow.lineTo(x + 12, y);
            glow.lineTo(x + 4, y - 4);
            glow.lineTo(x, y - 13);
            glow.lineTo(x - 4, y - 4);
            glow.lineTo(x - 12, y);
            glow.lineTo(x - 4, y + 4);
            glow.close();
        }
        glow.fill();
        const tile = new CardView(
            effect,
            "MatchedTile",
            width,
            height,
            art,
            slot.getChildByName("Drawing")?.getChildByName("TileSkin")
                ? 0
                : undefined,
        );
        tile.keepPortraitSquare(scaleX, scaleY);
        tile.show(kind, FULL_EXPOSURE, true);
        const opacity = effect.addComponent(UIOpacity);
        tween(effect)
            .to(
                0.08,
                { scale: new Vec3(scaleX * 1.12, scaleY * 1.12, 1) },
                { easing: "quadOut" },
            )
            .to(
                MATCH_DURATION - 0.08,
                {
                    scale: new Vec3(scaleX * 0.6, scaleY * 0.6, 1),
                    position: new Vec3(
                        effect.position.x,
                        effect.position.y + 24,
                    ),
                },
                { easing: "quadIn" },
            )
            .call(() => effect.destroy())
            .start();
        tween(opacity)
            .delay(0.08)
            .to(MATCH_DURATION - 0.08, { opacity: 0 })
            .start();
    }
}
