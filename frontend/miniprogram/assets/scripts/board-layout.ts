import type { Card } from "./contract";

/** Repack separate piles while retaining every pile's internal overlap geometry. */
export function layoutBoard(cards: Card[], width: number, height: number) {
    const remaining = new Set(cards);
    const piles: Card[][] = [];
    while (remaining.size) {
        const pile = [remaining.values().next().value!];
        remaining.delete(pile[0]);
        for (let index = 0; index < pile.length; index++) {
            const current = pile[index];
            for (const card of Array.from(remaining)) {
                if (
                    (Math.abs(card.x - current.x) <= 1 &&
                        Math.abs(card.y - current.y) <= 1) ||
                    card.coveredBy.includes(current.id) ||
                    current.coveredBy.includes(card.id)
                ) {
                    pile.push(card);
                    remaining.delete(card);
                }
            }
        }
        piles.push(pile);
    }
    const bounds = piles.map((pile) => ({
        minX: Math.min(...pile.map((card) => card.x)),
        minY: Math.min(...pile.map((card) => card.y)),
        width:
            Math.max(...pile.map((card) => card.x)) -
            Math.min(...pile.map((card) => card.x)) +
            1,
        height:
            Math.max(...pile.map((card) => card.y)) -
            Math.min(...pile.map((card) => card.y)) +
            1,
    }));
    const gap = 0.35;
    const cellWidth = Math.max(1, ...bounds.map((box) => box.width));
    const cellHeight = Math.max(1, ...bounds.map((box) => box.height)) * 1.08;
    let columns = 1;
    let size = 0;
    for (let count = 1; count <= piles.length; count++) {
        const rows = Math.ceil(piles.length / count);
        const fit = Math.min(
            152,
            width / (count * cellWidth + (count - 1) * gap),
            height / (rows * cellHeight + (rows - 1) * gap),
        );
        if (fit > size) {
            size = fit;
            columns = count;
        }
    }
    const rows = Math.ceil(piles.length / columns);
    const positions = new Map<string, { x: number; y: number }>();
    piles.forEach((pile, index) => {
        const box = bounds[index];
        const centerX =
            ((index % columns) - (columns - 1) / 2) * (cellWidth + gap) * size;
        const centerY =
            ((rows - 1) / 2 - Math.floor(index / columns)) *
            (cellHeight + gap) *
            size;
        pile.forEach((card) =>
            positions.set(card.id, {
                x: centerX + (card.x - box.minX + 0.5 - box.width / 2) * size,
                y:
                    centerY +
                    (box.height / 2 - (card.y - box.minY + 0.5)) * size * 1.08,
            }),
        );
    });
    return { size, positions };
}
