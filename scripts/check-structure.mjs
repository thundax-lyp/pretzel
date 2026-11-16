import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const root = process.argv[2] ? path.resolve(process.argv[2]) : toolRoot;
const errors = [];
const skip = new Set([
    ".git",
    "node_modules",
    "target",
    "dist",
    "backup",
    "logs",
    "storage",
    ".secrets",
]);
function files(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((item) => {
            if (skip.has(item.name)) return [];
            const full = path.join(directory, item.name);
            return item.isDirectory() ? files(full) : [full];
        });
}
function fail(file, message) {
    errors.push(`${path.relative(root, file)}: ${message}`);
}
for (const retired of [
    "admin-web",
    "frontend/admin",
    "miniprogram",
    "frontend/miniprogram",
]) {
    const directory = path.join(root, retired);
    if (fs.existsSync(directory))
        fail(
            directory,
            "place game applications in frontend/miniprograms/<game>",
        );
}
const all = files(root);
const docsRoot = path.join(root, "docs");
const parents = new Map();
for (const file of all.filter(
    (name) => name.endsWith(".md") && name.startsWith(docsRoot + path.sep),
)) {
    if (
        !/^(?:AGENTS|README|[A-Z0-9]+(?:-[A-Z0-9]+)*)\.md$/.test(
            path.basename(file),
        )
    )
        fail(file, "use uppercase English document filenames");
    const links = fs.readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g);
    for (const [, link] of links) {
        if (/^(https?:|#)/.test(link)) continue;
        const target = path.resolve(path.dirname(file), link.split("#")[0]);
        if (!fs.existsSync(target))
            fail(file, `missing document target: ${link}`);
        const navigation = ["README.md"].includes(path.basename(file));
        if (!navigation)
            fail(
                file,
                "leaf documents must not maintain cross-document navigation",
            );
        if (target.startsWith(docsRoot + path.sep)) {
            if (
                file !== path.join(docsRoot, "README.md") &&
                path.dirname(target) !== path.dirname(file)
            )
                fail(file, "category index must link only to its own children");
            if (parents.has(target) && parents.get(target) !== file)
                fail(
                    file,
                    `document already has a navigation parent: ${path.relative(root, parents.get(target))}`,
                );
            parents.set(target, file);
        }
    }
}
for (const file of all.filter(
    (name) =>
        name.startsWith(docsRoot + path.sep) &&
        name.endsWith(".md") &&
        name !== path.join(docsRoot, "README.md"),
)) {
    if (!parents.has(file))
        fail(file, "document is missing from the navigation tree");
}
if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
} else {
    console.log("Structure lint passed: game directories and document tree.");
}
