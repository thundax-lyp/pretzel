import {
    clearPermissions,
    hasPermission,
    replacePermissions,
    subscribePermissionsChange,
} from "@/auth/permission-storage";

describe("permission-storage", () => {
    beforeEach(() => {
        localStorage.clear();
        clearPermissions();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("reloads permissions from localStorage when another tab updates storage", () => {
        replacePermissions(["knowledge:graph:view"]);
        const listener = vi.fn();
        const unsubscribe = subscribePermissionsChange(listener);

        localStorage.setItem(
            "pretzel.admin.permissions",
            JSON.stringify(["knowledge:graph:view", "knowledge:graph:apply"]),
        );
        window.dispatchEvent(
            new StorageEvent("storage", {
                key: "pretzel.admin.permissions",
            }),
        );

        expect(listener).toHaveBeenCalledTimes(1);
        expect(hasPermission("knowledge:graph:apply")).toBe(true);

        unsubscribe();
    });
});

it("matches built-in super and segment prefixes consistently with the server", () => {
    replacePermissions(["sys:role"]);
    expect(hasPermission("sys:role:view")).toBe(true);
    expect(hasPermission("sys:roles:view")).toBe(false);
    expect(hasPermission("super")).toBe(false);
    replacePermissions(["super"]);
    expect(hasPermission("system:log:view")).toBe(true);
    expect(hasPermission("")).toBe(false);
});
