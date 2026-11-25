const NUMBERED_SUITS = ["万", "筒", "条"] as const;
type Suit = (typeof NUMBERED_SUITS)[number] | "字" | "花" | "季";
export type Tile = Readonly<{ suit: Suit; rank: number }>;
export type Match = "顺子" | "刻子";

const FACE_NAMES: Record<Suit, readonly string[]> = {
    万: Array.from({ length: 9 }, (_, i) => `character-${i + 1}`),
    筒: Array.from({ length: 9 }, (_, i) => `dot-${i + 1}`),
    条: Array.from({ length: 9 }, (_, i) => `bamboo-${i + 1}`),
    字: [
        "green",
        "red",
        "white",
        "wind-east",
        "wind-south",
        "wind-west",
        "wind-north",
    ],
    花: ["plum", "orchid", "bamboo", "chrysanthemum"],
    季: ["spring", "summer", "autumn", "winter"],
};

export function faceName({ suit, rank }: Tile): string {
    return FACE_NAMES[suit][rank - 1];
}

export const FACE_FILES = Object.values(FACE_NAMES).flat();

function group(suit: Suit, ...ranks: number[]): Tile[] {
    return ranks.map((rank) => ({ suit, rank }));
}

export const TILE_WIDTH = 100;
export const TILE_HEIGHT = 144;
export const BOARD_COLUMN_STEP = TILE_WIDTH - 2;
export const BOARD_ROW_STEP = TILE_HEIGHT - 14;
const BOARD_CENTER_Y = 18;

const BOARD_COLUMNS = 7;
const BOARD_ROWS = 8;
const LAYOUTS = [
    {
        counts: [56, 37, 33, 30, 27, 21, 18, 12, 6],
        weightX: 1,
        weightY: 1,
        driftX: 0,
        driftY: 0,
    },
    {
        counts: [56, 40, 36, 33, 27, 21, 15, 9, 3],
        weightX: 0.65,
        weightY: 1.65,
        driftX: 0.13,
        driftY: 0,
    },
    {
        counts: [56, 40, 39, 36, 30, 24, 15],
        weightX: 1.65,
        weightY: 0.65,
        driftX: 0,
        driftY: -0.16,
    },
];
export const BOARD_LAYOUT_COUNT = LAYOUTS.length;

export type Position = Readonly<{ x: number; y: number; layer: number }>;
export type PlacedTile = Tile & Position;

function shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
}

export function deal(layoutIndex = 0): PlacedTile[] {
    const runs = [
        [1, 2, 3],
        [2, 3, 4],
        [4, 5, 6],
        [7, 8, 9],
    ];
    const groups = shuffled([
        ...NUMBERED_SUITS.flatMap((suit, index) => [
            ...runs.flatMap((ranks) =>
                Array.from({ length: 4 }, () => group(suit, ...ranks)),
            ),
            ...Array.from({ length: index === 2 ? 5 : 6 }, () => {
                const ranks = [1, 5, 6, 7, 8, 9];
                const rank = ranks[Math.floor(Math.random() * ranks.length)];
                return group(suit, rank, rank, rank);
            }),
        ]),
        ...(["字", "花", "季"] as const).flatMap((suit) =>
            FACE_NAMES[suit].map((_, index) =>
                group(suit, index + 1, index + 1, index + 1),
            ),
        ),
    ]);

    const faces = groups.flatMap(shuffled);
    const layout = LAYOUTS[layoutIndex % BOARD_LAYOUT_COUNT];
    const board: PlacedTile[] = [];
    let lower: Position[] = [];
    let offset = 0;
    layout.counts.forEach((size, layer) => {
        // The half-cell grid fits between the outer rows and columns of the base.
        const inset = layer % 2;
        const columns = BOARD_COLUMNS - inset;
        const rows = BOARD_ROWS - inset;
        const positions = Array.from(
            { length: columns * rows },
            (_, index) => ({
                x: ((index % columns) - (columns - 1) / 2) * BOARD_COLUMN_STEP,
                y:
                    BOARD_CENTER_Y +
                    ((rows - 1) / 2 - Math.floor(index / columns)) *
                        BOARD_ROW_STEP,
                layer,
            }),
        );
        const score = ({ x, y }: Position) =>
            layout.weightX *
                (x / BOARD_COLUMN_STEP - layer * layout.driftX) ** 2 +
            layout.weightY *
                ((y - BOARD_CENTER_Y) / BOARD_ROW_STEP -
                    layer * layout.driftY) **
                    2;
        const ranked = positions
            .filter(
                (position) =>
                    layer === 0 || lower.some((tile) => covers(position, tile)),
            )
            .sort((a, b) => score(a) - score(b))
            .slice(0, size);
        lower = ranked;

        // Keep groups consecutive in reverse deal order even when a group spans two layers.
        const tiles = faces.slice(offset, offset + size);
        offset += size;
        board.push(
            ...shuffled(ranked).map((position, index) => ({
                ...position,
                ...tiles[index],
            })),
        );
    });
    return board;
}

export function shuffleBoard(tiles: readonly PlacedTile[]): PlacedTile[] {
    const faces = shuffled(tiles.map(({ suit, rank }) => ({ suit, rank })));
    return tiles.map((tile, index) => ({ ...tile, ...faces[index] }));
}

export function covers(upper: Position, lower: Position): boolean {
    return (
        upper.layer > lower.layer &&
        Math.abs(upper.x - lower.x) < TILE_WIDTH &&
        Math.abs(upper.y - lower.y) < TILE_HEIGHT
    );
}

export function matchTiles(
    first: Tile,
    second: Tile,
    third: Tile,
): Match | null {
    if (first.suit !== second.suit || first.suit !== third.suit) return null;
    if (first.rank === second.rank && first.rank === third.rank) return "刻子";
    if (first.suit === "字" || first.suit === "花" || first.suit === "季")
        return null;

    const [low, middle, high] = [first.rank, second.rank, third.rank].sort(
        (left, right) => left - right,
    );
    return middle === low + 1 && high === middle + 1 ? "顺子" : null;
}

export const SLOT_CAPACITY = 6;
export const UNSOLVABLE_CHECK_BOARD_LIMIT = 48;

export function findMatch(tiles: readonly Tile[]): {
    indices: readonly [number, number, number];
    match: Match;
} | null {
    for (let first = 0; first < tiles.length - 2; first++) {
        for (let second = first + 1; second < tiles.length - 1; second++) {
            for (let third = second + 1; third < tiles.length; third++) {
                const match = matchTiles(
                    tiles[first],
                    tiles[second],
                    tiles[third],
                );
                if (match) return { indices: [first, second, third], match };
            }
        }
    }
    return null;
}

function canPartition(tiles: readonly Tile[]): boolean {
    return (Object.keys(FACE_NAMES) as Suit[]).every((suit) => {
        const counts = FACE_NAMES[suit].map(() => 0);
        for (const tile of tiles) {
            if (tile.suit === suit) counts[tile.rank - 1]++;
        }
        if (!NUMBERED_SUITS.some((numbered) => numbered === suit)) {
            return counts.every((count) => count % 3 === 0);
        }

        const deadEnds = new Set<string>();
        function consume(): boolean {
            const first = counts.findIndex((count) => count > 0);
            if (first < 0) return true;
            const key = counts.join(",");
            if (deadEnds.has(key)) return false;
            if (counts[first] >= 3) {
                counts[first] -= 3;
                if (consume()) return true;
                counts[first] += 3;
            }
            if (counts[first + 1] > 0 && counts[first + 2] > 0) {
                for (let i = first; i < first + 3; i++) counts[i]--;
                if (consume()) return true;
                for (let i = first; i < first + 3; i++) counts[i]++;
            }
            deadEnds.add(key);
            return false;
        }
        return consume();
    });
}

function completeTray(
    tray: readonly Tile[],
    available: number,
): Tile[] | undefined {
    if (tray.length === 0) return [];
    const choices: Tile[][] = [];
    for (const { suit, rank } of tray) {
        choices.push(group(suit, rank, rank, rank));
        if (NUMBERED_SUITS.some((numbered) => numbered === suit)) {
            for (
                let low = Math.max(1, rank - 2);
                low <= Math.min(7, rank);
                low++
            ) {
                choices.push(group(suit, low, low + 1, low + 2));
            }
        }
    }

    for (const choice of choices) {
        const unmatched = [...tray];
        const additions = choice.filter((tile) => {
            const index = unmatched.findIndex(
                (other) => other.suit === tile.suit && other.rank === tile.rank,
            );
            if (index < 0) return true;
            unmatched.splice(index, 1);
            return false;
        });
        if (additions.length > Math.min(available, SLOT_CAPACITY - tray.length))
            continue;

        let next = [...tray];
        for (const tile of additions) {
            next.push(tile);
            const match = findMatch(next);
            if (match) next = next.filter((_, i) => !match.indices.includes(i));
        }
        if (next.length >= tray.length) continue;
        const rest = completeTray(next, available - additions.length);
        if (rest) return [...additions, ...rest];
    }
    return undefined;
}

export function refreshUnsolvableBoard(
    board: readonly PlacedTile[],
    tray: readonly Tile[],
): PlacedTile[] | undefined {
    if (
        board.length === 0 ||
        board.length > UNSOLVABLE_CHECK_BOARD_LIMIT ||
        tray.length >= SLOT_CAPACITY ||
        (board.length + tray.length) % 3 !== 0 ||
        canPartition([...board, ...tray])
    ) {
        return undefined;
    }

    const completion = completeTray(tray, board.length);
    if (!completion) return undefined;
    const faces = [
        ...completion,
        ...deal().slice(0, board.length - completion.length),
    ];
    // All upper layers can be taken before any lower layer.
    const order = board
        .map((_, i) => i)
        .sort((a, b) => board[b].layer - board[a].layer);
    const refreshed = [...board];
    order.forEach((index, i) => {
        const { suit, rank } = faces[i];
        refreshed[index] = { ...board[index], suit, rank };
    });
    return refreshed;
}
