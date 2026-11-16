export const CARD_INSET = 2;
export const CARD_RADIUS = 7;

export function isInsideCardOutline(
    x: number,
    y: number,
    width: number,
    height: number,
): boolean {
    // Graphics strokes the rounded outline with a two-unit line.
    const halfWidth = width / 2 - CARD_INSET + 1;
    const halfHeight = height / 2 - CARD_INSET + 1;
    const radius = CARD_RADIUS + 1;
    const dx = Math.abs(x);
    const dy = Math.abs(y);
    if (dx > halfWidth || dy > halfHeight) return false;
    const cornerX = Math.max(0, dx - (halfWidth - radius));
    const cornerY = Math.max(0, dy - (halfHeight - radius));
    return cornerX * cornerX + cornerY * cornerY <= radius * radius;
}
