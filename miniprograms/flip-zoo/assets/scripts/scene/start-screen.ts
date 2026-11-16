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
    Tween,
} from "cc";
import { leaderboardScale } from "../ui/leaderboard-layout";
import { ButtonPress, scaleButton } from "../ui/button-press";
import { drawButtonIcon } from "../ui/button-icon";
import { WECHAT } from "cc/env";
import { loadZooArtwork, type ZooArtwork } from "../services/artwork";
import {
    checkCloudConnection,
    hasCloudEnvironment,
    readReleaseVersion,
} from "../services/cloud-health";
import {
    FRAGMENT_ANIMALS,
    loadFragmentBalances,
    settleFragmentRound,
    startFragmentRound,
    type RoundAction,
} from "../services/fragments";
import { createBoardApi, type MainBoardDeal } from "../services/board-api";
import type { Control, ScreenControls } from "../ui/screen-controls";
import {
    flyCardToSlot,
    MATCH_DURATION,
    playMatch,
    slideSlotCard,
} from "../gameplay/card-effects";
import { CardView } from "../gameplay/card-view";
import {
    artworkButton,
    dialogArtwork,
    shadedButton,
    color,
    label,
    picture,
    titleLine,
    uiNode,
} from "../ui/nodes";
import { ClearCelebration, shatterMirror } from "../gameplay/clear-celebration";
import { showWelcome } from "../home/welcome-view";
import { SettingsView } from "../settings/settings-view";
import { ZooAudio } from "../services/zoo-audio";
import {
    FULL_EXPOSURE,
    GROUPS,
    PROPS,
    covers,
    Round,
    type Card,
    type Group,
    type Level,
    type BoardLayout,
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
    1: { width: 134, height: 169, y: 124 },
    2: { width: 88, height: 92, y: -17 },
} as const;

interface ShareCard {
    title: string;
    imageUrlId?: string;
    imageUrl?: string;
}

declare const GameGlobal: { flipZooShareCards?: ShareCard[] };
declare const wx: {
    getAccountInfoSync?: () => { miniProgram?: { version?: string } };
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
    }) => { show(): void; destroy(): void; onTap?(callback: () => void): void };
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
    private readonly shareFromMenu = () =>
        this.shareCard(
            this.overlay?.name === "RoundResult" && this.round.status === "won",
        );
    private readonly boardApi = createBoardApi(WECHAT);
    private nextBoard?: {
        requestedAt: number;
        deal: Promise<(MainBoardDeal & { roundId?: string }) | undefined>;
    };
    private fragmentRound?: { id: string; actions: RoundAction[] };
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
                    retry.node.destroy();
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
            void checkCloudConnection().catch(() => {
                console.warn("FLIP ZOO cloud connection could not be verified");
            });
            wx.onShareAppMessage?.(this.shareFromMenu);
            wx.showShareMenu?.({ menus: ["shareAppMessage"] });
        }
        this.resizeLayout();
        view.on("canvas-resize", this.resizeLayout, this);
    }

    onDestroy(): void {
        this.feedbackButton?.destroy();
        if (WECHAT) wx.offShareAppMessage?.(this.shareFromMenu);
        view.off("canvas-resize", this.resizeLayout, this);
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
            "Settings",
            -306,
            594,
            76,
            () => {
                if (this.failedBoardGroup) this.restartRound();
                else this.showSettings();
            },
            this.gameRoot,
            72,
        );
        settings.caption.node.active = false;
        this.paintButton(settings, false, true, "green", 36);
        drawButtonIcon(settings.graphic.node, "menu", 0, 0, 49, "#FFFFFF");
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
            settings: settings.node,
            goals,
            moves,
        };
        this.message = this.text("", WECHAT ? 443 : 382, 23, "#F4FFE5");
        const messageOutline = this.message.node.addComponent(LabelOutline);
        messageOutline.color = color("#17483F");
        messageOutline.width = 2;
        if (WECHAT) this.place(this.message.node, -55, 443);
        this.playMats = {
            1: uiNode(this.gameRoot, "TutorialMat", 712, 539),
            2: uiNode(this.gameRoot, "PlayMat", 722, WECHAT ? 846 : 724),
        };
        this.place(this.playMats[1], 0, TABLE[1].y);
        this.tutorialRibbon = this.panel(
            this.gameRoot,
            "TutorialRibbon",
            -417,
            524,
            53,
            "#1E5F52",
            "#8BC5A1",
        );
        label(this.tutorialRibbon, "卡槽里凑齐三张同款就会消除", 24, "#FFF2D6");
        const propWidth = WECHAT ? 116 : 136;
        const propGap = WECHAT ? 67 : 12;
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
        const trayHeight = height + (tutorial ? 54 : WECHAT ? 52 : 36);
        const tray = this.panel(
            this.gameRoot,
            "SlotTray",
            tutorial ? -266 : -478,
            722,
            trayHeight,
            "#E6F1BF",
            "#5A8653",
        );
        this.slotTray = tray;
        this.slotWarning = label(tray, "下一张必须三消", 20, "#703F1D").node;
        this.slotWarning.setPosition(
            0,
            tutorial ? height / 2 + 13 : trayHeight / 2 - 4,
        );
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
            slot.node.setPosition(column * slotPitch + offset, 0);
            if (extra) {
                if (!WECHAT) this.addAdBadge(slot.node, width, height);
                const press = shadedButton(slot.node, () =>
                    this.onSlotTouch(index),
                );
                press.available = () => this.canTapSlot(index);
            }
            this.slots.push(slot);
        }
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
        this.settingsView ??= new SettingsView(
            this.controls,
            this.audio,
            this.art.screens.settings,
        );
        this.feedbackControl = this.settingsView.show(dialog, {
            version: this.releaseVersion(),
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
            abandon: fromWelcome ? undefined : () => this.confirmAbandon(),
            back: () => {
                if (fromWelcome) this.showWelcome();
                else this.closeOverlay();
            },
        });
        this.fitScreenArtwork(dialog.getChildByName("SettingsArtwork"));
        this.syncFeedbackButton();
    }

    private showPrivacy(fromWelcome: boolean): void {
        const dialog = this.openOverlay("ChildPrivacy");
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
            274,
            398,
            66,
            () => {
                this.closeOverlay();
                this.showSettings(fromWelcome);
            },
            card,
            66,
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

    private loadMainBoard(): Promise<MainBoardDeal & { roundId?: string }> {
        return WECHAT && hasCloudEnvironment()
            ? startFragmentRound()
            : this.boardApi.loadMainBoard();
    }

    private preloadMainBoard(): void {
        if (this.nextBoard) return;
        this.nextBoard = {
            requestedAt: Date.now(),
            deal: this.loadMainBoard().catch(() => undefined),
        };
    }

    private async startMainBoard(group: Group): Promise<void> {
        if (this.overlay || this.animatingCards || this.loadingBoard) return;
        this.unschedule(this.advanceToMainBoard);
        const version = ++this.requestVersion;
        const fromTutorial = this.round.level === 1;
        const prefetched = this.nextBoard;
        this.nextBoard = undefined;
        this.loadingBoard = true;
        this.failedBoardGroup = undefined;
        this.message.string = "读取第二关牌局…";
        let deal: MainBoardDeal & { roundId?: string };
        try {
            // Cloud deals expire after 24 hours. Leave time to finish the round.
            const ready =
                prefetched &&
                Date.now() - prefetched.requestedAt < 60 * 60 * 1000
                    ? await prefetched.deal
                    : undefined;
            if (!this.isValid || version !== this.requestVersion) return;
            deal = ready ?? (await this.loadMainBoard());
        } catch {
            if (this.isValid && version === this.requestVersion) {
                this.loadingBoard = false;
                this.failedBoardGroup = group;
                this.message.string = "读取牌局失败，点击左上角重试";
            }
            return;
        }
        if (this.isValid && version === this.requestVersion) {
            this.openRound(
                2,
                deal.roundId ? "C" : group,
                deal.kinds,
                deal.layout,
            );
            if (deal.roundId)
                this.fragmentRound = { id: deal.roundId, actions: [] };
            if (fromTutorial) {
                const mirror = this.openOverlay("MirrorTransition", false);
                const { width, height } = this.screenSize();
                shatterMirror(mirror, width, height, () => {
                    if (this.overlay === mirror) this.closeOverlay();
                });
            }
        }
    }

    private openRound(
        level: Level,
        group: Group,
        boardKinds?: readonly number[],
        layout?: BoardLayout,
    ): void {
        this.requestVersion += 1;
        this.fragmentRound = undefined;
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
        const layerNumbers = Array.from(
            new Set(this.round.cards.map((card) => card.layer)),
        ).sort((a, b) => a - b);
        const layers = new Map(
            layerNumbers.map((layer) => [
                layer,
                uiNode(board, `Layer-${layer}`),
            ]),
        );
        this.cards = this.round.cards.map((card) => {
            const view = new CardView(
                layers.get(card.layer)!,
                `Card-${card.id}`,
                table.width,
                table.height,
                this.art,
                level === 2 ? card.layer : 0,
            );
            view.node.setPosition(
                (card.left - left + 0.5) * table.width - width / 2,
                height / 2 - (card.top - top + 0.5) * table.height,
            );
            return view;
        });
        this.createSlotTray();
        if (level === 2 && !WECHAT) this.matchSlotSizeToBoard();
        if (this.matchLayer) {
            this.matchLayer.removeFromParent();
            this.matchLayer.destroy();
        }
        this.matchLayer = uiNode(this.gameRoot, "MatchEffects");
        this.playMats[1].active = level === 1;
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

        this.fragmentRound?.actions.push(card.id);
        if (this.round.level === 1) this.preloadMainBoard();
        this.animatingCards = true;
        for (let index = insertionIndex; index < previous.length; index += 1) {
            slideSlotCard(
                this.slotTray!,
                this.art,
                this.slots[index].node,
                this.slots[index + 1].node,
                previous[index],
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
        this.refreshBoard();
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
                const reward = this.fragmentRound;
                this.fragmentRound = undefined;
                if (reward)
                    void this.finishFragments(reward.id, reward.actions);
                else this.showResult(true);
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

    private canTapSlot(index: number): boolean {
        return (
            index >= this.round.slotCapacity &&
            this.round.status === "playing" &&
            !this.overlay &&
            !this.loadingBoard &&
            !this.animatingCards
        );
    }

    private onSlotTouch(index: number): void {
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

    private openOverlay(name: string, dimBackground = true): Node {
        this.closeOverlay();
        const overlay = uiNode(this.node, name, 750, 1334);
        this.overlay = overlay;
        const { width, height } = this.screenSize();
        overlay.getComponent(UITransform)!.setContentSize(width, height);
        overlay.addComponent(BlockInputEvents);
        if (dimBackground) {
            const backdrop = uiNode(overlay, "DialogBackdrop");
            backdrop.addComponent(Graphics);
            this.drawDialogBackdrop(backdrop, width, height);
        }
        return overlay;
    }

    private drawDialogBackdrop(
        node: Node,
        width: number,
        height: number,
    ): void {
        const graphic = node.getComponent(Graphics)!;
        graphic.clear();
        graphic.fillColor = color("#00000080");
        graphic.rect(-width / 2, -height / 2, width, height);
        graphic.fill();
    }

    private closeOverlay(): void {
        this.feedbackButton?.destroy();
        this.feedbackButton = undefined;
        this.feedbackControl = undefined;
        if (!this.overlay) return;
        this.overlay.removeFromParent();
        this.overlay.destroy();
        this.overlay = undefined;
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
        const artwork = showWelcome(
            welcome,
            this.art.screens.welcome,
            this.controls,
            {
                settings: () => this.showSettings(true),
                play: () => {
                    this.welcome = undefined;
                    welcome.destroy();
                    this.gameRoot.active = true;
                    this.audio.startMusic();
                    this.preloadMainBoard();
                },
                home: () => this.showHomeCollection(),
                share: () => this.share(),
                leaderboard: () => this.showLeaderboard(),
            },
        );
        this.fitScreenArtwork(artwork);
        void this.loadWelcomeVersion(welcome);
    }

    private addWelcomeVersion(welcome: Node, version: string): void {
        const caption = label(welcome, `v ${version}`, 21, "#FFFFFF");
        caption.node.name = "ReleaseVersion";
        const transform = caption.node.getComponent(UITransform)!;
        transform.setContentSize(180, 32);
        caption.horizontalAlign = Label.HorizontalAlign.RIGHT;
        caption.overflow = Label.Overflow.SHRINK;
        caption.node.addComponent(UIOpacity).opacity = Math.round(255 * 0.7);
        this.positionWelcomeVersion(caption.node);
    }

    private async loadWelcomeVersion(welcome: Node): Promise<void> {
        let version = this.releaseVersion();
        if (!version && WECHAT && hasCloudEnvironment()) {
            try {
                version = await readReleaseVersion();
            } catch {
                console.warn("FLIP ZOO release version could not be loaded");
            }
        }
        if (this.isValid && this.welcome === welcome) {
            this.addWelcomeVersion(welcome, version ?? "0.0.1");
        }
    }

    private releaseVersion(): string | undefined {
        if (!WECHAT) return undefined;
        try {
            return (
                wx.getAccountInfoSync?.()?.miniProgram?.version?.trim() ||
                undefined
            );
        } catch {
            return undefined;
        }
    }

    private positionWelcomeVersion(node: Node): void {
        const { width, height } = this.screenSize();
        const window = WECHAT ? wx.getWindowInfo?.() : undefined;
        const bottomMargin = window?.windowHeight
            ? (24 * height) / window.windowHeight
            : 24;
        node.setPosition(width / 2 - 24 - 90, -height / 2 + bottomMargin + 18);
    }

    private showHomeCollection(): void {
        const overlay = this.openOverlay("HomeCollection");
        const artwork = dialogArtwork(
            overlay,
            "CollectionArtwork",
            this.art.screens.collection,
            [
                [181, 416, 792, 1290, 60],
                [341, 361, 482, 124, 53],
                [875, 400, 98, 95, 23],
            ],
        );
        this.fitScreenArtwork(artwork);
        artworkButton(artwork, "关闭家园", 922, 446, 98, 98, () =>
            this.showWelcome(),
        );
        const balances = [578, 775, 972, 1167, 1361, 1560].map((y, index) => {
            this.showHomeAnimal(artwork, y, index);
            const cover = uiNode(artwork, "FragmentRow", 470, 135);
            cover.setPosition(110, 1024 - y);
            const background = cover.addComponent(Graphics);
            background.fillColor = color("#FFF2D8");
            background.roundRect(-235, -67, 470, 134, 15);
            background.fill();
            const name = label(cover, FRAGMENT_ANIMALS[index], 43, "#56351C");
            name.isBold = true;
            const value = label(cover, "碎片：—", 38, "#684824");
            for (const [caption, offset] of [
                [name, 31],
                [value, -32],
            ] as const) {
                caption.horizontalAlign = Label.HorizontalAlign.LEFT;
                caption.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
                caption.node.setPosition(-213, offset);
            }
            const button = uiNode(cover, "RedeemUnavailable", 160, 104);
            button.setPosition(140, 0);
            const buttonStyle = button.addComponent(Graphics);
            buttonStyle.fillColor = color("#A39D93");
            buttonStyle.strokeColor = color("#817A70");
            buttonStyle.lineWidth = 3;
            buttonStyle.roundRect(-80, -52, 160, 104, 18);
            buttonStyle.fill();
            buttonStyle.stroke();
            const redeem = label(button, "兑换", 34, "#FFFFFF");
            redeem.isBold = true;
            redeem.node.setPosition(0, 20);
            label(button, "暂未开放", 25, "#FFFFFF").node.setPosition(0, -23);
            return value;
        });
        if (WECHAT && hasCloudEnvironment()) {
            const load = async () => {
                balances.forEach((value) => {
                    value.string = "读取中…";
                });
                try {
                    const amounts = await loadFragmentBalances();
                    if (this.overlay !== overlay) return;
                    balances.forEach((value, index) => {
                        value.string = `碎片：${amounts[index]}`;
                    });
                } catch {
                    if (this.overlay !== overlay) return;
                    balances.forEach((value) => {
                        value.string = "读取失败";
                    });
                    artworkButton(artwork, "重试", 576, 1660, 450, 72, () => {
                        retry.node.destroy();
                        artwork.getChildByName("重试")?.destroy();
                        void load();
                    });
                    const retry = label(artwork, "点击重试", 30, "#684824");
                    retry.node.setPosition(0, -636);
                }
            };
            void load();
        }
    }

    private showHomeAnimal(artwork: Node, y: number, animal: number): void {
        const portrait = uiNode(artwork, "HomeAnimal", 210, 188);
        portrait.setPosition(-238, 1024 - y);
        const background = portrait.addComponent(Graphics);
        background.fillColor = color("#FFF2D8");
        const top = [86, 100, 89, 91, 88, 92][animal];
        background.rect(-100, -91, 202, 91 + top);
        background.fill();
        // Restore the part of the card border covered along with the baked-in portrait.
        const [cardTop, cardBottom] = [
            [492, 664],
            [685, 856],
            [879, 1050],
            [1072, 1244],
            [1274, 1447],
            [1477, 1649],
        ][animal];
        const topEdge = y - cardTop;
        const bottomEdge = y - cardBottom;
        background.strokeColor = color("#E1CAA0");
        background.lineWidth = 4;
        background.moveTo(105, topEdge);
        background.lineTo(-82, topEdge);
        background.quadraticCurveTo(-113, topEdge, -113, topEdge - 30);
        background.lineTo(-113, bottomEdge + 30);
        background.quadraticCurveTo(-113, bottomEdge, -82, bottomEdge);
        background.lineTo(105, bottomEdge);
        background.stroke();

        const inset = 6;
        const viewport = uiNode(
            portrait,
            "PortraitViewport",
            194,
            topEdge - bottomEdge - 2 * inset,
        );
        const viewportCenter = (topEdge + bottomEdge) / 2;
        viewport.setPosition(0, viewportCenter);
        viewport.addComponent(Mask);

        const [rest, ...poses] = this.art.screens.homeAnimals[animal];
        const { width, height } = rest.originalSize;
        const sprite = picture(viewport, "Portrait", rest, width, height);
        sprite.node.setPosition(0, -viewportCenter);

        const animate = (delay = 0) => {
            Tween.stopAllByTarget(sprite.node);
            sprite.spriteFrame = rest;
            const playback = tween(sprite.node).delay(delay);
            for (const pose of poses) {
                playback
                    .call(() => {
                        sprite.spriteFrame = pose;
                    })
                    .delay(0.09);
            }
            playback
                .call(() => {
                    sprite.spriteFrame = rest;
                })
                .start();
        };
        shadedButton(viewport, () => animate());
        animate(animal * 0.1);
    }

    private async finishFragments(
        id: string,
        actions: readonly RoundAction[],
    ): Promise<void> {
        const overlay = this.openOverlay("FragmentReward");
        const waiting = titleLine(
            overlay,
            "正在结算碎片…",
            0,
            34,
            "#FFF3CC",
            "#684824",
        );
        let expired: () => void = () => {};
        const deadline = new Promise<never>((_, reject) => {
            expired = () => reject(new Error("Fragment settlement timed out"));
            this.scheduleOnce(expired, 6);
        });
        let feedback = "碎片结算未完成，打开家园可重试";
        try {
            const result = await Promise.race([
                settleFragmentRound(id, actions),
                deadline,
            ]);
            if (this.overlay !== overlay) return;
            if (
                result.status === "granted" &&
                FRAGMENT_ANIMALS[result.animal]
            ) {
                waiting.node.destroy();
                this.playFragmentReward(overlay, result.animal);
                return;
            }
            feedback =
                result.status === "limit"
                    ? "今日碎片已达上限"
                    : "本局碎片校验未通过";
        } catch {
            // The pending settlement is retried when the player opens Home.
        } finally {
            this.unschedule(expired);
        }
        if (this.overlay === overlay) this.showResult(true, feedback);
    }

    private playFragmentReward(overlay: Node, animal: number): void {
        const reward = uiNode(overlay, "Reward");
        const badge = uiNode(reward, "FragmentBadge");
        const [frame] = this.art.screens.homeAnimals[animal];
        const chip = badge.addComponent(Graphics);
        chip.fillColor = color("#FFD46D");
        chip.strokeColor = color("#9D5A22");
        chip.lineWidth = 6;
        chip.roundRect(-119, -102, 238, 204, 34);
        chip.fill();
        chip.stroke();
        const { width, height } = frame.originalSize;
        const fit = 1.25;
        picture(badge, "AnimalPortrait", frame, width * fit, height * fit);
        titleLine(badge, "+1", -117, 64, "#FFF1A8", "#89521D");
        this.celebrate(reward, badge, false);

        const home = uiNode(overlay, "HomeRewardTarget");
        home.setPosition(-211, -465);
        const target = home.addComponent(Graphics);
        target.fillColor = color("#FFE8AC");
        target.roundRect(-51, -51, 102, 102, 24);
        target.fill();
        drawButtonIcon(home, "home", 0, 0, 62, "#805025");

        tween(reward)
            .delay(0.68)
            .to(
                0.42,
                {
                    position: home.position.clone(),
                    scale: new Vec3(0.22, 0.22, 1),
                },
                { easing: "quadIn" },
            )
            .call(() => {
                if (this.overlay === overlay) this.showResult(true);
            })
            .start();
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
        this.scheduleOnce(this.advanceToMainBoard, 0.55);
    }

    private showResult(won: boolean, feedback?: string): void {
        const result = this.openOverlay("RoundResult");
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
            178,
            -145,
            216,
            () =>
                this.showLeaderboard(false, () =>
                    this.showResult(won, feedback),
                ),
            summary,
            54,
        );
        viewAll.graphic.clear();
        viewAll.caption.fontSize = 23;
        viewAll.caption.color = color("#56351C");
        viewAll.caption.node.getComponent(LabelOutline)!.width = 0;

        if (!won || feedback) {
            label(
                result,
                feedback ?? "卡槽已满",
                26,
                "#56351C",
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
        const y = canRevive ? -470 : won ? -505 : -424;
        const home = this.button(
            "首页",
            -224,
            y,
            138,
            () => this.returnHome(),
            result,
            100,
        );
        this.paintButton(home, false, true, "cream");
        home.caption.node.active = false;
        drawButtonIcon(home.graphic.node, "home", 0, 0, 49, "#805025");
        if (WECHAT && !won) {
            const share = this.button(
                "分享",
                0,
                y,
                138,
                () => this.share(),
                result,
                100,
            );
            this.paintButton(share, false, true, "cream");
            share.caption.node.active = false;
            drawButtonIcon(share.graphic.node, "share", 0, 0, 46, "#805025");
        }
        const retry = this.button(
            won ? "再次挑战" : "继续挑战",
            won ? 176 : 213,
            y,
            won ? 263 : 164,
            () => {
                this.closeOverlay();
                this.restartRound();
            },
            result,
            100,
        );
        this.paintButton(retry, false, true, won ? "cream" : "green");
        retry.caption.fontSize = 26;
        retry.caption.node.setPosition(won ? 25 : 0, won ? 0 : -17);
        drawButtonIcon(
            retry.graphic.node,
            "retry",
            won ? -84 : 0,
            won ? 0 : 15,
            won ? 42 : 30,
            won ? "#805025" : "#FFFFFF",
        );
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
            button?.onTap?.(() => this.audio.playButtonPress());
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
        const height = preview ? 226 : 1064;
        const width = preview
            ? 550
            : parent.getComponent(UITransform)!.width - 42;
        const list = uiNode(parent, "WeeklyLeaderboard", width, height);
        list.setPosition(0, preview ? 12 : -13);
        if (WECHAT && wx.getOpenDataContext?.()) {
            list.active = false;
            const subContext = list.addComponent(SubContextView);
            subContext.designResolutionSize.set(width, height);
            subContext.fps = 12;
            list.active = true;
            if (!preview) {
                const rowDragDistance = Math.round(height * 0.105);
                let distance = 0;
                list.on(Node.EventType.TOUCH_START, () => {
                    distance = 0;
                });
                list.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
                    distance += event.getUIDelta().y;
                    const rows = Math.trunc(distance / rowDragDistance);
                    if (!rows) return;
                    distance -= rows * rowDragDistance;
                    this.postRankMessage("scroll-week", rows);
                });
            }
            const refresh = this.button(
                "刷新",
                preview ? -230 : 233,
                preview ? -145 : -586,
                98,
                () =>
                    this.postRankMessage(
                        preview ? "show-preview" : "show-week",
                    ),
                parent,
                48,
            );
            refresh.graphic.clear();
            refresh.caption.fontSize = 23;
            refresh.caption.color = color("#56351C");
            refresh.caption.node.getComponent(LabelOutline)!.width = 0;
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
        const card = this.panel(
            overlay,
            "LeaderboardCard",
            0,
            682,
            1312,
            "#FFF1D4",
            "#8F552B",
        );
        this.heading(card, "好友排行榜", 654, "#A66532", "#63381D", "small");
        this.fitLeaderboardCard(card);
        const week = this.button(
            "本周榜",
            -117,
            569,
            226,
            () => this.showLeaderboard(false, back),
            card,
            58,
        );
        const previous = this.button(
            "历史榜",
            117,
            569,
            226,
            () => this.showLeaderboard(true, back),
            card,
            58,
        );
        this.paintButton(week, !history, true, "cream");
        this.paintButton(previous, false, false, "cream");
        if (history) label(card, "历史榜暂未开放", 32, "#56351C");
        else this.showWeekRanking(card);
        const close = this.button("◀ 返回", 0, -586, 244, back, card, 72);
        this.paintButton(close, true);
    }

    private fitLeaderboardCard(card: Node): void {
        const bounds = card.getComponent(UITransform)!;
        const heading = card.getChildByName("Heading")!;
        const headingTop =
            heading.position.y + heading.getComponent(UITransform)!.height / 2;
        const scale = leaderboardScale(
            this.screenSize(),
            bounds.width,
            headingTop,
        );
        card.setScale(scale, scale, 1);
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
        const [fill, border, height] = (
            {
                undo: ["#66BFF6", "#307FBF", 510],
                peek: ["#FFC84F", "#B57122", 475],
                remove: ["#F0AB54", "#648C47", 680],
            } as const
        )[prop];
        const card = this.panel(
            dialog,
            "PropClaimCard",
            prop === "remove" ? -55 : -18,
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
            -133,
            -height / 2 + 61,
            232,
            () => {
                if (
                    this.overlay !== dialog ||
                    this.round !== round ||
                    !round.canClaimProp(prop)
                )
                    return;
                if ((WECHAT && !this.share()) || !round.claimProp(prop)) return;
                this.fragmentRound?.actions.push("claim:" + prop);
                this.closeOverlay();
                this.message.string = "已获得" + PROP_LABELS[prop] + "道具";
                this.refresh();
            },
            card,
            84,
        );
        this.paintButton(share, false, true, "green");
        share.caption.node.setPosition(22, 0);
        drawButtonIcon(
            share.graphic.node,
            "share",
            WECHAT ? -52 : -76,
            0,
            30,
            "#FFFFFF",
        );
        this.button(
            "×  关闭",
            133,
            -height / 2 + 61,
            232,
            () => this.closeOverlay(),
            card,
            84,
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
            this.fragmentRound?.actions.push(prop);
            this.animatingCards = true;
            this.message.string = "正在补齐槽内同款…";
            this.playSlotClear(groups, 0);
        } else {
            if (!this.round.use(prop)) {
                this.message.string = PROP_UNAVAILABLE[prop];
                return;
            }
            this.fragmentRound?.actions.push(prop);
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

    private refreshBoard(): void {
        const { round } = this;
        const onBoard = round.cards.filter((card) => round.isOnBoard(card));
        for (const card of round.cards) {
            const view = this.cards[card.id];
            if (!round.isOnBoard(card)) {
                view.node.active = false;
                continue;
            }
            const exposure = round.exposure(card);
            const kind = round.isFaceUp(card, exposure) ? card.kind : null;
            const upperCards =
                exposure !== FULL_EXPOSURE
                    ? onBoard
                          .filter((upper) => covers(upper, card))
                          .map((upper) => this.cards[upper.id])
                    : [];
            view.show(kind, exposure, round.isSelectable(exposure), upperCards);
        }
    }

    private refresh(): void {
        const { round } = this;
        this.refreshBoard();
        this.refreshSlots(round.slots.map((card) => card.kind));
        for (const [prop, { button, count }] of this.propButtons) {
            button.node.active = round.level === 2;
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

    private fitScreenArtwork(artwork: Node | null | undefined): void {
        if (!artwork) return;
        const { width, height } = this.screenSize();
        const size = artwork.getComponent(UITransform)!.contentSize;
        const scale = Math.max(width / size.width, height / size.height);
        artwork.setScale(scale, scale);
    }

    private resizeLayout(): void {
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
            if (root === this.overlay) {
                root.getComponent(UITransform)!.setContentSize(width, height);
                const backdrop = root.getChildByName("DialogBackdrop");
                if (backdrop) this.drawDialogBackdrop(backdrop, width, height);
            }
        }
        this.fitScreenArtwork(this.welcome?.getChildByName("WelcomeArtwork"));
        const version = this.welcome?.getChildByName("ReleaseVersion");
        if (version) this.positionWelcomeVersion(version);
        const leaderboard = this.overlay?.getChildByName("LeaderboardCard");
        if (leaderboard) this.fitLeaderboardCard(leaderboard);
        this.fitScreenArtwork(this.overlay?.getChildByName("SettingsArtwork"));
        this.fitScreenArtwork(
            this.overlay?.getChildByName("CollectionArtwork"),
        );
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
        if (!tutorial) this.matchSlotSizeToBoard();
    }

    private matchSlotSizeToBoard(): void {
        const board = this.board!;
        for (const slot of this.slots) {
            slot.setHeight(board.tileHeight);
            slot.node.setScale(board.node.scale);
        }
        if (!this.animatingCards) {
            this.refreshSlots(this.round.slots.map((card) => card.kind));
        }
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
        }
        this.refreshBoard();
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
        const visual = uiNode(node, "ButtonVisual");
        const press = node.addComponent(ButtonPress);
        press.action = action;
        press.showPressed = scaleButton(visual, width < 110 ? 0.97 : 0.94);
        const button = {
            node,
            graphic: visual.addComponent(Graphics),
            caption: label(visual, text, height >= 80 && !frame ? 35 : 26),
            width,
            height,
            icon:
                typeof frame === "string"
                    ? this.drawPropIcon(visual, frame)
                    : frame
                      ? picture(visual, "PropIcon", frame, 86)
                      : undefined,
        };
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
        cornerRadius?: number,
    ): void {
        const { node, graphic, caption, width, height, icon } = button;
        const press = node.getComponent(ButtonPress)!;
        press.enabled = enabled;
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
        const radius =
            cornerRadius ??
            (!caption.node.active
                ? 29
                : height >= 80 && width >= 300
                  ? 37
                  : 18);
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
