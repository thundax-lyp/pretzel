import { ANIMAL_KIND_COUNT } from "../gameplay/round.ts";
import { VARIANT_A } from "./main-board-pool/variant-a.ts";
import { VARIANT_B } from "./main-board-pool/variant-b.ts";
import { VARIANT_C } from "./main-board-pool/variant-c.ts";
import { VARIANT_D } from "./main-board-pool/variant-d.ts";
import type { FixedBoardConfig } from "./main-board-pool/types.ts";

// The cloud wallet persists these indices across draws.
export const MAIN_BOARD_CONFIG: readonly FixedBoardConfig[] = [
    ...VARIANT_A,
    ...VARIANT_B,
    ...VARIANT_C,
    ...VARIANT_D,
];

export const MAIN_BOARD_POOL = MAIN_BOARD_CONFIG.map(
    ({ name, layout, kinds, bindings }) => ({
        name,
        layout,
        bindings,
        kinds: Array.from(kinds, (kind) =>
            Number.parseInt(kind, ANIMAL_KIND_COUNT),
        ),
    }),
);
