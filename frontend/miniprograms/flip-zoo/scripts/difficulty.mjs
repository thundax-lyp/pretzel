import { DEFAULT_BOARD_KINDS } from "../assets/scripts/round.ts";

export const DEFAULT_DIFFICULTY = { keyGroups: 1, overlapGroups: 0 };

export function isDifficulty(value) {
    if (typeof value !== "object" || value === null) return false;
    const { keyGroups, overlapGroups } = value;
    return (
        [1, 2, 3].includes(keyGroups) &&
        Number.isInteger(overlapGroups) &&
        overlapGroups >= 0 &&
        overlapGroups <= keyGroups
    );
}

// IDs in each reserve are ordered bottom, middle, top.
const reserves = [
    { kind: 15, ids: [0, 125, 173], overlappingMiddle: 110, surplusKind: 9 },
    { kind: 2, ids: [4, 112, 178], overlappingMiddle: 115, surplusKind: 8 },
    { kind: 13, ids: [31, 88, 169], overlappingMiddle: 106, surplusKind: 12 },
];

export function buildBoardKinds({ keyGroups, overlapGroups }) {
    const kinds = [...DEFAULT_BOARD_KINDS];
    for (const [index, reserve] of reserves.slice(0, keyGroups).entries()) {
        for (const [id, kind] of DEFAULT_BOARD_KINDS.entries()) {
            if (kind === reserve.kind && !reserve.ids.includes(id)) {
                kinds[id] = reserve.surplusKind;
            }
        }
        if (index < overlapGroups) {
            const middle = reserve.ids[1];
            const alternate = reserve.overlappingMiddle;
            [kinds[middle], kinds[alternate]] = [
                kinds[alternate],
                kinds[middle],
            ];
        }
    }
    return kinds;
}
