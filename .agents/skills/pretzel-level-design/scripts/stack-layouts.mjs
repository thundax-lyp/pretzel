import { requireThat, range, counts } from "./catalog.mjs";

export const STACK_PROFILES = [
    "aligned-control",
    "pair-bridges",
    "quad-bridges",
    "mixed-bridges",
];

// Coordinates are measured in whole-card widths. Integer construction cells are half a card.
export function stackPositions(profile) {
    requireThat(
        STACK_PROFILES.includes(profile),
        "unknown mixed-stack profile",
    );
    const positions = [];
    for (let peak = 0; peak < 2; peak++) {
        const kind =
            profile === "mixed-bridges"
                ? peak
                    ? "quad-bridges"
                    : "pair-bridges"
                : profile;
        const offset = peak * 12;
        const add = (x, y, z) => positions.push([(x + offset) / 2, y / 2, z]);
        for (const y of range(3))
            for (const x of range(4)) add(x * 2, y * 2, 0);
        const dx = kind === "aligned-control" ? 0 : 1;
        const dy = kind === "quad-bridges" ? 1 : 0;
        for (const y of range(2))
            for (const x of range(3)) add(x * 2 + dx, y * 2 + dy, 1);
        for (const x of range(2))
            add(x * 2 + (kind === "aligned-control" ? 0 : 2), dy ? 2 : 0, 2);
        for (let z = 3; z < 7; z++)
            add(kind === "aligned-control" ? 0 : 3, dy ? 2 : 0, z);
    }
    validateStack(positions);
    return positions;
}

export function validateStack(positions) {
    requireThat(positions.length > 0, "empty stack");
    const planes = new Map();
    for (const [x, y, z] of positions) {
        requireThat(
            Number.isInteger(x * 2) &&
                Number.isInteger(y * 2) &&
                Number.isInteger(z) &&
                z >= 0,
            "stack positions must use half-card XY cells",
        );
        if (!planes.has(z)) planes.set(z, new Set());
        const cells = planes.get(z);
        for (const dx of [0, 1])
            for (const dy of [0, 1]) {
                const key = `${x * 2 + dx}:${y * 2 + dy}`;
                requireThat(
                    !cells.has(key),
                    "cards overlap on the same physical layer",
                );
                cells.add(key);
            }
    }
    for (const [x, y, z] of positions)
        if (z > 0) {
            const below = planes.get(z - 1);
            requireThat(
                below &&
                    [0, 1].some((dx) =>
                        [0, 1].some((dy) =>
                            below.has(`${x * 2 + dx}:${y * 2 + dy}`),
                        ),
                    ),
                "upper card needs at least one overlapping support below",
            );
        }
    return true;
}

export function stackMetrics(positions) {
    const lower = positions.map(([x, y, z]) =>
        positions.flatMap(([xx, yy, zz], i) =>
            zz === z - 1 &&
            Math.abs(x - xx) < 1 - 1e-8 &&
            Math.abs(y - yy) < 1 - 1e-8
                ? [i]
                : [],
        ),
    );
    const upperCounts = positions.map(() => 0);
    for (const group of lower) for (const i of group) upperCounts[i]++;
    return {
        one_covers_two: lower.filter((g) => g.length === 2).length,
        one_covers_four: lower.filter((g) => g.length === 4).length,
        many_cover_one: upperCounts.filter((n) => n >= 2).length,
        four_cover_one: upperCounts.filter((n) => n === 4).length,
        maximum_adjacent_fanout: Math.max(0, ...lower.map((g) => g.length)),
        maximum_adjacent_fanin: Math.max(0, ...upperCounts),
        lower_neighbor_histogram: counts(lower.map((g) => g.length)),
    };
}

// Rectangle union, not the number of distinct XY anchors: offset tiles create extra anchors.
export function footprintArea(positions) {
    const xs = [...new Set(positions.flatMap(([x]) => [x, x + 1]))].sort(
        (a, b) => a - b,
    );
    let area = 0;
    for (let i = 1; i < xs.length; i++) {
        const mid = (xs[i - 1] + xs[i]) / 2;
        const intervals = positions
            .filter(([x]) => x < mid && x + 1 > mid)
            .map(([, y]) => [y, y + 1])
            .sort((a, b) => a[0] - b[0]);
        let length = 0,
            end = -Infinity;
        for (const [a, b] of intervals) {
            length += Math.max(0, b - Math.max(a, end));
            end = Math.max(end, b);
        }
        area += (xs[i] - xs[i - 1]) * length;
    }
    return area;
}
