import {
    _decorator,
    Color,
    Component,
    Graphics,
    UITransform,
    Vec3,
    tween,
    type Node,
    type SpriteFrame,
} from "cc";
import { picture } from "../ui/nodes";

export function openGardenGate(
    overlay: Node,
    doors: readonly SpriteFrame[],
    width: number,
    height: number,
    onFinished: () => void,
): void {
    const size = doors[0].originalSize;
    const scale = Math.max(width / (2 * size.width), height / size.height);
    const doorWidth = size.width * scale;
    const doorHeight = size.height * scale;
    doors.forEach((frame, index) => {
        const left = index === 0;
        const door = picture(
            overlay,
            left ? "LeftGardenDoor" : "RightGardenDoor",
            frame,
            doorWidth,
            doorHeight,
        ).node;
        door.getComponent(UITransform)!.setAnchorPoint(left ? 0 : 1, 0.5);
        door.setPosition(left ? -doorWidth : doorWidth, 0);
        const opening = tween(door).to(
            0.3,
            { scale: new Vec3(0, 1, 1) },
            { easing: "quadInOut" },
        );
        if (!left) opening.call(onFinished);
        opening.start();
    });
}

const COLORS = [
    [255, 200, 74],
    [241, 128, 104],
    [93, 177, 136],
    [113, 172, 222],
] as const;

const { ccclass } = _decorator;

@ccclass("FlipZooClearCelebration")
export class ClearCelebration extends Component {
    private badge!: Node;
    private graphics!: Graphics;
    private elapsed = 0;
    private finale = false;

    play(badge: Node, finale: boolean): void {
        this.badge = badge;
        this.finale = finale;
        this.graphics = this.node.addComponent(Graphics);
        this.badge.setScale(0.68, 0.68, 1);
    }

    update(dt: number): void {
        this.elapsed += dt;
        const duration = this.finale ? 2.3 : 1.15;
        if (this.elapsed >= duration) {
            this.badge.setScale(1, 1, 1);
            this.node.destroy();
            return;
        }

        const bounce = Math.min(this.elapsed / 0.55, 1);
        const scale =
            1 - 0.32 * (1 - bounce) ** 3 + 0.28 * Math.sin(Math.PI * bounce);
        this.badge.setScale(scale, scale, 1);

        const graphic = this.graphics;
        const { y: center } = this.badge.position;
        graphic.clear();
        const burst = Math.min(this.elapsed / 1.15, 1);
        if (burst < 1) {
            const reach = 1 - (1 - burst) ** 2;
            const alpha = Math.round(255 * (1 - burst ** 2));
            graphic.strokeColor = new Color(255, 198, 65, alpha);
            graphic.lineWidth = 3;
            graphic.circle(0, center, 57 + reach * (this.finale ? 85 : 52));
            graphic.stroke();
            const count = this.finale ? 16 : 10;
            for (let i = 0; i < count; i += 1) {
                const angle = (2 * Math.PI * i) / count;
                const distance = 52 + reach * (this.finale ? 175 : 110);
                const [r, g, b] = COLORS[i % COLORS.length];
                graphic.fillColor = new Color(r, g, b, alpha);
                this.star(
                    Math.cos(angle) * distance,
                    center + Math.sin(angle) * distance * 0.6,
                    (i % 2 === 0 ? 15 : 9) * (1 - 0.5 * burst),
                );
            }
        }

        if (this.finale) {
            for (let i = 0; i < 28; i += 1) {
                const time = this.elapsed - (i % 5) * 0.09;
                if (time < 0) continue;
                const x = ((i * 109) % 686) - 343 + Math.sin(time * 4 + i) * 24;
                const y =
                    550 -
                    (i % 7) * 34 -
                    time * (155 + (i % 4) * 40) -
                    34 * time ** 2;
                const opacity = Math.min(1, (duration - this.elapsed) / 0.5);
                const [r, g, b] = COLORS[i % COLORS.length];
                graphic.fillColor = new Color(
                    r,
                    g,
                    b,
                    Math.round(235 * opacity),
                );
                const width = 4 + Math.abs(Math.cos(time * 9 + i)) * 10;
                graphic.roundRect(x, y, width, i % 2 === 0 ? 7 : 14, 2);
                graphic.fill();
            }
        }
    }

    private star(x: number, y: number, size: number): void {
        const graphic = this.graphics;
        graphic.moveTo(x, y + size);
        for (let point = 1; point < 8; point += 1) {
            const angle = (point * Math.PI) / 4;
            const radius = point % 2 === 0 ? size : size * 0.31;
            graphic.lineTo(
                x + Math.sin(angle) * radius,
                y + Math.cos(angle) * radius,
            );
        }
        graphic.close();
        graphic.fill();
    }
}
