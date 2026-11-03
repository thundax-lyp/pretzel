import {
    STACK_PROFILES,
    stackPositions,
    validateStack,
    stackMetrics,
    footprintArea,
} from "./stack-layouts.mjs";
import {
    ANIMALS,
    CURVES,
    PROFILES,
    Random,
    range,
    clone,
    same,
    requireThat,
    attributes,
    counts,
} from "./catalog.mjs";
import { geometry, available } from "./geometry.mjs";
import { Game } from "./game.mjs";
export function loadLevel(value) {
    const level = clone(value);
    if (level.curve === undefined) level.curve = "balanced";
    if (level.visibility === undefined) level.visibility = "logical-xy";
    if (level.projection === undefined) level.projection = [28, 16, 14, 14];
    level.source_id ??= `native:${level.profile}:${level.curve}:${level.seed}`;
    return level;
}
export function checkLevel(level) {
    requireThat(
        level.cards?.length === 48 &&
            level.positions?.length === 48 &&
            level.targets?.length === 12 &&
            level.reference?.length === 12,
        "need 48 cards and 12 questions",
    );
    requireThat(
        Number.isSafeInteger(level.seed) &&
            typeof level.source_id === "string" &&
            level.source_id.length,
        "invalid identity",
    );
    requireThat(
        level.cards.every(
            (i) => Number.isInteger(i) && i >= 0 && i < ANIMALS.length,
        ),
        "unknown animal",
    );
    requireThat(
        new Set(level.positions.map((p) => JSON.stringify(p))).size === 48 &&
            level.positions.every(
                (p) =>
                    p.length === 3 &&
                    p.every(Number.isFinite) &&
                    Number.isInteger(p[2]) &&
                    p[2] >= 0 &&
                    p[2] < 48,
            ),
        "invalid coordinate",
    );
    requireThat(
        level.projection.length === 4 &&
            level.projection.every((n) => Number.isFinite(n) && n > 0),
        "invalid projection",
    );
    requireThat(
        level.targets.every(
            (t) =>
                t.length === 2 &&
                t.every((n) => Number.isInteger(n) && n >= 0) &&
                t[0] > 0,
        ),
        "invalid target",
    );
    const blockers = geometry(level);
    requireThat(
        same(blockers, geometry(level, true)),
        "geometry oracles disagree",
    );
    if (Object.hasOwn(level, "blockers")) {
        requireThat(
            same(blockers, level.blockers),
            `source covering disagrees: ${level.source_id}`,
        );
    }
    if (level.layout_grid !== undefined) {
        requireThat(
            level.layout_grid.coordinate_unit === "tile" &&
                level.layout_grid.step === 0.5 &&
                same(level.layout_grid.card_footprint_cells, [2, 2]),
            "unsupported layout grid",
        );
        validateStack(level.positions);
    }
    const game = new Game(level);
    level.reference.forEach((group, q) => {
        requireThat(
            game.q === q && group.length >= 1 && group.length <= 7,
            "invalid reference group",
        );
        for (const i of group) game.take(i);
        requireThat(game.q === q + 1, "reference did not clear question");
    });
    requireThat(game.status === "won", "reference did not finish");
    return level;
}
export function importLevels(data, maxCandidates = 80) {
    let records = [],
        projection = [28, 16, 14, 14],
        animalMap = range(24);
    if (data && Array.isArray(data.packs)) {
        requireThat(
            data.schemaVersion === 1 && Array.isArray(data.animals),
            "unsupported level-pack",
        );
        const p = data.projection ?? {};
        projection = ["xStep", "yStep", "layerStep", "thickness"].map(
            (k, i) => p[k] ?? projection[i],
        );
        animalMap = data.animals.map((a) => {
            const i = ANIMALS.findIndex((v) =>
                same(v, [a.name, a.eyes, a.legs]),
            );
            requireThat(i >= 0, "unknown animal definition");
            return i;
        });
        records = data.packs.map((p, i) => ({
            identity: `pack:${p.slug}:hard`,
            seed: 2026110300 + i,
            raw: p.hard,
            variant: "external",
        }));
    } else if (Array.isArray(data) && data.length && data[0].level) {
        records = data.map((i) => ({
            identity: `height:${i.variant}:${i.theme}`,
            seed: i.seed,
            raw: i.projection
                ? { ...i.level, projection: i.projection }
                : i.level,
            variant: String(i.variant),
        }));
    } else {
        const values = Array.isArray(data) ? data : data?.levels;
        requireThat(
            Array.isArray(values) &&
                values.length > 0 &&
                values.length <= maxCandidates,
            "candidate budget or native input invalid",
        );
        const levels = values.map(loadLevel);
        requireThat(
            new Set(levels.map((l) => l.source_id)).size === levels.length,
            "duplicate identity",
        );
        levels.forEach(checkLevel);
        checkPairs(levels);
        return levels;
    }
    requireThat(
        records.length > 0 && records.length <= maxCandidates,
        "candidate budget exceeded",
    );
    const levels = records.map(({ identity, seed, raw, variant }) => {
        requireThat(
            raw?.cards?.length === 48,
            "only second-stage levels supported",
        );
        for (const c of raw.cards)
            requireThat(
                Number.isInteger(c.animal) &&
                    c.animal >= 0 &&
                    c.animal < animalMap.length,
                "unknown animal index",
            );
        let camera = raw.projection ?? projection;
        if (!Array.isArray(camera))
            camera = ["xStep", "yStep", "layerStep", "thickness"].map(
                (k) => camera[k],
            );
        const level = loadLevel({
            seed,
            profile: "imported",
            curve: variant,
            source_id: identity,
            visibility: "isometric-body",
            projection: camera,
            cards: raw.cards.map((c) => animalMap[c.animal]),
            positions: raw.cards.map((c) => [c.x, c.y, c.z]),
            targets: raw.targets.map((t) => [t.eyes, t.legs]),
            reference: raw.reference,
        });
        checkLevel(level);
        const layers = Math.max(...level.positions.map((p) => p[2])) + 1;
        requireThat(
            (raw.layers ?? layers) === layers &&
                (raw.maxLayers ?? layers) >= layers,
            "source layer metadata disagrees",
        );
        requireThat(
            same(geometry(level), raw.blockers),
            `source covering disagrees: ${identity}`,
        );
        return level;
    });
    requireThat(
        new Set(levels.map((l) => l.source_id)).size === levels.length,
        "duplicate identity",
    );
    return levels;
}
export function generate(seed, profile = "three-peaks", curve = "balanced") {
    requireThat(
        (PROFILES[profile] || STACK_PROFILES.includes(profile)) &&
            CURVES[curve] &&
            Number.isSafeInteger(seed),
        "invalid generator configuration",
    );
    const rng = new Random(`${seed}:generation`),
        positions = STACK_PROFILES.includes(profile)
            ? stackPositions(profile)
            : [];
    for (
        let peak = 0;
        peak <
        (STACK_PROFILES.includes(profile)
            ? 0
            : profile === "four-peaks"
              ? 4
              : profile === "two-peaks"
                ? 2
                : 3);
        peak++
    )
        PROFILES[profile].forEach((n, z) => {
            let xs = range(n).map((i) => (i - (n - 1) / 2) * 0.8);
            if (z === 3 && profile === "three-peaks") xs = [-0.8, 0.8];
            if (z === 3 && profile === "two-peaks") xs = [-1.6, 0, 1.6];
            for (const x of xs)
                positions.push([peak * 6 + x, [0, 0.12, -0.12, 0][z], z]);
        });
    const partial = loadLevel({
        seed,
        profile,
        curve,
        positions,
        ...(STACK_PROFILES.includes(profile)
            ? {
                  layout_grid: {
                      coordinate_unit: "tile",
                      step: 0.5,
                      card_footprint_cells: [2, 2],
                  },
              }
            : {}),
    });
    const odd = [1, 3, 5, 12];
    for (let attempt = 0; attempt < 10000; attempt++) {
        const kinds = [
            rng.pick([20, 21, 22, 23]),
            ...rng.sample(odd, 3),
            ...rng.sample(
                range(20).filter((k) => !odd.includes(k)),
                8,
            ),
        ];
        const qty = Array(24).fill(0);
        for (const k of kinds) qty[k]++;
        for (let n = 12; n < 48; n++)
            qty[rng.pick(kinds.filter((k) => qty[k] < (k >= 20 ? 4 : 6)))]++;
        const oddCount = qty.reduce(
                (s, n, k) => s + (ANIMALS[k][2] % 2 ? n : 0),
                0,
            ),
            rare = qty.slice(20).reduce((a, b) => a + b, 0);
        if (oddCount < 4 || oddCount > 8 || rare < 2 || rare > 4) continue;
        const animals = rng.shuffle(
                kinds.flatMap((k) => Array(qty[k]).fill(k)),
            ),
            board = new Set(range(48));
        const order = rng.shuffle(available(partial, board));
        for (const i of order) board.delete(i);
        while (board.size) {
            const i = rng.pick(available(partial, board));
            order.push(i);
            board.delete(i);
        }
        const cards = [];
        order.forEach((i, n) => (cards[i] = animals[n]));
        let offset = 0;
        const reference = CURVES[curve].map((n) => {
            const g = order.slice(offset, offset + n);
            offset += n;
            return g;
        });
        const level = loadLevel({ ...partial, cards, reference });
        level.targets = reference.map((g) => attributes(level, g));
        if (
            level.targets.some((t, i) => i && same(t, level.targets[i - 1])) ||
            Math.max(
                ...Object.values(
                    counts(level.targets.map((t) => JSON.stringify(t))),
                ),
            ) > 2
        )
            continue;
        return checkLevel(level);
    }
    throw new Error("generation budget exhausted");
}
export function structureMetrics(level) {
    const covers = geometry(level),
        depth = new Map();
    const longest = (i) => {
        if (!depth.has(i))
            depth.set(i, 1 + Math.max(0, ...covers[i].map(longest)));
        return depth.get(i);
    };
    const board = new Set(range(48)),
        choices = [];
    for (const i of level.reference.flat()) {
        const free = available(level, board);
        requireThat(free.includes(i), "covered reference");
        choices.push(free.length);
        board.delete(i);
    }
    const footprint = new Set(
            level.positions.map((p) => JSON.stringify(p.slice(0, 2))),
        ).size,
        layers = Math.max(...level.positions.map((p) => p[2])) + 1;
    return {
        layers,
        footprint,
        footprint_area: footprintArea(level.positions),
        average_height: 48 / footprintArea(level.positions),
        stack_patterns: stackMetrics(level.positions),
        initial_clickable: choices[0],
        longest_dependency: Math.max(...range(48).map(longest)),
        clickable_before_each_pick: choices,
        layer_counts: range(layers).map(
            (z) => level.positions.filter((p) => p[2] === z).length,
        ),
    };
}

export function pairedPrototypes(bases) {
    return bases.flatMap((base) =>
        STACK_PROFILES.map((profile) => {
            const positions = stackPositions(profile);
            const provisional = loadLevel({
                ...base,
                profile,
                positions,
                visibility: "logical-xy",
                source_id: `${base.source_id}:stack:${profile}`,
                pair_id: base.source_id,
                placement_method: "seeded-topological-reference-order",
                layout_grid: {
                    coordinate_unit: "tile",
                    step: 0.5,
                    card_footprint_cells: [2, 2],
                },
            });
            // Source coverage belongs to the original coordinates, not this layout.
            delete provisional.blockers;
            const rng = new Random(`${base.seed}:paired-stack-placement`),
                board = new Set(range(48)),
                order = [];
            while (board.size) {
                const position = rng.pick(available(provisional, board));
                order.push(position);
                board.delete(position);
            }
            const assigned = Array(48);
            base.reference.flat().forEach((id, index) => {
                assigned[id] = positions[order[index]];
            });
            const level = loadLevel({ ...provisional, positions: assigned });
            requireThat(
                same(level.cards, base.cards) &&
                    same(level.targets, base.targets) &&
                    same(level.reference, base.reference),
                "paired prototype changed puzzle content",
            );
            return checkLevel(level);
        }),
    );
}

export function checkPairs(levels) {
    const groups = new Map();
    for (const level of levels)
        if (level.pair_id !== undefined) {
            requireThat(
                typeof level.pair_id === "string" && level.pair_id.length,
                "invalid pair identity",
            );
            if (!groups.has(level.pair_id)) groups.set(level.pair_id, []);
            groups.get(level.pair_id).push(level);
        }
    return [...groups].map(([pair_id, group]) => {
        const base = group[0];
        for (const level of group)
            requireThat(
                level.seed === base.seed &&
                    same(level.cards, base.cards) &&
                    same(level.targets, base.targets) &&
                    same(level.reference, base.reference),
                "paired layouts changed content or seed",
            );
        requireThat(
            new Set(group.map((l) => l.profile)).size === group.length,
            "duplicate paired profile",
        );
        return {
            pair_id,
            source_ids: group.map((l) => l.source_id),
            profiles: group.map((l) => l.profile),
        };
    });
}
