import { Color, Graphics, Label, Node, Sprite, UITransform } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { FULL_EXPOSURE } from "./round";

import { color, label, picture, uiNode } from "../ui/nodes";

const ELEVATION_SIDES = [
    "#83B55A",
    "#78A857",
    "#67974C",
    "#588647",
    "#47743D",
    "#355C31",
];
const ELEVATION_OFFSET = 2;

export class CardView {
    readonly node: Node;
    private readonly body: Graphics;
    private readonly art: ZooArtwork;
    private readonly portrait: Sprite;
    private readonly portraitSize: UITransform;
    private readonly mark: Label;
    private readonly width: number;
    private readonly elevation: number;
    private readonly drawingOffset: number;
    private height: number;
    private lastAppearance = "";

    constructor(
        parent: Node,
        name: string,
        width: number,
        height: number,
        art: ZooArtwork,
        elevation = 0,
    ) {
        this.art = art;
        this.width = width;
        this.height = height;
        this.elevation = Math.min(elevation, ELEVATION_SIDES.length - 1);
        this.drawingOffset = elevation * ELEVATION_OFFSET;
        this.node = uiNode(parent, name, width, height);
        const drawing =
            elevation > 0 ? uiNode(this.node, "Drawing") : this.node;
        if (drawing !== this.node) {
            drawing.setPosition(this.drawingOffset, this.drawingOffset);
        }
        this.body = drawing.addComponent(Graphics);
        this.portrait = picture(drawing, "Portrait", art.paw, width);
        this.portraitSize = this.portrait.node.getComponent(UITransform)!;
        this.mark = label(drawing, "", 36);
        this.mark.isBold = true;
    }

    setHeight(height: number): void {
        if (height === this.height) return;
        this.height = height;
        this.node.getComponent(UITransform)!.setContentSize(this.width, height);
        this.lastAppearance = "";
    }

    show(
        kind: number | null,
        exposure: number,
        selectable: boolean,
        upperCards: readonly CardView[] = [],
    ): void {
        this.node.active = true;
        const appearance = `${kind}/${exposure}/${selectable}/${upperCards.map((card) => card.node.name).join(",")}`;
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;

        this.mark.string = "";
        const faceDown = kind === null || exposure === 0;
        this.paintTile(faceDown, selectable, upperCards);
        // A fully covered tile can still contribute a visible strip after
        // the drawing offset. Show its body without exposing its portrait.
        this.portrait.node.active = exposure !== 0;
        if (exposure === 0) return;
        if (kind === null) {
            const size = (Math.min(this.width, this.height) - 12) * 0.56;
            this.portrait.spriteFrame = this.art.paw;
            this.portrait.color = color("#52723B38");
            this.portraitSize.setContentSize(size, size);
            this.portrait.node.setPosition(0, 3);
            return;
        }

        const partial = exposure !== FULL_EXPOSURE;
        const quadrant = [0, 1, 2, 3].find((index) => exposure & (1 << index))!;
        const size =
            (Math.min(this.width, this.height) - 12) * (partial ? 0.44 : 0.96);
        this.portrait.spriteFrame = this.art.animals[kind];
        this.portrait.color = color(selectable ? "#FFFFFF" : "#F4F2DF");
        this.portraitSize.setContentSize(size, size);
        this.portrait.node.setPosition(
            partial ? ((quadrant % 2 === 0 ? -1 : 1) * this.width) / 4 : 0,
            partial ? ((quadrant < 2 ? 1 : -1) * this.height) / 4 : 3,
        );
    }

    private paintTile(
        faceDown: boolean,
        selectable: boolean,
        upperCards: readonly CardView[],
    ): void {
        const { body, width, height, elevation } = this;
        const x = -width / 2 + 2;
        const y = -height / 2 + 2;
        const edge = 6;
        const summit = elevation === ELEVATION_SIDES.length - 1;
        body.clear();
        body.lineWidth = 2;
        body.strokeColor = color(selectable ? "#49763F" : "#648056");

        body.fillColor = color(
            selectable || elevation > 0
                ? ELEVATION_SIDES[elevation]
                : "#88A577",
        );
        body.roundRect(x, y, width - 4, height - 4, 7);
        body.fill();
        body.stroke();

        body.fillColor = color(
            faceDown
                ? selectable
                    ? "#D6EDAA"
                    : "#B9CE9A"
                : selectable
                  ? "#FFF7D9"
                  : "#E7E7C4",
        );
        body.roundRect(x, y + edge, width - 4, height - 4 - edge, 7);
        body.fill();
        body.stroke();
        if (selectable) {
            body.fillColor = summit
                ? color("#FFF0A6")
                : new Color(255, 255, 255, 145);
            const rim = summit ? 4 : 3;
            body.roundRect(x + 8, y + height - 11, width - 20, rim, rim / 2);
            body.fill();
        }
        if (upperCards.length > 0) {
            this.paintOverlapEdges(upperCards, x, y + edge, -x, -y);
        }
    }

    private paintOverlapEdges(
        upperCards: readonly CardView[],
        left: number,
        bottom: number,
        right: number,
        top: number,
    ): void {
        const { body, node, drawingOffset } = this;
        const strip = (x: number, y: number, endX: number, endY: number) => {
            const leftEdge = Math.max(left, x);
            const bottomEdge = Math.max(bottom, y);
            const width = Math.min(right, endX) - leftEdge;
            const height = Math.min(top, endY) - bottomEdge;
            if (width <= 0 || height <= 0) return;
            body.rect(leftEdge, bottomEdge, width, height);
            body.fill();
        };
        for (const upper of upperCards) {
            // Both tile outlines are inset by two units. Work in the lower
            // drawing's coordinates, including the difference in lift.
            const offset = upper.drawingOffset - drawingOffset;
            const x = upper.node.position.x - node.position.x + offset;
            const y = upper.node.position.y - node.position.y + offset;
            const l = x - upper.width / 2 + 2;
            const r = x + upper.width / 2 - 2;
            const b = y - upper.height / 2 + 2;
            const t = y + upper.height / 2 - 2;
            body.fillColor = color("#304B2929");
            strip(r, b, r + 5, t);
            strip(l, b - 5, r, b);

            body.fillColor = color("#3D592D60");
            strip(l - 2, b, l, t);
            strip(r, b, r + 2, t);
            strip(l, b - 2, r, b);
            strip(l, t, r, t + 2);
        }
    }

    showEmpty(lockedLabel = ""): void {
        const locked = lockedLabel !== "";
        const appearance = lockedLabel || "empty";
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;
        this.portrait.node.active = !locked;
        this.portrait.spriteFrame = this.art.paw;
        this.portrait.color = color("#88985667");
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
