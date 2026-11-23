import { callCloud } from "./cloud-health";
import { postRankMessage } from "./wechat-platform";

export async function syncLifetimeRank(): Promise<void> {
    const { total } = await callCloud<{ total: number }>("flipZooRank");
    if (!Number.isSafeInteger(total) || total < 0)
        throw new Error("Invalid lifetime win count");
    if (!postRankMessage("sync-history", undefined, total))
        throw new Error("Leaderboard context unavailable");
}
