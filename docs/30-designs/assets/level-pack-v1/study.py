"""Paired real-layout study; the main simulator source is imported, never edited."""

import argparse
import copy
import hashlib
import importlib.util
import json
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

from geometry import engine_geometry, metrics
from variants import choose, rehouse

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[3]
ENGINE_SOURCE = PROJECT / "scripts/game-design.py"
ENGINE_HASH = hashlib.sha256(ENGINE_SOURCE.read_bytes()).hexdigest()
SPEC = importlib.util.spec_from_file_location("structure_study_engine", ENGINE_SOURCE)
engine = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = engine
SPEC.loader.exec_module(engine)
# Only this private module instance changes. All paid actions and policies are reused.
engine.geometry = engine_geometry


def require(condition, message):
    if not condition:
        raise ValueError(message)


def area(poly):
    return (
        abs(sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(poly, poly[1:] + poly[:1]))) / 2
        if poly
        else 0
    )


def intersect(subject, clip):
    # Independent polygon clipping oracle, not the generator's separating-axis test.
    output = subject[:]
    for a, b in zip(clip, clip[1:] + clip[:1]):
        source, output = output, []
        if not source:
            break

        def side(p):
            return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])

        previous = source[-1]
        for current in source:
            sp, sc = side(previous), side(current)
            pin, cin = sp >= -1e-9, sc >= -1e-9
            if pin != cin:
                t = sp / (sp - sc)
                output.append(
                    (
                        previous[0] + t * (current[0] - previous[0]),
                        previous[1] + t * (current[1] - previous[1]),
                    )
                )
            if cin:
                output.append(current)
            previous = current
    return output


@lru_cache(maxsize=256)
def oracle_geometry(positions, projection=(28, 16, 14, 14)):
    sx, sy, sz, thick = projection
    order = sorted(
        range(len(positions)),
        key=lambda i: (positions[i][0] + positions[i][1], positions[i][2], positions[i][0]),
    )
    rank = {i: n for n, i in enumerate(order)}
    faces, bodies = [], []
    for x, y, z in positions:
        px, py = (x - y) * sx, (x + y) * sy - z * sz
        faces.append([(px, py), (px + sx, py + sy), (px, py + 2 * sy), (px - sx, py + sy)])
        bodies.append(
            [
                (px, py),
                (px + sx, py + sy),
                (px + sx, py + sy + thick),
                (px, py + 2 * sy + thick),
                (px - sx, py + sy + thick),
                (px - sx, py + sy),
            ]
        )
    return tuple(
        tuple(
            j
            for j in range(len(positions))
            if rank[j] > rank[i] and area(intersect(face, bodies[j])) > 1e-7
        )
        for i, face in enumerate(faces)
    )


def visible(level, state, card):
    location = state["positions"][card]
    occupied = {state["positions"][i] for i in state["board"]}
    return not set(oracle_geometry(level.positions)[location]) & occupied


def take(state, level, card):
    require(len(state["slot"]) < 7, "full slot")
    if card in state["temp"]:
        state["temp"].remove(card)
    else:
        require(card in state["board"] and visible(level, state, card), "covered or absent card")
        state["board"].remove(card)
    state["slot"].append(card)


def matched(state, level):
    return (
        bool(state["slot"]) and engine.attributes(level, state["slot"]) == level.targets[state["q"]]
    )


def certificate(level, state, route):
    witness = copy.deepcopy(state)
    require(len(route) == 12 - witness["q"], "certificate target count")
    for group in route:
        require(bool(group), "empty certificate group")
        for n, i in enumerate(group):
            take(witness, level, i)
            require(matched(witness, level) == (n == len(group) - 1), "certificate timing")
        witness["slot"] = []
        witness["q"] += 1
    require(not witness["board"] and not witness["temp"], "certificate leaves cards")


def replay(level, run):
    state = {"board": set(range(48)), "temp": [], "slot": [], "positions": list(range(48)), "q": 0}
    entry, history = copy.deepcopy(state), []
    inventory, reserves = Counter(), dict.fromkeys(engine.TOOLS, run["reserve"])
    ads, completed, automatic_until = 0, 0, None
    failed = False
    for e in run["events"]:
        require(not failed and state["q"] < 12, "event after end")
        kind = e["type"]
        if kind == "grant":
            tool = e["tool"]
            require(tool in engine.TOOLS, "unknown tool")
            if e["source"] == "reserve":
                require(reserves[tool] > 0, "reserve overspent")
                reserves[tool] -= 1
            else:
                require(e["source"] == "video" and ads < run["ad_limit"], "video limit")
                ads += 1
            inventory[tool] += 1
        elif kind == "take":
            require(
                (automatic_until is not None and state["q"] < automatic_until)
                if e["automatic"]
                else (automatic_until is None or state["q"] >= automatic_until),
                "invalid automatic recovery interval",
            )
            take(state, level, e["id"])
        elif kind in engine.TOOLS:
            require(inventory[kind] > 0, "unpaid tool")
            if kind == "remove":
                selected = e["ids"]
                require(
                    1 <= len(selected) <= 3
                    and len(set(selected)) == len(selected)
                    and set(selected) <= set(state["slot"]),
                    "invalid removal",
                )
                state["temp"].extend(i for i in state["slot"] if i in selected)
                state["slot"] = [i for i in state["slot"] if i not in selected]
            else:
                if kind == "rewind":
                    automatic_until = state["q"]
                    distance = e["distance"]
                    require(1 <= distance <= len(history), "invalid history")
                    state = copy.deepcopy(history[-distance])
                    history = history[:-distance]
                proposed, old = e["positions"], state["positions"]
                if proposed is not None:
                    require(
                        len(proposed) == 48 and sorted(proposed) == list(range(48)),
                        "invalid permutation",
                    )
                    require(
                        all(proposed[i] == old[i] for i in range(48) if i not in state["board"]),
                        "moved non-board card",
                    )
                    if kind == "shuffle":
                        require(
                            len(state["board"]) >= 2
                            and any(proposed[i] != old[i] for i in state["board"]),
                            "no-op shuffle",
                        )
                    state["positions"] = proposed[:]
                if kind == "rewind":
                    entry = copy.deepcopy(state)
                if "certificate" in e:
                    certificate(level, state, e["certificate"])
            inventory[kind] -= 1
        else:
            raise ValueError("unknown event")
        if kind in ("take", "remove"):
            if matched(state, level):
                history.append(copy.deepcopy(entry))
                state["slot"] = []
                state["q"] += 1
                completed += 1
                entry = copy.deepcopy(state)
            elif len(state["slot"]) == 7:
                failed = True
        occupied = [state["board"], set(state["temp"]), set(state["slot"])]
        require(sum(map(len, occupied)) == len(set.union(*occupied)), "duplicate instance")
        require(len(state["temp"]) == len(set(state["temp"])), "duplicate storage")
    won = state["q"] == 12 and not state["board"] and not state["slot"] and not state["temp"]
    require(
        won == run["won"] and state["q"] == run["cleared"] and ads == run["ads"],
        "replay result mismatch",
    )
    require(not any(inventory.values()), "unused grant")
    require(automatic_until is None or state["q"] >= automatic_until, "unfinished auto repair")
    require(completed == run["questions_completed"], "completion count mismatch")
    require(
        run["tools"]
        == dict(Counter(e["type"] for e in run["events"] if e["type"] in engine.TOOLS)),
        "tool count mismatch",
    )
    require(
        run["card_clicks"]
        == sum(e["type"] == "take" and not e["automatic"] for e in run["events"]),
        "manual click mismatch",
    )
    return len(run["events"])


def imported(level, seed, name):
    return engine.Level(
        seed,
        name,
        tuple(c["animal"] for c in level["cards"]),
        tuple((c["x"], c["y"], c["z"]) for c in level["cards"]),
        tuple((t["eyes"], t["legs"]) for t in level["targets"]),
        tuple(map(tuple, level["reference"])),
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--repeat-start", type=int, default=10)
    parser.add_argument("--sets", type=int, default=20)
    args = parser.parse_args()
    base = json.loads((ROOT / "height-study/baseline-levels.json").read_text())
    require(
        [(a["name"], a["eyes"], a["legs"]) for a in base["animals"]] == list(engine.ANIMALS),
        "animal vocabulary differs from main simulator",
    )
    report, exported = {}, []
    geometry_checks, event_checks = 0, 0
    out = ROOT / "height-study"
    for variant in (4, 6, 7, 8):
        samples = []
        for index, pack in enumerate(base["packs"][: args.sets]):
            if variant == 4:
                source = copy.deepcopy(pack["hard"])
                source["maxLayers"] = 4
            else:
                _, positions = choose(variant, index)
                source = rehouse(pack["hard"], positions, 2026110300 + index)
            level = imported(source, 2026110300 + index, f"actual-structure-{variant}")
            require(
                engine_geometry(level.positions) == oracle_geometry(level.positions),
                "geometry oracle disagreement",
            )
            require(
                [list(row) for row in engine_geometry(level.positions)] == source["blockers"],
                "import changed covering",
            )
            geometry_checks += 1
            reference_game = engine.Game(level)
            for group in level.reference:
                for i in group:
                    reference_game.take(i)
            require(reference_game.status == "won", "reference failed")
            geometry_metrics = metrics(source["cards"], source["reference"])
            samples.append((level, source, geometry_metrics))
            exported.append(
                {
                    "variant": variant,
                    "theme": pack["slug"],
                    "seed": level.seed,
                    "level": source,
                    "metrics": geometry_metrics,
                }
            )
        report[str(variant)] = {"structure": [s[2] for s in samples], "groups": {}}
        for mode, reserve, label in [
            ("none", 0, "no-tools"),
            ("enhanced", 0, "zero-reserve"),
            ("enhanced", 1, "full-reserve"),
        ]:
            runs = []
            for level, source, _ in samples:
                for repeat in range(args.repeat_start, args.repeat_start + args.repeats):
                    run = engine.play(level, repeat, mode, reserve=reserve)
                    event_checks += replay(level, run)
                    runs.append(run)
            engine.write_json(out / f"{variant}-{label}-runs.json", runs)
            report[str(variant)]["groups"][label] = engine.summary(runs)
            print(variant, label, json.dumps(report[str(variant)]["groups"][label]), flush=True)
    meta = {
        "engineSha256": ENGINE_HASH,
        "adapter": "private import; only geometry replaced by fixed-view top-face/body SAT; independent polygon-clipping replay",
        "animalSets": args.sets,
        "decisionRepeatStart": args.repeat_start,
        "repeats": args.repeats,
        "geometryOracleMatches": geometry_checks,
        "independentReplayEvents": event_checks,
        "sourceLayouts": "baseline-levels.json and exact 6/7/8 layer volume variants, not main engine templates",
        "timingAssumptions": [2.5, 10, 8, 1.5],
        "humanCalibration": False,
    }
    engine.write_json(out / "variants.json", exported)
    (out / "variants.js").write_text(
        "window.STRUCTURE_STUDY = " + json.dumps(exported, ensure_ascii=False, indent=4) + ";\n"
    )
    engine.write_json(out / "results.json", {"metadata": meta, "variants": report})


if __name__ == "__main__":
    main()
