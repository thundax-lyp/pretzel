import { clearPermissions } from "./permission-storage";

const SESSION_KEY = "pretzel.admin.session";
export const getTokenSessionId = () => localStorage.getItem(SESSION_KEY);

const ACCESS_TOKEN_KEY = "pretzel.admin.accessToken";
const REFRESH_TOKEN_KEY = "pretzel.admin.refreshToken";
const ACCESS_TOKEN_EXPIRE_AT_KEY = "pretzel.admin.accessTokenExpireAt";
const ACCESS_TOKEN_CHANGE_EVENT = "pretzel.admin.accessToken.change";

export interface TokenSession {
    token: string;
    refreshToken?: string;
    expireAt?: number;
}

const notifyAccessTokenChange = () => {
    window.dispatchEvent(new Event(ACCESS_TOKEN_CHANGE_EVENT));
};

export const getAccessToken = () => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = () => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const getAccessTokenExpireAt = () => {
    const expireAt = localStorage.getItem(ACCESS_TOKEN_EXPIRE_AT_KEY);
    if (!expireAt) {
        return null;
    }

    const parsedExpireAt = Number(expireAt);
    return Number.isFinite(parsedExpireAt) ? parsedExpireAt : null;
};

export const saveTokenSession = (session: TokenSession) => {
    if (!getTokenSessionId())
        localStorage.setItem(
            SESSION_KEY,
            Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
                value.toString(16).padStart(2, "0"),
            ).join(""),
        );
    localStorage.setItem(ACCESS_TOKEN_KEY, session.token);
    if (session.refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    }
    if (session.expireAt) {
        localStorage.setItem(
            ACCESS_TOKEN_EXPIRE_AT_KEY,
            String(session.expireAt),
        );
    }
    notifyAccessTokenChange();
};

export const clearAccessToken = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_EXPIRE_AT_KEY);
    clearPermissions();
    notifyAccessTokenChange();
};

export const subscribeAccessTokenChange = (listener: () => void) => {
    window.addEventListener(ACCESS_TOKEN_CHANGE_EVENT, listener);
    window.addEventListener("storage", listener);

    return () => {
        window.removeEventListener(ACCESS_TOKEN_CHANGE_EVENT, listener);
        window.removeEventListener("storage", listener);
    };
};
