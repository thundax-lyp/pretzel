import { Color, Graphics, Node, tween, UITransform, Vec3 } from "cc";

export function deal(node: Node, index: number) {
    const destination = node.position.clone();
    node.setPosition(-280 + (index % 4) * 12, 420 + (index % 3) * 12);
    node.setScale(0.35, 0.35, 1);
    node.angle = -12;
    tween(node)
        .delay(index * 0.012)
        .to(
            0.36,
            { position: destination, scale: new Vec3(1, 1, 1), angle: 0 },
            { easing: "quadOut" },
        )
        .start();
}

export function pop(node: Node) {
    node.setScale(0.85, 0.85, 1);
    tween(node)
        .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
        .start();
}

export function shake(node: Node) {
    const x = node.position.x;
    tween(node)
        .by(0.06, { position: new Vec3(-10, 0, 0) })
        .by(0.08, { position: new Vec3(20, 0, 0) })
        .to(0.08, { position: new Vec3(x, node.position.y, 0) })
        .start();
}

export function fly(node: Node, destination: Vec3, finish?: () => void) {
    tween(node)
        .to(
            0.28,
            { position: destination, scale: new Vec3(0.75, 0.75, 1) },
            { easing: "quadInOut" },
        )
        .call(() => {
            if (node.isValid) node.destroy();
            finish?.();
        })
        .start();
}

export function celebrate(parent: Node, x: number, y: number, count = 22) {
    const colors = ["#ffcb42", "#ffffff", "#79d346", "#ff8b64"];
    for (let index = 0; index < count; index++) {
        const piece = new Node("Celebration");
        piece.layer = parent.layer;
        parent.addChild(piece);
        piece.addComponent(UITransform).setContentSize(12, 12);
        piece.setPosition(x, y);
        const graphics = piece.addComponent(Graphics);
        graphics.fillColor = new Color().fromHEX(colors[index % colors.length]);
        graphics.roundRect(-5, -5, 10, 10, 2);
        graphics.fill();
        const angle = (index / count) * Math.PI * 2;
        const distance = 100 + (index % 4) * 38;
        tween(piece)
            .to(
                0.55,
                {
                    position: new Vec3(
                        x + Math.cos(angle) * distance,
                        y + Math.sin(angle) * distance,
                    ),
                    angle: index * 41,
                },
                { easing: "quadOut" },
            )
            .to(0.25, { scale: Vec3.ZERO })
            .call(() => piece.destroy())
            .start();
    }
}
