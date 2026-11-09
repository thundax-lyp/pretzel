import {
    _decorator,
    Component,
    Graphics,
    Label,
    Node,
    UITransform,
    Vec3,
    type EventTouch,
} from "cc";
import { CardView, color, label, uiNode } from "./card-view";
import {
    FULL_EXPOSURE,
    GROUPS,
    Round,
    SLOT_LIMIT,
    type Group,
    type Level,
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

interface Control {
    readonly graphic: Graphics;
    readonly caption: Label;
    readonly width: number;
}

@ccclass("FlipZooStartScreen")
export class FlipZooStartScreen extends Component {
    private round!: Round;
    private board?: Node;
    private cardSize = 0;
    private cards: CardView[] = [];
    private readonly slots: CardView[] = [];
    private readonly groupButtons = new Map<Group, Control>();
    private progress!: Label;
    private steps!: Label;
    private slotStatus!: Label;
    private message!: Label;
    private otherLevel!: Control;

    start(): void {
        this.text("翻翻动物园", 608, 58).isBold = true;
        this.text("本地试玩 · 第二关对照", 553, 24, "#A9C9B6");
        GROUPS.forEach((group, index) => {
            const button = this.button(
                GROUP_LABELS[group],
                (index - 1) * 221,
                498,
                208,
                () => this.openRound(2, group),
            );
            this.groupButtons.set(group, button);
        });
        this.progress = this.text("", 435, 30);
        this.steps = this.text("", 400, 23, "#BDD5C7");
        this.slotStatus = this.text("", -405, 26);
        for (let index = 0; index < SLOT_LIMIT; index += 1) {
            const slot = new CardView(this.node, `Slot-${index + 1}`, 78);
            slot.node.setPosition((index - 3) * 94, -464);
            this.slots.push(slot);
        }
        this.message = this.text("", -540, 28);
        this.button("重开本关", -169, -610, 296, () =>
            this.openRound(this.round.level, this.round.group),
        );
        this.otherLevel = this.button("", 169, -610, 296, () =>
            this.openRound(this.round.level === 1 ? 2 : 1, this.round.group),
        );
        this.openRound(1, "A");
    }

    private openRound(level: Level, group: Group): void {
        this.unschedule(this.advanceToMainBoard);
        this.round = new Round(level, group);
        if (this.board) {
            this.board.removeFromParent();
            this.board.destroy();
        }

        this.cardSize = level === 1 ? 94 : 76;
        const width = (level === 1 ? 6 : 8) * this.cardSize;
        const height = (level === 1 ? 6 : 10) * this.cardSize;
        const board = uiNode(this.node, "Board", width, height);
        this.board = board;
        board.on(Node.EventType.TOUCH_END, this.onBoardTouch, this);
        this.cards = this.round.cards.map((card) => {
            const view = new CardView(board, `Card-${card.id}`, this.cardSize);
            view.node.setPosition(
                (card.left + 0.5) * this.cardSize - width / 2,
                height / 2 - (card.top + 0.5) * this.cardSize,
            );
            return view;
        });

        for (const [key, button] of this.groupButtons) {
            this.paintButton(button, level === 2 && group === key);
        }
        this.otherLevel.caption.string = level === 1 ? "去第二关" : "回第一关";
        this.message.string =
            level === 1 ? "点一张牌入槽，翻开上下左右" : GROUP_HINTS[group];
        this.message.color = color("#F4F7E9");
        this.refresh();
    }

    private advanceToMainBoard(): void {
        this.openRound(2, this.round.group);
    }

    private onBoardTouch(event: EventTouch): void {
        if (!this.board) return;
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

        this.message.color = color("#F4F7E9");
        this.message.string = matched ? "三张同款，已消除！" : "找三张同款";
        if (this.round.status === "lost") {
            this.message.string = "第 7 张未成组 · 本局结束";
            this.message.color = color("#FFB5A3");
        } else if (this.round.status === "won") {
            this.message.string =
                this.round.level === 1
                    ? "第一关清盘，进入第二关"
                    : "第二关清盘！";
            this.message.color = color("#FBE194");
            if (this.round.level === 1) {
                this.scheduleOnce(this.advanceToMainBoard, 0.65);
            }
        }
        this.refresh();
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
            else slot.showEmpty();
        });
        const stage =
            round.level === 1 ? "第 1 关" : `第 2 关 · ${round.group} 组`;
        this.progress.string = `${stage}     剩余 ${round.remaining}/${round.cards.length}`;
        const first =
            round.firstMatchAt === null ? "—" : `第 ${round.firstMatchAt} 张`;
        this.steps.string = `已取 ${round.moves} 张     首消 ${first}`;
        const danger = round.slots.length === SLOT_LIMIT - 1;
        this.slotStatus.string = danger
            ? "卡槽 6/7 · 下一张必须三消"
            : `卡槽 ${round.slots.length}/${SLOT_LIMIT}`;
        this.slotStatus.color = color(danger ? "#FFD297" : "#F4F7E9");
    }

    private text(text: string, y: number, size: number, hex?: string): Label {
        const component = label(this.node, text, size, hex);
        component.node.setPosition(0, y);
        return component;
    }

    private button(
        text: string,
        x: number,
        y: number,
        width: number,
        action: () => void,
    ): Control {
        const node = uiNode(this.node, text || "Other-Level", width, 66);
        node.setPosition(x, y);
        node.on(Node.EventType.TOUCH_END, action);
        const button = {
            graphic: node.addComponent(Graphics),
            caption: label(node, text, 26),
            width,
        };
        this.paintButton(button, false);
        return button;
    }

    private paintButton(button: Control, active: boolean): void {
        const { graphic, caption, width } = button;
        graphic.clear();
        graphic.fillColor = color(active ? "#FBE194" : "#3B6756");
        graphic.roundRect(-width / 2, -33, width, 66, 12);
        graphic.fill();
        caption.color = color(active ? "#203B30" : "#F4F7E9");
    }
}
