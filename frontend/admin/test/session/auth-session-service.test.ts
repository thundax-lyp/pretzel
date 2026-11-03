import { loginWithPermissions } from "@/session/auth-session-service";
import { login } from "@/auth/auth-service";
import { listCurrentUserPerms } from "@/session/current-user-service";
import { getAccessToken, clearAccessToken } from "@/auth/token-storage";
import { hasPermission } from "@/auth/permission-storage";
vi.mock("@/auth/auth-service", () => ({ login: vi.fn() }));
vi.mock("@/session/current-user-service", () => ({
    listCurrentUserPerms: vi.fn(),
}));
beforeEach(() => {
    clearAccessToken();
    vi.resetAllMocks();
});
it("binds a successful login to server permissions", async () => {
    vi.mocked(login).mockResolvedValue({ token: "new-token" });
    vi.mocked(listCurrentUserPerms).mockResolvedValue({
        perms: ["sys:user:view"],
    });
    await loginWithPermissions({
        loginToken: "pre",
        userName: "admin",
        password: "encrypted",
    });
    expect(getAccessToken()).toBe("new-token");
    expect(hasPermission("sys:user:view")).toBe(true);
});
it("clears token and permissions if permission setup fails", async () => {
    vi.mocked(login).mockResolvedValue({ token: "new-token" });
    vi.mocked(listCurrentUserPerms).mockRejectedValue(new Error("offline"));
    await expect(
        loginWithPermissions({
            loginToken: "pre",
            userName: "admin",
            password: "encrypted",
        }),
    ).rejects.toThrow("offline");
    expect(getAccessToken()).toBeNull();
    expect(hasPermission("sys:user:view")).toBe(false);
});
