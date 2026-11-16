import { FULL_EXPOSURE } from "../assets/scripts/gameplay/round.ts";

const depth = 3;
const beamWidth = 4;

export function createLookahead(cards) {
    // Geometry is independent of the animals printed on the cards.
    const blockers = cards.map((card) =>
        cards
            .filter(
                (upper) =>
                    upper.layer > card.layer &&
                    Math.abs(upper.left - card.left) < 1 &&
                    Math.abs(upper.top - card.top) < 1,
            )
            .map(({ id }) => id),
    );
    const blockedBy = cards.map(() => []);
    for (const [id, upperIds] of blockers.entries()) {
        for (const upper of upperIds) blockedBy[upper].push(id);
    }
    const neighbors = cards.map((card) =>
        cards
            .filter(
                (other) =>
                    other.layer === card.layer &&
                    Math.abs(other.x - card.x) + Math.abs(other.y - card.y) ===
                        1,
            )
            .map(({ id }) => id),
    );

    return (round) => {
        const revealsNeighbors = round.level === 1 || round.group !== "B";
        const active = new Set();
        for (const card of cards) {
            if (round.isOnBoard(card)) active.add(card.id);
        }
        const selectable = (id) =>
            blockers[id].every((upper) => !active.has(upper));
        const known = new Map();
        for (const id of active) {
            const card = cards[id];
            const unobstructed = selectable(id);
            if (
                round.isFaceUp(card, unobstructed ? FULL_EXPOSURE : 0) &&
                (unobstructed || round.exposure(card) !== 0)
            ) {
                known.set(id, card.kind);
            }
        }
        const startingSlots = round.slots.map(({ kind }) => kind);
        const capacity = round.slotCapacity;

        function evaluate(id, slots, choices, remainingDepth) {
            const kind = known.get(id);
            const held = slots.filter((animal) => animal === kind).length;
            const match = held === 2;
            const nextSlots = match
                ? slots.filter((animal) => animal !== kind)
                : [...slots, kind];
            if (nextSlots.length === capacity)
                return kind === undefined ? -800 : -1000;

            active.delete(id);
            const newChoices = blockedBy[id].filter(
                (other) => active.has(other) && selectable(other),
            );
            const unknownNeighbors = revealsNeighbors
                ? neighbors[id].filter(
                      (other) =>
                          active.has(other) &&
                          !known.has(other) &&
                          selectable(other),
                  ).length
                : 0;
            const free = capacity - nextSlots.length;
            const information = Math.min(
                4,
                unknownNeighbors + newChoices.length,
            );
            const risk = free === 1 ? 18 : free === 2 ? 6 : 0;
            const score = (match ? 28 : 0) + information * 3 - risk;
            let future = 0;
            // Stop at an unknown pick. Its face and any subsequent revelations
            // will enter the observation after applying the real move.
            if (kind !== undefined && remainingDepth > 1) {
                const nextChoices = choices
                    .filter((other) => other !== id)
                    .concat(newChoices);
                const candidates = nextChoices.filter((other) =>
                    known.has(other),
                );
                const priority = (other) =>
                    nextSlots.filter((animal) => animal === known.get(other))
                        .length;
                candidates.sort((a, b) => priority(b) - priority(a));
                if (candidates.length > 0) {
                    future = Math.max(
                        ...candidates
                            .slice(0, beamWidth)
                            .map((other) =>
                                evaluate(
                                    other,
                                    nextSlots,
                                    nextChoices,
                                    remainingDepth - 1,
                                ),
                            ),
                    );
                }
            }
            active.add(id);
            return score + Math.max(-40, future) * 0.75;
        }

        const choices = [...active].filter(selectable);
        return choices.map((id) => ({
            id,
            score: evaluate(id, startingSlots, choices, depth),
            completesMatch:
                known.has(id) &&
                startingSlots.filter((kind) => kind === known.get(id))
                    .length === 2,
        }));
    };
}
