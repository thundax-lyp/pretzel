import { DrawerForm } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Alert,
    App,
    Button,
    Form,
    Input,
    Space,
    Switch,
    Typography,
} from "antd";
import type { DataNode } from "antd/es/tree";
import type { Key } from "react";
import { useEffect, useMemo } from "react";

import { MenuTreeField } from "@/pages/system/role/role-edit-drawer/menu-tree-field";
import type { RoleSaveCommand } from "@/pages/system/role/role-service";
import * as service from "@/pages/system/role/role-service";
import type {
    RoleMenuNode,
    RoleMenuTreeNode,
    RoleRecord,
} from "@/pages/system/role/role-types";
import type { OptionsRecord } from "@/types/options";
import "./role-edit-drawer.css";

const { TextArea } = Input;
const { Text } = Typography;

interface RoleEditDrawerProps {
    open?: boolean;
    role?: RoleRecord | null;
    statusOptions?: OptionsRecord[string];
    privilegeOptions?: OptionsRecord[string];
    onClose: () => void;
}

const buildMenuTree = (menus: RoleMenuNode[]) => {
    const nodeMap = new Map<string, RoleMenuTreeNode>();
    const roots: RoleMenuTreeNode[] = [];
    menus.forEach((menu) => nodeMap.set(menu.id, { ...menu }));
    nodeMap.forEach((menu) => {
        const parent = menu.parentId ? nodeMap.get(menu.parentId) : undefined;
        if (parent) {
            parent.children = parent.children || [];
            parent.children.push(menu);
            return;
        }
        roots.push(menu);
    });
    return roots;
};

const collectMenuIds = (menus: RoleMenuTreeNode[]): string[] => {
    return menus.flatMap((menu) => [
        menu.id,
        ...(menu.children ? collectMenuIds(menu.children) : []),
    ]);
};

const toTreeData = (menus: RoleMenuTreeNode[]): DataNode[] => {
    return menus.map((menu) => ({
        key: menu.id,
        title: (
            <Space size={8}>
                <span>{menu.name}</span>
                {menu.perms ? <Text type="secondary">{menu.perms}</Text> : null}
            </Space>
        ),
        children: menu.children ? toTreeData(menu.children) : undefined,
    }));
};

interface RoleFormValues {
    id?: string | null;
    name: string;
    admin?: boolean | null;
    enable?: boolean | null;
    remarks?: string | null;
    menus?: Key[];
}

const normalizeText = (value?: string | null) => {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
};

const readFormRequest = (values: RoleFormValues): RoleSaveCommand => {
    return {
        id: values.id,
        name: values.name.trim(),
        admin: Boolean(values.admin),
        enable: values.enable !== false,
        remarks: normalizeText(values.remarks),
        menus: (values.menus || []).map(String).map((id) => ({ id })),
    };
};

const toFormValues = (role: RoleRecord): RoleFormValues => {
    return {
        id: role.id,
        name: role.name,
        admin: Boolean(role.admin),
        enable: role.enable !== false,
        remarks: role.remarks,
        menus: (role.menus || []).map((menu) => menu.id),
    };
};

const readOptionLabel = (
    options: OptionsRecord[string] | undefined,
    value: string,
    fallbackLabel: string,
) => {
    return (
        options?.find((option) => option.value === value)?.label ||
        fallbackLabel
    );
};

export const RoleEditDrawer = ({
    open,
    role,
    statusOptions,
    privilegeOptions,
    onClose,
}: RoleEditDrawerProps) => {
    const { message: messageApi } = App.useApp();
    const queryClient = useQueryClient();
    const [form] = Form.useForm<RoleFormValues>();
    const visible = Boolean(open);
    const roleMenuTreeQuery = useQuery({
        queryKey: ["role", "menu", "tree"],
        queryFn: service.listMenus,
        enabled: visible,
        retry: false,
    });
    const menuTree = useMemo(
        () => buildMenuTree(roleMenuTreeQuery.data || []),
        [roleMenuTreeQuery.data],
    );
    const treeData = useMemo(() => toTreeData(menuTree), [menuTree]);
    const expandedMenuIds = useMemo(() => collectMenuIds(menuTree), [menuTree]);

    useEffect(() => {
        if (!visible) {
            return;
        }
        if (role) {
            form.setFieldsValue(toFormValues(role));
            return;
        }
        form.resetFields();
        form.setFieldsValue({ admin: false, enable: true, menus: [] });
    }, [form, role, visible]);

    const saveRoleMutation = useMutation({
        mutationFn: (values: RoleSaveCommand) =>
            values.id ? service.changeInfo(values) : service.create(values),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["role", "list"] });
            messageApi.success("角色已保存");
            onClose();
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "保存失败",
            );
        },
    });

    const closeDrawer = () => {
        if (!saveRoleMutation.isPending) {
            onClose();
        }
    };

    const saveRole = async (values: RoleFormValues) => {
        saveRoleMutation.mutate(readFormRequest(values));
        return false;
    };

    return (
        <DrawerForm<RoleFormValues>
            title={role ? "编辑角色" : "新增角色"}
            open={visible}
            size={960}
            form={form}
            onFinish={saveRole}
            className="system-role-edit-drawer-form"
            drawerProps={{
                ...{ "data-testid": "system-role-role-edit-drawer" },
                className: "role-edit-drawer",
                onClose: closeDrawer,
                destroyOnHidden: true,
                maskClosable: false,
            }}
            submitter={{
                render: () => (
                    <Space
                        style={{ display: "flex", justifyContent: "flex-end" }}
                    >
                        {[
                            <Button
                                type="primary"
                                key={"system-role-role-cancel-button"}
                                disabled={saveRoleMutation.isPending}
                                data-testid={"system-role-role-cancel-button"}
                                onClick={closeDrawer}
                            >
                                {"取消"}
                            </Button>,
                            <Button
                                type="default"
                                key={"system-role-role-save-button"}
                                disabled={roleMenuTreeQuery.isError}
                                loading={saveRoleMutation.isPending}
                                data-testid={"system-role-role-save-button"}
                                onClick={() => form.submit()}
                            >
                                {"保存"}
                            </Button>,
                        ]}
                    </Space>
                ),
            }}
        >
            {roleMenuTreeQuery.isError ? (
                <Alert
                    showIcon
                    type="error"
                    title="菜单权限加载失败"
                    description="无法确认角色菜单权限，请重试后再保存。"
                    action={
                        <Button
                            aria-label={"重试加载菜单权限"}
                            data-testid={"system-role-menu-tree-retry-button"}
                            onClick={() => void roleMenuTreeQuery.refetch()}
                        >
                            重试
                        </Button>
                    }
                ></Alert>
            ) : null}
            <Form.Item name="id" hidden>
                <Input />
            </Form.Item>
            <Form.Item
                name="name"
                label="角色名称"
                rules={[{ required: true, message: "请输入角色名称" }]}
            >
                <Input placeholder="例如：运营管理员" />
            </Form.Item>
            <Form.Item name="admin" label="管理权限" valuePropName="checked">
                <Switch
                    checkedChildren={readOptionLabel(
                        privilegeOptions,
                        "ADMIN",
                        "管理员角色",
                    )}
                    unCheckedChildren={readOptionLabel(
                        privilegeOptions,
                        "NORMAL",
                        "普通角色",
                    )}
                ></Switch>
            </Form.Item>
            <Form.Item name="enable" label="角色状态" valuePropName="checked">
                <Switch
                    checkedChildren={readOptionLabel(
                        statusOptions,
                        "ENABLED",
                        "启用",
                    )}
                    unCheckedChildren={readOptionLabel(
                        statusOptions,
                        "DISABLED",
                        "禁用",
                    )}
                ></Switch>
            </Form.Item>
            <Form.Item name="menus" label="菜单权限">
                <MenuTreeField
                    treeData={treeData}
                    expandedMenuIds={expandedMenuIds}
                    loading={roleMenuTreeQuery.isFetching}
                />
            </Form.Item>
            <Form.Item name="remarks" label="备注">
                <TextArea
                    rows={3}
                    maxLength={200}
                    showCount
                    placeholder="角色说明"
                />
            </Form.Item>
        </DrawerForm>
    );
};
