import type {
    GameApi,
    OperationRequest,
    Prop,
    RewardAttempt,
} from "./contract";

type Method = "GET" | "POST" | "PUT";
export type Transport = (
    url: string,
    method: Method,
    headers: Record<string, string>,
    body?: object,
) => Promise<{ status: number; body: unknown }>;

export class GameApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

export function createHttpGameApi(origin: string, transport: Transport) {
    if (!/^https:\/\/[^/?#]+\/?$/.test(origin))
        throw new Error("请配置 HTTPS 游戏服务域名");
    const base = origin.replace(/\/$/, "") + "/pretzel-game-api/api/v1";
    let token = "";
    async function call<T>(
        method: Method,
        path: string,
        body?: object,
    ): Promise<T> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (token) headers.Authorization = "Bearer " + token;
        const response = await transport(base + path, method, headers, body);
        const envelope = response.body as {
            data?: T;
            error?: { code: string; message: string };
        } | null;
        if (
            response.status >= 200 &&
            response.status < 300 &&
            envelope?.data !== undefined &&
            !envelope.error
        ) {
            return envelope.data;
        }
        throw new GameApiError(
            response.status,
            envelope?.error?.code ?? "INVALID_RESPONSE",
            envelope?.error?.message ?? "服务返回异常",
        );
    }
    const runPath = (id: string) => "/runs/" + encodeURIComponent(id);
    const api: GameApi = {
        start: (requestId) => call("POST", "/runs", { requestId }),
        active: () => call("GET", "/runs/active"),
        run: (id) => call("GET", runPath(id)),
        operate: (id: string, request: OperationRequest) =>
            call("POST", runPath(id) + "/operations", request),
        settle: (id) => call("PUT", runPath(id) + "/settlement"),
        zoo: () => call("GET", "/zoo/current"),
        collection: () => call("GET", "/collection"),
        inventory: () => call("GET", "/inventory"),
        rank: (weekId) =>
            call("GET", "/leaderboards/weeks/" + encodeURIComponent(weekId)),
        claimAnimal: (id) => call("PUT", runPath(id) + "/animal-reward"),
        claimReserve: (id, propType) =>
            call("PUT", runPath(id) + "/reserve-reward", { propType }),
    };
    return {
        ...api,
        async login(code: string) {
            token = "";
            const session = await call<{
                playerId: string;
                accessToken: string;
                expiresAt: string;
            }>("POST", "/sessions", { code });
            if (!session?.accessToken) throw new Error("会话凭据缺失");
            token = session.accessToken;
            return session;
        },
        rewardAttempt(request: {
            requestId: string;
            source: "VIDEO" | "HOME_SHARE";
            propType: Prop;
            runId?: string;
        }) {
            return call<RewardAttempt>("POST", "/reward-attempts", request);
        },
        confirmReward(id: string, evidence: object) {
            return call<RewardAttempt>(
                "PUT",
                "/reward-attempts/" + encodeURIComponent(id) + "/confirmation",
                { evidence },
            );
        },
        rewardStatus(id: string) {
            return call<RewardAttempt>(
                "GET",
                "/reward-attempts/" + encodeURIComponent(id),
            );
        },
    };
}
