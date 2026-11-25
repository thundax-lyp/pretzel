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
    Texture2D,
    resources,
    Label,
    Node,
    UITransform,
    UIOpacity,
    tween,
    Tween,
    Vec3,
    game,
    sys,
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

const INK = new Color(33, 47, 32);
const CREAM = new Color(255, 245, 222);
const GOLD = new Color(235, 194, 106);
const PORCELAIN = new Color(249, 250, 239);
const JADE = new Color(38, 131, 73);
const FELT = new Color(51, 71, 44);
const TABLE_FELT = new Color(61, 79, 51);
const VERMILION = new Color(156, 62, 48);
const RAIL = new Color(75, 93, 61);

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

const SLOT_Y = 431;
const SLOT_STEP = 76;
const SLOT_SCALE = 0.79;
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
    private launchTitleFallback!: Label;
    private launchButton!: Node;
    private launchLabel!: Label;
    private launchStatus!: Label;
    private table!: Node;
    private tools!: Node;
    private restartLabel!: Label;
    private tutorialEnd!: Node;
    private launchState: "loading" | "ready" | "error" | "entering" = "loading";
    private teaching = false;
    private nextLayout = Math.floor(Math.random() * BOARD_LAYOUT_COUNT);

    private tileFrames = new Map<string, SpriteFrame>();
    private titleFrame!: SpriteFrame;
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
        this.music.volume = 0.24;
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
        this.panel(this.launch, 1000, 1800, 0, FELT);
        this.launch.addComponent(BlockInputEvents);

        const emblem = this.child(this.launch, "Emblem", 0, 237);
        this.panel(emblem, 128, 146, 22, VERMILION);
        this.fill(emblem.getComponent(Graphics)!, 120, 138, 19, GOLD, 2);
        this.fill(emblem.getComponent(Graphics)!, 110, 128, 15, PORCELAIN, 3);
        this.text(emblem, "發", 72, JADE, 0, 5);

        this.launchTitleFallback = this.text(
            this.launch,
            "麻将消消",
            76,
            CREAM,
            0,
            94,
        );
        this.launchStatus = this.text(this.launch, "", 25, CREAM, 0, -190);
        const button = this.action(this.launch, "Start", "加载中…", -99, () =>
            this.activateLaunch(),
        );
        this.launchButton = button.node;
        this.launchLabel = button.label;
    }

    private async prepareTable(): Promise<void> {
        this.launchState = "loading";
        this.launchLabel.string = "加载中…";
        this.launchStatus.string = "";
        const opacity =
            this.launchButton.getComponent(UIOpacity) ??
            this.launchButton.addComponent(UIOpacity);
        opacity.opacity = 130;
        try {
            await this.loadArtwork();
            if (!this.isValid) return;
            this.teaching = sys.localStorage.getItem(TUTORIAL_DONE) !== "1";
            this.launchState = "ready";
            this.launchLabel.string = this.teaching ? "开始教学" : "开始挑战";
        } catch (error) {
            if (!this.isValid) return;
            this.launchState = "error";
            this.launchLabel.string = "重试";
            this.launchStatus.string = "牌桌资源加载失败";
            console.error(error);
        }
        opacity.opacity = 255;
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
        const launchOpacity = this.launch.addComponent(UIOpacity);
        const tableOpacity = this.table.getComponent(UIOpacity)!;
        tween(launchOpacity)
            .to(0.26, { opacity: 0 }, { easing: "quadOut" })
            .start();
        tween(tableOpacity)
            .to(0.36, { opacity: 255 }, { easing: "quadOut" })
            .call(() => {
                this.launch.destroy();
                this.busy = false;
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
        if (clip) this.audio.playOneShot(clip);
    }

    private async loadArtwork(): Promise<void> {
        const [table, tools, ...tiles] = await Promise.all([
            loadTexture("table"),
            loadTexture("tools"),
            ...FACE_FILES.map((name) => loadTexture(`tiles/${name}`)),
        ]);
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
        this.titleFrame = frame(tools, new Rect(195, 0, 570, 156));
        this.image(
            this.child(this.launch, "TitleArt", 0, 94),
            this.titleFrame,
            370,
            101,
        );
        this.launchTitleFallback.node.active = false;
        this.toolFrames = Array.from({ length: 3 }, (_, index) =>
            frame(tools, new Rect(index * 320, 156, 320, 220)),
        );
        this.table = this.child(this.node, "GameView", 0, 0);
        this.table.active = false;
        this.table.addComponent(UIOpacity).opacity = 0;
        this.launch.setSiblingIndex(this.node.children.length - 1);
        const felt = this.child(this.table, "Felt", 0, 0);
        this.panel(felt, 1000, 1800, 0, TABLE_FELT);
        const background = this.child(this.table, "Table", 0, 0);
        const texture = this.image(
            background,
            frame(table, new Rect(0, 0, table.width, table.height)),
            750,
            1620,
        );
        texture.color = new Color(230, 217, 165, 72);
        this.showGame();
    }

    private showGame(): void {
        this.image(
            this.child(this.table, "TitleArt", 0, 584),
            this.titleFrame,
            320,
            88,
        );
        const tray = this.child(this.table, "Tray", 0, SLOT_Y).addComponent(
            Graphics,
        );
        this.fill(tray, 480, 116, 18, RAIL);
        this.fill(tray, 472, 108, 15, INK);
        for (let index = 0; index < SLOT_CAPACITY; index++) {
            tray.fillColor = FELT;
            tray.roundRect(this.slotPosition(index).x - 35, -49, 70, 98, 8);
            tray.fill();
        }
        this.remaining = this.text(this.table, "", 25, GOLD, 0, 356);
        this.status = this.text(this.table, "", 28, CREAM, 0, -357);

        this.tools = this.child(this.table, "Tools", 0, 0);
        this.addTool("Shuffle", 0, -174, this.shuffle);
        this.addTool("Remove", 1, 0, this.clearTray);
        this.addTool("Undo", 2, 174, this.undo);

        const restart = this.child(this.table, "Restart", 0, -440);
        this.panel(restart, 166, 48, 16, RAIL);
        this.restartLabel = this.text(restart, "重新发牌", 23, CREAM, 0, 0);
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
        const button = this.child(this.tools, label, x, -578);
        this.image(button, this.toolFrames[icon], 150, 103);
        button.on(Node.EventType.TOUCH_END, action, this);
    }

    private startRound(): void {
        this.beforePick = undefined;
        this.tools.active = !this.teaching;
        this.restartLabel.string = this.teaching ? "重新教学" : "重新发牌";
        this.restartLabel.node.parent!.active = true;
        this.tutorialEnd.active = false;
        this.restoreTiles(
            this.teaching
                ? TUTORIAL_BOARD
                : deal(this.nextLayout++ % BOARD_LAYOUT_COUNT),
            [],
        );
        this.status.string = this.teaching
            ? "先取上层三张万字牌，组成顺子"
            : "点亮牌放入收牌槽";
    }

    private restoreTiles(board: PlacedTile[], tray: PlacedTile[]): void {
        this.clearRound();
        this.round = this.child(this.table, "Round", 0, 0);
        this.busy = false;
        this.finished = false;
        this.board = [...board]
            .sort((a, b) => a.layer - b.layer || b.y - a.y || a.x - b.x)
            .map((tile) => this.makeTile(tile));
        this.tray = tray.map((tile, index) => {
            const card = this.makeTile(tile);
            card.node.setPosition(this.slotPosition(index));
            card.node.setScale(SLOT_SCALE, SLOT_SCALE, 1);
            this.drawTile(card, false);
            return card;
        });
        this.refreshBoard();
    }

    private shuffle(): void {
        if (this.busy) return;
        if (this.board.length < 2 || this.tray.length === SLOT_CAPACITY) {
            this.playSound("button");
            this.status.string =
                this.tray.length === SLOT_CAPACITY
                    ? "槽满了，先消除或撤回"
                    : "牌山里没有足够的牌可洗";
            return;
        }
        this.beforePick = undefined;
        this.restoreTiles(
            shuffleBoard(this.board.map(({ tile }) => tile)),
            this.tray.map(({ tile }) => tile),
        );
        this.status.string = "已洗牌，槽内牌保留";
        this.playSound("shuffle");
    }

    private clearTray(): void {
        if (this.busy) return;
        if (this.tray.length === 0) {
            this.playSound("button");
            this.status.string = "收牌槽是空的";
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
            this.status.string = "没有可撤回的取牌";
            return;
        }
        this.beforePick = undefined;
        this.restoreTiles(previous.board, previous.tray);
        this.status.string = "已撤回上一次取牌";
    }

    private makeTile(tile: PlacedTile): BoardTile {
        const node = this.child(this.round, "Tile", tile.x, tile.y);
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
            this.status.string = "这张牌被压住了";
            return;
        }

        const expected = this.tutorialSuit();
        if (expected && card.tile.suit !== expected) {
            this.status.string =
                expected === "万" ? "先取上层的万字牌" : "试试取露出的 5 筒";
            return;
        }
        this.beforePick = {
            board: this.board.map(({ tile }) => tile),
            tray: this.tray.map(({ tile }) => tile),
        };
        this.busy = true;
        this.board = this.board.filter((tile) => tile !== card);
        this.tray.push(card);
        card.node.setSiblingIndex(this.round.children.length - 1);
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
                : `收牌槽 ${this.tray.length} / ${SLOT_CAPACITY}`,
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
            this.status.string = "剩余牌面无解，已刷新牌山，槽内牌保留";
            this.playSound("shuffle");
        } else {
            this.status.string = message;
        }
        this.refreshBoard();
        const cleared = this.board.length === 0 && this.tray.length === 0;
        if (cleared) {
            this.finished = true;
            this.status.string = this.teaching ? "教学完成" : "清台成功！";
            if (this.teaching) {
                sys.localStorage.setItem(TUTORIAL_DONE, "1");
                this.restartLabel.node.parent!.active = false;
                this.tutorialEnd.active = true;
                this.tutorialEnd.setSiblingIndex(
                    this.table.children.length - 1,
                );
            }
            this.playSound("clear");
        } else if (
            this.tray.length === SLOT_CAPACITY ||
            this.board.length === 0
        ) {
            this.finished = true;
            this.status.string = this.board.length
                ? "收牌槽满了，可消除或撤回"
                : "槽里还有散牌，可消除或撤回";
        }
        if (removedTiles && !cleared && !refreshed) {
            if (this.teaching)
                this.status.string = this.board.some(
                    ({ tile }) => tile.suit === "筒",
                )
                    ? "顺子！现在取露出的三张 5 筒"
                    : message + "，剩下的牌可以自由清除";
            this.playSound("match");
        }
        this.busy = false;
    }

    private slotPosition(index: number): Vec3 {
        return new Vec3(
            (index - (SLOT_CAPACITY - 1) / 2) * SLOT_STEP,
            SLOT_Y,
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
        game.off(Game.EVENT_HIDE, this.pauseMusic, this);
        game.off(Game.EVENT_SHOW, this.resumeMusic, this);
        this.music?.stop();
        this.clearRound();
    }

    private clearRound(): void {
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
        sprite.color = covered ? new Color(133, 142, 137) : Color.WHITE;
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
