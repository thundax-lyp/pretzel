import { useSyncExternalStore } from "react";
import {
    getPermissions,
    hasPermission,
    subscribePermissionsChange,
} from "@/auth/permission-storage";

const getPermissionSnapshot = () => getPermissions().join("\n");

export const usePermissions = () => {
    useSyncExternalStore(
        subscribePermissionsChange,
        getPermissionSnapshot,
        getPermissionSnapshot,
    );
    return hasPermission;
};

export const usePermission = (permission: string) =>
    usePermissions()(permission);
