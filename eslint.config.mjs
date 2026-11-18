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
        files: [
            "scripts/**/*.mjs",
            ".agents/**/*.mjs",
            "**/*.config.mjs",
            "miniprograms/*/{scripts,test}/**/*.mjs",
        ],
        languageOptions: { globals: globals.node },
    },
    {
        files: ["miniprograms/*/cloudfunctions/**/*.js"],
        languageOptions: { sourceType: "commonjs", globals: globals.node },
    },
    {
        files: ["miniprograms/*/open-data/**/*.js"],
        languageOptions: {
            sourceType: "script",
            globals: { wx: "readonly", console: "readonly" },
        },
    },
    {
        files: ["miniprograms/**/*.ts"],
        languageOptions: { globals: { wx: "readonly" } },
    },
    {
        rules: { "no-debugger": "error", eqeqeq: "error" },
    },
];
