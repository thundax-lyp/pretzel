import { Color, Graphics, Label, Node, Sprite, UITransform } from "cc";
import type { ZooArtwork } from "../services/artwork";
import { FULL_EXPOSURE } from "./round";

import { color, label, picture, uiNode } from "../ui/nodes";

export class CardView {
    readonly node: Node;
    private readonly body: Graphics;
    private readonly art: ZooArtwork;
    private readonly portrait: Sprite;
    private readonly portraitSize: UITransform;
    private readonly mark: Label;
    private readonly width: number;
    private height: number;
    private lastAppearance = "";

    constructor(
        parent: Node,
        name: string,
        width: number,
        height: number,
        art: ZooArtwork,
    ) {
        this.art = art;
        this.width = width;
        this.height = height;
        this.node = uiNode(parent, name, width, height);
        this.body = this.node.addComponent(Graphics);
        this.portrait = picture(this.node, "Portrait", art.paw, width);
        this.portraitSize = this.portrait.node.getComponent(UITransform)!;
        this.mark = label(this.node, "", 36);
        this.mark.isBold = true;
    }

    setHeight(height: number): void {
        if (height === this.height) return;
        this.height = height;
        this.node.getComponent(UITransform)!.setContentSize(this.width, height);
        this.lastAppearance = "";
    }

    show(kind: number | null, exposure: number, selectable: boolean): void {
        this.node.active = exposure !== 0;
        if (!this.node.active) return;
        const appearance = `${kind}/${exposure}/${selectable}`;
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;

        this.mark.string = "";
        const faceDown = kind === null;
        this.paintTile(faceDown, selectable);
        this.portrait.node.active = true;
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

    private paintTile(faceDown: boolean, selectable: boolean): void {
        const { body, width, height } = this;
        const x = -width / 2 + 2;
        const y = -height / 2 + 2;
        const edge = 6;
        body.clear();
        body.lineWidth = 2;
        body.strokeColor = color(selectable ? "#49763F" : "#648056");

        body.fillColor = color(selectable ? "#83B55A" : "#88A577");
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
            body.fillColor = new Color(255, 255, 255, 145);
            body.roundRect(x + 8, y + height - 11, width - 20, 3, 1.5);
            body.fill();
        }
    }

    showEmpty(lockedLabel = ""): void {
        const locked = lockedLabel !== "";
        const appearance = lockedLabel || "empty";
        if (this.lastAppearance === appearance) return;
        this.lastAppearance = appearance;
        this.portrait.node.active = !locked;
        this.portrait.spriteFrame = this.art.paw;
        this.portrait.color = new Color(255, 255, 255, 72);
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
