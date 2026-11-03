import { postJson, postSessionLogout } from "./http";
import {
    clearAccessToken,
    getAccessToken,
    saveTokenSession,
} from "@/auth/token-storage";

const success = (data: unknown) =>
    new Response(JSON.stringify({ code: "COMMON-00000", data }), {
        status: 200,
    });
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
beforeEach(() => {
    clearAccessToken();
});
afterEach(() => {
    vi.unstubAllGlobals();
});
it("logs out the rotated session when the access token is near expiry", async () => {
    saveTokenSession({
        token: "old",
        refreshToken: "refresh",
        expireAt: Date.now() + 1,
    });
    const calls: { path: string; body: unknown; token: unknown }[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (path: string, options: RequestInit) => {
            calls.push({
                path,
                body: JSON.parse(options.body as string),
                token: (options.headers as Record<string, string>)[
                    "Access-Token"
                ],
            });
            return path.endsWith("/token/refresh")
                ? success({
                      token: "rotated",
                      refreshToken: "next",
                      expireAt: Date.now() + 300000,
                  })
                : success(true);
        }),
    );
    await expect(postSessionLogout()).resolves.toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ token: "rotated" });
    expect(calls[1].token).toBe("rotated");
});
it("deduplicates logout while a refresh is in progress", async () => {
    saveTokenSession({
        token: "old",
        refreshToken: "refresh",
        expireAt: Date.now() + 1,
    });
    const refresh = deferred<Response>();
    const fetch = vi.fn((path: string) =>
        path.endsWith("/token/refresh")
            ? refresh.promise
            : Promise.resolve(success(true)),
    );
    vi.stubGlobal("fetch", fetch);
    const first = postSessionLogout();
    const second = postSessionLogout();
    expect(first).toBe(second);
    refresh.resolve(success({ token: "new", refreshToken: "next" }));
    await Promise.all([first, second]);
    expect(fetch).toHaveBeenCalledTimes(2);
});
it("does not retry an old account mutation or clear a later login", async () => {
    saveTokenSession({ token: "account-a", refreshToken: "refresh-a" });
    const response = deferred<Response>();
    const fetch = vi.fn(() => response.promise);
    vi.stubGlobal("fetch", fetch);
    const request = postJson("/sys/user/create", { body: { name: "A" } });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    clearAccessToken();
    saveTokenSession({ token: "account-b", refreshToken: "refresh-b" });
    response.resolve(
        new Response(JSON.stringify({ code: "COMMON-00002" }), { status: 401 }),
    );
    await expect(request).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(getAccessToken()).toBe("account-b");
    expect(fetch).toHaveBeenCalledTimes(1);
});
it("does not overwrite a later login with an old refresh response", async () => {
    saveTokenSession({
        token: "account-a",
        refreshToken: "refresh-a",
        expireAt: Date.now() + 1,
    });
    const response = deferred<Response>();
    vi.stubGlobal(
        "fetch",
        vi.fn(() => response.promise),
    );
    const request = postJson("/sys/user/page");
    clearAccessToken();
    saveTokenSession({ token: "account-b", refreshToken: "refresh-b" });
    response.resolve(
        success({ token: "late-a", refreshToken: "late-refresh-a" }),
    );
    await expect(request).rejects.toMatchObject({ code: "SESSION_CHANGED" });
    expect(getAccessToken()).toBe("account-b");
});
