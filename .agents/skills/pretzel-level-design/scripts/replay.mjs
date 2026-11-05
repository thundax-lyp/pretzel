import {
    TOOLS,
    range,
    clone,
    same,
    requireThat,
    attributes,
    counts,
} from "./catalog.mjs";
import { available } from "./geometry.mjs";
function restore(state, level, i) {
    const anchor = state.anchors[i];
    requireThat(
        state.temp.includes(i) &&
            anchor &&
            !state.board.some((j) => state.locations[j] === anchor.position) &&
            anchor.supports.every(
                ([j, p]) => state.board.includes(j) && state.locations[j] === p,
            ),
        "oracle restoration blocked",
    );
    state.locations[i] = anchor.position;
    state.temp.splice(state.temp.indexOf(i), 1);
    state.board.push(i);
    delete state.anchors[i];
}
function take(state, level, i, allowRestore = true) {
    requireThat(state.slot.length < 7, "replay full slot");
    if (allowRestore && state.temp.includes(i)) restore(state, level, i);
    requireThat(
        state.board.includes(i) &&
            available(
                level,
                new Set(state.board),
                state.locations,
                true,
            ).includes(i),
        "oracle covered or absent card",
    );
    const position = state.locations[i];
    const origin = level.positions[position];
    const supports = [];
    for (let id = 0; id < 48; id++) {
        const below = level.positions[state.locations[id]];
        if (
            below[2] < origin[2] &&
            Math.abs(below[0] - origin[0]) < 1 - 1e-8 &&
            Math.abs(below[1] - origin[1]) < 1 - 1e-8
        )
            supports.push([id, state.locations[id]]);
    }
    state.anchors[i] = { position, supports };
    state.board = state.board.filter((j) => j !== i);
    state.slot.push(i);
}
function matches(state, level) {
    return (
        state.slot.length &&
        same(attributes(level, state.slot), level.targets[state.q])
    );
}
export function certificate(level, state, route) {
    const witness = clone(state);
    requireThat(route.length === 12 - witness.q, "certificate question count");
    for (const group of route) {
        requireThat(group.length, "empty certificate");
        group.forEach((i, n) => {
            take(witness, level, i);
            requireThat(
                Boolean(matches(witness, level)) === (n === group.length - 1),
                "certificate elimination timing",
            );
        });
        witness.slot = [];
        witness.q++;
    }
    requireThat(
        !witness.board.length && !witness.temp.length && !witness.slot.length,
        "certificate leaves cards",
    );
}
export function replay(level, run) {
    let state = {
            board: range(48),
            temp: [],
            slot: [],
            locations: range(48),
            anchors: {},
            q: 0,
        },
        entry = clone(state),
        history = [],
        ads = 0,
        failed = false,
        automaticUntil = null,
        completed = 0;
    const inventory = Object.fromEntries(TOOLS.map((k) => [k, 0])),
        reserves = Object.fromEntries(TOOLS.map((k) => [k, run.reserve]));
    for (const e of run.events) {
        requireThat(!failed && state.q < 12, "event after terminal state");
        if (e.type === "grant") {
            requireThat(TOOLS.includes(e.tool), "unknown reward");
            if (e.source === "reserve") {
                requireThat(reserves[e.tool] > 0, "reserve overspent");
                reserves[e.tool]--;
            } else {
                requireThat(
                    e.source === "video" && ads < run.ad_limit,
                    "video overspent",
                );
                ads++;
            }
            inventory[e.tool]++;
        } else if (e.type === "take") {
            requireThat(
                typeof e.automatic === "boolean",
                "invalid automatic flag",
            );
            requireThat(
                e.automatic
                    ? automaticUntil !== null && state.q < automaticUntil
                    : automaticUntil === null || state.q >= automaticUntil,
                "invalid automatic pick range",
            );
            take(state, level, e.id, false);
        } else if (e.type === "restore") {
            requireThat(
                typeof e.automatic === "boolean" &&
                    (e.automatic
                        ? automaticUntil !== null && state.q < automaticUntil
                        : automaticUntil === null || state.q >= automaticUntil),
                "invalid automatic restoration range",
            );
            restore(state, level, e.id);
        } else if (TOOLS.includes(e.type)) {
            requireThat(inventory[e.type] > 0, "tool without reward");
            if (e.type === "remove") {
                requireThat(
                    e.ids.length >= 1 &&
                        e.ids.length <= 3 &&
                        new Set(e.ids).size === e.ids.length &&
                        e.ids.every((i) => state.slot.includes(i)),
                    "invalid removal",
                );
                state.temp.push(...state.slot.filter((i) => e.ids.includes(i)));
                state.slot = state.slot.filter((i) => !e.ids.includes(i));
            } else {
                if (e.type === "correct") {
                    automaticUntil = state.q;
                    requireThat(
                        Number.isInteger(e.distance) &&
                            e.distance >= 1 &&
                            e.distance <= history.length,
                        "invalid history",
                    );
                    state = clone(history.at(-e.distance));
                    history = history.slice(0, -e.distance);
                }
                if (e.positions) {
                    requireThat(
                        same(
                            [...e.positions].sort((a, b) => a - b),
                            range(48),
                        ) &&
                            range(48).every(
                                (i) =>
                                    state.board.includes(i) ||
                                    e.positions[i] === state.locations[i],
                            ),
                        "invalid position permutation",
                    );
                    if (e.type === "repack")
                        requireThat(
                            state.board.length >= 2 &&
                                state.board.some(
                                    (i) =>
                                        e.positions[i] !== state.locations[i],
                                ),
                            "no-op shuffle",
                        );
                    requireThat(
                        state.temp.concat(state.slot).every((id) => {
                            const anchor = state.anchors[id];
                            return (
                                anchor &&
                                e.positions[id] === anchor.position &&
                                anchor.supports.every(
                                    ([j, p]) => e.positions[j] === p,
                                )
                            );
                        }),
                        "oracle repack changed restoration anchors",
                    );
                    state.locations = [...e.positions];
                }
                if (e.type === "correct") entry = clone(state);
                if (e.certificate) certificate(level, state, e.certificate);
            }
            inventory[e.type]--;
        } else throw new Error("unknown event");
        if (["take", "remove"].includes(e.type)) {
            if (matches(state, level)) {
                history.push(clone(entry));
                state.slot = [];
                state.q++;
                completed++;
                entry = clone(state);
            } else if (state.slot.length === 7) failed = true;
        }
        const all = [...state.board, ...state.temp, ...state.slot];
        requireThat(
            new Set(all).size === all.length,
            "duplicate card location",
        );
    }
    const won =
        state.q === 12 &&
        !state.board.length &&
        !state.temp.length &&
        !state.slot.length;
    requireThat(
        won === run.won && state.q === run.cleared && ads === run.ads,
        "replay result mismatch",
    );
    requireThat(
        Object.values(inventory).every((n) => n === 0),
        "unused reward",
    );
    requireThat(
        automaticUntil === null || state.q >= automaticUntil,
        "incomplete automatic replay",
    );
    requireThat(
        run.restore_clicks ===
            run.events.filter((e) => e.type === "restore" && !e.automatic)
                .length &&
            run.card_clicks ===
                run.events.filter((e) => e.type === "take" && !e.automatic)
                    .length &&
            run.questions_completed === completed &&
            run.automatic_questions ===
                run.events
                    .filter((e) => e.type === "correct")
                    .reduce((s, e) => s + e.distance, 0),
        "action counters mismatch",
    );
    const uses = counts(
        run.events.filter((e) => TOOLS.includes(e.type)).map((e) => e.type),
    );
    requireThat(same(uses, run.tools), "tool counters mismatch");
    return true;
}
