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
    const groups = shuffled([
        group("万", 1, 2, 3),
        group("万", 4, 5, 6),
        group("筒", 3, 4, 5),
        group("筒", 5, 5, 5),
        group("条", 7, 8, 9),
        group("字", 1, 1, 1),
    ]);
    const layers = [
        { x: -127, y: 178, tiles: groups.slice(0, 3) },
        { x: -94, y: 138, tiles: groups.slice(3, 5) },
        { x: -114, y: 176, tiles: groups.slice(5) },
    ];
    return layers.flatMap(({ x, y, tiles }, layer) =>
        shuffled(tiles.flat()).map((tile, index) => ({
            ...tile,
            x: x + (index % 3) * 110,
            y: y - Math.floor(index / 3) * 145,
            layer,
        })),
    );
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

export function hasMatch(tiles: readonly Tile[]): boolean {
    for (let first = 0; first < tiles.length - 2; first++) {
        for (let second = first + 1; second < tiles.length - 1; second++) {
            for (let third = second + 1; third < tiles.length; third++) {
                if (matchTiles(tiles[first], tiles[second], tiles[third])) {
                    return true;
                }
            }
        }
    }
    return false;
}
