import {
    Navigate,
    RouterProvider,
    createBrowserRouter,
} from "react-router-dom";
import { AdminLayout } from "@/layouts/admin-layout";
import { LoginPage } from "@/pages/auth/login/login-page";
import { UserPage } from "@/pages/system/user/user-page";
import { RolePage } from "@/pages/system/role/role-page";
import { MenuPage } from "@/pages/system/menu/menu-page";
import { DepartmentPage } from "@/pages/system/department/department-page";
import { DictionaryPage } from "@/pages/system/dictionary/dictionary-page";
import { SystemLogPage } from "@/pages/system/system-log/system-log-page";
import { ProtectedRoute } from "./protected-route";
const router = createBrowserRouter(
    [
        { path: "/login", element: <LoginPage /> },
        {
            path: "/",
            element: <ProtectedRoute />,
            children: [
                {
                    element: <AdminLayout />,
                    children: [
                        {
                            index: true,
                            element: <Navigate to="/system/users" replace />,
                        },
                        {
                            path: "dashboard",
                            element: <Navigate to="/system/users" replace />,
                        },
                        { path: "system/users", element: <UserPage /> },
                        { path: "system/roles", element: <RolePage /> },
                        { path: "system/menus", element: <MenuPage /> },
                        {
                            path: "system/departments",
                            element: <DepartmentPage />,
                        },
                        {
                            path: "system/dictionaries",
                            element: <DictionaryPage />,
                        },
                        { path: "system/logs", element: <SystemLogPage /> },
                    ],
                },
            ],
        },
    ],
    { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || undefined },
);
export const AppRouter = () => <RouterProvider router={router} />;
