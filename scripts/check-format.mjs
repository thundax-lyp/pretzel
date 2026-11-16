import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set([
    ".git",
    "node_modules",
    "target",
    "dist",
    "backup",
    "logs",
    "storage",
    ".secrets",
]);
const write = process.argv.includes("--write");
const failures = [];
function walk(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((item) => {
            if (ignored.has(item.name)) return [];
            const full = path.join(directory, item.name);
            return item.isDirectory() ? walk(full) : [full];
        });
}
const candidates = walk(root);
const ignoreResult = spawnSync(
    "git",
    ["check-ignore", "--no-index", "--stdin", "-z"],
    {
        cwd: root,
        input: candidates.join("\0") + "\0",
        encoding: "utf8",
    },
);
if (![0, 1].includes(ignoreResult.status))
    throw new Error("Unable to determine ignored files");
const privateFiles = new Set(ignoreResult.stdout.split("\0"));
for (const file of candidates) {
    if (privateFiles.has(file)) continue;
    if (
        !/\.(?:[cm]?js|tsx?|css|wxss|wxml|json|ya?ml|md)$/.test(file) ||
        file.endsWith("package-lock.json")
    )
        continue;
    const options = { ...(await prettier.resolveConfig(file)), filepath: file };
    if (file.endsWith(".wxss")) options.parser = "css";
    if (file.endsWith(".wxml")) {
        options.parser = "html";
        options.htmlWhitespaceSensitivity = "ignore";
    }
    const text = fs.readFileSync(file, "utf8");
    if (write) fs.writeFileSync(file, await prettier.format(text, options));
    else if (!(await prettier.check(text, options)))
        failures.push(path.relative(root, file));
}
if (failures.length) {
    console.error("Formatting required:\n" + failures.join("\n"));
    process.exitCode = 1;
} else {
    console.log(
        write
            ? "Managed source and document formatting applied."
            : "4-space formatting checks passed.",
    );
}
