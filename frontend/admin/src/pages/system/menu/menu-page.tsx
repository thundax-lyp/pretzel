import { usePermissions } from "@/auth/hooks/use-permission";
import { MenuOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
    PageContainer,
    ProColumns,
    ProTable,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Space, Switch, Typography } from "antd";
import type { Key } from "react";
import { useMemo, useState } from "react";

import { MenuEditDrawer } from "./menu-edit-drawer";
import type { MenuMoveCommand, MenuSaveCommand } from "./menu-service";
import * as service from "./menu-service";
import type { MenuNode, MenuTableNode } from "./menu-types";

import "./menu-page.css";

const { Text } = Typography;

const DEFAULT_COLUMN_WIDTHS = {
    action: 132,
    name: 260,
    sort: 28,
    url: 260,
    perms: 240,
    display: 96,
};

const TABLE_SCROLL_X =
    DEFAULT_COLUMN_WIDTHS.name +
    DEFAULT_COLUMN_WIDTHS.url +
    DEFAULT_COLUMN_WIDTHS.perms +
    DEFAULT_COLUMN_WIDTHS.display +
    DEFAULT_COLUMN_WIDTHS.action +
    DEFAULT_COLUMN_WIDTHS.sort;

const buildMenuTree = (menus: MenuNode[]) => {
    const nodeMap = new Map<string, MenuTableNode>();
    const roots: MenuTableNode[] = [];

    menus.forEach((menu) => {
        nodeMap.set(menu.id, { ...menu });
    });

    nodeMap.forEach((menu) => {
        if (menu.parentId) {
            const parent = nodeMap.get(menu.parentId);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(menu);
                return;
            }
        }
        roots.push(menu);
    });

    return roots;
};

const collectMenuIds = (menus: MenuTableNode[]): string[] => {
    return menus.flatMap((menu) => [
        menu.id,
        ...(menu.children ? collectMenuIds(menu.children) : []),
    ]);
};

const flattenMenus = (menus: MenuTableNode[]): MenuTableNode[] => {
    return menus.flatMap((menu) => [
        menu,
        ...(menu.children ? flattenMenus(menu.children) : []),
    ]);
};

const collectDescendantIds = (menu?: MenuTableNode | null): Set<string> => {
    if (!menu?.children?.length) {
        return new Set();
    }
    return new Set(collectMenuIds(menu.children));
};

const toMoveType = (position: "before" | "after"): MenuMoveCommand["type"] => {
    return position === "before" ? "before" : "after";
};

export const MenuPage = () => {
    const hasPermission = usePermissions();
    const { message: messageApi } = App.useApp();
    const { modal } = App.useApp();
    const queryClient = useQueryClient();
    const [editingMenu, setEditingMenu] = useState<MenuTableNode | null>(null);
    const [menuEditDrawerOpen, setMenuEditDrawerOpen] = useState(false);
    const [expandedRowKeys, setExpandedRowKeys] = useState<Key[] | null>(null);
    const canEditMenu = hasPermission("super");
    const canViewMenu = canEditMenu;
    const menuTreeQuery = useQuery({
        queryKey: ["menu", "list"],
        queryFn: () => service.listMenus(),
        enabled: canViewMenu,
        retry: false,
    });
    const menus = useMemo(() => menuTreeQuery.data || [], [menuTreeQuery.data]);
    const menuTree = useMemo(() => buildMenuTree(menus), [menus]);
    const flatMenus = useMemo(() => flattenMenus(menuTree), [menuTree]);
    const expandedMenuIds = useMemo(() => collectMenuIds(menuTree), [menuTree]);
    const actualExpandedRowKeys = expandedRowKeys || expandedMenuIds;
    const unavailableParentIds = useMemo(() => {
        const descendantIds = collectDescendantIds(editingMenu);
        if (editingMenu?.id) {
            descendantIds.add(editingMenu.id);
        }
        return descendantIds;
    }, [editingMenu]);
    const parentOptions = useMemo(
        () =>
            flatMenus
                .filter((menu) => !unavailableParentIds.has(menu.id))
                .map((menu) => ({
                    label: menu.name,
                    value: menu.id,
                })),
        [flatMenus, unavailableParentIds],
    );

    const saveMenuMutation = useMutation({
        mutationFn: (values: MenuSaveCommand) =>
            values.id
                ? service.changeMenuInfo(values)
                : service.addMenu(values),
        onSuccess: async () => {
            setMenuEditDrawerOpen(false);
            setEditingMenu(null);
            await queryClient.invalidateQueries({ queryKey: ["menu", "list"] });
            messageApi.success("菜单已保存");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "保存失败",
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: service.removeMenus,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["menu", "list"] });
            messageApi.success("菜单已删除");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "删除失败",
            );
        },
    });

    const moveMutation = useMutation({
        mutationFn: service.moveMenu,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["menu", "list"] });
            messageApi.success("菜单层级已更新");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "移动失败",
            );
        },
    });

    const displayMutation = useMutation({
        mutationFn: ({ id, display }: { id: string; display: boolean }) =>
            service.changeMenuDisplay(id, display),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["menu", "list"] });
            messageApi.success("菜单显示状态已更新");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "显示状态更新失败",
            );
        },
    });

    const openCreateMenuDrawer = () => {
        if (!canEditMenu) {
            return;
        }
        setEditingMenu(null);
        setMenuEditDrawerOpen(true);
    };

    const openEditMenuDrawer = (menu: MenuTableNode) => {
        if (!canEditMenu) {
            return;
        }
        setEditingMenu(menu);
        setMenuEditDrawerOpen(true);
    };

    const closeMenuEditDrawer = () => {
        if (saveMenuMutation.isPending) {
            return;
        }
        setMenuEditDrawerOpen(false);
        setEditingMenu(null);
    };

    const saveMenu = (request: MenuSaveCommand) => {
        if (!canEditMenu) {
            return;
        }
        saveMenuMutation.mutate(request);
    };

    const openDeleteConfirm = (menu: MenuTableNode) => {
        if (!canEditMenu) {
            return;
        }
        modal.confirm({
            okButtonProps: { danger: true },
            cancelText: "取消",
            title: "删除菜单",
            content: (
                <>
                    <p>{`确认删除 ${menu.name || ""}？`}</p>
                    <p>
                        {
                            "删除后需要重新新增。若该菜单下仍有关联子菜单，接口会按后端校验结果拦截。"
                        }
                    </p>
                </>
            ),

            okText: "删除",
            onOk: () => deleteMutation.mutateAsync([menu.id]),
        });
    };

    const sortMenu = (
        sourceMenu: MenuTableNode,
        targetMenu: MenuTableNode,
        position: "before" | "after",
    ) => {
        if (!canEditMenu || sourceMenu.id === targetMenu.id) {
            return;
        }
        moveMutation.mutate({
            fromNodeId: sourceMenu.id,
            toNodeId: targetMenu.id,
            type: toMoveType(position),
        });
    };

    const readSiblingMenus = (menu: MenuTableNode) => {
        if (!menu.parentId) {
            return menuTree;
        }
        return (
            flatMenus.find((item) => item.id === menu.parentId)?.children || []
        );
    };

    const readPreviousSiblingMenu = (menu: MenuTableNode) => {
        const siblings = readSiblingMenus(menu);
        const index = siblings.findIndex((item) => item.id === menu.id);
        return index > 0 ? siblings[index - 1] : null;
    };

    const promoteMenu = (menu: MenuTableNode) => {
        if (!canEditMenu || !menu.parentId) {
            return;
        }
        moveMutation.mutate({
            fromNodeId: menu.id,
            toNodeId: menu.parentId,
            type: "after",
        });
    };

    const demoteMenu = (menu: MenuTableNode) => {
        const previousSibling = readPreviousSiblingMenu(menu);
        if (!canEditMenu || !previousSibling) {
            return;
        }
        moveMutation.mutate({
            fromNodeId: menu.id,
            toNodeId: previousSibling.id,
            type: "insideLast",
        });
    };

    if (!canViewMenu) {
        return <Empty description="缺少 super 权限" />;
    }

    const columns: ProColumns<MenuTableNode>[] = [
        {
            title: "菜单名称",
            dataIndex: "name",
            key: "name",

            ellipsis: true,
            renderText: (name: string) => (
                <Space size={8} className="menu-name-cell">
                    <MenuOutlined className="menu-name-icon" />
                    <span className="menu-name-text" title={name}>
                        {name}
                    </span>
                </Space>
            ),
        },
        {
            title: "URL",
            dataIndex: "url",
            key: "url",
            width: DEFAULT_COLUMN_WIDTHS.url,
            ellipsis: true,
            renderText: (url?: string | null) =>
                url ? (
                    <span className="menu-path-text" title={url}>
                        {url}
                    </span>
                ) : null,
        },
        {
            title: "权限标识",
            dataIndex: "perms",
            key: "perms",
            width: DEFAULT_COLUMN_WIDTHS.perms,
            ellipsis: true,
            renderText: (perms?: string | null) =>
                perms ? (
                    <span className="menu-path-text" title={perms}>
                        {perms}
                    </span>
                ) : null,
        },
        {
            title: "显示",
            dataIndex: "display",
            key: "display",
            width: DEFAULT_COLUMN_WIDTHS.display,
            renderText: (display: boolean | null | undefined, menu) => (
                <Switch
                    checked={display !== false}
                    checkedChildren="显示"
                    unCheckedChildren="隐藏"
                    disabled={!canEditMenu || displayMutation.isPending}
                    aria-label={`切换 ${menu.name} 显示状态，当前${display === false ? "隐藏" : "显示"}`}
                    onChange={(checked) => {
                        if (canEditMenu) {
                            displayMutation.mutate({
                                id: menu.id,
                                display: checked,
                            });
                        }
                    }}
                ></Switch>
            ),
        },
        {
            key: "actions",
            title: "操作",
            valueType: "option",
            fixed: "right",
            render: (_, menu) => [
                <Button
                    type="link"
                    key={"promote"}
                    disabled={
                        !canEditMenu || !menu.parentId || moveMutation.isPending
                    }
                    aria-label={`升级 ${menu.name}`}
                    onClick={() => promoteMenu(menu)}
                >
                    {"升级"}
                </Button>,
                <Button
                    type="link"
                    key={"demote"}
                    disabled={
                        !canEditMenu ||
                        !readPreviousSiblingMenu(menu) ||
                        moveMutation.isPending
                    }
                    aria-label={`降级 ${menu.name}`}
                    onClick={() => demoteMenu(menu)}
                >
                    {"降级"}
                </Button>,
                <Button
                    type="link"
                    key={"edit"}
                    disabled={!canEditMenu}
                    aria-label={`编辑 ${menu.name}`}
                    onClick={() => openEditMenuDrawer(menu)}
                >
                    {"编辑"}
                </Button>,
                null,
                <Button
                    type="link"
                    key={"delete"}
                    danger
                    disabled={!canEditMenu}
                    aria-label={`删除 ${menu.name}`}
                    onClick={() => openDeleteConfirm(menu)}
                >
                    {"删除"}
                </Button>,
            ],
        },
    ];

    return (
        <>
            <PageContainer
                title={"菜单管理"}
                content={"维护后台菜单树、页面入口和权限标识。"}
                className={"menu-page"}
                extra={
                    <Space wrap>
                        {
                            <>
                                <Button
                                    data-testid={
                                        "system-menu-menu-refresh-button"
                                    }
                                    className="menu-action-button"
                                    icon={<ReloadOutlined />}
                                    disabled={!canViewMenu}
                                    onClick={() => {
                                        if (!canViewMenu) {
                                            return;
                                        }
                                        void menuTreeQuery.refetch();
                                    }}
                                >
                                    刷新
                                </Button>
                                {canEditMenu ? (
                                    <Button
                                        data-testid={
                                            "system-menu-menu-action-button"
                                        }
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={openCreateMenuDrawer}
                                    >
                                        新增菜单
                                    </Button>
                                ) : null}
                            </>
                        }
                    </Space>
                }
            >
                <ProTable<MenuTableNode>
                    search={false}
                    options={false}
                    rowKey="id"
                    className="menu-table"
                    columns={columns}
                    dataSource={menuTree}
                    loading={menuTreeQuery.isFetching || moveMutation.isPending}
                    pagination={false}
                    scroll={{ x: TABLE_SCROLL_X }}
                    expandable={{
                        expandedRowKeys: actualExpandedRowKeys,
                        indentSize: 24,
                        expandIconColumnIndex: 0,
                        onExpandedRowsChange: (keys) =>
                            setExpandedRowKeys([...keys]),
                    }}
                    locale={{
                        emptyText: menuTreeQuery.isError ? (
                            "菜单列表加载失败，请确认权限和接口状态。"
                        ) : (
                            <Space orientation="vertical" size={8}>
                                <MenuOutlined className="menu-empty-icon" />
                                <Text
                                    type="secondary"
                                    className="menu-secondary-text"
                                >
                                    暂无菜单数据
                                </Text>
                            </Space>
                        ),
                    }}
                    onRow={(record) => ({
                        draggable: canEditMenu && !moveMutation.isPending,
                        onDragStart: (event) => {
                            event.dataTransfer.setData("text/plain", record.id);
                            event.dataTransfer.effectAllowed = "move";
                        },
                        onDragOver: (event) => {
                            if (canEditMenu && !moveMutation.isPending)
                                event.preventDefault();
                        },
                        onDrop: (event) => {
                            event.preventDefault();
                            if (!canEditMenu || moveMutation.isPending) return;
                            const source = flatMenus.find(
                                (item) =>
                                    item.id ===
                                    event.dataTransfer.getData("text/plain"),
                            );
                            if (!source || source.id === record.id) return;
                            const rect =
                                event.currentTarget.getBoundingClientRect();
                            sortMenu(
                                source,
                                record,
                                event.clientY < rect.top + rect.height / 2
                                    ? "before"
                                    : "after",
                            );
                        },
                    })}
                />
            </PageContainer>

            <MenuEditDrawer
                open={menuEditDrawerOpen}
                menu={editingMenu}
                parentOptions={parentOptions}
                saving={saveMenuMutation.isPending}
                onClose={closeMenuEditDrawer}
                onSave={saveMenu}
            />
        </>
    );
};
