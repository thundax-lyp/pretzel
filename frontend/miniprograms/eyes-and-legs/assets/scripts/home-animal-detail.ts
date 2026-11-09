import {
    BlockInputEvents,
    Color,
    EventTouch,
    Graphics,
    Label,
    Mask,
    Node,
    ScrollView,
    UITransform,
} from "cc";
import type { AnimalCount } from "./contract";
import { skin } from "./ui-skin";

/** This week's animal detail has its own layout, independent of notice/celebration modals. */
export function homeAnimalDetail(
    parent: Node,
    item: AnimalCount,
    size: {
        width: number;
        height: number;
        scale: number;
        top: number;
        bottom: number;
    },
    close: () => void,
) {
    const { width: w, height: h, scale: s } = size;
    const shade = new Node("Weekly animal detail");
    shade.layer = parent.layer;
    parent.addChild(shade);
    shade.addComponent(UITransform).setContentSize(w * s, h * s);
    shade.addComponent(BlockInputEvents);
    const dim = shade.addComponent(Graphics);
    dim.fillColor = new Color().fromHEX("#183c3499");
    dim.rect((-w * s) / 2, (-h * s) / 2, w * s, h * s);
    dim.fill();
    const width = Math.min(350, w - 40),
        height = Math.min(536, h - size.top - size.bottom - 32);
    const top = size.top + 16 + (h - size.top - size.bottom - 32 - height) / 2;
    const panel = new Node("Animal detail panel");
    panel.layer = parent.layer;
    shade.addChild(panel);
    panel.setPosition(0, (h / 2 - top - height / 2) * s);
    panel.addComponent(UITransform).setContentSize(width * s, height * s);
    const g = panel.addComponent(Graphics);
    g.fillColor = new Color().fromHEX("#fff8e7");
    g.roundRect(
        (-width * s) / 2,
        (-height * s) / 2,
        width * s,
        height * s,
        20 * s,
    );
    g.fill();
    const point = (name: string, y: number, width: number, height: number) => {
        const n = new Node(name);
        n.layer = parent.layer;
        panel.addChild(n);
        n.addComponent(UITransform).setContentSize(width * s, height * s);
        n.setPosition(0, panel.getComponent(UITransform)!.height / 2 - y * s);
        return n;
    };
    const label = (
        name: string,
        value: string,
        y: number,
        width: number,
        height: number,
        font: number,
        lineHeight: number,
    ) => {
        const n = point(name, y, width, height);
        const l = n.addComponent(Label);
        l.string = value;
        l.fontSize = font * s;
        l.lineHeight = lineHeight * s;
        l.color = new Color().fromHEX("#273e37");
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.overflow = Label.Overflow.CLAMP;
        return l;
    };
    label("Detail heading", "本周动物朋友", 32, width - 32, 28, 18, 26).isBold =
        true;
    const art = point("Selected animal", 142, 184, 184);
    skin(art, "animal-cutouts", Number(item.animal.artworkKey.slice(1)) - 1);
    const viewportTop = 250,
        viewportHeight = Math.max(54, height - viewportTop - 112);
    const viewport = point(
        "Animal name viewport",
        viewportTop + viewportHeight / 2,
        width - 32,
        viewportHeight,
    );
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = false;
    const content = new Node("Full animal name");
    content.layer = parent.layer;
    viewport.addChild(content);
    const transform = content.addComponent(UITransform);
    transform.setContentSize((width - 32) * s, viewportHeight * s);
    const name = content.addComponent(Label);
    name.string = item.animal.name;
    name.fontSize = 18 * s;
    name.lineHeight = 26 * s;
    name.color = new Color().fromHEX("#273e37");
    name.horizontalAlign = Label.HorizontalAlign.CENTER;
    name.verticalAlign = Label.VerticalAlign.CENTER;
    name.overflow = Label.Overflow.RESIZE_HEIGHT;
    name.updateRenderData(true);
    const full = Math.max(viewportHeight * s, transform.height);
    transform.setContentSize((width - 32) * s, full);
    content.setPosition(0, (viewportHeight * s - full) / 2);
    scroll.content = content;
    const countY = viewportTop + viewportHeight + 24;
    label(
        "Exact count",
        "本周领取 " + item.receivedCount + " 只",
        countY,
        width - 32,
        24,
        16,
        24,
    );
    const button = point("Close animal detail", height - 42, width - 40, 44);
    const bg = button.addComponent(Graphics);
    bg.fillColor = new Color().fromHEX("#24624f");
    bg.roundRect(
        (-(width - 40) * s) / 2,
        -22 * s,
        (width - 40) * s,
        44 * s,
        12 * s,
    );
    bg.fill();
    label(
        "Close caption",
        "返回动物园",
        height - 42,
        width - 48,
        28,
        16,
        24,
    ).color = Color.WHITE;
    button.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
        event.propagationStopped = true;
        if (
            event.getStartLocation().subtract(event.getLocation()).length() < 18
        )
            close();
    });
    return shade;
}
