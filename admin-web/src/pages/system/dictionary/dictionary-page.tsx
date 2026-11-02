import { hasPermission } from "@/auth/permission-storage";
import { DEFAULT_PAGE_NO, DEFAULT_PAGE_SIZE } from "@/types/page";
import {
    BookOutlined,
    DeleteOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import {
    PageContainer,
    ProColumns,
    ProTable,
    QueryFilter,
} from "@ant-design/pro-components";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Empty, Form, Input, Space, Tag, Typography } from "antd";
import type { Key } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DictionaryEditDrawer } from "./dictionary-edit-drawer";
import type { DictPageQuery, DictSaveCommand } from "./dictionary-service";
import * as dictionaryService from "./dictionary-service";
import type { DictRecord } from "./dictionary-types";

import "./dictionary-page.css";

const { Text } = Typography;

const DEFAULT_COLUMN_WIDTHS = {
    type: 220,
    label: 180,
    value: 180,
    remarks: 320,
};

interface DictionaryFilters {
    remarks: string;
    type: string;
}

const DEFAULT_DICTIONARY_FILTERS: DictionaryFilters = {
    remarks: "",
    type: "",
};

const SEARCH_DEBOUNCE_MS = 250;

const normalizeSearch = (value?: string | null) => {
    const normalizedValue = value?.trim();
    return normalizedValue || undefined;
};

export const DictionaryPage = () => {
    const { message: messageApi } = App.useApp();
    const { modal } = App.useApp();
    const queryClient = useQueryClient();
    const canViewDictionary =
        hasPermission("sys:dict:view") || hasPermission("sys:dict:edit");
    const canEditDictionary = hasPermission("sys:dict:edit");
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [query, setQuery] = useState<DictPageQuery>({
        pageNo: DEFAULT_PAGE_NO,
        pageSize: DEFAULT_PAGE_SIZE,
    });
    const [searchText, setSearchText] = useState("");
    const [filters, setFilters] = useState<DictionaryFilters>(
        DEFAULT_DICTIONARY_FILTERS,
    );
    const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
    const [editingDictionary, setEditingDictionary] =
        useState<DictRecord | null>(null);
    const [dictionaryEditDrawerOpen, setDictionaryEditDrawerOpen] =
        useState(false);
    const hasSelectedDictionaries = selectedRowKeys.length > 0;

    const dictionaryPageQuery = useQuery({
        queryKey: ["dictionary", "page", query],
        queryFn: () => dictionaryService.page(query),
        enabled: canViewDictionary,
        retry: false,
    });
    const dictionaryPage = dictionaryPageQuery.data;
    const dictionaries = useMemo(
        () => dictionaryPage?.records || [],
        [dictionaryPage?.records],
    );
    const totalCount = dictionaryPage?.count ?? dictionaryPage?.totalCount ?? 0;
    const currentPageNo =
        dictionaryPage?.pageNo || query.pageNo || DEFAULT_PAGE_NO;
    const currentPageSize =
        dictionaryPage?.pageSize || query.pageSize || DEFAULT_PAGE_SIZE;

    const saveDictionaryMutation = useMutation({
        mutationFn: (values: DictSaveCommand) =>
            values.id
                ? dictionaryService.changeDictionaryInfo(values)
                : dictionaryService.addDictionary(values),
        onSuccess: async () => {
            setDictionaryEditDrawerOpen(false);
            setEditingDictionary(null);
            await queryClient.invalidateQueries({
                queryKey: ["dictionary", "page"],
            });
            messageApi.success("字典项已保存");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "保存失败",
            );
        },
    });

    const deleteMutation = useMutation({
        mutationFn: dictionaryService.removeDictionaries,
        onSuccess: async () => {
            setSelectedRowKeys([]);
            await queryClient.invalidateQueries({
                queryKey: ["dictionary", "page"],
            });
            messageApi.success("字典项已删除");
        },
        onError: (error) => {
            messageApi.error(
                error instanceof Error ? error.message : "删除失败",
            );
        },
    });

    const updateQuery = (values: Partial<DictPageQuery>) => {
        setSelectedRowKeys([]);
        setQuery((currentQuery) => {
            const nextQuery = { ...currentQuery, ...values };
            return {
                type: nextQuery.type,
                label: nextQuery.label,
                remarks: nextQuery.remarks,
                pageNo: DEFAULT_PAGE_NO,
                pageSize: currentQuery.pageSize || DEFAULT_PAGE_SIZE,
            };
        });
    };

    const searchDictionaries = (value: string) => {
        setSearchText(value);
        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }
        searchTimerRef.current = setTimeout(() => {
            updateQuery({ label: normalizeSearch(value) });
        }, SEARCH_DEBOUNCE_MS);
    };

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, []);

    if (!canViewDictionary) {
        return <Empty description="缺少 sys:dict:view 权限" />;
    }

    const applyFilters = () => {
        updateQuery({
            remarks: normalizeSearch(filters.remarks),
            type: normalizeSearch(filters.type),
        });
    };

    const resetFilters = () => {
        setFilters(DEFAULT_DICTIONARY_FILTERS);
        updateQuery({
            remarks: undefined,
            type: undefined,
        });
    };

    const openCreateDictionaryDrawer = () => {
        setEditingDictionary(null);
        setDictionaryEditDrawerOpen(true);
    };

    const openEditDictionaryDrawer = (dictionary: DictRecord) => {
        setEditingDictionary(dictionary);
        setDictionaryEditDrawerOpen(true);
    };

    const closeDictionaryEditDrawer = () => {
        if (saveDictionaryMutation.isPending) {
            return;
        }
        setDictionaryEditDrawerOpen(false);
        setEditingDictionary(null);
    };

    const saveDictionary = (request: DictSaveCommand) => {
        saveDictionaryMutation.mutate(request);
    };

    const confirmDelete = (ids: string[]) => {
        modal.confirm({
            okButtonProps: { danger: true },
            cancelText: "取消",
            title: "删除字典项",
            content: (
                <>
                    <p>{`确认删除 ${ids.length} 个字典项？`}</p>
                    <p>{"删除后需要重新新增。"}</p>
                </>
            ),
            okText: "删除",
            onOk: () => deleteMutation.mutateAsync(ids),
        });
    };

    const columns: ProColumns<DictRecord>[] = [
        {
            title: "字典类型",
            dataIndex: "type",
            key: "type",
            width: DEFAULT_COLUMN_WIDTHS.type,
            renderText: (type: string) => (
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
                    {type}
                </Tag>
            ),
        },
        {
            title: "标签",
            dataIndex: "label",
            key: "label",
            width: DEFAULT_COLUMN_WIDTHS.label,
            renderText: (label: string) => <Text strong>{label}</Text>,
        },
        {
            title: "值",
            dataIndex: "value",
            key: "value",
            width: DEFAULT_COLUMN_WIDTHS.value,
            renderText: (value: string) => (
                <Text className="dictionary-code" code>
                    {value}
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
                remarks || <Text type="secondary">未填写</Text>,
        },
        {
            key: "actions",
            title: "操作",
            valueType: "option",
            fixed: "right",
            render: (_, dictionary) => [
                <Button
                    type="link"
                    key={"edit"}
                    disabled={!canEditDictionary}
                    aria-label={`编辑 ${dictionary.label}`}
                    onClick={() => openEditDictionaryDrawer(dictionary)}
                >
                    {"编辑"}
                </Button>,
                null,
                <Button
                    type="link"
                    key={"delete"}
                    danger
                    disabled={!canEditDictionary}
                    aria-label={`删除 ${dictionary.label}`}
                    onClick={() => confirmDelete([dictionary.id])}
                >
                    {"删除"}
                </Button>,
            ],
        },
    ];

    return (
        <>
            <PageContainer
                title={"字典管理"}
                content={"维护系统字典类型、展示标签、业务值和备注说明。"}
                className={"dictionary-page"}
                extra={
                    <Space wrap>
                        <Input.Search
                            aria-label={"搜索" + "字典项"}
                            placeholder={"搜索" + "字典项"}
                            allowClear
                            value={searchText}
                            onChange={(event) =>
                                searchDictionaries?.(event.target.value)
                            }
                        />
                        {
                            <Button
                                data-testid={
                                    "system-dictionary-dictionary-refresh-button"
                                }
                                icon={<ReloadOutlined />}
                                loading={dictionaryPageQuery.isFetching}
                                disabled={!canViewDictionary}
                                onClick={() => {
                                    if (!canViewDictionary) {
                                        return;
                                    }
                                    void dictionaryPageQuery.refetch();
                                }}
                            >
                                刷新
                            </Button>
                        }
                        {canEditDictionary ? (
                            <Button
                                type="primary"
                                onClick={openCreateDictionaryDrawer}
                            >
                                {"新增" + "字典项"}
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
                            name: "type",
                            label: "字典类型",
                            render: () => (
                                <Input
                                    allowClear
                                    placeholder="user_status"
                                    prefix={<BookOutlined />}
                                    value={filters.type}
                                    onChange={(event) =>
                                        setFilters((currentFilters) => ({
                                            ...currentFilters,
                                            type: event.target.value,
                                        }))
                                    }
                                />
                            ),
                        },
                        {
                            name: "remarks",
                            label: "备注",
                            render: () => (
                                <Input
                                    allowClear
                                    placeholder="备注关键词"
                                    value={filters.remarks}
                                    onChange={(event) =>
                                        setFilters((currentFilters) => ({
                                            ...currentFilters,
                                            remarks: event.target.value,
                                        }))
                                    }
                                />
                            ),
                        },
                    ].map((field) => (
                        <Form.Item key={field.name} label={field.label}>
                            {field.render()}
                        </Form.Item>
                    ))}
                </QueryFilter>
                <ProTable<DictRecord>
                    tableAlertRender={() => (
                        <>已选择 {selectedRowKeys.length} 项</>
                    )}
                    tableAlertOptionRender={() => (
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            data-testid="system-dictionary-dictionary-batch-delete-button"
                            disabled={
                                !canEditDictionary || !hasSelectedDictionaries
                            }
                            loading={deleteMutation.isPending}
                            onClick={() =>
                                confirmDelete(selectedRowKeys.map(String))
                            }
                        >
                            批量删除
                        </Button>
                    )}
                    search={false}
                    options={false}
                    rowKey="id"
                    className="dictionary-table"
                    columns={columns}
                    dataSource={dictionaries}
                    loading={dictionaryPageQuery.isFetching}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                        getCheckboxProps: () => ({
                            disabled: !canEditDictionary,
                        }),
                    }}
                    pagination={{
                        current: currentPageNo,
                        pageSize: currentPageSize,
                        total: totalCount,
                        showTotal: (total) => `共 ${total} 项`,
                        onChange: (pageNo, pageSize) => {
                            setQuery((currentQuery) => ({
                                ...currentQuery,
                                pageNo,
                                pageSize,
                            }));
                        },
                    }}
                    locale={{
                        emptyText: dictionaryPageQuery.isError
                            ? "字典列表加载失败，请确认权限和接口状态。"
                            : "暂无字典项",
                    }}
                />
            </PageContainer>

            <DictionaryEditDrawer
                open={dictionaryEditDrawerOpen}
                dictionary={editingDictionary}
                saving={saveDictionaryMutation.isPending}
                onClose={closeDictionaryEditDrawer}
                onSave={saveDictionary}
            />
        </>
    );
};
