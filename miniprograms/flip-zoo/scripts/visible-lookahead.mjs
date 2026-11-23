import {
    ANIMAL_KIND_COUNT,
    FULL_EXPOSURE,
} from "../assets/scripts/gameplay/round.ts";

export function createLookahead(cards, omniscient = false) {
    const cardCount = cards.length;
    const blockers = cards.map((c) =>
        cards
            .filter(
                (u) =>
                    u.layer > c.layer &&
                    Math.abs(u.left - c.left) < 1 &&
                    Math.abs(u.top - c.top) < 1,
            )
            .map((u) => u.id),
    );
    const below = cards.map(() => []);
    for (let id = 0; id < cardCount; id++)
        for (const upper of blockers[id]) below[upper].push(id);
    const neighbors = cards.map((c) =>
        cards
            .filter(
                (o) =>
                    o.layer === c.layer &&
                    Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1,
            )
            .map((o) => o.id),
    );
    // Geometry and scratch arrays are reused without exposing hidden card faces.
    const active = new Uint8Array(cardCount),
        known = new Int16Array(cardCount),
        partners = new Int16Array(cardCount),
        counts = new Uint8Array(ANIMAL_KIND_COUNT);
    return (round) => {
        known.fill(-1);
        partners.fill(-1);
        counts.fill(0);
        const bound = [];
        for (const [a, b] of round.bindings) {
            partners[a] = b;
            partners[b] = a;
            bound.push(a, b);
        }
        for (let i = 0; i < cardCount; i++)
            active[i] = +round.isOnBoard(cards[i]);
        const selectable = (id) => {
            for (const u of blockers[id]) if (active[u]) return false;
            return true;
        };
        const capacity = round.slotCapacity;
        const canPick = (id, size) => {
            const other = partners[id];
            return (
                active[id] &&
                selectable(id) &&
                (other < 0 ||
                    (size + 2 <= capacity &&
                        active[other] &&
                        selectable(other)))
            );
        };
        for (let i = 0; i < cardCount; i++)
            if (active[i]) {
                const free = selectable(i);
                if (
                    omniscient ||
                    (round.isFaceUp(cards[i], free ? FULL_EXPOSURE : 0) &&
                        (free || round.exposure(cards[i]) !== 0))
                )
                    known[i] = cards[i].kind;
            }
        for (const c of round.slots) counts[c.kind]++;
        function evaluate(id, size, choices, depth) {
            const other = partners[id],
                kind = known[id],
                partnerKind = other < 0 ? -1 : known[other];
            const heldCount = kind < 0 ? 0 : counts[kind],
                partnerHeldCount = partnerKind < 0 ? 0 : counts[partnerKind];
            if (kind >= 0) counts[kind]++;
            if (other >= 0 && partnerKind >= 0) counts[partnerKind]++;
            // Apply both incoming faces before testing capacity, then restore the search state.
            let nextSlotCount = size + (other < 0 ? 1 : 2),
                match = false;
            if (kind >= 0 && counts[kind] >= 3) {
                counts[kind] -= 3;
                nextSlotCount -= 3;
                match = true;
            }
            if (
                partnerKind >= 0 &&
                partnerKind !== kind &&
                counts[partnerKind] >= 3
            ) {
                counts[partnerKind] -= 3;
                nextSlotCount -= 3;
                match = true;
            }
            const allKnown = kind >= 0 && (other < 0 || partnerKind >= 0);
            const restore = () => {
                if (kind >= 0) counts[kind] = heldCount;
                if (partnerKind >= 0 && partnerKind !== kind)
                    counts[partnerKind] = partnerHeldCount;
            };
            if (nextSlotCount >= capacity) {
                restore();
                return allKnown ? -1000 : -800;
            }
            active[id] = 0;
            if (other >= 0) active[other] = 0;
            const newChoices = [];
            const seen = new Uint8Array(cardCount);
            for (const p of other < 0 ? [id] : [id, other])
                for (const tile of below[p])
                    if (!seen[tile]) {
                        seen[tile] = 1;
                        if (active[tile] && selectable(tile))
                            newChoices.push(tile);
                    }
            let unknownNeighbors = 0;
            if (round.level === 1 || round.group !== "B") {
                seen.fill(0);
                for (const p of other < 0 ? [id] : [id, other])
                    for (const tile of neighbors[p])
                        if (!seen[tile]) {
                            seen[tile] = 1;
                            if (
                                active[tile] &&
                                known[tile] < 0 &&
                                selectable(tile)
                            )
                                unknownNeighbors++;
                        }
            }
            const information = Math.min(
                    4,
                    unknownNeighbors + newChoices.length,
                ),
                free = capacity - nextSlotCount;
            const score =
                (match ? 28 : 0) +
                information * 3 -
                (free === 1 ? 18 : free === 2 ? 6 : 0);
            let future = 0;
            if (allKnown && depth > 1) {
                const next = [];
                seen.fill(0);
                for (const source of [choices, newChoices, bound])
                    for (const tile of source)
                        if (!seen[tile]) {
                            seen[tile] = 1;
                            if (canPick(tile, nextSlotCount)) next.push(tile);
                        }
                const candidates = next.filter((tile) => known[tile] >= 0);
                candidates.sort((x, y) => counts[known[y]] - counts[known[x]]);
                if (candidates.length) {
                    future = -Infinity;
                    for (const tile of candidates.slice(0, 4))
                        future = Math.max(
                            future,
                            evaluate(tile, nextSlotCount, next, depth - 1),
                        );
                }
            }
            active[id] = 1;
            if (other >= 0) active[other] = 1;
            restore();
            return score + Math.max(-40, future) * 0.75;
        }
        const size = round.slots.length,
            choices = [];
        for (let i = 0; i < cardCount; i++)
            if (canPick(i, size)) choices.push(i);
        return choices.map((id) => {
            const other = partners[id],
                kind = known[id],
                partnerKind = other < 0 ? -1 : known[other];
            return {
                id,
                score: evaluate(id, size, choices, 3),
                completesMatch:
                    (kind >= 0 &&
                        counts[kind] +
                            1 +
                            (other >= 0 && partnerKind === kind ? 1 : 0) >=
                            3) ||
                    (partnerKind >= 0 &&
                        counts[partnerKind] +
                            1 +
                            (kind === partnerKind ? 1 : 0) >=
                            3),
            };
        });
    };
}
