import "fake-indexeddb/auto";
import { withTokenRefreshLock } from "./token-refresh-lock";

it("releases a failed refresh so another tab can acquire the lock", async () => {
    const failed = withTokenRefreshLock(async () => {
        throw new Error("offline");
    });
    const next = withTokenRefreshLock(async () => "next");
    await expect(failed).rejects.toThrow("offline");
    await expect(next).resolves.toBe("next");
});
