export const GROUPS = ["A", "B", "C"] as const;
export const PROPS = ["undo", "peek", "remove", "shuffle"] as const;
export const INITIAL_SLOTS = 5;
export const SLOT_LIMIT = 7;
export const FULL_EXPOSURE = 0b1111;

export type Group = (typeof GROUPS)[number];
export type Prop = (typeof PROPS)[number];
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
    status: "playing" | "won" | "lost" = "playing";
    moves = 0;
    firstMatchAt: number | "prop" | null = null;
    private readonly onBoard: Set<number>;
    private readonly revealed = new Set<number>();
    private readonly usedProps = new Set<Prop>();
    private board: readonly Card[];
    private slotted: Card[] = [];
    private capacity = INITIAL_SLOTS;
    private lastTaken: Card | null = null;
    private readonly random: () => number;

    constructor(
        level: Level,
        group: Group,
        boardKinds?: readonly number[],
        random = Math.random,
    ) {
        this.level = level;
        this.group = group;
        this.random = random;
        this.board =
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

    get cards(): readonly Card[] {
        return this.board;
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

    canUse(prop: Prop): boolean {
        if (
            this.level !== 2 ||
            this.status !== "playing" ||
            this.usedProps.has(prop)
        ) {
            return false;
        }
        if (prop === "undo") return this.lastTaken !== null;
        if (prop === "remove") return this.slotted.length > 0;
        return true;
    }

    use(prop: Prop): boolean {
        if (!this.canUse(prop)) return false;
        switch (prop) {
            case "undo": {
                const card = this.lastTaken!;
                this.slotted.pop();
                this.onBoard.add(card.id);
                this.revealed.add(card.id);
                this.lastTaken = null;
                break;
            }
            case "peek": {
                const hidden = this.topCards().filter(
                    (card) => !this.isFaceUp(card),
                );
                if (hidden.length === 0) return false;
                const count = Math.min(3, hidden.length);
                for (let index = 0; index < count; index += 1) {
                    const picked = Math.floor(this.random() * hidden.length);
                    const [card] = hidden.splice(picked, 1);
                    this.revealed.add(card.id);
                }
                break;
            }
            case "remove": {
                const group = this.findRemovableGroup();
                if (!group) return false;
                for (const card of group.cards) this.onBoard.delete(card.id);
                this.slotted = this.slotted.filter(
                    (card) => card.kind !== group.kind,
                );
                if (this.lastTaken?.kind === group.kind) {
                    this.lastTaken = null;
                }
                this.firstMatchAt ??= "prop";
                if (this.remaining === 0) this.status = "won";
                break;
            }
            case "shuffle":
                if (!this.shuffleBoard()) return false;
                break;
        }
        this.usedProps.add(prop);
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
        this.lastTaken = matching < 3 ? card : null;
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

    private topCards(): Card[] {
        for (let layer = 2; layer >= 0; layer -= 1) {
            const cards = this.cards.filter(
                (card) => card.layer === layer && this.isOnBoard(card),
            );
            if (cards.length > 0) return cards;
        }
        return [];
    }

    private shuffleBoard(): boolean {
        // Reserved kinds have exactly three copies in the original deal.
        const dealtCounts = new Array<number>(16).fill(0);
        for (const card of this.cards) dealtCounts[card.kind] += 1;
        const movable = this.cards.filter(
            (card) => this.isOnBoard(card) && dealtCounts[card.kind] > 3,
        );
        if (new Set(movable.map((card) => card.kind)).size < 2) return false;

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const shuffled = [...movable];
            for (let index = shuffled.length - 1; index > 0; index -= 1) {
                const picked = Math.floor(this.random() * (index + 1));
                [shuffled[index], shuffled[picked]] = [
                    shuffled[picked],
                    shuffled[index],
                ];
            }
            if (
                movable.every(
                    (card, index) => card.kind === shuffled[index].kind,
                )
            )
                continue;
            const kinds = this.cards.map((card) => card.kind);
            movable.forEach((card, index) => {
                kinds[card.id] = shuffled[index].kind;
            });
            const proof = new Round(2, "B", kinds);
            proof.capacity = this.capacity;
            proof.slotted = [...this.slotted];
            for (const card of proof.cards) {
                if (!this.isOnBoard(card)) proof.onBoard.delete(card.id);
            }
            if (!proof.replayClear()) continue;

            const previouslyRevealed = new Set(this.revealed);
            movable.forEach((card, index) => {
                this.revealed.delete(card.id);
                if (previouslyRevealed.has(shuffled[index].id))
                    this.revealed.add(card.id);
            });
            this.board = proof.cards;
            return true;
        }
        return false;
    }

    // Accept a shuffle only if actual take() calls can clear the resulting
    // state with its current slot limit, no unlocks and no extra props.
    private replayClear(): boolean {
        while (this.status === "playing") {
            const available = this.cards.filter(
                (card) =>
                    this.isOnBoard(card) &&
                    this.isSelectable(this.exposure(card)),
            );
            if (available.length === 0) return false;
            const held = new Array<number>(16).fill(0);
            const shown = new Array<number>(16).fill(0);
            for (const card of this.slotted) held[card.kind] += 1;
            for (const card of available) shown[card.kind] += 1;
            let best = available[0];
            let bestScore = -1;
            for (const card of available) {
                const inSlot = held[card.kind];
                const free = shown[card.kind];
                let score = free;
                if (inSlot === 2) score = 100;
                else if (inSlot + free >= 3) score = 60 + inSlot;
                else if (inSlot === 1 || free === 2) score = 30 + inSlot;
                if (score > bestScore) {
                    best = card;
                    bestScore = score;
                }
            }
            if (this.take(best.id) === null) return false;
        }
        return this.status === "won";
    }

    private findRemovableGroup(): { kind: number; cards: Card[] } | undefined {
        const top = this.topCards();
        let best: { kind: number; cards: Card[] } | undefined;
        let bestHeld = 0;
        for (const { kind } of this.slotted) {
            const held = this.slotted.filter(
                (card) => card.kind === kind,
            ).length;
            if (held <= bestHeld) continue;
            const needed = 3 - held;
            const cards = top.filter((card) => card.kind === kind);
            if (cards.length >= needed) {
                best = { kind, cards: cards.slice(0, needed) };
                bestHeld = held;
            }
        }
        return best;
    }
}
