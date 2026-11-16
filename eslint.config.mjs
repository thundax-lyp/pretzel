import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            ".agents/skills/wechatide-skill/",
            "**/build/**",
            "**/library/**",
            "**/local/**",
            "**/temp/**",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: ["**/*.ts"],
    })),
    {
        files: ["**/*.{js,mjs,cjs}"],
        languageOptions: { globals: globals.node },
    },
    {
        files: ["miniprograms/**/*.ts"],
        languageOptions: { globals: { wx: "readonly" } },
    },
    {
        rules: { "no-debugger": "error", eqeqeq: "error" },
    },
];
