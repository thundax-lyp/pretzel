import type { Card, RestoreAnchor, RunSnapshot } from "./contract";

export function captureRestoreAnchor(
    run: RunSnapshot,
    card: Card,
): RestoreAnchor {
    return {
        x: card.x,
        y: card.y,
        layer: card.layer,
        supports: run.cards
            .filter(
                (below) =>
                    below.layer < card.layer &&
                    below.coveredBy.includes(card.id),
            )
            .map((below) => ({
                cardId: below.id,
                x: below.x,
                y: below.y,
                layer: below.layer,
            })),
    };
}

export function restorationState(run: RunSnapshot, id: string) {
    const card = run.cards.find((item) => item.id === id);
    const anchor = card?.restoreAnchor;
    if (run.status !== "ACTIVE" || !run.temporaryCardIds.includes(id))
        return {
            allowed: false,
            reason: "当前无法复位",
            missingCardIds: [] as string[],
        };
    if (!anchor)
        return {
            allowed: false,
            reason: "缺少原位信息，请同步对局",
            missingCardIds: [] as string[],
        };
    const missing = anchor.supports.filter((support) => {
        const below = run.cards.find((item) => item.id === support.cardId);
        return (
            !below ||
            !run.boardCardIds.includes(support.cardId) ||
            below.x !== support.x ||
            below.y !== support.y ||
            below.layer !== support.layer
        );
    });
    if (missing.length) {
        const names = missing.map((support) => {
            const below = run.cards.find((item) => item.id === support.cardId);
            return (
                run.animals.find((animal) => animal.id === below?.animalId)
                    ?.name ?? support.cardId
            );
        });
        return {
            allowed: false,
            reason: "先将底牌归位：" + names.join("、"),
            missingCardIds: missing.map((support) => support.cardId),
        };
    }
    const occupied = run.cards.some(
        (other) =>
            run.boardCardIds.includes(other.id) &&
            other.layer === anchor.layer &&
            Math.abs(other.x - anchor.x) < 1 &&
            Math.abs(other.y - anchor.y) < 1,
    );
    if (occupied)
        return {
            allowed: false,
            reason: "原位置被占用，请先移开占位牌",
            missingCardIds: [] as string[],
        };
    return {
        allowed: true,
        reason: "点击免费复位",
        missingCardIds: [] as string[],
    };
}

/** Apply only after eligibility has been checked against the authoritative snapshot. */
export function restoreBoardCard(run: RunSnapshot, id: string) {
    const eligibility = restorationState(run, id);
    if (!eligibility.allowed) throw new Error(eligibility.reason);
    const card = run.cards.find((item) => item.id === id)!;
    const anchor = card.restoreAnchor!;
    card.x = anchor.x;
    card.y = anchor.y;
    card.layer = anchor.layer;
    run.temporaryCardIds.splice(run.temporaryCardIds.indexOf(id), 1);
    run.boardCardIds.push(id);
    delete card.restoreAnchor;
    run.cards.forEach((below) => {
        below.coveredBy = run.cards
            .filter(
                (above) =>
                    above.layer > below.layer &&
                    Math.abs(above.x - below.x) < 1 &&
                    Math.abs(above.y - below.y) < 1,
            )
            .map((above) => above.id);
    });
}
