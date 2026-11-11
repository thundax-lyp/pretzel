import {
    _decorator,
    profiler,
    AudioClip,
    AudioSource,
    Color,
    Component,
    EventTouch,
    Graphics,
    Label,
    Node,
    ScrollView,
    Mask,
    UITransform,
    resources,
    view,
    ResolutionPolicy,
    game,
    Game,
    sys,
    Texture2D,
    Sprite,
    SpriteFrame,
    Vec3,
    tween,
    Tween,
} from "cc";
import { PREVIEW, DEBUG } from "cc/env";
import type {
    Action,
    Card,
    GameApi,
    Prop,
    RunSnapshot,
    AnimalCount,
} from "./contract";
import { createHttpGameApi, GameApiError } from "./http-game-api";
import { createPreviewApi } from "./preview-api";
import { canPick, RunState } from "./run-state";
import { skin } from "./ui-skin";
import { renderHome } from "./home-view";
import { homeAnimalDetail } from "./home-animal-detail";
import { weekDates } from "./home-layout";
import { layoutBoard } from "./board-layout";
import { restorationState } from "./board-restoration";
import { celebrate, deal, fly, pop, shake } from "./ui-effects";

const { ccclass, property } = _decorator;
const props = ["REMOVE", "CORRECT", "REPACK"] as const;
const names: Record<Prop, string> = {
    REMOVE: "移出",
    CORRECT: "纠错",
    REPACK: "重排",
};
const descriptions: Record<Prop, string> = {
    REMOVE: "选 1—3 张槽内牌移到暂存区",
    CORRECT: "纠正历史组合并回到当前题",
    REPACK: "验证剩余有解后重布棋盘",
};
const cream = "#fff5d9";
const ink = "#422c20";
const wood = "#714322";
const gold = "#f3c252";
const width = 750;
const height = 1334;

@ccclass("GameClient")
export class GameClient extends Component {
    @property
    apiOrigin = "";

    private screen?: Node;
    private api?: GameApi;
    private state?: RunState;
    private busy = false;
    private modal?: Node;
    private selecting = false;
    private selected = new Set<string>();
    private message = "";
    private openingId?: string;
    private lostSession = false;
    private live?: ReturnType<typeof createHttpGameApi>;
    private foreground = true;
    private audio?: AudioSource;
    private animalClaimRun?: string;
    private homePage = 0;
    private playerId?: string;
    private serial = 0;
    private scene: "start" | "home" | "game" = "start";
    private readonly previewEnabled =
        PREVIEW ||
        (DEBUG &&
            (typeof wx !== "undefined" ||
                (sys.isBrowser &&
                    new URLSearchParams(globalThis.location.search).get(
                        "fixture",
                    ) === "1")));
    private boardPlacements = new Map<
        string,
        { x: number; y: number; size: number }
    >();
    private dealtKey = "";
    private dealingUntil = 0;
    private startupReady = false;
    private startupProgress = 0;
    private startupTrack?: Graphics;
    private startupTurtle?: Node;
    private startupCaption?: Label;
    private topInset = 0;
    private bottomInset = 0;

    start() {
        profiler.hideStats();
        view.setDesignResolutionSize(
            width,
            height,
            ResolutionPolicy.FIXED_WIDTH,
        );
        const safe = sys.getSafeAreaRect(false);
        this.topInset = Math.max(
            0,
            view.getVisibleSize().height - safe.y - safe.height,
        );
        this.bottomInset = Math.max(0, safe.y);
        game.on(Game.EVENT_SHOW, this.onShow, this);
        game.on(Game.EVENT_HIDE, this.onHide, this);
        this.audio = this.node.addComponent(AudioSource);
        this.audio.loop = true;
        this.showStart();
        void this.work(() => this.prepareStart());
    }

    onDestroy() {
        game.off(Game.EVENT_SHOW, this.onShow, this);
        game.off(Game.EVENT_HIDE, this.onHide, this);
    }

    private onHide() {
        this.foreground = false;
        this.audio?.pause();
    }
    private onShow() {
        this.foreground = true;
        if (this.scene !== "start") this.music();
        if (this.scene === "game" && this.state && !this.busy) {
            void this.work(async () => {
                await this.state!.sync();
                this.showGame();
            });
        }
    }

    private volume(key: "music" | "sfx") {
        const stored = sys.localStorage.getItem(key + "-volume");
        const value = stored === null ? 0.6 : Number(stored);
        return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.6;
    }

    private music() {
        const source = this.audio;
        if (!source) return;
        source.volume = this.volume("music");
        if (!source.volume || !this.foreground) {
            source.pause();
            return;
        }
        if (source.clip) {
            if (!source.playing) source.play();
            return;
        }
        resources.load("audio/meadow", AudioClip, (error, clip) => {
            if (
                error ||
                !source.isValid ||
                !this.foreground ||
                !this.volume("music") ||
                source.clip
            )
                return;
            source.clip = clip;
            source.play();
        });
    }

    private sound(key: string) {
        if (!this.volume("sfx")) return;
        resources.load("audio/" + key, AudioClip, (error, clip) => {
            if (!error && this.foreground && this.audio?.isValid)
                this.audio.playOneShot(clip, this.volume("sfx"));
        });
    }

    private id() {
        return (
            Date.now().toString(36) +
            "-" +
            Math.random().toString(36).slice(2) +
            "-" +
            ++this.serial
        );
    }

    private point(
        parent: Node,
        name: string,
        x: number,
        y: number,
        w: number,
        h: number,
    ) {
        const node = new Node(name);
        node.layer = this.node.layer;
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(w, h);
        node.setPosition(x, y);
        return node;
    }

    private panel(
        parent: Node,
        x: number,
        y: number,
        w: number,
        h: number,
        color: string,
        border = true,
    ) {
        const node = this.point(parent, "Panel", x, y, w, h);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color().fromHEX(color);
        graphics.strokeColor = new Color().fromHEX(wood);
        graphics.lineWidth = 3;
        graphics.roundRect(-w / 2, -h / 2, w, h, 13);
        graphics.fill();
        if (border) graphics.stroke();
        if (border) {
            skin(
                node,
                "ui-atlas",
                color === gold ? 1 : w > 400 && h > 180 ? 7 : 3,
                color === "#ddd3b7" ? "#d4cdbb" : "#ffffff",
            );
        }
        return node;
    }

    private label(
        parent: Node,
        text: string,
        x: number,
        y: number,
        w = 650,
        h = 52,
        size = 27,
    ) {
        const node = this.point(parent, "Text", x, y, w, h);
        const label = node.addComponent(Label);
        label.string = text;
        label.isBold = true;
        label.fontSize = size;
        label.lineHeight = Math.ceil(size * 1.25);
        label.color = new Color().fromHEX(ink);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        return node;
    }

    private button(
        parent: Node,
        text: string,
        x: number,
        y: number,
        w: number,
        h: number,
        callback?: () => void,
        color = cream,
    ) {
        const node = this.panel(
            parent,
            x,
            y,
            w,
            h,
            callback ? color : "#ddd3b7",
        );
        const iconCells: Record<string, number> = {
            动物图鉴: 9,
            排行榜: 10,
            分享: 11,
        };
        const cell = iconCells[text];
        if (cell !== undefined) {
            skin(node, "ui-atlas", 3);
            const icon = this.point(node, "Menu icon", 0, 24, 100, 100);
            skin(icon, "ui-atlas", cell);
        }
        const caption = this.label(
            node,
            text,
            0,
            cell === undefined ? 0 : -53,
            w - 24,
            cell === undefined ? h - 12 : 50,
            color === gold ? 34 : 27,
        );
        if (color === gold) caption.getComponent(Label)!.color = Color.WHITE;
        if (callback) {
            node.on(Node.EventType.TOUCH_START, () => {
                if (this.busy) return;
                Tween.stopAllByTarget(node);
                tween(node)
                    .to(0.07, { scale: new Vec3(0.96, 0.96, 1) })
                    .start();
            });
            const release = () => {
                Tween.stopAllByTarget(node);
                tween(node).to(0.1, { scale: Vec3.ONE }).start();
            };
            node.on(Node.EventType.TOUCH_CANCEL, release);
            node.on(Node.EventType.TOUCH_END, release);
            node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                if (
                    !this.foreground ||
                    this.busy ||
                    (this.modal && parent !== this.modal)
                )
                    return;
                if (
                    event
                        .getStartLocation()
                        .subtract(event.getLocation())
                        .length() < 18
                )
                    callback();
            });
        }
        return node;
    }

    private picture(
        parent: Node,
        key: string,
        x: number,
        y: number,
        size: number,
    ) {
        if (!/^A(?:0[1-9]|1[0-9]|2[0-4])$/.test(key)) return;
        const node = this.point(parent, "Animal", x, y, size, size);
        skin(node, "animal-cutouts", Number(key.slice(1)) - 1);
    }

    private clear(scene: "start" | "home" | "game") {
        this.screen?.destroy();
        this.modal = undefined;
        this.scene = scene;
        this.screen = this.point(this.node, scene, 0, 0, width, height);
        const background = this.point(
            this.screen,
            "Meadow",
            0,
            0,
            width + 2,
            view.getVisibleSize().height + 2,
        );
        skin(background, "meadow");
        return this.screen;
    }

    private async work(callback: () => Promise<void>) {
        if (this.busy) return;
        this.busy = true;
        this.message = "";
        try {
            await callback();
        } catch (error) {
            const expired =
                error instanceof GameApiError && error.status === 401;
            if (expired) this.lostSession = true;
            this.message = expired
                ? "登录已失效，请重新连接"
                : error instanceof Error
                  ? error.message
                  : "请求失败";
            if (this.scene === "game" && this.state) {
                if (error instanceof GameApiError && error.status === 409) {
                    try {
                        await this.state.sync();
                    } catch {
                        this.message = "对局已更新，请重试同步";
                    }
                }
                this.showGame();
            } else if (this.scene === "start") this.showStart();
            else if (this.lostSession)
                this.showNotice(
                    "暂时无法完成",
                    this.message,
                    () => void this.work(() => this.connect()),
                    "重新连接",
                );
            else this.showNotice("暂时无法完成", this.message);
        } finally {
            this.busy = false;
        }
    }

    private async retryOperation() {
        const state = this.state!;
        await state.retry();
        if (state.snapshot.status === "ABANDONED") await this.home();
        else this.showGame();
    }

    private async connect() {
        if (typeof wx === "undefined") throw new Error("请在微信小游戏中登录");
        this.live ??= createHttpGameApi(
            this.apiOrigin,
            (url, method, header, data) =>
                new Promise((resolve, reject) =>
                    wx.request({
                        url,
                        method,
                        header,
                        data,
                        timeout: 12000,
                        success: (result) =>
                            resolve({
                                status: result.statusCode,
                                body: result.data,
                            }),
                        fail: () => reject(new Error("网络连接失败，请重试")),
                    }),
                ),
        );
        const code = await new Promise<string>((resolve, reject) =>
            wx.login({
                success: (result) =>
                    result.code
                        ? resolve(result.code)
                        : reject(new Error("未取得微信登录凭据")),
                fail: () => reject(new Error("微信登录失败")),
            }),
        );
        const session = await this.live.login(code);
        if (this.playerId && this.playerId !== session.playerId) {
            this.state = undefined;
            this.animalClaimRun = undefined;
            this.openingId = undefined;
        }
        this.playerId = session.playerId;
        this.api = this.live;
        this.lostSession = false;
        if (this.state && this.scene === "game") {
            await this.state.sync();
            this.showGame();
        } else await this.home();
    }

    private share(title: string) {
        if (!this.live || typeof wx === "undefined") return undefined;
        const platform = wx as typeof wx & {
            shareAppMessage?: (options: { title: string }) => void;
        };
        return platform.shareAppMessage
            ? () => platform.shareAppMessage!({ title })
            : undefined;
    }

    private updateStartup(progress: number, caption: string) {
        this.startupProgress = progress;
        if (this.scene !== "start") return;
        const track = this.startupTrack;
        if (track?.isValid) {
            track.clear();
            track.fillColor = new Color().fromHEX("#314b2755");
            track.roundRect(-245, -7, 490, 14, 7);
            track.fill();
            if (progress > 0) {
                track.fillColor = new Color().fromHEX("#83c747");
                track.roundRect(-245, -7, Math.max(14, 490 * progress), 14, 7);
                track.fill();
            }
        }
        if (this.startupTurtle?.isValid)
            this.startupTurtle.setPosition(-245 + 490 * progress, 18);
        if (this.startupCaption?.isValid) this.startupCaption.string = caption;
    }

    private async prepareStart() {
        this.startupReady = false;
        this.startupProgress = 0;
        this.showStart();
        const sources = ["meadow", "animal-cutouts", "ui-atlas"];
        let completed = 0;
        const results = await Promise.allSettled(
            sources.map(
                (source) =>
                    new Promise<void>((resolve, reject) => {
                        resources.load(
                            "ui/" + source + "/texture",
                            Texture2D,
                            (error) => {
                                if (error) {
                                    reject(
                                        new Error("画面资源加载失败，请重试"),
                                    );
                                    return;
                                }
                                completed++;
                                this.updateStartup(
                                    (completed / sources.length) * 0.7,
                                    "正在布置动物园…",
                                );
                                resolve();
                            },
                        );
                    }),
            ),
        );
        if (results.some((result) => result.status === "rejected"))
            throw new Error("画面资源加载失败，请重试");
        this.startupReady = true;
        if (this.apiOrigin && typeof wx !== "undefined") {
            this.updateStartup(0.8, "正在连接动物园…");
            await this.connect();
        } else {
            this.updateStartup(1, "动物朋友准备好了");
            this.showStart();
        }
    }

    private showStart() {
        const page = this.clear("start");
        const startText = (
            text: string,
            y: number,
            w: number,
            h: number,
            size: number,
            color = "#204c43",
            bold = false,
        ) => {
            const node = this.label(page, text, 0, y, w, h, size);
            const label = node.getComponent(Label)!;
            label.color = new Color().fromHEX(color);
            label.isBold = bold;
            label.enableOutline = true;
            label.outlineColor = new Color().fromHEX("#fffbed");
            label.outlineWidth = size >= 30 ? 1.5 : 0.7;
            return label;
        };
        const visible = view.getVisibleSize().height;
        const top = visible / 2 - this.topInset;
        const bottom = -visible / 2 + this.bottomInset;
        const center = (top + bottom) / 2;
        const logo = this.point(page, "Game brand", 0, center + 350, 580, 154);
        const fallback = this.label(logo, "腿了个腿", 0, 0, 580, 154, 78);
        fallback.getComponent(Label)!.color = new Color().fromHEX("#20564a");
        resources.load(
            "ui/start-title/texture",
            Texture2D,
            (error, texture) => {
                if (error || !logo.isValid) return;
                const frame = new SpriteFrame();
                frame.texture = texture;
                const sprite = logo.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = frame;
                fallback.active = false;
            },
        );
        startText("数眼睛，凑腿数", center + 240, 580, 55, 30, "#204c43", true);
        for (const [i, key] of ["A05", "A03", "A08"].entries()) {
            const x = (i - 1) * 190;
            const shadow = this.point(
                page,
                "Animal shadow",
                x,
                center + 1,
                150,
                22,
            );
            const drawing = shadow.addComponent(Graphics);
            drawing.fillColor = new Color().fromHEX("#3e70262c");
            drawing.ellipse(0, 0, 63, 10);
            drawing.fill();
            this.picture(
                page,
                key,
                x,
                center + (i === 1 ? 68 : 45),
                i === 1 ? 185 : 165,
            );
        }
        const track = this.point(
            page,
            "Preparation progress",
            0,
            center - 130,
            520,
            70,
        );
        this.startupTrack = track.addComponent(Graphics);
        const turtle = this.point(track, "Loading turtle", -245, 18, 64, 46);
        this.startupTurtle = turtle;
        const drawing = turtle.addComponent(Graphics);
        drawing.fillColor = new Color().fromHEX("#436c31");
        for (const [x, y] of [
            [-15, -12],
            [15, -12],
            [-15, 10],
            [15, 10],
        ]) {
            drawing.ellipse(x, y, 7, 6);
        }
        drawing.fill();
        drawing.fillColor = new Color().fromHEX("#a3ce59");
        drawing.ellipse(26, 2, 11, 10);
        drawing.fill();
        drawing.fillColor = new Color().fromHEX("#669d3d");
        drawing.ellipse(0, 0, 25, 18);
        drawing.fill();
        drawing.strokeColor = new Color().fromHEX("#d8eaa0");
        drawing.lineWidth = 2;
        drawing.ellipse(0, 0, 16, 12);
        drawing.stroke();
        drawing.fillColor = new Color().fromHEX(ink);
        drawing.circle(30, 5, 2);
        drawing.fill();
        this.panel(page, 0, center - 184, 540, 54, "#fffbedde", false);
        this.startupCaption = startText(
            "",
            center - 184,
            520,
            48,
            24,
            this.message ? "#893e37" : "#204c43",
            true,
        );
        this.updateStartup(
            this.startupProgress,
            this.message ||
                (this.startupReady ? "动物朋友准备好了" : "正在布置动物园…"),
        );
        if (this.message) {
            this.button(
                page,
                "重新准备",
                0,
                center - 320,
                430,
                90,
                () => void this.work(() => this.prepareStart()),
                gold,
            );
        } else if (this.startupReady && this.previewEnabled) {
            this.button(
                page,
                "开始试玩",
                0,
                center - 320,
                430,
                90,
                () =>
                    void this.work(async () => {
                        const previewCount = Number(
                            sys.localStorage.getItem("preview-zoo-count") ||
                                "3",
                        );
                        this.api = createPreviewApi({
                            zooCount:
                                Number.isInteger(previewCount) &&
                                previewCount >= 0 &&
                                previewCount <= 24
                                    ? previewCount
                                    : 3,
                            stress:
                                sys.localStorage.getItem(
                                    "preview-zoo-stress",
                                ) === "true",
                        });
                        await this.home();
                    }),
                gold,
            );
            startText(
                "本地调试 · 进度仅保存在本次试玩",
                center - 392,
                620,
                40,
                20,
                "#304c47",
            );
        } else if (this.startupReady) {
            startText(
                "暂时无法连接动物园，请稍后重试",
                center - 320,
                620,
                70,
                24,
                "#893e37",
            );
            this.button(
                page,
                "重试",
                0,
                center - 410,
                360,
                76,
                () => void this.work(() => this.prepareStart()),
            );
        }
        this.panel(page, 0, bottom + 90, 420, 45, "#fffbedde", false);
        startText(
            "轻松动脑 · 合理安排时间",
            bottom + 90,
            410,
            44,
            21,
            "#304c47",
        );
    }

    private async home() {
        const api = this.api!;
        const [zoo, active, inventory] = await Promise.all([
            api.zoo(),
            api.active(),
            api.inventory(),
        ]);
        const seen = new Set<string>();
        for (const item of zoo.items) {
            if (
                seen.has(item.animal.id) ||
                !Number.isSafeInteger(item.receivedCount) ||
                item.receivedCount < 0
            )
                throw new Error("动物园数据暂时异常，请重试");
            seen.add(item.animal.id);
        }
        const draw = () => {
            const page = this.clear("home");
            this.music();
            const size = view.getVisibleSize();
            const logicalWidth =
                typeof wx !== "undefined"
                    ? wx.getWindowInfo().windowWidth
                    : view.getFrameSize().width;
            const scale = size.width / logicalWidth;
            const capsule =
                typeof wx !== "undefined"
                    ? wx.getMenuButtonBoundingClientRect().bottom
                    : 44;
            const detail = (item?: AnimalCount) => {
                if (item) {
                    this.closeModal();
                    this.modal = homeAnimalDetail(
                        page,
                        item,
                        {
                            width: logicalWidth,
                            height: size.height / scale,
                            scale,
                            top: Math.max(this.topInset / scale, capsule + 12),
                            bottom: this.bottomInset / scale,
                        },
                        () => this.closeModal(),
                    );
                } else
                    this.showNotice(
                        "本周收集",
                        weekDates(zoo.weekId, true) +
                            "\n已领取 " +
                            zoo.items.reduce(
                                (sum, entry) => sum + entry.receivedCount,
                                0,
                            ) +
                            " 只 · " +
                            zoo.items.length +
                            " 种动物",
                    );
            };
            const rendered = renderHome(
                page,
                {
                    width: logicalWidth,
                    height: size.height / scale,
                    scale,
                    safeTop: this.topInset / scale,
                    safeBottom: this.bottomInset / scale,
                    capsuleBottom: capsule,
                },
                {
                    ...zoo,
                    run: active.run,
                    reserve: inventory.reserve.reduce(
                        (sum, entry) => sum + entry.quantity,
                        0,
                    ),
                    claim: Boolean(this.animalClaimRun),
                    page: this.homePage,
                },
                {
                    blocked: () =>
                        this.busy || Boolean(this.modal) || !this.foreground,
                    bag: () =>
                        this.showList(
                            "道具背包",
                            props.map(
                                (prop) =>
                                    names[prop] +
                                    " · 储备 " +
                                    (inventory.reserve.find(
                                        (entry) => entry.propType === prop,
                                    )?.quantity ?? 0),
                            ),
                            "暂无储备",
                        ),
                    settings: () => this.settings(),
                    detail,
                    start: async () =>
                        this.work(async () => {
                            if (!active.run) this.openingId ??= this.id();
                            const run =
                                active.run ??
                                (await api.start(this.openingId!));
                            this.openingId = undefined;
                            this.state = new RunState(api, run, () =>
                                this.id(),
                            );
                            this.showGame();
                        }),
                    claim: async () =>
                        this.work(async () => {
                            let reward: Awaited<
                                ReturnType<GameApi["claimAnimal"]>
                            >;
                            try {
                                reward = await api.claimAnimal(
                                    this.animalClaimRun!,
                                );
                            } catch (error) {
                                draw();
                                throw error;
                            }
                            this.animalClaimRun = undefined;
                            try {
                                await this.home();
                            } catch {
                                draw();
                                this.showNotice(
                                    "已领取，动物园刷新失败",
                                    "动物奖励已确认，请重试刷新",
                                    () => void this.work(() => this.home()),
                                    "刷新动物园",
                                );
                                return;
                            }
                            this.showNotice(
                                "带一位朋友回家",
                                reward.animal.name +
                                    " · 已获得 " +
                                    reward.receivedCount +
                                    " 次",
                            );
                        }),
                    collection: () =>
                        void this.work(async () => {
                            const data = await api.collection();
                            this.showCollection(data.items);
                        }),
                    rank: () => this.showRank(),
                    share: this.share("来看看我的动物园"),
                    page: (next) => {
                        this.homePage = next;
                        draw();
                    },
                },
            );
            this.homePage = rendered.page;
        };
        draw();
    }

    private showGame() {
        const run = this.state!.snapshot;
        const page = this.clear("game");
        const top = view.getVisibleSize().height / 2 - this.topInset;
        const bottom = -view.getVisibleSize().height / 2 + this.bottomInset;
        const titleY = top - 75;
        const toolY = bottom + 112;
        const slotY = toolY + 158;
        const hasTemporary = run.temporaryCardIds.length > 0;
        const stashY = slotY + (hasTemporary ? 212 : 145);
        const teaching = run.level === 1 && run.questionIndex === 0;
        const boardTop = titleY - (teaching ? 270 : 220);
        const boardBottom = stashY + (hasTemporary ? 105 : 35);
        const boardHeight = Math.max(280, boardTop - boardBottom);
        const current = run.questions[run.questionIndex];
        const next = run.questions[run.questionIndex + 1];
        this.label(
            page,
            "第 " +
                run.level +
                " 关 · " +
                Math.min(run.questionIndex + 1, run.questions.length) +
                "/" +
                run.questions.length,
            0,
            titleY,
        );
        this.button(page, "设置", -294, titleY, 102, 62, () => this.settings());
        this.panel(page, 0, titleY - 91, 680, 100, cream);
        this.label(
            page,
            current
                ? "眼 " + current.eyes + " · 腿 " + current.legs
                : "本关已结束",
            0,
            titleY - 91,
            650,
            74,
            47,
        );
        this.label(
            page,
            next ? "下一题    眼 " + next.eyes + " · 腿 " + next.legs : "",
            0,
            titleY - 169,
            650,
            52,
            23,
        );
        if (teaching)
            this.label(
                page,
                "点选动物入槽，眼睛和腿数同时满足即可消除",
                0,
                titleY - 220,
                690,
                36,
                24,
            );
        this.board(page, run, (boardTop + boardBottom) / 2, boardHeight);
        this.label(
            page,
            hasTemporary
                ? "暂存区 " +
                      run.temporaryCardIds.length +
                      " 张 · 底牌归位后可免费复位"
                : "暂存区为空 · 移出后可免费复位",
            0,
            stashY + (hasTemporary ? 73 : 0),
            650,
            45,
            22,
        );
        if (hasTemporary) this.stash(page, run, stashY);
        const slot = run.slotCardIds.map((id) =>
            run.cards.find((card) => card.id === id)!,
        );
        this.label(
            page,
            "卡槽 " +
                slot.length +
                "/7    眼 " +
                slot.reduce((n, c) => n + c.eyes, 0) +
                " · 腿 " +
                slot.reduce((n, c) => n + c.legs, 0),
            0,
            slotY + 93,
            650,
            46,
            25,
        );
        for (let i = 0; i < 7; i++) {
            const card = slot[i];
            const x = (i - 3) * 96;
            const slotTile = this.button(
                page,
                "",
                x,
                slotY,
                92,
                112,
                this.selecting && card
                    ? () => {
                          if (this.selected.has(card.id))
                              this.selected.delete(card.id);
                          else if (this.selected.size < 3)
                              this.selected.add(card.id);
                          this.showGame();
                      }
                    : undefined,
                card && this.selected.has(card.id) ? gold : cream,
            );
            slotTile.name = "slot-" + i;
            const slotSkin = slotTile.getChildByName("Skin");
            if (slotSkin) slotSkin.destroy();
            if (card) {
                const face = this.mahjong(
                    slotTile,
                    run,
                    card,
                    0,
                    0,
                    90,
                    true,
                    this.selected.has(card.id),
                );
                face.setSiblingIndex(slotTile.children.length - 1);
            }
        }

        if (this.selecting) {
            this.button(page, "取消", -210, toolY, 215, 76, () => {
                this.selecting = false;
                this.selected.clear();
                this.showGame();
            });
            this.button(
                page,
                "移出 " + this.selected.size + " 张",
                115,
                toolY,
                360,
                76,
                this.selected.size
                    ? () => {
                          const selectedCardIds = Array.from(this.selected);
                          this.selecting = false;
                          this.selected.clear();
                          this.submit({
                              type: "USE_PROP",
                              propType: "REMOVE",
                              selectedCardIds,
                          });
                      }
                    : undefined,
                gold,
            );
        } else
            props.forEach((prop, i) => {
                const amount = [
                    ...run.inventory.inRun,
                    ...run.inventory.reserve,
                ]
                    .filter((entry) => entry.propType === prop)
                    .reduce((n, entry) => n + entry.quantity, 0);
                const tool = this.button(
                    page,
                    run.level === 1
                        ? names[prop] + "\n第二关开放"
                        : names[prop] + " " + amount,
                    (i - 1) * 228,
                    toolY,
                    213,
                    110,
                    run.level === 2 &&
                        run.status === "ACTIVE" &&
                        !this.state!.pending
                        ? () => {
                              if (!amount) {
                                  this.showNotice(
                                      names[prop],
                                      descriptions[prop] +
                                          "\n视频领奖能力尚未配置",
                                  );
                                  return;
                              }
                              if (prop === "REMOVE") {
                                  if (!slot.length) {
                                      this.showNotice("移出", "卡槽为空");
                                      return;
                                  }
                                  this.selecting = true;
                                  this.selected.clear();
                                  this.showGame();
                              } else
                                  this.showNotice(
                                      names[prop],
                                      descriptions[prop],
                                      () =>
                                          this.submit({
                                              type: "USE_PROP",
                                              propType: prop,
                                          }),
                                  );
                          }
                        : undefined,
                );
                const icon = this.point(tool, "Tool icon", -66, 0, 64, 64);
                skin(icon, "ui-atlas", 13 + i);
                const caption = tool.getChildByName("Text")!;
                caption.setPosition(30, 0);
                caption.getComponent(UITransform)!.setContentSize(130, 95);
                caption.getComponent(Label)!.fontSize = 23;
            });
        if (this.message)
            this.label(page, this.message, 0, toolY - 82, 688, 46, 23);
        if (this.lostSession)
            this.button(
                page,
                "重新连接",
                0,
                0,
                420,
                83,
                () => void this.work(() => this.connect()),
                gold,
            );
        else if (this.state!.pending)
            this.button(
                page,
                "确认上一步",
                0,
                0,
                420,
                83,
                () => void this.work(() => this.retryOperation()),
                gold,
            );
        else if (run.status === "LEVEL_1_PASSED")
            this.showNotice(
                "第一关完成",
                "第二关 48 张牌 · 12 题",
                () => this.submit({ type: "ENTER_LEVEL_2" }),
                "进入第二关",
            );
        else if (run.status === "WON" || run.status === "LOST") this.result();
    }

    private mahjong(
        parent: Node,
        run: RunSnapshot,
        card: Card,
        x: number,
        y: number,
        size: number,
        open: boolean,
        selected = false,
    ) {
        const tile = this.point(parent, card.id, x, y, size - 6, size * 1.03);
        const w = size - 6;
        const h = size * 1.03;
        const drawing = tile.addComponent(Graphics);
        const rectangle = (dx: number, dy: number, color: string) => {
            drawing.fillColor = new Color().fromHEX(color);
            drawing.roundRect(-w / 2 + dx, -h / 2 + dy, w, h, 10);
            drawing.fill();
        };
        rectangle(5, -12, "#223a2455");
        rectangle(0, -9, open ? "#347f58" : "#496351");
        rectangle(0, -4, open ? "#cfbf8e" : "#8b8d79");
        rectangle(0, 0, open ? "#fff9e6" : "#b7baa5");
        drawing.lineWidth = selected ? 5 : 2;
        drawing.strokeColor = new Color().fromHEX(
            selected ? "#ffb625" : "#cfbb83",
        );
        drawing.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 8);
        drawing.stroke();
        drawing.strokeColor = new Color().fromHEX(open ? "#ffffff" : "#ced0bf");
        drawing.lineWidth = 3;
        drawing.moveTo(-w / 2 + 10, h / 2 - 5);
        drawing.lineTo(w / 2 - 10, h / 2 - 5);
        drawing.stroke();
        this.picture(
            tile,
            run.animals.find((animal) => animal.id === card.animalId)!
                .artworkKey,
            0,
            size * 0.12,
            size * 0.68,
        );
        this.label(
            tile,
            card.eyes + "眼 " + card.legs + "腿",
            0,
            -size * 0.31,
            w - 4,
            size * 0.29,
            Math.min(27, size * 0.25),
        );
        if (selected) this.label(tile, "✓", w / 2 - 13, h / 2 - 13, 28, 28, 25);
        return tile;
    }

    private board(page: Node, run: RunSnapshot, y: number, height: number) {
        const board = this.point(page, "Board", 0, y, 700, height);
        const layout = layoutBoard(run.cards, 686, height - 25);
        const key = run.runId + ":" + run.level;
        const entering = key !== this.dealtKey;
        if (entering) {
            this.dealtKey = key;
            this.dealingUntil = Date.now() + 1000;
        }
        const cards = run.cards
            .filter((card) => run.boardCardIds.includes(card.id))
            .sort((a, b) => a.layer - b.layer);
        const placements = new Map<
            string,
            { x: number; y: number; size: number }
        >();
        cards.forEach((card, index) => {
            const open = canPick(run, card.id);
            const position = layout.positions.get(card.id)!;
            const tile = this.mahjong(
                board,
                run,
                card,
                position.x,
                position.y,
                layout.size,
                open,
            );
            const previous = this.boardPlacements.get(card.id);
            placements.set(card.id, {
                x: position.x,
                y: position.y + y,
                size: layout.size,
            });
            if (entering) deal(tile, index);
            else if (
                previous &&
                (previous.x !== position.x ||
                    previous.y !== position.y + y ||
                    previous.size !== layout.size)
            ) {
                tile.setPosition(previous.x, previous.y - y);
                tile.setScale(
                    previous.size / layout.size,
                    previous.size / layout.size,
                    1,
                );
                tween(tile)
                    .to(
                        0.24,
                        {
                            position: new Vec3(position.x, position.y, 0),
                            scale: Vec3.ONE,
                        },
                        { easing: "quadOut" },
                    )
                    .start();
            }
            tile.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
                event.propagationStopped = true;
                if (
                    !this.foreground ||
                    this.busy ||
                    this.modal ||
                    this.selecting ||
                    this.state?.pending ||
                    Date.now() < this.dealingUntil
                )
                    return;
                if (
                    event
                        .getStartLocation()
                        .subtract(event.getLocation())
                        .length() >= 18
                )
                    return;
                if (open) this.submit({ type: "PICK_BOARD", cardId: card.id });
                else shake(tile);
            });
        });
        this.boardPlacements = placements;
    }

    private stash(page: Node, run: RunSnapshot, y: number) {
        const viewport = this.point(page, "Temporary storage", 0, y, 682, 125);
        viewport.addComponent(Mask);
        const scroller = viewport.addComponent(ScrollView);
        scroller.horizontal = false;
        scroller.vertical = true;
        const full = Math.max(
            125,
            Math.ceil(run.temporaryCardIds.length / 7) * 140,
        );
        const content = this.point(
            viewport,
            "Temporary cards",
            0,
            (125 - full) / 2,
            682,
            full,
        );
        scroller.content = content;
        run.temporaryCardIds.forEach((id, i) => {
            const card = run.cards.find((c) => c.id === id)!;
            const restoration = restorationState(run, id);
            const holder = this.button(
                content,
                "",
                ((i % 7) - 3) * 96,
                full / 2 - 62.5 - Math.floor(i / 7) * 140,
                90,
                105,
                this.selecting || this.state!.pending || run.status !== "ACTIVE"
                    ? undefined
                    : () => {
                          if (restoration.allowed)
                              this.submit({
                                  type: "RESTORE_BOARD",
                                  cardId: id,
                              });
                          else
                              this.showNotice(
                                  "暂时无法复位",
                                  restoration.reason,
                              );
                      },
            );
            holder.name = "temporary-" + id;
            this.mahjong(holder, run, card, 0, 9, 84, restoration.allowed);
            const status = this.label(
                holder,
                restoration.allowed ? "↥ 免费复位" : "等待底牌",
                0,
                -48,
                94,
                24,
                19,
            );
            status.getComponent(Label)!.color = new Color().fromHEX(
                restoration.allowed ? "#26713a" : ink,
            );
        });
    }

    private submit(action: Action) {
        void this.work(async () => {
            this.closeModal();
            const before = this.state!.snapshot;
            const sourceId = "cardId" in action ? action.cardId : undefined;
            let sourcePosition: Vec3 | undefined;
            if (sourceId) {
                const source =
                    this.screen
                        ?.getChildByName("Board")
                        ?.getChildByName(sourceId) ??
                    this.screen
                        ?.getChildByName("Temporary storage")
                        ?.getChildByName("Temporary cards")
                        ?.getChildByName("temporary-" + sourceId);
                if (source)
                    sourcePosition = this.screen!.getComponent(
                        UITransform,
                    )!.convertToNodeSpaceAR(source.worldPosition);
            }
            const removedPositions = new Map<string, Vec3>();
            if (action.type === "USE_PROP" && action.propType === "REMOVE") {
                action.selectedCardIds.forEach((id) => {
                    const slot = this.screen?.getChildByName(
                        "slot-" + before.slotCardIds.indexOf(id),
                    );
                    if (slot) removedPositions.set(id, slot.position.clone());
                });
            }
            await this.state!.submit(action);
            const after = this.state!.snapshot;
            if (after.status === "WON") this.sound("you-win");
            else if (after.status === "LOST") this.sound("defeat");
            else if (action.type === "ENTER_LEVEL_2") this.sound("ready-go");
            else if (after.questionIndex > before.questionIndex)
                this.sound("match-pop");
            if (this.state!.snapshot.status === "ABANDONED") await this.home();
            else {
                this.showGame();
                if (action.type === "RESTORE_BOARD" && sourcePosition) {
                    const destination = this.screen!.getChildByName(
                        "Board",
                    )!.getChildByName(action.cardId)!;
                    // Keep the restored card in its correct z-order throughout the flight.
                    // Drawing the moving duplicate above the board would cover upper cards.
                    Tween.stopAllByTarget(destination);
                    const target = destination.position.clone();
                    const board = destination.parent!;
                    destination.setPosition(
                        sourcePosition.x - board.position.x,
                        sourcePosition.y - board.position.y,
                    );
                    const scale =
                        84 / destination.getComponent(UITransform)!.width;
                    destination.setScale(scale, scale, 1);
                    tween(destination)
                        .to(
                            0.3,
                            { position: target, scale: Vec3.ONE },
                            { easing: "quadInOut" },
                        )
                        .start();
                }
                if (
                    action.type === "PICK_BOARD" &&
                    sourceId &&
                    sourcePosition &&
                    after.slotCardIds.includes(sourceId)
                ) {
                    const slot = this.screen!.getChildByName(
                        "slot-" + after.slotCardIds.indexOf(sourceId),
                    )!;
                    slot.active = false;
                    const card = after.cards.find(
                        (card) => card.id === sourceId,
                    )!;
                    const ghost = this.mahjong(
                        this.screen!,
                        after,
                        card,
                        sourcePosition.x,
                        sourcePosition.y,
                        105,
                        true,
                    );
                    ghost.name = "Flying card";
                    fly(ghost, slot.position.clone(), () => {
                        if (slot.isValid) {
                            slot.active = true;
                            pop(slot);
                        }
                    });
                }
                if (
                    after.questionIndex > before.questionIndex &&
                    after.status === "ACTIVE"
                ) {
                    const slot = this.screen!.getChildByName("slot-3")!;
                    const clearedIds = before.slotCardIds.concat(
                        sourceId ? [sourceId] : [],
                    );
                    clearedIds.forEach((id, index) => {
                        const card = before.cards.find(
                            (card) => card.id === id,
                        )!;
                        const ghost = this.mahjong(
                            this.screen!,
                            before,
                            card,
                            (index - 3) * 96,
                            slot.position.y,
                            88,
                            true,
                        );
                        ghost.name = "Clearing card";
                        tween(ghost)
                            .to(0.18, {
                                position: new Vec3(
                                    (index - 3) * 96,
                                    slot.position.y + 28,
                                ),
                                scale: new Vec3(1.08, 1.08, 1),
                            })
                            .to(0.15, { scale: Vec3.ZERO })
                            .call(() => ghost.destroy())
                            .start();
                    });
                    celebrate(this.screen!, 0, slot.position.y, 14);
                    const banner = this.label(
                        this.screen!,
                        "消除成功！",
                        0,
                        slot.position.y + 100,
                        420,
                        65,
                        38,
                    );
                    pop(banner);
                    this.scheduleOnce(() => {
                        if (banner.isValid) banner.destroy();
                    }, 0.7);
                }
                if (action.type === "USE_PROP") {
                    if (action.propType === "REMOVE") {
                        removedPositions.forEach((position, id) => {
                            const destination = this.screen!.getChildByName(
                                "Temporary storage",
                            )
                                ?.getChildByName("Temporary cards")
                                ?.getChildByName("temporary-" + id);
                            if (!destination) return;
                            const target = this.screen!.getComponent(
                                UITransform,
                            )!.convertToNodeSpaceAR(destination.worldPosition);
                            destination.active = false;
                            const card = after.cards.find(
                                (card) => card.id === id,
                            )!;
                            const ghost = this.mahjong(
                                this.screen!,
                                after,
                                card,
                                position.x,
                                position.y,
                                88,
                                true,
                            );
                            ghost.name = "Removed card";
                            fly(ghost, target, () => {
                                if (destination.isValid) {
                                    destination.active = true;
                                    pop(destination);
                                }
                            });
                        });
                    }
                    if (action.propType === "CORRECT") {
                        this.screen!.getChildByName("Board")?.children.forEach(
                            (tile, index) => {
                                tween(tile)
                                    .delay(index * 0.008)
                                    .by(0.12, { angle: -8 })
                                    .to(0.18, { angle: 0 })
                                    .start();
                            },
                        );
                    }
                    const feedback = this.label(
                        this.screen!,
                        names[action.propType] + "已生效",
                        0,
                        0,
                        420,
                        70,
                        40,
                    );
                    pop(feedback);
                    this.scheduleOnce(() => {
                        if (feedback.isValid) feedback.destroy();
                    }, 0.7);
                }
            }
        });
    }

    private closeModal() {
        this.modal?.destroy();
        this.modal = undefined;
    }

    private overlay(title: string, panelHeight = 650) {
        this.closeModal();
        const shade = this.panel(
            this.screen!,
            0,
            0,
            width,
            view.getVisibleSize().height + 2,
            "#223821bc",
            false,
        );
        shade.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
        });
        this.modal = shade;
        const body = this.panel(shade, 0, 0, 620, panelHeight, cream);
        body.name = "Modal body";
        pop(body);
        const mascot = this.point(
            shade,
            "Panda header",
            0,
            panelHeight / 2 + 35,
            350,
            290,
        );
        skin(mascot, "ui-atlas", title.includes("失败") ? 5 : 4);
        pop(mascot);
        this.label(shade, title, 0, panelHeight / 2 - 51, 540, 80, 38);
        return shade;
    }

    private showNotice(
        title: string,
        body: string,
        confirm?: () => void,
        confirmLabel = "确认",
    ) {
        const panelHeight = body.length > 60 ? 650 : 500;
        const modal = this.overlay(title, panelHeight);
        if (title === "第一关完成") celebrate(modal, 0, 170);
        this.label(modal, body, 0, 25, 540, panelHeight - 340, 30);
        if (confirm)
            this.button(
                modal,
                confirmLabel,
                0,
                -panelHeight / 2 + 155,
                490,
                76,
                confirm,
                gold,
            );
        this.button(modal, "关闭", 0, -panelHeight / 2 + 65, 490, 73, () =>
            this.closeModal(),
        );
    }

    private showList(title: string, entries: string[], empty: string) {
        const modal = this.overlay(title);
        const viewport = this.point(modal, "List viewport", 0, -25, 570, 330);
        viewport.addComponent(Mask);
        const scroll = viewport.addComponent(ScrollView);
        scroll.horizontal = false;
        const full = Math.max(330, entries.length * 58);
        const content = this.point(
            viewport,
            "List content",
            0,
            (330 - full) / 2,
            570,
            full,
        );
        scroll.content = content;
        if (!entries.length) this.label(content, empty, 0, 0, 560);
        entries.forEach((line, index) =>
            this.label(content, line, 0, full / 2 - 29 - index * 58, 550),
        );
        this.button(modal, "关闭", 0, -271, 480, 75, () => this.closeModal());
        return modal;
    }

    private showCollection(
        items: Awaited<ReturnType<GameApi["collection"]>>["items"],
    ) {
        const modal = this.overlay("动物图鉴");
        const viewport = this.point(
            modal,
            "Collection viewport",
            0,
            -5,
            550,
            400,
        );
        viewport.addComponent(Mask);
        const scroll = viewport.addComponent(ScrollView);
        scroll.horizontal = false;
        const full = Math.max(400, Math.ceil(items.length / 3) * 170);
        const content = this.point(
            viewport,
            "Collection content",
            0,
            (400 - full) / 2,
            550,
            full,
        );
        scroll.content = content;
        if (!items.length) this.label(content, "通关后解锁动物", 0, 0, 540);
        items.forEach(({ animal, receivedCount }, index) => {
            const item = this.panel(
                content,
                ((index % 3) - 1) * 180,
                full / 2 - 85 - Math.floor(index / 3) * 170,
                165,
                156,
                cream,
            );
            this.picture(item, animal.artworkKey, 0, 25, 92);
            this.label(item, animal.name, 0, -38, 155, 34, 23);
            this.label(
                item,
                "获得 " + receivedCount + " 次",
                0,
                -65,
                155,
                28,
                20,
            );
        });
        this.button(modal, "关闭", 0, -271, 490, 75, () => this.closeModal());
    }

    private showRank(week = "current") {
        void this.work(async () => {
            const data = await this.api!.rank(week);
            const rows = data.entries.map(
                (entry) =>
                    entry.rank +
                    "  " +
                    entry.displayName +
                    " · " +
                    entry.receivedCount +
                    " 只" +
                    (entry.isSelf ? "（我）" : ""),
            );
            if (data.self && !data.entries.some((entry) => entry.isSelf))
                rows.push("我的排名 " + data.self.rank);
            const modal = this.showList(
                week === "current" ? "本周榜单" : "历史榜单",
                rows,
                "本周暂无排名",
            );
            this.button(
                modal,
                week === "current" ? "上周" : "本周",
                210,
                205,
                130,
                59,
                () => {
                    if (week !== "current") this.showRank();
                    else if (/^\d{4}-\d{2}-\d{2}$/.test(data.weekId))
                        this.showRank(
                            new Date(
                                Date.parse(data.weekId + "T00:00:00Z") -
                                    604800000,
                            )
                                .toISOString()
                                .slice(0, 10),
                        );
                    else
                        this.showNotice(
                            "历史榜单",
                            "当前周期没有可查询的周标识",
                        );
                },
            );
        });
    }

    private settings() {
        const modal = this.overlay("设置");
        for (const [i, key] of (["music", "sfx"] as const).entries()) {
            const y = 140 - i * 89;
            const adjust = (delta: number) => {
                const next =
                    Math.round(
                        Math.min(1, Math.max(0, this.volume(key) + delta)) * 10,
                    ) / 10;
                sys.localStorage.setItem(key + "-volume", String(next));
                if (key === "music") this.music();
                this.settings();
            };
            this.label(
                modal,
                (key === "music" ? "音乐" : "音效") +
                    " " +
                    Math.round(this.volume(key) * 100) +
                    "%",
                0,
                y,
                295,
            );
            this.button(modal, "−", -207, y, 76, 66, () => adjust(-0.1));
            this.button(modal, "+", 207, y, 76, 66, () => adjust(0.1));
        }
        this.button(modal, "隐私与服务", 0, -50, 505, 74, () =>
            this.showNotice("隐私与服务", "正式隐私与客服资料待配置"),
        );
        if (
            this.scene === "game" &&
            this.state &&
            !this.state.pending &&
            ["ACTIVE", "LEVEL_1_PASSED"].includes(this.state.snapshot.status)
        ) {
            this.button(modal, "放弃挑战", 0, -145, 505, 74, () =>
                this.showNotice(
                    "放弃挑战？",
                    "确认后结束本局并返回首页",
                    () => this.submit({ type: "ABANDON" }),
                    "确认放弃",
                ),
            );
        }
        this.button(modal, "返回", 0, -265, 505, 74, () => this.closeModal());
    }

    private result() {
        const run = this.state!.snapshot;
        void this.fetchResult(run);
    }

    private async fetchResult(run: RunSnapshot) {
        const modal = this.overlay("确认结果中");
        this.label(modal, "正在同步本局结果", 0, 0);
        try {
            const data = await this.api!.settle(run.runId);
            if (this.state?.snapshot.runId !== run.runId) return;
            if (data.status === "PENDING") {
                this.showNotice(
                    "确认结果中",
                    "结果尚未确认，稍后重试",
                    () => void this.fetchResult(run),
                    "重试",
                );
                return;
            }
            const won = data.outcome === "WON";
            const result = this.overlay(won ? "本次通关！" : "挑战失败");
            if (won) celebrate(result, 0, 150, 34);
            else shake(result.getChildByName("Modal body")!);
            this.label(
                result,
                won
                    ? "解锁 " +
                          (data.unlockedAnimalIds?.length ?? 0) +
                          " 种动物"
                    : (data.failureReason ?? "卡槽已满，未满足本题"),
                0,
                161,
            );
            if (won && data.animalClaimAvailable) {
                this.animalClaimRun = run.runId;
                this.label(result, "返回首页领取一只动物", 0, 70, 560, 62, 25);
            }
            (won ? (data.reserveChoices ?? []) : [])
                .slice(0, 3)
                .forEach((prop, i) =>
                    this.button(
                        result,
                        names[prop] + " 储备",
                        (i - 1) * 181,
                        -28,
                        172,
                        68,
                        () =>
                            void this.work(async () => {
                                await this.api!.claimReserve(run.runId, prop);
                                await this.fetchResult(run);
                            }),
                    ),
                );
            this.button(
                result,
                "重新挑战",
                0,
                -149,
                505,
                74,
                () =>
                    void this.work(async () => {
                        this.openingId ??= this.id();
                        const snapshot = await this.api!.start(this.openingId);
                        this.openingId = undefined;
                        this.state = new RunState(this.api!, snapshot, () =>
                            this.id(),
                        );
                        this.showGame();
                    }),
                gold,
            );
            this.button(
                result,
                "返回首页",
                0,
                -245,
                505,
                74,
                () => void this.work(() => this.home()),
            );
        } catch {
            if (this.state?.snapshot.runId === run.runId)
                this.showNotice(
                    "结果未确认",
                    "网络中断，请重试原结算",
                    () => void this.fetchResult(run),
                    "重试",
                );
        }
    }
}
