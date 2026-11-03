import { useEffect } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { AdminQueryProvider } from "@/query/query-client";
import { clearAccessToken, saveTokenSession } from "@/auth/token-storage";

afterEach(() => {
    cleanup();
    clearAccessToken();
});
it("drops account data and pending results on account changes but preserves a token rotation", async () => {
    saveTokenSession({ token: "account-a" });
    let client!: QueryClient;
    const Capture = () => {
        const current = useQueryClient();
        useEffect(() => {
            client = current;
        }, [current]);
        return null;
    };
    render(
        <AdminQueryProvider>
            <Capture />
        </AdminQueryProvider>,
    );
    client.setQueryData(["current-user", "info"], { name: "A" });
    act(() => {
        saveTokenSession({ token: "rotated-a" });
    });
    expect(client.getQueryData(["current-user", "info"])).toEqual({
        name: "A",
    });
    let resolve!: (value: string) => void;
    const pending = client
        .fetchQuery({
            queryKey: ["users"],
            queryFn: () =>
                new Promise<string>((done) => {
                    resolve = done;
                }),
        })
        .catch(() => undefined);
    act(() => {
        clearAccessToken();
        saveTokenSession({ token: "account-b" });
    });
    expect(client.getQueryData(["current-user", "info"])).toBeUndefined();
    resolve("old-account-data");
    await pending;
    expect(client.getQueryData(["users"])).toBeUndefined();
});
