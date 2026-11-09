export function homeLayout(
    width: number,
    height: number,
    safeTop: number,
    safeBottom: number,
    capsuleBottom: number,
) {
    const header = Math.max(safeTop + 8, capsuleBottom + 12);
    const info = header + 56;
    const scene = info + 76;
    const available = height - safeBottom - 16 - scene - 180;
    const sceneHeight = available >= 388 ? 388 : 224;
    const claim = scene + sceneHeight + 12;
    const action = claim + 60;
    const navigation = action + 64;
    return {
        width,
        height,
        header,
        info,
        scene,
        sceneHeight,
        claim,
        action,
        navigation,
        capacity: sceneHeight >= 388 ? 6 : 3,
        contentHeight: Math.max(height, navigation + 44 + safeBottom + 16),
    };
}

export function weekDates(weekId: string, year = false) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekId)) return "周期信息暂不可用";
    const start = new Date(weekId + "T00:00:00+08:00");
    const end = new Date(start.getTime() + 6 * 86400000);
    const format = (date: Date) => {
        const local = new Date(date.getTime() + 8 * 3600000);
        return (
            (year ? local.getUTCFullYear() + "年" : "") +
            (local.getUTCMonth() + 1) +
            "月" +
            local.getUTCDate() +
            "日"
        );
    };
    return format(start) + "—" + format(end);
}

export function quantityText(
    quantity: number,
    fits: (text: string) => boolean,
) {
    const candidates = [String(quantity)];
    for (const [unit, divisor] of [
        ["万", 10000],
        ["亿", 100000000],
    ] as const) {
        if (quantity >= divisor) {
            candidates.push(
                String(Math.floor((quantity / divisor) * 10) / 10) + unit,
            );
            candidates.push(String(Math.floor(quantity / divisor)) + unit);
        }
    }
    for (const candidate of candidates) if (fits(candidate)) return candidate;
    const bound =
        quantity >= 100000000 ? "≥1亿" : quantity >= 10000 ? "≥1万" : "≥1";
    return quantity === 0 ? "0" : bound;
}
