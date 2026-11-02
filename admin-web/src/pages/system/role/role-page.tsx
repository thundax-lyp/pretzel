import { hasPermission } from "@/auth/permission-storage";
import type { OptionsRecord } from "@/types/options";
import {
    DeleteOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
    PageContainer,
    ProColumns,
    ProTable,
    QueryFilter,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Alert,
    App,
    Button,
    Form,
    Input,
    Select,
    Space,
    Switch,
    Tag,
    Typography,
} from "antd";
import type { Key } from "react";
import { useMemo, useState } from "react";

import { RoleEditDrawer } from "./role-edit-drawer";
import type { RoleOptionKeys, RoleQuery } from "./role-service";
import * as service from "./role-service";
import type { RoleRecord } from "./role-types";

import "./role-page.css";

const { Text } = Typography;

const EMPTY_ROLE_OPTIONS: OptionsRecord<RoleOptionKeys> = {
    statusOptions: [],
    privilegeOptions: [],
};

const DEFAULT_COLUMN_WIDTHS = {
    name: 220,
    privilege: 120,
    status: 112,
    menuCount: 120,
};

interface RoleFilters {
    enable: "ALL" | "ENABLED" | "DISABLED";
}

const DEFAULT_ROLE_FILTERS: RoleFilters = {
    enable: "ALL",
};

const sortByMove = (
    roles: RoleRecord[],
    sourceRole: RoleRecord,
    targetRole: RoleRecord,
    position: "before" | "after",
) => {
    const sourceIndex = roles.findIndex((role) => role.id === sourceRole.id);
    const targetIndex = roles.findIndex((role) => role.id === targetRole.id);
    if (sourceIndex < 0 || targetIndex < 0) {
        return roles.map((role) => role.id);
    }

    const nextRoles = [...roles];
    const [movedRole] = nextRoles.splice(sourceIndex, 1);
    const nextTargetIndex = nextRoles.findIndex(
        (role) => role.id === targetRole.id,
    );
    nextRoles.splice(
        position === "before" ? nextTargetIndex : nextTargetIndex + 1,
        0,
        movedRole,
    );
    return nextRoles.map((role) => role.id);
};

export const RolePage = () => {
    const { message: messageApi } = App.useApp();
    const { modal } = App.useApp();
    const queryClient = useQueryClient();
    const canViewRole =
        hasPermission("sys:role:view") || hasPermission("sys:role:edit");
    const canEditRole = hasPermission("sys:role:edit");
    const [query, setQuery] = useState<RoleQuery>({});
    const [searchText, setSearchText] = useState("");
    const [filters, setFilters] = useState<RoleFilters>(DEFAULT_ROLE_FILTERS);
    const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
    const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
    const [roleEditDrawerOpen, setRoleEditDrawerOpen] = useState(false);
    const hasSelectedRoles = selectedRowKeys.length > 0;

    const rolePageQuery = useQuery({
        queryKey: ["role", "list", query],
        queryFn: () => service.list(query),
        enabled: canViewRole,
        retry: false,
    });
    const roleOptionsQuery = useQuery({
        queryKey: ["role", "options"],
        queryFn: service.getOptions,
        enabled: canViewRole,
        retry: false,
    });
    const roles = useMemo(() => rolePageQuery.data || [], [rolePageQuery.data]);
    const roleOptions = roleOptionsQuery.data ?? EMPTY_ROLE_OPTIONS;
    const statusLabelByValue = useMemo(() => {
        return new Map(
            roleOptions.statusOptions.map((option) => [
                option.value,
                option.label,
            ]),
        );
    }, [roleOptions.statusOptions]);
    const privilegeLabelByValue = useMemo(() => {
        return new Map(
            roleOptions.privilegeOptions.map((option) => [
                option.value,
                option.label,
            ]),
        );
    }, [roleOptions.privilegeOptions]);
    const filteredRoles = useMemo(() => {
        const normalizedSearchText = searchText.trim().toLowerCase();
        if (!normalizedSearchText) {
            return roles;
        }
        return roles.filter((role) => {
            return (
                role.name?.toLowerCase().includes(normalizedSearchText) ||
                role.remarks?.toLowerCase().includes(normalizedSearchText)
            );
        });
    }, [roles, searchText]);
    const statusMutation = useMutation({
        mutationFn: service.changeStatus,
        onSuccess: async () => {
            setSelectedRowKeys([]);
            await queryClient.invalidateQueries({ queryKey: ["role", "list"] });
            messageApi.success("角色状态已更新");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "状态更新失败",
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: service.remove,
        onSuccess: async () => {
            setSelectedRowKeys([]);
            await queryClient.invalidateQueries({ queryKey: ["role", "list"] });
            messageApi.success("角色已删除");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "删除失败",
            );
        },
    });

    const sortMutation = useMutation({
        mutationFn: service.sort,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["role", "list"] });
            messageApi.success("角色排序已更新");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "排序失败",
            );
        },
    });

    const applyFilters = () => {
        setSelectedRowKeys([]);
        setQuery({
            enable:
                filters.enable === "ALL"
                    ? undefined
                    : filters.enable === "ENABLED",
        });
    };

    const resetFilters = () => {
        setFilters(DEFAULT_ROLE_FILTERS);
        setSelectedRowKeys([]);
        setQuery({});
    };

    const openCreateRoleDrawer = () => {
        setEditingRole(null);
        setRoleEditDrawerOpen(true);
    };

    const openEditRoleDrawer = (role: RoleRecord) => {
        setEditingRole(role);
        setRoleEditDrawerOpen(true);
    };

    const closeRoleEditDrawer = () => {
        setRoleEditDrawerOpen(false);
        setEditingRole(null);
    };

    const updateSingleStatus = (role: RoleRecord, enable: boolean) => {
        if (!canEditRole) {
            return;
        }
        statusMutation.mutate({ roles: [{ id: role.id, enable }] });
    };

    const batchUpdateStatus = (enable: boolean) => {
        if (!canEditRole) {
            return;
        }
        statusMutation.mutate({
            roles: selectedRowKeys.map((id) => ({ id: String(id), enable })),
        });
    };

    const readStatusOptionLabel = (value: "ENABLED" | "DISABLED") => {
        return (
            statusLabelByValue.get(value) ||
            (value === "DISABLED" ? "禁用" : "启用")
        );
    };

    const readRoleStatusLabel = (role: RoleRecord) => {
        return readStatusOptionLabel(
            role.enable === false ? "DISABLED" : "ENABLED",
        );
    };

    const readPrivilegeLabel = (role: RoleRecord) => {
        const value = role.admin ? "ADMIN" : "NORMAL";
        return (
            privilegeLabelByValue.get(value) ||
            (role.admin ? "管理员角色" : "普通角色")
        );
    };

    const confirmDeleteRole = (role: RoleRecord) => {
        modal.confirm({
            okButtonProps: { danger: true },
            cancelText: "取消",
            title: "删除角色",
            content: (
                <>
                    <p>{`确认删除 ${role.name || ""}？`}</p>
                    <p>
                        {
                            "删除后需要重新新增。若角色仍有关联用户，接口会按后端校验结果拦截。"
                        }
                    </p>
                </>
            ),

            okText: "删除",
            onOk: () => deleteMutation.mutateAsync([role.id]),
        });
    };

    const batchDeleteRoles = () => {
        if (!canEditRole) {
            return;
        }
        modal.confirm({
            okButtonProps: { danger: true },
            cancelText: "取消",
            title: "批量删除角色",
            content: (
                <>
                    <p>{`确认删除 ${selectedRowKeys.length} 个角色？`}</p>
                    <p>
                        {
                            "删除后需要重新新增。若角色仍有关联用户，接口会按后端校验结果拦截。"
                        }
                    </p>
                </>
            ),

            okText: "删除",
            onOk: () => deleteMutation.mutateAsync(selectedRowKeys.map(String)),
        });
    };

    const sortRole = (
        sourceRole: RoleRecord,
        targetRole: RoleRecord,
        position: "before" | "after",
    ) => {
        if (!canEditRole || sourceRole.id === targetRole.id) {
            return;
        }
        // Filtered rows are intentional visible anchors for the complete global role order.
        sortMutation.mutate({
            orderedIds: sortByMove(roles, sourceRole, targetRole, position),
            sortDirection: "ASC",
        });
    };

    const columns: ProColumns<RoleRecord>[] = [
        {
            title: "角色名称",
            dataIndex: "name",
            key: "name",

            renderText: (name: string) => (
                <Space size={8}>
                    <SafetyCertificateOutlined className="role-name-icon" />
                    <Text strong>{name}</Text>
                </Space>
            ),
        },
        {
            title: "权限级别",
            dataIndex: "admin",
            key: "admin",
            width: DEFAULT_COLUMN_WIDTHS.privilege,
            render: (_, role) =>
                role.admin ? (
                    <Tag
                        color={
                            (
                                {
                                    neutral: "default",
                                    info: "processing",
                                    accent: "purple",
                                    success: "success",
                                    warning: "warning",
                                    danger: "error",
                                } as const
                            )["info"]
                        }
                    >
                        {readPrivilegeLabel(role)}
                    </Tag>
                ) : (
                    <Tag>{readPrivilegeLabel(role)}</Tag>
                ),
        },
        {
            title: "状态",
            dataIndex: "enable",
            key: "enable",
            width: DEFAULT_COLUMN_WIDTHS.status,
            renderText: (enable: boolean | null | undefined, role) => (
                <Switch
                    checked={enable !== false}
                    checkedChildren={readStatusOptionLabel("ENABLED")}
                    unCheckedChildren={readStatusOptionLabel("DISABLED")}
                    aria-label={`切换 ${role.name} 状态，当前${readRoleStatusLabel(role)}`}
                    disabled={!canEditRole || statusMutation.isPending}
                    onChange={(checked) => updateSingleStatus(role, checked)}
                ></Switch>
            ),
        },
        {
            title: "菜单权限",
            key: "menuCount",
            width: DEFAULT_COLUMN_WIDTHS.menuCount,
            render: (_, role) => `${role.menus?.length || 0} 项`,
        },
        {
            title: "备注",
            dataIndex: "remarks",
            key: "remarks",
            ellipsis: true,
            renderText: (remarks?: string | null) => remarks || null,
        },
        {
            key: "actions",
            title: "操作",
            valueType: "option",
            fixed: "right",
            render: (_, role) => [
                <Button
                    type="link"
                    key={"edit"}
                    disabled={!canEditRole}
                    aria-label={`编辑 ${role.name}`}
                    onClick={() => openEditRoleDrawer(role)}
                >
                    {"编辑"}
                </Button>,
                null,
                <Button
                    type="link"
                    key={"delete"}
                    danger
                    disabled={!canEditRole}
                    aria-label={`删除 ${role.name}`}
                    onClick={() => confirmDeleteRole(role)}
                >
                    {"删除"}
                </Button>,
            ],
        },
    ];

    const batchActions = (
        <Space wrap>
            <Button
                data-testid={"system-role-role-enable-button"}
                disabled={!canEditRole || !hasSelectedRoles}
                loading={statusMutation.isPending}
                onClick={() => batchUpdateStatus(true)}
            >
                启用
            </Button>
            <Button
                data-testid={"system-role-role-disable-button"}
                disabled={!canEditRole || !hasSelectedRoles}
                loading={statusMutation.isPending}
                onClick={() => batchUpdateStatus(false)}
            >
                禁用
            </Button>
            <Button
                data-testid={"system-role-role-batch-delete-button"}
                danger
                icon={<DeleteOutlined />}
                disabled={!canEditRole || !hasSelectedRoles}
                loading={deleteMutation.isPending}
                onClick={batchDeleteRoles}
            >
                批量删除
            </Button>
        </Space>
    );

    return (
        <>
            <PageContainer
                title={"角色管理"}
                content={"维护后台角色、角色状态和菜单权限。"}
                className={"role-page"}
                extra={
                    <Space wrap>
                        <Input.Search
                            aria-label={"搜索" + "角色"}
                            placeholder={"搜索" + "角色"}
                            allowClear
                            value={searchText}
                            onChange={(event) =>
                                setSearchText?.(event.target.value)
                            }
                        />
                        {
                            <Button
                                data-testid={"system-role-role-refresh-button"}
                                icon={<ReloadOutlined />}
                                loading={rolePageQuery.isFetching}
                                onClick={() => void rolePageQuery.refetch()}
                            >
                                刷新
                            </Button>
                        }
                        {canEditRole ? (
                            <Button
                                type="primary"
                                onClick={openCreateRoleDrawer}
                            >
                                {"新增" + "角色"}
                            </Button>
                        ) : null}
                    </Space>
                }
            >
                <QueryFilter
                    defaultCollapsed={false}
                    span={8}
                    onFinish={async () => {
                        applyFilters?.();
                    }}
                    onReset={resetFilters}
                    submitter={{
                        searchConfig: { submitText: "查询", resetText: "重置" },
                    }}
                >
                    {[
                        {
                            name: "enable",
                            label: "状态",
                            render: () => (
                                <Select
                                    value={filters.enable}
                                    options={[
                                        { label: "全部", value: "ALL" },
                                        ...roleOptions.statusOptions.map(
                                            (option) => ({
                                                label: option.label,
                                                value: option.value as RoleFilters["enable"],
                                            }),
                                        ),
                                    ]}
                                    loading={roleOptionsQuery.isFetching}
                                    onChange={(enable) =>
                                        setFilters((currentFilters) => ({
                                            ...currentFilters,
                                            enable,
                                        }))
                                    }
                                    optionFilterProp="label"
                                    style={{ width: "100%" }}
                                ></Select>
                            ),
                        },
                    ].map((field) => (
                        <Form.Item key={field.name} label={field.label}>
                            {field.render()}
                        </Form.Item>
                    ))}
                </QueryFilter>
                {
                    <>
                        {roleOptionsQuery.isError ? (
                            <Alert
                                showIcon
                                type="warning"
                                title="角色选项加载失败"
                                description="状态和权限级别名称将显示默认值。"
                                action={
                                    <Button
                                        aria-label={"重试加载角色选项"}
                                        data-testid={
                                            "system-role-options-retry-button"
                                        }
                                        onClick={() =>
                                            void roleOptionsQuery.refetch()
                                        }
                                    >
                                        重试
                                    </Button>
                                }
                            ></Alert>
                        ) : null}
                        {rolePageQuery.isError ? (
                            <Alert
                                showIcon
                                type="error"
                                title="角色列表加载失败"
                                description={
                                    roles.length > 0
                                        ? "当前展示的是上次成功加载的数据，本次查询未更新。"
                                        : rolePageQuery.error instanceof Error
                                          ? rolePageQuery.error.message
                                          : "请确认权限和接口状态后重试。"
                                }
                                action={
                                    <Button
                                        aria-label={"重试加载角色列表"}
                                        data-testid={
                                            "system-role-page-retry-button"
                                        }
                                        onClick={() =>
                                            void rolePageQuery.refetch()
                                        }
                                    >
                                        重试
                                    </Button>
                                }
                            ></Alert>
                        ) : null}
                        <ProTable<RoleRecord>
                            search={false}
                            options={false}
                            rowKey="id"
                            className="role-table"
                            columns={columns}
                            dataSource={filteredRoles}
                            loading={
                                rolePageQuery.isFetching ||
                                sortMutation.isPending
                            }
                            pagination={false}
                            scroll={{ x: 1006 }}
                            rowSelection={{
                                selectedRowKeys,
                                onChange: setSelectedRowKeys,
                                getCheckboxProps: () => ({
                                    disabled: !canEditRole,
                                }),
                            }}
                            locale={{ emptyText: "暂无角色" }}
                            aria-label={"角色列表"}
                            tableAlertRender={() => (
                                <>已选择 {selectedRowKeys.length} 项</>
                            )}
                            tableAlertOptionRender={() => batchActions}
                            onRow={(record) => ({
                                draggable:
                                    canEditRole && !sortMutation.isPending,
                                onDragStart: (event) => {
                                    event.dataTransfer.setData(
                                        "text/plain",
                                        record.id,
                                    );
                                    event.dataTransfer.effectAllowed = "move";
                                },
                                onDragOver: (event) => {
                                    if (canEditRole && !sortMutation.isPending)
                                        event.preventDefault();
                                },
                                onDrop: (event) => {
                                    event.preventDefault();
                                    if (!canEditRole || sortMutation.isPending)
                                        return;
                                    const source = roles.find(
                                        (item) =>
                                            item.id ===
                                            event.dataTransfer.getData(
                                                "text/plain",
                                            ),
                                    );
                                    if (!source || source.id === record.id)
                                        return;
                                    const rect =
                                        event.currentTarget.getBoundingClientRect();
                                    sortRole(
                                        source,
                                        record,
                                        event.clientY <
                                            rect.top + rect.height / 2
                                            ? "before"
                                            : "after",
                                    );
                                },
                            })}
                        />
                    </>
                }
            </PageContainer>

            <RoleEditDrawer
                key={
                    roleEditDrawerOpen ? editingRole?.id || "create" : "closed"
                }
                open={roleEditDrawerOpen}
                role={editingRole}
                statusOptions={roleOptions.statusOptions}
                privilegeOptions={roleOptions.privilegeOptions}
                onClose={closeRoleEditDrawer}
            />
        </>
    );
};
