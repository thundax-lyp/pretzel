"""48-card volume prototypes, selected on geometry rather than success rates."""

import random

from geometry import available, blockers, position

VOLUMES = {
    6: [[6, 5, 2, 1], [6, 4, 3, 2], [6, 6, 4, 3]],
    7: [[1, 5, 7, 2], [3, 6, 7, 5], [1, 2, 4, 5]],
    8: [[8, 7, 4, 2, 1], [8, 6, 5, 4, 3]],
}


def cards_from_rows(rows):
    ox, oy = (6 - len(rows[0])) // 2, (8 - len(rows)) // 2
    return [
        position(x + ox, y + oy, z)
        for y, row in enumerate(rows)
        for x, height in enumerate(row)
        for z in range(height)
    ]


def choose(layers, theme_index=0):
    original = VOLUMES[layers]
    candidates, seen = [], set()
    for transposed in (False, True):
        source = [list(row) for row in zip(*original)] if transposed else original
        for flip_x in (False, True):
            for flip_y in (False, True):
                rows = [
                    row[::-1] if flip_x else row[:] for row in (source[::-1] if flip_y else source)
                ]
                key = tuple(map(tuple, rows))
                if key in seen:
                    continue
                seen.add(key)
                cards = cards_from_rows(rows)
                count = len(available(set(range(48)), blockers(cards)))
                candidates.append((0 if 6 <= count <= 8 else abs(count - 7), key, rows))
    best = min(v[0] for v in candidates)
    finalists = sorted((v for v in candidates if v[0] == best), key=lambda v: v[1])
    selected = finalists[theme_index % len(finalists)][2]
    cards = cards_from_rows(selected)
    grid = [[0] * 6 for _ in range(8)]
    for card in cards:
        grid[card["y"]][card["x"]] += 1
    return grid, cards


def rehouse(source, cards, seed):
    """Keep identities, attributes, questions, and reference groups fixed across layouts."""
    cover = blockers(cards)
    left, order = set(range(len(cards))), []
    rng = random.Random(seed)
    while left:
        i = rng.choice(available(left, cover))
        order.append(i)
        left.remove(i)
    flattened = [i for group in source["reference"] for i in group]
    result = [None] * len(cards)
    for card_id, position_id in zip(flattened, order):
        result[card_id] = {**cards[position_id], "animal": source["cards"][card_id]["animal"]}
    cover = blockers(result)
    return {
        **source,
        "cards": result,
        "blockers": cover,
        "initialClickable": len(available(set(range(48)), cover)),
        "layers": max(c["z"] for c in result) + 1,
        "maxLayers": max(c["z"] for c in result) + 1,
    }
