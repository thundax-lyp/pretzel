import { login } from "@/auth/auth-service";
import type { LoginCommand } from "@/auth/auth-service";
import type { AccessTokenRecord } from "@/auth/auth-types";
import { listCurrentUserPerms } from "./current-user-service";
import {
    clearPermissions,
    replacePermissions,
} from "@/auth/permission-storage";
import { clearAccessToken, saveTokenSession } from "@/auth/token-storage";

export const loginWithPermissions = async (
    request: LoginCommand,
): Promise<AccessTokenRecord> => {
    clearAccessToken();
    clearPermissions();
    const response = await login(request);
    saveTokenSession(response);

    try {
        const currentUserPerms = await listCurrentUserPerms();
        replacePermissions(currentUserPerms.perms || []);
    } catch (error) {
        clearAccessToken();
        throw error;
    }

    return response;
};
