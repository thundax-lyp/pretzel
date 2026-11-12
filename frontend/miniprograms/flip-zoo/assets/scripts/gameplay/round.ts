export const GROUPS = ["A", "B", "C"] as const;
export const PROPS = ["undo", "peek", "remove"] as const;
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

export interface SlotClearGroup {
    readonly kind: number;
    readonly heldCount: number;
    readonly boardCards: readonly Card[];
}

const TUTORIAL = [["338838", "838338", "383883", "838833"]];

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

export const MAIN_LAYOUTS = ["pyramid", "double-peak", "triple-peak"] as const;
export type MainLayout = (typeof MAIN_LAYOUTS)[number];

type Footprint = readonly [
    left: number,
    top: number,
    width: number,
    height: number,
];

const PEAKS: Record<MainLayout, readonly (readonly Footprint[])[]> = {
    pyramid: [
        [[0, 0, 7, 9]],
        [[0.5, 0.5, 6, 8]],
        [[1, 1, 5, 7]],
        [[1.5, 1.5, 4, 6]],
        [[2, 2, 3, 5]],
        [[2.5, 3.5, 2, 2]],
    ],
    "double-peak": [
        [[0, 0, 7, 9]],
        [[0, 0.5, 7, 8]],
        [[0, 1, 7, 7]],
        [
            [1, 0.5, 3, 2],
            [3, 6.5, 3, 2],
        ],
        [
            [0.5, 0, 3, 1],
            [3.5, 8, 3, 1],
        ],
        [
            [0, 0.5, 2, 1],
            [6, 8.5, 1, 1],
        ],
    ],
    "triple-peak": [
        [[0, 0, 7, 9]],
        [[0.5, 0, 6, 9]],
        [[1, 1, 6, 7]],
        [
            [1.5, 0.5, 3, 2],
            [3.5, 3.5, 3, 2],
            [1.5, 6.5, 3, 2],
        ],
        [
            [1, 0, 3, 1],
            [4, 4, 3, 1],
            [1, 8, 3, 1],
        ],
        [
            [0.5, 0.5, 1, 1],
            [6.5, 4.5, 1, 1],
            [0.5, 8.5, 1, 1],
        ],
    ],
};

function buildPeakDeck(layout: MainLayout): Card[] {
    const cards: Card[] = [];
    PEAKS[layout].forEach((footprints, layer) => {
        for (const [left, top, width, height] of footprints) {
            for (let row = 0; row < height; row += 1) {
                for (let column = 0; column < width; column += 1) {
                    const x = left + column;
                    const y = top + row;
                    cards.push({
                        id: cards.length,
                        kind: 0,
                        layer,
                        x,
                        y,
                        left: x,
                        top: y,
                    });
                }
            }
        }
    });
    return cards;
}

const PEAK_DECKS = {
    pyramid: buildPeakDeck("pyramid"),
    "double-peak": buildPeakDeck("double-peak"),
    "triple-peak": buildPeakDeck("triple-peak"),
};

export const DEFAULT_BOARD_KINDS: readonly number[] = MAIN_DECK.map(
    (card) => card.kind,
);

function covers(upper: Card, lower: Card): boolean {
    return (
        upper.layer > lower.layer &&
        Math.abs(upper.left - lower.left) < 1 &&
        Math.abs(upper.top - lower.top) < 1
    );
}

export function generateMainBoard(
    random = Math.random,
    previous?: readonly number[],
    layout?: MainLayout,
): { kinds: number[]; clearOrder: number[] } {
    const deck = layout ? PEAK_DECKS[layout] : MAIN_DECK;
    const blockers = deck.map((card) =>
        deck.filter((upper) => covers(upper, card)),
    );
    const keyGroupCount = 2 + Math.floor(random() * 4);
    let bestDeal: ReturnType<typeof dealMainBoard> | undefined;
    let bestScore = -1;
    for (let attempt = 0; attempt < (layout ? 256 : 1); attempt += 1) {
        const deal = dealMainBoard(
            deck,
            blockers,
            keyGroupCount,
            random,
            previous,
            layout,
        );
        if (!layout) return deal;
        const score = peakDiversityScore(layout, deal.kinds);
        if (score <= bestScore || !verifiesPeakDeal(layout, deal)) continue;
        bestDeal = deal;
        bestScore = score;
        if (score === (PEAKS[layout].length - 2) * (16 - keyGroupCount)) break;
    }
    if (bestDeal) return bestDeal;
    throw new Error(`Cannot deal ${layout} with ${keyGroupCount} key groups`);
}

function dealMainBoard(
    deck: readonly Card[],
    blockers: readonly (readonly Card[])[],
    keyGroupCount: number,
    random: () => number,
    previous?: readonly number[],
    layout?: MainLayout,
): { kinds: number[]; clearOrder: number[] } {
    const counts = new Array<number>(16).fill(0);
    for (const kind of DEFAULT_BOARD_KINDS) counts[kind] += 1;
    const reservedKinds = [counts.indexOf(3)];
    const eligible = counts.flatMap((count, kind) => (count > 3 ? [kind] : []));
    while (reservedKinds.length < keyGroupCount) {
        const [kind] = eligible.splice(
            Math.floor(random() * eligible.length),
            1,
        );
        reservedKinds.push(kind);
    }
    for (const kind of reservedKinds.slice(1)) {
        const [recipient] = eligible.splice(
            Math.floor(random() * eligible.length),
            1,
        );
        counts[recipient] += counts[kind] - 3;
        counts[kind] = 3;
    }

    const kinds = new Array<number>(deck.length);
    const reservedGroups: Card[][] = [];
    const alongRows = layout !== undefined || random() < 0.5;
    const mirrored = layout === undefined && random() < 0.5;
    // Separate layers into bands so reserved cards never depend on another
    // reserved card, even through a chain of two overlapping ordinary cards.
    const bands = layout
        ? [
              [0, 1],
              [3, 4],
              [7, 8],
          ]
        : [[0, 1], [3, 4], [6]];
    for (const kind of reservedKinds) {
        const group: Card[] = [];
        for (let layer = 0; layer < MAIN_BOARD.length; layer += 1) {
            const candidates = deck.filter((card) => {
                const coordinate = Math.floor(alongRows ? card.y : card.x);
                const edge = alongRows ? 8 : 6;
                const position = mirrored ? edge - coordinate : coordinate;
                return (
                    card.layer === layer &&
                    bands[layer].includes(position) &&
                    kinds[card.id] === undefined
                );
            });
            const card = candidates[Math.floor(random() * candidates.length)];
            kinds[card.id] = kind;
            group.push(card);
        }
        reservedGroups.push(group);
    }

    const remaining = new Set(deck);
    const clearOrder: number[] = [];
    const exposed = (card: Card) =>
        blockers[card.id].every((upper) => !remaining.has(upper));
    const take = (card: Card) => {
        remaining.delete(card);
        clearOrder.push(card.id);
    };
    while (remaining.size > 0) {
        const moves = deck
            .filter(
                (card) =>
                    remaining.has(card) &&
                    kinds[card.id] === undefined &&
                    exposed(card),
            )
            .map((card) => [card]);
        for (const group of reservedGroups) {
            if (remaining.has(group[0]) && group.every(exposed))
                moves.push(group);
        }
        const highest = layout
            ? Math.max(...moves.map(([card]) => card.layer))
            : undefined;
        const candidates =
            highest === undefined
                ? moves
                : moves.filter(([card]) => card.layer === highest);
        candidates[Math.floor(random() * candidates.length)].forEach(take);
    }

    const triples = counts.flatMap((count, kind) =>
        count === 3 ? [] : new Array<number>(count / 3).fill(kind),
    );
    for (let index = triples.length - 1; index > 0; index -= 1) {
        const picked = Math.floor(random() * (index + 1));
        [triples[index], triples[picked]] = [triples[picked], triples[index]];
    }
    // A whole reserved group clears in three takes even when an
    // ordinary triple is waiting in up to two slots.
    let ordinary = 0;
    for (const id of clearOrder) {
        if (kinds[id] === undefined) {
            kinds[id] = triples[Math.floor(ordinary++ / 3)];
        }
    }
    if (previous && kinds.every((kind, id) => kind === previous[id])) {
        // Rename two kinds with equal counts. The same path still clears,
        // and even a repeated random sequence produces a different deal.
        const first = counts.findIndex(
            (count, kind) => count > 3 && counts.indexOf(count) < kind,
        );
        const second = counts.indexOf(counts[first]);
        for (const [id, kind] of kinds.entries()) {
            if (kind === first) kinds[id] = second;
            else if (kind === second) kinds[id] = first;
        }
    }
    return { kinds, clearOrder };
}

function peakDiversityScore(
    layout: MainLayout,
    kinds: readonly number[],
): number {
    const counts = new Array<number>(16).fill(0);
    for (const kind of kinds) counts[kind] += 1;
    const layers = PEAKS[layout].map(() => new Set<number>());
    for (const card of PEAK_DECKS[layout]) {
        const kind = kinds[card.id];
        if (counts[kind] > 3) layers[card.layer].add(kind);
    }
    let score = 0;
    for (let layer = 0; layer + 3 <= layers.length; layer += 1) {
        const window = new Set<number>();
        for (const layerKinds of layers.slice(layer, layer + 3)) {
            for (const kind of layerKinds) window.add(kind);
        }
        score += window.size;
    }
    return score;
}

function verifiesPeakDeal(
    layout: MainLayout,
    deal: { kinds: number[]; clearOrder: number[] },
): boolean {
    const round = new Round(2, "C", deal.kinds, Math.random, layout);
    const counts = new Array<number>(16).fill(0);
    for (const kind of deal.kinds) counts[kind] += 1;
    const ordinary = (card: Card) => counts[card.kind] > 3;

    // Replay carries all unmatched cards across layers and reserved groups.
    for (const id of deal.clearOrder) {
        const card = round.cards[id];
        const groupLayers = round.slots
            .filter((slotted) => slotted.kind === card.kind)
            .map((slotted) => slotted.layer);
        const taken = round.take(id);
        if (taken === null) return false;
        if (taken === 3 && ordinary(card)) {
            groupLayers.push(card.layer);
            if (Math.max(...groupLayers) - Math.min(...groupLayers) > 2)
                return false;
        }
    }
    return round.status === "won" && round.firstMatchAt === 3;
}

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
    readonly layout?: MainLayout;
    status: "playing" | "won" | "lost" = "playing";
    moves = 0;
    firstMatchAt: number | "prop" | null = null;
    private readonly onBoard: Set<number>;
    private readonly revealed = new Set<number>();
    private readonly usedProps = new Set<Prop>();
    private readonly board: readonly Card[];
    private slotted: Card[] = [];
    private capacity: number;
    private lastTaken: Card | null = null;
    private readonly random: () => number;

    constructor(
        level: Level,
        group: Group,
        boardKinds?: readonly number[],
        random = Math.random,
        layout?: MainLayout,
    ) {
        this.level = level;
        this.group = group;
        this.layout = layout;
        this.capacity = this.initialCapacity;
        this.random = random;
        const mainDeck = layout ? PEAK_DECKS[layout] : MAIN_DECK;
        this.board =
            level === 1
                ? TUTORIAL_DECK
                : boardKinds
                  ? mainDeck.map((card) => ({
                        ...card,
                        kind: boardKinds[card.id],
                    }))
                  : mainDeck;
        this.onBoard = new Set(this.cards.map((card) => card.id));
        if (level === 2 && group === "C") {
            const opening = layout
                ? this.cards
                      .slice()
                      .reverse()
                      // Leave one summit card dark so peek works at the start.
                      .slice(1)
                      .filter((card) => this.isSelectable(this.exposure(card)))
                      .slice(0, 6)
                : this.cards.filter(
                      (card) =>
                          card.layer === 2 &&
                          (card.x === 1 || card.x === 5) &&
                          (card.y === 1 || card.y === 4 || card.y === 7),
                  );
            for (const card of opening) this.revealed.add(card.id);
        }
    }

    get slots(): readonly Card[] {
        return this.slotted;
    }

    slotInsertionIndex(kind: number): number {
        for (let index = this.slotted.length - 1; index >= 0; index -= 1) {
            if (this.slotted[index].kind === kind) return index + 1;
        }
        return this.slotted.length;
    }

    get cards(): readonly Card[] {
        return this.board;
    }

    get initialCapacity(): number {
        return this.level === 2 && this.layout ? SLOT_LIMIT : INITIAL_SLOTS;
    }

    get slotCapacity(): number {
        return this.capacity;
    }

    get slotLimit(): number {
        return this.level === 1 ? INITIAL_SLOTS : SLOT_LIMIT;
    }

    get remaining(): number {
        return this.onBoard.size + this.slotted.length;
    }

    get hasProgress(): boolean {
        return (
            this.moves > 0 ||
            this.usedProps.size > 0 ||
            this.capacity !== this.initialCapacity
        );
    }

    propUsesLeft(prop: Prop): 0 | 1 {
        return this.usedProps.has(prop) ? 0 : 1;
    }

    unlockNextSlot(): boolean {
        if (this.status !== "playing" || this.capacity === this.slotLimit) {
            return false;
        }
        this.capacity += 1;
        return true;
    }

    get canRevive(): boolean {
        return (
            this.level === 2 &&
            this.status === "lost" &&
            this.capacity < this.slotLimit
        );
    }

    revive(): boolean {
        if (!this.canRevive) return false;
        this.capacity += 1;
        this.status = "playing";
        return true;
    }

    canUse(prop: Prop): boolean {
        if (
            this.level !== 2 ||
            this.status !== "playing" ||
            this.propUsesLeft(prop) === 0
        ) {
            return false;
        }
        if (prop === "undo") return this.lastTaken !== null;
        if (prop === "remove") return this.slotted.length > 0;
        return true;
    }

    use(prop: Prop): boolean {
        if (prop === "remove") return this.clearSlots() !== undefined;
        if (!this.canUse(prop)) return false;
        switch (prop) {
            case "undo": {
                const card = this.lastTaken!;
                this.slotted.splice(this.slotted.indexOf(card), 1);
                this.onBoard.add(card.id);
                this.revealed.add(card.id);
                this.lastTaken = null;
                break;
            }
            case "peek": {
                const uncovered: Card[] = [];
                const covered: Card[] = [];
                for (const card of this.cards) {
                    if (!this.isOnBoard(card)) continue;
                    const exposure = this.exposure(card);
                    if (this.isFaceUp(card, exposure)) continue;
                    (this.isSelectable(exposure) ? uncovered : covered).push(
                        card,
                    );
                }
                if (uncovered.length === 0 && covered.length === 0)
                    return false;
                while (uncovered.length < 3 && covered.length > 0) {
                    const layer = Math.max(
                        ...covered.map((card) => card.layer),
                    );
                    const candidates = covered.filter(
                        (card) => card.layer === layer,
                    );
                    const card =
                        candidates[
                            Math.floor(this.random() * candidates.length)
                        ];
                    uncovered.push(card);
                    covered.splice(covered.indexOf(card), 1);
                }
                for (const card of uncovered) this.revealed.add(card.id);
                break;
            }
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
            if (!covers(other, card) || !this.isOnBoard(other)) continue;
            const dx = other.left - card.left;
            const dy = other.top - card.top;
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
        return (
            this.revealed.has(card.id) ||
            (this.level === 2 &&
                this.group === "B" &&
                this.isSelectable(exposure))
        );
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
                (this.level === 1 || this.group !== "B") &&
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
        this.slotted.splice(this.slotInsertionIndex(card.kind), 0, card);
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

    clearSlots(): readonly SlotClearGroup[] | undefined {
        if (!this.canUse("remove")) return undefined;

        const layers: Card[][] = [];
        for (const card of this.cards) {
            if (!this.isOnBoard(card)) continue;
            (layers[card.layer] ??= []).push(card);
        }
        const groups: SlotClearGroup[] = [];
        for (const { kind } of this.slotted) {
            if (groups.some((group) => group.kind === kind)) continue;
            const heldCount = this.slotted.filter(
                (card) => card.kind === kind,
            ).length;
            const needed = 3 - heldCount;
            let boardCards: Card[] | undefined;
            for (let layer = layers.length - 1; layer >= 0; layer -= 1) {
                const matches = layers[layer]?.filter(
                    (card) => card.kind === kind,
                );
                if (matches && matches.length >= needed) {
                    boardCards = matches.slice(0, needed);
                    break;
                }
            }
            if (!boardCards) return undefined;
            groups.push({ kind, heldCount, boardCards });
        }

        for (const group of groups) {
            for (const card of group.boardCards) this.onBoard.delete(card.id);
        }
        this.slotted = [];
        this.lastTaken = null;
        this.usedProps.add("remove");
        this.firstMatchAt ??= "prop";
        if (this.remaining === 0) this.status = "won";
        return groups;
    }
}
