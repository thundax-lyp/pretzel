import {
    Color,
    EventTouch,
    Graphics,
    Label,
    Mask,
    Node,
    ScrollView,
    Sprite,
    UITransform,
    UIOpacity,
} from "cc";
import type { AnimalCount, RunSnapshot } from "./contract";
import { homeLayout, quantityText, weekDates } from "./home-layout";
import { skin } from "./ui-skin";

// Bottom alpha bounds (alpha > 32) in each cell of the current animal atlas.
const animalFeet = [
    0.9102, 0.9609, 0.9727, 0.9648, 0.9727, 0.9531, 0.9492, 0.9219, 0.9414,
    0.9414, 0.9297, 0.9375, 0.9375, 0.9336, 0.9258, 0.9609, 0.8867, 0.9336,
    0.9375, 0.9062, 0.9375, 0.9375, 0.9375, 0.9375,
];

type HomeData = {
    weekId: string;
    items: AnimalCount[];
    run: RunSnapshot | null;
    reserve: number;
    claim: boolean;
    page: number;
};
type HomeActions = {
    blocked: () => boolean;
    bag: () => void;
    settings: () => void;
    start: () => Promise<void>;
    claim: () => Promise<void>;
    detail: (item?: AnimalCount) => void;
    collection: () => void;
    rank: () => void;
    share?: () => void;
    page: (page: number) => void;
};

export function renderHome(
    parent: Node,
    size: {
        width: number;
        height: number;
        scale: number;
        safeTop: number;
        safeBottom: number;
        capsuleBottom: number;
    },
    data: HomeData,
    actions: HomeActions,
) {
    const { width: w, height: h, scale: s } = size;
    const layout = homeLayout(
        w,
        h,
        size.safeTop,
        size.safeBottom,
        size.capsuleBottom,
    );
    const cream = "#fff8e7",
        body = "#273e37",
        muted = "#53635b",
        green = "#24624f";
    const root = new Node("Home content");
    parent.addChild(root);
    root.layer = parent.layer;
    root.addComponent(UITransform).setContentSize(
        w * s,
        layout.contentHeight * s,
    );
    if (layout.contentHeight > h) {
        const viewport = new Node("Home viewport");
        parent.addChild(viewport);
        viewport.layer = parent.layer;
        viewport.addComponent(UITransform).setContentSize(w * s, h * s);
        viewport.addComponent(Mask);
        root.setParent(viewport);
        root.setPosition(0, ((h - layout.contentHeight) * s) / 2);
        const scroll = viewport.addComponent(ScrollView);
        scroll.horizontal = false;
        scroll.content = root;
    }
    const node = (
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        owner = root,
    ) => {
        const n = new Node(name);
        owner.addChild(n);
        n.layer = parent.layer;
        n.addComponent(UITransform).setContentSize(width * s, height * s);
        n.setPosition((x - w / 2) * s, (layout.contentHeight / 2 - y) * s);
        return n;
    };
    const box = (
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
        radius = 12,
    ) => {
        const n = node(name, x + width / 2, y + height / 2, width, height);
        const g = n.addComponent(Graphics);
        g.fillColor = new Color().fromHEX(color);
        g.roundRect(
            (-width * s) / 2,
            (-height * s) / 2,
            width * s,
            height * s,
            radius * s,
        );
        g.fill();
        return n;
    };
    const text = (
        value: string,
        x: number,
        y: number,
        width: number,
        height: number,
        font = 14,
        color = body,
        bold = false,
        lineHeight = 18,
    ) => {
        const n = node(
            "Home text",
            x + width / 2,
            y + height / 2,
            width,
            height,
        );
        const l = n.addComponent(Label);
        l.string = value;
        l.fontSize = font * s;
        l.lineHeight = lineHeight * s;
        l.isBold = bold;
        l.color = new Color().fromHEX(color);
        l.horizontalAlign = Label.HorizontalAlign.CENTER;
        l.verticalAlign = Label.VerticalAlign.CENTER;
        l.overflow = Label.Overflow.CLAMP;
        return l;
    };
    const hit = (n: Node, action: () => void) => {
        n.on(Node.EventType.TOUCH_START, () => {
            if (actions.blocked()) return;
            const opacity =
                n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
            opacity.opacity = 235;
        });
        const restore = () => {
            const opacity = n.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
        };
        n.on(Node.EventType.TOUCH_CANCEL, restore);
        n.on(Node.EventType.TOUCH_END, restore);
        n.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            if (actions.blocked()) return;
            if (e.getStartLocation().subtract(e.getLocation()).length() < 18) {
                e.propagationStopped = true;
                action();
            }
        });
    };
    const measureNode = node("Text measurement", 0, 0, 1, 1);
    const measurement = measureNode.addComponent(Label);
    measurement.color = new Color(0, 0, 0, 0);
    measurement.overflow = Label.Overflow.NONE;
    const measure = (value: string, font: number) => {
        measurement.string = value;
        measurement.fontSize = font * s;
        measurement.updateRenderData(true);
        return measureNode.getComponent(UITransform)!.width / s;
    };
    const count = (n: number, width: number, font = 14, prefix = "") =>
        quantityText(n, (t) => measure(prefix + t + "只", font) <= width);
    const labelCount = (n: number, width: number, font = 14, prefix = "") =>
        prefix + count(n, width, font, prefix) + "只";
    const total = data.items.reduce((sum, item) => sum + item.receivedCount, 0);
    const cw = w - 32;
    const bag = box("Bag", 16, layout.header, 112, 44, cream);
    text("背包 " + data.reserve, 40, layout.header, 84, 44, 16, body, true, 20);
    hit(bag, actions.bag);
    const bagIcon = node("Bag icon", 36, layout.header + 22, 26, 26);
    skin(bagIcon, "ui-atlas", 12);
    const settings = box("Settings", w - 60, layout.header, 44, 44, cream);
    const settingsIcon = node(
        "Settings icon",
        w - 38,
        layout.header + 22,
        32,
        32,
    );
    skin(settingsIcon, "ui-atlas", 8);
    hit(settings, actions.settings);
    const info = box("Week summary", 16, layout.info, cw, 64, cream);
    hit(info, () => actions.detail());
    text(
        "本周动物园",
        28,
        layout.info + 6,
        156,
        32,
        24,
        "#174b3d",
        true,
        30,
    ).horizontalAlign = Label.HorizontalAlign.LEFT;
    const countWidth = cw - 24 - 156 - 8 - 16;
    let prefix = "已领取 ";
    if (measure(prefix + total + "只", 16) > countWidth) prefix = "领取 ";
    text(
        labelCount(total, countWidth, 16, prefix),
        192,
        layout.info + 6,
        countWidth,
        32,
        16,
        body,
        false,
        20,
    ).horizontalAlign = Label.HorizontalAlign.RIGHT;
    text("›", w - 40, layout.info + 6, 12, 32, 22, body, true, 26);
    text(
        weekDates(data.weekId),
        28,
        layout.info + 38,
        cw - 24,
        20,
        14,
        muted,
    ).horizontalAlign = Label.HorizontalAlign.LEFT;
    box(
        "Quiet meadow",
        16,
        layout.scene,
        cw,
        layout.sceneHeight,
        "#e5f0d2",
        20,
    );
    const terrain = node(
        "Meadow terrain",
        w / 2,
        layout.scene + layout.sceneHeight / 2,
        cw - 24,
        layout.sceneHeight - 24,
    );
    const ground = terrain.addComponent(Graphics);
    const iw = (cw - 32) * s,
        ih = (layout.sceneHeight - 36) * s;
    ground.fillColor = new Color().fromHEX("#d5e5be");
    ground.ellipse(-iw * 0.09, ih * 0.17, iw * 0.45, ih * 0.2);
    ground.fill();
    ground.fillColor = new Color().fromHEX("#dce9c2");
    ground.ellipse(iw * 0.08, -ih * 0.12, iw * 0.44, ih * 0.28);
    ground.fill();
    ground.fillColor = new Color().fromHEX("#eaf0cc");
    ground.ellipse(0, -ih * 0.23, iw * 0.43, ih * 0.16);
    ground.fill();
    ground.strokeColor = new Color().fromHEX("#c6d9aa");
    ground.lineWidth = 1.5 * s;
    for (const side of [-1, 1]) {
        const x = side * iw * 0.43,
            y = ih * 0.31;
        ground.moveTo(x - 5 * s, y);
        ground.quadraticCurveTo(x - 7 * s, y + 6 * s, x - 9 * s, y + 8 * s);
        ground.moveTo(x, y);
        ground.quadraticCurveTo(x + 1 * s, y + 7 * s, x + 4 * s, y + 10 * s);
    }
    ground.stroke();
    const pages = Math.max(1, Math.ceil(data.items.length / layout.capacity));
    const page = Math.min(data.page, pages - 1);
    const visible = data.items.slice(
        page * layout.capacity,
        (page + 1) * layout.capacity,
    );
    const small = data.items.length > 3 || layout.capacity === 3;
    const rows = layout.capacity === 6 && data.items.length > 3 ? 2 : 1;
    const cell = (cw - 34) / 3;
    const slot = small ? 156 : 188;
    const animal = small ? 88 : 120;
    const groupHeight = rows * slot + (rows - 1) * 8;
    const animalsArea = layout.sceneHeight - 16 - 52;
    const top = layout.scene + 8 + Math.max(0, (animalsArea - groupHeight) / 2);
    if (!data.items.length) {
        text(
            "留下第一串小脚印",
            32,
            layout.scene + 65,
            cw - 32,
            30,
            20,
            "#174b3d",
            true,
            26,
        );
        text(
            "通关后，带动物朋友回家",
            32,
            layout.scene + 105,
            cw - 32,
            44,
            16,
            muted,
            false,
            20,
        );
    }
    visible.forEach((item, i) => {
        const x = 24 + (i % 3) * (cell + 9),
            y = top + Math.floor(i / 3) * (slot + 8);
        const shadow = node(
            "Animal shadow",
            x + cell / 2,
            y + animal + 4,
            70,
            12,
        );
        const g = shadow.addComponent(Graphics);
        g.fillColor = new Color().fromHEX("#a7bd9055");
        g.ellipse(0, 0, 30 * s, 4 * s);
        g.fill();
        const artSize = small ? 88 : 96;
        const artworkIndex = Number(item.animal.artworkKey.slice(1)) - 1;
        const foot = animalFeet[artworkIndex] ?? 1;
        const art = node(
            "Animal " + item.animal.id,
            x + cell / 2,
            y + animal + 4 - (foot - 0.5) * artSize,
            artSize,
            artSize,
        );
        skin(
            art,
            "animal-cutouts",
            Number(item.animal.artworkKey.slice(1)) - 1,
        );
        const tagY = y + animal + 8 + 4;
        const tag = box("Animal label", x, tagY, cell, 56, cream, 8);
        let name = item.animal.name;
        let lines: string[] = [];
        let line = "";
        for (const char of name) {
            if (measure(line + char, 14) > cell - 4) {
                lines.push(line);
                line = char;
            } else line += char;
        }
        if (line) lines.push(line);
        if (lines.length > 2) {
            let last = lines[1];
            while (last.length && measure(last + "…", 14) > cell - 4)
                last = last.slice(0, -1);
            lines = [lines[0], last + "…"];
        }
        name = lines.join("\n");
        text(name, x + 2, tagY, cell - 4, 36, 14, body, false, 18);
        const underline = node(
            "Detail underline",
            x + cell / 2,
            tagY + 34,
            Math.min(cell - 12, 70),
            1,
        );
        const ug = underline.addComponent(Graphics);
        ug.strokeColor = new Color().fromHEX("#9eafa1");
        ug.lineWidth = s;
        ug.moveTo(-30 * s, 0);
        ug.lineTo(30 * s, 0);
        ug.stroke();
        text(
            labelCount(item.receivedCount, cell - 12),
            x + 6,
            tagY + 38,
            cell - 12,
            18,
            14,
            muted,
        );
        const target = node(
            "Animal detail target",
            x + cell / 2,
            y + slot / 2,
            cell,
            slot,
        );
        const paintTag = (color: string) => {
            const g = tag.getComponent(Graphics)!;
            g.clear();
            g.fillColor = new Color().fromHEX(color);
            g.roundRect((-cell * s) / 2, -28 * s, cell * s, 56 * s, 8 * s);
            g.fill();
        };
        const resetAnimal = () => {
            if (!art.isValid || !tag.isValid) return;
            const sprite = art.getChildByName("Skin")?.getComponent(Sprite);
            if (sprite) sprite.color = Color.WHITE;
            paintTag(cream);
        };
        target.on(Node.EventType.TOUCH_START, () => {
            if (actions.blocked()) return;
            const sprite = art.getChildByName("Skin")?.getComponent(Sprite);
            if (sprite) sprite.color = new Color().fromHEX("#eef8dd");
            paintTag("#eee6cf");
        });
        target.on(Node.EventType.TOUCH_END, resetAnimal);
        target.on(Node.EventType.TOUCH_CANCEL, resetAnimal);
        hit(target, () => actions.detail(item));
    });
    const pager = layout.scene + layout.sceneHeight - 52;
    text(
        page + 1 + "/" + pages + "页 · 本周" + data.items.length + "种",
        76,
        pager + 3,
        w - 152,
        18,
        14,
        muted,
    );
    text(
        data.items.length ? "点动物查看详情" : "开始挑战，收集动物",
        76,
        pager + 23,
        w - 152,
        18,
        14,
        muted,
    );
    const turn = (delta: number) => {
        const next = page + delta;
        if (next >= 0 && next < pages) actions.page(next);
    };
    if (page > 0) {
        const prev = node("Previous animals", 46, pager + 22, 44, 44);
        text("‹", 24, pager, 44, 44, 28, green, true, 32);
        hit(prev, () => turn(-1));
    }
    if (page < pages - 1) {
        const next = node("Next animals", w - 46, pager + 22, 44, 44);
        text("›", w - 68, pager, 44, 44, 28, green, true, 32);
        hit(next, () => turn(1));
    }
    root.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
        if (actions.blocked()) return;
        const delta = event.getLocation().x - event.getStartLocation().x;
        if (Math.abs(delta) > 40 * s) turn(delta < 0 ? 1 : -1);
    });
    if (data.claim) {
        const reward = box("Animal claim", 16, layout.claim, cw, 48, cream);
        const rg = reward.getComponent(Graphics)!;
        rg.strokeColor = new Color().fromHEX("#bc9352");
        rg.lineWidth = s;
        rg.roundRect((-cw * s) / 2, -24 * s, cw * s, 48 * s, 12 * s);
        rg.stroke();
        const caption = text(
            "有一位动物朋友\n等你领取",
            28,
            layout.claim + 4,
            cw - 96,
            40,
            16,
            body,
            false,
            20,
        );
        caption.horizontalAlign = Label.HorizontalAlign.LEFT;
        text("领取", w - 92, layout.claim + 2, 64, 44, 16, green, true, 20);
        hit(reward, () => {
            caption.string = "正在确认领取";
            void actions.claim();
        });
    }
    const aw = Math.round(cw * 0.86),
        ax = (w - aw) / 2;
    const action = box("Start challenge", ax, layout.action, aw, 56, green, 16);
    const border = action.getComponent(Graphics)!;
    border.strokeColor = new Color().fromHEX("#b78d4d");
    border.lineWidth = 2 * s;
    border.roundRect((-aw * s) / 2, -28 * s, aw * s, 56 * s, 16 * s);
    border.stroke();
    const run = data.run;
    const caption = text(
        run ? "继续挑战" : "开始挑战",
        ax + 8,
        layout.action + (run ? 6 : 16),
        aw - 16,
        24,
        20,
        "#ffffff",
        true,
        24,
    );
    if (run) {
        const progress =
            run.status === "LEVEL_1_PASSED"
                ? "教学已完成 · 进入第二关"
                : run.status === "ACTIVE"
                  ? "第" +
                    run.level +
                    "关 · " +
                    Math.min(run.questionIndex + 1, run.questions.length) +
                    "/" +
                    run.questions.length +
                    "题"
                  : "查看本局结果";
        text(
            progress,
            ax + 8,
            layout.action + 34,
            aw - 16,
            16,
            12,
            "#ffffff",
            false,
            16,
        );
    }
    hit(action, () => {
        caption.string = "正在准备…";
        void actions.start().finally(() => {
            if (caption.isValid) caption.string = run ? "继续挑战" : "开始挑战";
        });
    });
    box("Quiet navigation", 16, layout.navigation, cw, 44, cream, 12);
    const navs = [
        { name: "动物图鉴", cell: 9, action: actions.collection },
        { name: "排行榜", cell: 10, action: actions.rank },
        { name: "分享", cell: 11, action: actions.share },
    ];
    navs.forEach((nav, i) => {
        const nx = 16 + (i * cw) / 3;
        const target = node(
            nav.name,
            nx + cw / 6,
            layout.navigation + 22,
            cw / 3,
            44,
        );
        const icon = node(
            nav.name + " icon",
            nx + cw / 6 - 29,
            layout.navigation + 22,
            24,
            24,
        );
        skin(icon, "ui-atlas", nav.cell);
        text(
            nav.name,
            nx + cw / 6 - 12,
            layout.navigation + 12,
            74,
            20,
            14,
            nav.action ? muted : "#7a8278",
        );
        if (nav.action) hit(target, nav.action);
    });
    measureNode.destroy();
    return { page, layout, dates: weekDates(data.weekId, true) };
}
