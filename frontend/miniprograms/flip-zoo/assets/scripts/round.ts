export const GROUPS = ["A", "B", "C"] as const;
export const INITIAL_SLOTS = 5;
export const SLOT_LIMIT = 7;
export const FULL_EXPOSURE = 0b1111;

export type Group = (typeof GROUPS)[number];
export type Level = 1 | 2;

export interface Card {
    readonly id: number;
    readonly kind: number;
    readonly layer: number;
    readonly x: number;
    readonly y: number;
    readonly left: number;
    readonly top: number;
}

const TUTORIAL = [["338838", "838338", "383883", "838833", "338388", "388833"]];

// Each string is a row of card types. Layers are stored bottom to top.
const MAIN_BOARD = [
    [
        "f199255",
        "bb8213e",
        "886332e",
        "e52261a",
        "619d11d",
        "d7eee55",
        "6696449",
        "444aaa7",
        "7a4aaaa",
    ],
    [
        "0777a68",
        "4c6ac14",
        "a3d1104",
        "c933d0d",
        "4c0c07e",
        "7760096",
        "6399833",
        "288544b",
        "559ee5f",
    ],
    [
        "db3b233",
        "db7922b",
        "77dbe0b",
        "8c881cc",
        "005beec",
        "cc8116b",
        "bd559f9",
        "9d928d9",
        "99022c0",
    ],
];

function buildDeck(layers: string[][]): readonly Card[] {
    const cards: Card[] = [];
    layers.forEach((rows, layer) => {
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x += 1) {
                cards.push({
                    id: cards.length,
                    kind: Number.parseInt(row[x], 16),
                    layer,
                    x,
                    y,
                    left: x + layer / 2,
                    top: y + layer / 2,
                });
            }
        });
    });
    return cards;
}

const TUTORIAL_DECK = buildDeck(TUTORIAL);
const MAIN_DECK = buildDeck(MAIN_BOARD);

export const DEFAULT_BOARD_KINDS: readonly number[] = MAIN_DECK.map(
    (card) => card.kind,
);

export function isBoardKinds(value: unknown): value is number[] {
    if (!Array.isArray(value) || value.length !== MAIN_DECK.length)
        return false;
    const counts = new Array<number>(16).fill(0);
    for (const kind of value) {
        if (!Number.isInteger(kind) || kind < 0 || kind >= counts.length)
            return false;
        counts[kind] += 1;
    }
    return counts.every((count) => count > 0 && count % 3 === 0);
}

export class Round {
    readonly level: Level;
    readonly group: Group;
    readonly cards: readonly Card[];
    status: "playing" | "won" | "lost" = "playing";
    moves = 0;
    firstMatchAt: number | null = null;
    private readonly onBoard: Set<number>;
    private readonly revealed = new Set<number>();
    private slotted: Card[] = [];
    private capacity = INITIAL_SLOTS;

    constructor(level: Level, group: Group, boardKinds?: readonly number[]) {
        this.level = level;
        this.group = group;
        this.cards =
            level === 1
                ? TUTORIAL_DECK
                : boardKinds
                  ? MAIN_DECK.map((card) => ({
                        ...card,
                        kind: boardKinds[card.id],
                    }))
                  : MAIN_DECK;
        this.onBoard = new Set(this.cards.map((card) => card.id));
        if (level === 2 && group === "C") {
            for (const card of this.cards) {
                if (
                    card.layer === 2 &&
                    (card.x === 1 || card.x === 5) &&
                    (card.y === 1 || card.y === 4 || card.y === 7)
                ) {
                    this.revealed.add(card.id);
                }
            }
        }
    }

    get slots(): readonly Card[] {
        return this.slotted;
    }

    get slotCapacity(): number {
        return this.capacity;
    }

    get remaining(): number {
        return this.onBoard.size + this.slotted.length;
    }

    unlockNextSlot(): boolean {
        if (this.status !== "playing" || this.capacity === SLOT_LIMIT) {
            return false;
        }
        this.capacity += 1;
        return true;
    }

    isOnBoard(card: Card): boolean {
        return this.onBoard.has(card.id);
    }

    // Each tile occupies four half-grid cells. Positive overlap covers whole
    // quadrants; tiles touching only along an edge do not overlap.
    exposure(card: Card): number {
        let visible = FULL_EXPOSURE;
        for (const other of this.cards) {
            if (other.layer <= card.layer || !this.isOnBoard(other)) continue;
            const dx = other.left - card.left;
            const dy = other.top - card.top;
            if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) continue;
            const columns = dx < 0 ? 0b0101 : dx > 0 ? 0b1010 : FULL_EXPOSURE;
            const rows = dy < 0 ? 0b0011 : dy > 0 ? 0b1100 : FULL_EXPOSURE;
            visible &= ~(columns & rows);
            if (visible === 0) break;
        }
        return visible;
    }

    isSelectable(exposure: number): boolean {
        return exposure === FULL_EXPOSURE;
    }

    isFaceUp(card: Card, exposure = this.exposure(card)): boolean {
        return this.level === 2 && this.group === "B"
            ? this.isSelectable(exposure)
            : this.revealed.has(card.id);
    }

    cardAt(x: number, y: number): Card | undefined {
        for (let index = this.cards.length - 1; index >= 0; index -= 1) {
            const card = this.cards[index];
            if (
                this.isOnBoard(card) &&
                x >= card.left &&
                x < card.left + 1 &&
                y >= card.top &&
                y < card.top + 1
            ) {
                return card;
            }
        }
        return undefined;
    }

    take(id: number): 0 | 3 | null {
        const card = this.cards[id];
        if (
            this.status !== "playing" ||
            !card ||
            !this.isOnBoard(card) ||
            !this.isSelectable(this.exposure(card))
        ) {
            return null;
        }

        const matching =
            1 + this.slotted.filter((tile) => tile.kind === card.kind).length;
        this.onBoard.delete(id);
        for (const neighbor of this.cards) {
            if (
                this.isOnBoard(neighbor) &&
                neighbor.layer === card.layer &&
                Math.abs(neighbor.x - card.x) +
                    Math.abs(neighbor.y - card.y) ===
                    1
            ) {
                this.revealed.add(neighbor.id);
            }
        }
        this.moves += 1;
        this.slotted.push(card);
        if (matching === 3) {
            this.slotted = this.slotted.filter(
                (tile) => tile.kind !== card.kind,
            );
            this.firstMatchAt ??= this.moves;
        }
        if (this.remaining === 0) {
            this.status = "won";
        } else if (this.slotted.length === this.capacity) {
            this.status = "lost";
        }
        return matching === 3 ? 3 : 0;
    }
}
