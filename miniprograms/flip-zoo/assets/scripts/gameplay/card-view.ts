import { Color, Graphics, Label, Node, Sprite, UITransform } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { CARD_INSET, CARD_RADIUS, isInsideCardOutline } from "./card-outline";
import { FULL_EXPOSURE } from "./round";

import { color, label, picture, uiNode } from "../ui/nodes";

const TILE_DEPTH = 8;

export class CardView {
    readonly node: Node;
    private readonly body: Graphics;
    private readonly skin?: Sprite;
    private readonly art: ZooArtwork;
    private readonly portrait: Sprite;
    private readonly portraitSize: UITransform;
    private readonly mark: Label;
    private readonly width: number;
    private readonly elevation: number;
    private readonly raised: boolean;
    private readonly drawing: Node;
    private depthY = TILE_DEPTH;
    private readonly height: number;
    private lastAppearance = "";

    constructor(
        parent: Node,
        name: string,
        width: number,
        height: number,
        art: ZooArtwork,
        elevation?: number,
    ) {
        this.art = art;
        this.width = width;
        this.height = height;
        this.raised = elevation !== undefined;
        this.elevation = elevation ?? 0;
        this.node = uiNode(parent, name, width, height);
        const drawing = uiNode(this.node, "Drawing");
        this.drawing = drawing;
        this.setProjectionScale(1);
        if (this.raised) {
            this.skin = picture(drawing, "TileSkin", art.raisedTile, width);
            this.skin.node
                .getComponent(UITransform)!
                .setContentSize(width, height);
        }
        this.body = (
            this.skin ? uiNode(drawing, "CardGraphics") : drawing
        ).addComponent(Graphics);
        this.portrait = picture(drawing, "Portrait", art.paw, width);
        this.portrait.trim = false;
        this.portraitSize = this.portrait.node.getComponent(UITransform)!;
        this.mark = label(drawing, "", 36);
        this.mark.isBold = true;
    }

    get drawingOffsetY(): number {
        return this.elevation * this.depthY;
    }

    get faceCenterY(): number {
        return this.raised ? (19 * this.height) / 256 : 0;
    }

    private get pawSize(): number {
        return (Math.min(this.width, this.height) - 12) * 0.56;
    }

    setArtworkVisible(visible: boolean): void {
        this.drawing.active = visible;
    }

    keepPortraitSquare(scaleX: number, scaleY: number): void {
        this.portrait.node.setScale(1, scaleX / scaleY, 1);
    }

    setProjectionScale(scaleY: number): void {
        if (!this.raised) return;
        this.depthY = TILE_DEPTH / scaleY;
        this.drawing.setPosition(0, this.drawingOffsetY);
        this.lastAppearance = "";
    }

    private get faceLift(): number {
        const inset = 2 * CARD_INSET;
        const squareFace = (this.width - inset) * this.portrait.node.scale.y;
        return Math.max(0, this.height - inset - squareFace);
    }

    containsBoardPoint(x: number, y: number): boolean {
        const { position } = this.node;
        return isInsideCardOutline(
            x - position.x,
            y - position.y - this.drawingOffsetY,
            this.width,
            this.height,
        );
    }

    show(
        kind: number | null,
        exposure: number,
        selectable: boolean,
        upperCards: readonly CardView[] = [],
        bound = false,
    ): void {
        this.node.active = true;
        const appearance = `${kind}/${exposure}/${selectable}/${bound}/${upperCards.map((card) => card.node.name).join(",")}`;
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;

        this.mark.string = "";
        if (this.skin) this.skin.node.active = true;
        const faceDown = kind === null || exposure === 0;
        this.paintTile(faceDown, selectable, upperCards, bound);
        // A fully covered tile can still contribute a visible strip after
        // the drawing offset. Show its body without exposing its portrait.
        this.portrait.node.active = exposure !== 0;
        if (exposure === 0) return;
        const faceCenter = this.faceCenterY;
        if (kind === null) {
            this.portrait.spriteFrame = this.art.paw;
            this.portrait.color = color(
                this.raised ? "#52667544" : "#52723B38",
            );
            this.portraitSize.setContentSize(this.pawSize, this.pawSize);
            this.portrait.node.setPosition(0, this.raised ? faceCenter : 3);
            return;
        }

        const partial = exposure !== FULL_EXPOSURE;
        const quadrant = [0, 1, 2, 3].find((index) => exposure & (1 << index))!;
        const rowMask = quadrant < 2 ? 0b0011 : 0b1100;
        const columnMask = quadrant % 2 === 0 ? 0b0101 : 0b1010;
        const centerX = (exposure & rowMask) === rowMask;
        const centerY = (exposure & columnMask) === columnMask;
        const size =
            (Math.min(this.width, this.height) - 12) * (partial ? 0.44 : 0.96);
        const portraitSize = this.raised ? (this.width * 77) / 94 : size;
        this.portrait.spriteFrame = this.art.animals[kind];
        this.portrait.color = color(
            selectable ? "#FFFFFF" : this.raised ? "#CED4C8" : "#F4F2DF",
        );
        this.portraitSize.setContentSize(portraitSize, portraitSize);
        if (this.raised) {
            this.portrait.node.setPosition(0, faceCenter);
            return;
        }
        this.portrait.node.setPosition(
            partial && !centerX
                ? ((quadrant % 2 === 0 ? -1 : 1) * this.width) / 4
                : 0,
            partial
                ? centerY
                    ? 0
                    : ((quadrant < 2 ? 1 : -1) * this.height) / 4
                : 3,
        );
    }

    private paintTile(
        faceDown: boolean,
        selectable: boolean,
        upperCards: readonly CardView[],
        bound: boolean,
    ): void {
        const { body, width, height } = this;
        const x = -width / 2 + CARD_INSET;
        const y = -height / 2 + CARD_INSET;
        const faceWidth = -2 * x;
        const tileHeight = -2 * y;
        const edge = this.raised ? this.faceLift : 6;
        body.clear();
        if (this.skin?.node.active) {
            this.skin.spriteFrame = faceDown
                ? this.art.raisedTileBack
                : this.art.raisedTile;
            this.skin.color = color(
                faceDown
                    ? selectable
                        ? bound
                            ? "#CCD8DF"
                            : "#E1EBF0"
                        : bound
                          ? "#A9B8C1"
                          : "#BDC9D0"
                    : selectable
                      ? bound
                          ? "#FFF0CC"
                          : "#FFFFFF"
                      : bound
                        ? "#D6CEA8"
                        : "#DEE4DA",
            );
            return;
        }
        body.lineWidth = 2;
        body.strokeColor = color(selectable ? "#49763F" : "#648056");

        body.fillColor = color("#83B55A");
        body.roundRect(x, y, faceWidth, tileHeight, CARD_RADIUS);
        body.fill();
        body.stroke();

        body.fillColor = color(
            faceDown
                ? selectable
                    ? bound
                        ? "#ADC975"
                        : "#D6EDAA"
                    : bound
                      ? "#A6B986"
                      : "#B9CE9A"
                : selectable
                  ? bound
                      ? "#F3E7BC"
                      : "#FFF7D9"
                  : bound
                    ? "#DFDBB6"
                    : "#E7E7C4",
        );
        body.roundRect(x, y + edge, faceWidth, tileHeight - edge, CARD_RADIUS);
        body.fill();
        body.stroke();
        if (selectable) {
            body.fillColor = new Color(255, 255, 255, 145);
            body.roundRect(x + 8, y + height - 11, width - 20, 3, 1.5);
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
        const { body, node, drawingOffsetY } = this;
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
            const x = upper.node.position.x - node.position.x;
            const y =
                upper.node.position.y -
                node.position.y +
                upper.drawingOffsetY -
                drawingOffsetY;
            const l = x - upper.width / 2 + CARD_INSET;
            const r = x + upper.width / 2 - CARD_INSET;
            const b = y - upper.height / 2 + CARD_INSET;
            const t = y + upper.height / 2 - CARD_INSET;
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
        if (this.skin) this.skin.node.active = false;
        this.portrait.node.active = !locked;
        this.portrait.spriteFrame = this.art.paw;
        this.portrait.color = color("#88985667");
        const size = this.raised ? this.pawSize : 30;
        this.portraitSize.setContentSize(size, size);
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
