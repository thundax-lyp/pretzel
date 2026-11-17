import type { Binding, Footprint } from "../../gameplay/round.ts";

export interface FixedBoardConfig {
    name: string;
    bindings: readonly Binding[];
    layout: readonly (readonly Footprint[])[];
    kinds: string;
    // Highest layer first.
    layerKindCounts: readonly number[];
}
