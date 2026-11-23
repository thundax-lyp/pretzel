import { Round, insertSlotCards } from "../assets/scripts/gameplay/round.ts";

function random(seed) {
    let state = seed >>> 0 || 1;
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 2 ** 32;
    };
}

function shuffle(items, draw) {
    for (let i = items.length - 1; i > 0; i -= 1) {
        const j = Math.floor(draw() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

export function createFixedBoardCandidate(layout, seed, depthBias = 0.6) {
    const draw = random(seed);
    const template = new Round(
        2,
        "C",
        Array(240).fill(0),
        undefined,
        layout,
        false,
        [],
        true,
    );
    const cards = template.cards;
    if (cards.length !== 240)
        throw new Error("Expected 240 geometric positions");
    const edges = new Map();
    for (const layer of [1, 2, 3]) {
        const members = cards.filter((card) => card.layer === layer);
        const adjacent = [];
        for (const a of members) {
            for (const b of members) {
                if (
                    b.id > a.id &&
                    Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1
                ) {
                    adjacent.push([a.id, b.id]);
                }
            }
        }
        edges.set(layer, shuffle(adjacent, draw));
    }
    const occupied = new Set();
    function reserve(layer, count) {
        const pairs = [];
        for (const pair of edges.get(layer)) {
            if (pair.some((id) => occupied.has(id))) continue;
            pairs.push(pair);
            pair.forEach((id) => occupied.add(id));
            if (pairs.length === count) return pairs;
        }
        throw new Error("Insufficient adjacent positions for bindings");
    }

    // Reserve every AB position before any AA can consume a geometric edge.
    const advanced = new Map();
    for (const layer of [1, 2, 3])
        advanced.set(layer, reserve(layer, draw() < depthBias ? 2 : 1));
    const ordinary = new Map();
    for (const layer of [1, 2, 3])
        ordinary.set(layer, reserve(layer, advanced.get(layer).length * 2));
    const packets = [...advanced].flatMap(([layer, pairs]) =>
        pairs.map((pair, index) => [
            pair,
            ...ordinary.get(layer).slice(index * 2, index * 2 + 2),
        ]),
    );
    const bindings = packets.flat();
    const blockers = cards.map((card) =>
        cards
            .filter(
                (upper) =>
                    upper.layer > card.layer &&
                    Math.abs(upper.left - card.left) < 1 &&
                    Math.abs(upper.top - card.top) < 1,
            )
            .map((upper) => upper.id),
    );
    const active = new Set(cards.map((card) => card.id));
    const available = (id) =>
        active.has(id) && blockers[id].every((upper) => !active.has(upper));
    const groups = [],
        different = [],
        order = [],
        todo = [...packets];
    let partial = [];
    while (active.size > 0) {
        const packet = todo.find(
            (candidate) =>
                candidate.flat().every(available) &&
                (!partial.length ||
                    Math.max(
                        ...candidate.flat().map((id) => cards[id].layer),
                        ...partial.map((id) => cards[id].layer),
                    ) -
                        Math.min(
                            ...candidate.flat().map((id) => cards[id].layer),
                            ...partial.map((id) => cards[id].layer),
                        ) <=
                        2),
        );
        if (packet) {
            const [ab, aa, bb] = packet;
            different.push([groups.length, groups.length + 1]);
            groups.push([ab[0], ...aa], [ab[1], ...bb]);
            order.push(...ab, ...aa, ...bb);
            packet.flat().forEach((id) => active.delete(id));
            todo.splice(todo.indexOf(packet), 1);
            continue;
        }
        let choices = cards.filter(
            (card) =>
                !occupied.has(card.id) &&
                available(card.id) &&
                (!partial.length ||
                    Math.max(
                        card.layer,
                        ...partial.map((id) => cards[id].layer),
                    ) -
                        Math.min(
                            card.layer,
                            ...partial.map((id) => cards[id].layer),
                        ) <=
                        2),
        );
        if (!choices.length)
            throw new Error("No reference continuation for this candidate");
        if (!partial.length) {
            const highest = Math.max(...choices.map((card) => card.layer));
            choices = choices.filter((card) => card.layer === highest);
        }
        const anchor = partial.length ? cards[partial[0]] : undefined;
        const scored = choices
            .map((card) => ({
                card,
                score:
                    -card.layer * depthBias * 10 +
                    (anchor
                        ? -Math.hypot(card.x - anchor.x, card.y - anchor.y) *
                          (1 - depthBias) *
                          3
                        : 0) +
                    draw() * 10,
            }))
            .sort((a, b) => b.score - a.score);
        const id = scored[0].card.id;
        partial.push(id);
        order.push(id);
        active.delete(id);
        if (partial.length === 3) {
            groups.push(partial);
            partial = [];
        }
    }
    if (groups.length !== 80 || groups.some((group) => group.length !== 3))
        throw new Error("Incomplete triple allocation");

    const labels = Array(80),
        stock = Array(20).fill(4);
    const chooseKind = (excluded = -1) => {
        const choices = stock.flatMap((count, kind) =>
            count > 0 && kind !== excluded ? [kind] : [],
        );
        const kind = choices[Math.floor(draw() * choices.length)];
        stock[kind] -= 1;
        return kind;
    };
    // AB faces are assigned first; each companion AA inherits its reserved face.
    for (const [a, b] of different) {
        labels[a] = chooseKind();
        labels[b] = chooseKind(labels[a]);
    }
    const early = groups.flatMap((group, index) =>
        group.some((id) => cards[id].layer >= 7) ? [index] : [],
    );
    const palette = shuffle(
        Array.from({ length: 20 }, (_, kind) => kind),
        draw,
    ).slice(0, 12);
    for (const index of early) {
        const choices = palette.filter((kind) => stock[kind] > 0);
        if (!choices.length) throw new Error("Early palette exhausted");
        const kind = choices[Math.floor(draw() * choices.length)];
        labels[index] = kind;
        stock[kind] -= 1;
    }
    const rest = shuffle(
        stock.flatMap((count, kind) => Array(count).fill(kind)),
        draw,
    );
    for (let index = 0; index < labels.length; index += 1)
        if (labels[index] === undefined) labels[index] = rest.pop();
    const groupByCard = [];
    groups.forEach((group, index) =>
        group.forEach((id) => (groupByCard[id] = index)),
    );
    const kinds = Array(240);
    const place = (ids) =>
        ids.forEach((id) => (kinds[id] = labels[groupByCard[id]]));
    place([...advanced.values()].flat(2));
    place([...ordinary.values()].flat(2));
    place(
        cards
            .filter((card) => !occupied.has(card.id))
            .sort((a, b) => b.layer - a.layer)
            .map((card) => card.id),
    );
    const candidate = { seed, hard: depthBias, kinds, bindings, order, groups };
    verifyFixedBoardCandidate(layout, candidate);
    return candidate;
}

export function verifyFixedBoardCandidate(layout, candidate) {
    const round = new Round(
        2,
        "C",
        candidate.kinds,
        undefined,
        layout,
        false,
        candidate.bindings,
        true,
    );
    if (round.cards.length !== 240 || candidate.kinds.length !== 240)
        throw new Error("Expected 240 cards");
    const used = new Set();
    const advancedLayers = new Set();
    if (candidate.bindings.length > 20) throw new Error("Too many bindings");
    for (const [a, b] of candidate.bindings) {
        const first = round.cards[a],
            second = round.cards[b];
        if (!first || !second || used.has(a) || used.has(b) || a === b)
            throw new Error("Overlapping binding positions");
        used.add(a);
        used.add(b);
        if (first.layer === 0 || second.layer === 0)
            throw new Error("Bottom layer cannot contain bindings");
        if (
            first.layer !== second.layer ||
            Math.abs(first.x - second.x) + Math.abs(first.y - second.y) !== 1
        )
            throw new Error("Binding positions must be adjacent in one layer");
        if (first.kind !== second.kind) advancedLayers.add(first.layer);
    }
    if (![1, 2, 3].every((layer) => advancedLayers.has(layer)))
        throw new Error("Missing advanced binding in a required layer");
    const counts = Array(20).fill(0);
    for (const kind of candidate.kinds) {
        if (!Number.isInteger(kind) || kind < 0 || kind >= 20)
            throw new Error("Invalid animal kind");
        counts[kind] += 1;
    }
    if (counts.some((count) => count < 6 || count % 3 !== 0))
        throw new Error("Invalid animal triple allocation");

    let covered = 0;
    for (
        let layer = layout.length - 1;
        layer >= 0 && covered < 36;
        layer -= 1
    ) {
        const cards = round.cards.filter((card) => card.layer === layer);
        if (new Set(cards.map((card) => card.kind)).size > 12)
            throw new Error("Early layer exceeds 12 kinds");
        covered += cards.length;
    }
    for (const id of candidate.order) {
        const card = round.cards[id];
        if (!round.isOnBoard(card)) continue;
        const partner = round.boundPartner(id);
        const arranged = insertSlotCards(
            round.slots,
            partner ? [card, partner] : [card],
        );
        if (round.take(id) === null) throw new Error("Illegal reference move");
        for (const kind of new Set([
            card.kind,
            ...(partner ? [partner.kind] : []),
        ])) {
            const matching = arranged
                .filter((tile) => tile.kind === kind)
                .slice(0, 3);
            if (
                matching.length === 3 &&
                Math.max(...matching.map((tile) => tile.layer)) -
                    Math.min(...matching.map((tile) => tile.layer)) >
                    2
            )
                throw new Error("Reference match spans more than three layers");
        }
    }
    if (round.status !== "won" || round.firstMatchAt !== 3)
        throw new Error("Invalid six-slot reference solution");
    return true;
}
