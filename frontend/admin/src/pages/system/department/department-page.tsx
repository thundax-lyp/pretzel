import { usePermissions } from "@/auth/hooks/use-permission";
import {
    ApartmentOutlined,
    BranchesOutlined,
    PlusOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import {
    PageContainer,
    ProColumns,
    ProTable,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Space, Tag, Typography } from "antd";
import type { Key } from "react";
import { useMemo, useState } from "react";

import { DepartmentEditDrawer } from "./department-edit-drawer";
import type {
    DepartmentMoveCommand,
    DepartmentSaveCommand,
} from "./department-service";
import * as service from "./department-service";
import type { DepartmentNode, DepartmentTableNode } from "./department-types";

import "./department-page.css";

const { Text } = Typography;

const DEFAULT_COLUMN_WIDTHS = {
    name: 260,
    namePath: 320,
    remarks: 320,
};

const buildDepartmentTree = (departments: DepartmentNode[]) => {
    const nodeMap = new Map<string, DepartmentTableNode>();
    const roots: DepartmentTableNode[] = [];

    departments.forEach((department) => {
        nodeMap.set(department.id, { ...department });
    });

    nodeMap.forEach((department) => {
        if (department.parentId) {
            const parent = nodeMap.get(department.parentId);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(department);
                return;
            }
        }

        roots.push(department);
    });

    return roots;
};

const collectDepartmentIds = (departments: DepartmentTableNode[]): string[] => {
    return departments.flatMap((department) => [
        department.id,
        ...(department.children
            ? collectDepartmentIds(department.children)
            : []),
    ]);
};

const flattenDepartments = (
    departments: DepartmentTableNode[],
): DepartmentTableNode[] => {
    return departments.flatMap((department) => [
        department,
        ...(department.children ? flattenDepartments(department.children) : []),
    ]);
};

const collectDescendantIds = (
    department?: DepartmentTableNode | null,
): Set<string> => {
    if (!department?.children?.length) {
        return new Set();
    }

    return new Set(collectDepartmentIds(department.children));
};

const toMoveType = (
    position: "before" | "after",
): DepartmentMoveCommand["type"] => {
    return position === "before" ? "before" : "after";
};

export const DepartmentPage = () => {
    const hasPermission = usePermissions();
    const { message: messageApi } = App.useApp();
    const { modal } = App.useApp();
    const queryClient = useQueryClient();
    const [editingDepartment, setEditingDepartment] =
        useState<DepartmentTableNode | null>(null);
    const [departmentEditDrawerOpen, setDepartmentEditDrawerOpen] =
        useState(false);
    const [expandedRowKeys, setExpandedRowKeys] = useState<Key[] | null>(null);
    const canEditDepartment = hasPermission("sys:department:edit");
    const canViewDepartment =
        hasPermission("sys:department:view") || canEditDepartment;
    const departmentTreeQuery = useQuery({
        queryKey: ["department", "list"],
        queryFn: () => service.listDepartments(),
        enabled: canViewDepartment,
        retry: false,
    });
    const departments = useMemo(
        () => departmentTreeQuery.data || [],
        [departmentTreeQuery.data],
    );
    const departmentTree = useMemo(
        () => buildDepartmentTree(departments),
        [departments],
    );
    const flatDepartments = useMemo(
        () => flattenDepartments(departmentTree),
        [departmentTree],
    );
    const expandedDepartmentIds = useMemo(
        () => collectDepartmentIds(departmentTree),
        [departmentTree],
    );
    const actualExpandedRowKeys = expandedRowKeys || expandedDepartmentIds;
    const unavailableParentIds = useMemo(() => {
        const descendantIds = collectDescendantIds(editingDepartment);
        if (editingDepartment?.id) {
            descendantIds.add(editingDepartment.id);
        }
        return descendantIds;
    }, [editingDepartment]);
    const parentOptions = useMemo(
        () =>
            flatDepartments
                .filter(
                    (department) => !unavailableParentIds.has(department.id),
                )
                .map((department) => ({
                    label: department.namePath || department.name,
                    value: department.id,
                })),
        [flatDepartments, unavailableParentIds],
    );

    const saveDepartmentMutation = useMutation({
        mutationFn: (values: DepartmentSaveCommand) =>
            values.id
                ? service.changeDepartmentInfo(values)
                : service.addDepartment(values),
        onSuccess: async () => {
            setDepartmentEditDrawerOpen(false);
            setEditingDepartment(null);
            await queryClient.invalidateQueries({
                queryKey: ["department", "list"],
            });
            messageApi.success("部门已保存");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "保存失败",
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: service.removeDepartments,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["department", "list"],
            });
            messageApi.success("部门已删除");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "删除失败",
            );
        },
    });

    const moveMutation = useMutation({
        mutationFn: service.moveDepartment,
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["department", "list"],
            });
            messageApi.success("部门顺序已更新");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "移动失败",
            );
        },
    });

    const openCreateDepartmentDrawer = () => {
        setEditingDepartment(null);
        setDepartmentEditDrawerOpen(true);
    };

    const openEditDepartmentDrawer = (department: DepartmentTableNode) => {
        setEditingDepartment(department);
        setDepartmentEditDrawerOpen(true);
    };

    const closeDepartmentEditDrawer = () => {
        if (saveDepartmentMutation.isPending) {
            return;
        }
        setDepartmentEditDrawerOpen(false);
        setEditingDepartment(null);
    };

    const saveDepartment = (request: DepartmentSaveCommand) => {
        saveDepartmentMutation.mutate(request);
    };

    const openDeleteConfirm = (department: DepartmentTableNode) => {
        modal.confirm({
            okButtonProps: { danger: true },
            cancelText: "取消",
            title: "删除部门",
            content: (
                <>
                    <p>{`确认删除 ${department.name || ""}？`}</p>
                    <p>
                        {
                            "删除后需要重新新增。若该部门下仍有关联用户或子部门，接口会按后端校验结果拦截。"
                        }
                    </p>
                </>
            ),

            okText: "删除",
            onOk: () => deleteMutation.mutateAsync([department.id]),
        });
    };

    const sortDepartment = (
        sourceDepartment: DepartmentTableNode,
        targetDepartment: DepartmentTableNode,
        position: "before" | "after",
    ) => {
        if (!canEditDepartment || sourceDepartment.id === targetDepartment.id) {
            return;
        }

        moveMutation.mutate({
            fromNodeId: sourceDepartment.id,
            toNodeId: targetDepartment.id,
            type: toMoveType(position),
        });
    };

    const readSiblingDepartments = (department: DepartmentTableNode) => {
        if (!department.parentId) {
            return departmentTree;
        }
        return (
            flatDepartments.find((item) => item.id === department.parentId)
                ?.children || []
        );
    };

    const readPreviousSiblingDepartment = (department: DepartmentTableNode) => {
        const siblings = readSiblingDepartments(department);
        const index = siblings.findIndex((item) => item.id === department.id);
        return index > 0 ? siblings[index - 1] : null;
    };

    const promoteDepartment = (department: DepartmentTableNode) => {
        if (!canEditDepartment || !department.parentId) {
            return;
        }
        moveMutation.mutate({
            fromNodeId: department.id,
            toNodeId: department.parentId,
            type: "after",
        });
    };

    const demoteDepartment = (department: DepartmentTableNode) => {
        const previousSibling = readPreviousSiblingDepartment(department);
        if (!canEditDepartment || !previousSibling) {
            return;
        }
        moveMutation.mutate({
            fromNodeId: department.id,
            toNodeId: previousSibling.id,
            type: "insideLast",
        });
    };

    const columns: ProColumns<DepartmentTableNode>[] = [
        {
            title: "部门名称",
            dataIndex: "name",
            key: "name",

            ellipsis: true,
            renderText: (name: string, department) => (
                <Space size={8} className="department-name-cell">
                    <ApartmentOutlined className="department-name-icon" />
                    <span className="department-name-text" title={name}>
                        {name}
                    </span>
                    {department.shortName ? (
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
                                )["warning"]
                            }
                        >
                            {department.shortName}
                        </Tag>
                    ) : null}
                </Space>
            ),
        },
        {
            title: "完整路径",
            dataIndex: "namePath",
            key: "namePath",
            width: DEFAULT_COLUMN_WIDTHS.namePath,
            ellipsis: true,
            renderText: (namePath?: string | null) =>
                namePath ? (
                    <span className="department-path-text" title={namePath}>
                        {namePath}
                    </span>
                ) : (
                    <Text
                        type="secondary"
                        className="department-secondary-text"
                    >
                        根部门
                    </Text>
                ),
        },
        {
            title: "备注",
            dataIndex: "remarks",
            key: "remarks",
            width: DEFAULT_COLUMN_WIDTHS.remarks,
            ellipsis: true,
            renderText: (remarks?: string | null) =>
                remarks || (
                    <Text
                        type="secondary"
                        className="department-secondary-text"
                    >
                        未填写
                    </Text>
                ),
        },
        {
            key: "actions",
            title: "操作",
            valueType: "option",
            fixed: "right",
            render: (_, department) => [
                <Button
                    type="link"
                    key={"promote"}
                    disabled={
                        !canEditDepartment ||
                        !department.parentId ||
                        moveMutation.isPending
                    }
                    aria-label={`升级 ${department.name}`}
                    onClick={() => promoteDepartment(department)}
                >
                    {"升级"}
                </Button>,
                <Button
                    type="link"
                    key={"demote"}
                    disabled={
                        !canEditDepartment ||
                        !readPreviousSiblingDepartment(department) ||
                        moveMutation.isPending
                    }
                    aria-label={`降级 ${department.name}`}
                    onClick={() => demoteDepartment(department)}
                >
                    {"降级"}
                </Button>,
                <Button
                    type="link"
                    key={"edit"}
                    disabled={!canEditDepartment}
                    aria-label={`编辑 ${department.name}`}
                    onClick={() => openEditDepartmentDrawer(department)}
                >
                    {"编辑"}
                </Button>,
                null,
                <Button
                    type="link"
                    key={"delete"}
                    danger
                    disabled={!canEditDepartment}
                    aria-label={`删除 ${department.name}`}
                    onClick={() => openDeleteConfirm(department)}
                >
                    {"删除"}
                </Button>,
            ],
        },
    ];

    if (!canViewDepartment) {
        return <Empty description="缺少 sys:department:view 权限" />;
    }

    return (
        <>
            <PageContainer
                title={"部门管理"}
                content={"维护组织树、部门简称、排序和备注信息。"}
                className={"department-page"}
                extra={
                    <Space wrap>
                        {
                            <>
                                <Button
                                    data-testid={
                                        "system-department-department-refresh-button"
                                    }
                                    className="department-action-button"
                                    disabled={!canViewDepartment}
                                    icon={<ReloadOutlined />}
                                    onClick={() => {
                                        if (!canViewDepartment) {
                                            return;
                                        }
                                        void departmentTreeQuery.refetch();
                                    }}
                                >
                                    刷新
                                </Button>
                                {canEditDepartment ? (
                                    <Button
                                        data-testid={
                                            "system-department-department-action-button"
                                        }
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={openCreateDepartmentDrawer}
                                    >
                                        新增部门
                                    </Button>
                                ) : null}
                            </>
                        }
                    </Space>
                }
            >
                <ProTable<DepartmentTableNode>
                    search={false}
                    options={false}
                    rowKey="id"
                    className="department-table"
                    columns={columns}
                    dataSource={departmentTree}
                    loading={
                        departmentTreeQuery.isFetching || moveMutation.isPending
                    }
                    pagination={false}
                    scroll={{ x: 1108 }}
                    expandable={{
                        defaultExpandAllRows: true,
                        expandedRowKeys: actualExpandedRowKeys,
                        indentSize: 24,
                        expandIconColumnIndex: 0,
                        onExpandedRowsChange: (keys) =>
                            setExpandedRowKeys([...keys]),
                    }}
                    locale={{
                        emptyText: departmentTreeQuery.isError ? (
                            "部门列表加载失败，请确认权限和接口状态。"
                        ) : (
                            <Space orientation="vertical" size={8}>
                                <BranchesOutlined className="department-empty-icon" />
                                <Text
                                    type="secondary"
                                    className="department-secondary-text"
                                >
                                    暂无部门数据
                                </Text>
                            </Space>
                        ),
                    }}
                    onRow={(record) => ({
                        draggable: canEditDepartment && !moveMutation.isPending,
                        onDragStart: (event) => {
                            event.dataTransfer.setData("text/plain", record.id);
                            event.dataTransfer.effectAllowed = "move";
                        },
                        onDragOver: (event) => {
                            if (canEditDepartment && !moveMutation.isPending)
                                event.preventDefault();
                        },
                        onDrop: (event) => {
                            event.preventDefault();
                            if (!canEditDepartment || moveMutation.isPending)
                                return;
                            const source = flatDepartments.find(
                                (item) =>
                                    item.id ===
                                    event.dataTransfer.getData("text/plain"),
                            );
                            if (!source || source.id === record.id) return;
                            const rect =
                                event.currentTarget.getBoundingClientRect();
                            sortDepartment(
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

            <DepartmentEditDrawer
                open={departmentEditDrawerOpen}
                department={editingDepartment}
                parentOptions={parentOptions}
                saving={saveDepartmentMutation.isPending}
                onClose={closeDepartmentEditDrawer}
                onSave={saveDepartment}
            />
        </>
    );
};
