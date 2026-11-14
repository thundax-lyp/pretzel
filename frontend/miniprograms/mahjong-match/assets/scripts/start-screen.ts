import {
    _decorator,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
} from "cc";
import {
    covers,
    deal,
    hasMatch,
    matchTiles,
    TILE_WIDTH,
    TILE_HEIGHT,
    type PlacedTile,
} from "./round";

const INK = new Color(26, 59, 47);
const CREAM = new Color(255, 244, 217);
const GOLD = new Color(248, 205, 118);
const SHADED = new Color(155, 163, 156);
const PORCELAIN = new Color(255, 255, 245);
const JADE = new Color(46, 108, 86);
const RED = new Color(163, 39, 35);
const BLUE = new Color(31, 52, 94);
const GREEN = new Color(26, 111, 71);
const FELT = new Color(17, 68, 55);
const RAIL = new Color(37, 99, 77);

const PIP_PATTERNS: Readonly<Record<number, readonly number[]>> = {
    1: [4],
    2: [1, 7],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
    7: [0, 2, 3, 4, 5, 6, 8],
    8: [0, 1, 2, 3, 5, 6, 7, 8],
    9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

type BoardTile = {
    tile: PlacedTile;
    labels: Label[];
    node: Node;
    face: Graphics;
    marks: Graphics;
};

@_decorator.ccclass("MahjongStartScreen")
export class MahjongStartScreen extends Component {
    private board: BoardTile[] = [];
    private selected: BoardTile[] = [];
    private status!: Label;
    private remaining!: Label;

    protected start(): void {
        const table = this.child(this.node, "Felt", 0, 28).addComponent(
            Graphics,
        );
        this.fill(table, 570, 538, 34, RAIL);
        this.fill(table, 558, 526, 30, INK);
        this.fill(table, 542, 510, 26, FELT);
        table.strokeColor = RAIL;
        table.lineWidth = 2;
        table.roundRect(-258, -242, 516, 484, 22);
        table.stroke();

        this.text(this.node, "麻将消消", 62, CREAM, 0, 448);
        this.text(
            this.node,
            "同花色连续三张，或三张完全相同",
            26,
            CREAM,
            0,
            370,
        );
        this.text(this.node, "只可选未被压住的牌", 24, CREAM, 0, 329);
        this.remaining = this.text(this.node, "", 25, GOLD, 0, 295);
        this.status = this.text(this.node, "", 28, CREAM, 0, -335);

        const restart = this.child(this.node, "Restart", 0, -440);
        this.text(restart, "重新发牌", 30, INK, 0, 0);
        this.panel(restart, 236, 70, 20, GOLD);
        restart.on(Node.EventType.TOUCH_END, this.startRound, this);

        this.startRound();
    }

    private startRound(): void {
        for (const { node } of this.board) {
            node.active = false;
            node.destroy();
        }
        this.selected = [];
        this.board = deal().map((tile) => this.makeTile(tile));
        this.refreshBoard();
        this.status.string = "请选择三张牌";
    }

    private makeTile(tile: PlacedTile): BoardTile {
        const node = this.child(this.node, "Tile", tile.x, tile.y);
        node.addComponent(UITransform).setContentSize(TILE_WIDTH, TILE_HEIGHT);
        const face = node.addComponent(Graphics);
        const marks = this.child(node, "SuitMarks", 0, 4).addComponent(
            Graphics,
        );
        const labels: Label[] = [];
        if (tile.suit === "字") {
            labels.push(this.text(node, "發", 56, GREEN, 0, 4));
        } else if (tile.suit === "万") {
            labels.push(
                this.text(
                    node,
                    "一二三四五六七八九"[tile.rank - 1],
                    40,
                    BLUE,
                    0,
                    26,
                ),
                this.text(node, "萬", 38, RED, 0, -23),
            );
        }

        const card = { tile, node, face, labels, marks };
        node.on(Node.EventType.TOUCH_END, () => this.select(card));
        return card;
    }

    private isCovered(card: BoardTile): boolean {
        return this.board.some(
            ({ node, tile }) => node.active && covers(tile, card.tile),
        );
    }

    private select(card: BoardTile): void {
        if (this.isCovered(card)) {
            this.status.string = "这张牌被压住了，先消上面的牌";
            return;
        }

        const previous = this.selected.indexOf(card);
        if (previous >= 0) {
            this.selected.splice(previous, 1);
            this.drawTile(card, false);
        } else {
            this.selected.push(card);
            this.drawTile(card, true);
        }

        if (this.selected.length < 3) {
            this.status.string = this.selected.length
                ? `已选 ${this.selected.length} / 3`
                : "请选择三张牌";
            return;
        }

        const [first, second, third] = this.selected;
        const match = matchTiles(first.tile, second.tile, third.tile);
        if (!match) {
            for (const tile of this.selected) this.drawTile(tile, false);
            this.selected = [];
            this.status.string = "这三张凑不成牌型，再试一次";
            return;
        }

        for (const { node } of this.selected) node.active = false;
        this.selected = [];
        const remaining = this.board.filter(({ node }) => node.active);
        this.refreshBoard();
        if (remaining.length === 0) {
            this.status.string = "清台成功！";
        } else if (
            !hasMatch(
                remaining
                    .filter((card) => !this.isCovered(card))
                    .map(({ tile }) => tile),
            )
        ) {
            this.status.string = "露出的牌凑不成组，可以重新发牌";
        } else {
            this.status.string = `${match}！消掉三张`;
        }
    }

    private refreshBoard(): void {
        for (const card of this.board) {
            if (card.node.active)
                this.drawTile(card, false, this.isCovered(card));
        }
        const count = this.board.filter(({ node }) => node.active).length;
        this.remaining.string = `剩余 ${count} 张`;
    }

    private drawTile(
        { face, labels, marks, tile }: BoardTile,
        selected: boolean,
        covered = false,
    ): void {
        for (const [index, label] of labels.entries()) {
            label.color = covered
                ? INK
                : tile.suit === "字"
                  ? GREEN
                  : index === 0
                    ? BLUE
                    : RED;
        }

        face.clear();
        this.fill(face, TILE_WIDTH, TILE_HEIGHT, 12, INK);
        this.fill(face, 90, 124, 10, selected ? GOLD : covered ? INK : JADE, 2);
        this.fill(face, 86, 114, 9, covered ? SHADED : PORCELAIN, 6);
        if (selected) {
            face.strokeColor = GOLD;
            face.lineWidth = 4;
            face.roundRect(-42, -50, 84, 112, 9);
            face.stroke();
        }

        marks.clear();
        if (tile.suit !== "筒" && tile.suit !== "条") return;
        for (const position of PIP_PATTERNS[tile.rank]) {
            const x = ((position % 3) - 1) * 23;
            const y = (1 - Math.floor(position / 3)) * 30;
            const color = covered
                ? INK
                : position === 4
                  ? RED
                  : tile.suit === "筒"
                    ? BLUE
                    : GREEN;
            if (tile.suit === "筒") {
                marks.strokeColor = color;
                marks.lineWidth = 2;
                marks.circle(x, y, 9);
                marks.stroke();
                marks.fillColor = color;
                marks.circle(x, y, 4);
                marks.fill();
            } else {
                marks.fillColor = color;
                for (const offset of [-7, 0, 7]) {
                    marks.roundRect(x - 3, y + offset - 4, 6, 8, 2);
                    marks.fill();
                }
            }
        }
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
