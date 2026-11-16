import { sys } from "cc";
import type { MainBoardDeal } from "./board-api";
import { callCloud } from "./cloud-health";

export type RoundAction = number | string;
type Settlement =
    { status: "granted"; animal: number } | { status: "limit" | "invalid" };

export const FRAGMENT_ANIMALS = [
    "公仔猫",
    "吉娃娃",
    "卡皮巴拉",
    "小黄鸭",
    "招财羊",
    "鸡肚猪",
] as const;

const pendingKey = "flip-zoo-pending-fragments";
type Pending = Record<string, readonly RoundAction[]>;

function pendingRounds(): Pending {
    const stored = sys.localStorage.getItem(pendingKey);
    return stored ? (JSON.parse(stored) as Pending) : {};
}

export function startFragmentRound(): Promise<
    MainBoardDeal & { roundId: string }
> {
    return callCloud("flipZooFragments", { action: "start" });
}

async function finish(
    roundId: string,
    actions: readonly RoundAction[],
): Promise<Settlement> {
    const outcome = await callCloud<Settlement>("flipZooFragments", {
        action: "finish",
        roundId,
        actions,
    });
    if (!["granted", "limit", "invalid"].includes(outcome.status)) {
        throw new Error("Unexpected fragment settlement");
    }
    const pending = pendingRounds();
    delete pending[roundId];
    sys.localStorage.setItem(pendingKey, JSON.stringify(pending));
    return outcome;
}

export function settleFragmentRound(
    roundId: string,
    actions: readonly RoundAction[],
): Promise<Settlement> {
    const pending = pendingRounds();
    pending[roundId] = actions;
    sys.localStorage.setItem(pendingKey, JSON.stringify(pending));
    return finish(roundId, actions);
}

export async function loadFragmentBalances(): Promise<readonly number[]> {
    await Promise.allSettled(
        Object.entries(pendingRounds()).map(([id, actions]) =>
            finish(id, actions),
        ),
    );
    const { balances } = await callCloud<{ balances: number[] }>(
        "flipZooFragments",
        {
            action: "balances",
        },
    );
    if (
        !Array.isArray(balances) ||
        balances.length !== FRAGMENT_ANIMALS.length ||
        !balances.every((value) => Number.isSafeInteger(value) && value >= 0)
    ) {
        throw new Error("Invalid fragment balances");
    }
    return balances;
}
