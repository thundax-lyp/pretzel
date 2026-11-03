import { logout } from "@/auth/auth-service";
import { useCurrentAccessToken } from "@/auth/hooks/use-current-access-token";
import {
    ApiOutlined,
    AppstoreOutlined,
    AuditOutlined,
    BookOutlined,
    CloudServerOutlined,
    DownOutlined,
    FileTextOutlined,
    IdcardOutlined,
    LogoutOutlined,
    MenuOutlined,
    MoonOutlined,
    SafetyCertificateOutlined,
    SunOutlined,
    TeamOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { ProLayout, type MenuDataItem } from "@ant-design/pro-components";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { MenuProps } from "antd";
import { Alert, App, Avatar, Button, Dropdown, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { refreshAccessTokenIfNeeded } from "../api/http";
import { replacePermissions } from "../auth/permission-storage";
import { toAuthenticatedResourceUrl } from "../auth/resource-url";
import { clearAccessToken, getAccessToken } from "../auth/token-storage";

import {
    getCurrentUserInfo,
    listCurrentUserMenus,
    listCurrentUserPerms,
} from "../session/current-user-service";
import {
    getStoredTheme,
    setAdminTheme,
    subscribeAdminThemeChange,
} from "../theme/theme-storage";

const { Text } = Typography;
const TOKEN_KEEP_ALIVE_INTERVAL_MS = 30 * 1000;

const menuIconMap: Record<string, ReactNode> = {
    dashboard: <AppstoreOutlined />,
    system: <SafetyCertificateOutlined />,
    "system-log": <AuditOutlined />,
    "audit-log": <AuditOutlined />,
    operations: <AppstoreOutlined />,
    "operations-dashboard": <AppstoreOutlined />,
    "operations-task": <FileTextOutlined />,
    "operations-report": <FileTextOutlined />,
    "operations-backup-restore": <FileTextOutlined />,
    "operations-cleanup": <FileTextOutlined />,
    users: <TeamOutlined />,
    roles: <SafetyCertificateOutlined />,
    menus: <MenuOutlined />,
    departments: <AppstoreOutlined />,
    dictionaries: <BookOutlined />,
    dictionary: <BookOutlined />,
    logs: <AuditOutlined />,
    audit: <AuditOutlined />,
    "audit-logs": <AuditOutlined />,
    ai: <ApiOutlined />,
    "ai-service": <CloudServerOutlined />,
    "ai-model": <ApiOutlined />,
    "ai-capability": <SafetyCertificateOutlined />,
    "ai-prompt": <BookOutlined />,
    "ai-invocation": <AuditOutlined />,
    classics: <BookOutlined />,
    book: <BookOutlined />,
    sancai: <BookOutlined />,
    knowledge: <BookOutlined />,
    taxonomy: <BookOutlined />,
    "knowledge-graph": <BookOutlined />,
    storage: <CloudServerOutlined />,
    "storage-objects": <CloudServerOutlined />,
    submission: <FileTextOutlined />,
    submissions: <FileTextOutlined />,
    "open-api": <ApiOutlined />,
    permission: <SafetyCertificateOutlined />,
};

const normalizeMenuKey = (menu: { id: string; url?: string | null }) => {
    return menu.url || String(menu.id);
};

const getDisplayIcon = (displayParams?: string | null) => {
    if (!displayParams) {
        return undefined;
    }

    try {
        const parsedDisplayParams = JSON.parse(displayParams) as {
            icon?: unknown;
        };
        return typeof parsedDisplayParams.icon === "string"
            ? parsedDisplayParams.icon
            : undefined;
    } catch {
        return undefined;
    }
};

const renderMenuIcon = (
    icon?: string | null,
    displayParams?: string | null,
) => {
    const configuredIcon = icon || getDisplayIcon(displayParams);
    const iconKey = configuredIcon?.trim();
    if (!iconKey) {
        return (
            <span className="menu-icon-config-error" title="菜单缺少 icon">
                !
            </span>
        );
    }

    return (
        menuIconMap[iconKey] || (
            <span
                className="menu-icon-config-error"
                title={`未知菜单 icon: ${iconKey}`}
            >
                !
            </span>
        )
    );
};

const buildAuthorizedMenuItems = (
    menus: Awaited<ReturnType<typeof listCurrentUserMenus>>,
): MenuDataItem[] => {
    if (!menus.length) {
        return [];
    }

    const menuIds = new Set(menus.map((menu) => menu.id));
    const childrenByParentId = new Map<string | null, typeof menus>();
    menus.forEach((menu) => {
        const parentId =
            menu.parentId &&
            menu.parentId !== menu.id &&
            menuIds.has(menu.parentId)
                ? menu.parentId
                : null;
        const siblings = childrenByParentId.get(parentId) || [];
        siblings.push(menu);
        childrenByParentId.set(parentId, siblings);
    });

    const visited = new Set<string>();
    const toMenuItem = (
        menu: (typeof menus)[number],
        ancestors: Set<string> = new Set(),
    ): MenuDataItem => {
        const key = normalizeMenuKey(menu);
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(menu.id);
        visited.add(menu.id);
        const children = (childrenByParentId.get(menu.id) || []).filter(
            (child) => !nextAncestors.has(child.id),
        );

        return {
            key,
            path: key,
            icon: renderMenuIcon(menu.icon, menu.displayParams),
            name: menu.name,
            children: children.length
                ? children.map((child) => toMenuItem(child, nextAncestors))
                : undefined,
        };
    };
    const rootMenus = childrenByParentId.get(null) || [];
    const rootMenuItems = rootMenus.map((menu) => toMenuItem(menu));
    const orphanMenuItems = menus
        .filter((menu) => !visited.has(menu.id))
        .map((menu) => toMenuItem(menu));

    return [
        ...(rootMenuItems as MenuDataItem[]),
        ...(orphanMenuItems as MenuDataItem[]),
    ];
};

export const AdminLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { message: messageApi } = App.useApp();
    const [themeName, setThemeName] = useState<"light" | "dark">(
        getStoredTheme,
    );
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const accessToken = useCurrentAccessToken();
    const currentUserInfoQuery = useQuery({
        queryKey: ["current-user", "info"],
        queryFn: getCurrentUserInfo,
        retry: false,
    });
    const currentUserMenusQuery = useQuery({
        queryKey: ["current-user", "menus"],
        queryFn: listCurrentUserMenus,
        enabled: currentUserInfoQuery.isSuccess,
        retry: false,
    });
    const currentUserPermsQuery = useQuery({
        queryKey: ["current-user", "perms"],
        queryFn: listCurrentUserPerms,
        enabled: currentUserInfoQuery.isSuccess,
        retry: false,
    });
    const logoutMutation = useMutation({
        mutationFn: async () => {
            const token = getAccessToken();
            if (!token) {
                return false;
            }

            return logout();
        },
        onSuccess: () => {
            clearAccessToken();
            messageApi.success("已退出登录");
            navigate("/login", { replace: true });
        },
        onError: () => {
            messageApi.error("退出失败，请重试");
        },
    });
    const menuItems = currentUserMenusQuery.data
        ? buildAuthorizedMenuItems(currentUserMenusQuery.data)
        : [];
    const currentUser = currentUserInfoQuery.data;
    const currentUserAvatar = toAuthenticatedResourceUrl(
        currentUser?.avatar,
        accessToken,
    );
    const currentUserName =
        currentUser?.name || currentUser?.loginName || "当前用户";
    useEffect(() => {
        if (currentUserPermsQuery.data) {
            replacePermissions(currentUserPermsQuery.data.perms || []);
        }
    }, [currentUserPermsQuery.data]);

    useEffect(() => {
        const syncTheme = () => setThemeName(getStoredTheme());
        return subscribeAdminThemeChange(syncTheme);
    }, []);

    useEffect(() => {
        void refreshAccessTokenIfNeeded().catch(() => undefined);
        const timer = window.setInterval(() => {
            void refreshAccessTokenIfNeeded().catch(() => undefined);
        }, TOKEN_KEEP_ALIVE_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const media = window.matchMedia("(max-width: 768px)");
        const collapseOnMobile = () => {
            if (media.matches) setSidebarCollapsed(true);
        };
        collapseOnMobile();
        media.addEventListener("change", collapseOnMobile);
        return () => media.removeEventListener("change", collapseOnMobile);
    }, []);

    const toggleTheme = () => {
        const nextTheme = themeName === "dark" ? "light" : "dark";
        setThemeName(nextTheme);
        setAdminTheme(nextTheme);
    };
    const userMenuItems: MenuProps["items"] = [
        {
            key: "profile",
            icon: <IdcardOutlined />,
            label: "个人资料",
        },
        {
            type: "divider",
        },
        {
            key: "logout",
            icon: <LogoutOutlined />,
            label: "退出登录",
        },
    ];

    return (
        <ProLayout
            title="Pretzel"
            logo={
                <AppstoreOutlined
                    aria-label="Pretzel"
                    style={{ fontSize: 28 }}
                />
            }
            layout="mix"
            fixedHeader
            fixSiderbar
            siderWidth={248}
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            navTheme={themeName === "dark" ? "realDark" : "light"}
            location={{ pathname: location.pathname }}
            menuDataRender={() => menuItems}
            menuItemRender={(item, dom) => (
                <a
                    href={item.path}
                    onClick={(event) => {
                        event.preventDefault();
                        if (item.path) navigate(item.path);
                    }}
                >
                    {dom}
                </a>
            )}
            actionsRender={() => [
                <Space key="account">
                    <Button
                        shape="circle"
                        aria-label={
                            themeName === "dark"
                                ? "切换为浅色主题"
                                : "切换为深色主题"
                        }
                        icon={
                            themeName === "dark" ? (
                                <SunOutlined />
                            ) : (
                                <MoonOutlined />
                            )
                        }
                        onClick={toggleTheme}
                    />
                    <Dropdown
                        menu={{
                            items: userMenuItems,
                            onClick: ({ key }) => {
                                if (key === "logout") {
                                    logoutMutation.mutate();
                                }
                                if (key === "profile") {
                                    messageApi.info("个人资料功能待接入");
                                }
                            },
                        }}
                        trigger={["click"]}
                    >
                        <Button
                            className="user-menu-trigger"
                            loading={logoutMutation.isPending}
                        >
                            <Avatar
                                size={32}
                                src={currentUserAvatar}
                                icon={<UserOutlined />}
                            />
                            <span className="user-menu-copy">
                                <Text strong>{currentUserName}</Text>
                                <Text type="secondary">
                                    {currentUser?.loginName || "未连接"}
                                </Text>
                            </span>
                            <DownOutlined />
                        </Button>
                    </Dropdown>
                </Space>,
            ]}
        >
            {currentUserInfoQuery.isError ? (
                <Alert
                    type="warning"
                    showIcon
                    title="当前用户信息加载失败"
                    description="请确认当前登录态有效，并检查后台当前用户接口。"
                    style={{ marginBottom: 16 }}
                ></Alert>
            ) : null}
            {currentUserMenusQuery.isError ? (
                <Alert
                    type="warning"
                    showIcon
                    title="权限菜单加载失败"
                    description="请确认当前登录态有效，并检查后台权限菜单接口。"
                    style={{ marginBottom: 16 }}
                ></Alert>
            ) : null}
            {currentUserPermsQuery.isError ? (
                <Alert
                    type="warning"
                    showIcon
                    title="权限字符串加载失败"
                    description="请确认当前登录态有效，并检查后台当前用户权限接口。"
                    style={{ marginBottom: 16 }}
                ></Alert>
            ) : null}
            <Outlet />
        </ProLayout>
    );
};
