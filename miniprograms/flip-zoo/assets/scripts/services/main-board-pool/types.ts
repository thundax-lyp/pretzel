import type { Footprint } from "../../gameplay/round.ts";

export interface FixedBoardConfig {
    name: string;
    layout: readonly (readonly Footprint[])[];
    kinds: string;
    // Highest layer first.
    layerKindCounts: readonly number[];
}
