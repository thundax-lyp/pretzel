import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Sprite,
    UITransform,
    Vec3,
    type EventTouch,
    type SpriteFrame,
} from "cc";
import { WECHAT } from "cc/env";
import { loadZooArtwork, type ZooArtwork } from "./artwork";
import { CardView, color, label, picture, uiNode } from "./card-view";
import { ClearCelebration } from "./clear-celebration";
import {
    FULL_EXPOSURE,
    GROUPS,
    PROPS,
    Round,
    SLOT_LIMIT,
    isBoardKinds,
    type Group,
    type Level,
    type Prop,
} from "./round";

const { ccclass } = _decorator;

const GROUP_LABELS: Record<Group, string> = {
    A: "A  全暗",
    B: "B  可点即亮",
    C: "C  预亮 6 张",
};

const GROUP_HINTS: Record<Group, string> = {
    A: "全牌背面，取牌时翻开同层四邻",
    B: "完全无遮挡的牌自动亮面",
    C: "开局预亮 6 张，取牌时翻开同层四邻",
};

const PROP_LABELS: Record<Prop, string> = {
    undo: "撤回",
    peek: "透视",
    remove: "移除",
    shuffle: "洗牌",
};
const PROP_MESSAGES: Record<Prop, string> = {
    undo: "上一张已回原位，仍保持亮面",
    peek: "已翻开最高层的暗牌",
    remove: "已用最高层的同款补齐并消除一组",
    shuffle: "桌面已重新洗牌",
};
const PROP_UNAVAILABLE: Record<Prop, string> = {
    undo: "当前没有可以撤回的牌",
    peek: "最高层没有暗牌",
    remove: "最高层的牌暂时凑不成槽内同款",
    shuffle: "当前无法洗牌，次数保留",
};

interface Control {
    readonly graphic: Graphics;
    readonly caption: Label;
    readonly width: number;
    readonly height: number;
    readonly icon?: Sprite;
}

@ccclass("FlipZooStartScreen")
export class FlipZooStartScreen extends Component {
    private art!: ZooArtwork;
    private gameRoot!: Node;
    private round!: Round;
    private board?: Node;
    private cardSize = 0;
    private cards: CardView[] = [];
    private readonly slots: CardView[] = [];
    private readonly groupButtons = new Map<Group, Control>();
    private readonly propButtons = new Map<Prop, Control>();
    private overlay?: Node;
    private requestVersion = 0;
    private loadingBoard = false;
    private progress!: Label;
    private steps?: Label;
    private slotStatus!: Label;
    private message!: Label;
    private otherLevel?: Control;
    private tutorialRibbon!: Node;

    async start(): Promise<void> {
        const loading = label(this.node, "正在打开动物园…", 34);
        try {
            this.art = await loadZooArtwork();
        } catch (error) {
            if (!this.isValid) return;
            console.error(error);
            loading.string = "图片加载失败";
            const retry = this.button(
                "重新加载",
                0,
                -92,
                250,
                () => {
                    loading.node.destroy();
                    retry.graphic.node.destroy();
                    void this.start();
                },
                this.node,
            );
            return;
        }
        if (!this.isValid) return;
        loading.node.destroy();
        picture(this.node, "ZooGarden", this.art.garden, 750, 1334);
        this.gameRoot = uiNode(this.node, "Game", 750, 1334);
        this.createGame();
        this.showWelcome();
    }

    private createGame(): void {
        this.panel(this.gameRoot, "Sign", 608, 520, 77, "#264F3C", "#E9C984");
        this.text("翻翻动物园", 608, 50, "#FFF0BD").isBold = true;
        if (!WECHAT) {
            this.text("本地试玩 · 第二关对照", 553, 24, "#355A46");
            GROUPS.forEach((group, index) => {
                const button = this.button(
                    GROUP_LABELS[group],
                    (index - 1) * 221,
                    498,
                    208,
                    () => void this.startMainBoard(group),
                );
                this.groupButtons.set(group, button);
            });
            this.steps = this.text("", 400, 23, "#466855");
        }
        this.progress = this.text("", 435, 30, "#264F3C");
        this.progress.isBold = true;
        this.message = this.text("", 369, 24, "#355A46");
        this.panel(this.gameRoot, "PlayMat", 0, 594, 714, "#C6D6A2", "#FAEFC9");
        this.panel(
            this.gameRoot,
            "SlotTray",
            -422,
            682,
            129,
            "#254D3C",
            "#E6C887",
        );
        this.slotStatus = this.text("", -375, 24);
        for (let index = 0; index < SLOT_LIMIT; index += 1) {
            const slot = new CardView(
                this.gameRoot,
                `Slot-${index + 1}`,
                70,
                this.art,
            );
            slot.node.setPosition((index - 3) * 94, -427);
            slot.node.on(Node.EventType.TOUCH_END, () =>
                this.onSlotTouch(index),
            );
            this.slots.push(slot);
        }
        this.button(
            "重开本关",
            WECHAT ? 0 : -169,
            -521,
            296,
            () => this.restartRound(),
            this.gameRoot,
            60,
        );
        if (!WECHAT) {
            this.otherLevel = this.button(
                "",
                169,
                -521,
                296,
                () => {
                    if (this.round.level === 1)
                        void this.startMainBoard(this.round.group);
                    else this.openRound(1, this.round.group);
                },
                this.gameRoot,
                60,
            );
        }
        this.tutorialRibbon = this.panel(
            this.gameRoot,
            "TutorialRibbon",
            -608,
            474,
            52,
            "#345C43",
            "#E2C785",
        );
        label(this.tutorialRibbon, "找到三张同款，就能一起消除", 24, "#FFF2C9");
        PROPS.forEach((prop, index) => {
            const button = this.button(
                PROP_LABELS[prop],
                (index - 1.5) * 170,
                -601,
                158,
                () => this.onPropTouch(prop),
                this.gameRoot,
                90,
                this.art.props[prop],
            );
            this.propButtons.set(prop, button);
        });
        this.openRound(1, "C");
    }

    private restartRound(): void {
        if (this.round.level === 2) void this.startMainBoard(this.round.group);
        else this.openRound(1, this.round.group);
    }

    private async startMainBoard(group: Group): Promise<void> {
        if (this.overlay) return;
        this.unschedule(this.advanceToMainBoard);
        const version = ++this.requestVersion;
        let boardKinds: readonly number[] | undefined;
        if (
            !WECHAT &&
            typeof location !== "undefined" &&
            location.origin === "http://127.0.0.1:8874"
        ) {
            this.loadingBoard = true;
            this.message.string = "读取第二关牌局…";
            try {
                const response = await fetch("/api/board", {
                    signal: AbortSignal.timeout(3000),
                });
                const data: unknown = response.ok
                    ? await response.json()
                    : null;
                if (!isBoardKinds(data)) throw new Error("Invalid board");
                boardKinds = data;
            } catch {
                if (this.isValid && version === this.requestVersion) {
                    this.loadingBoard = false;
                    this.message.string = "读取牌局失败，点击重开或组别重试";
                }
                return;
            }
        }
        if (this.isValid && version === this.requestVersion) {
            this.openRound(2, group, boardKinds);
        }
    }

    private openRound(
        level: Level,
        group: Group,
        boardKinds?: readonly number[],
    ): void {
        this.requestVersion += 1;
        this.loadingBoard = false;
        this.unschedule(this.advanceToMainBoard);
        this.closeOverlay();
        this.round = new Round(level, group, boardKinds);
        if (this.board) {
            this.board.removeFromParent();
            this.board.destroy();
        }

        this.cardSize = level === 1 ? 94 : 70;
        const width = (level === 1 ? 6 : 8) * this.cardSize;
        const height = (level === 1 ? 6 : 10) * this.cardSize;
        const board = uiNode(this.gameRoot, "Board", width, height);
        this.board = board;
        board.on(Node.EventType.TOUCH_END, this.onBoardTouch, this);
        this.cards = this.round.cards.map((card) => {
            const view = new CardView(
                board,
                `Card-${card.id}`,
                this.cardSize,
                this.art,
            );
            view.node.setPosition(
                (card.left + 0.5) * this.cardSize - width / 2,
                height / 2 - (card.top + 0.5) * this.cardSize,
            );
            return view;
        });
        for (const [key, button] of this.groupButtons) {
            this.paintButton(button, level === 2 && group === key);
        }
        if (!WECHAT && this.otherLevel) {
            this.otherLevel.caption.string =
                level === 1 ? "去第二关" : "回第一关";
        }
        this.message.string =
            level === 1 ? "点一张牌入槽，翻开上下左右" : GROUP_HINTS[group];
        this.message.color = color("#355A46");
        this.refresh();
    }

    private advanceToMainBoard(): void {
        this.closeOverlay();
        void this.startMainBoard(this.round.group);
    }

    private onBoardTouch(event: EventTouch): void {
        if (!this.board || this.overlay || this.loadingBoard) return;
        const transform = this.board.getComponent(UITransform)!;
        const point = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(
            new Vec3(point.x, point.y),
        );
        const card = this.round.cardAt(
            (local.x + transform.width / 2) / this.cardSize,
            (transform.height / 2 - local.y) / this.cardSize,
        );
        if (!card) return;
        const matched = this.round.take(card.id);
        if (matched === null) {
            if (this.round.status === "playing") {
                this.message.string = "这张牌还被压着，先移开上层牌";
            }
            return;
        }

        this.message.string = matched ? "三张同款，已消除！" : "找三张同款";
        this.finishAction();
    }

    private finishAction(): void {
        this.message.color = color("#355A46");
        if (this.round.status === "lost") {
            this.message.string = `第 ${this.round.slotCapacity} 格已满 · 本局结束`;
            this.message.color = color("#8B3928");
        } else if (this.round.status === "won") {
            this.message.string =
                this.round.level === 1
                    ? "第一关清盘，进入第二关"
                    : "第二关清盘！";
            this.message.color = color("#456021");
        }
        this.refresh();
        if (this.round.status === "lost") {
            this.showResult(false);
        } else if (this.round.status === "won") {
            if (this.round.level === 1) this.showTutorialClear();
            else this.showResult(true);
        }
    }

    private onSlotTouch(index: number): void {
        if (
            index < this.round.slotCapacity ||
            this.round.status !== "playing" ||
            this.overlay ||
            this.loadingBoard
        )
            return;
        if (WECHAT) {
            this.message.string = "额外卡槽暂未开放";
            return;
        }
        if (index > this.round.slotCapacity) {
            this.message.string = `请先解锁第 ${this.round.slotCapacity + 1} 格`;
            return;
        }
        const dialog = this.openOverlay("MockAd");
        this.panel(dialog, "AdCard", 0, 606, 308, "#FFF3D0", "#C99D53");
        label(dialog, "模拟激励广告", 40, "#254D3C").node.setPosition(0, 79);
        label(
            dialog,
            `看完解锁第 ${index + 1} 格，本局有效`,
            27,
            "#355A46",
        ).node.setPosition(0, 12);
        this.button("取消", -134, -81, 232, () => this.closeOverlay(), dialog);
        this.button(
            "模拟看完",
            134,
            -81,
            232,
            () => {
                this.closeOverlay();
                if (!this.round.unlockNextSlot()) return;
                this.message.string = `已解锁第 ${this.round.slotCapacity} 格`;
                this.refresh();
            },
            dialog,
        );
    }

    private openOverlay(name: string, shade = true): Node {
        this.closeOverlay();
        const overlay = uiNode(this.node, name, 750, 1334);
        this.overlay = overlay;
        overlay.addComponent(BlockInputEvents);
        if (shade) {
            const backdrop = overlay.addComponent(Graphics);
            backdrop.fillColor = new Color(18, 42, 31, 174);
            backdrop.rect(-375, -667, 750, 1334);
            backdrop.fill();
        }
        return overlay;
    }

    private closeOverlay(): void {
        if (!this.overlay) return;
        this.overlay.removeFromParent();
        this.overlay.destroy();
        this.overlay = undefined;
        this.gameRoot.active = true;
    }

    private showWelcome(): void {
        const welcome = this.openOverlay("Welcome", false);
        this.gameRoot.active = false;
        this.panel(welcome, "WelcomeCard", 28, 638, 745, "#FFF2CC", "#B68A48");
        picture(welcome, "Paw", this.art.paw, 96).node.setPosition(0, 301);
        const title = label(welcome, "翻翻动物园", 66, "#254D3C");
        title.isBold = true;
        title.node.setPosition(0, 207);
        picture(welcome, "Rabbit", this.art.animals[9], 155).node.setPosition(
            -164,
            62,
        );
        picture(welcome, "Tiger", this.art.animals[8], 204).node.setPosition(
            0,
            65,
        );
        picture(welcome, "Frog", this.art.animals[1], 155).node.setPosition(
            164,
            62,
        );
        label(
            welcome,
            "来帮动物们找到伙伴吧！",
            32,
            "#355A46",
        ).node.setPosition(0, -86);
        label(
            welcome,
            "翻一翻，三张同款就能消除",
            25,
            "#5B6D51",
        ).node.setPosition(0, -138);
        const play = this.button(
            "开始游戏",
            0,
            -243,
            376,
            () => this.closeOverlay(),
            welcome,
            86,
        );
        this.paintButton(play, true);
    }

    private celebrate(parent: Node, badge: Node, finale: boolean): void {
        const effects = uiNode(parent, "ClearCelebration");
        effects.setSiblingIndex(badge.getSiblingIndex());
        effects.addComponent(ClearCelebration).play(badge, finale);
    }

    private showTutorialClear(): void {
        const overlay = this.openOverlay("TutorialClear", false);
        this.panel(overlay, "ClearCard", 38, 490, 306, "#FFF2CC", "#C99D53");
        const badge = picture(overlay, "ClearBadge", this.art.paw, 96).node;
        badge.setPosition(0, 121);
        this.celebrate(overlay, badge, false);
        const title = label(overlay, "教学完成！", 43, "#254D3C");
        title.isBold = true;
        title.node.setPosition(0, 30);
        label(overlay, "正在进入第二关", 26, "#5B6D51").node.setPosition(
            0,
            -34,
        );
        this.scheduleOnce(this.advanceToMainBoard, 1.25);
    }

    private showResult(won: boolean): void {
        const result = this.openOverlay("RoundResult");
        this.panel(result, "ResultCard", 22, 622, 522, "#FFF2CC", "#C99D53");
        const badge = picture(
            result,
            "ResultBadge",
            won ? this.art.trophy : this.art.paw,
            142,
        ).node;
        badge.setPosition(0, 176);
        if (won) this.celebrate(result, badge, true);
        const title = label(
            result,
            won ? "动物园通关！" : "卡槽满啦",
            49,
            "#254D3C",
        );
        title.isBold = true;
        title.node.setPosition(0, 62);
        label(
            result,
            won ? "所有动物都找到伙伴了" : "还差一点，再来一局吧",
            28,
            "#355A46",
        ).node.setPosition(0, 1);
        const replay = this.button(
            won ? "再玩本关" : "再试一次",
            0,
            -91,
            342,
            () => {
                this.closeOverlay();
                this.restartRound();
            },
            result,
            72,
        );
        this.paintButton(replay, true);
        this.button(
            "返回首页",
            0,
            -177,
            342,
            () => {
                this.openRound(1, "C");
                this.showWelcome();
            },
            result,
            64,
        );
    }

    private onPropTouch(prop: Prop): void {
        if (this.overlay || this.loadingBoard) return;
        if (!this.round.canUse(prop)) return;
        if (!this.round.use(prop)) {
            this.message.string = PROP_UNAVAILABLE[prop];
            return;
        }
        this.message.string = PROP_MESSAGES[prop];
        this.finishAction();
    }

    private refresh(): void {
        const { round } = this;
        for (const card of round.cards) {
            const exposure = round.isOnBoard(card) ? round.exposure(card) : 0;
            const kind = round.isFaceUp(card, exposure) ? card.kind : null;
            this.cards[card.id].show(
                kind,
                exposure,
                round.isSelectable(exposure),
            );
        }
        this.slots.forEach((slot, index) => {
            const card = round.slots[index];
            if (card) slot.show(card.kind, FULL_EXPOSURE, true);
            else if (index < round.slotCapacity) slot.showEmpty();
            else slot.showEmpty(WECHAT ? "未开放" : "广告");
        });
        for (const [prop, button] of this.propButtons) {
            button.graphic.node.active = round.level === 2;
            this.paintButton(button, false, round.canUse(prop));
        }
        this.tutorialRibbon.active = round.level === 1;
        const stage = `第 ${round.level} 关${!WECHAT && round.level === 2 ? ` · ${round.group} 组` : ""}`;
        this.progress.string = `${stage}     剩余 ${round.remaining}/${round.cards.length}`;
        if (!WECHAT && this.steps) {
            const first =
                typeof round.firstMatchAt === "number"
                    ? `第 ${round.firstMatchAt} 张`
                    : round.firstMatchAt === "prop"
                      ? "道具"
                      : "—";
            this.steps.string = `已入槽 ${round.moves} 次     首消 ${first}`;
        }
        const danger =
            round.status === "playing" &&
            round.slots.length === round.slotCapacity - 1;
        this.slotStatus.string = `卡槽 ${round.slots.length}/${round.slotCapacity}${danger ? " · 下一张必须三消" : ""}`;
        this.slotStatus.color = color(danger ? "#FFD297" : "#F4F7E9");
    }

    private text(text: string, y: number, size: number, hex?: string): Label {
        const component = label(this.gameRoot, text, size, hex);
        component.node.setPosition(0, y);
        return component;
    }

    private panel(
        parent: Node,
        name: string,
        y: number,
        width: number,
        height: number,
        fill: string,
        border: string,
    ): Node {
        const node = uiNode(parent, name, width, height);
        node.setPosition(0, y);
        const graphic = node.addComponent(Graphics);
        graphic.fillColor = new Color(32, 52, 34, 63);
        graphic.roundRect(-width / 2, -height / 2 - 6, width, height, 20);
        graphic.fill();
        graphic.fillColor = color(fill);
        graphic.strokeColor = color(border);
        graphic.lineWidth = 3;
        graphic.roundRect(-width / 2, -height / 2, width, height, 20);
        graphic.fill();
        graphic.stroke();
        return node;
    }

    private button(
        text: string,
        x: number,
        y: number,
        width: number,
        action: () => void,
        parent = this.gameRoot,
        height = 66,
        frame?: SpriteFrame,
    ): Control {
        const node = uiNode(parent, text || "Other-Level", width, height);
        node.setPosition(x, y);
        node.on(Node.EventType.TOUCH_END, action);
        const button = {
            graphic: node.addComponent(Graphics),
            caption: label(node, text, 26),
            width,
            height,
            icon: frame ? picture(node, "PropIcon", frame, 47) : undefined,
        };
        if (button.icon) {
            button.icon.node.setPosition(0, 14);
            button.caption.node.setPosition(0, -25);
        } else {
            button.caption.isBold = true;
        }
        this.paintButton(button, false);
        return button;
    }

    private paintButton(
        button: Control,
        active: boolean,
        enabled = true,
    ): void {
        const { graphic, caption, width, height } = button;
        graphic.clear();
        graphic.fillColor = new Color(36, 67, 50, 65);
        graphic.roundRect(-width / 2, -height / 2 - 4, width, height, 14);
        graphic.fill();
        graphic.fillColor = color(
            enabled ? (active ? "#F5CE70" : "#345F47") : "#607764",
        );
        graphic.strokeColor = color(enabled ? "#E2C489" : "#8EA189");
        graphic.lineWidth = 2;
        graphic.roundRect(-width / 2, -height / 2, width, height, 14);
        graphic.fill();
        graphic.stroke();
        caption.color = color(active ? "#264F3C" : "#FFF1CD");
        if (button.icon)
            button.icon.color = enabled
                ? Color.WHITE
                : new Color(195, 200, 182, 150);
    }
}
