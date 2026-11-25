import {
    _decorator,
    AudioClip,
    AudioSource,
    Color,
    Component,
    Game,
    Graphics,
    Input,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    resources,
    Label,
    Node,
    UITransform,
    tween,
    Tween,
    Vec3,
    game,
    input,
} from "cc";
import {
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

const INK = new Color(26, 59, 47);
const CREAM = new Color(255, 244, 217);
const GOLD = new Color(248, 205, 118);
const PORCELAIN = new Color(249, 250, 239);
const JADE = new Color(38, 131, 73);
const FELT = new Color(17, 68, 55);
const RAIL = new Color(37, 99, 77);

const SLOT_Y = 345;
const SLOT_STEP = 74;
const SLOT_SCALE = 0.65;
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

    private tileFrames = new Map<string, SpriteFrame>();
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
        input.on(Input.EventType.TOUCH_END, this.requestMusic, this);
        input.on(Input.EventType.MOUSE_UP, this.requestMusic, this);
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
        void this.loadArtwork().catch((error: unknown) => {
            if (this.node.isValid)
                this.text(
                    this.node,
                    "美术资源加载失败，请刷新重试",
                    28,
                    CREAM,
                    0,
                    0,
                );
            console.error(error);
        });
    }

    private requestMusic(): void {
        this.musicRequested = true;
        this.syncMusic();
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
        this.toolFrames = Array.from({ length: 3 }, (_, index) =>
            frame(tools, new Rect(index * 160, 0, 160, 160)),
        );
        const background = this.child(this.node, "Table", 0, 0);
        this.image(
            background,
            frame(table, new Rect(0, 0, table.width, table.height)),
            750,
            1334,
        );
        this.showGame();
    }

    private showGame(): void {
        this.text(this.node, "麻将消消", 56, CREAM, 0, 524);
        this.text(this.node, "点亮牌入槽，凑成顺子或刻子", 25, CREAM, 0, 457);
        const tray = this.child(this.node, "Tray", 0, SLOT_Y).addComponent(
            Graphics,
        );
        this.fill(tray, 460, 104, 18, RAIL);
        this.fill(tray, 452, 96, 15, INK);
        for (let index = 0; index < SLOT_CAPACITY; index++) {
            tray.fillColor = FELT;
            tray.roundRect(this.slotPosition(index).x - 32, -43, 64, 86, 8);
            tray.fill();
        }
        this.remaining = this.text(this.node, "", 25, GOLD, 0, 278);
        this.status = this.text(this.node, "", 28, CREAM, 0, -335);

        this.addTool("洗牌", 0, -172, this.shuffle);
        this.addTool("消除", 1, 0, this.clearTray);
        this.addTool("撤回", 2, 172, this.undo);

        const restart = this.child(this.node, "Restart", 0, -555);
        this.panel(restart, 166, 48, 16, RAIL);
        this.text(restart, "重新发牌", 23, CREAM, 0, 0);
        restart.on(Node.EventType.TOUCH_END, () => {
            this.playSound("button");
            this.startRound();
        });

        this.startRound();
    }

    private addTool(
        label: string,
        icon: number,
        x: number,
        action: () => void,
    ): void {
        const button = this.child(this.node, label, x, -423);
        button.addComponent(UITransform).setContentSize(114, 112);
        this.image(
            this.child(button, "Icon", 0, 10),
            this.toolFrames[icon],
            88,
            88,
        );
        this.text(button, label, 27, CREAM, 0, -44);
        button.on(Node.EventType.TOUCH_END, action, this);
    }

    private startRound(): void {
        this.beforePick = undefined;
        this.restoreTiles(deal(), []);
        this.status.string = "点亮牌放入收牌槽";
    }

    private restoreTiles(board: PlacedTile[], tray: PlacedTile[]): void {
        this.clearRound();
        this.round = this.child(this.node, "Round", 0, 0);
        this.busy = false;
        this.finished = false;
        this.board = board.map((tile) => this.makeTile(tile));
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
            this.status.string = "清台成功！";
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
        input.off(Input.EventType.TOUCH_END, this.requestMusic, this);
        input.off(Input.EventType.MOUSE_UP, this.requestMusic, this);
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

    private refreshBoard(): void {
        for (const card of this.board) {
            if (card.node.active) this.drawTile(card, this.isCovered(card));
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
