export type Prop = "REMOVE" | "CORRECT" | "REPACK";
export type Status = "ACTIVE" | "LEVEL_1_PASSED" | "WON" | "LOST" | "ABANDONED";
export interface Animal {
    id: string;
    catalogNumber: string;
    name: string;
    description: string;
    artworkKey: string;
    eyes: number;
    legs: number;
}
export interface RestoreAnchor {
    x: number;
    y: number;
    layer: number;
    supports: Array<{ cardId: string; x: number; y: number; layer: number }>;
}
export interface Card {
    id: string;
    animalId: string;
    eyes: number;
    legs: number;
    x: number;
    y: number;
    layer: number;
    coveredBy: string[];
    restoreAnchor?: RestoreAnchor;
}
export interface InventoryEntry {
    propType: Prop;
    quantity: number;
}
export interface Inventory {
    reserve: InventoryEntry[];
    inRun: InventoryEntry[];
    videoClaimsUsed: number;
}
export interface RunSnapshot {
    runId: string;
    version: number;
    level: 1 | 2;
    status: Status;
    configVersion: string;
    animals: Animal[];
    questionIndex: number;
    questions: Array<{ id: string; eyes: number; legs: number }>;
    cards: Card[];
    boardCardIds: string[];
    slotCardIds: string[];
    temporaryCardIds: string[];
    effectiveDurationMs: number;
    inventory: Inventory;
}
export type Action =
    | { type: "PICK_BOARD" | "RESTORE_BOARD"; cardId: string }
    | { type: "USE_PROP"; propType: "REMOVE"; selectedCardIds: string[] }
    | { type: "USE_PROP"; propType: "CORRECT" | "REPACK" }
    | { type: "ENTER_LEVEL_2" | "ABANDON" };
export type OperationRequest = Action & {
    operationId: string;
    expectedVersion: number;
};
export interface Settlement {
    status: "PENDING" | "CONFIRMED";
    outcome?: "WON" | "LOST";
    failureReason?: string;
    unlockedAnimalIds?: string[];
    animalClaimAvailable?: boolean;
    reserveChoices?: Prop[];
}
export interface AnimalCount {
    animal: Animal;
    receivedCount: number;
}
export interface Rank {
    rank: number;
    displayName: string;
    receivedCount: number;
    isSelf: boolean;
}
export interface RewardAttempt {
    attemptId: string;
    status: "PENDING" | "GRANTED" | "REJECTED";
    inventory?: Inventory;
}
export interface GameApi {
    start(requestId: string): Promise<RunSnapshot>;
    active(): Promise<{ run: RunSnapshot | null }>;
    run(runId: string): Promise<RunSnapshot>;
    operate(
        runId: string,
        request: OperationRequest,
    ): Promise<{ operationId: string; snapshot: RunSnapshot }>;
    settle(runId: string): Promise<Settlement>;
    zoo(): Promise<{ weekId: string; items: AnimalCount[] }>;
    collection(): Promise<{
        items: Array<AnimalCount & { unlockedAt: string }>;
    }>;
    inventory(): Promise<{ reserve: InventoryEntry[] }>;
    rank(
        weekId: string,
    ): Promise<{ weekId: string; entries: Rank[]; self: Rank | null }>;
    claimAnimal(runId: string): Promise<AnimalCount & { weekId: string }>;
    claimReserve(
        runId: string,
        propType: Prop,
    ): Promise<{ propType: Prop; inventory: Inventory }>;
}
