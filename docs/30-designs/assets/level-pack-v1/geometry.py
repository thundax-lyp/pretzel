"""Fixed-camera visibility shared by design generation and simulation adapters."""

from functools import lru_cache

DEFAULT_PROJECTION = {"xStep": 28, "yStep": 16, "layerStep": 14, "thickness": 14}


def position(x, y, z):
    return {"x": x, "y": y, "z": z}


def paint_key(card):
    return (card["x"] + card["y"], card["z"], card["x"])


def polygons(card, projection=None):
    p = projection or DEFAULT_PROJECTION
    x, y, z = card["x"], card["y"], card["z"]
    px, py = (x - y) * p["xStep"], (x + y) * p["yStep"] - z * p["layerStep"]
    return [
        (px, py),
        (px + p["xStep"], py + p["yStep"]),
        (px, py + 2 * p["yStep"]),
        (px - p["xStep"], py + p["yStep"]),
    ]


def body_polygon(face, thickness):
    return [
        face[0],
        face[1],
        (face[1][0], face[1][1] + thickness),
        (face[2][0], face[2][1] + thickness),
        (face[3][0], face[3][1] + thickness),
        face[3],
    ]


def overlaps(a, b):
    for poly in (a, b):
        for point, following in zip(poly, poly[1:] + poly[:1]):
            nx, ny = -(following[1] - point[1]), following[0] - point[0]
            pa = [x * nx + y * ny for x, y in a]
            pb = [x * nx + y * ny for x, y in b]
            if min(max(pa), max(pb)) <= max(min(pa), min(pb)) + 1e-8:
                return False
    return True


def blockers(cards, projection=None):
    p = projection or DEFAULT_PROJECTION
    order = sorted(range(len(cards)), key=lambda i: paint_key(cards[i]))
    rank = {i: r for r, i in enumerate(order)}
    faces = [polygons(c, p) for c in cards]
    bodies = [body_polygon(f, p["thickness"]) for f in faces]
    return [
        [j for j in range(len(cards)) if rank[j] > rank[i] and overlaps(face, bodies[j])]
        for i, face in enumerate(faces)
    ]


@lru_cache(maxsize=256)
def engine_geometry(positions):
    return tuple(tuple(row) for row in blockers([position(*p) for p in positions]))


def available(left, cover):
    return [i for i in sorted(left) if not any(j in left for j in cover[i])]


def metrics(cards, reference, cover=None):
    cover = blockers(cards) if cover is None else cover
    depth = {}

    def longest(i):
        if i not in depth:
            depth[i] = 1 + max((longest(j) for j in cover[i]), default=0)
        return depth[i]

    left = set(range(len(cards)))
    trajectory = []
    for i in [n for group in reference for n in group]:
        free = available(left, cover)
        if i not in free:
            raise ValueError("reference path is covered")
        trajectory.append(len(free))
        left.remove(i)
    columns = {(c["x"], c["y"]) for c in cards}
    layers = max(c["z"] for c in cards) + 1
    middle = trajectory[9:39]
    return {
        "cards": len(cards),
        "layers": layers,
        "footprintCells": len(columns),
        "averageHeight": round(len(cards) / len(columns), 3),
        "layerCounts": [sum(c["z"] == z for c in cards) for z in range(layers)],
        "cardsAtThirdLayerOrAbove": sum(c["z"] >= 2 for c in cards),
        "initialClickable": trajectory[0],
        "longestDependencyChain": max(longest(i) for i in range(len(cards))),
        "clickableBeforeEachReferencePick": trajectory,
        "middlePicksWithAtLeastTwoChoicesPercent": round(
            100 * sum(n >= 2 for n in middle) / len(middle), 2
        ),
        "coveredEdges": sum(map(len, cover)),
    }
