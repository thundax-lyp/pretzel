import {
    _decorator,
    Color,
    Component,
    Graphics,
    UIOpacity,
    Vec3,
    tween,
    type Node,
} from "cc";
import { uiNode } from "../ui/nodes";

export function shatterMirror(
    overlay: Node,
    width: number,
    height: number,
    onFinished: () => void,
): void {
    const impact = new Vec3(width * 0.04, height * 0.08);
    const rim = [
        [-0.5, -0.5],
        [-0.19, -0.5],
        [0.16, -0.5],
        [0.5, -0.5],
        [0.5, -0.22],
        [0.5, 0.17],
        [0.5, 0.5],
        [0.18, 0.5],
        [-0.18, 0.5],
        [-0.5, 0.5],
        [-0.5, 0.23],
        [-0.5, -0.16],
    ].map(([x, y]) => new Vec3(x * width, y * height));
    const inner = rim.map((point, index) =>
        Vec3.lerp(new Vec3(), impact, point, 0.37 + (index % 3) * 0.1),
    );
    const shades = ["#A4C7DC", "#D8F1F7", "#769EBB", "#B9D9E7", "#E9FAFF"].map(
        (hex) => new Color().fromHEX(hex),
    );
    const duration = 0.42;
    const crackTime = 0.09;

    const addShard = (points: readonly Vec3[], index: number): void => {
        const center = points
            .reduce((sum, point) => sum.add(point), new Vec3())
            .multiplyScalar(1 / points.length);
        const shard = uiNode(overlay, "MirrorShard");
        shard.setPosition(center);
        const graphic = shard.addComponent(Graphics);
        const [first, ...rest] = points;
        graphic.moveTo(first.x - center.x, first.y - center.y);
        for (const point of rest)
            graphic.lineTo(point.x - center.x, point.y - center.y);
        graphic.close();
        graphic.fillColor = shades[index % shades.length];
        graphic.fill();
        graphic.strokeColor = new Color(240, 253, 255, 220);
        graphic.lineWidth = 2;
        graphic.stroke();
        const destination = center
            .clone()
            .add(center.clone().subtract(impact).multiplyScalar(0.8))
            .add(new Vec3(0, -height * 0.32));
        tween(shard)
            .delay(crackTime)
            .to(
                duration,
                { position: destination, angle: index % 2 === 0 ? 28 : -32 },
                { easing: "quadIn" },
            )
            .start();
    };

    rim.forEach((point, index) => {
        const next = (index + 1) % rim.length;
        addShard([impact, inner[index], inner[next]], index * 2);
        addShard([inner[index], point, rim[next], inner[next]], index * 2 + 1);
    });
    tween(overlay.addComponent(UIOpacity))
        .delay(crackTime)
        .to(duration, { opacity: 0 }, { easing: "quadIn" })
        .call(onFinished)
        .start();
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
