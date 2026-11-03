import { createLoginForm } from "@/auth/auth-service";
import type { SaveCommand } from "@/pages/system/user/user-service";
import type {
    UserDepartmentNode,
    UserRecord,
    UserRoleRecord,
} from "@/pages/system/user/user-types";
import type { CurrentUserRecord } from "@/session/current-user-types";
import type { OptionsRecord } from "@/types/options";
import type { Page } from "@/types/page";
import { DrawerForm } from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TreeSelectProps } from "antd";
import {
    Alert,
    App,
    Button,
    Form,
    Input,
    Select,
    Space,
    Switch,
    TreeSelect,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { encryptPassword } from "@/auth/password-encryption";
import { UserAvatarField } from "./user-avatar-field";
import type { UserFormValues } from "./user-edit-drawer-form-values";
import "./user-edit-drawer.css";

import * as service from "@/pages/system/user/user-service";

interface UserEditDrawerProps {
    open?: boolean;
    user?: UserRecord | null;
    currentUser?: CurrentUserRecord | null;
    departments?: UserDepartmentNode[];
    rankOptions?: OptionsRecord[string];
    onClose: () => void;
}

const normalizeSearch = (value?: string | null) => {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
};

const toSaveCommand = (
    user: UserRecord,
    form: UserFormValues,
): SaveCommand => ({
    id: user.id,
    remarks: user.remarks,
    loginName: normalizeSearch(form.loginName),
    ranks: form.ranks,
    name: normalizeSearch(form.name),
    email: normalizeSearch(form.email),
    mobile: normalizeSearch(form.mobile),
    admin: form.admin,
    enable: form.enable,
    department: form.departmentId ? { id: form.departmentId } : null,
    roles: form.roleIds.map((roleId) => ({ id: roleId })),
});

const toCreateSaveCommand = (
    form: UserFormValues,
    encryptedPassword: string,
    token: string,
): SaveCommand => ({
    loginName: normalizeSearch(form.loginName),
    loginPass: encryptedPassword,
    token,
    ranks: form.ranks,
    name: normalizeSearch(form.name),
    email: normalizeSearch(form.email),
    mobile: normalizeSearch(form.mobile),
    admin: form.admin,
    enable: form.enable,
    department: form.departmentId ? { id: form.departmentId } : null,
    roles: form.roleIds.map((roleId) => ({ id: roleId })),
});

const readRoleIds = (roles?: UserRoleRecord[] | null) => {
    return (roles || []).map((role) => role.id);
};

const readUserForm = (user: UserRecord): UserFormValues => ({
    loginName: user.loginName || "",
    loginPass: "",
    name: user.name || "",
    email: user.email || "",
    mobile: user.mobile || "",
    departmentId: user.department?.id || null,
    roleIds: readRoleIds(user.roles),
    ranks: user.ranks ?? 0,
    admin: Boolean(user.admin),
    enable: Boolean(user.enable),
});

const readRankValue = (
    user?: Pick<CurrentUserRecord, "ranks" | "superAdmin"> | null,
) => {
    if (!user) {
        return -1;
    }
    if (user.superAdmin) {
        return 9;
    }
    return user.ranks ?? 0;
};

const maxCreatableRank = (
    user?: Pick<CurrentUserRecord, "ranks" | "superAdmin"> | null,
) => {
    return Math.max(readRankValue(user) - 1, 0);
};

const fallbackRankOptions = (maxRank: number) => {
    return Array.from({ length: Math.max(maxRank, 0) + 1 }, (_, rank) => ({
        value: rank,
        label: `等级 ${rank}`,
    }));
};

const toEditableRankOptions = (
    options: OptionsRecord[string] | undefined,
    maxRank: number,
) => {
    const sourceOptions = options?.length
        ? options
        : fallbackRankOptions(maxRank);
    return sourceOptions
        .map((option) => ({
            value: Number(option.value),
            label: option.label,
        }))
        .filter(
            (option) =>
                Number.isFinite(option.value) && option.value <= maxRank,
        );
};

type DepartmentTreeOption = NonNullable<TreeSelectProps["treeData"]>[number];

const departmentTreeOptions = (
    departments: UserDepartmentNode[],
): DepartmentTreeOption[] => {
    const departmentById = new Map(
        departments.map((department) => [department.id, department]),
    );
    const childrenByParentId = new Map<
        string | null | undefined,
        UserDepartmentNode[]
    >();
    departments.forEach((department) => {
        const parentId = departmentById.has(department.parentId || "")
            ? department.parentId
            : null;
        const children = childrenByParentId.get(parentId) || [];
        children.push(department);
        childrenByParentId.set(parentId, children);
    });

    const toNode = (department: UserDepartmentNode): DepartmentTreeOption => ({
        value: department.id,
        title: department.name,
        children: childrenByParentId.get(department.id)?.map(toNode),
    });

    return (childrenByParentId.get(null) || []).map(toNode);
};

const EMPTY_USER_ROLES: UserRoleRecord[] = [];

const DEFAULT_CREATE_USER_FORM: UserFormValues = {
    loginName: "",
    loginPass: "",
    name: "",
    email: "",
    mobile: "",
    departmentId: null,
    roleIds: [],
    ranks: 0,
    admin: false,
    enable: true,
};

const readInitialFormValues = (
    user: UserRecord | null | undefined,
    editing: boolean,
    editableMaxRank: number,
): UserFormValues => {
    const initialForm =
        user && editing
            ? readUserForm(user)
            : {
                  ...DEFAULT_CREATE_USER_FORM,
                  departmentId: user?.department?.id || null,
                  ranks: editableMaxRank,
              };
    return initialForm.ranks > editableMaxRank
        ? { ...initialForm, ranks: editableMaxRank }
        : initialForm;
};

const readFormResetKey = (
    user: UserRecord | null | undefined,
    editing: boolean,
    visible: boolean,
    editableMaxRank: number,
) => {
    if (!visible) {
        return "closed";
    }
    if (editing) {
        return `edit:${user?.id || ""}:${editableMaxRank}`;
    }
    return `create:${user?.department?.id || ""}:${editableMaxRank}`;
};

export const UserEditDrawer = ({
    open,
    user,
    currentUser,
    departments = [],
    rankOptions = [],
    onClose,
}: UserEditDrawerProps) => {
    const { message: messageApi } = App.useApp();
    const queryClient = useQueryClient();
    const editing = Boolean(user?.id);
    const visible = Boolean(open);
    const creating = visible && !editing;
    const [uploadedUser, setUploadedUser] = useState<UserRecord | null>(null);
    const displayedUser = uploadedUser?.id === user?.id ? uploadedUser : user;
    const editableMaxRank = currentUser
        ? maxCreatableRank(currentUser)
        : (user?.ranks ?? 0);
    const editableRankOptions = useMemo(
        () => toEditableRankOptions(rankOptions, editableMaxRank),
        [editableMaxRank, rankOptions],
    );
    const formResetKey = readFormResetKey(
        user,
        editing,
        visible,
        editableMaxRank,
    );
    const [form] = Form.useForm<UserFormValues>();
    const initialValues = useMemo(
        () => readInitialFormValues(user, editing, editableMaxRank),
        [editableMaxRank, editing, user],
    );
    const initialValuesRef = useRef(initialValues);
    useEffect(() => {
        initialValuesRef.current = initialValues;
    }, [initialValues]);
    useEffect(() => {
        if (visible) {
            form.setFieldsValue(initialValuesRef.current);
        } else {
            form.resetFields();
        }
    }, [form, formResetKey, visible]);
    const userRoleQuery = useQuery({
        queryKey: ["user", "role", "list"],
        queryFn: () => service.listRoles(),
        enabled: visible,
        retry: false,
    });
    const roleById = useMemo(() => {
        const roleById = new Map<string, UserRoleRecord>();
        [
            ...(userRoleQuery.data ?? EMPTY_USER_ROLES),
            ...(user?.roles ?? []),
        ].forEach((role) => {
            if (role?.id) {
                roleById.set(role.id, role);
            }
        });
        return roleById;
    }, [user?.roles, userRoleQuery.data]);
    const roleOptions = useMemo(() => {
        return Array.from(roleById.values()).map((role) => ({
            value: role.id,
            label: role.name || role.id,
        }));
    }, [roleById]);
    const departmentOptions = useMemo(
        () => departmentTreeOptions(departments),
        [departments],
    );
    const invalidateUserPage = async () => {
        await queryClient.invalidateQueries({ queryKey: ["user", "page"] });
    };
    const createMutation = useMutation({
        mutationFn: async (values: UserFormValues) => {
            const loginForm = await createLoginForm();
            const encryptedPassword = encryptPassword(
                values.loginPass,
                loginForm.publicKey,
            );
            return service.create(
                toCreateSaveCommand(
                    values,
                    encryptedPassword,
                    loginForm.loginToken,
                ),
            );
        },
        onSuccess: async () => {
            await invalidateUserPage();
            messageApi.success("用户已新增");
            onClose();
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "新增失败",
            );
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({
            currentUser,
            values,
        }: {
            currentUser: UserRecord;
            values: UserFormValues;
        }) => service.changeInfo(toSaveCommand(currentUser, values)),
        onSuccess: async () => {
            await invalidateUserPage();
            messageApi.success("用户已更新");
            onClose();
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "更新失败",
            );
        },
    });
    const avatarUploadMutation = useMutation({
        mutationFn: ({ id, avatar }: { id: string; avatar: File }) =>
            service.uploadAvatar(id, avatar),
        onSuccess: async (_, variables) => {
            await queryClient.refetchQueries({ queryKey: ["user", "page"] });
            const refreshedUser = queryClient
                .getQueriesData<Page<UserRecord>>({
                    queryKey: ["user", "page"],
                    type: "active",
                })
                .flatMap(([, page]) => page?.records ?? [])
                .find((record) => record.id === variables.id);
            if (refreshedUser) {
                setUploadedUser(refreshedUser);
            }
            messageApi.success("头像已更新");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "头像上传失败",
            );
        },
    });
    const saving = createMutation.isPending || updateMutation.isPending;
    const saveForm = async (values: UserFormValues) => {
        if (creating) {
            createMutation.mutate(values);
            return false;
        }
        if (user) {
            updateMutation.mutate({ currentUser: user, values });
        }
        return false;
    };

    return (
        <DrawerForm<UserFormValues>
            title={creating ? "新增用户" : "编辑用户"}
            open={visible}
            size={960}
            form={form}
            onFinish={saveForm}
            className="user-edit-drawer-form"
            drawerProps={{
                ...{ "data-testid": "system-user-user-edit-drawer" },
                className: "user-edit-drawer",
                onClose: () => {
                    if (!saving) onClose();
                },
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
                                type="default"
                                key={"system-user-user-cancel-button"}
                                disabled={saving}
                                data-testid={"system-user-user-cancel-button"}
                                onClick={onClose}
                            >
                                {"取消"}
                            </Button>,
                            <Button
                                type="default"
                                key={"system-user-user-action-button"}
                                disabled={userRoleQuery.isError}
                                loading={saving}
                                data-testid={"system-user-user-action-button"}
                                onClick={() => form.submit()}
                            >
                                {"保存"}
                            </Button>,
                        ]}
                    </Space>
                ),
            }}
        >
            {userRoleQuery.isError ? (
                <Alert
                    showIcon
                    type="error"
                    title="角色选项加载失败"
                    description="无法确认可分配角色，请重试后再保存。"
                    action={
                        <Button
                            aria-label={"重试加载角色选项"}
                            data-testid={
                                "system-user-role-options-retry-button"
                            }
                            onClick={() => void userRoleQuery.refetch()}
                        >
                            重试
                        </Button>
                    }
                ></Alert>
            ) : null}
            {!creating && displayedUser ? (
                <Form.Item label="头像">
                    <UserAvatarField
                        user={displayedUser}
                        onAvatarUpload={(avatar) => {
                            if (displayedUser.id) {
                                return avatarUploadMutation.mutateAsync({
                                    id: displayedUser.id,
                                    avatar,
                                });
                            }
                            return undefined;
                        }}
                    />
                </Form.Item>
            ) : null}
            <Form.Item
                name="loginName"
                label="登录名"
                rules={[
                    {
                        required: true,
                        whitespace: true,
                        message: "请输入登录名",
                    },
                ]}
            >
                <Input placeholder="lin.zhiyuan" />
            </Form.Item>
            {creating ? (
                <Form.Item
                    name="loginPass"
                    label="登录密码"
                    rules={[{ required: true, message: "请输入登录密码" }]}
                >
                    <Input.Password placeholder="设置初始密码" />
                </Form.Item>
            ) : null}
            <Form.Item
                name="name"
                label="姓名"
                rules={[
                    { required: true, whitespace: true, message: "请输入姓名" },
                ]}
            >
                <Input placeholder="用户姓名" />
            </Form.Item>
            <Form.Item name="email" label="邮箱">
                <Input placeholder="name@example.com" />
            </Form.Item>
            <Form.Item name="mobile" label="手机">
                <Input placeholder="手机号" />
            </Form.Item>
            <Form.Item
                name="departmentId"
                label="部门"
                rules={[{ required: true, message: "请选择部门" }]}
            >
                <TreeSelect
                    treeData={departmentOptions}
                    placeholder="选择部门"
                    showSearch
                    treeDefaultExpandAll
                    treeNodeFilterProp="title"
                />
            </Form.Item>
            <Form.Item name="roleIds" label="角色">
                <Select
                    mode="multiple"
                    options={roleOptions}
                    loading={userRoleQuery.isFetching}
                    placeholder="选择角色"
                    optionFilterProp="label"
                    style={{ width: "100%" }}
                ></Select>
            </Form.Item>
            <Form.Item name="ranks" label="等级">
                <Select
                    options={editableRankOptions}
                    optionFilterProp="label"
                    style={{ width: "100%" }}
                ></Select>
            </Form.Item>
            <Form.Item name="admin" label="管理员" valuePropName="checked">
                <Switch />
            </Form.Item>
            <Form.Item name="enable" label="启用" valuePropName="checked">
                <Switch />
            </Form.Item>
        </DrawerForm>
    );
};
