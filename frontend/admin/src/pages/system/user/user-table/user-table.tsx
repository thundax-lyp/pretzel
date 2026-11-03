import { ProColumns, ProTable } from "@ant-design/pro-components";
import { Button, Space, Switch, Tag, Typography } from "antd";
import type { Key, ReactNode } from "react";

import type { CurrentUserRecord } from "@/session/current-user-types";
import { UserAvatar } from "../user-avatar";
import type { UserRecord } from "../user-types";

const { Text } = Typography;

const DEFAULT_COLUMN_WIDTHS = {
    name: 230,
    loginName: 160,
    department: 190,
    roles: 190,
    status: 120,
    ranks: 90,
};

const normalizeSearch = (value?: string | null) => {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
};

const readUserName = (user: UserRecord) => {
    return (
        normalizeSearch(user.name) ||
        normalizeSearch(user.loginName) ||
        `用户 ${user.id}`
    );
};

const readDepartmentName = (user: UserRecord) => {
    return user.department?.namePath || user.department?.name || "";
};

const readRoleNames = (user: UserRecord) => {
    return (user.roles || []).map((role) => role.name).filter(Boolean);
};

const statusValue = (user: UserRecord): "DISABLED" | "ENABLED" => {
    return user.enable === false ? "DISABLED" : "ENABLED";
};

const rankTagType = (user: UserRecord) => {
    return user.superAdmin || user.ranks === 9 ? "accent" : "info";
};

const roleTagType = (user: UserRecord, index: number) => {
    if (user.admin || user.superAdmin) {
        return "accent";
    }
    return index === 0 ? "info" : "neutral";
};

const readRankValue = (
    user?: Pick<UserRecord, "ranks" | "superAdmin"> | null,
) => {
    if (!user) {
        return -1;
    }
    if (user.superAdmin) {
        return 9;
    }
    return user.ranks ?? 0;
};

const canManageUserByRank = (
    currentUser: CurrentUserRecord | undefined,
    targetUser: UserRecord,
) => {
    if (!currentUser || currentUser.id === targetUser.id) {
        return false;
    }
    return readRankValue(targetUser) < readRankValue(currentUser);
};

interface UserTableProps {
    canEditUser: boolean;
    currentPage: number;
    currentUser?: CurrentUserRecord;
    loading: boolean;
    batchActions: ReactNode;
    pageSize: number;
    rankLabelByValue: Map<string, string>;
    selectedRowKeys: Key[];
    statusLabelByValue: Map<string, string>;
    statusPending: boolean;
    totalCount: number;
    users: UserRecord[];
    onDelete: (user: UserRecord) => void;
    onEdit: (user: UserRecord) => void;
    onPageChange: (pageNo: number, pageSize: number) => void;
    onSelectedRowKeysChange: (keys: Key[]) => void;
    onStatusChange: (user: UserRecord, enable: boolean) => void;
}

export const UserTable = ({
    canEditUser,
    currentPage,
    currentUser,
    loading,
    batchActions,
    pageSize,
    rankLabelByValue,
    selectedRowKeys,
    statusLabelByValue,
    statusPending,
    totalCount,
    users,
    onDelete,
    onEdit,
    onPageChange,
    onSelectedRowKeysChange,
    onStatusChange,
}: UserTableProps) => {
    const readStatusLabel = (user: UserRecord) => {
        const value = statusValue(user);
        return (
            statusLabelByValue.get(value) ||
            (value === "DISABLED" ? "禁用" : "启用")
        );
    };

    const readStatusOptionLabel = (value: "DISABLED" | "ENABLED") => {
        return (
            statusLabelByValue.get(value) ||
            (value === "DISABLED" ? "禁用" : "启用")
        );
    };

    const readRankLabel = (user: UserRecord) => {
        const value = user.superAdmin ? "9" : String(user.ranks ?? 0);
        return (
            rankLabelByValue.get(value) ||
            (user.superAdmin ? "超级管理员" : `等级 ${value}`)
        );
    };

    const columns: ProColumns<UserRecord>[] = [
        {
            title: "用户",
            dataIndex: "name",
            key: "name",

            render: (_, user) => {
                const userName = readUserName(user);
                return (
                    <Space size={10}>
                        <UserAvatar user={user} />
                        <div className="user-name-cell">
                            <Text className="user-name-cell-text" strong>
                                {userName}
                            </Text>
                            {user.email ? (
                                <Text
                                    className="user-name-cell-text"
                                    type="secondary"
                                >
                                    {user.email}
                                </Text>
                            ) : null}
                        </div>
                    </Space>
                );
            },
        },
        {
            title: "登录名",
            dataIndex: "loginName",
            key: "loginName",
            width: DEFAULT_COLUMN_WIDTHS.loginName,
            renderText: (loginName?: string | null) => loginName || null,
        },
        {
            title: "部门",
            key: "department",
            width: DEFAULT_COLUMN_WIDTHS.department,
            render: (_, user) => readDepartmentName(user) || null,
        },
        {
            title: "角色",
            key: "roles",
            width: DEFAULT_COLUMN_WIDTHS.roles,
            render: (_, user) => {
                const roleNames = readRoleNames(user);
                if (!roleNames.length) {
                    return null;
                }
                return (
                    <Space size={[4, 4]} wrap>
                        {roleNames.map((roleName, index) => (
                            <Tag
                                key={roleName}
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
                                    )[roleTagType(user, index)]
                                }
                            >
                                {roleName}
                            </Tag>
                        ))}
                    </Space>
                );
            },
        },
        {
            title: "状态",
            dataIndex: "enable",
            key: "status",
            width: DEFAULT_COLUMN_WIDTHS.status,
            render: (_, user) => {
                const canManageCurrentUser = canManageUserByRank(
                    currentUser,
                    user,
                );
                return (
                    <Switch
                        checked={user.enable !== false}
                        checkedChildren={readStatusOptionLabel("ENABLED")}
                        unCheckedChildren={readStatusOptionLabel("DISABLED")}
                        disabled={
                            !canEditUser ||
                            !canManageCurrentUser ||
                            statusPending
                        }
                        aria-label={`切换 ${readUserName(user)} 状态，当前${readStatusLabel(user)}`}
                        onChange={(checked) => onStatusChange(user, checked)}
                    ></Switch>
                );
            },
        },
        {
            title: "级别",
            dataIndex: "ranks",
            key: "ranks",
            width: DEFAULT_COLUMN_WIDTHS.ranks,
            render: (_, user) => (
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
                        )[rankTagType(user)]
                    }
                >
                    {readRankLabel(user)}
                </Tag>
            ),
        },
        {
            key: "actions",
            title: "操作",
            valueType: "option",
            fixed: "right",
            render: (_, user) => {
                const userName = readUserName(user);
                const canManageCurrentUser = canManageUserByRank(
                    currentUser,
                    user,
                );
                const disabled = !canEditUser || !canManageCurrentUser;
                return [
                    <Button
                        type="link"
                        key={"edit"}
                        disabled={disabled}
                        aria-label={`编辑 ${userName}`}
                        onClick={() => onEdit(user)}
                    >
                        {"编辑"}
                    </Button>,
                    null,
                    <Button
                        type="link"
                        key={"delete"}
                        danger
                        disabled={disabled}
                        aria-label={`删除 ${userName}`}
                        onClick={() => onDelete(user)}
                    >
                        {"删除"}
                    </Button>,
                ];
            },
        },
    ];

    return (
        <ProTable<UserRecord>
            search={false}
            options={false}
            rowKey="id"
            className="user-table"
            columns={columns}
            dataSource={users}
            loading={loading}
            pagination={{
                current: currentPage,
                pageSize,
                total: totalCount,
                showTotal: (total) => `${total} 个用户`,
                onChange: onPageChange,
            }}
            rowSelection={{
                selectedRowKeys,
                onChange: onSelectedRowKeysChange,
                getCheckboxProps: (user) => ({
                    disabled:
                        !canEditUser || !canManageUserByRank(currentUser, user),
                }),
            }}
            aria-label={"用户列表"}
            tableAlertRender={() => <>已选择 {selectedRowKeys.length} 项</>}
            tableAlertOptionRender={() => batchActions}
        />
    );
};
