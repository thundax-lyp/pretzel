import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
    Label,
    LabelOutline,
    Node,
    ResolutionPolicy,
    ScrollView,
    Mask,
    Sprite,
    SubContextView,
    UIOpacity,
    UITransform,
    Vec3,
    screen,
    tween,
    view,
    type EventTouch,
    type SpriteFrame,
} from "cc";
import { WECHAT } from "cc/env";
import { loadZooArtwork, type ZooArtwork } from "../services/artwork";
import { createBoardApi, type MainBoardDeal } from "../services/board-api";
import type { Control, ScreenControls } from "../ui/screen-controls";
import {
    flyCardToSlot,
    MATCH_DURATION,
    playMatch,
    slideSlotCard,
} from "../gameplay/card-effects";
import { CardView } from "../gameplay/card-view";
import { color, label, picture, titleLine, uiNode } from "../ui/nodes";
import { ClearCelebration } from "../gameplay/clear-celebration";
import { showWelcome } from "../home/welcome-view";
import { SettingsView } from "../settings/settings-view";
import { ZooAudio } from "../services/zoo-audio";
import {
    FULL_EXPOSURE,
    GROUPS,
    PROPS,
    Round,
    type Card,
    type Group,
    type Level,
    type MainLayout,
    type Prop,
    type SlotClearGroup,
} from "../gameplay/round";

const { ccclass } = _decorator;

const GROUP_LABELS: Record<Group, string> = {
    A: "A  全暗",
    B: "B  可点即亮",
    C: "C  预亮 6 张",
};

const TABLE = {
    1: { width: 116, height: 127, y: 102 },
    2: { width: 88, height: 92, y: -17 },
} as const;

interface ShareCard {
    title: string;
    imageUrlId?: string;
    imageUrl?: string;
}

declare const GameGlobal: { flipZooShareCards?: ShareCard[] };
declare const wx: {
    shareAppMessage?: (card: ShareCard) => void;
    showShareMenu?: (options: { menus: string[] }) => void;
    onShareAppMessage?: (handler: () => ShareCard) => void;
    offShareAppMessage?: (handler: () => ShareCard) => void;
    showToast?: (options: { title: string; icon: "none" }) => void;
    openCustomerServiceConversation?: (options: { fail: () => void }) => void;
    getWindowInfo?: () => {
        windowWidth: number;
        windowHeight: number;
        safeArea?: { top: number; bottom: number };
    };
    getMenuButtonBoundingClientRect?: () => { top?: number; bottom: number };
    createFeedbackButton?: (options: {
        type: "text";
        text: string;
        style: {
            left: number;
            top: number;
            width: number;
            height: number;
            backgroundColor: string;
            color: string;
        };
    }) => { show(): void; destroy(): void };
    getOpenDataContext?: () => {
        postMessage(data: {
            action: "show-week" | "show-preview" | "record-win" | "scroll-week";
            rows?: number;
        }): void;
    };
};

const PROP_LABELS: Record<Prop, string> = {
    undo: "撤回",
    peek: "翻牌",
    remove: "清槽",
};
const PROP_MESSAGES: Record<Prop, string> = {
    undo: "上一张已回原位，仍保持亮面",
    peek: "已翻开暗牌",
    remove: "已补齐同款，卡槽已清空",
};
const PROP_UNAVAILABLE: Record<Prop, string> = {
    undo: "当前没有可以撤回的牌",
    peek: "牌桌上没有可翻开的暗牌",
    remove: "还有牌组无法补齐",
};

@ccclass("FlipZooStartScreen")
export class FlipZooStartScreen extends Component {
    private art!: ZooArtwork;
    private gameRoot!: Node;
    private garden?: UITransform;
    private readonly pagePositions = new WeakMap<Node, number>();
    private round!: Round;
    private board?: {
        node: Node;
        left: number;
        top: number;
        tileHeight: number;
    };
    private matchLayer?: Node;
    private animatingCards = false;
    private audio!: ZooAudio;
    private readonly controls: ScreenControls = {
        button: (...args) => this.button(...args),
        panel: (...args) => this.panel(...args),
        heading: (...args) => this.heading(...args),
        paintButton: (...args) => this.paintButton(...args),
        place: (...args) => this.place(...args),
    };
    private settingsView!: SettingsView;
    private playMats!: Record<Level, Node>;
    private slotTray?: Node;
    private propTray!: Node;
    private cards: CardView[] = [];
    private readonly slots: CardView[] = [];
    private readonly groupButtons = new Map<Group, Control>();
    private readonly propButtons = new Map<
        Prop,
        { button: Control; count: Label }
    >();
    private overlay?: Node;
    private welcome?: Node;
    private feedbackControl?: Node;
    private feedbackButton?: { destroy(): void };
    private readonly shareFromMenu = () => this.shareCard(false);
    private readonly boardApi = createBoardApi(WECHAT);
    private requestVersion = 0;
    private failedBoardGroup?: Group;
    private loadingBoard = false;
    private stage!: Label;
    private gameHeader!: {
        stage: Node;
        settings: Node;
        goals: Node;
        moves: Node;
    };
    private progress!: Label;
    private steps!: Label;
    private stepsCaption!: Label;
    private slotWarning!: Node;
    private message!: Label;
    private otherLevel?: Control;
    private tutorialRibbon!: Node;
    private viewportPolicy?: number;

    async start(): Promise<void> {
        this.fitViewport();
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
        this.garden = picture(
            this.node,
            "ZooGarden",
            this.art.garden,
            750,
            1334,
        ).node.getComponent(UITransform)!;
        this.gameRoot = uiNode(this.node, "Game", 750, 1334);
        this.createGame();
        this.showWelcome();
        this.audio.startMusic();
        if (WECHAT) {
            wx.onShareAppMessage?.(this.shareFromMenu);
            wx.showShareMenu?.({ menus: ["shareAppMessage"] });
        }
        this.resizeBackdrops();
        view.on("canvas-resize", this.resizeBackdrops, this);
    }

    onDestroy(): void {
        this.feedbackButton?.destroy();
        if (WECHAT) wx.offShareAppMessage?.(this.shareFromMenu);
        view.off("canvas-resize", this.resizeBackdrops, this);
    }

    private createGame(): void {
        const stage = this.panel(
            this.gameRoot,
            "Stage",
            594,
            222,
            56,
            "#17483F",
            "#164339",
        );
        this.stage = label(stage, "", 27);
        this.stage.isBold = true;
        const settings = this.button(
            "☰",
            -306,
            594,
            76,
            () => this.showSettings(),
            this.gameRoot,
            72,
        );
        this.paintButton(settings, false, true, "green");
        if (!WECHAT) {
            GROUPS.forEach((group, index) => {
                const button = this.button(
                    GROUP_LABELS[group],
                    (index - 1.5) * 169,
                    428,
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
                428,
                152,
                () => {
                    if (this.animatingCards) return;
                    if (this.round.level === 1)
                        void this.startMainBoard(this.round.group);
                    else this.openRound(1, this.round.group);
                },
                this.gameRoot,
                42,
            );
            this.otherLevel.caption.fontSize = 20;
        }
        const goals = this.panel(
            this.gameRoot,
            "GoalCard",
            511,
            436,
            94,
            "#F6F9D7",
            "#5D8A56",
        );
        this.place(goals, -110, 511);
        const badge = this.panel(
            goals,
            "GoalBadge",
            0,
            76,
            72,
            "#94CEA5",
            "#5D8A56",
        );
        badge.setPosition(-161, 0);
        picture(badge, "GoalPaw", this.art.paw, 53);
        label(goals, "目标 · 清空所有牌", 24, "#244D39").node.setPosition(
            37,
            20,
        );
        this.progress = label(goals, "", 27, "#244D39");
        this.progress.isBold = true;
        this.progress.node.setPosition(37, -19);

        const moves = this.panel(
            this.gameRoot,
            "MovesCard",
            511,
            188,
            94,
            "#F6F9D7",
            "#5D8A56",
        );
        this.place(moves, 232, 511);
        this.stepsCaption = label(moves, "入槽次数", 19, "#244D39");
        this.stepsCaption.node.setPosition(0, 23);
        this.steps = titleLine(moves, "", -16, 38, "#FFF9DD", "#375339");
        this.gameHeader = {
            stage,
            settings: settings.graphic.node,
            goals,
            moves,
        };
        this.message = this.text("", WECHAT ? 443 : 382, 23, "#F4FFE5");
        const messageOutline = this.message.node.addComponent(LabelOutline);
        messageOutline.color = color("#17483F");
        messageOutline.width = 2;
        if (WECHAT) this.place(this.message.node, -55, 443);
        this.playMats = {
            1: this.panel(
                this.gameRoot,
                "TutorialMat",
                TABLE[1].y,
                712,
                525,
                "#18586970",
                "#72B9A4",
            ),
            2: this.panel(
                this.gameRoot,
                "PlayMat",
                TABLE[2].y,
                722,
                WECHAT ? 846 : 724,
                "#18586970",
                "#72B9A4",
            ),
        };
        this.tutorialRibbon = this.panel(
            this.gameRoot,
            "TutorialRibbon",
            -378,
            524,
            53,
            "#1E5F52",
            "#8BC5A1",
        );
        label(this.tutorialRibbon, "卡槽里凑齐三张同款就会消除", 24, "#FFF2D6");
        const propWidth = WECHAT ? 116 : 136;
        const propGap = WECHAT ? 65 : 12;
        this.propTray = uiNode(
            this.gameRoot,
            "PropBar",
            PROPS.length * propWidth + (PROPS.length - 1) * propGap + 24,
            WECHAT ? 126 : 116,
        );
        this.place(this.propTray, 0, -590);
        PROPS.forEach((prop, index) => {
            const button = this.button(
                PROP_LABELS[prop],
                (index - (PROPS.length - 1) / 2) * (propWidth + propGap),
                0,
                propWidth,
                () => this.onPropTouch(prop),
                this.propTray,
                WECHAT ? 110 : 94,
                prop === "undo" ? this.art.undo : prop,
            );
            if (WECHAT && button.icon) {
                button.caption.node.active = false;
                button.icon.node.setPosition(0, 0);
                button.icon.node.setScale(1.15, 1.15, 1);
            }
            const badge = uiNode(button.graphic.node, "RemainingUses");
            badge.setPosition(propWidth / 2 - 6, WECHAT ? 52 : 44);
            const circle = badge.addComponent(Graphics);
            circle.fillColor = color("#EC7847");
            circle.strokeColor = color("#A7432D");
            circle.lineWidth = 2;
            circle.circle(0, 0, 17);
            circle.fill();
            circle.stroke();
            const count = label(badge, "", 19, "#1A525C");
            count.isBold = true;
            this.propButtons.set(prop, { button, count });
        });
        this.openRound(1, "C");
    }

    private createSlotTray(): void {
        this.slotTray?.removeFromParent();
        this.slotTray?.destroy();
        this.slots.length = 0;

        const { level, slotLimit, initialCapacity } = this.round;
        const { width, height } = TABLE[level];
        const slotPitch = width + (level === 2 && WECHAT ? 7 : 5);
        const tutorial = level === 1;
        const tray = this.panel(
            this.gameRoot,
            "SlotTray",
            tutorial ? -250 : -478,
            722,
            tutorial ? 175 : 104,
            "#E6F1BF",
            "#5A8653",
        );
        this.slotTray = tray;
        this.slotWarning = label(tray, "下一张必须三消", 20, "#703F1D").node;
        this.slotWarning.setPosition(0, tutorial ? 71 : 48);
        for (let index = 0; index < slotLimit; index += 1) {
            const slot = new CardView(
                tray,
                `Slot-${index + 1}`,
                width,
                height,
                this.art,
            );
            const extra = index >= initialCapacity;
            const column = index - (slotLimit - 1) / 2;
            const offset = initialCapacity === slotLimit ? 0 : extra ? 10 : -6;
            slot.node.setPosition(
                column * slotPitch + offset,
                tutorial ? -9 : -5,
            );
            if (extra) {
                if (!WECHAT) this.addAdBadge(slot.node, width, height);
                slot.node.on(Node.EventType.TOUCH_END, () =>
                    this.onSlotTouch(index),
                );
            }
            this.slots.push(slot);
        }
    }

    private requestRestart(settings: Node): void {
        if (this.overlay !== settings || this.loadingBoard) return;
        if (this.failedBoardGroup || !this.round.hasProgress) {
            this.closeOverlay();
            this.restartRound();
            return;
        }
        const dialog = this.openOverlay("ConfirmRestart");
        this.settingsView.confirmRestart(
            dialog,
            this.round.level,
            () => this.closeOverlay(),
            () => {
                this.closeOverlay();
                this.restartRound();
            },
        );
    }

    private showSettings(fromWelcome = false): void {
        if (
            !fromWelcome &&
            (this.overlay ||
                this.loadingBoard ||
                this.animatingCards ||
                (this.round.status !== "playing" && !this.failedBoardGroup))
        )
            return;
        const dialog = this.openOverlay("AudioSettings");
        this.gameRoot.active = false;
        this.settingsView ??= new SettingsView(this.controls, this.audio);
        this.feedbackControl = this.settingsView.show(dialog, fromWelcome, {
            contact: () => {
                if (!WECHAT || !wx.openCustomerServiceConversation) {
                    this.platformNotice("请在微信小游戏内联系客服");
                    return;
                }
                wx.openCustomerServiceConversation({
                    fail: () => this.platformNotice("暂时无法打开客服"),
                });
            },
            feedback: () =>
                this.platformNotice(
                    WECHAT
                        ? "当前环境暂不支持问题反馈"
                        : "请在微信小游戏内提交反馈",
                ),
            privacy: () => this.showPrivacy(fromWelcome),
            abandon: () => this.confirmAbandon(),
            restart: () => this.requestRestart(dialog),
            back: () => {
                if (fromWelcome) this.showWelcome();
                else this.closeOverlay();
            },
        });
        this.syncFeedbackButton();
    }

    private showPrivacy(fromWelcome: boolean): void {
        const dialog = this.openOverlay("ChildPrivacy");
        this.gameRoot.active = false;
        const card = this.panel(
            dialog,
            "PrivacyCard",
            0,
            650,
            800,
            "#FFF1D4",
            "#8F552B",
        );
        label(
            card,
            "儿童隐私保护声明及监护人须知",
            34,
            "#56351C",
        ).node.setPosition(-20, 340);
        const close = this.button(
            "×",
            292,
            377,
            58,
            () => {
                this.closeOverlay();
                this.showSettings(fromWelcome);
            },
            card,
            58,
        );
        this.paintButton(close, false, true, "cream");

        const viewport = uiNode(card, "PrivacyViewport", 556, 635);
        viewport.setPosition(0, -12);
        viewport.addComponent(Mask);
        const scroll = viewport.addComponent(ScrollView);
        scroll.horizontal = false;
        const body = uiNode(viewport, "PrivacyBody", 530, 635);
        scroll.content = body;
        const notice = label(
            body,
            [
                "本指引适用于使用《两只眼睛几条腿》的不满十四周岁的儿童及其父母或其他监护人。",
                "一、监护人同意",
                "请监护人先阅读本指引。儿童使用好友排行榜等涉及个人信息的功能前，应由监护人了解用途并作出选择。可拒绝微信好友信息授权，继续使用基础玩法。",
                "二、处理的信息与用途",
                "音量设置保存在当前设备，用于下次打开游戏时恢复设置。通关后，游戏将本周过关次数和更新时间写入微信托管的游戏数据。好友榜在微信开放数据域读取同玩好友的昵称、头像、标识和本周过关次数，用于排序、显示头像及定位自己的名次。",
                "三、存储与可见范围",
                "音量设置存于本机。榜单成绩由微信托管，新一周有通关记录时会覆盖上一周成绩。本周榜向可查看该榜单的同玩好友显示昵称、头像和本周过关次数。微信平台处理的信息以微信在相应功能中提供的说明为准。",
                "四、转发、反馈和客服",
                "转发由您在微信界面选择对象。通过问题反馈或客服提交的内容由对应入口接收，用于处理您提出的问题。请避免提交身份证号码、家庭住址或其他与问题无关的儿童个人信息。",
                "五、监护人如何行使权利",
                "您可通过微信提供的授权管理入口管理好友信息授权，也可从游戏设置进入「联系客服」或「问题反馈」，提出查阅、复制、更正、删除儿童个人信息、撤回同意或投诉的请求。请在请求中说明涉及的功能，避免发送与核实无关的信息。",
            ].join("\n\n"),
            28,
            "#56351C",
        );
        notice.horizontalAlign = Label.HorizontalAlign.LEFT;
        notice.overflow = Label.Overflow.RESIZE_HEIGHT;
        notice.node.getComponent(UITransform)!.setContentSize(530, 0);
        notice.updateRenderData(true);
        const height = notice.node.getComponent(UITransform)!.height;
        const contentHeight = Math.max(635, height + 24);
        body.getComponent(UITransform)!.setContentSize(530, contentHeight);
        notice.node.setPosition(0, (contentHeight - height) / 2 - 12);
        scroll.scrollToTop();
    }

    private confirmAbandon(): void {
        const dialog = this.openOverlay("ConfirmAbandon");
        this.settingsView.confirmAbandon(
            dialog,
            () => this.closeOverlay(),
            () => this.returnHome(),
        );
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
        if (this.overlay || this.animatingCards) return;
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
                this.message.string = "读取牌局失败，请在设置中重开";
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
        this.round = new Round(
            level,
            group,
            boardKinds,
            Math.random,
            layout,
            true,
        );
        if (this.board) {
            this.board.node.removeFromParent();
            this.board.node.destroy();
        }

        const table = TABLE[level];
        const lefts = this.round.cards.map((card) => card.left);
        const tops = this.round.cards.map((card) => card.top);
        const left = Math.min(...lefts);
        const top = Math.min(...tops);
        const width = (Math.max(...lefts) + 1 - left) * table.width;
        const height = (Math.max(...tops) + 1 - top) * table.height;
        const board = uiNode(this.gameRoot, "Board", width, height);
        this.place(board, 0, table.y);
        const mat = this.playMats[level].getComponent(UITransform)!;
        this.fitBoard(board, mat.width, mat.height);
        this.board = { node: board, left, top, tileHeight: table.height };
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
                (card.left - left + 0.5) * table.width - width / 2,
                height / 2 - (card.top - top + 0.5) * table.height,
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
            level === 1
                ? "点一张牌入槽，翻开上下左右"
                : WECHAT
                  ? ""
                  : "只可点没被压住的牌";
        this.message.color = color("#F4FFE5");
        if (WECHAT) this.layoutWeChatGame(this.screenSize().height);
        this.refresh();
    }

    private advanceToMainBoard(): void {
        this.closeOverlay();
        void this.startMainBoard(this.round.group);
    }

    private onBoardTouch(event: EventTouch): void {
        if (
            !this.board ||
            this.overlay ||
            this.loadingBoard ||
            this.animatingCards
        )
            return;
        const { node, left, top, tileHeight } = this.board;
        const transform = node.getComponent(UITransform)!;
        const point = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(
            new Vec3(point.x, point.y),
        );
        const table = TABLE[this.round.level];
        const card = this.round.cardAt(
            left + (local.x + transform.width / 2) / table.width,
            top + (transform.height / 2 - local.y) / tileHeight,
        );
        if (!card) return;
        const insertionIndex = this.round.slotInsertionIndex(card.kind);
        const previous = this.round.slots.map((tile) => tile.kind);
        const matched = this.round.take(card.id);
        if (matched === null) {
            if (this.round.status === "playing") {
                this.message.string = "这张牌还被压着，先移开上层牌";
            }
            return;
        }

        this.animatingCards = true;
        for (let index = insertionIndex; index < previous.length; index += 1) {
            slideSlotCard(
                this.slotTray!,
                this.art,
                this.slots[index].node,
                this.slots[index + 1].node,
                previous[index],
                TABLE[this.round.level],
            );
        }
        this.refreshSlots(previous.slice(0, insertionIndex));
        this.flyCardToSlot(card, insertionIndex, () => {
            this.animatingCards = false;
            if (matched) {
                this.playMatch(card.kind, [
                    insertionIndex - 2,
                    insertionIndex - 1,
                    insertionIndex,
                ]);
            }
            this.message.string =
                WECHAT && this.round.level === 2
                    ? ""
                    : matched
                      ? "三张同款，已消除！"
                      : "找三张同款";
            this.finishAction(matched > 0);
        });
    }

    private flyCardToSlot(
        card: Card,
        slotIndex: number,
        onLanded: () => void,
    ): void {
        flyCardToSlot(
            this.matchLayer!,
            this.art,
            this.cards[card.id].node,
            this.slots[slotIndex].node,
            card.kind,
            TABLE[this.round.level],
            onLanded,
        );
    }

    private playMatch(kind: number, indices: readonly number[]): void {
        this.audio.playMatch();
        playMatch(
            this.matchLayer!,
            this.slotTray!,
            this.slots,
            this.art,
            kind,
            indices,
            TABLE[this.round.level],
        );
    }

    private finishAction(matched: boolean): void {
        this.message.color = color("#F4FFE5");
        if (this.round.status === "lost") {
            this.message.string = `第 ${this.round.slotCapacity} 格已满 · 本局结束`;
            this.message.color = color("#FFE5A4");
        } else if (this.round.status === "won") {
            this.message.string =
                this.round.level === 1
                    ? "第一关清盘，进入第二关"
                    : "第二关清盘！";
            this.message.color = color("#FFE5A4");
        }
        this.refresh();
        if (this.round.status === "lost") {
            this.showResult(false);
        } else if (this.round.status === "won") {
            if (this.round.level === 2) {
                if (WECHAT) this.postRankMessage("record-win");
                this.showResult(true);
                return;
            }
            const won = this.round;
            this.scheduleOnce(
                () => {
                    if (this.round === won) this.showTutorialClear();
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
            this.loadingBoard ||
            this.animatingCards
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
        this.showMockAd(
            `看完解锁第 ${index + 1} 格，本局有效`,
            () => {
                if (!this.round.unlockNextSlot()) return;
                this.message.string = `已解锁第 ${this.round.slotCapacity} 格`;
                this.refresh();
            },
            () => {},
        );
    }

    private showMockAd(
        description: string,
        complete: () => void,
        cancel: () => void,
    ): void {
        const dialog = this.openOverlay("MockAd");
        this.panel(dialog, "AdCard", 0, 606, 308, "#FFF9E0", "#859F73");
        label(dialog, "模拟激励广告", 40, "#56351C").node.setPosition(0, 79);
        label(dialog, description, 27, "#503918").node.setPosition(0, 12);
        this.button(
            "取消",
            -134,
            -81,
            232,
            () => {
                this.closeOverlay();
                cancel();
            },
            dialog,
        );
        this.button(
            "模拟看完",
            134,
            -81,
            232,
            () => {
                this.closeOverlay();
                complete();
            },
            dialog,
        );
    }

    private openOverlay(name: string, shade = true): Node {
        this.closeOverlay();
        const overlay = uiNode(this.node, name, 750, 1334);
        this.overlay = overlay;
        const { width, height } = this.screenSize();
        overlay.getComponent(UITransform)!.setContentSize(width, height);
        overlay.addComponent(BlockInputEvents);
        if (shade) this.fillScreen(overlay, "#182710AC");
        return overlay;
    }

    private closeOverlay(): void {
        this.feedbackButton?.destroy();
        this.feedbackButton = undefined;
        this.feedbackControl = undefined;
        if (!this.overlay) return;
        this.overlay.removeFromParent();
        this.overlay.destroy();
        this.overlay = undefined;
        this.gameRoot.active = true;
    }

    private returnHome(): void {
        this.openRound(1, "C");
        this.showWelcome();
    }

    private showWelcome(): void {
        this.closeOverlay();
        if (this.welcome) {
            this.gameRoot.active = false;
            return;
        }
        const welcome = uiNode(this.node, "Welcome", 750, 1334);
        this.welcome = welcome;
        this.gameRoot.active = false;
        showWelcome(welcome, this.art, this.controls, {
            settings: () => this.showSettings(true),
            play: () => {
                this.welcome = undefined;
                welcome.destroy();
                this.gameRoot.active = true;
                this.audio.startMusic();
            },
            home: () => this.showHomeCollection(),
            share: () => this.share(),
            leaderboard: () => this.showLeaderboard(),
        });
    }

    private showHomeCollection(): void {
        const overlay = this.openOverlay("HomeCollection");
        this.gameRoot.active = false;
        const card = this.panel(
            overlay,
            "HomeCollectionCard",
            0,
            580,
            660,
            "#FFF1D4",
            "#8F552B",
        );
        this.heading(card, "我的家园", 330, "#C58D42", "#805025", "small");
        picture(
            card,
            "HomeMascot",
            this.art.homeAnimals[2],
            135,
        ).node.setPosition(0, 208);
        const close = this.button(
            "×",
            267,
            307,
            60,
            () => this.showWelcome(),
            card,
            60,
        );
        this.paintButton(close, false, true, "cream");
        const viewport = uiNode(card, "AnimalListViewport", 530, 362);
        viewport.setPosition(0, -62);
        viewport.addComponent(Mask);
        const scroll = viewport.addComponent(ScrollView);
        scroll.horizontal = false;
        const list = uiNode(viewport, "AnimalList", 530, 362);
        scroll.content = list;
        const animals = [
            { name: "猫猫", area: "猛兽区", description: "喵星人，有四条腿。" },
            {
                name: "小鹿",
                area: "家禽区",
                description: "温顺的鹿，有四条腿。",
            },
            {
                name: "小熊猫",
                area: "乐园区",
                description: "萌萌的熊猫，有四条腿。",
            },
        ];
        animals.forEach(({ name, area, description }, index) => {
            const row = this.panel(
                list,
                name,
                116 - index * 116,
                510,
                104,
                "#FFF9E5",
                "#D2B987",
            );
            picture(
                row,
                "AnimalBadge",
                this.art.homeAnimals[index],
                77,
            ).node.setPosition(-201, 0);
            label(row, name, 31, "#56351C").node.setPosition(-111, 23);
            const category = this.panel(
                row,
                "AnimalArea",
                23,
                96,
                34,
                ["#BD5546", "#548865", "#4384AD"][index],
                "#00000000",
            );
            category.setPosition(18, 23);
            label(category, area, 20, "#FFFFFF");
            label(row, description, 23, "#56351C").node.setPosition(-51, -22);
            const exchange = this.button(
                "兑换",
                178,
                0,
                103,
                () => undefined,
                row,
                55,
            );
            this.paintButton(exchange, false, false);
        });
        label(card, "兑换暂未开放", 25, "#684824").node.setPosition(0, -290);
    }

    private celebrate(parent: Node, badge: Node, finale: boolean): void {
        const effects = uiNode(parent, "ClearCelebration");
        effects.setSiblingIndex(badge.getSiblingIndex());
        effects.addComponent(ClearCelebration).play(badge, finale);
    }

    private showTutorialClear(): void {
        const overlay = this.openOverlay("TutorialClear");
        this.panel(overlay, "ClearCard", 38, 490, 306, "#FFF9E0", "#859F73");
        const badge = picture(overlay, "ClearBadge", this.art.paw, 96).node;
        badge.setPosition(0, 121);
        this.celebrate(overlay, badge, false);
        const title = label(overlay, "教学完成！", 43, "#56351C");
        title.isBold = true;
        title.node.setPosition(0, 30);
        label(overlay, "正在进入第二关", 26, "#684824").node.setPosition(
            0,
            -34,
        );
        this.scheduleOnce(this.advanceToMainBoard, 1.25);
    }

    private showResult(won: boolean, feedback?: string): void {
        const result = this.openOverlay("RoundResult", false);
        this.gameRoot.active = false;
        this.fillScreen(result, "#142B31A8");
        const canRevive = !WECHAT && this.round.canRevive;
        const illustration = won ? this.art.winPanda : this.art.sadPanda;
        const panda = picture(
            result,
            "ResultPanda",
            illustration,
            (204 * illustration.originalSize.width) /
                illustration.originalSize.height,
            204,
        );
        this.place(panda.node, 0, 448);
        if (won) this.celebrate(result, panda.node, true);
        this.heading(
            result,
            won ? "游戏胜利" : "失败啦",
            322,
            "#A66532",
            "#63381D",
            "ribbon",
        );
        const summary = this.panel(
            result,
            "ResultRanking",
            34,
            610,
            375,
            "#FFF1D4",
            "#8F552B",
        );
        label(summary, "好友本周榜", 31, "#56351C").node.setPosition(0, 153);
        this.showWeekRanking(summary, true);
        const viewAll = this.button(
            "查看全部排行 ›",
            123,
            -139,
            305,
            () =>
                this.showLeaderboard(false, () =>
                    this.showResult(won, feedback),
                ),
            summary,
            54,
        );
        this.paintButton(viewAll, false, true, "cream");

        if (!won || feedback) {
            label(
                result,
                feedback ?? "卡槽已满",
                26,
                "#FFF1D4",
            ).node.setPosition(0, -205);
        }
        if (canRevive) {
            const revive = this.button(
                "看视频复活",
                0,
                -278,
                330,
                () => this.requestRevive(result),
                result,
                70,
            );
            this.paintButton(revive, true);
            this.addAdBadge(revive.graphic.node, revive.width, revive.height);
        }
        const y = canRevive ? -411 : -330;
        const home = this.button(
            "⌂ 首页",
            -233,
            y,
            145,
            () => this.returnHome(),
            result,
            82,
        );
        this.paintButton(home, false, true, "cream");
        if (WECHAT) {
            const share = this.button(
                "分享",
                0,
                y,
                145,
                () => this.share(won),
                result,
                82,
            );
            this.paintButton(share, false, true, "cream");
        }
        const retry = this.button(
            won ? "再次挑战" : "继续挑战",
            212,
            y,
            192,
            () => {
                this.closeOverlay();
                this.restartRound();
            },
            result,
            82,
        );
        this.paintButton(retry, false, true, won ? "cream" : "green");
    }

    private requestRevive(result: Node): void {
        const round = this.round;
        if (WECHAT || this.overlay !== result || !round.canRevive) return;
        this.showMockAd(
            "看完解锁 1 格，继续本局",
            () => {
                if (this.round !== round || !round.revive()) return;
                this.message.string = `已解锁第 ${round.slotCapacity} 格 · 继续本局`;
                this.finishAction(false);
            },
            () => this.showResult(false),
        );
    }

    private shareCard(won: boolean): ShareCard {
        const cards = GameGlobal.flipZooShareCards;
        return cards?.[won ? 1 : 0] ?? { title: "两只眼睛几条腿" };
    }

    private share(won = false): boolean {
        if (!WECHAT || !wx.shareAppMessage) {
            this.platformNotice("当前环境无法调起微信分享", this.welcome);
            return false;
        }
        try {
            wx.shareAppMessage(this.shareCard(won));
            return true;
        } catch {
            this.platformNotice("暂时无法打开分享");
            return false;
        }
    }

    private platformNotice(message: string, fallback?: Node): void {
        if (WECHAT) wx.showToast?.({ title: message, icon: "none" });
        else {
            const parent = this.overlay ?? fallback;
            if (!parent) return;
            parent.getChildByName("PlatformNotice")?.destroy();
            const notice = label(parent, message, 24, "#56351C");
            notice.node.name = "PlatformNotice";
            this.place(notice.node, 0, parent === this.welcome ? -550 : -294);
        }
    }

    private syncFeedbackButton(): void {
        this.feedbackButton?.destroy();
        this.feedbackButton = undefined;
        if (!WECHAT || !this.feedbackControl || !wx.createFeedbackButton)
            return;
        const window = wx.getWindowInfo?.();
        if (!window) return;
        const rect = this.feedbackControl
            .getComponent(UITransform)!
            .getBoundingBoxToWorld();
        const visible = view.getVisibleSize();
        const scaleX = window.windowWidth / visible.width;
        const scaleY = window.windowHeight / visible.height;
        try {
            const button = wx.createFeedbackButton({
                type: "text",
                text: "",
                style: {
                    left: rect.x * scaleX,
                    top: window.windowHeight - (rect.y + rect.height) * scaleY,
                    width: rect.width * scaleX,
                    height: rect.height * scaleY,
                    backgroundColor: "rgba(0,0,0,0)",
                    color: "#FFFFFF",
                },
            });
            this.feedbackButton = button;
            button?.show();
        } catch {
            this.feedbackButton?.destroy();
            this.feedbackButton = undefined;
        }
    }

    private postRankMessage(
        action: "show-week" | "show-preview" | "record-win" | "scroll-week",
        rows?: number,
    ): boolean {
        const context = wx.getOpenDataContext?.();
        if (!context) return false;
        context.postMessage({ action, rows });
        return true;
    }

    private showWeekRanking(parent: Node, preview = false): void {
        const height = preview ? 226 : 515;
        const list = uiNode(parent, "WeeklyLeaderboard", 550, height);
        list.setPosition(0, preview ? 12 : -13);
        if (WECHAT && wx.getOpenDataContext?.()) {
            list.addComponent(SubContextView).fps = 12;
            if (!preview) {
                let distance = 0;
                list.on(Node.EventType.TOUCH_START, () => {
                    distance = 0;
                });
                list.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
                    distance += event.getUIDelta().y;
                    const rows = Math.trunc(distance / 48);
                    if (!rows) return;
                    distance -= rows * 48;
                    this.postRankMessage("scroll-week", rows);
                });
            }
            this.button(
                "刷新",
                0,
                preview ? -150 : -288,
                125,
                () =>
                    this.postRankMessage(
                        preview ? "show-preview" : "show-week",
                    ),
                parent,
                48,
            );
            this.postRankMessage(preview ? "show-preview" : "show-week");
        } else {
            label(list, "请在微信小游戏内查看好友周榜", 27, "#56351C");
        }
    }

    private showLeaderboard(
        history = false,
        back = () => this.showWelcome(),
    ): void {
        const overlay = this.openOverlay("Leaderboard");
        this.gameRoot.active = false;
        const card = this.panel(
            overlay,
            "LeaderboardCard",
            0,
            642,
            840,
            "#FFF1D4",
            "#8F552B",
        );
        this.heading(card, "好友排行榜", 418, "#A66532", "#63381D", "small");
        const week = this.button(
            "本周榜",
            -143,
            330,
            263,
            () => this.showLeaderboard(false, back),
            card,
        );
        const previous = this.button(
            "历史榜",
            143,
            330,
            263,
            () => this.showLeaderboard(true, back),
            card,
        );
        this.paintButton(week, !history, true, "cream");
        this.paintButton(previous, history, true, "cream");
        if (history) label(card, "历史榜暂未开放", 32, "#56351C");
        else this.showWeekRanking(card);
        const close = this.button("◀ 返回", 0, -360, 244, back, card, 72);
        this.paintButton(close, true);
    }

    private addAdBadge(parent: Node, width: number, height: number): void {
        const badge = uiNode(parent, "RewardedAdBadge", 38, 28);
        badge.setPosition(width / 2 - 23, height / 2 - 13);
        const graphic = badge.addComponent(Graphics);
        graphic.fillColor = color("#56351C");
        graphic.roundRect(-19, -14, 38, 28, 7);
        graphic.fill();
        graphic.fillColor = color("#FFF1DE");
        graphic.moveTo(-5, -7);
        graphic.lineTo(8, 0);
        graphic.lineTo(-5, 7);
        graphic.close();
        graphic.fill();
    }

    private showPropClaim(prop: Prop): void {
        const round = this.round;
        const dialog = this.openOverlay("PropClaim");
        this.gameRoot.active = false;
        const [fill, border, height] = (
            {
                undo: ["#66BFF6", "#307FBF", 510],
                peek: ["#FFC84F", "#B57122", 475],
                remove: ["#F0AB54", "#648C47", 570],
            } as const
        )[prop];
        const card = this.panel(
            dialog,
            "PropClaimCard",
            0,
            600,
            height,
            "#FFF9E5",
            border,
        );
        const descriptions: Record<Prop, string> = {
            undo: "最后一张入槽且未消除的牌回到桌面原位，保持正面。已触发三消时不能撤回。",
            peek: "翻开所有无遮挡暗牌。不足三张时从高层受压暗牌补，受压牌仍需移开上层牌才能入槽。",
            remove: "给槽内每组牌从桌面同一层补齐同款。所有组都能补齐时逐组消除，否则保留原状。",
        };
        this.heading(
            card,
            PROP_LABELS[prop] + "道具",
            height / 2,
            fill,
            border,
            "ribbon",
        );
        if (prop === "undo")
            picture(card, "PropIcon", this.art.undo, 106).node.setPosition(
                0,
                116,
            );
        else {
            const icon = this.drawPropIcon(card, prop).node;
            icon.setScale(1.55, 1.55, 1);
            icon.setPosition(0, height / 2 - 135);
        }
        const rules = label(card, descriptions[prop], 30, "#56351C");
        rules.overflow = Label.Overflow.RESIZE_HEIGHT;
        rules.node.getComponent(UITransform)!.setContentSize(480, 0);
        const share = this.button(
            WECHAT ? "分享" : "模拟分享",
            -131,
            -height / 2 + 79,
            220,
            () => {
                if (
                    this.overlay !== dialog ||
                    this.round !== round ||
                    !round.canClaimProp(prop)
                )
                    return;
                if ((WECHAT && !this.share()) || !round.claimProp(prop)) return;
                this.closeOverlay();
                this.message.string = "已获得" + PROP_LABELS[prop] + "道具";
                this.refresh();
            },
            card,
            76,
        );
        this.paintButton(share, false, true, "green");
        this.button(
            "关闭",
            131,
            -height / 2 + 79,
            220,
            () => this.closeOverlay(),
            card,
            76,
        );
    }

    private onPropTouch(prop: Prop): void {
        if (
            this.overlay ||
            this.loadingBoard ||
            this.animatingCards ||
            this.round.status !== "playing"
        )
            return;
        if (this.round.canClaimProp(prop)) {
            this.showPropClaim(prop);
            return;
        }
        if (!this.round.propUsesLeft(prop)) {
            this.message.string = "这个道具本局已用完";
            return;
        }
        if (prop === "remove") {
            const hasCards = this.round.slots.length > 0;
            const groups = this.round.clearSlots();
            if (!groups) {
                this.message.string = hasCards
                    ? PROP_UNAVAILABLE.remove
                    : "卡槽是空的";
                return;
            }
            this.animatingCards = true;
            this.message.string = "正在补齐槽内同款…";
            this.playSlotClear(groups, 0);
        } else {
            if (!this.round.use(prop)) {
                this.message.string = PROP_UNAVAILABLE[prop];
                return;
            }
            this.message.string = PROP_MESSAGES[prop];
            this.finishAction(false);
        }
        const { button } = this.propButtons.get(prop)!;
        const flash = uiNode(button.graphic.node, "PropFlash");
        const graphic = flash.addComponent(Graphics);
        graphic.strokeColor = color("#FFE36C");
        graphic.lineWidth = 6;
        graphic.roundRect(
            -button.width / 2,
            -button.height / 2,
            button.width,
            button.height,
            18,
        );
        graphic.stroke();
        tween(flash.addComponent(UIOpacity))
            .to(0.45, { opacity: 0 })
            .call(() => flash.destroy())
            .start();
    }

    private playSlotClear(
        groups: readonly SlotClearGroup[],
        index: number,
    ): void {
        const group = groups[index];
        if (!group) {
            this.animatingCards = false;
            this.message.string = PROP_MESSAGES.remove;
            this.finishAction(false);
            return;
        }

        const kinds: (number | undefined)[] = Array.from(
            { length: 3 },
            (_, slot) => (slot < group.heldCount ? group.kind : undefined),
        );
        for (const waiting of groups.slice(index + 1)) {
            for (let held = 0; held < waiting.heldCount; held += 1) {
                kinds.push(waiting.kind);
            }
        }
        this.refreshSlots(kinds);
        let landed = 0;
        const flyNext = () => {
            const card = group.boardCards[landed];
            if (card) {
                const slot = group.heldCount + landed;
                this.flyCardToSlot(card, slot, () => {
                    kinds[slot] = group.kind;
                    this.refreshSlots(kinds);
                    landed += 1;
                    flyNext();
                });
                return;
            }
            this.playMatch(group.kind, [0, 1, 2]);
            kinds.fill(undefined, 0, 3);
            this.refreshSlots(kinds);
            this.scheduleOnce(
                () => this.playSlotClear(groups, index + 1),
                MATCH_DURATION,
            );
        };
        flyNext();
    }

    private refreshSlots(kinds: readonly (number | undefined)[]): void {
        this.slots.forEach((slot, index) => {
            const kind = kinds[index];
            const locked =
                index >= this.round.slotCapacity && kind === undefined;
            const adBadge = slot.node.getChildByName("RewardedAdBadge");
            if (adBadge) adBadge.active = locked;
            if (kind !== undefined) slot.show(kind, FULL_EXPOSURE, true);
            else slot.showEmpty(locked ? "锁定" : undefined);
        });
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
        this.refreshSlots(round.slots.map((card) => card.kind));
        for (const [prop, { button, count }] of this.propButtons) {
            button.graphic.node.active = round.level === 2;
            const remaining = round.propUsesLeft(prop);
            const available = round.canUse(prop);
            const claimable = round.canClaimProp(prop);
            count.string = claimable ? "+" : String(remaining);
            count.node.parent!.active = claimable || remaining > 0;
            count.color = color("#FFFFFF");
            this.paintButton(
                button,
                false,
                available || claimable || remaining > 0,
                prop === "undo" ? "blue" : prop === "peek" ? "purple" : "green",
            );
        }
        this.tutorialRibbon.active = round.level === 1;
        this.propTray.active = round.level === 2;
        const stage = `第 ${round.level} 关${!WECHAT && round.level === 2 ? ` · ${round.group} 组` : ""}`;
        this.stage.string = stage;
        this.progress.string = `剩余 ${round.remaining}/${round.cards.length}`;
        this.steps.string = String(round.moves);
        if (!WECHAT) {
            const first =
                round.firstMatchAt === "prop"
                    ? "道具"
                    : (round.firstMatchAt ?? "—");
            this.stepsCaption.string = `入槽 · 首消 ${first}`;
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
        this.place(component.node, 0, y);
        return component;
    }

    private screenSize(): { width: number; height: number } {
        return view.getVisibleSize();
    }

    private fitViewport(): void {
        const { width, height } = screen.windowSize;
        const policy =
            width * 1334 <= height * 750
                ? ResolutionPolicy.FIXED_WIDTH
                : ResolutionPolicy.FIXED_HEIGHT;
        if (policy === this.viewportPolicy) return;
        this.viewportPolicy = policy;
        view.setDesignResolutionSize(750, 1334, policy);
    }

    private resizeBackdrops(): void {
        this.fitViewport();
        const { width, height } = this.screenSize();
        if (this.garden) {
            const source = this.art.garden.originalSize;
            const scale = Math.max(
                width / source.width,
                height / source.height,
            );
            this.garden.setContentSize(
                source.width * scale,
                source.height * scale,
            );
        }
        for (const root of [this.gameRoot, this.welcome, this.overlay]) {
            if (!root) continue;
            for (const child of root.children) {
                const y = this.pagePositions.get(child);
                if (y !== undefined)
                    child.setPosition(
                        child.position.x,
                        y * this.pageScale(height),
                    );
            }
            if (root === this.overlay)
                root.getComponent(UITransform)!.setContentSize(width, height);
            const graphic = root
                .getChildByName("Backdrop")
                ?.getComponent(Graphics);
            if (graphic) this.drawBackdrop(graphic, width, height);
        }
        if (WECHAT) this.layoutWeChatGame(height);
        this.syncFeedbackButton();
    }

    private fitBoard(board: Node, width: number, height: number): void {
        const bounds = board.getComponent(UITransform)!;
        const scale = Math.min(
            1,
            (width - 20) / bounds.width,
            (height - 20) / bounds.height,
        );
        board.setScale(scale, scale, 1);
    }

    private layoutWeChatGame(height: number): void {
        if (!this.board || !this.slotTray) return;
        const window = wx.getWindowInfo?.();
        const safeArea = window?.safeArea;
        const scale = window?.windowHeight ? height / window.windowHeight : 1;
        const menu = wx.getMenuButtonBoundingClientRect?.();
        const topInset =
            Math.max(safeArea?.top ?? 0, menu?.bottom || 64) * scale;
        const bottomInset =
            window && safeArea
                ? Math.max(0, window.windowHeight - safeArea.bottom) * scale
                : 24;
        const top = height / 2 - topInset - 4;
        const { stage, settings, goals, moves } = this.gameHeader;
        const stageHeight = stage.getComponent(UITransform)!.height;
        const stageTop = safeArea?.top
            ? height / 2 - safeArea.top * scale - 1
            : top;
        const stageY = stageTop - stageHeight / 2;
        stage.setPosition(0, stageY);
        const settingsHeight = settings.getComponent(UITransform)!.height;
        const capsuleCenter =
            menu && menu.top !== undefined
                ? height / 2 - ((menu.top + menu.bottom) / 2) * scale
                : stageY;
        const settingsY = Math.min(
            capsuleCenter,
            height / 2 - (safeArea?.top ?? 0) * scale - settingsHeight / 2 - 4,
        );
        settings.setPosition(settings.position.x, settingsY);
        const headerHeight = Math.max(
            stageHeight,
            settings.getComponent(UITransform)!.height,
        );
        const compact = this.round.level === 2;
        stage.active = !compact;
        goals.active = !compact;
        moves.active = !compact;
        const statsTop =
            Math.min(
                top,
                stageY - headerHeight / 2,
                settingsY - settingsHeight / 2,
            ) - 8;
        const statsHeight = goals.getComponent(UITransform)!.height;
        for (const node of [goals, moves]) {
            node.setPosition(node.position.x, statsTop - statsHeight / 2);
        }
        const messageY = compact ? statsTop - 7 : statsTop - statsHeight - 22;
        this.message.node.setPosition(0, messageY);

        const tutorial = this.round.level === 1;
        const bottom = -height / 2 + bottomInset + (tutorial ? 12 : 2);
        const footer = tutorial ? this.tutorialRibbon : this.propTray;
        const footerHeight = footer.getComponent(UITransform)!.height;
        const trayHeight = this.slotTray.getComponent(UITransform)!.height;
        const mat = this.playMats[this.round.level];
        const matBounds = mat.getComponent(UITransform)!;
        const boardTop = compact ? statsTop - 22 : messageY - 24;
        const footerAndTrayHeight = footerHeight + 14 + trayHeight;
        const availableBoardHeight = Math.max(
            40,
            boardTop - bottom - footerAndTrayHeight - 18,
        );
        const boardHeight = tutorial
            ? Math.min(matBounds.height, availableBoardHeight)
            : availableBoardHeight;
        const stackBottom = bottom + (availableBoardHeight - boardHeight) / 2;
        footer.setPosition(0, stackBottom + footerHeight / 2);
        const trayTop = stackBottom + footerAndTrayHeight;
        this.slotTray.setPosition(0, trayTop - trayHeight / 2);
        const boardBottom = trayTop + (tutorial ? 18 : 8);
        const center = boardBottom + boardHeight / 2;
        mat.setPosition(0, center);
        mat.setScale(1, boardHeight / matBounds.height, 1);
        this.board.node.setPosition(0, center);
        if (!tutorial) this.resizeMainTiles(matBounds.width, boardHeight);
        this.fitBoard(this.board.node, matBounds.width, boardHeight);
    }

    private resizeMainTiles(width: number, height: number): void {
        const board = this.board!;
        const bounds = board.node.getComponent(UITransform)!;
        const rows = bounds.height / board.tileHeight;
        const widthScale = Math.min(1, (width - 20) / bounds.width);
        const tileHeight = Math.max(
            TABLE[2].height,
            Math.min(TABLE[2].height * 1.24, (height - 20) / rows / widthScale),
        );
        if (Math.abs(tileHeight - board.tileHeight) < 0.01) return;
        board.tileHeight = tileHeight;
        bounds.setContentSize(bounds.width, rows * tileHeight);
        for (const card of this.round.cards) {
            const view = this.cards[card.id];
            view.setHeight(tileHeight);
            view.node.setPosition(
                view.node.position.x,
                bounds.height / 2 - (card.top - board.top + 0.5) * tileHeight,
            );
            const exposure = this.round.isOnBoard(card)
                ? this.round.exposure(card)
                : 0;
            const kind = this.round.isFaceUp(card, exposure) ? card.kind : null;
            view.show(kind, exposure, this.round.isSelectable(exposure));
        }
    }

    private pageScale(height: number): number {
        // Leave room for the WeChat system chrome on tall devices.
        return Math.min(height / 1334, WECHAT ? 1.1 : 1.25);
    }

    private place(node: Node, x: number, y: number): void {
        const page =
            node.parent === this.gameRoot ||
            node.parent === this.overlay ||
            node.parent === this.welcome;
        if (page) this.pagePositions.set(node, y);
        node.setPosition(
            x,
            page ? y * this.pageScale(this.screenSize().height) : y,
        );
    }

    private fillScreen(parent: Node, fill: string): void {
        const graphic = uiNode(parent, "Backdrop").addComponent(Graphics);
        graphic.fillColor = color(fill);
        const { width, height } = this.screenSize();
        this.drawBackdrop(graphic, width, height);
    }

    private drawBackdrop(
        graphic: Graphics,
        width: number,
        height: number,
    ): void {
        graphic.clear();
        graphic.rect(-width / 2, -height / 2, width, height);
        graphic.fill();
    }

    private heading(
        parent: Node,
        text: string,
        y: number,
        fill: string,
        border: string,
        shape: "small" | "ribbon" | "cloud",
    ): void {
        const width = shape === "small" ? 260 : 520;
        const sign = uiNode(parent, "Heading", width, 98);
        this.place(sign, 0, y);
        const graphic = sign.addComponent(Graphics);
        graphic.fillColor = color(border);
        if (shape === "ribbon") {
            for (const side of [-1, 1]) {
                graphic.moveTo(side * 199, 26);
                graphic.lineTo(side * 303, 19);
                graphic.lineTo(side * 278, -11);
                graphic.lineTo(side * 303, -47);
                graphic.lineTo(side * 194, -53);
                graphic.close();
            }
            graphic.fill();
        }
        graphic.strokeColor = color(border);
        graphic.lineWidth = 5;
        graphic.fillColor = color(fill);
        if (shape === "cloud") {
            graphic.roundRect(-290, -46, 580, 90, 45);
            graphic.fill();
            graphic.stroke();
            graphic.ellipse(-143, 20, 100, 57);
            graphic.ellipse(0, 28, 128, 65);
            graphic.ellipse(143, 20, 100, 57);
            graphic.fill();
        } else {
            graphic.roundRect(
                -width / 2,
                -43,
                width,
                86,
                shape === "small" ? 26 : 16,
            );
            graphic.fill();
            graphic.stroke();
        }
        titleLine(
            sign,
            text,
            0,
            shape === "small" ? 44 : 54,
            "#FFFEF2",
            border,
        );
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
        this.place(node, 0, y);
        const graphic = node.addComponent(Graphics);
        graphic.fillColor = new Color(57, 41, 18, 65);
        graphic.roundRect(-width / 2, -height / 2 - 6, width, height, 20);
        graphic.fill();
        graphic.fillColor = color(fill);
        graphic.strokeColor = color(border);
        graphic.lineWidth = 4;
        graphic.roundRect(-width / 2, -height / 2, width, height, 20);
        graphic.fill();
        graphic.stroke();
        graphic.fillColor = new Color(255, 255, 255, 115);
        graphic.roundRect(-width / 2 + 15, height / 2 - 7, width - 30, 3, 1.5);
        graphic.fill();
        if (
            width >= 450 &&
            height >= 220 &&
            this.overlay &&
            (parent === this.overlay || parent.isChildOf(this.overlay))
        ) {
            picture(
                node,
                "PaperGrain",
                this.art.paper,
                width - 38,
                height - 38,
            );
        }
        return node;
    }

    private drawPropIcon(parent: Node, prop: "peek" | "remove"): Graphics {
        const node = uiNode(parent, "PropIcon", 71, 71);
        const icon = node.addComponent(Graphics);
        node.addComponent(UIOpacity);
        icon.lineWidth = 3;
        if (prop === "peek") {
            icon.strokeColor = color("#4C3A8F");
            icon.fillColor = color("#B69BF1");
            icon.roundRect(-27, -17, 38, 50, 7);
            icon.fill();
            icon.stroke();
            icon.fillColor = color("#F2E9FF");
            icon.roundRect(-8, -28, 37, 50, 7);
            icon.fill();
            icon.stroke();
            picture(node, "CardPaw", this.art.paw, 22).node.setPosition(11, -3);
        } else {
            icon.strokeColor = color("#8A542D");
            icon.fillColor = color("#B97848");
            icon.roundRect(1, -1, 13, 34, 5);
            icon.fill();
            icon.stroke();
            icon.fillColor = color("#FFC955");
            icon.moveTo(-10, 5);
            icon.lineTo(15, 5);
            icon.lineTo(25, -24);
            icon.quadraticCurveTo(0, -39, -24, -22);
            icon.close();
            icon.fill();
            icon.stroke();
            icon.strokeColor = color("#E5A742");
            icon.moveTo(-5, -6);
            icon.lineTo(-11, -24);
            icon.moveTo(8, -7);
            icon.lineTo(13, -27);
            icon.stroke();
            icon.fillColor = color("#70BD9F");
            icon.roundRect(-10, -2, 27, 9, 4);
            icon.fill();
            node.angle = -24;
        }
        return icon;
    }

    private button(
        text: string,
        x: number,
        y: number,
        width: number,
        action: () => void,
        parent = this.gameRoot,
        height = 66,
        frame?: SpriteFrame | "peek" | "remove",
    ): Control {
        const node = uiNode(parent, text || "Other-Level", width, height);
        this.place(node, x, y);
        node.on(Node.EventType.TOUCH_END, action);
        const button = {
            graphic: node.addComponent(Graphics),
            caption: label(node, text, height >= 80 && !frame ? 35 : 26),
            width,
            height,
            icon:
                typeof frame === "string"
                    ? this.drawPropIcon(node, frame)
                    : frame
                      ? picture(node, "PropIcon", frame, 86)
                      : undefined,
        };
        if (text === "☰") {
            button.caption.fontSize = 61;
            button.caption.lineHeight = 68;
        }
        if (button.icon) {
            button.icon.node.getComponent(UITransform)!.setContentSize(71, 71);
            button.icon.node.setPosition(0, 13);
            button.caption.node.setPosition(0, -29);
            button.caption.fontSize = 19;
            button.caption.lineHeight = 22;
        }
        button.caption.isBold = true;
        button.caption.node.addComponent(LabelOutline).width = 2;
        this.paintButton(button, false);
        return button;
    }

    private paintButton(
        button: Control,
        active: boolean,
        enabled = true,
        tone: "blue" | "green" | "cream" | "red" | "purple" = "blue",
    ): void {
        const { graphic, caption, width, height, icon } = button;
        const palette = !enabled
            ? icon
                ? ["#527F98", "#34586C", "#D5E7EC"]
                : ["#829D9D", "#526D75", "#E9F2E9"]
            : active
              ? ["#FFC849", "#A96117", "#FFFDF2"]
              : {
                    blue: ["#32AAEC", "#1A6097", "#FFFFFF"],
                    red: ["#E87B4C", "#A9472D", "#FFFFFF"],
                    purple: ["#9C79F2", "#5D49AC", "#FFFFFF"],
                    green: ["#6DCE61", "#2F813B", "#FFFFFF"],
                    cream: ["#FFF1C8", "#A9905D", "#4D3B2B"],
                }[tone];
        const [fill, border, text] = palette;
        const radius = !caption.node.active
            ? 29
            : caption.string === "☰"
              ? Math.min(width, height) / 2
              : height >= 80 && width >= 300
                ? 37
                : 18;
        graphic.clear();
        graphic.fillColor = color(border);
        graphic.roundRect(-width / 2, -height / 2 - 6, width, height, radius);
        graphic.fill();
        graphic.fillColor = color(fill);
        graphic.strokeColor = color(border);
        graphic.lineWidth = 4;
        graphic.roundRect(-width / 2, -height / 2, width, height, radius);
        graphic.fill();
        graphic.stroke();
        graphic.fillColor = new Color(255, 255, 255, enabled ? 124 : 48);
        graphic.roundRect(
            -width / 2 + radius,
            height / 2 - 9,
            Math.max(8, width - 2 * radius),
            4,
            2,
        );
        graphic.fill();
        caption.color = color(text);
        caption.node.getComponent(LabelOutline)!.color = color(border);
        if (icon instanceof Sprite)
            icon.color = enabled ? Color.WHITE : new Color(200, 179, 172, 215);
        else if (icon)
            icon.getComponent(UIOpacity)!.opacity = enabled ? 255 : 170;
    }
}
