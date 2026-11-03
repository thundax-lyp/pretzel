import {
    clearAccessToken,
    getAccessToken,
    getAccessTokenExpireAt,
    getRefreshToken,
    getTokenSessionId,
    saveTokenSession,
} from "../auth/token-storage";

export const ADMIN_API_BASE_URL =
    import.meta.env.VITE_ADMIN_API_BASE_URL || "/pretzel-admin-api/api";
const ACCESS_TOKEN_HEADER = "Access-Token";
const AUTH_INVALID_CODE = "COMMON-00002";
const ADMIN_CLIENT_ID = "admin-api";
const TOKEN_REFRESH_PATH = "/auth/session/token/refresh";
const TOKEN_REFRESH_AHEAD_MS = 60 * 1000;

interface ApiResponse<T> {
    code: string;
    message: string;
    data: T;
}

interface RequestOptions<TBody> {
    body?: TBody;
    signal?: AbortSignal;
}

interface FormDataProgressOptions {
    signal?: AbortSignal;
}

interface AccessTokenPayload {
    token: string;
    refreshToken?: string;
    expireAt?: number;
}

export class ApiError extends Error {
    readonly code: string | number;

    constructor(code: string | number, message: string) {
        super(message);
        this.name = "ApiError";
        this.code = code;
    }
}

const assertCurrentSession = (sessionId: string | null) => {
    if (getTokenSessionId() !== sessionId) {
        throw new ApiError("SESSION_CHANGED", "登录会话已变化，请重新操作");
    }
};

const isSuccessCode = (code: string | undefined) => {
    return code === "COMMON-00000";
};

const isAuthInvalid = (
    response: Response,
    code: string | number | undefined,
) => {
    return response.status === 401 || code === AUTH_INVALID_CODE;
};

const safeReadApiResponse = async <T>(response: Response) => {
    const text = await response.text();
    if (!text.trim()) {
        return null;
    }
    try {
        return JSON.parse(text) as ApiResponse<T>;
    } catch {
        return null;
    }
};

const shouldRefreshBeforeRequest = () => {
    const token = getAccessToken();
    const refreshToken = getRefreshToken();
    const expireAt = getAccessTokenExpireAt();
    return Boolean(
        token &&
        refreshToken &&
        expireAt &&
        expireAt <= Date.now() + TOKEN_REFRESH_AHEAD_MS,
    );
};

let refreshPromise: Promise<AccessTokenPayload | null> | null = null;
let logoutPromise: Promise<boolean> | null = null;

const requestTokenRefresh = async () => {
    const refreshToken = getRefreshToken();
    const sessionId = getTokenSessionId();
    if (!refreshToken) {
        return null;
    }

    const response = await fetch(`${ADMIN_API_BASE_URL}${TOKEN_REFRESH_PATH}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            clientId: ADMIN_CLIENT_ID,
            refreshToken,
        }),
    });

    const payload = await safeReadApiResponse<AccessTokenPayload>(response);
    if (getTokenSessionId() !== sessionId || getRefreshToken() !== refreshToken)
        return null;
    if (
        !response.ok ||
        !isSuccessCode(payload?.code) ||
        !payload?.data?.token
    ) {
        clearAccessToken();
        return null;
    }

    saveTokenSession(payload.data);
    return payload.data;
};

export const refreshAccessTokenIfNeeded = async () => {
    if (refreshPromise) {
        const refreshedToken = await refreshPromise;
        return refreshedToken?.token || getAccessToken();
    }

    if (!shouldRefreshBeforeRequest()) {
        return getAccessToken();
    }

    const refreshedToken = await refreshAccessToken();
    return refreshedToken?.token || getAccessToken();
};

const refreshAccessToken = async () => {
    if (logoutPromise) return null;
    if (!refreshPromise) {
        refreshPromise = requestTokenRefresh().finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
};

const requestJson = async <TResponse, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody>,
    token: string | null,
) => {
    const headers: HeadersInit = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers[ACCESS_TOKEN_HEADER] = token;
    }

    const response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body:
            options.body === undefined
                ? undefined
                : JSON.stringify(options.body),
        signal: options.signal,
    });

    const payload = (await response.json()) as ApiResponse<TResponse>;
    return { response, payload };
};

const requestFormData = async <TResponse>(
    path: string,
    body: FormData,
    token: string | null,
    options: FormDataProgressOptions = {},
) => {
    const headers: HeadersInit = {};
    if (token) {
        headers[ACCESS_TOKEN_HEADER] = token;
    }

    const response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
        method: "POST",
        headers,
        body,
        signal: options.signal,
    });

    const payload = (await response.json()) as ApiResponse<TResponse>;
    return { response, payload };
};

export const postJson = async <TResponse, TBody = unknown>(
    path: string,
    options: RequestOptions<TBody> = {},
) => {
    const sessionId = getTokenSessionId();
    if (path !== TOKEN_REFRESH_PATH) {
        await refreshAccessTokenIfNeeded();
    }
    assertCurrentSession(sessionId);

    const token = getAccessToken();
    let { response, payload } = await requestJson<TResponse, TBody>(
        path,
        options,
        token,
    );

    assertCurrentSession(sessionId);
    if (!response.ok || !isSuccessCode(payload.code)) {
        const code = payload.code ?? response.status;
        if (
            path !== TOKEN_REFRESH_PATH &&
            isAuthInvalid(response, code) &&
            getRefreshToken()
        ) {
            const refreshedToken = await refreshAccessToken();
            assertCurrentSession(sessionId);
            if (refreshedToken?.token) {
                const retryResult = await requestJson<TResponse, TBody>(
                    path,
                    options,
                    refreshedToken.token,
                );
                response = retryResult.response;
                payload = retryResult.payload;

                assertCurrentSession(sessionId);
                if (response.ok && isSuccessCode(payload.code)) {
                    return payload.data;
                }
            }
        }

        const finalCode = payload.code ?? response.status;
        if (isAuthInvalid(response, finalCode)) {
            clearAccessToken();
        }
        throw new ApiError(finalCode, payload.message || "请求失败");
    }

    return payload.data;
};

export const postSessionLogout = () => {
    if (logoutPromise) return logoutPromise;
    const sessionId = getTokenSessionId();
    const ready = refreshAccessTokenIfNeeded();
    logoutPromise = (async () => {
        await ready;
        assertCurrentSession(sessionId);
        const token = getAccessToken();
        if (!token) return false;
        const { response, payload } = await requestJson<boolean>(
            "/auth/session/logout",
            { body: { token } },
            token,
        );
        assertCurrentSession(sessionId);
        if (!response.ok || !isSuccessCode(payload.code)) {
            throw new ApiError(
                payload.code ?? response.status,
                payload.message || "退出失败",
            );
        }
        return payload.data;
    })().finally(() => {
        logoutPromise = null;
    });
    return logoutPromise;
};

export const postFormData = async <TResponse>(
    path: string,
    body: FormData,
    options: FormDataProgressOptions = {},
) => {
    const sessionId = getTokenSessionId();
    await refreshAccessTokenIfNeeded();
    assertCurrentSession(sessionId);

    const token = getAccessToken();
    let { response, payload } = await requestFormData<TResponse>(
        path,
        body,
        token,
        options,
    );

    assertCurrentSession(sessionId);
    if (!response.ok || !isSuccessCode(payload.code)) {
        const code = payload.code ?? response.status;
        if (isAuthInvalid(response, code) && getRefreshToken()) {
            const refreshedToken = await refreshAccessToken();
            assertCurrentSession(sessionId);
            if (refreshedToken?.token) {
                const retryResult = await requestFormData<TResponse>(
                    path,
                    body,
                    refreshedToken.token,
                    options,
                );
                response = retryResult.response;
                payload = retryResult.payload;

                assertCurrentSession(sessionId);
                if (response.ok && isSuccessCode(payload.code)) {
                    return payload.data;
                }
            }
        }

        const finalCode = payload.code ?? response.status;
        if (isAuthInvalid(response, finalCode)) {
            clearAccessToken();
        }
        throw new ApiError(finalCode, payload.message || "请求失败");
    }

    return payload.data;
};
