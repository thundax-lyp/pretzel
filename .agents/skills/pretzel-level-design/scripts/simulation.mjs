import { generate } from "./levels.mjs";
import {
    ANIMALS,
    TOOLS,
    Random,
    range,
    clone,
    same,
    attributes,
    requireThat,
    counts,
    mean,
    quantile,
} from "./catalog.mjs";
import { geometry, coverMasks } from "./geometry.mjs";
import { Game } from "./game.mjs";
const BITS = range(48).map((i) => 1n << BigInt(i));
const mask = (values) => values.reduce((m, i) => m | BITS[i], 0n);
const indices = (m) => range(48).filter((i) => Boolean(m & BITS[i]));
const vectors = (level, values) => {
    const result = Array(24).fill(0);
    for (const i of values) result[level.cards[i]]++;
    return result;
};
export function questionPaths(game, rng, limit = 16, budget = 3000) {
    const covers = coverMasks(game.level, game.locations),
        target = game.level.targets[game.q],
        seen = new Set(),
        result = [];
    let nodes = 0,
        truncated = false;
    function walk(board, temp, e, l, path) {
        if (result.length >= limit) return;
        if (nodes >= budget) {
            truncated = true;
            return;
        }
        const key = `${board}:${temp}`;
        if (seen.has(key)) return;
        seen.add(key);
        nodes++;
        if (path.length && e === target[0] && l === target[1]) {
            result.push(path);
            return;
        }
        if (path.length + game.slot.length >= 7) return;
        const free = rng.shuffle(
            indices(board | temp).filter(
                (i) => Boolean(temp & BITS[i]) || !(covers[i] & board),
            ),
        );
        for (const i of free) {
            const [, a, b] = ANIMALS[game.level.cards[i]];
            if (e + a <= target[0] && l + b <= target[1])
                walk(board & ~BITS[i], temp & ~BITS[i], e + a, l + b, [
                    ...path,
                    i,
                ]);
        }
    }
    walk(
        mask([...game.board]),
        mask(game.temp),
        ...attributes(game.level, game.slot),
        [],
    );
    return { paths: result, truncated };
}
function afterPath(game, path) {
    const trial = Object.assign(Object.create(Game.prototype), game);
    trial.board = new Set([...game.board].filter((i) => !path.includes(i)));
    trial.temp = game.temp.filter((i) => !path.includes(i));
    trial.slot = [];
    trial.q++;
    return trial;
}
const allocationCache = new Map();
export function allocation(game, budget = 12000) {
    const remaining = [...game.board].sort((a, b) => a - b).concat(game.temp),
        qty = vectors(game.level, remaining),
        canonical = game.level.reference.map((g) => vectors(game.level, g));
    const suffix = range(12).map((q) =>
        range(24).map((k) => canonical.slice(q).reduce((s, c) => s + c[k], 0)),
    );
    const key = JSON.stringify([
        game.level.cards,
        game.level.targets,
        game.level.reference,
        game.q,
        qty,
        attributes(game.level, game.slot),
        game.slot.length,
        budget,
    ]);
    let cached = allocationCache.get(key);
    if (!cached) {
        const seen = new Set();
        let nodes = 0,
            unknown = false;
        function groups(available, target, capacity) {
            const kinds = range(24).filter((k) => available[k]),
                options = [],
                vector = Array(24).fill(0);
            let checked = 0;
            function visit(index, e, l, n) {
                if (checked >= 6000 || options.length >= 128) {
                    unknown = true;
                    return;
                }
                checked++;
                if (n && e === target[0] && l === target[1]) {
                    options.push([...vector]);
                    return;
                }
                if (index === kinds.length || n === capacity) return;
                const k = kinds[index],
                    [, a, b] = ANIMALS[k];
                for (
                    let take = 0;
                    take <=
                    Math.min(
                        available[k],
                        capacity - n,
                        Math.floor((target[0] - e) / a),
                    );
                    take++
                )
                    if (l + take * b <= target[1]) {
                        vector[k] = take;
                        visit(index + 1, e + take * a, l + take * b, n + take);
                    }
                vector[k] = 0;
            }
            if (Math.min(...target) >= 0 && capacity > 0) visit(0, 0, 0, 0);
            return options;
        }
        function solve(q, available, first) {
            if (q === 12) return available.some(Boolean) ? null : [];
            if (nodes >= budget) {
                unknown = true;
                return null;
            }
            const key = JSON.stringify([q, available]);
            if (seen.has(key)) return null;
            seen.add(key);
            nodes++;
            if (!first && same(available, suffix[q])) return canonical.slice(q);
            const held = first ? attributes(game.level, game.slot) : [0, 0],
                target = game.level.targets[q].map((n, i) => n - held[i]);
            const preferred =
                !first && canonical[q].every((n, k) => n <= available[k])
                    ? [canonical[q]]
                    : [];
            for (const group of preferred) {
                const route = solve(
                    q + 1,
                    available.map((n, k) => n - group[k]),
                    false,
                );
                if (route) return [group, ...route];
            }
            const options = groups(
                available,
                target,
                first ? 7 - game.slot.length : 7,
            ).sort(
                (a, b) =>
                    a.reduce(
                        (s, n, k) => s + Math.abs(n - canonical[q][k]),
                        0,
                    ) -
                    b.reduce((s, n, k) => s + Math.abs(n - canonical[q][k]), 0),
            );
            for (const group of options.filter(
                (g) => !preferred.some((p) => same(g, p)),
            )) {
                const route = solve(
                    q + 1,
                    available.map((n, k) => n - group[k]),
                    false,
                );
                if (route) return [group, ...route];
            }
            return null;
        }
        const route =
            !game.slot.length && same(qty, suffix[game.q])
                ? canonical.slice(game.q)
                : solve(game.q, qty, Boolean(game.slot.length));
        cached = { vectors: route, unknown };
        if (allocationCache.size >= 4096)
            allocationCache.delete(allocationCache.keys().next().value);
        allocationCache.set(key, cached);
    }
    if (!cached.vectors) return { route: null, unknown: cached.unknown };
    const byKind = range(24).map((k) =>
        remaining.filter((i) => game.level.cards[i] === k),
    );
    return {
        route: cached.vectors.map((v) =>
            v.flatMap((n, k) => byKind[k].splice(0, n)),
        ),
        unknown: cached.unknown,
    };
}
export function repairLayout(game, route) {
    const occupied = new Set([...game.board].map((i) => game.locations[i])),
        adjacency = geometry(game.level),
        order = [];
    while (occupied.size) {
        const free = [...occupied]
            .sort((a, b) => a - b)
            .filter((p) => !adjacency[p].some((j) => occupied.has(j)));
        requireThat(free.length, "cyclic geometry");
        order.push(...free);
        for (const p of free) occupied.delete(p);
    }
    const cards = route.flat().filter((i) => game.board.has(i));
    requireThat(
        cards.length === game.board.size &&
            new Set(cards).size === cards.length,
        "allocation does not conserve cards",
    );
    const positions = [...game.locations];
    cards.forEach((i, n) => (positions[i] = order[n]));
    const rank = new Map(order.map((p, n) => [p, n]));
    const paths = route.map((g) =>
        [...g].sort(
            (i, j) =>
                (game.board.has(i) ? rank.get(positions[i]) : -1) -
                (game.board.has(j) ? rank.get(positions[j]) : -1),
        ),
    );
    const trial = new Game(game.level);
    trial.restore(game.snapshot());
    trial.locations = positions;
    trial.entry = trial.snapshot();
    for (const group of paths) {
        const before = trial.q;
        for (const i of group) trial.take(i);
        requireThat(trial.q === before + 1, "repair timing");
    }
    requireThat(trial.status === "won", "repair did not finish");
    return { positions, paths };
}
function removalPlan(game, route) {
    if (game.slot.length) return null;
    const chosen = new Set(route[0]),
        covers = coverMasks(game.level, game.locations);
    let external = 0n;
    for (const i of chosen)
        if (game.board.has(i)) external |= covers[i] & mask([...game.board]);
    external &= ~mask([...chosen]);
    if (indices(external).length < 1 || indices(external).length > 3)
        return null;
    let left = mask([...game.board]);
    const order = [];
    while (external) {
        const free = indices(external).filter((i) => !(covers[i] & left));
        if (!free.length) return null;
        const i = free[0];
        order.push(i);
        if (same(attributes(game.level, order), game.level.targets[game.q]))
            return null;
        left &= ~BITS[i];
        external &= ~BITS[i];
    }
    const temp = new Set([...game.temp, ...order]),
        pending = new Set(chosen),
        hint = [];
    while (pending.size) {
        const free = [...pending]
            .sort((a, b) => a - b)
            .filter((i) => temp.has(i) || !(covers[i] & left));
        if (!free.length) return null;
        const i = free[0];
        hint.push(i);
        pending.delete(i);
        left &= ~BITS[i];
    }
    return { order, hint };
}
export function play(
    level,
    repeat,
    {
        mode = "enhanced",
        policy = "preview",
        reserve = 0,
        adLimit = 10,
        timing = [2.5, 10, 8, 1.5],
    } = {},
) {
    const game = new Game(level, reserve, adLimit),
        rng = new Random(`${level.seed}:decision:${repeat}`);
    let hint = [],
        caps = 0,
        firstHelp = null,
        reason = "decision-limit";
    for (let decision = 0; decision < 120; decision++) {
        if (game.status !== "playing") {
            reason = game.status;
            break;
        }
        let path;
        if (hint.length) {
            path = hint;
            hint = [];
        } else {
            const found = questionPaths(game, rng);
            caps += Number(found.truncated);
            path = found.paths[0] ?? [];
            if (policy === "preview" && game.q < 11)
                for (const candidate of found.paths) {
                    const next = questionPaths(
                        afterPath(game, candidate),
                        rng,
                        1,
                        1500,
                    );
                    caps += Number(next.truncated);
                    if (next.paths.length) {
                        path = candidate;
                        break;
                    }
                }
        }
        if (path.length) {
            for (const i of path) game.take(i);
            continue;
        }
        if (mode === "none") {
            reason = "abandoned-no-tools";
            break;
        }
        if (
            game.ads === game.adLimit &&
            !Object.values(game.reserves).some(Boolean)
        ) {
            reason = "budget-exhausted";
            break;
        }
        const plan = allocation(game);
        caps += Number(plan.unknown);
        let action = null;
        if (plan.route) {
            const removal = removalPlan(game, plan.route);
            if (removal) action = { tool: "remove", ...removal };
            else {
                const repair = repairLayout(game, plan.route);
                if (
                    [...game.board].some(
                        (i) => repair.positions[i] !== game.locations[i],
                    )
                )
                    action = { tool: "shuffle", ...repair };
            }
        }
        if (!action)
            for (
                let distance = 1;
                distance <= game.history.length;
                distance++
            ) {
                const trial = new Game(level);
                trial.restore(game.history.at(-distance));
                trial.entry = trial.snapshot();
                const result = allocation(trial);
                caps += Number(result.unknown);
                if (result.route) {
                    action = {
                        tool: "rewind",
                        distance,
                        ...repairLayout(trial, result.route),
                    };
                    break;
                }
            }
        if (!action) {
            reason = "no-certified-repair";
            break;
        }
        const source = game.reserves[action.tool] ? "reserve" : "video";
        if (source === "video" && game.ads >= game.adLimit) {
            reason = "budget-exhausted";
            break;
        }
        firstHelp ??= game.q + 1;
        game.grant(action.tool, source);
        if (action.tool === "remove") {
            for (const i of action.order) game.take(i);
            game.remove(action.order);
            hint = action.hint;
        } else if (action.tool === "shuffle") {
            game.shuffle(action.positions, action.paths[0]);
            game.events.at(-1).certificate = action.paths;
            hint = action.paths[0];
        } else {
            game.rewind(
                action.distance,
                action.positions,
                action.paths[action.distance],
            );
            game.events.at(-1).certificate = action.paths;
            for (const group of action.paths.slice(0, action.distance))
                for (const i of group) game.take(i, true);
            hint = action.paths[action.distance];
        }
    }
    const uses = counts(
            game.events
                .filter((e) => TOOLS.includes(e.type))
                .map((e) => e.type),
        ),
        takes = game.events.filter(
            (e) => e.type === "take" && !e.automatic,
        ).length,
        automatic = game.events
            .filter((e) => e.type === "rewind")
            .reduce((s, e) => s + e.distance, 0);
    return {
        seed: level.seed,
        repeat,
        mode,
        policy,
        reserve,
        ad_limit: adLimit,
        won: game.status === "won",
        reason,
        cleared: game.q,
        ads: game.ads,
        tools: uses,
        first_help_question: firstHelp,
        search_limits: caps,
        card_clicks: takes,
        questions_completed: game.questionsCompleted,
        automatic_questions: automatic,
        estimated_play_seconds: Number(
            (
                takes * timing[0] +
                (game.questionsCompleted - automatic) * timing[1] +
                Object.values(uses).reduce((a, b) => a + b, 0) * timing[2] +
                automatic * timing[3]
            ).toFixed(1),
        ),
        events: clone(game.events),
    };
}
export function summary(runs) {
    const winners = runs.filter((r) => r.won),
        paid = winners.filter((r) => r.ads),
        watched = runs.filter((r) => r.ads),
        pct = (n) => Number(((100 * n) / runs.length).toFixed(2));
    const histogram = (items) =>
        Object.fromEntries(
            Object.entries(counts(items)).sort(
                ([a], [b]) => Number(a) - Number(b),
            ),
        );
    const tools = {};
    for (const r of runs)
        for (const [k, n] of Object.entries(r.tools))
            tools[k] = (tools[k] ?? 0) + n;
    return {
        runs: runs.length,
        wins: winners.length,
        win_percent: pct(winners.length),
        video_percent: pct(watched.length),
        cumulative_win_percent: Object.fromEntries(
            range(11).map((n) => [
                String(n),
                pct(winners.filter((r) => r.ads <= n).length),
            ]),
        ),
        paid_winners: paid.length,
        paid_winner_ads_mean: mean(paid.map((r) => r.ads)),
        paid_winner_ads_median: quantile(
            paid.map((r) => r.ads),
            0.5,
        ),
        watched_win_percent: watched.length
            ? (100 * paid.length) / watched.length
            : null,
        watched_one_to_three_win_percent: watched.length
            ? (100 * paid.filter((r) => r.ads <= 3).length) / watched.length
            : null,
        all_ads_mean: mean(runs.map((r) => r.ads)),
        failures_after_ten: runs.filter((r) => !r.won && r.ads === 10).length,
        failures: counts(runs.filter((r) => !r.won).map((r) => r.reason)),
        search_limits: runs.reduce((s, r) => s + r.search_limits, 0),
        estimated_winner_seconds_median: quantile(
            winners.map((r) => r.estimated_play_seconds),
            0.5,
        ),
        estimated_winner_seconds_p90: quantile(
            winners.map((r) => r.estimated_play_seconds),
            0.9,
        ),
        tool_uses: tools,
        video_count_histogram: histogram(runs.map((r) => r.ads)),
        first_help_question_histogram: histogram(
            runs
                .filter((r) => r.first_help_question !== null)
                .map((r) => r.first_help_question),
        ),
        failure_question_histogram: histogram(
            runs.filter((r) => !r.won).map((r) => r.cleared + 1),
        ),
    };
}

export function selectLevel(
    seed,
    profile,
    curve,
    difficulty = "open",
    maxCandidates = 60,
) {
    requireThat(
        ["open", "challenging"].includes(difficulty),
        "unknown difficulty",
    );
    const candidates = [];
    for (
        let attempt = 0;
        attempt < Math.min(maxCandidates, difficulty === "open" ? 1 : 60);
        attempt++
    ) {
        const level = generate(
            difficulty === "open" ? seed : seed * 100 + attempt,
            profile,
            curve,
        );
        if (difficulty === "open")
            return {
                level,
                selection: {
                    requested_seed: seed,
                    candidates: [{ seed: level.seed }],
                },
            };
        const trials = [-3, -2, -1].map((repeat) =>
            play(level, repeat, { mode: "none" }),
        );
        const record = {
            seed: level.seed,
            wins: trials.filter((r) => r.won).length,
            cleared: trials.map((r) => r.cleared),
            search_limits: trials.reduce((n, r) => n + r.search_limits, 0),
        };
        candidates.push(record);
        if (
            !record.wins &&
            !record.search_limits &&
            Math.min(...record.cleared) >= 3
        ) {
            return {
                level,
                selection: {
                    requested_seed: seed,
                    calibration_repeats: [-3, -2, -1],
                    candidates,
                },
            };
        }
    }
    throw new Error(
        "generation candidate budget exhausted; no unqualified fallback",
    );
}
