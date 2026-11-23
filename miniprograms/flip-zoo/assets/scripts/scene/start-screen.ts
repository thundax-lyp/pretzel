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
    Mask,
    Sprite,
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
import {
    showLeaderboardCard,
    fitLeaderboardCard,
} from "../ui/leaderboard-view";
import { fitResultCard, showResultCard } from "../ui/result-view";
import * as wechat from "../services/wechat-platform";
import { callCloud } from "../services/cloud-health";
import { syncLifetimeRank } from "../services/leaderboard";
import {
    supportsStoreGift,
    openStoreGift,
    giftMessage,
    giftEnabled,
    giftDiagnostic,
    type GiftPlatform,
    type GiftResult,
} from "../services/store-gift";

declare const wx: GiftPlatform;
import { ButtonPress, scaleButton } from "../ui/button-press";
import { showPrivacyDocument } from "../settings/privacy-view";
import { drawButtonIcon } from "../ui/button-icon";
import { WECHAT } from "cc/env";
import {
    loadLoadingArtwork,
    loadZooArtwork,
    type ZooArtwork,
} from "../services/artwork";
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
    liftBoardCards,
    MATCH_DURATION,
    playMatch,
    slideSlotCard,
} from "../gameplay/card-effects";
import { CardView } from "../gameplay/card-view";
import {
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
    insertSlotCards,
    C_OPENING_CARD_COUNT,
    SHARE_SLOT_ACTION,
    REVIVE_ACTION,
    GROUPS,
    PROPS,
    covers,
    Round,
    type Binding,
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
    C: `C  预亮 ${C_OPENING_CARD_COUNT} 张`,
};

const WECHAT_MAIN_BOARD_SCALE = 1.07;
const TABLE = {
    1: { width: 134, height: 169, y: 124 },
    2: WECHAT
        ? {
              width: 94 / WECHAT_MAIN_BOARD_SCALE,
              height: 98 / WECHAT_MAIN_BOARD_SCALE,
              y: -17,
          }
        : { width: 88, height: 92, y: -17 },
} as const;
const WECHAT_MAIN_BOARD_TOP_EXTENSION = 88;
const WECHAT_MAIN_BOARD_BOTTOM_EXTENSION = 72;

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
    private readonly rankedRounds = new WeakSet<Round>();
    private board?: {
        node: Node;
        left: number;
        top: number;
        tileHeight: number;
        touchArea?: UITransform;
    };
    private matchLayer?: Node;
    private animatingCards = false;
    private boardPress?: {
        touchId: number;
        card: Card;
        tiles: { card: Card; lifted: CardView }[];
    };
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
    private boardDrawOrder: readonly Card[] = [];
    private readonly slots: CardView[] = [];
    private readonly groupButtons = new Map<Group, Control>();
    private readonly propButtons = new Map<
        Prop,
        { button: Control; count: Label }
    >();
    private overlay?: Node;
    private cancelRevivalShare?: () => void;
    private welcome?: Node;
    private feedbackControl?: Node;
    private feedbackButton?: { destroy(): void };
    private readonly shareFromMenu = () =>
        wechat.trackedShareCard(
            this.overlay?.name === "RoundResult" &&
                this.round?.status === "won",
        );
    private shareTrackingStarted = false;
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
        if (WECHAT && !this.shareTrackingStarted) {
            this.shareTrackingStarted = true;
            wechat.enableShareMenu(this.shareFromMenu);
            if (hasCloudEnvironment())
                void syncLifetimeRank().catch(() => {
                    console.warn("Lifetime leaderboard sync pending");
                });
        }
        this.fitViewport();
        const loading = label(this.node, "正在打开动物园…", 34);
        const loadingRoot = uiNode(this.node, "LoadingScreen", 750, 1334);
        try {
            const art = await loadLoadingArtwork();
            if (!this.isValid) return;
            const { width, height } = this.screenSize();
            const garden = picture(
                loadingRoot,
                "LoadingGarden",
                art.background,
                width,
                height,
            );
            const scale = Math.max(width / 1152, height / 2048);
            garden
                .getComponent(UITransform)!
                .setContentSize(1152 * scale, 2048 * scale);
            // Age badge reference: 1179 × 2556, keeping its black frame and transparent corners.
            const badgeWidth = width * (189 / 1179);
            const badgeHeight = badgeWidth * (242 / 189);
            const badge = picture(
                loadingRoot,
                "LoadingAgeRating",
                art.ageRating,
                badgeWidth,
                badgeHeight,
            );
            badge.node.setPosition(
                -width / 2 + width * (39 / 1179) + badgeWidth / 2,
                height / 2 - height * (35 / 2556) - badgeHeight / 2,
            );
            // Reference screenshot: 1152 × 2048, coordinates measured from its top.
            const referenceScale = Math.min(width / 1152, height / 2048);
            for (const [text, y, size] of [
                ["健康游戏忠告", 1694, 36],
                [
                    "抵制不良游戏，拒绝盗版游戏 ，注意自我保护，谨防受骗上当。",
                    1740,
                    31,
                ],
                [
                    "适度游戏益脑，沉迷游戏伤身 ，合理安排时间，享受健康生活。",
                    1782,
                    31,
                ],
                ["本公司积极履行《网络游戏行业防沉迷自律公约》", 1825, 31],
                ["上海四象无忧数字娱乐科技有限公司", 1910, 31],
            ] as const) {
                const caption = label(loadingRoot, text, size * referenceScale);
                caption.isBold = true;
                caption.node.setPosition(0, height * (0.5 - y / 2048));
                const outline = caption.node.addComponent(LabelOutline);
                outline.color = color("#258C52");
                outline.width = 4 * referenceScale;
            }
            const bar = uiNode(
                loadingRoot,
                "LoadingProgress",
                760 * referenceScale,
                68 * referenceScale,
            );
            bar.setPosition(0, height * (0.5 - 1587 / 2048));
            const graphic = bar.addComponent(Graphics);
            const drawProgress = (progress: number) => {
                if (!bar.isValid || loading.node.active) return;
                const width = 760 * referenceScale;
                const height = 68 * referenceScale;
                const inset = 12 * referenceScale;
                graphic.clear();
                graphic.lineWidth = 5 * referenceScale;
                graphic.strokeColor = color("#71472B");
                graphic.fillColor = color("#FFFFFF");
                graphic.roundRect(
                    -width / 2,
                    -height / 2,
                    width,
                    height,
                    height / 2,
                );
                graphic.fill();
                graphic.stroke();
                graphic.fillColor = color("#25774F");
                graphic.roundRect(
                    -width / 2 + inset,
                    -height / 2 + inset,
                    width - 2 * inset,
                    height - 2 * inset,
                    (height - 2 * inset) / 2,
                );
                graphic.fill();
                const filled = (width - 2 * inset) * progress;
                if (filled > 0) {
                    graphic.fillColor = color("#B8F33D");
                    graphic.roundRect(
                        -width / 2 + inset,
                        -height / 2 + inset,
                        filled,
                        height - 2 * inset,
                        Math.min(filled / 2, (height - 2 * inset) / 2),
                    );
                    graphic.fill();
                }
            };
            loading.node.active = false;
            drawProgress(0);
            loading.node.setPosition(0, height * (0.5 - 1587 / 2048));
            // Paint the main-package loading screen before starting subpackage work.
            await new Promise<void>((resolve) => this.scheduleOnce(resolve, 0));
            this.art = await loadZooArtwork(drawProgress);
        } catch (error) {
            if (!this.isValid) return;
            console.error(error);
            const bar = loadingRoot.getChildByName("LoadingProgress");
            if (bar) bar.active = false;
            loading.node.active = true;
            loading.node.setSiblingIndex(this.node.children.length - 1);
            loading.string = "图片加载失败";
            const retry = this.button(
                "重新加载",
                0,
                -92,
                250,
                () => {
                    loading.node.destroy();
                    loadingRoot.destroy();
                    retry.node.destroy();
                    void this.start();
                },
                this.node,
            );
            return;
        }
        if (!this.isValid) return;
        loading.node.destroy();
        loadingRoot.destroy();
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
        }
        this.resizeLayout();
        view.on("canvas-resize", this.resizeLayout, this);
    }

    onDestroy(): void {
        this.cancelRevivalShare?.();
        this.feedbackButton?.destroy();
        wechat.disableShareMenu(this.shareFromMenu);
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
            const count = this.addButtonBadge(
                button,
                propWidth / 2 - 6,
                WECHAT ? 52 : 44,
            );
            this.propButtons.set(prop, { button, count });
        });
        this.openRound(1, "C");
    }

    private addButtonBadge(button: Control, x: number, y: number): Label {
        const badge = uiNode(button.graphic.node, "RemainingUses");
        badge.setPosition(x, y);
        const circle = badge.addComponent(Graphics);
        circle.fillColor = color("#EC7847");
        circle.strokeColor = color("#A7432D");
        circle.lineWidth = 2;
        circle.circle(0, 0, 17);
        circle.fill();
        circle.stroke();
        const count = label(badge, "", 19, "#FFFFFF");
        count.isBold = true;
        return count;
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
                0,
            );
            const extra = index >= initialCapacity;
            const column = index - (slotLimit - 1) / 2;
            const offset =
                WECHAT || initialCapacity === slotLimit ? 0 : extra ? 10 : -6;
            slot.node.setPosition(column * slotPitch + offset, 0);
            if (extra) {
                const unlock = () => this.onSlotTouch(index);
                if (WECHAT) {
                    const button = this.button(
                        "解锁",
                        0,
                        0,
                        width,
                        unlock,
                        slot.node,
                        width,
                    );
                    button.node.name = "ShareUnlockButton";
                    button.caption.node.active = false;
                    drawButtonIcon(
                        button.graphic.node,
                        "share",
                        0,
                        0,
                        40,
                        "#FFFFFF",
                    );
                    this.paintButton(button, false, true, "blue", 22);
                    this.addButtonBadge(
                        button,
                        width / 2 - 6,
                        width / 2 - 4,
                    ).string = "+";
                    const press = button.node.getComponent(ButtonPress)!;
                    press.available = () => this.canTapSlot(index);
                } else {
                    this.addAdBadge(slot.node, width, height);
                    shadedButton(slot.node, unlock).available = () =>
                        this.canTapSlot(index);
                }
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
            this.audio,
            this.art.home.settings,
        );
        this.feedbackControl = this.settingsView.show(dialog, {
            version: wechat.releaseVersion(),
            contact: () => {
                const opened = wechat.openCustomerService(() =>
                    this.platformNotice("暂时无法打开客服"),
                );
                if (!opened) this.platformNotice("请在微信小游戏内联系客服");
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
        const dialog = this.openOverlay("ChildPrivacy", false);
        const { width, height } = this.screenSize();
        const window = wechat.windowInfo();
        const ratio =
            height /
            (window?.windowHeight ??
                screen.windowSize.height / screen.devicePixelRatio);
        const topInset = (window?.safeArea?.top ?? 24) * ratio;
        const bottomInset = window?.safeArea
            ? Math.max(0, window.windowHeight - window.safeArea.bottom) * ratio
            : 24;
        const page = uiNode(dialog, "PrivacyPage", width, height);
        showPrivacyDocument(
            page,
            { width, height, topInset, bottomInset, pixelScale: ratio },
            () => {
                this.closeOverlay();
                this.showSettings(fromWelcome);
            },
        );
    }

    private confirmAbandon(): void {
        const dialog = this.openOverlay("ConfirmAbandon");
        this.settingsView.confirmAbandon(
            dialog,
            () => this.closeOverlay(),
            () => this.returnHome(),
        );
        this.fitScreenArtwork(dialog.getChildByName("SettingsArtwork"));
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
                deal.bindings,
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
        bindings?: readonly Binding[],
    ): void {
        this.cancelBoardPress();
        this.animatingCards = false;
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
            bindings,
            WECHAT && level === 2,
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
        const layerNumbers = Array.from(
            new Set(this.round.cards.map((card) => card.layer)),
        ).sort((a, b) => a - b);
        const layers = new Map(
            layerNumbers.map((layer) => [
                layer,
                uiNode(board, `Layer-${layer}`),
            ]),
        );
        this.boardDrawOrder =
            level === 2
                ? [...this.round.cards].sort(
                      (a, b) =>
                          a.layer - b.layer || a.top - b.top || a.left - b.left,
                  )
                : this.round.cards;
        this.cards = [];
        for (const card of this.boardDrawOrder) {
            const view = new CardView(
                layers.get(card.layer)!,
                `Card-${card.id}`,
                table.width,
                table.height,
                this.art,
                card.layer,
            );
            view.node.setPosition(
                (card.left - left + 0.5) * table.width - width / 2,
                height / 2 - (card.top - top + 0.5) * table.height,
            );
            this.cards[card.id] = view;
        }
        let touchTarget = board;
        if (level === 2) {
            const touchArea = uiNode(board, "BoardTouch");
            this.board.touchArea = touchArea.getComponent(UITransform)!;
            this.updateBoardProjection();
            touchTarget = touchArea;
        }
        touchTarget.on(
            Node.EventType.TOUCH_START,
            this.onBoardPressStart,
            this,
        );
        touchTarget.on(Node.EventType.TOUCH_MOVE, this.onBoardPressMove, this);
        touchTarget.on(Node.EventType.TOUCH_END, this.onBoardPressEnd, this);
        touchTarget.on(
            Node.EventType.TOUCH_CANCEL,
            this.cancelBoardPress,
            this,
        );
        this.createSlotTray();
        if (level === 2 && !WECHAT) this.matchSlotScaleToBoard();
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

    private onBoardPressStart(event: EventTouch): void {
        const touchId = event.getID();
        if (
            touchId === null ||
            !this.board ||
            this.boardPress ||
            this.overlay ||
            this.loadingBoard ||
            this.animatingCards
        )
            return;
        const local = this.boardTouchPoint(event);
        const { node, left, top, tileHeight } = this.board;
        const transform = node.getComponent(UITransform)!;
        const card =
            this.round.level === 2
                ? this.drawnCardAt(local.x, local.y)
                : this.round.cardAt(
                      left + (local.x + transform.width / 2) / TABLE[1].width,
                      top + (transform.height / 2 - local.y) / tileHeight,
                  );
        if (!card) return;
        const partner = this.round.boundPartner(card.id);
        if (!this.round.canTake(card.id)) {
            if (this.round.status === "playing") {
                this.message.string = partner
                    ? this.round.slotCapacity - this.round.slots.length < 2
                        ? "需要两个空槽才能取走绑定牌"
                        : "两张牌都露出后才能取走"
                    : "这张牌还被压着，先移开上层牌";
            }
            return;
        }

        const taken = partner ? [card, partner] : [card];
        const previews = liftBoardCards(
            this.matchLayer!,
            this.art,
            taken.map((tile) => ({
                source: this.cards[tile.id].node,
                kind: this.round.isFaceUp(tile) ? tile.kind : null,
            })),
            !!partner,
        );
        const tiles = taken.map((tile, index) => ({
            card: tile,
            lifted: previews[index],
        }));
        if (partner && (partner.top < card.top || partner.left < card.left)) {
            previews[0].node.setSiblingIndex(
                this.matchLayer!.children.length - 1,
            );
        }
        this.boardPress = { touchId, card, tiles };
        if (partner) this.refreshBindingMarker();
    }

    private onBoardPressMove(event: EventTouch): void {
        const press = this.boardPress;
        if (!press || event.getID() !== press.touchId) return;
        const { x, y } = this.boardTouchPoint(event);
        if (!this.cards[press.card.id].containsBoardPoint(x, y)) {
            this.cancelBoardPress();
        }
    }

    private onBoardPressEnd(event: EventTouch): void {
        this.onBoardPressMove(event);
        const press = this.boardPress;
        if (!press || event.getID() !== press.touchId) return;
        if (this.overlay || this.loadingBoard || this.animatingCards) {
            this.cancelBoardPress();
            return;
        }
        this.takeBoardPress(press.card, press.tiles);
    }

    private cancelBoardPress(event?: EventTouch): void {
        const press = this.boardPress;
        if (!press || (event && event.getID() !== press.touchId)) return;
        this.boardPress = undefined;
        for (const { card, lifted } of press.tiles) {
            lifted.node.active = false;
            lifted.node.destroy();
            this.cards[card.id].node.active = this.round.isOnBoard(card);
        }
        if (press.tiles.length > 1) this.refreshBindingMarker();
    }

    private boardTouchPoint(event: EventTouch): Vec3 {
        const point = event.getUILocation();
        return this.board!.node.getComponent(UITransform)!.convertToNodeSpaceAR(
            new Vec3(point.x, point.y),
        );
    }

    private takeBoardPress(
        card: Card,
        taken: readonly { card: Card; lifted: CardView }[],
    ): void {
        const previousCards = [...this.round.slots];
        const arranged = insertSlotCards(
            previousCards,
            taken.map(({ card: tile }) => tile),
        );
        const matched = this.round.take(card.id);
        if (matched === null) {
            this.cancelBoardPress();
            return;
        }

        this.fragmentRound?.actions.push(card.id);
        if (this.round.level === 1) this.preloadMainBoard();
        this.animatingCards = true;
        for (const [index, tile] of previousCards.entries()) {
            const target = arranged.findIndex((card) => card.id === tile.id);
            if (target !== index)
                slideSlotCard(
                    this.slotTray!,
                    this.art,
                    this.slots[index].node,
                    this.slots[target].node,
                    tile.kind,
                );
        }
        this.refreshSlots(
            arranged.map((tile, index) =>
                previousCards[index]?.id === tile.id ? tile.kind : undefined,
            ),
        );
        let remainingFlights = taken.length;
        const onLanded = () => {
            remainingFlights -= 1;
            if (remainingFlights > 0) return;
            this.animatingCards = false;
            if (matched) {
                for (const kind of new Set(
                    taken.map(({ card: tile }) => tile.kind),
                )) {
                    const indices = arranged.flatMap((tile, index) =>
                        tile.kind === kind ? [index] : [],
                    );
                    if (indices.length >= 3)
                        this.playMatch(kind, indices.slice(0, 3));
                }
            }
            this.message.string =
                WECHAT && this.round.level === 2
                    ? ""
                    : matched
                      ? "三张同款，已消除！"
                      : "找三张同款";
            this.finishAction(matched > 0);
        };
        this.boardPress = undefined;
        taken.forEach(({ card: tile, lifted }) =>
            this.flyCardToSlot(
                tile,
                arranged.findIndex((card) => card.id === tile.id),
                onLanded,
                lifted,
            ),
        );
        this.refreshBoard();
    }

    private drawnCardAt(x: number, y: number): Card | undefined {
        const { round } = this;
        for (
            let index = this.boardDrawOrder.length - 1;
            index >= 0;
            index -= 1
        ) {
            const card = this.boardDrawOrder[index];
            if (
                round.isOnBoard(card) &&
                this.cards[card.id].containsBoardPoint(x, y)
            ) {
                return card;
            }
        }
        return undefined;
    }

    private flyCardToSlot(
        card: Card,
        slotIndex: number,
        onLanded: (stacked?: CardView) => void,
        lifted?: CardView,
        stackLevel = 0,
    ): void {
        flyCardToSlot(
            this.matchLayer!,
            this.art,
            this.cards[card.id].node,
            this.slots[slotIndex].node,
            card.kind,
            onLanded,
            lifted,
            stackLevel,
        );
    }

    private playMatch(
        kind: number,
        indices: readonly number[],
        stacked: readonly CardView[] = [],
    ): void {
        this.audio.playMatch();
        playMatch(
            this.matchLayer!,
            this.slotTray!,
            this.slots,
            this.art,
            kind,
            indices,
            stacked,
        );
    }

    private finishAction(matched: boolean): void {
        this.message.color = color("#F4FFE5");
        if (this.round.status === "lost") {
            this.message.string =
                this.round.slots.length === this.round.slotCapacity
                    ? `第 ${this.round.slotCapacity} 格已满 · 本局结束`
                    : "只剩一个空槽，无法取走绑定牌";
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
                if (!this.rankedRounds.has(this.round)) {
                    this.rankedRounds.add(this.round);
                    wechat.postRankMessage("record-win");
                }
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
        if (!this.canTapSlot(index)) return;
        if (!WECHAT && index > this.round.slotCapacity) {
            this.message.string = `请先解锁第 ${this.round.slotCapacity + 1} 格`;
            return;
        }
        if ((WECHAT && !this.share()) || !this.round.unlockNextSlot()) return;
        this.fragmentRound?.actions.push(SHARE_SLOT_ACTION);
        this.refresh();
    }

    private openOverlay(name: string, dimBackground = true): Node {
        this.cancelBoardPress();
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
        this.cancelRevivalShare?.();
        this.cancelRevivalShare = undefined;
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
            this.art.home.background,
            this.art.home.buttons,
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
        let version = wechat.releaseVersion();
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

    private positionWelcomeVersion(node: Node): void {
        const { width, height } = this.screenSize();
        const window = wechat.windowInfo();
        const bottomMargin = window?.windowHeight
            ? (24 * height) / window.windowHeight
            : 24;
        node.setPosition(width / 2 - 24 - 90, -height / 2 + bottomMargin + 18);
    }

    private showHomeCollection(): void {
        const overlay = this.openOverlay("HomeCollection");
        let redeemBusy = false;
        const giftButtons: {
            detail: Label;
            setEnabled(value: boolean): void;
        }[] = [];
        const artwork = uiNode(overlay, "CollectionArtwork", 1152, 2048);
        this.panel(
            artwork,
            "CollectionPanel",
            -37,
            792,
            1290,
            "#FFF2D8",
            "#A9905D",
        );
        this.heading(artwork, "我的家园", 602, "#E6AC43", "#8F552B", "ribbon");
        this.fitScreenArtwork(artwork);
        const close = this.button(
            "×",
            346,
            578,
            98,
            () => this.showWelcome(),
            artwork,
            98,
        );
        this.paintButton(close, false, true, "cream");
        const balances = [578, 775, 972, 1167, 1361, 1560].map((y, index) => {
            this.panel(
                artwork,
                `AnimalRow${index}`,
                1024 - y,
                730,
                174,
                "#FFF2D8",
                "#E1CAA0",
            );
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
            const available = WECHAT;
            let enabled = false;
            const button = uiNode(
                cover,
                available ? `RedeemAnimal${index}` : "RedeemUnavailable",
                160,
                104,
            );
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
            const detail = label(
                button,
                available ? "读取中…" : "暂未开放",
                25,
                "#FFFFFF",
            );
            detail.node.setPosition(0, -23);
            if (available) {
                const press = button.addComponent(ButtonPress);
                press.available = () => enabled && !redeemBusy;
                press.showPressed = scaleButton(button, 0.94);
                giftButtons[index] = {
                    detail,
                    setEnabled(value) {
                        enabled = value;
                        press.enabled = value;
                        buttonStyle.clear();
                        buttonStyle.fillColor = color(
                            value ? "#69A74E" : "#A39D93",
                        );
                        buttonStyle.roundRect(-80, -52, 160, 104, 18);
                        buttonStyle.fill();
                        buttonStyle.stroke();
                    },
                };
                press.action = () => {
                    if (redeemBusy || !enabled) return;
                    if (!hasCloudEnvironment()) {
                        this.platformNotice("兑换服务尚未配置");
                        return;
                    }
                    if (!supportsStoreGift(wx)) {
                        this.platformNotice("请在微信8.0.60及以上手机版中兑换");
                        return;
                    }
                    redeemBusy = true;
                    detail.string = "处理中…";
                    void (async () => {
                        let stage = "redeem-gift";
                        let status = "unknown";
                        try {
                            const result = await callCloud<GiftResult>(
                                "flipZooFragments",
                                { action: "redeem-gift", animal: index },
                            );
                            if (this.overlay !== overlay) return;
                            status = result.status;
                            if (result.status === "ready") {
                                await openStoreGift(wx, result, (value) => {
                                    stage = value;
                                });
                            } else {
                                wechat.showGiftDiagnostic(
                                    giftDiagnostic(
                                        stage,
                                        status,
                                        new Error(giftMessage(result)),
                                    ),
                                );
                            }
                        } catch (error) {
                            if (this.overlay === overlay)
                                wechat.showGiftDiagnostic(
                                    giftDiagnostic(stage, status, error),
                                );
                        } finally {
                            redeemBusy = false;
                            if (this.overlay === overlay) void load();
                        }
                    })();
                };
            }
            return value;
        });
        const load = async () => {
            balances.forEach((value) => {
                value.string = "读取中…";
            });
            try {
                const { gifts } = await callCloud<{ gifts: GiftResult[] }>(
                    "flipZooFragments",
                    { action: "gifts-status" },
                );
                if (
                    !Array.isArray(gifts) ||
                    gifts.length !== FRAGMENT_ANIMALS.length
                )
                    throw new Error("Invalid gift availability");
                const amounts = await loadFragmentBalances();
                if (this.overlay !== overlay) return;
                gifts.forEach((gift, index) => {
                    const control = giftButtons[index];
                    const enabled = giftEnabled(gift);
                    control.setEnabled(enabled);
                    control.detail.string =
                        gift.status === "ready"
                            ? "继续领取"
                            : gift.status === "pending"
                              ? "重试确认"
                              : amounts[index] < (gift.cost ?? 1000)
                                ? "碎片不足"
                                : !enabled
                                  ? "暂未开放"
                                  : `${gift.cost}碎片`;
                });
                balances.forEach((value, index) => {
                    value.string = `碎片：${amounts[index]}`;
                });
            } catch {
                if (this.overlay !== overlay) return;
                giftButtons.forEach((control) => {
                    control.setEnabled(false);
                    control.detail.string = "读取失败";
                });
                balances.forEach((value) => {
                    value.string = "读取失败";
                });
                const retry = this.button(
                    "重试",
                    0,
                    -636,
                    450,
                    () => {
                        retry.node.destroy();
                        void load();
                    },
                    artwork,
                    72,
                );
                this.paintButton(retry, false, true, "cream");
            }
        };
        if (WECHAT && hasCloudEnvironment()) {
            redeemBusy = true;
            void load().finally(() => {
                redeemBusy = false;
            });
        } else if (WECHAT) {
            giftButtons.forEach((control) => {
                control.setEnabled(false);
                control.detail.string = "暂未开放";
            });
        }
    }

    private showHomeAnimal(artwork: Node, y: number, animal: number): void {
        const viewport = uiNode(artwork, "HomeAnimal", 194, 162);
        viewport.setPosition(-238, 1024 - y);
        viewport.addComponent(Mask);
        const [rest, ...poses] = this.art.home.collectionAnimals[animal];
        const { width, height } = rest.originalSize;
        const sprite = picture(viewport, "Portrait", rest, width, height);

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
        let feedback: string | undefined;
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
            if (result.status === "limit") feedback = "今日碎片已达上限";
        } catch {
            // The pending settlement is retried when the player opens Home.
            feedback = "碎片结算未完成，打开家园可重试";
        } finally {
            this.unschedule(expired);
        }
        if (this.overlay === overlay) this.showResult(true, feedback);
    }

    private playFragmentReward(overlay: Node, animal: number): void {
        const reward = uiNode(overlay, "Reward");
        const badge = uiNode(reward, "FragmentBadge");
        const [frame] = this.art.home.collectionAnimals[animal];
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
        const card = uiNode(overlay, "TutorialClearCard", 650, 760);
        this.fitTutorialClearCard(card);
        // Draw the panda behind the paper so its body stays inside the frame.
        const panda = picture(
            card,
            "TutorialPanda",
            this.art.winPanda,
            (238 * this.art.winPanda.originalSize.width) /
                this.art.winPanda.originalSize.height,
            238,
        ).node;
        panda.setPosition(0, 176);
        picture(
            card,
            "TutorialFrame",
            this.art.home.settings[0],
            630,
            420,
        ).node.setPosition(0, -30);
        const heading = picture(
            card,
            "TutorialHeading",
            this.art.home.settings[1],
            510,
            140,
        ).node;
        heading.setPosition(0, 90);
        titleLine(heading, "教学完成！", -4, 57, "#FFEFAD", "#7B3D17");
        const transition = this.art.home.tutorialTransition;
        picture(
            card,
            "TutorialTransition",
            transition,
            490,
            (490 * transition.originalSize.height) /
                transition.originalSize.width,
        ).node.setPosition(0, -105);
        this.celebrate(card, panda, false);
        tween(panda)
            .to(0.42, { position: new Vec3(0, 250, 0) }, { easing: "quadOut" })
            .start();
        this.scheduleOnce(this.advanceToMainBoard, 1.25);
    }

    private fitTutorialClearCard(card: Node): void {
        const { width, height } = this.screenSize();
        const scale = Math.min(1, (width - 32) / 650, (height - 64) / 760);
        card.setScale(scale, scale, 1);
    }

    private showResult(won: boolean, feedback?: string): void {
        const result = this.openOverlay("RoundResult");
        const panda = showResultCard(
            result,
            this.art,
            this.controls,
            this.screenSize(),
            won,
            {
                home: () => this.returnHome(),
                share: () => {
                    if (this.overlay === result) this.share(true);
                },
                retry: () => {
                    if (this.overlay !== result) return;
                    this.closeOverlay();
                    this.restartRound();
                },
                revive: () => this.requestRevive(result),
                leaderboard: () =>
                    this.showLeaderboard(false, () =>
                        this.showResult(won, feedback),
                    ),
            },
            feedback,
        );
        if (won) this.celebrate(panda.parent!, panda, true);
    }

    private requestRevive(result: Node): void {
        const round = this.round;
        if (
            this.overlay !== result ||
            this.animatingCards ||
            this.cancelRevivalShare ||
            !round.canRevive
        )
            return;
        if (!WECHAT) {
            this.completeRevive(result, round);
            return;
        }
        const cancel = wechat.openRevivalShare(() =>
            this.completeRevive(result, round),
        );
        if (!cancel) {
            this.platformNotice("暂时无法打开分享，请重试");
            return;
        }
        if (this.overlay === result) this.cancelRevivalShare = cancel;
        else cancel();
    }

    private completeRevive(dialog: Node, round: Round): void {
        if (
            this.overlay !== dialog ||
            this.round !== round ||
            this.animatingCards
        )
            return;
        const groups = round.revive();
        if (!groups) {
            this.platformNotice("当前牌局无法复活");
            return;
        }
        this.fragmentRound?.actions.push(REVIVE_ACTION);
        this.closeOverlay();
        this.animatingCards = true;
        this.message.string = "正在补齐槽内同款…";
        this.playSlotClear(groups, 0);
    }

    private share(won = false): boolean {
        const result = wechat.openShare(won);
        if (result === "opened") return true;
        if (result === "unsupported")
            this.platformNotice("当前环境无法调起微信分享", this.welcome);
        else this.platformNotice("暂时无法打开分享");
        return false;
    }

    private platformNotice(message: string, fallback?: Node): void {
        if (WECHAT) wechat.showToast(message);
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
        if (!this.feedbackControl || !wechat.supportsFeedback()) return;
        const window = wechat.windowInfo();
        if (!window) return;
        const rect = this.feedbackControl
            .getComponent(UITransform)!
            .getBoundingBoxToWorld();
        const visible = view.getVisibleSize();
        const scaleX = window.windowWidth / visible.width;
        const scaleY = window.windowHeight / visible.height;
        this.feedbackButton = wechat.createFeedbackButton(
            {
                left: rect.x * scaleX,
                top: window.windowHeight - (rect.y + rect.height) * scaleY,
                width: rect.width * scaleX,
                height: rect.height * scaleY,
            },
            () => this.audio.playButtonPress(),
        );
    }

    private showLeaderboard(
        history = false,
        back = () => this.showWelcome(),
    ): void {
        showLeaderboardCard(
            this.openOverlay("Leaderboard"),
            this.controls,
            this.art,
            this.screenSize(),
            history,
            back,
        );
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

    private onPropTouch(prop: Prop): void {
        if (
            this.overlay ||
            this.loadingBoard ||
            this.animatingCards ||
            this.round.status !== "playing"
        )
            return;
        if (this.round.canClaimProp(prop)) {
            if ((WECHAT && !this.share()) || !this.round.claimProp(prop))
                return;
            this.fragmentRound?.actions.push("claim:" + prop);
            this.message.string = "已获得" + PROP_LABELS[prop] + "道具";
            this.refresh();
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
        if (index === 0) {
            this.refreshBoard();
            groups = groups.flatMap((group) => {
                const batches: SlotClearGroup[] = [];
                let offset = 0;
                let heldCount = group.heldCount;
                while (offset < group.boardCards.length) {
                    const count = 3 - heldCount;
                    batches.push({
                        kind: group.kind,
                        heldCount,
                        boardCards: group.boardCards.slice(
                            offset,
                            offset + count,
                        ),
                    });
                    offset += count;
                    heldCount = 0;
                }
                return batches;
            });
        }
        const group = groups[index];
        if (!group) {
            this.animatingCards = false;
            this.message.string = PROP_MESSAGES.remove;
            this.finishAction(false);
            return;
        }

        const waitingKinds = groups
            .slice(index + 1)
            .flatMap((waiting) =>
                Array<number>(waiting.heldCount).fill(waiting.kind),
            );
        const stack = 3 + waitingKinds.length > this.round.slotCapacity;
        // Keep every waiting card in a real slot. If the triple will not fit,
        // incoming cards land on the same-kind anchor instead of extra slots.
        const activeSlots = stack ? Math.max(1, group.heldCount) : 3;
        const kinds: (number | undefined)[] = Array.from(
            { length: activeSlots },
            (_, slot) => (slot < group.heldCount ? group.kind : undefined),
        );
        kinds.push(...waitingKinds);
        const stacked: CardView[] = [];
        this.refreshSlots(kinds);
        let landed = 0;
        const flyNext = () => {
            const card = group.boardCards[landed];
            if (card) {
                const stackLevel = stack
                    ? landed + (group.heldCount > 0 ? 1 : 0)
                    : 0;
                const slot = stack ? activeSlots - 1 : group.heldCount + landed;
                this.flyCardToSlot(
                    card,
                    slot,
                    (view) => {
                        if (view) stacked.push(view);
                        kinds[slot] = group.kind;
                        this.refreshSlots(kinds);
                        landed += 1;
                        flyNext();
                    },
                    undefined,
                    stackLevel,
                );
                return;
            }
            this.playMatch(
                group.kind,
                Array.from({ length: activeSlots }, (_, slot) => slot),
                stacked,
            );
            stacked.forEach((view) => view.node.destroy());
            kinds.fill(undefined, 0, activeSlots);
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
            const shareButton = slot.node.getChildByName("ShareUnlockButton");
            if (shareButton) shareButton.active = locked;
            slot.setArtworkVisible(!(locked && shareButton));
            if (kind !== undefined) slot.show(kind, FULL_EXPOSURE, true);
            else slot.showEmpty(locked ? "锁定" : undefined);
        });
    }

    private refreshBindingMarker(): void {
        const { round } = this;
        for (const binding of round.bindings) this.drawBindingMarker(binding);
    }

    private drawBindingMarker(binding: Binding): void {
        const { round } = this;
        const [first, second] = binding.map((id) => this.cards[id]);
        const layer = first.node.parent!;
        const marker =
            layer.getChildByName(`BindingMarker-${binding[0]}`) ??
            uiNode(layer, `BindingMarker-${binding[0]}`);
        const [a, b] = binding.map((id) => round.cards[id]);
        marker.active =
            round.isOnBoard(a) &&
            round.isOnBoard(b) &&
            !this.boardPress?.tiles.some(
                ({ card }) => card.id === a.id || card.id === b.id,
            );
        if (!marker.active) return;
        const { x: scaleX, y: scaleY } = this.board!.node.scale;
        marker.setScale(1, scaleX / scaleY);
        marker.setPosition(
            (first.node.position.x + second.node.position.x) / 2,
            (first.node.position.y + second.node.position.y) / 2 +
                first.drawingOffsetY +
                first.faceCenterY,
        );
        const graphic =
            marker.getComponent(Graphics) ?? marker.addComponent(Graphics);
        const horizontal = a.y === b.y;
        const open =
            round.isSelectable(round.exposure(a)) &&
            round.isSelectable(round.exposure(b));
        graphic.clear();
        graphic.lineWidth = 1.5;
        const advanced = a.kind !== b.kind;
        graphic.fillColor = color(advanced ? "#EAC26C" : "#ADBFB2");
        graphic.strokeColor = color(advanced ? "#9A622D" : "#6D8276");
        const railWidth = horizontal ? 42 : 9;
        const railHeight = horizontal ? 9 : 42;
        graphic.roundRect(
            -railWidth / 2,
            -railHeight / 2,
            railWidth,
            railHeight,
            4,
        );
        graphic.fill();
        graphic.stroke();

        graphic.strokeColor = color("#526A5D");
        graphic.lineWidth = 2.5;
        graphic.moveTo(-5, 2);
        graphic.lineTo(-5, 7);
        graphic.bezierCurveTo(-5, 13, 5, 13, 5, 7);
        graphic.lineTo(5, open ? 6 : 2);
        graphic.stroke();

        graphic.fillColor = color(open ? "#E3EEDC" : "#EEF0EF");
        graphic.strokeColor = color("#63796D");
        graphic.lineWidth = 1.5;
        graphic.roundRect(-10, -10, 20, 14, 4);
        graphic.fill();
        graphic.stroke();
        graphic.fillColor = color("#FFFFFF");
        graphic.roundRect(-6, 0, 12, 1.4, 0.7);
        graphic.fill();
        graphic.fillColor = color("#526A5D");
        graphic.circle(0, -3, 2);
        graphic.rect(-0.8, -6, 1.6, 3);
        graphic.fill();
    }

    private refreshBoard(): void {
        this.refreshBindingMarker();
        const { round } = this;
        const onBoard = round.cards.filter((card) => round.isOnBoard(card));
        for (const card of round.cards) {
            const view = this.cards[card.id];
            if (
                !round.isOnBoard(card) ||
                this.boardPress?.tiles.some((tile) => tile.card.id === card.id)
            ) {
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
            view.show(
                kind,
                exposure,
                round.isSelectable(exposure),
                upperCards,
                !!round.boundPartner(card.id),
            );
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
        this.cancelBoardPress();
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
        if (leaderboard) fitLeaderboardCard(leaderboard, this.screenSize());
        const result = this.overlay?.getChildByName("ResultCard");
        if (result) fitResultCard(result, this.screenSize());
        const tutorial = this.overlay?.getChildByName("TutorialClearCard");
        if (tutorial) this.fitTutorialClearCard(tutorial);
        this.fitScreenArtwork(this.overlay?.getChildByName("SettingsArtwork"));
        this.fitScreenArtwork(
            this.overlay?.getChildByName("CollectionArtwork"),
        );
        if (WECHAT) this.layoutWeChatGame(height);
        this.syncFeedbackButton();
    }

    private fitBoard(
        board: Node,
        width: number,
        height: number,
        extraHeight = 0,
    ): void {
        const bounds = board.getComponent(UITransform)!;
        const maxScale =
            WECHAT && this.round.level === 2 ? WECHAT_MAIN_BOARD_SCALE : 1;
        const scale = Math.min(
            maxScale,
            (width - 20) / bounds.width,
            (height - extraHeight - 20) / bounds.height,
        );
        board.setScale(scale, scale + extraHeight / bounds.height, 1);
    }

    private layoutWeChatGame(height: number): void {
        if (!this.board || !this.slotTray) return;
        const window = wechat.windowInfo();
        const safeArea = window?.safeArea;
        const scale = window?.windowHeight ? height / window.windowHeight : 1;
        const menu = wechat.menuButtonRect();
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
        const availableMatHeight = tutorial
            ? Math.min(matBounds.height, availableBoardHeight)
            : availableBoardHeight;
        const stackBottom =
            bottom + (availableBoardHeight - availableMatHeight) / 2;
        footer.setPosition(0, stackBottom + footerHeight / 2);
        const trayTop = stackBottom + footerAndTrayHeight;
        this.slotTray.setPosition(0, trayTop - trayHeight / 2);
        const boardBottom = trayTop + (tutorial ? 18 : 8);
        const topExtension = tutorial ? 0 : WECHAT_MAIN_BOARD_TOP_EXTENSION;
        const bottomExtension = tutorial
            ? 0
            : WECHAT_MAIN_BOARD_BOTTOM_EXTENSION;
        const extraHeight = topExtension + bottomExtension;
        const boardHeight = availableMatHeight + extraHeight;
        const center = boardBottom - bottomExtension + boardHeight / 2;
        mat.setPosition(0, center);
        mat.setScale(1, boardHeight / matBounds.height, 1);
        this.board.node.setPosition(0, center);
        this.fitBoard(
            this.board.node,
            matBounds.width,
            boardHeight,
            extraHeight,
        );
        if (!tutorial) {
            this.updateBoardProjection();
            this.matchSlotScaleToBoard();
            this.refreshBoard();
        }
    }

    private updateBoardProjection(): void {
        const { node, touchArea } = this.board!;
        for (const card of this.cards) {
            card.setProjectionScale(node.scale.y);
            card.keepPortraitSquare(node.scale.x, node.scale.y);
        }
        const bounds = node.getComponent(UITransform)!;
        const liftY = Math.max(
            ...this.cards.map((card) => card.drawingOffsetY),
        );
        touchArea!.setContentSize(bounds.width, bounds.height + liftY);
        touchArea!.node.setPosition(0, liftY / 2);
    }

    private matchSlotScaleToBoard(): void {
        const scale = this.board!.node.scale;
        for (const slot of this.slots) {
            slot.node.setScale(scale);
            slot.keepPortraitSquare(scale.x, scale.y);
            slot.node
                .getChildByName("ShareUnlockButton")
                ?.setScale(1, scale.x / scale.y, 1);
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
