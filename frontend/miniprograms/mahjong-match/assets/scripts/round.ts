type Suit = "万" | "筒" | "条" | "字";
export type Tile = Readonly<{ suit: Suit; rank: number }>;
export type Match = "顺子" | "刻子";

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
    const suits = ["万", "筒", "条"] as const;
    const groups = shuffled([
        ...suits.flatMap((suit) => {
            const [rank] = shuffled([1, 5, 6, 7, 8, 9]);
            return [
                group(suit, 1, 2, 3),
                group(suit, 2, 3, 4),
                group(suit, 4, 5, 6),
                group(suit, 7, 8, 9),
                group(suit, rank, rank, rank),
            ];
        }),
        group("字", 1, 1, 1),
    ]);
    const layers = [
        { rows: [5, 7, 7, 5], x: 0, y: 170 },
        { rows: [3, 5, 4], x: -35, y: 137 },
        { rows: [2, 4, 3], x: 38, y: 101 },
        { rows: [1, 2], x: -25, y: 59 },
    ];
    let offset = 0;
    return layers.flatMap(({ rows, x, y }, layer) => {
        const positions = rows.flatMap((width, row) =>
            Array.from({ length: width }, (_, column) => ({
                x: x + (column - (width - 1) / 2) * 96 + (row % 2 ? 12 : -12),
                y: y - row * 132,
                layer,
            })),
        );
        const count = positions.length / 3;
        const tiles = shuffled(groups.slice(offset, offset + count).flat());
        offset += count;
        return positions.map((position, index) => ({
            ...position,
            ...tiles[index],
        }));
    });
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
    if (first.suit === "字") return null;

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
