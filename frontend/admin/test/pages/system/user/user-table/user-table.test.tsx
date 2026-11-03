import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UserTable } from "@/pages/system/user/user-table/user-table";

const currentUser = {
    id: "operator",
    loginName: "operator",
    name: "操作员",
    ranks: 5,
};
const users = [
    { id: "operator", name: "操作员", ranks: 5 },
    { id: "peer", name: "同级用户", ranks: 5 },
    { id: "junior", name: "下级用户", ranks: 1 },
];

const renderTable = (canEditUser: boolean) => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
        <UserTable
            canEditUser={canEditUser}
            currentPage={1}
            currentUser={currentUser}
            loading={false}
            batchActions={<span>批量操作</span>}
            pageSize={20}
            rankLabelByValue={new Map()}
            selectedRowKeys={[]}
            statusLabelByValue={new Map()}
            statusPending={false}
            totalCount={users.length}
            users={users}
            onDelete={onDelete}
            onEdit={onEdit}
            onPageChange={vi.fn()}
            onSelectedRowKeysChange={vi.fn()}
            onStatusChange={vi.fn()}
        />,
    );
    return { onEdit, onDelete };
};

describe("UserTable authorization", () => {
    it("protects self and peers while allowing lower-rank user actions", async () => {
        const user = userEvent.setup();
        const { onEdit, onDelete } = renderTable(true);
        for (const name of ["操作员", "同级用户"]) {
            const row = within(screen.getByText(name).closest("tr")!);
            expect(
                row.getByRole("button", { name: `编辑 ${name}` }),
            ).toBeDisabled();
            expect(
                row.getByRole("button", { name: `删除 ${name}` }),
            ).toBeDisabled();
        }
        const junior = within(screen.getByText("下级用户").closest("tr")!);
        await user.click(junior.getByRole("button", { name: "编辑 下级用户" }));
        await user.click(junior.getByRole("button", { name: "删除 下级用户" }));
        expect(onEdit).toHaveBeenCalledWith(users[2]);
        expect(onDelete).toHaveBeenCalledWith(users[2]);
        const row = screen.getByText("同级用户").closest("tr")!;
        expect(within(row).getByRole("checkbox")).toBeDisabled();
        expect(within(row).getByRole("switch")).toBeDisabled();
    });

    it("disables row actions and selection without edit permission", () => {
        renderTable(false);
        for (const name of users.map((record) => record.name)) {
            const row = within(screen.getByText(name).closest("tr")!);
            expect(
                row.getByRole("button", { name: `编辑 ${name}` }),
            ).toBeDisabled();
            expect(
                row.getByRole("button", { name: `删除 ${name}` }),
            ).toBeDisabled();
        }
        const row = screen.getByText("下级用户").closest("tr")!;
        expect(within(row).getByRole("checkbox")).toBeDisabled();
    });
});
