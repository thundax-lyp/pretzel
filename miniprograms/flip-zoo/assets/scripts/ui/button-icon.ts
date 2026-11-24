import { Graphics, type Node } from "cc";
import { color, uiNode } from "./nodes";

type ButtonIcon =
    | "menu"
    | "home"
    | "trophy"
    | "share"
    | "retry"
    | "feedback"
    | "support"
    | "abandon"
    | "back";

export function drawButtonIcon(
    parent: Node,
    icon: ButtonIcon,
    x: number,
    y: number,
    size: number,
    fill: string,
): void {
    const node = uiNode(parent, "ButtonIcon");
    node.setPosition(x, y);
    node.setScale(size / 40, size / 40, 1);
    const graphic = node.addComponent(Graphics);
    graphic.fillColor = color(fill);
    graphic.strokeColor = graphic.fillColor;
    graphic.lineWidth = 5;
    switch (icon) {
        case "back":
            graphic.lineCap = Graphics.LineCap.ROUND;
            graphic.lineJoin = Graphics.LineJoin.ROUND;
            graphic.moveTo(6, -15);
            graphic.bezierCurveTo(22, -13, 20, 8, 6, 8);
            graphic.lineTo(-16, 8);
            graphic.moveTo(-5, 18);
            graphic.lineTo(-16, 8);
            graphic.lineTo(-5, -2);
            graphic.stroke();
            break;
        case "menu":
            for (const line of [-11, 0, 11])
                graphic.roundRect(-16, line - 3, 32, 6, 3);
            graphic.fill();
            break;
        case "home":
            graphic.moveTo(-20, 2);
            graphic.lineTo(0, 19);
            graphic.lineTo(20, 2);
            graphic.close();
            graphic.rect(-15, -16, 11, 19);
            graphic.rect(4, -16, 11, 19);
            graphic.rect(-5, -4, 10, 7);
            graphic.fill();
            break;
        case "trophy":
            graphic.roundRect(-19, -1, 38, 16, 6);
            graphic.stroke();
            graphic.roundRect(-12, -4, 24, 23, 7);
            graphic.rect(-3, -15, 6, 14);
            graphic.roundRect(-13, -19, 26, 6, 3);
            graphic.fill();
            break;
        case "share":
            graphic.moveTo(12, 14);
            graphic.lineTo(-13, 0);
            graphic.lineTo(12, -14);
            graphic.stroke();
            graphic.circle(12, 14, 7);
            graphic.circle(-13, 0, 7);
            graphic.circle(12, -14, 7);
            graphic.fill();
            break;
        case "retry":
            graphic.arc(0, 0, 14, 0.85, Math.PI * 2.5, true);
            graphic.stroke();
            graphic.moveTo(3, 18);
            graphic.lineTo(18, 17);
            graphic.lineTo(16, 3);
            graphic.close();
            graphic.fill();
            break;
        case "feedback":
            graphic.roundRect(-17, -10, 34, 26, 9);
            graphic.moveTo(-10, -8);
            graphic.lineTo(-12, -17);
            graphic.lineTo(0, -8);
            graphic.close();
            graphic.fill();
            graphic.fillColor = color("#FFFFFF");
            for (const dot of [-8, 0, 8]) graphic.circle(dot, 3, 2);
            graphic.fill();
            break;
        case "support":
            graphic.arc(0, 0, 15, 0, Math.PI, true);
            graphic.stroke();
            graphic.roundRect(-18, -12, 9, 17, 4);
            graphic.roundRect(9, -12, 9, 17, 4);
            graphic.fill();
            break;
        case "abandon":
            graphic.circle(0, 0, 15);
            graphic.moveTo(-10, -10);
            graphic.lineTo(10, 10);
            graphic.stroke();
            break;
    }
}
