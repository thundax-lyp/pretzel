import { DrawerForm } from "@ant-design/pro-components";
import { Button, Form, Input, Select, Space } from "antd";
import { useEffect } from "react";

import type { DepartmentSaveCommand } from "@/pages/system/department/department-service";
import type { DepartmentNode } from "@/pages/system/department/department-types";
import "./department-edit-drawer.css";

const { TextArea } = Input;

interface DepartmentEditDrawerProps {
    open?: boolean;
    department?: DepartmentNode | null;
    parentOptions: Array<{ label: string; value: string }>;
    saving?: boolean;
    onClose: () => void;
    onSave: (request: DepartmentSaveCommand) => void;
}

interface DepartmentFormValues {
    id?: string | null;
    parentId?: string | null;
    name: string;
    shortName?: string | null;
    remarks?: string | null;
}

const normalizeSearch = (value?: string | null) => {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
};

const readFormRequest = (
    values: DepartmentFormValues,
): DepartmentSaveCommand => {
    return {
        id: values.id,
        parentId: values.parentId || null,
        name: values.name.trim(),
        shortName: normalizeSearch(values.shortName),
        remarks: normalizeSearch(values.remarks),
    };
};

const toFormValues = (department: DepartmentNode): DepartmentFormValues => {
    return {
        id: department.id,
        parentId: department.parentId || null,
        name: department.name,
        shortName: department.shortName,
        remarks: department.remarks,
    };
};

export const DepartmentEditDrawer = ({
    open,
    department,
    parentOptions,
    saving,
    onClose,
    onSave,
}: DepartmentEditDrawerProps) => {
    const [form] = Form.useForm<DepartmentFormValues>();

    useEffect(() => {
        if (!open) {
            return;
        }
        if (department) {
            form.setFieldsValue(toFormValues(department));
            return;
        }
        form.resetFields();
    }, [department, form, open]);

    const saveDepartment = async (values: DepartmentFormValues) => {
        onSave(readFormRequest(values));
        return false;
    };

    return (
        <DrawerForm<DepartmentFormValues>
            title={department ? "编辑部门" : "新增部门"}
            open={Boolean(open)}
            size={960}
            form={form}
            onFinish={saveDepartment}
            className="department-edit-drawer-form"
            drawerProps={{
                ...{
                    "data-testid": "system-department-department-edit-drawer",
                },
                className: "department-edit-drawer",
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
                                key={
                                    "system-department-department-cancel-button"
                                }
                                data-testid={
                                    "system-department-department-cancel-button"
                                }
                                onClick={onClose}
                            >
                                {"取消"}
                            </Button>,
                            <Button
                                type="default"
                                key={"system-department-department-save-button"}
                                loading={saving}
                                data-testid={
                                    "system-department-department-save-button"
                                }
                                onClick={() => form.submit()}
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
            <Form.Item name="parentId" label="上级部门">
                <Select
                    allowClear
                    placeholder="不选择则作为根部门"
                    options={parentOptions}
                    optionFilterProp="label"
                    style={{ width: "100%" }}
                ></Select>
            </Form.Item>
            <Form.Item
                name="name"
                label="部门名称"
                rules={[{ required: true, message: "请输入部门名称" }]}
            >
                <Input placeholder="例如：研发中心" />
            </Form.Item>
            <Form.Item name="shortName" label="简称">
                <Input placeholder="例如：R&D" />
            </Form.Item>
            <Form.Item name="remarks" label="备注">
                <TextArea
                    rows={4}
                    maxLength={200}
                    showCount
                    placeholder="部门职责说明"
                />
            </Form.Item>
        </DrawerForm>
    );
};
