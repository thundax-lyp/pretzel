import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Sprite,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
    type EventTouch,
    type SpriteFrame,
} from "cc";
import { WECHAT } from "cc/env";
import { loadZooArtwork, type ZooArtwork } from "./artwork";
import { createBoardApi, type MainBoardDeal } from "./board-api";
import { CardView, color, label, picture, uiNode } from "./card-view";
import { ClearCelebration } from "./clear-celebration";
import { ZooAudio, type VolumeChannel } from "./zoo-audio";
import {
    FULL_EXPOSURE,
    GROUPS,
    INITIAL_SLOTS,
    PROPS,
    Round,
    type Group,
    type Level,
    type MainLayout,
    type Prop,
} from "./round";

const { ccclass } = _decorator;

const GROUP_LABELS: Record<Group, string> = {
    A: "A  全暗",
    B: "B  可点即亮",
    C: "C  预亮 6 张",
};

const TABLE = {
    1: { columns: 6, rows: 4, width: 116, height: 142, y: 151 },
    2: { columns: 8, rows: 10, width: 88, height: 92, y: 14 },
} as const;
const MATCH_DURATION = 0.36;

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
    private matchLayer?: Node;
    private audio!: ZooAudio;
    private playMats!: Record<Level, Node>;
    private slotTray?: Node;
    private cards: CardView[] = [];
    private readonly slots: CardView[] = [];
    private readonly groupButtons = new Map<Group, Control>();
    private readonly propButtons = new Map<
        Prop,
        { button: Control; count: Label }
    >();
    private overlay?: Node;
    private readonly boardApi = createBoardApi(WECHAT);
    private requestVersion = 0;
    private failedBoardGroup?: Group;
    private loadingBoard = false;
    private progress!: Label;
    private steps?: Label;
    private slotWarning!: Node;
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
        this.audio = this.node.addComponent(ZooAudio);
        picture(this.node, "ZooGarden", this.art.garden, 750, 1334);
        this.gameRoot = uiNode(this.node, "Game", 750, 1334);
        this.createGame();
        this.showWelcome();
    }

    private createGame(): void {
        this.panel(this.gameRoot, "Sign", 608, 376, 68, "#FFF4E5", "#D29C80");
        this.placeTitle(this.gameRoot, 238, 608);
        this.button(
            "⚙ 设置",
            -299,
            608,
            118,
            () => this.showSettings(),
            this.gameRoot,
            58,
        );
        this.button(
            "重开本关",
            286,
            608,
            145,
            () => this.requestRestart(),
            this.gameRoot,
            58,
        );
        if (!WECHAT) {
            GROUPS.forEach((group, index) => {
                const button = this.button(
                    GROUP_LABELS[group],
                    (index - 1.5) * 169,
                    550,
                    152,
                    () => void this.startMainBoard(group),
                    this.gameRoot,
                    42,
                );
                button.caption.fontSize = 20;
                this.groupButtons.set(group, button);
            });
            this.otherLevel = this.button(
                "",
                1.5 * 169,
                550,
                152,
                () => {
                    if (this.round.level === 1)
                        void this.startMainBoard(this.round.group);
                    else this.openRound(1, this.round.group);
                },
                this.gameRoot,
                42,
            );
            this.otherLevel.caption.fontSize = 20;
            this.steps = this.text("", 519, 19, "#633D75");
            this.steps.node.setPosition(175, 519);
        }
        this.progress = this.text(
            "",
            WECHAT ? 540 : 519,
            WECHAT ? 34 : 23,
            "#482755",
        );
        if (!WECHAT) this.progress.node.setPosition(-165, 519);
        this.progress.isBold = true;
        this.message = this.text("", WECHAT ? 501 : 491, 23, "#633D75");
        this.playMats = {
            1: this.panel(
                this.gameRoot,
                "TutorialMat",
                151,
                722,
                596,
                "#F2F7D4",
                "#FFFBE7",
            ),
            2: this.panel(
                this.gameRoot,
                "PlayMat",
                14,
                726,
                929,
                "#F2F7D4",
                "#FFFBE7",
            ),
        };
        this.addPawTrail();
        this.tutorialRibbon = this.panel(
            this.gameRoot,
            "TutorialRibbon",
            -393,
            524,
            53,
            "#80556B",
            "#F0C7A4",
        );
        label(this.tutorialRibbon, "卡槽里凑齐三张同款就会消除", 24, "#FFF2D6");
        PROPS.forEach((prop, index) => {
            const button = this.button(
                PROP_LABELS[prop],
                (index - 1.5) * 184,
                -615,
                173,
                () => this.onPropTouch(prop),
                this.gameRoot,
                92,
                this.art.props[prop],
            );
            const badge = uiNode(button.graphic.node, "RemainingUses");
            badge.setPosition(62, 21);
            const circle = badge.addComponent(Graphics);
            circle.fillColor = color("#5D3C50");
            circle.circle(0, 0, 14);
            circle.fill();
            const count = label(badge, "", 19, "#FFD780");
            count.isBold = true;
            this.propButtons.set(prop, { button, count });
        });
        this.openRound(1, "C");
    }

    private createSlotTray(): void {
        this.slotTray?.removeFromParent();
        this.slotTray?.destroy();
        this.slots.length = 0;

        const { level, slotLimit } = this.round;
        const { width, height } = TABLE[level];
        const slotPitch = width + 5;
        const tutorial = level === 1;
        const tray = this.panel(
            this.gameRoot,
            "SlotTray",
            tutorial ? -266 : -508,
            722,
            tutorial ? 186 : 116,
            "#F5D88B",
            "#CA9D50",
        );
        this.slotTray = tray;
        this.slotWarning = label(tray, "下一张必须三消", 20, "#703F1D").node;
        this.slotWarning.setPosition(0, tutorial ? 74 : 44);
        for (let index = 0; index < slotLimit; index += 1) {
            const slot = new CardView(
                tray,
                `Slot-${index + 1}`,
                width,
                height,
                this.art,
            );
            const extra = index >= INITIAL_SLOTS;
            const column = index - (slotLimit - 1) / 2;
            const offset = tutorial ? 0 : extra ? 4 : -4;
            slot.node.setPosition(
                column * slotPitch + offset,
                tutorial ? -12 : -10,
            );
            if (extra) {
                slot.node.on(Node.EventType.TOUCH_END, () =>
                    this.onSlotTouch(index),
                );
            }
            this.slots.push(slot);
        }
    }

    private requestRestart(): void {
        if (this.overlay || this.loadingBoard) return;
        if (this.round.status !== "playing") {
            if (this.failedBoardGroup) this.restartRound();
            return;
        }
        if (!this.round.hasProgress) {
            this.restartRound();
            return;
        }
        const dialog = this.openOverlay("ConfirmRestart");
        this.panel(dialog, "RestartCard", 0, 616, 315, "#FFF4E5", "#CE9B83");
        const title = label(dialog, "重开本关？", 42, "#482755");
        title.isBold = true;
        title.node.setPosition(0, 91);
        label(
            dialog,
            this.round.level === 1
                ? "当前关卡进度将清空"
                : "当前进度将清空，道具次数会重置",
            25,
            "#654375",
        ).node.setPosition(0, 19);
        const cancel = this.button(
            "继续游戏",
            -135,
            -80,
            236,
            () => this.closeOverlay(),
            dialog,
        );
        this.paintButton(cancel, true);
        this.button(
            "确认重开",
            135,
            -80,
            236,
            () => {
                this.closeOverlay();
                this.restartRound();
            },
            dialog,
        );
    }

    private showSettings(fromWelcome = false): void {
        if (!fromWelcome && (this.overlay || this.round.status !== "playing"))
            return;
        const dialog = this.openOverlay("AudioSettings");
        if (fromWelcome) this.gameRoot.active = false;
        this.panel(dialog, "SettingsCard", 0, 630, 483, "#FFF4E5", "#CE9B83");
        const title = label(dialog, "声音设置", 43, "#482755");
        title.isBold = true;
        title.node.setPosition(0, 166);
        for (const [index, channel] of (["music", "sfx"] as const).entries()) {
            const y = 62 - index * 105;
            this.createVolumeRow(dialog, channel, y);
        }
        const back = this.button(
            fromWelcome ? "返回首页" : "继续游戏",
            0,
            -151,
            330,
            () => {
                if (fromWelcome) this.showWelcome();
                else this.closeOverlay();
            },
            dialog,
            71,
        );
        this.paintButton(back, true);
    }

    private createVolumeRow(
        parent: Node,
        channel: VolumeChannel,
        y: number,
    ): void {
        const name = channel === "music" ? "背景音乐" : "消除音效";
        const value = label(parent, "", 28, "#482755");
        value.node.setPosition(0, y);
        const update = () => {
            const volume = this.audio.volume(channel);
            value.string =
                volume === 0 ? `${name}  静音` : `${name}  ${volume}%`;
        };
        const adjust = (delta: number) => {
            this.audio.setVolume(channel, this.audio.volume(channel) + delta);
            if (channel === "music") this.audio.startMusic();
            update();
        };
        this.button("−", -218, y, 78, () => adjust(-10), parent, 65);
        this.button("+", 218, y, 78, () => adjust(10), parent, 65);
        update();
    }

    private restartRound(): void {
        if (this.failedBoardGroup) {
            void this.startMainBoard(this.failedBoardGroup);
        } else if (this.round.level === 2) {
            void this.startMainBoard(this.round.group);
        } else {
            this.openRound(1, this.round.group);
        }
    }

    private async startMainBoard(group: Group): Promise<void> {
        if (this.overlay) return;
        this.unschedule(this.advanceToMainBoard);
        const version = ++this.requestVersion;
        this.loadingBoard = true;
        this.failedBoardGroup = undefined;
        this.message.string = "读取第二关牌局…";
        let deal: MainBoardDeal;
        try {
            deal = await this.boardApi.loadMainBoard();
        } catch {
            if (this.isValid && version === this.requestVersion) {
                this.loadingBoard = false;
                this.failedBoardGroup = group;
                this.message.string = "读取牌局失败，点击重开重试";
            }
            return;
        }
        if (this.isValid && version === this.requestVersion) {
            this.openRound(2, group, deal.kinds, deal.layout);
        }
    }

    private openRound(
        level: Level,
        group: Group,
        boardKinds?: readonly number[],
        layout?: MainLayout,
    ): void {
        this.requestVersion += 1;
        this.failedBoardGroup = undefined;
        this.loadingBoard = false;
        this.unschedule(this.advanceToMainBoard);
        this.closeOverlay();
        this.round = new Round(level, group, boardKinds, Math.random, layout);
        if (this.board) {
            this.board.removeFromParent();
            this.board.destroy();
        }

        const table = TABLE[level];
        const width = table.columns * table.width;
        const height = table.rows * table.height;
        const board = uiNode(this.gameRoot, "Board", width, height);
        board.setPosition(0, table.y);
        this.board = board;
        board.on(Node.EventType.TOUCH_END, this.onBoardTouch, this);
        this.cards = this.round.cards.map((card) => {
            const view = new CardView(
                board,
                `Card-${card.id}`,
                table.width,
                table.height,
                this.art,
            );
            view.node.setPosition(
                (card.left + 0.5) * table.width - width / 2,
                height / 2 - (card.top + 0.5) * table.height,
            );
            return view;
        });
        this.createSlotTray();
        if (this.matchLayer) {
            this.matchLayer.removeFromParent();
            this.matchLayer.destroy();
        }
        this.matchLayer = uiNode(this.gameRoot, "MatchEffects");
        this.playMats[1].active = level === 1;
        this.playMats[2].active = level === 2;
        for (const [key, button] of this.groupButtons) {
            this.paintButton(button, level === 2 && group === key);
        }
        if (!WECHAT && this.otherLevel) {
            this.otherLevel.caption.string =
                level === 1 ? "去第二关" : "回第一关";
        }
        this.message.string =
            level === 1 ? "点一张牌入槽，翻开上下左右" : "只可点没被压住的牌";
        this.message.color = color("#633D75");
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
        const table = TABLE[this.round.level];
        const card = this.round.cardAt(
            (local.x + transform.width / 2) / table.width,
            (transform.height / 2 - local.y) / table.height,
        );
        if (!card) return;
        const previous = [...this.round.slots];
        const matched = this.round.take(card.id);
        if (matched === null) {
            if (this.round.status === "playing") {
                this.message.string = "这张牌还被压着，先移开上层牌";
            }
            return;
        }

        if (matched) {
            const group = [...previous, card].flatMap((tile, index) =>
                tile.kind === card.kind ? [index] : [],
            );
            this.playMatch(card.kind, group);
        }
        this.message.string = matched ? "三张同款，已消除！" : "找三张同款";
        this.finishAction(matched > 0);
    }

    private playMatch(kind: number, indices: readonly number[]): void {
        this.audio.playMatch();
        const { width, height } = TABLE[this.round.level];
        for (const index of indices) {
            const slot = this.slots[index].node.position;
            const effect = uiNode(this.matchLayer!, "MatchFlash");
            effect.setPosition(slot.x, this.slotTray!.position.y + slot.y);
            const glow = effect.addComponent(Graphics);
            glow.fillColor = new Color(255, 220, 115, 170);
            glow.roundRect(
                -width / 2 - 5,
                -height / 2 - 5,
                width + 10,
                height + 10,
                11,
            );
            glow.fill();
            const tile = new CardView(
                effect,
                "MatchedTile",
                width,
                height,
                this.art,
            );
            tile.show(kind, FULL_EXPOSURE, true);
            const opacity = effect.addComponent(UIOpacity);
            tween(effect)
                .to(
                    0.08,
                    { scale: new Vec3(1.12, 1.12, 1) },
                    { easing: "quadOut" },
                )
                .to(
                    MATCH_DURATION - 0.08,
                    {
                        scale: new Vec3(0.6, 0.6, 1),
                        position: new Vec3(
                            effect.position.x,
                            effect.position.y + 24,
                        ),
                    },
                    { easing: "quadIn" },
                )
                .call(() => effect.destroy())
                .start();
            tween(opacity)
                .delay(0.08)
                .to(MATCH_DURATION - 0.08, { opacity: 0 })
                .start();
        }
    }

    private finishAction(matched: boolean): void {
        this.message.color = color("#633D75");
        if (this.round.status === "lost") {
            this.message.string = `第 ${this.round.slotCapacity} 格已满 · 本局结束`;
            this.message.color = color("#8B3928");
        } else if (this.round.status === "won") {
            this.message.string =
                this.round.level === 1
                    ? "第一关清盘，进入第二关"
                    : "第二关清盘！";
            this.message.color = color("#804188");
        }
        this.refresh();
        if (this.round.status === "lost") {
            this.showResult(false);
        } else if (this.round.status === "won") {
            const won = this.round;
            this.scheduleOnce(
                () => {
                    if (this.round !== won) return;
                    if (won.level === 1) this.showTutorialClear();
                    else this.showResult(true);
                },
                matched ? MATCH_DURATION : 0,
            );
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
        this.panel(dialog, "AdCard", 0, 606, 308, "#FFF4E5", "#CE9B83");
        label(dialog, "模拟激励广告", 40, "#482755").node.setPosition(0, 79);
        label(
            dialog,
            `看完解锁第 ${index + 1} 格，本局有效`,
            27,
            "#633D75",
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
            backdrop.fillColor = new Color(34, 18, 52, 165);
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
        this.button(
            "⚙ 设置",
            -299,
            608,
            118,
            () => this.showSettings(true),
            welcome,
            58,
        );
        this.panel(welcome, "WelcomeCard", 28, 638, 745, "#FFF4E5", "#D29C80");
        picture(welcome, "Paw", this.art.paw, 70).node.setPosition(0, 322);
        this.placeTitle(welcome, 540, 216);
        picture(welcome, "Rabbit", this.art.animals[9], 155).node.setPosition(
            -164,
            62,
        );
        picture(welcome, "Tiger", this.art.animals[8], 204).node.setPosition(
            0,
            51,
        );
        picture(welcome, "Frog", this.art.animals[1], 155).node.setPosition(
            164,
            62,
        );
        label(
            welcome,
            "来帮动物们找到伙伴吧！",
            32,
            "#633D75",
        ).node.setPosition(0, -86);
        label(
            welcome,
            "翻一翻，三张同款就能消除",
            25,
            "#664972",
        ).node.setPosition(0, -138);
        const play = this.button(
            "开始游戏",
            0,
            -243,
            376,
            () => {
                this.closeOverlay();
                this.audio.startMusic();
            },
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
        this.panel(overlay, "ClearCard", 38, 490, 306, "#FFF4E5", "#CE9B83");
        const badge = picture(overlay, "ClearBadge", this.art.paw, 96).node;
        badge.setPosition(0, 121);
        this.celebrate(overlay, badge, false);
        const title = label(overlay, "教学完成！", 43, "#482755");
        title.isBold = true;
        title.node.setPosition(0, 30);
        label(overlay, "正在进入第二关", 26, "#664972").node.setPosition(
            0,
            -34,
        );
        this.scheduleOnce(this.advanceToMainBoard, 1.25);
    }

    private showResult(won: boolean): void {
        const result = this.openOverlay("RoundResult");
        this.panel(result, "ResultCard", 22, 622, 522, "#FFF4E5", "#CE9B83");
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
            "#482755",
        );
        title.isBold = true;
        title.node.setPosition(0, 62);
        label(
            result,
            won ? "所有动物都找到伙伴了" : "还差一点，再来一局吧",
            28,
            "#633D75",
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
        if (
            this.overlay ||
            this.loadingBoard ||
            this.round.status !== "playing"
        )
            return;
        if (!this.round.propUsesLeft(prop)) {
            this.message.string = "这个道具本局已用完";
            return;
        }
        const previous = [...this.round.slots];
        if (!this.round.use(prop)) {
            this.message.string =
                prop === "remove" && !previous.length
                    ? "先把同款目标牌放入卡槽"
                    : PROP_UNAVAILABLE[prop];
            return;
        }
        if (prop === "remove") {
            const indices = previous.flatMap((card, index) =>
                this.round.slots.includes(card) ? [] : [index],
            );
            this.playMatch(previous[indices[0]].kind, indices);
        }
        this.message.string = PROP_MESSAGES[prop];
        this.finishAction(prop === "remove");
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
        for (const [prop, { button, count }] of this.propButtons) {
            button.graphic.node.active = round.level === 2;
            const remaining = round.propUsesLeft(prop);
            const available = round.canUse(prop);
            count.string = String(remaining);
            count.color = color(remaining ? "#FFD780" : "#C4B3D0");
            this.paintButton(button, false, available);
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
        this.slotWarning.active =
            round.status === "playing" &&
            round.slots.length === round.slotCapacity - 1;
        if (this.slotWarning.active && round.level === 2) {
            const left = this.slots[0].node.position.x;
            const right = this.slots[round.slotCapacity - 1].node.position.x;
            this.slotWarning.setPosition(
                (left + right) / 2,
                this.slotWarning.position.y,
            );
        }
    }

    private text(text: string, y: number, size: number, hex?: string): Label {
        const component = label(this.gameRoot, text, size, hex);
        component.node.setPosition(0, y);
        return component;
    }

    private placeTitle(parent: Node, width: number, y: number): void {
        const title = this.art.title;
        const size = title.originalSize;
        picture(
            parent,
            "FlipZooTitle",
            title,
            width,
            (width * size.height) / size.width,
        ).node.setPosition(0, y);
    }

    private addPawTrail(): void {
        const trail = uiNode(this.playMats[2], "PawTrail").addComponent(
            Graphics,
        );
        trail.fillColor = new Color(147, 107, 75, 62);
        for (const [x, y] of [
            [309, 435],
            [337, 410],
            [-335, -416],
            [-305, -436],
        ]) {
            trail.ellipse(x, y - 4, 9, 7);
            trail.circle(x - 8, y + 5, 3.2);
            trail.circle(x - 2.5, y + 9, 3.2);
            trail.circle(x + 4.5, y + 9, 3.2);
            trail.circle(x + 10, y + 5, 3.2);
        }
        trail.fill();
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
        graphic.fillColor = new Color(64, 28, 86, 70);
        graphic.roundRect(-width / 2, -height / 2 - 6, width, height, 20);
        graphic.fill();
        graphic.fillColor = color(fill);
        graphic.strokeColor = color(border);
        graphic.lineWidth = 3;
        graphic.roundRect(-width / 2, -height / 2, width, height, 20);
        graphic.fill();
        graphic.stroke();
        graphic.fillColor = new Color(255, 255, 255, 115);
        graphic.roundRect(-width / 2 + 15, height / 2 - 7, width - 30, 3, 1.5);
        graphic.fill();
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
            icon: frame ? picture(node, "PropIcon", frame, 86) : undefined,
        };
        button.caption.node.active = !frame;
        button.caption.isBold = true;
        this.paintButton(button, false);
        return button;
    }

    private paintButton(
        button: Control,
        active: boolean,
        enabled = true,
    ): void {
        const { graphic, caption, width, height, icon } = button;
        graphic.clear();
        graphic.fillColor = new Color(58, 24, 82, 85);
        graphic.roundRect(-width / 2, -height / 2 - 4, width, height, 14);
        graphic.fill();
        graphic.fillColor = color(
            icon
                ? enabled
                    ? "#FFF1D9"
                    : "#CFB1A6"
                : enabled
                  ? active
                      ? "#FFCC74"
                      : "#7752AB"
                  : "#64516F",
        );
        graphic.strokeColor = color(
            icon
                ? enabled
                    ? "#D79D7E"
                    : "#A48983"
                : enabled
                  ? active
                      ? "#FFF1C0"
                      : "#DDBBFF"
                  : "#AE93BF",
        );
        graphic.lineWidth = 2;
        graphic.roundRect(-width / 2, -height / 2, width, height, 14);
        graphic.fill();
        graphic.stroke();
        graphic.fillColor = new Color(255, 255, 255, enabled ? 72 : 35);
        graphic.roundRect(-width / 2 + 10, height / 2 - 7, width - 20, 3, 1.5);
        graphic.fill();
        caption.color = color(active ? "#482755" : "#FFF1DE");
        if (icon)
            icon.color = enabled ? Color.WHITE : new Color(200, 179, 172, 215);
    }
}
