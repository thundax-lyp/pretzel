import { range, requireThat } from "./catalog.mjs";
const cache = new WeakMap();
export function overlaps(a, b) {
    for (const poly of [a, b])
        for (let n = 0; n < poly.length; n++) {
            const p = poly[n],
                q = poly[(n + 1) % poly.length],
                nx = -(q[1] - p[1]),
                ny = q[0] - p[0];
            const pa = a.map(([x, y]) => x * nx + y * ny),
                pb = b.map(([x, y]) => x * nx + y * ny);
            if (
                Math.min(Math.max(...pa), Math.max(...pb)) <=
                Math.max(Math.min(...pa), Math.min(...pb)) + 1e-8
            )
                return false;
        }
    return true;
}
export function clippedArea(subject, clip) {
    let output = subject;
    for (let n = 0; n < clip.length; n++) {
        const a = clip[n],
            b = clip[(n + 1) % clip.length],
            source = output;
        output = [];
        if (!source.length) break;
        const side = (p) =>
            (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        let previous = source.at(-1);
        for (const current of source) {
            const sp = side(previous),
                sc = side(current);
            if (sp >= -1e-9 !== sc >= -1e-9) {
                const t = sp / (sp - sc);
                output.push([
                    previous[0] + t * (current[0] - previous[0]),
                    previous[1] + t * (current[1] - previous[1]),
                ]);
            }
            if (sc >= -1e-9) output.push(current);
            previous = current;
        }
    }
    return (
        Math.abs(
            output.reduce((sum, p, i) => {
                const q = output[(i + 1) % output.length];
                return sum + p[0] * q[1] - q[0] * p[1];
            }, 0),
        ) / 2
    );
}
function compute(level, oracle) {
    const positions = level.positions;
    if (level.visibility === "logical-xy")
        return positions.map(([x, y, z]) =>
            range(positions.length).filter(
                (j) =>
                    positions[j][2] > z &&
                    Math.abs(x - positions[j][0]) < 1 - 1e-8 &&
                    Math.abs(y - positions[j][1]) < 1 - 1e-8,
            ),
        );
    requireThat(
        level.visibility === "isometric-body",
        "unknown visibility model",
    );
    const [sx, sy, sz, thickness] = level.projection;
    const order = range(positions.length).sort((i, j) => {
        const a = positions[i],
            b = positions[j];
        return a[0] + a[1] - b[0] - b[1] || a[2] - b[2] || a[0] - b[0];
    });
    const rank = [];
    order.forEach((i, n) => (rank[i] = n));
    const faces = positions.map(([x, y, z]) => {
        const px = (x - y) * sx,
            py = (x + y) * sy - z * sz;
        return [
            [px, py],
            [px + sx, py + sy],
            [px, py + 2 * sy],
            [px - sx, py + sy],
        ];
    });
    const bodies = faces.map((f) => [
        f[0],
        f[1],
        [f[1][0], f[1][1] + thickness],
        [f[2][0], f[2][1] + thickness],
        [f[3][0], f[3][1] + thickness],
        f[3],
    ]);
    return faces.map((face, i) =>
        range(positions.length).filter(
            (j) =>
                rank[j] > rank[i] &&
                (oracle
                    ? clippedArea(face, bodies[j]) > 1e-7
                    : overlaps(face, bodies[j])),
        ),
    );
}
export function geometry(level, oracle = false) {
    let pair = cache.get(level);
    if (!pair) {
        pair = {};
        cache.set(level, pair);
    }
    const key = oracle ? "oracle" : "producer";
    return (pair[key] ??= compute(level, oracle));
}
export function available(level, board, locations = range(48), oracle = false) {
    const occupied = new Set([...board].map((i) => locations[i]));
    const covers = geometry(level, oracle);
    return [...board]
        .sort((a, b) => a - b)
        .filter((i) => !covers[locations[i]].some((p) => occupied.has(p)));
}
export function coverMasks(level, locations) {
    const occupants = new Map(locations.map((p, i) => [p, i]));
    return locations.map((p) =>
        geometry(level)[p].reduce(
            (mask, j) => mask | (1n << BigInt(occupants.get(j))),
            0n,
        ),
    );
}
