import {
    _decorator,
    AudioClip,
    AudioSource,
    BlockInputEvents,
    Color,
    Component,
    Game,
    Graphics,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    SubContextView,
    Texture2D,
    resources,
    screen,
    Label,
    Mask,
    Node,
    UITransform,
    UIOpacity,
    tween,
    Tween,
    Vec3,
    game,
    sys,
    view,
} from "cc";
import {
    BOARD_COLUMN_STEP,
    BOARD_LAYOUT_COUNT,
    BOARD_ROW_STEP,
    covers,
    deal,
    findMatch,
    faceName,
    FACE_FILES,
    refreshUnsolvableBoard,
    shuffleBoard,
    SLOT_CAPACITY,
    TILE_WIDTH,
    TILE_HEIGHT,
    UNSOLVABLE_CHECK_BOARD_LIMIT,
    type PlacedTile,
} from "./round";
import {
    attachFeedbackButton,
    authorizeFriendRank,
    clearStats,
    openService,
    rankContext,
    recordClear,
    shareGame,
    syncRank,
    wechatMenuBottomRatio,
} from "./home-platform";
import { Dialog } from "./dialog";

const INK = new Color(33, 47, 32);
const CREAM = new Color(255, 245, 222);
const GOLD = new Color(235, 194, 106);
const PORCELAIN = new Color(249, 250, 239);
const JADE = new Color(38, 131, 73);
const DEEP_JADE = new Color(5, 35, 26);
const TRAY_FELT = new Color(22, 79, 58);
const BRASS = new Color(135, 107, 57);
const RAIL = new Color(75, 93, 61);

const MUSIC_VOLUME = "mahjong-match.music-volume";
const SOUND_VOLUME = "mahjong-match.sound-volume";

function storedVolume(key: string, defaultValue: number): number {
    const saved = sys.localStorage.getItem(key);
    if (saved === null || saved === "") return defaultValue;
    const volume = Number(saved);
    return Number.isInteger(volume) && volume >= 0 && volume <= 100
        ? volume
        : defaultValue;
}
const TUTORIAL_DONE = "mahjong-match.tutorial-completed";
const TUTORIAL_BOARD: PlacedTile[] = [
    ...(
        [
            ["筒", [5, 5, 5]],
            ["条", [3, 4, 5]],
            ["字", [1, 1, 1]],
        ] as const
    ).flatMap(([suit, ranks], row) =>
        ranks.map((rank, index) => ({
            suit,
            rank,
            x: (index - 1) * BOARD_COLUMN_STEP,
            y: 175 - row * BOARD_ROW_STEP,
            layer: 0,
        })),
    ),
    ...[1, 2, 3].map((rank, index) => ({
        suit: "万" as const,
        rank,
        x: (index - 1) * BOARD_COLUMN_STEP,
        y: 191,
        layer: 1,
    })),
];

const BOARD_PADDING = 36;
const TABLE_MARGIN = 24;
const TABLE_VERTICAL_MARGIN = 60;
const TOOL_BUTTON_HEIGHT = 127;
const SLOT_Y = 431;
const SLOT_STEP = 76;
const SLOT_SCALE = Math.min(68 / TILE_WIDTH, 94 / TILE_HEIGHT);
const SOUNDS = {
    button: "button-click",
    select: "tile-select",
    match: "tile-match",
    shuffle: "tile-shuffle",
    clear: "round-clear",
} as const;
type Sound = keyof typeof SOUNDS;

type BoardTile = {
    tile: PlacedTile;
    node: Node;
    sprite: Sprite;
};

function loadTexture(name: string): Promise<Texture2D> {
    return new Promise((resolve, reject) => {
        resources.load(`art/${name}/texture`, Texture2D, (error, texture) => {
            if (error) reject(error);
            else resolve(texture);
        });
    });
}

function frame(texture: Texture2D, rect: Rect): SpriteFrame {
    const spriteFrame = new SpriteFrame();
    spriteFrame.texture = texture;
    spriteFrame.rect = rect;
    spriteFrame.originalSize = new Size(rect.width, rect.height);
    return spriteFrame;
}

@_decorator.ccclass("MahjongStartScreen")
export class MahjongStartScreen extends Component {
    private board: BoardTile[] = [];
    private tray: BoardTile[] = [];
    private beforePick?: { board: PlacedTile[]; tray: PlacedTile[] };
    private round!: Node;
    private busy = false;
    private finished = false;
    private status!: Label;
    private remaining!: Label;
    private launch!: Node;
    private homeArt?: Node;
    private homeControls?: { menu: Node; start: Node; row: Node[] };
    private dialog?: Dialog;
    private feedbackButton?: { destroy(): void };
    private feedbackControl?: Node;
    private musicVolume = storedVolume(
        MUSIC_VOLUME,
        sys.localStorage.getItem("mahjong-match.music-off") === "1" ? 0 : 100,
    );
    private soundVolume = storedVolume(
        SOUND_VOLUME,
        sys.localStorage.getItem("mahjong-match.sound-off") === "1" ? 0 : 100,
    );
    private launchLabel!: Label;
    private launchStatus!: Label;
    private table!: Node;
    private tools!: Node;
    private gameHud?: Node;
    private gameLayoutPending = false;
    private restartTutorial!: Node;
    private tutorialEnd!: Node;
    private launchState: "loading" | "ready" | "error" | "entering" = "loading";
    private teaching = false;
    private nextLayout = Math.floor(Math.random() * BOARD_LAYOUT_COUNT);

    private tileFrames = new Map<string, SpriteFrame>();
    private tableArt?: Node;
    private boardSurface!: Node;
    private boardBounds?: Rect;
    private boardFrame!: Node;
    private pile?: Node;
    private toolFrames: SpriteFrame[] = [];

    private audio!: AudioSource;
    private readonly audioClips = new Map<Sound, AudioClip>();
    private music!: AudioSource;
    private musicRequested = false;
    private foreground = true;

    protected start(): void {
        this.audio = this.node.addComponent(AudioSource);
        this.audio.playOnAwake = false;
        this.music = this.node.addComponent(AudioSource);
        this.music.playOnAwake = false;
        this.music.loop = true;
        this.music.volume = (0.24 * this.musicVolume) / 100;
        game.on(Game.EVENT_HIDE, this.pauseMusic, this);
        game.on(Game.EVENT_SHOW, this.resumeMusic, this);
        resources.load("audio/table-music", AudioClip, (error, clip) => {
            if (!this.isValid) return;
            if (error) {
                console.warn(error);
                return;
            }
            this.music.clip = clip;
            this.syncMusic();
        });
        for (const sound of Object.keys(SOUNDS) as Sound[]) {
            resources.load(
                `audio/${SOUNDS[sound]}`,
                AudioClip,
                (error, clip) => {
                    if (!this.node.isValid) return;
                    if (error) console.warn(error);
                    else this.audioClips.set(sound, clip);
                },
            );
        }
        view.on("canvas-resize", this.fitArtwork, this);
        this.showLaunch();
        void this.prepareTable();
    }

    private action(
        parent: Node,
        name: string,
        title: string,
        y: number,
        onTap: () => void,
    ): { node: Node; label: Label } {
        const node = this.child(parent, name, 0, y);
        this.panel(node, 336, 76, 22, GOLD);
        const label = this.text(node, title, 34, INK, 0, 0);
        node.on(Node.EventType.TOUCH_END, onTap);
        return { node, label };
    }

    private showLaunch(): void {
        this.launch = this.child(this.node, "Launch", 0, 0);
        this.panel(this.launch, 1800, 3000, 0, new Color(4, 34, 21));
        this.launch.addComponent(BlockInputEvents);

        this.launchStatus = this.text(this.launch, "", 24, CREAM, 0, -371);
        const button = this.action(this.launch, "Start", "开始游戏", -291, () =>
            this.activateLaunch(),
        );
        this.launchLabel = button.label;
        this.text(this.launch, "麻将消消乐", 68, GOLD, 0, 360);
    }

    private installHomeArt(background: Texture2D, controls: Texture2D): void {
        const artwork = this.child(this.launch, "HomeArtwork", 0, 0);
        this.homeArt = artwork;
        this.image(
            artwork,
            frame(
                background,
                new Rect(0, 0, background.width, background.height),
            ),
            background.width,
            background.height,
        );
        for (const sibling of this.launch.children) {
            sibling.active =
                sibling === artwork || sibling === this.launchStatus.node;
        }

        const menu = this.homeTarget(
            controls,
            "菜单",
            new Rect(41, 64, 96, 97),
            22,
            () => this.showSettings(),
        );
        const start = this.homeTarget(
            controls,
            "开始游戏",
            new Rect(94, 889, 562, 137),
            67,
            () => this.activateLaunch(),
        );
        const collection = this.homeTarget(
            controls,
            "家园",
            new Rect(81, 1064, 175, 171),
            34,
            () => this.showCollection(),
        );
        const rank = this.homeTarget(
            controls,
            "排行榜",
            new Rect(288, 1064, 175, 171),
            34,
            () => this.showRank(),
        );
        const share = this.homeTarget(
            controls,
            "分享",
            new Rect(495, 1064, 175, 171),
            34,
            () => {
                const notice = shareGame();
                if (notice) this.showNotice("分享", notice);
            },
        );
        this.homeControls = { menu, start, row: [collection, rank, share] };
        this.launchStatus.node.setSiblingIndex(this.launch.children.length - 1);
        this.fitArtwork();
    }

    private fitArtwork(): void {
        const { width, height } = screen.windowSize;
        const viewWidth = width / view.getScaleX();
        const viewHeight = height / view.getScaleY();
        if (this.tableArt) {
            const size = this.tableArt.getComponent(UITransform)!.contentSize;
            this.tableArt.setScale(
                viewWidth / size.width,
                viewHeight / size.height,
                1,
            );
        }
        const safe = sys.getSafeAreaRect(false);
        const visible = view.getVisibleSize();
        const left = Math.max(-viewWidth / 2, safe.x - visible.width / 2);
        const right = Math.min(viewWidth / 2, safe.xMax - visible.width / 2);
        const bottom = Math.max(-viewHeight / 2, safe.y - visible.height / 2);
        const top = Math.min(viewHeight / 2, safe.yMax - visible.height / 2);
        this.fitGameControls(left, right, bottom, top, viewHeight);
        this.dialog?.resize(viewWidth, viewHeight);
        if (this.feedbackControl) this.syncFeedbackControl();
        if (!this.homeArt || !this.homeControls) return;
        const size = this.homeArt.getComponent(UITransform)!.contentSize;
        const backgroundScale = Math.max(
            viewWidth / size.width,
            viewHeight / size.height,
        );
        this.homeArt.setScale(backgroundScale, backgroundScale, 1);
        this.homeArt.setPosition(
            0,
            (viewHeight - size.height * backgroundScale) / 2,
        );

        const { menu, start, row } = this.homeControls;
        const scale = Math.min(1, (right - left) / 750, (top - bottom) / 1240);
        const centerX = (left + right) / 2;
        const rowY =
            Math.max(bottom + 32 * scale, -viewHeight * 0.43) + 85.5 * scale;
        for (const button of [menu, start, ...row])
            button.setScale(scale, scale, 1);
        menu.setPosition(left + 83 * scale, top - 66 * scale);
        start.setPosition(centerX, rowY + 182 * scale);
        row.forEach((button, index) =>
            button.setPosition(centerX + (index - 1) * 207 * scale, rowY),
        );
        this.launchStatus.node.setPosition(centerX, rowY - 112 * scale);
    }

    private fitGameControls(
        left: number,
        right: number,
        bottom: number,
        top: number,
        viewHeight: number,
    ): void {
        if (!this.gameHud) return;
        if (this.busy) {
            this.gameLayoutPending = true;
            return;
        }
        this.gameLayoutPending = false;
        const menuBottom = viewHeight * (0.5 - wechatMenuBottomRatio());
        const logoTop = Math.min(top - 4, menuBottom + 60) + 16;
        const emblem = this.gameHud.getChildByName("TableEmblem")!;
        const emblemTop =
            emblem.position.y + emblem.getComponent(UITransform)!.height / 2;
        const offset = logoTop - emblemTop;
        if (offset !== this.gameHud.position.y) {
            this.gameHud.setPosition(0, offset);
            if (this.table.active) {
                this.tray.forEach(({ node }, index) => {
                    if (!node.isValid) return;
                    Tween.stopAllByTarget(node);
                    node.setPosition(this.slotPosition(index));
                });
            }
        }
        const toolHeight = this.tools.getComponent(UITransform)!.height;
        const toolsY = bottom + toolHeight / 2;
        this.tools.setPosition(0, toolsY);
        this.restartTutorial.setPosition(0, toolsY);
        this.tutorialEnd.setPosition(0, toolsY);

        const trayBottom = SLOT_Y + offset - 69;
        const toolTop = toolsY + TOOL_BUTTON_HEIGHT / 2;
        if (!this.boardBounds) return;
        const { width, height } = this.boardBounds;
        const tableWidth = right - left - TABLE_MARGIN * 2;
        const scale = Math.min(
            tableWidth / width,
            (trayBottom - toolTop - TABLE_VERTICAL_MARGIN * 2) / height,
        );
        const centerX = (left + right) / 2;
        const centerY = (trayBottom + toolTop) / 2;
        this.boardSurface.setPosition(centerX, centerY);
        this.boardSurface
            .getComponent(UITransform)!
            .setContentSize(tableWidth, height * scale);
        this.status.node.parent!.setPosition(
            centerX,
            (centerY - (height * scale) / 2 + toolTop) / 2,
        );
    }

    private homeTarget(
        texture: Texture2D,
        name: string,
        rect: Rect,
        radius: number,
        onTap: () => void,
    ): Node {
        const target = this.child(this.launch, name, 0, 0);
        target
            .addComponent(UITransform)
            .setContentSize(rect.width, rect.height);
        const mask = target.addComponent(Mask);
        mask.type = Mask.Type.GRAPHICS_STENCIL;
        this.fill(
            target.getComponent(Graphics)!,
            rect.width,
            rect.height,
            radius,
            Color.WHITE,
        );
        const sprite = this.image(
            this.child(target, "Artwork", 0, 0),
            frame(texture, rect),
            rect.width,
            rect.height,
        );
        target.on(Node.EventType.TOUCH_START, () => {
            sprite.color = new Color(220, 220, 220);
        });
        target.on(Node.EventType.TOUCH_CANCEL, () => {
            sprite.color = Color.WHITE;
        });
        target.on(Node.EventType.TOUCH_END, () => {
            sprite.color = Color.WHITE;
            this.playSound("button");
            onTap();
        });
        return target;
    }

    private closeDialog(): void {
        this.feedbackButton?.destroy();
        this.feedbackButton = undefined;
        this.feedbackControl = undefined;
        this.dialog?.close();
        this.dialog = undefined;
    }

    private openDialog(title: string): Node {
        this.closeDialog();
        const dialog = new Dialog(this.node, title, 640, 780);
        this.dialog = dialog;
        this.resizeDialog(dialog);
        const box = dialog.panel;
        this.text(box, title, 49, GOLD, 0, 321);
        const close = this.smallButton(box, "返回", 0, -319, () =>
            this.closeDialog(),
        );
        this.scheduleOnce(() => {
            if (close.isValid) close.setSiblingIndex(box.children.length - 1);
        });
        return box;
    }

    private resizeDialog(dialog: Dialog): void {
        const { width, height } = screen.windowSize;
        dialog.resize(width / view.getScaleX(), height / view.getScaleY());
    }

    private syncFeedbackControl(): void {
        this.feedbackButton?.destroy();
        this.feedbackButton = undefined;
        const control = this.feedbackControl;
        if (!control?.isValid || !control.activeInHierarchy) return;
        this.feedbackButton = attachFeedbackButton(
            control.getComponent(UITransform)!.getBoundingBoxToWorld(),
        );
    }

    private showNotice(title: string, message: string): void {
        this.text(this.openDialog(title), message, 29, CREAM, 0, 15);
    }

    private showSettings(fromGame = false): void {
        const box = this.openDialog("设置");
        const music = this.action(
            box,
            "Music",
            this.musicVolume ? "关闭音乐" : "开启音乐",
            199,
            () => {
                this.musicVolume = this.musicVolume ? 0 : 100;
                this.music.volume = (0.24 * this.musicVolume) / 100;
                sys.localStorage.setItem(
                    MUSIC_VOLUME,
                    String(this.musicVolume),
                );
                music.label.string = this.musicVolume ? "关闭音乐" : "开启音乐";
                this.musicRequested = true;
                this.syncMusic();
            },
        );
        const sound = this.action(
            box,
            "Sound",
            this.soundVolume ? "关闭音效" : "开启音效",
            100,
            () => {
                this.soundVolume = this.soundVolume ? 0 : 100;
                sys.localStorage.setItem(
                    SOUND_VOLUME,
                    String(this.soundVolume),
                );
                sound.label.string = this.soundVolume ? "关闭音效" : "开启音效";
            },
        );
        const notice = this.text(box, "", 23, CREAM, 0, 260);
        this.action(box, "Contact", "联系客服", 0, () =>
            openService("contact", (message) => {
                if (notice.isValid) notice.string = message;
            }),
        );
        this.feedbackControl = this.action(
            box,
            "Feedback",
            "问题反馈",
            -83,
            () => {
                if (!this.feedbackButton)
                    notice.string = "请在微信小游戏内提交反馈";
            },
        ).node;
        this.scheduleOnce(() => this.syncFeedbackControl());
        this.action(box, "Privacy", "隐私声明", -166, () =>
            openService("privacy", (message) => {
                if (notice.isValid) notice.string = message;
            }),
        );
        if (fromGame) {
            this.action(
                box,
                "LeaveRound",
                this.teaching ? "退出教学" : "放弃挑战",
                -249,
                () => this.confirmReturnHome(),
            );
        }
    }

    private showCollection(): void {
        const box = this.openDialog("家园");
        const { total } = clearStats();
        const collected = Math.min(total, FACE_FILES.length);
        this.text(
            box,
            `牌面收藏 ${collected} / ${FACE_FILES.length} · 清台 ${total} 次`,
            28,
            CREAM,
            0,
            248,
        );
        this.text(box, "每次挑战清台解锁一张牌面", 25, CREAM, 0, -246);
        FACE_FILES.forEach((name, index) => {
            const cell = this.child(
                box,
                name,
                ((index % 7) - 3) * 73,
                182 - Math.floor(index / 7) * 69,
            );
            const tile = this.tileFrames.get(name);
            if (index < collected && tile) {
                this.image(cell, tile, 45, 57);
            } else {
                this.panel(cell, 45, 57, 8, RAIL);
                this.text(cell, "·", 27, CREAM, 0, 0);
            }
        });
    }

    private showRank(): void {
        const box = this.openDialog("排行榜");
        const context = rankContext();
        if (!context) {
            this.text(box, "请在微信小游戏内查看好友榜", 28, CREAM, 0, 0);
            return;
        }
        const list = this.child(box, "Friends", 0, -39);
        list.addComponent(UITransform).setContentSize(560, 450);
        list.active = false;
        const subContext = list.addComponent(SubContextView);
        subContext.designResolutionSize.set(560, 490);
        subContext.fps = 12;
        list.active = true;
        const notice = this.text(box, "", 23, CREAM, 0, 188);
        let tab: "weekly" | "total" = "weekly";
        let request = 0;
        let permission: Promise<boolean> | undefined;
        const show = () => {
            const token = ++request;
            const current = () =>
                list.isValid && box.activeInHierarchy && token === request;
            notice.string = "正在读取好友榜";
            permission ??= authorizeFriendRank().finally(() => {
                permission = undefined;
            });
            void permission.then(async (allowed) => {
                if (!current()) return;
                if (!allowed) {
                    notice.string = "请在微信小游戏授权访问好友关系";
                    return;
                }
                await syncRank();
                if (!current()) return;
                notice.string = "";
                context.postMessage({
                    type: "mahjong-rank",
                    tab,
                    week: clearStats().week,
                });
            });
        };
        for (const [label, selected, x] of [
            ["周榜", "weekly", -194],
            ["总榜", "total", 0],
            ["刷新", undefined, 194],
        ] as const) {
            this.smallButton(box, label, x, 241, () => {
                if (selected) tab = selected;
                show();
            });
        }
        this.smallButton(box, "上一页", -234, -319, () =>
            context.postMessage({ type: "mahjong-rank-page", step: -1 }),
        );
        this.smallButton(box, "下一页", 234, -319, () =>
            context.postMessage({ type: "mahjong-rank-page", step: 1 }),
        );
        show();
    }

    private confirmReturnHome(): void {
        if (this.board.length === 0 && this.tray.length === 0) {
            this.returnHome();
            return;
        }
        const box = this.openDialog("返回首页");
        this.text(box, "返回后将结束当前牌局", 29, CREAM, 0, 70);
        this.action(box, "ConfirmHome", "结束并返回", -45, () =>
            this.returnHome(),
        );
    }

    private returnHome(): void {
        this.closeDialog();
        this.clearRound();
        this.table.active = false;
        this.table.getComponent(UIOpacity)!.opacity = 0;
        this.launch.getComponent(UIOpacity)!.opacity = 255;
        this.launch.active = true;
        this.teaching = sys.localStorage.getItem(TUTORIAL_DONE) !== "1";
        this.launchState = "ready";
    }

    private smallButton(
        parent: Node,
        label: string,
        x: number,
        y: number,
        onTap: () => void,
    ): Node {
        const button = this.child(parent, label, x, y);
        this.panel(button, 122, 59, 16, GOLD);
        this.text(button, label, 25, INK, 0, 0);
        button.on(Node.EventType.TOUCH_END, onTap);
        return button;
    }

    private async prepareTable(): Promise<void> {
        this.launchState = "loading";
        this.launchLabel.string = "开始游戏";
        this.launchStatus.string = "";
        try {
            if (!this.homeArt) {
                const [background, controls] = await Promise.all([
                    loadTexture("home-background"),
                    loadTexture("home-controls"),
                ]);
                if (!this.isValid) return;
                this.installHomeArt(background, controls);
            }
            await this.loadArtwork();
            if (!this.isValid) return;
            this.teaching = sys.localStorage.getItem(TUTORIAL_DONE) !== "1";
            this.launchState = "ready";
        } catch (error) {
            if (!this.isValid) return;
            this.launchState = "error";
            this.launchLabel.string = "重试";
            this.launchStatus.string = "资源加载失败，点击开始游戏重试";
            console.error(error);
        }
    }

    private activateLaunch(): void {
        if (this.launchState === "error") {
            void this.prepareTable();
            return;
        }
        if (this.launchState !== "ready") return;
        this.launchState = "entering";
        this.musicRequested = true;
        this.syncMusic();
        this.playSound("button");

        this.table.active = true;
        this.startRound();
        this.busy = true;
        const launchOpacity =
            this.launch.getComponent(UIOpacity) ??
            this.launch.addComponent(UIOpacity);
        const tableOpacity = this.table.getComponent(UIOpacity)!;
        tween(launchOpacity)
            .to(0.26, { opacity: 0 }, { easing: "quadOut" })
            .start();
        tween(tableOpacity)
            .to(0.36, { opacity: 255 }, { easing: "quadOut" })
            .call(() => {
                this.launch.active = false;
                this.busy = false;
                if (this.gameLayoutPending) this.fitArtwork();
            })
            .start();
    }

    private pauseMusic(): void {
        this.foreground = false;
        this.music.pause();
    }

    private resumeMusic(): void {
        this.foreground = true;
        this.syncMusic();
    }

    private syncMusic(): void {
        if (!this.musicVolume) {
            this.music.pause();
            return;
        }
        if (
            this.musicRequested &&
            this.foreground &&
            this.music.clip &&
            !this.music.playing
        ) {
            this.music.play();
        }
    }

    private playSound(sound: Sound): void {
        const clip = this.audioClips.get(sound);
        if (this.soundVolume && clip)
            this.audio.playOneShot(clip, this.soundVolume / 100);
    }

    private async loadArtwork(): Promise<void> {
        const [table, borderFrame, tools, emblem, ...tiles] = await Promise.all(
            [
                loadTexture("table"),
                new Promise<SpriteFrame>((resolve, reject) => {
                    resources.load(
                        "art/table-frame/spriteFrame",
                        SpriteFrame,
                        (error, asset) => {
                            if (error) reject(error);
                            else resolve(asset);
                        },
                    );
                }),
                loadTexture("tools"),
                loadTexture("table-emblem"),
                ...FACE_FILES.map((name) => loadTexture(`tiles/${name}`)),
            ],
        );
        if (!this.node.isValid) return;
        this.tileFrames = new Map(
            FACE_FILES.map((name, index) => {
                const texture = tiles[index];
                return [
                    name,
                    frame(
                        texture,
                        new Rect(0, 0, texture.width, texture.height),
                    ),
                ];
            }),
        );
        this.toolFrames = Array.from({ length: 3 }, (_, index) =>
            frame(tools, new Rect(index * 320, 156, 320, 220)),
        );
        this.table = this.child(this.node, "GameView", 0, 0);
        this.table.active = false;
        this.table.addComponent(UIOpacity).opacity = 0;
        this.launch.setSiblingIndex(this.node.children.length - 1);
        this.tableArt = this.child(this.table, "Table", 0, 0);
        this.image(
            this.tableArt,
            frame(table, new Rect(0, 0, table.width, table.height)),
            750,
            1334,
        );
        this.boardSurface = this.child(this.table, "BoardSurface", 0, 0);
        this.boardSurface
            .addComponent(UITransform)
            .setContentSize(borderFrame.originalSize);
        this.boardFrame = this.child(this.boardSurface, "BoardFrame", 0, 0);
        const boardFrameSprite = this.image(
            this.boardFrame,
            borderFrame,
            borderFrame.originalSize.width,
            borderFrame.originalSize.height,
        );
        boardFrameSprite.type = Sprite.Type.SLICED;
        this.boardSurface.on(
            Node.EventType.SIZE_CHANGED,
            this.resizeBoardSurface,
            this,
        );
        this.showGame(emblem);
        this.fitArtwork();
    }

    private showGame(emblem: Texture2D): void {
        const hud = this.child(this.table, "GameHud", 0, 0);
        this.gameHud = hud;
        const mark = this.child(hud, "TableEmblem", 0, 574);
        const width = 185;
        this.image(
            mark,
            frame(emblem, new Rect(0, 0, emblem.width, emblem.height)),
            width,
            (width * emblem.height) / emblem.width,
        );

        const tray = this.child(hud, "Tray", 0, SLOT_Y).addComponent(Graphics);
        this.fill(tray, 506, 128, 21, new Color(0, 16, 12, 180), -5);
        this.fill(tray, 502, 122, 20, BRASS);
        this.fill(tray, 494, 114, 16, DEEP_JADE);
        for (let index = 0; index < SLOT_CAPACITY; index++) {
            const x = this.slotPosition(index).x - 35;
            tray.fillColor = new Color(43, 103, 78);
            tray.roundRect(x, -51, 70, 102, 9);
            tray.fill();
            tray.fillColor = TRAY_FELT;
            tray.roundRect(x + 2, -49, 66, 98, 8);
            tray.fill();
        }
        this.remaining = this.text(hud, "", 23, GOLD, 0, 516);

        const hint = this.child(this.table, "Hint", 0, -368);
        this.panel(hint, 632, 58, 25, new Color(3, 31, 22, 225));
        this.status = this.text(hint, "", 24, CREAM, 0, 0);
        this.status.getComponent(UITransform)!.setContentSize(606, 49);
        this.status.overflow = Label.Overflow.SHRINK;

        this.tools = this.child(this.table, "Tools", 0, -554);
        this.panel(this.tools, 612, 148, 27, new Color(2, 30, 23, 210));
        this.addTool("Shuffle", 0, -194, this.shuffle);
        this.addTool("Remove", 1, 0, this.clearTray);
        this.addTool("Undo", 2, 194, this.undo);

        const settings = this.child(hud, "Settings", -306, 582);
        this.panel(settings, 76, 72, 24, BRASS);
        const icon = settings.getComponent(Graphics)!;
        this.fill(icon, 72, 68, 22, DEEP_JADE);
        icon.fillColor = CREAM;
        for (const y of [-11, 0, 11]) {
            icon.roundRect(-16, y - 3, 32, 6, 3);
        }
        icon.fill();
        settings.on(Node.EventType.TOUCH_END, () => {
            if (this.busy) return;
            this.playSound("button");
            this.showSettings(true);
        });

        const restart = this.child(this.table, "RestartTutorial", 0, -440);
        this.restartTutorial = restart;
        this.panel(restart, 178, 48, 20, BRASS);
        this.fill(restart.getComponent(Graphics)!, 174, 44, 18, DEEP_JADE);
        this.text(restart, "重新教学", 23, CREAM, 0, 0);
        restart.on(Node.EventType.TOUCH_END, () => {
            if (this.busy) return;
            this.playSound("button");
            this.startRound();
        });

        this.tutorialEnd = this.action(
            this.table,
            "TutorialComplete",
            "开始挑战",
            -440,
            () => {
                this.teaching = false;
                this.playSound("button");
                this.startRound();
            },
        ).node;
    }

    private addTool(
        label: string,
        icon: number,
        x: number,
        action: () => void,
    ): void {
        const button = this.child(this.tools, label, x, 0);
        const artwork = this.image(
            button,
            this.toolFrames[icon],
            184,
            TOOL_BUTTON_HEIGHT,
        );
        button.on(Node.EventType.TOUCH_START, () => {
            artwork.color = new Color(210, 210, 210);
        });
        button.on(Node.EventType.TOUCH_CANCEL, () => {
            artwork.color = Color.WHITE;
        });
        button.on(Node.EventType.TOUCH_END, () => {
            artwork.color = Color.WHITE;
        });
        button.on(Node.EventType.TOUCH_END, action, this);
    }

    private showStatus(message: string): void {
        this.status.string = message;
        this.status.node.parent!.active = message.length > 0;
    }

    private startRound(): void {
        this.beforePick = undefined;
        this.tools.active = !this.teaching;
        this.restartTutorial.active = this.teaching;
        this.tutorialEnd.active = false;
        const board = this.teaching
            ? TUTORIAL_BOARD
            : deal(this.nextLayout++ % BOARD_LAYOUT_COUNT);
        this.measureBoard(board);
        this.restoreTiles(board, []);
        this.fitArtwork();
        this.showStatus(this.teaching ? "先取上层三张万字牌，组成顺子" : "");
    }

    private measureBoard(board: readonly PlacedTile[]): void {
        const x = board.map((tile) => tile.x);
        const y = board.map((tile) => tile.y);
        const left = Math.min(...x);
        const right = Math.max(...x);
        const bottom = Math.min(...y);
        const top = Math.max(...y);
        const insetX = TILE_WIDTH / 2 + BOARD_PADDING;
        const insetY = TILE_HEIGHT / 2 + BOARD_PADDING;
        this.boardBounds = new Rect(
            left - insetX,
            bottom - insetY,
            right - left + insetX * 2,
            top - bottom + insetY * 2,
        );
    }

    private resizeBoardSurface(): void {
        const size = this.boardSurface.getComponent(UITransform)!.contentSize;
        this.boardFrame.getComponent(UITransform)!.setContentSize(size);
        const bounds = this.boardBounds;
        if (!this.pile || !bounds) return;
        const scale = Math.min(
            size.width / bounds.width,
            size.height / bounds.height,
        );
        this.pile.setScale(scale, scale, 1);
        this.pile.setPosition(
            -(bounds.x + bounds.width / 2) * scale,
            -(bounds.y + bounds.height / 2) * scale,
        );
    }

    private restoreTiles(board: PlacedTile[], tray: PlacedTile[]): void {
        this.clearRound();
        this.round = this.child(this.table, "Round", 0, 0);
        const pile = this.child(this.boardSurface, "Pile", 0, 0);
        this.pile = pile;
        this.busy = false;
        this.finished = false;
        this.board = [...board]
            .sort((a, b) => a.layer - b.layer || b.y - a.y || a.x - b.x)
            .map((tile) => this.makeTile(pile, tile));
        this.tray = tray.map((tile, index) => {
            const card = this.makeTile(this.round, tile);
            card.node.setPosition(this.slotPosition(index));
            card.node.setScale(SLOT_SCALE, SLOT_SCALE, 1);
            this.drawTile(card, false);
            return card;
        });
        this.resizeBoardSurface();
        this.refreshBoard();
    }

    private shuffle(): void {
        if (this.busy) return;
        if (this.board.length < 2 || this.tray.length === SLOT_CAPACITY) {
            this.playSound("button");
            this.showStatus(
                this.tray.length === SLOT_CAPACITY
                    ? "槽满了，先消除或撤回"
                    : "牌山里没有足够的牌可洗",
            );
            return;
        }
        this.beforePick = undefined;
        this.restoreTiles(
            shuffleBoard(this.board.map(({ tile }) => tile)),
            this.tray.map(({ tile }) => tile),
        );
        this.showStatus("已洗牌，槽内牌保留");
        this.playSound("shuffle");
    }

    private clearTray(): void {
        if (this.busy) return;
        if (this.tray.length === 0) {
            this.playSound("button");
            this.showStatus("槽内没有牌");
            return;
        }
        this.beforePick = undefined;
        const count = Math.min(3, this.tray.length);
        this.removeFromTray(
            new Set(Array.from({ length: count }, (_, index) => index)),
        );
        this.finishMove(`已消除槽内 ${count} 张牌`, true);
    }

    private undo(): void {
        if (this.busy) return;
        this.playSound("button");
        const previous = this.beforePick;
        if (!previous) {
            this.showStatus("没有可撤回的取牌");
            return;
        }
        this.beforePick = undefined;
        this.restoreTiles(previous.board, previous.tray);
        this.showStatus("已撤回上一次取牌");
    }

    private makeTile(parent: Node, tile: PlacedTile): BoardTile {
        const node = this.child(parent, "Tile", tile.x, tile.y);
        const sprite = this.image(
            node,
            this.tileFrames.get(faceName(tile))!,
            TILE_WIDTH,
            TILE_HEIGHT,
        );
        const card = { tile, node, sprite };
        node.on(Node.EventType.TOUCH_END, () => this.select(card));
        return card;
    }

    private isCovered(card: BoardTile): boolean {
        return this.board.some(
            ({ node, tile }) => node.active && covers(tile, card.tile),
        );
    }

    private select(card: BoardTile): void {
        if (this.busy || this.finished || !this.board.includes(card)) return;
        if (this.isCovered(card)) {
            this.showStatus("这张牌被压住了");
            return;
        }

        const expected = this.tutorialSuit();
        if (expected && card.tile.suit !== expected) {
            this.showStatus(
                expected === "万" ? "先取上层的万字牌" : "试试取露出的 5 筒",
            );
            return;
        }
        this.beforePick = {
            board: this.board.map(({ tile }) => tile),
            tray: this.tray.map(({ tile }) => tile),
        };
        this.busy = true;
        this.board = this.board.filter((tile) => tile !== card);
        this.tray.push(card);
        card.node.setParent(this.round, true);
        this.refreshBoard();
        this.playSound("select");

        tween(card.node)
            .to(
                0.18,
                {
                    position: this.slotPosition(this.tray.length - 1),
                    scale: new Vec3(SLOT_SCALE, SLOT_SCALE, 1),
                },
                { easing: "quadOut" },
            )
            .call(() => this.resolveTray())
            .start();
    }

    private resolveTray(): void {
        const result = findMatch(this.tray.map(({ tile }) => tile));
        if (result) this.removeFromTray(new Set(result.indices));
        this.finishMove(
            result
                ? `${result.match}！消掉三张`
                : this.teaching
                  ? this.status.string
                  : "",
            result !== null,
        );
    }

    private removeFromTray(indices: ReadonlySet<number>): void {
        this.tray = this.tray.filter(({ node }, index) => {
            if (!indices.has(index)) return true;
            Tween.stopAllByTarget(node);
            this.shatter(node.position);
            node.active = false;
            node.destroy();
            return false;
        });
        this.tray.forEach(({ node }, index) => {
            Tween.stopAllByTarget(node);
            tween(node)
                .to(0.12, { position: this.slotPosition(index) })
                .start();
        });
    }

    private finishMove(message: string, removedTiles: boolean): void {
        this.finished = false;
        const refreshed =
            removedTiles || this.board.length === UNSOLVABLE_CHECK_BOARD_LIMIT
                ? refreshUnsolvableBoard(
                      this.board.map(({ tile }) => tile),
                      this.tray.map(({ tile }) => tile),
                  )
                : undefined;
        if (refreshed) {
            this.board.forEach((card, index) => {
                card.tile = refreshed[index];
                card.sprite.spriteFrame = this.tileFrames.get(
                    faceName(card.tile),
                )!;
            });
            this.showStatus("剩余牌面无解，已刷新牌山，槽内牌保留");
            this.playSound("shuffle");
        } else {
            this.showStatus(message);
        }
        this.refreshBoard();
        const cleared = this.board.length === 0 && this.tray.length === 0;
        if (cleared) {
            this.beforePick = undefined;
            this.finished = true;
            this.showStatus(this.teaching ? "教学完成" : "清台成功！");
            if (this.teaching) {
                sys.localStorage.setItem(TUTORIAL_DONE, "1");
                this.restartTutorial.active = false;
                this.tutorialEnd.active = true;
                this.tutorialEnd.setSiblingIndex(
                    this.table.children.length - 1,
                );
            } else {
                recordClear();
            }
            this.playSound("clear");
        } else if (
            this.tray.length === SLOT_CAPACITY ||
            this.board.length === 0
        ) {
            this.finished = true;
            this.showStatus(
                this.board.length
                    ? "槽满了，可消除或撤回"
                    : "槽里还有散牌，可消除或撤回",
            );
        }
        if (removedTiles && !cleared && !refreshed) {
            if (this.teaching)
                this.showStatus(
                    this.board.some(({ tile }) => tile.suit === "筒")
                        ? "顺子！现在取露出的三张 5 筒"
                        : message + "，剩下的牌可以自由清除",
                );
            this.playSound("match");
        }
        this.busy = false;
        if (this.gameLayoutPending) this.fitArtwork();
    }

    private slotPosition(index: number): Vec3 {
        return new Vec3(
            (index - (SLOT_CAPACITY - 1) / 2) * SLOT_STEP,
            SLOT_Y + (this.gameHud?.position.y ?? 0),
            0,
        );
    }

    private shatter(position: Vec3): void {
        for (let index = 0; index < 9; index++) {
            const angle = (index / 9) * Math.PI * 2;
            const shard = this.child(
                this.round,
                "Shard",
                position.x,
                position.y,
            );
            const shape = shard.addComponent(Graphics);
            shape.fillColor = index % 3 === 0 ? JADE : PORCELAIN;
            shape.moveTo(-5, -4);
            shape.lineTo(8, -2);
            shape.lineTo(1, 8);
            shape.close();
            shape.fill();
            tween(shard)
                .to(
                    0.32,
                    {
                        position: new Vec3(
                            position.x + Math.cos(angle) * 55,
                            position.y + Math.sin(angle) * 45,
                            0,
                        ),
                        angle: 135,
                        scale: new Vec3(0.05, 0.05, 1),
                    },
                    { easing: "quadOut" },
                )
                .call(() => shard.destroy())
                .start();
        }
    }

    protected onDestroy(): void {
        view.off("canvas-resize", this.fitArtwork, this);
        this.feedbackButton?.destroy();
        game.off(Game.EVENT_HIDE, this.pauseMusic, this);
        game.off(Game.EVENT_SHOW, this.resumeMusic, this);
        this.music?.stop();
        this.clearRound();
    }

    private clearRound(): void {
        if (this.pile?.isValid) {
            this.pile.active = false;
            this.pile.destroy();
        }
        this.pile = undefined;
        if (!this.round?.isValid) return;
        for (const node of this.round.children) Tween.stopAllByTarget(node);
        this.round.active = false;
        this.round.destroy();
    }

    private tutorialSuit(): PlacedTile["suit"] | undefined {
        if (!this.teaching) return undefined;
        if (this.board.some(({ tile }) => tile.layer === 1)) return "万";
        if (this.board.some(({ tile }) => tile.suit === "筒")) return "筒";
        return undefined;
    }

    private refreshBoard(): void {
        const guidedSuit = this.tutorialSuit();
        for (const card of this.board) {
            if (card.node.active) {
                this.drawTile(
                    card,
                    this.isCovered(card) ||
                        Boolean(guidedSuit && card.tile.suit !== guidedSuit),
                );
            }
        }
        this.remaining.string = `剩余 ${this.board.length + this.tray.length} 张`;
    }

    private drawTile({ sprite }: BoardTile, covered = false): void {
        sprite.color = covered ? new Color(145, 167, 154) : Color.WHITE;
    }

    private image(
        node: Node,
        artwork: SpriteFrame,
        width: number,
        height: number,
    ): Sprite {
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = artwork;
        node.getComponent(UITransform)!.setContentSize(width, height);
        return sprite;
    }

    private panel(
        node: Node,
        width: number,
        height: number,
        radius: number,
        color: Color,
    ): void {
        node.addComponent(UITransform).setContentSize(width, height);
        this.fill(node.addComponent(Graphics), width, height, radius, color);
    }

    private fill(
        graphics: Graphics,
        width: number,
        height: number,
        radius: number,
        color: Color,
        offsetY = 0,
    ): void {
        graphics.fillColor = color;
        graphics.roundRect(
            -width / 2,
            -height / 2 + offsetY,
            width,
            height,
            radius,
        );
        graphics.fill();
    }

    private text(
        parent: Node,
        value: string,
        size: number,
        color: Color,
        x: number,
        y: number,
    ): Label {
        const label = this.child(parent, "Label", x, y).addComponent(Label);
        label.string = value;
        label.fontSize = size;
        label.lineHeight = Math.ceil(size * 1.2);
        label.color = color;
        return label;
    }

    private child(parent: Node, name: string, x: number, y: number): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y);
        return node;
    }
}
