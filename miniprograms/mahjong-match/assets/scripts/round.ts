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

export const TILE_WIDTH = 94;
export const TILE_HEIGHT = 130;

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

export function deal(): PlacedTile[] {
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

    let offset = 0;
    return Array.from({ length: 9 }, (_, layer) => {
        const rows = layer === 8 ? [5, 7, 7, 5] : [6, 7, 7, 7];
        const positions = rows.flatMap((width, row) =>
            Array.from({ length: width }, (_, column) => ({
                x:
                    (column - (width - 1) / 2) * 96 +
                    ((row + layer) % 2 ? 12 : -12),
                y: 170 - row * 132 - layer * 2,
                layer,
            })),
        );
        const count = positions.length / 3;
        // Each layer has a clear order by taking its consecutive groups.
        const tiles = groups.slice(offset, offset + count).flatMap(shuffled);
        offset += count;
        return positions.map((position, index) => ({
            ...position,
            ...tiles[index],
        }));
    }).flat();
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
