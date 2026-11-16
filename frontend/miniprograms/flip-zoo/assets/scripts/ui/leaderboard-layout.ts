export function leaderboardScale(
    viewport: { width: number; height: number },
    cardWidth: number,
    headingTop: number,
): number {
    const margin = 16;
    return Math.min(
        1,
        (viewport.width - 2 * margin) / cardWidth,
        (viewport.height / 2 - margin) / headingTop,
    );
}
