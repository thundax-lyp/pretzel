import type { OptionRecord } from "@/types/options";
import { QueryFilter } from "@ant-design/pro-components";
import { Form, Input, Select } from "antd";

export type UserFilterStatus = "ALL" | "ENABLED" | "DISABLED";

export interface UserFilters {
    loginName: string;
    enable: UserFilterStatus;
}

interface UserFilterPanelProps {
    filters: UserFilters;
    loading: boolean;
    open: boolean;
    resetDisabled: boolean;
    statusOptions: OptionRecord[];
    onApply: () => void;
    onFiltersChange: (filters: UserFilters) => void;
    onReset: () => void;
}

export const UserFilterPanel = ({
    filters,
    loading,
    open,
    resetDisabled,
    statusOptions,
    onApply,
    onFiltersChange,
    onReset,
}: UserFilterPanelProps) => (
    <>
        {" "}
        {open ? (
            <QueryFilter
                defaultCollapsed={false}
                span={8}
                onFinish={async () => {
                    onApply?.();
                }}
                onReset={onReset}
                submitter={{
                    resetButtonProps: { disabled: resetDisabled },
                    searchConfig: { submitText: "查询", resetText: "重置" },
                }}
            >
                {[
                    {
                        name: "loginName",
                        label: "登录名",
                        render: () => (
                            <Input
                                allowClear
                                placeholder="输入登录名"
                                value={filters.loginName}
                                onChange={(event) =>
                                    onFiltersChange({
                                        ...filters,
                                        loginName: event.target.value,
                                    })
                                }
                            />
                        ),
                    },
                    {
                        name: "enable",
                        label: "状态",
                        render: () => (
                            <Select<UserFilterStatus>
                                value={filters.enable}
                                options={[
                                    { value: "ALL", label: "全部" },
                                    ...statusOptions.map((option) => ({
                                        value: option.value as UserFilterStatus,
                                        label: option.label,
                                    })),
                                ]}
                                loading={loading}
                                onChange={(enable) =>
                                    onFiltersChange({
                                        ...filters,
                                        enable,
                                    })
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
        ) : null}{" "}
    </>
);
