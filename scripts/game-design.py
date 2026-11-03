"""Seeded, offline level-design experiments; not a production game server."""

import argparse
import copy
import hashlib
import json
import math
import random
import statistics
from collections import Counter
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

ANIMALS = (
    ("泡泡鱼", 2, 0),
    ("跳跳鸟", 2, 1),
    ("小黄鸡", 2, 2),
    ("三脚鸭", 2, 3),
    ("短腿兔", 2, 4),
    ("五脚蛙", 2, 5),
    ("小甲虫", 2, 6),
    ("横横蟹", 2, 8),
    ("独眼蛇", 1, 0),
    ("独眼鸡", 1, 2),
    ("独眼猪", 1, 4),
    ("独眼虫", 1, 6),
    ("三眼跳跳", 3, 1),
    ("三眼企鹅", 3, 2),
    ("三眼猫", 3, 4),
    ("三眼蚂蚁", 3, 6),
    ("四眼鱼", 4, 0),
    ("四眼鸭", 4, 2),
    ("四眼狗", 4, 4),
    ("四眼蛛", 4, 8),
    ("五眼鸟", 5, 2),
    ("五眼兽", 5, 4),
    ("六眼牛", 6, 4),
    ("六眼虫", 6, 6),
)
TOOLS = ("remove", "rewind", "shuffle")
PROFILES = ("four-peaks", "three-peaks", "two-peaks")


CURVES = {
    "balanced": (3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5),
    "branching": (3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6),
    "steep": (3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6),
    "late-six": (3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 6, 6),
}


def question_sizes(profile, curve="balanced"):
    require(profile in PROFILES, "unknown layout profile")
    return CURVES[curve]


def require(condition, message):
    if not condition:
        raise ValueError(message)


@dataclass(frozen=True)
class Level:
    seed: int
    profile: str
    cards: tuple
    positions: tuple
    targets: tuple
    reference: tuple
    curve: str = "balanced"
    visibility: str = "logical-xy"
    projection: tuple = (28, 16, 14, 14)
    source_id: str = ""

    def __post_init__(self):
        if not self.source_id:
            object.__setattr__(self, "source_id", f"native:{self.profile}:{self.curve}:{self.seed}")

    @classmethod
    def load(cls, value):
        return cls(
            value["seed"],
            value["profile"],
            tuple(value["cards"]),
            tuple(tuple(p) for p in value["positions"]),
            tuple(tuple(t) for t in value["targets"]),
            tuple(tuple(g) for g in value["reference"]),
            value["curve"],
            value.get("visibility", "logical-xy"),
            tuple(value.get("projection", (28, 16, 14, 14))),
            value.get("source_id", ""),
        )


def attributes(level, ids):
    return tuple(sum(ANIMALS[level.cards[i]][axis] for i in ids) for axis in (1, 2))


@lru_cache(maxsize=128)
def geometry(positions):
    return tuple(
        tuple(
            j
            for j, (xx, yy, zz) in enumerate(positions)
            if zz > z and abs(x - xx) < 1 - 1e-8 and abs(y - yy) < 1 - 1e-8
        )
        for x, y, z in positions
    )


def polygon_overlap(a, b):
    # Producer: separating-axis theorem, with boundary contact excluded.
    for polygon in (a, b):
        for p, q in zip(polygon, polygon[1:] + polygon[:1]):
            nx, ny = -(q[1] - p[1]), q[0] - p[0]
            pa = [x * nx + y * ny for x, y in a]
            pb = [x * nx + y * ny for x, y in b]
            if min(max(pa), max(pb)) <= max(min(pa), min(pb)) + 1e-8:
                return False
    return True


def clipped_area(subject, clip):
    # Oracle: polygon clipping, deliberately independent of SAT.
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
            if (sp >= -1e-9) != (sc >= -1e-9):
                t = sp / (sp - sc)
                output.append(
                    (
                        previous[0] + t * (current[0] - previous[0]),
                        previous[1] + t * (current[1] - previous[1]),
                    )
                )
            if sc >= -1e-9:
                output.append(current)
            previous = current
    return (
        abs(sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(output, output[1:] + output[:1]))) / 2
        if output
        else 0
    )


@lru_cache(maxsize=256)
def projected_geometry(positions, projection, oracle=False):
    sx, sy, sz, thickness = projection
    order = sorted(
        range(len(positions)),
        key=lambda i: (positions[i][0] + positions[i][1], positions[i][2], positions[i][0]),
    )
    rank = {i: n for n, i in enumerate(order)}
    faces, bodies = [], []
    for x, y, z in positions:
        px, py = (x - y) * sx, (x + y) * sy - z * sz
        face = [(px, py), (px + sx, py + sy), (px, py + 2 * sy), (px - sx, py + sy)]
        faces.append(face)
        bodies.append(
            [
                face[0],
                face[1],
                (px + sx, py + sy + thickness),
                (px, py + 2 * sy + thickness),
                (px - sx, py + sy + thickness),
                face[3],
            ]
        )
    return tuple(
        tuple(
            j
            for j in range(len(positions))
            if rank[j] > rank[i]
            and (
                clipped_area(face, bodies[j]) > 1e-7 if oracle else polygon_overlap(face, bodies[j])
            )
        )
        for i, face in enumerate(faces)
    )


def level_geometry(level):
    if level.visibility == "logical-xy":
        return geometry(level.positions)
    require(level.visibility == "isometric-body", "unknown visibility model")
    return projected_geometry(level.positions, level.projection)


def oracle_geometry(level):
    if level.visibility == "isometric-body":
        return projected_geometry(level.positions, level.projection, True)
    require(level.visibility == "logical-xy", "unknown visibility model")
    return tuple(
        tuple(
            j
            for j, b in enumerate(level.positions)
            if b[2] > a[2] and abs(a[0] - b[0]) < 1 - 1e-8 and abs(a[1] - b[1]) < 1 - 1e-8
        )
        for a in level.positions
    )


def oracle_visible(level, state, card):
    occupied = {state["positions"][i] for i in state["board"]}
    return not set(oracle_geometry(level)[state["positions"][card]]) & occupied


def blockers(level, locations):
    occupants = {position: i for i, position in enumerate(locations)}
    return tuple(
        sum(1 << occupants[p] for p in level_geometry(level)[location]) for location in locations
    )


def ids(mask):
    while mask:
        flag = mask & -mask
        yield flag.bit_length() - 1
        mask ^= flag


def open_cards(board, temp, covers):
    return [i for i in ids(board | temp) if temp & (1 << i) or not covers[i] & board]


def layout(profile):
    require(profile in PROFILES, "unknown layout profile")
    rows = {
        "four-peaks": (4, 3, 3, 2),
        "three-peaks": (5, 5, 4, 2),
        "two-peaks": (8, 7, 6, 3),
    }[profile]
    positions = []
    for peak in range(4 if profile == "four-peaks" else 2 if profile.startswith("two") else 3):
        for layer, n in enumerate(rows):
            xs = [(i - (n - 1) / 2) * 0.8 for i in range(n)]
            if profile.startswith("three-peaks") and layer == 3:
                xs = [-0.8, 0.8]
            if profile.startswith("two-peaks") and layer == 3:
                xs = [-1.6, 0, 1.6]
            positions.extend((peak * 6 + x, (0, 0.12, -0.12, 0)[layer], layer) for x in xs)
    return tuple(positions)


def generate(seed, profile, curve="balanced"):
    rng = random.Random(seed)
    positions = layout(profile)
    dummy = Level(seed, profile, (), positions, (), ())
    covers = blockers(dummy, list(range(len(positions))))
    odd_kinds = (1, 3, 5, 12)
    for _ in range(10000):
        kinds = [rng.randrange(20, 24)] + rng.sample(odd_kinds, 3)
        kinds += rng.sample([k for k in range(20) if k not in odd_kinds], 8)
        counts = Counter(kinds)
        while counts.total() < len(positions):
            possible = [k for k in kinds if counts[k] < (4 if k >= 20 else 6)]
            counts[rng.choice(possible)] += 1
        if not 4 <= sum(n for k, n in counts.items() if ANIMALS[k][2] % 2) <= 8:
            continue
        if not 2 <= sum(n for k, n in counts.items() if k >= 20) <= 4:
            continue
        animals = [k for k, n in counts.items() for _ in range(n)]
        rng.shuffle(animals)
        remaining = (1 << len(positions)) - 1
        top = open_cards(remaining, 0, covers)
        rng.shuffle(top)
        order = top[:]
        for i in top:
            remaining ^= 1 << i
        while remaining:
            i = rng.choice(open_cards(remaining, 0, covers))
            order.append(i)
            remaining ^= 1 << i
        cards = [0] * len(positions)
        for i, animal in zip(order, animals):
            cards[i] = animal
        groups, targets, offset = [], [], 0
        partial = Level(seed, profile, tuple(cards), positions, (), ())
        for size in question_sizes(profile, curve):
            group = tuple(order[offset : offset + size])
            groups.append(group)
            targets.append(attributes(partial, group))
            offset += size
        if any(a == b for a, b in zip(targets, targets[1:])):
            continue
        if max(Counter(targets).values()) > 2:
            continue
        result = Level(seed, profile, tuple(cards), positions, tuple(targets), tuple(groups), curve)
        check_level(result)
        return result
    raise ValueError("content generation exceeded budget")


class Game:
    """Rules and paid actions. All mutations are recorded for independent replay."""

    def __init__(self, level, reserve=0, ad_limit=10):
        require(reserve in (0, 1) and 0 <= ad_limit <= 10, "invalid tool allowance")
        self.level = level
        self.board = (1 << len(level.cards)) - 1
        self.temp, self.slot = [], []
        self.locations = list(range(len(level.cards)))
        self.q, self.status = 0, "playing"
        self.questions_completed = 0
        self.ads, self.ad_limit = 0, ad_limit
        self.reserves = dict.fromkeys(TOOLS, reserve)
        self.inventory = dict.fromkeys(TOOLS, 0)
        self.events, self.history = [], []
        self.entry = self.snapshot()

    def snapshot(self):
        return (self.board, self.temp[:], self.slot[:], self.locations[:], self.q)

    def restore(self, snapshot):
        self.board, temp, slot, positions, self.q = copy.deepcopy(snapshot)
        self.temp, self.slot, self.locations = temp, slot, positions

    def active(self):
        require(self.status == "playing", "game is not active")

    def settle_slot(self):
        if self.slot and attributes(self.level, self.slot) == self.level.targets[self.q]:
            self.history.append(self.entry)
            self.slot = []
            self.q += 1
            self.questions_completed += 1
            if self.q == len(self.level.targets):
                require(not self.board and not self.temp, "final question left cards")
                self.status = "won"
            self.entry = self.snapshot()
        elif len(self.slot) == 7:
            self.status = "failed"

    def take(self, i, automatic=False):
        self.active()
        require(isinstance(i, int) and 0 <= i < len(self.level.cards), "unknown card")
        require(len(self.slot) < 7, "slot is full")
        if i in self.temp:
            self.temp.remove(i)
        else:
            covers = blockers(self.level, self.locations)
            require(self.board & (1 << i) and not covers[i] & self.board, "card covered or absent")
            self.board &= ~(1 << i)
        self.slot.append(i)
        self.events.append({"type": "take", "id": i, "automatic": automatic})
        self.settle_slot()

    def grant(self, tool, source="video"):
        self.active()
        require(tool in TOOLS, "unknown tool")
        if source == "reserve":
            require(self.reserves[tool] > 0, "no reserve")
            self.reserves[tool] -= 1
        else:
            require(source == "video" and self.ads < self.ad_limit, "video limit")
            self.ads += 1
        self.inventory[tool] += 1
        self.events.append({"type": "grant", "tool": tool, "source": source})

    def consume(self, tool):
        self.active()
        require(self.inventory[tool] > 0, "tool not acquired")
        self.inventory[tool] -= 1

    def remove(self, selected):
        self.active()
        require(
            1 <= len(selected) <= 3
            and len(set(selected)) == len(selected)
            and set(selected) <= set(self.slot),
            "select 1-3 slot cards",
        )
        self.consume("remove")
        chosen = [i for i in self.slot if i in selected]
        self.slot = [i for i in self.slot if i not in selected]
        self.temp.extend(chosen)
        self.events.append({"type": "remove", "ids": chosen})
        self.settle_slot()

    def shuffle(self, positions, hint=()):
        self.active()
        require(
            len(positions) == len(self.locations)
            and sorted(positions) == list(range(len(positions))),
            "invalid permutation",
        )
        require(self.board.bit_count() >= 2, "not enough board cards")
        require(
            all(
                positions[i] == self.locations[i]
                for i in range(len(positions))
                if not self.board & (1 << i)
            ),
            "shuffle moved a non-board card",
        )
        require(
            any(positions[i] != self.locations[i] for i in ids(self.board)), "no position change"
        )
        self.consume("shuffle")
        self.locations = list(positions)
        self.events.append({"type": "shuffle", "positions": self.locations[:], "hint": list(hint)})

    def rewind(self, distance, positions=None, hint=()):
        self.active()
        require(1 <= distance <= len(self.history), "invalid rewind distance")
        snapshot = self.history[-distance]
        if positions is not None:
            restored_board, _, _, old, _ = snapshot
            require(
                len(positions) == len(old) and sorted(positions) == list(range(len(old))),
                "invalid recovery permutation",
            )
            require(
                all(
                    positions[i] == old[i] for i in range(len(old)) if not restored_board & (1 << i)
                ),
                "recovery moved a non-board card",
            )
        self.consume("rewind")
        self.restore(snapshot)
        self.history = self.history[:-distance]
        if positions is not None:
            self.locations = list(positions)
        self.entry = self.snapshot()
        self.events.append(
            {"type": "rewind", "distance": distance, "positions": positions, "hint": list(hint)}
        )


def check_level(level):
    require(
        len(level.cards) == 48 and len(level.targets) == 12,
        "invalid card count or question count",
    )
    require(
        len(level.positions) == len(level.cards) and len(set(level.positions)) == len(level.cards),
        "invalid positions",
    )
    require(all(type(k) is int and 0 <= k < len(ANIMALS) for k in level.cards), "unknown animal")
    require(type(level.source_id) is str and bool(level.source_id), "invalid source identity")
    require(
        all(
            len(t) == 2 and all(type(v) is int and v >= 0 for v in t) and t[0] > 0
            for t in level.targets
        ),
        "invalid target counts",
    )
    require(level.visibility in ("logical-xy", "isometric-body"), "unknown visibility model")
    require(
        len(level.projection) == 4 and all(math.isfinite(x) and x > 0 for x in level.projection),
        "invalid projection",
    )
    require(
        all(
            len(p) == 3
            and all(type(v) in (int, float) and math.isfinite(v) for v in p)
            and type(p[2]) is int
            and 0 <= p[2] < 48
            for p in level.positions
        ),
        "invalid coordinate",
    )
    require(type(level.seed) is int, "invalid seed")
    require(level_geometry(level) == oracle_geometry(level), "geometry oracles disagree")
    game = Game(level)
    require(len(level.reference) == 12, "missing reference groups")
    for q, group in enumerate(level.reference):
        require(game.q == q, "invalid reference order")
        for i in group:
            game.take(i)
        require(game.q == q + 1, "reference does not clear question")
    require(game.status == "won", "reference did not finish")


def question_paths(game, rng, limit=16, budget=3000):
    covers = blockers(game.level, game.locations)
    target = game.level.targets[game.q]
    temp_mask = sum(1 << i for i in game.temp)
    initial = attributes(game.level, game.slot)
    visited, result = set(), []
    nodes, truncated = 0, False

    def walk(board, temp, e, legs, path):
        nonlocal nodes, truncated
        if len(result) >= limit:
            return
        if nodes >= budget:
            truncated = True
            return
        key = (board, temp)
        if key in visited:
            return
        visited.add(key)
        nodes += 1
        if path and (e, legs) == target:
            result.append(path)
            return
        if len(path) + len(game.slot) >= 7:
            return
        free = open_cards(board, temp, covers)
        rng.shuffle(free)
        for i in free:
            a, b = ANIMALS[game.level.cards[i]][1:]
            if e + a <= target[0] and legs + b <= target[1]:
                flag = 1 << i
                walk(board & ~flag, temp & ~flag, e + a, legs + b, path + [i])

    walk(game.board, temp_mask, *initial, [])
    return result, truncated


def after_path(game, path):
    trial = copy.copy(game)
    removed = sum(1 << i for i in path)
    trial.board = game.board & ~removed
    trial.temp = [i for i in game.temp if i not in path]
    trial.slot = []
    trial.q = game.q + 1
    return trial


def counts_for(level, card_ids):
    counter = Counter(level.cards[i] for i in card_ids)
    return tuple(counter[k] for k in range(len(ANIMALS)))


def _allocation(game, budget=12000):
    """Tool-only full-sequence numerical solver; UNKNOWN is not proof of no solution."""
    remaining = list(ids(game.board)) + game.temp
    counts = counts_for(game.level, remaining)
    canonical = [counts_for(game.level, group) for group in game.level.reference]
    canonical_remaining = [
        tuple(sum(c[k] for c in canonical[q:]) for k in range(24)) for q in range(12)
    ]
    seen = set()
    nodes, unknown = 0, False

    def groups(available, target, capacity):
        kinds = [k for k, n in enumerate(available) if n]
        options = []
        checked = 0
        vector = [0] * 24

        def visit(index, e, legs, n):
            nonlocal checked, unknown
            if checked >= 6000 or len(options) >= 128:
                unknown = True
                return
            checked += 1
            if n and (e, legs) == target:
                options.append(tuple(vector))
                return
            if index == len(kinds) or n == capacity:
                return
            k = kinds[index]
            a, b = ANIMALS[k][1:]
            for take in range(min(available[k], capacity - n, (target[0] - e) // a) + 1):
                if legs + take * b <= target[1]:
                    vector[k] = take
                    visit(index + 1, e + take * a, legs + take * b, n + take)
            vector[k] = 0

        if min(target) >= 0 and capacity > 0:
            visit(0, 0, 0, 0)
        return options

    def solve(q, available, first):
        nonlocal nodes, unknown
        if q == 12:
            return [] if not any(available) else None
        if nodes >= budget:
            unknown = True
            return None
        key = (q, available)
        if key in seen:
            return None
        seen.add(key)
        nodes += 1
        if not first and available == canonical_remaining[q]:
            return canonical[q:]
        held = attributes(game.level, game.slot) if first else (0, 0)
        target = tuple(game.level.targets[q][a] - held[a] for a in (0, 1))
        if not first and all(canonical[q][k] <= available[k] for k in range(24)):
            preferred = [canonical[q]]
        else:
            preferred = []
        for group in preferred:
            left = tuple(a - b for a, b in zip(available, group))
            route = solve(q + 1, left, False)
            if route is not None:
                return [group] + route
        options = groups(available, target, 7 - len(game.slot) if first else 7)
        options.sort(key=lambda g: sum(abs(a - b) for a, b in zip(g, canonical[q])))
        for group in [g for g in options if g not in preferred]:
            left = tuple(a - b for a, b in zip(available, group))
            route = solve(q + 1, left, False)
            if route is not None:
                return [group] + route
        return None

    if not game.slot and counts == canonical_remaining[game.q]:
        vectors = canonical[game.q :]
    else:
        vectors = solve(game.q, counts, bool(game.slot))
    if vectors is None:
        return None, unknown
    by_kind = {k: [i for i in remaining if game.level.cards[i] == k] for k in range(24)}
    route = []
    for vector in vectors:
        group = []
        for k, n in enumerate(vector):
            group.extend(by_kind[k][:n])
            by_kind[k] = by_kind[k][n:]
        route.append(group)
    return route, unknown


ALLOCATION_CACHE = {}


def allocation(game, budget=12000):
    remaining = list(ids(game.board)) + game.temp
    key = (
        game.level.cards,
        game.level.targets,
        game.level.reference,
        game.q,
        counts_for(game.level, remaining),
        attributes(game.level, game.slot),
        len(game.slot),
        budget,
    )
    if key not in ALLOCATION_CACHE:
        route, unknown = _allocation(game, budget)
        vectors = [counts_for(game.level, group) for group in route] if route is not None else None
        if len(ALLOCATION_CACHE) >= 4096:
            ALLOCATION_CACHE.pop(next(iter(ALLOCATION_CACHE)))
        ALLOCATION_CACHE[key] = (vectors, unknown)
    vectors, unknown = ALLOCATION_CACHE[key]
    if vectors is None:
        return None, unknown
    by_kind = {k: [i for i in remaining if game.level.cards[i] == k] for k in range(24)}
    route = []
    for vector in vectors:
        group = []
        for k, n in enumerate(vector):
            group.extend(by_kind[k][:n])
            by_kind[k] = by_kind[k][n:]
        route.append(group)
    return route, unknown


def repair_layout(game, route):
    """Place a certified whole remaining allocation on current occupied positions."""
    board_ids = list(ids(game.board))
    occupied = {game.locations[i] for i in board_ids}
    position_order = []
    adjacency = level_geometry(game.level)
    while occupied:
        free = sorted(p for p in occupied if not set(adjacency[p]) & occupied)
        require(bool(free), "cyclic geometry")
        position_order.extend(free)
        occupied.difference_update(free)
    ordered_cards = [i for group in route for i in group if game.board & (1 << i)]
    require(
        len(ordered_cards) == len(board_ids) and set(ordered_cards) == set(board_ids),
        "allocation does not conserve board cards",
    )
    positions = game.locations[:]
    for i, p in zip(ordered_cards, position_order):
        positions[i] = p
    # Sort each group by new topological position; temporary cards may be taken anytime.
    rank = {p: n for n, p in enumerate(position_order)}
    paths = [
        sorted(group, key=lambda i: rank[positions[i]] if game.board & (1 << i) else -1)
        for group in route
    ]
    trial = Game(game.level)
    trial.restore(game.snapshot())
    trial.locations = positions[:]
    trial.entry = trial.snapshot()
    for group in paths:
        before = trial.q
        for i in group:
            trial.take(i)
        require(trial.q == before + 1, "repair path failed")
    require(trial.status == "won", "repair route did not finish")
    return positions, paths


def removal_plan(game, route):
    if game.slot:
        return None
    chosen = set(route[0])
    covers = blockers(game.level, game.locations)
    external = 0
    for i in chosen:
        if game.board & (1 << i):
            external |= covers[i] & game.board
    external &= ~sum(1 << i for i in chosen)
    if not 1 <= external.bit_count() <= 3:
        return None
    left, order = game.board, []
    while external:
        free = [i for i in ids(external) if not covers[i] & left]
        if not free:
            return None
        i = free[0]
        order.append(i)
        if attributes(game.level, order) == game.level.targets[game.q]:
            return None
        left &= ~(1 << i)
        external &= ~(1 << i)
    temp = set(game.temp) | set(order)
    hint = []
    pending = chosen.copy()
    while pending:
        free = sorted(i for i in pending if i in temp or not covers[i] & left)
        if not free:
            return None
        i = free[0]
        hint.append(i)
        pending.remove(i)
        left &= ~(1 << i)
    return order, hint


def play(level, repeat, mode, policy="preview", reserve=0, ad_limit=10, timing=(2.5, 10, 8, 1.5)):
    game = Game(level, reserve, ad_limit)
    rng = random.Random(level.seed * 10 + repeat)
    hint = []
    caps = 0
    first_help = None
    reason = "decision-limit"
    for _ in range(120):
        if game.status != "playing":
            reason = game.status
            break
        if hint:
            path, hint = hint, []
        else:
            options, truncated = question_paths(game, rng)
            caps += truncated
            path = options[0] if options else []
            if policy == "preview" and game.q < 11:
                for candidate in options:
                    following, truncated = question_paths(after_path(game, candidate), rng, 1, 1500)
                    caps += truncated
                    if following:
                        path = candidate
                        break
        if path:
            for i in path:
                game.take(i)
            continue
        if mode == "none":
            reason = "abandoned-no-tools"
            break
        if game.ads == game.ad_limit and not any(game.reserves.values()):
            reason = "budget-exhausted"
            break
        plan, unknown = allocation(game)
        caps += unknown
        action = None
        if plan:
            removal = removal_plan(game, plan)
            if removal:
                action = ("remove", *removal)
            else:
                positions, paths = repair_layout(game, plan)
                if any(positions[i] != game.locations[i] for i in ids(game.board)):
                    action = ("shuffle", positions, paths[0], paths)
        if action is None:
            for distance in range(1, len(game.history) + 1):
                trial = Game(level)
                trial.restore(game.history[-distance])
                trial.entry = trial.snapshot()
                route, unknown = allocation(trial)
                caps += unknown
                if route:
                    positions, paths = repair_layout(trial, route)
                    action = ("rewind", distance, positions, paths)
                    break
        if action is None:
            reason = "no-certified-repair"
            break
        tool = action[0]
        source = "reserve" if game.reserves[tool] else "video"
        if source == "video" and game.ads >= game.ad_limit:
            reason = "budget-exhausted"
            break
        first_help = game.q + 1 if first_help is None else first_help
        game.grant(tool, source)
        if tool == "remove":
            for i in action[1]:
                game.take(i)
            game.remove(action[1])
            hint = action[2]
        elif tool == "shuffle":
            game.shuffle(action[1], action[2])
            game.events[-1]["certificate"] = action[3]
            hint = action[2]
        else:
            distance, positions, paths = action[1:]
            game.rewind(distance, positions, paths[distance])
            game.events[-1]["certificate"] = paths
            for group in paths[:distance]:
                for i in group:
                    game.take(i, automatic=True)
            hint = paths[distance]
        # A grant buys a verified repair plus one current-question hint, not future answers.
    uses = Counter(e.get("type") for e in game.events if e.get("type") in TOOLS)
    takes = sum(e["type"] == "take" and not e["automatic"] for e in game.events)
    automatic_questions = sum(e["distance"] for e in game.events if e["type"] == "rewind")
    manual_questions = game.questions_completed - automatic_questions
    estimated_seconds = round(
        takes * timing[0]
        + manual_questions * timing[1]
        + sum(uses.values()) * timing[2]
        + automatic_questions * timing[3],
        1,
    )
    return {
        "seed": level.seed,
        "repeat": repeat,
        "mode": mode,
        "policy": policy,
        "reserve": reserve,
        "ad_limit": ad_limit,
        "won": game.status == "won",
        "reason": reason,
        "cleared": game.q,
        "ads": game.ads,
        "tools": dict(uses),
        "first_help_question": first_help,
        "search_limits": caps,
        "card_clicks": takes,
        "questions_completed": game.questions_completed,
        "automatic_questions": automatic_questions,
        "estimated_play_seconds": estimated_seconds,
        "events": game.events,
    }


def summary(runs):
    winners = [r for r in runs if r["won"]]
    paid = [r for r in winners if r["ads"]]
    watched = [r for r in runs if r["ads"]]

    def fraction(n):
        return round(100 * n / len(runs), 2)

    return {
        "runs": len(runs),
        "wins": len(winners),
        "win_percent": fraction(len(winners)),
        "video_percent": fraction(len(watched)),
        "cumulative_win_percent": {
            str(n): fraction(sum(r["ads"] <= n for r in winners)) for n in range(11)
        },
        "paid_winners": len(paid),
        "paid_winner_ads_mean": round(statistics.mean(r["ads"] for r in paid), 3) if paid else None,
        "watched_win_percent": round(100 * len(paid) / len(watched), 2) if watched else None,
        "watched_one_to_three_win_percent": round(
            100 * sum(0 < r["ads"] <= 3 for r in winners) / len(watched), 2
        )
        if watched
        else None,
        "paid_winner_ads_median": statistics.median(r["ads"] for r in paid) if paid else None,
        "all_ads_mean": round(statistics.mean(r["ads"] for r in runs), 3),
        "failures_after_ten": sum(not r["won"] and r["ads"] == 10 for r in runs),
        "failures": dict(Counter(r["reason"] for r in runs if not r["won"])),
        "search_limits": sum(r["search_limits"] for r in runs),
        "estimated_winner_seconds_median": statistics.median(
            r["estimated_play_seconds"] for r in winners
        )
        if winners
        else None,
        "estimated_winner_seconds_p90": sorted(r["estimated_play_seconds"] for r in winners)[
            int(0.9 * (len(winners) - 1))
        ]
        if winners
        else None,
        "estimated_winner_in_target_percent": round(
            100 * sum(240 <= r["estimated_play_seconds"] <= 360 for r in winners) / len(winners), 2
        )
        if winners
        else None,
        "tool_uses": dict(sum((Counter(r["tools"]) for r in runs), Counter())),
    }


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def select_level(seed, profile, curve, difficulty):
    """Offline difficulty screening; evaluation decisions never participate in selection."""
    candidates = []
    for attempt in range(60 if difficulty == "challenging" else 1):
        candidate = generate(
            seed * 100 + attempt if difficulty == "challenging" else seed, profile, curve
        )
        if difficulty == "open":
            return candidate, {"requested_seed": seed, "candidates": []}
        trials = [play(candidate, repeat, "none") for repeat in (-3, -2, -1)]
        item = {
            "seed": candidate.seed,
            "wins": sum(t["won"] for t in trials),
            "cleared": [t["cleared"] for t in trials],
            "search_limits": sum(t["search_limits"] for t in trials),
        }
        candidates.append(item)
        if item["wins"] == 0 and item["search_limits"] == 0 and min(item["cleared"]) >= 3:
            return candidate, {
                "requested_seed": seed,
                "calibration_repeats": [-3, -2, -1],
                "candidates": candidates,
            }
    raise ValueError("no level met screening criteria; no fallback to an unqualified level")


def import_levels(data, max_candidates=80):
    """Import existing exact layouts without changing animals, questions, or positions."""
    records = []
    projection = (28, 16, 14, 14)
    animal_map = list(range(len(ANIMALS)))
    if isinstance(data, dict) and "packs" in data:
        require(data.get("schemaVersion") == 1, "unsupported level-pack schema")
        p = data.get("projection", {})
        projection = tuple(
            p.get(k, default)
            for k, default in zip(("xStep", "yStep", "layerStep", "thickness"), projection)
        )
        catalog = data.get("animals")
        require(isinstance(catalog, list), "missing animal catalog")
        animal_map = []
        for animal in catalog:
            key = (animal["name"], animal["eyes"], animal["legs"])
            require(key in ANIMALS, "unknown animal definition")
            animal_map.append(ANIMALS.index(key))
        for index, pack in enumerate(data["packs"]):
            records.append(
                (f"pack:{pack['slug']}:hard", 2026110300 + index, pack["hard"], "external")
            )
    elif isinstance(data, list) and data and "level" in data[0]:
        for item in data:
            raw = item["level"]
            if "projection" in item:
                raw = {**raw, "projection": item["projection"]}
            records.append(
                (
                    f"height:{item['variant']}:{item['theme']}",
                    item["seed"],
                    raw,
                    str(item["variant"]),
                )
            )
    else:
        values = data.get("levels") if isinstance(data, dict) else data
        require(isinstance(values, list), "expected native levels, level-pack, or height-study")
        require(0 < len(values) <= max_candidates, "candidate budget exceeded")
        levels = [Level.load(value) for value in values]
        require(
            len({level.source_id for level in levels}) == len(levels), "duplicate level identity"
        )
        for level in levels:
            check_level(level)
        return levels
    require(0 < len(records) <= max_candidates, "candidate budget exceeded")
    levels = []
    for identity, seed, raw, variant in records:
        require(len(raw["cards"]) == 48, "only second-stage 48-card levels are supported")
        cards = []
        positions = []
        for card in raw["cards"]:
            require(
                type(card["animal"]) is int and 0 <= card["animal"] < len(animal_map),
                "unknown animal index",
            )
            cards.append(animal_map[card["animal"]])
            positions.append((card["x"], card["y"], card["z"]))
        camera = raw.get("projection", projection)
        if isinstance(camera, dict):
            camera = tuple(camera[k] for k in ("xStep", "yStep", "layerStep", "thickness"))
        level = Level(
            seed,
            "imported",
            tuple(cards),
            tuple(positions),
            tuple((t["eyes"], t["legs"]) for t in raw["targets"]),
            tuple(tuple(group) for group in raw["reference"]),
            variant,
            "isometric-body",
            tuple(camera),
            identity,
        )
        check_level(level)
        actual_layers = max(p[2] for p in level.positions) + 1
        require(
            raw.get("layers", actual_layers) == actual_layers
            and raw.get("maxLayers", actual_layers) >= actual_layers,
            "source layer metadata disagrees",
        )
        require(
            [list(row) for row in level_geometry(level)] == raw["blockers"],
            f"source covering disagrees with computed geometry: {identity}",
        )
        levels.append(level)
    require(len({level.source_id for level in levels}) == len(levels), "duplicate level identity")
    return levels


def structure_metrics(level):
    covers = level_geometry(level)
    depth = {}

    def longest(i):
        if i not in depth:
            depth[i] = 1 + max((longest(j) for j in covers[i]), default=0)
        return depth[i]

    board = (1 << 48) - 1
    masks = tuple(sum(1 << j for j in row) for row in covers)
    choices = []
    for i in [i for group in level.reference for i in group]:
        free = open_cards(board, 0, masks)
        require(i in free, "reference covered during metrics")
        choices.append(len(free))
        board &= ~(1 << i)
    footprint = len({p[:2] for p in level.positions})
    return {
        "layers": max(p[2] for p in level.positions) + 1,
        "footprint": footprint,
        "average_height": round(48 / footprint, 3),
        "initial_clickable": choices[0],
        "longest_dependency": max(longest(i) for i in range(48)),
        "clickable_before_each_pick": choices,
        "layer_counts": [
            sum(p[2] == z for p in level.positions)
            for z in range(max(p[2] for p in level.positions) + 1)
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("generate", "simulate", "verify", "import"))
    parser.add_argument("--input", type=Path)
    parser.add_argument("--profile", choices=PROFILES, default="three-peaks")
    parser.add_argument("--curve", choices=tuple(CURVES), default="balanced")
    parser.add_argument("--difficulty", choices=("open", "challenging"), default="open")
    parser.add_argument("--seed", type=int, default=2026110400)
    parser.add_argument("--boards", type=int, default=100)
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--policy", choices=("current", "preview"), default="preview")
    parser.add_argument("--mode", choices=("none", "enhanced"), default="enhanced")
    parser.add_argument("--reserve", type=int, choices=(0, 1), default=0)
    parser.add_argument("--ad-limit", type=int, choices=range(11), default=10)
    parser.add_argument("--click-seconds", type=float, default=2.5)
    parser.add_argument("--question-seconds", type=float, default=10)
    parser.add_argument("--tool-seconds", type=float, default=8)
    parser.add_argument("--replay-seconds", type=float, default=1.5)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    require(args.boards > 0 and args.repeats > 0, "positive boards/repeats required")
    timing = (args.click_seconds, args.question_seconds, args.tool_seconds, args.replay_seconds)
    require(all(math.isfinite(n) and n >= 0 for n in timing), "invalid time assumptions")
    if args.command == "verify":
        report = json.loads((args.output / "runs.json").read_text())
        levels = {v["seed"]: Level.load(v) for v in report["levels"]}
        for level in levels.values():
            check_level(level)
        for run in report["runs"]:
            replay(levels[run["seed"]], run)
        print(json.dumps({"verified_runs": len(report["runs"])}))
        return
    args.output.mkdir(parents=True, exist_ok=False)
    if args.command == "import":
        require(args.input is not None, "import requires --input")
        levels = import_levels(json.loads(args.input.read_text(encoding="utf-8")))
        write_json(
            args.output / "levels.json",
            {
                "schemaVersion": 1,
                "input_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
                "levels": [asdict(level) for level in levels],
            },
        )
        print(json.dumps({"imported_levels": len(levels), "reference_replays": len(levels)}))
        return
    levels, selection = [], []
    for n in range(args.boards):
        level, trace = select_level(args.seed + n, args.profile, args.curve, args.difficulty)
        levels.append(level)
        selection.append(trace)
    if args.command == "generate":
        write_json(
            args.output / "levels.json",
            {"levels": [asdict(level) for level in levels], "selection": selection},
        )
        return
    runs = []
    for n, level in enumerate(levels):
        for repeat in range(args.repeats):
            run = play(level, repeat, args.mode, args.policy, args.reserve, args.ad_limit, timing)
            replay(level, run)
            runs.append(run)
        if (n + 1) % 25 == 0:
            print(f"validated {n + 1}/{len(levels)} boards", flush=True)
    config = {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()}
    config["source_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    write_json(
        args.output / "runs.json",
        {
            "config": config,
            "animals": ANIMALS,
            "levels": [asdict(v) for v in levels],
            "selection": selection,
            "runs": runs,
        },
    )
    result = summary(runs)
    write_json(args.output / "summary.json", result)
    print(json.dumps(result, ensure_ascii=False), flush=True)


def check_certificate(level, state, route):
    witness = copy.deepcopy(state)
    require(len(route) == 12 - witness["q"], "certificate question count")
    for group in route:
        for number, i in enumerate(group):
            if i in witness["temp"]:
                witness["temp"].remove(i)
            else:
                require(i in witness["board"], "certificate duplicated card")
                require(oracle_visible(level, witness, i), "certificate covered card")
                witness["board"].remove(i)
            witness["slot"].append(i)
            matched = attributes(level, witness["slot"]) == level.targets[witness["q"]]
            require(len(witness["slot"]) <= 7, "certificate slot overflow")
            require(matched == (number == len(group) - 1), "certificate elimination timing")
        require(bool(group), "empty certificate group")
        witness["slot"] = []
        witness["q"] += 1
    require(
        not witness["board"] and not witness["temp"] and not witness["slot"],
        "certificate left cards",
    )


# Independent set/coordinate replay is defined below, rather than trusting simulator masks.
def replay(level, run):
    size = len(level.cards)
    state = {
        "board": set(range(size)),
        "temp": [],
        "slot": [],
        "positions": list(range(size)),
        "q": 0,
    }
    entry = copy.deepcopy(state)
    history = []
    inventory = Counter()
    reserves = dict.fromkeys(TOOLS, run["reserve"])
    ads, failed = 0, False
    automatic_until = None
    completed_questions = 0
    for event in run["events"]:
        require(not failed and state["q"] < 12, "event after terminal state")
        kind = event["type"]
        if kind == "grant":
            tool = event["tool"]
            require(tool in TOOLS, "unknown reward")
            if event["source"] == "reserve":
                require(reserves[tool] > 0, "reserve overspent")
                reserves[tool] -= 1
            else:
                require(event["source"] == "video" and ads < run["ad_limit"], "video overspent")
                ads += 1
            inventory[tool] += 1
        elif kind == "take":
            if event["automatic"]:
                require(
                    automatic_until is not None and state["q"] < automatic_until,
                    "automatic pick outside recovery",
                )
            else:
                require(
                    automatic_until is None or state["q"] >= automatic_until,
                    "manual pick before automatic replay finished",
                )
            i = event["id"]
            require(len(state["slot"]) < 7, "full slot")
            if i in state["temp"]:
                state["temp"].remove(i)
            else:
                require(i in state["board"], "absent card")
                require(oracle_visible(level, state, i), "covered card")
                state["board"].remove(i)
            state["slot"].append(i)
        elif kind in TOOLS:
            require(inventory[kind] > 0, "tool used without reward")
            if kind == "remove":
                selected = event["ids"]
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
                    distance = event["distance"]
                    require(1 <= distance <= len(history), "invalid history")
                    state = copy.deepcopy(history[-distance])
                    history = history[:-distance]
                proposed = event["positions"]
                if proposed is not None:
                    old = state["positions"]
                    require(
                        len(proposed) == size and sorted(proposed) == list(range(size)),
                        "bad layout",
                    )
                    require(
                        all(proposed[i] == old[i] for i in range(size) if i not in state["board"]),
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
                if "certificate" in event:
                    check_certificate(level, state, event["certificate"])
            inventory[kind] -= 1
        else:
            raise ValueError("unknown event")
        if kind in ("take", "remove"):
            if state["slot"] and attributes(level, state["slot"]) == level.targets[state["q"]]:
                history.append(copy.deepcopy(entry))
                state["slot"] = []
                state["q"] += 1
                completed_questions += 1
                entry = copy.deepcopy(state)
            elif len(state["slot"]) == 7:
                failed = True
        areas = [state["board"], set(state["temp"]), set(state["slot"])]
        require(sum(map(len, areas)) == len(set.union(*areas)), "duplicate card location")
        require(len(state["temp"]) == len(set(state["temp"])), "duplicate temporary card")
    won = state["q"] == 12 and not state["board"] and not state["temp"] and not state["slot"]
    require(
        won == run["won"] and state["q"] == run["cleared"] and ads == run["ads"],
        "result disagrees with replay",
    )
    require(all(n == 0 for n in inventory.values()), "unused reward in immediate-use simulation")
    require(automatic_until is None or state["q"] >= automatic_until, "incomplete automatic replay")
    require(
        run["card_clicks"]
        == sum(e["type"] == "take" and not e["automatic"] for e in run["events"]),
        "manual click count mismatch",
    )
    require(run["questions_completed"] == completed_questions, "question count mismatch")
    require(
        run["automatic_questions"]
        == sum(e["distance"] for e in run["events"] if e["type"] == "rewind"),
        "automatic count mismatch",
    )
    require(
        run["tools"] == dict(Counter(e["type"] for e in run["events"] if e["type"] in TOOLS)),
        "tool counts mismatch",
    )


if __name__ == "__main__":
    main()
