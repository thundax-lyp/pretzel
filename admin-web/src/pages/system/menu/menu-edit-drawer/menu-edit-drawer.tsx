import { DrawerForm } from "@ant-design/pro-components";
import { Button, Form, Input, InputNumber, Select, Space, Switch } from "antd";
import { useEffect } from "react";

import type { MenuSaveCommand } from "@/pages/system/menu/menu-service";
import type { MenuNode } from "@/pages/system/menu/menu-types";
import "./menu-edit-drawer.css";

const { TextArea } = Input;

interface MenuEditDrawerProps {
    open?: boolean;
    menu?: MenuNode | null;
    parentOptions: Array<{ label: string; value: string }>;
    saving?: boolean;
    onClose: () => void;
    onSave: (request: MenuSaveCommand) => void;
}

interface MenuFormValues {
    id?: string | null;
    parentId?: string | null;
    name: string;
    perms?: string | null;
    ranks?: number | null;
    display?: boolean | null;
    displayParams?: string | null;
    url?: string | null;
    remarks?: string | null;
}

const normalizeText = (value?: string | null) => {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
};

const readFormRequest = (values: MenuFormValues): MenuSaveCommand => {
    return {
        id: values.id,
        parentId: values.parentId || null,
        name: values.name.trim(),
        perms: normalizeText(values.perms),
        ranks: values.ranks,
        display: values.display !== false,
        displayParams: normalizeText(values.displayParams),
        url: normalizeText(values.url),
        remarks: normalizeText(values.remarks),
    };
};

const toFormValues = (menu: MenuNode): MenuFormValues => {
    return {
        id: menu.id,
        parentId: menu.parentId || null,
        name: menu.name,
        perms: menu.perms,
        ranks: menu.ranks,
        display: menu.display !== false,
        displayParams: menu.displayParams,
        url: menu.url,
        remarks: menu.remarks,
    };
};

export const MenuEditDrawer = ({
    open,
    menu,
    parentOptions,
    saving,
    onClose,
    onSave,
}: MenuEditDrawerProps) => {
    const [form] = Form.useForm<MenuFormValues>();

    useEffect(() => {
        if (!open) {
            return;
        }
        if (menu) {
            form.setFieldsValue(toFormValues(menu));
            return;
        }
        form.resetFields();
        form.setFieldsValue({ display: true, ranks: 0 });
    }, [form, menu, open]);

    const saveMenu = async () => {
        const values = await form.validateFields();
        onSave(readFormRequest(values));
    };

    return (
        <DrawerForm<MenuFormValues>
            title={menu ? "编辑菜单" : "新增菜单"}
            open={Boolean(open)}
            size={960}
            form={form}
            className="menu-edit-drawer-form"
            drawerProps={{
                ...{ "data-testid": "system-menu-menu-edit-drawer" },
                className: "menu-edit-drawer",
                onClose: onClose,
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
                                key={"system-menu-menu-cancel-button"}
                                data-testid={"system-menu-menu-cancel-button"}
                                onClick={onClose}
                            >
                                {"取消"}
                            </Button>,
                            <Button
                                type="default"
                                key={"system-menu-menu-save-button"}
                                loading={saving}
                                data-testid={"system-menu-menu-save-button"}
                                onClick={saveMenu}
                            >
                                {"保存"}
                            </Button>,
                        ]}
                    </Space>
                ),
            }}
        >
            <Form.Item name="id" hidden>
                <Input />
            </Form.Item>
            <Form.Item name="parentId" label="上级菜单">
                <Select
                    allowClear
                    placeholder="不选择则作为根菜单"
                    options={parentOptions}
                    optionFilterProp="label"
                    style={{ width: "100%" }}
                ></Select>
            </Form.Item>
            <Form.Item
                name="name"
                label="菜单名称"
                rules={[{ required: true, message: "请输入菜单名称" }]}
            >
                <Input placeholder="例如：菜单管理" />
            </Form.Item>
            <Form.Item name="url" label="URL">
                <Input placeholder="例如：/system/menus" />
            </Form.Item>
            <Form.Item name="perms" label="权限标识">
                <Input placeholder="例如：sys:menu:view" />
            </Form.Item>
            <Form.Item name="ranks" label="等级">
                <InputNumber
                    min={0}
                    max={9}
                    precision={0}
                    className="menu-rank-input"
                />
            </Form.Item>
            <Form.Item name="display" label="显示状态" valuePropName="checked">
                <Switch
                    checkedChildren="显示"
                    unCheckedChildren="隐藏"
                ></Switch>
            </Form.Item>
            <Form.Item name="displayParams" label="显示参数">
                <TextArea
                    rows={3}
                    maxLength={1000}
                    showCount
                    placeholder='例如：{"icon":"menu"}'
                />
            </Form.Item>
            <Form.Item name="remarks" label="备注">
                <TextArea
                    rows={3}
                    maxLength={200}
                    showCount
                    placeholder="菜单说明"
                />
            </Form.Item>
        </DrawerForm>
    );
};
