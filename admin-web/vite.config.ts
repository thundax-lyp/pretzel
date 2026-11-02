import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig(({ mode }) => {
    const environment = loadEnv(mode, process.cwd(), "VITE_");
    return {
        plugins: [react()],
        resolve: {
            alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
        },
        server: {
            proxy: {
                "/pretzel-admin-api": {
                    target:
                        environment.VITE_ADMIN_API_TARGET ||
                        "http://localhost:8080",
                    changeOrigin: true,
                },
            },
        },
        test: {
            environment: "jsdom",
            globals: true,
            setupFiles: ["./src/test/setup.ts"],
            exclude: ["node_modules/**", "dist/**"],
        },
    };
});
