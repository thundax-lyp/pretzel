import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const toolRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const root = process.argv[2] ? path.resolve(process.argv[2]) : toolRoot;
const require = createRequire(path.join(toolRoot, "admin-web/package.json"));
const ts = require("typescript");
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
const sourceRoot = path.join(root, "admin-web/src");
for (const file of files(sourceRoot).filter((name) =>
    /\.(ts|tsx)$/.test(name),
)) {
    const relative = path.relative(sourceRoot, file).replaceAll(path.sep, "/");
    if (!/^[a-z0-9]+(?:[-.][a-z0-9]+)*\.(ts|tsx)$/.test(path.basename(file)))
        fail(file, "use kebab-case source filenames");
    if (relative.startsWith("service/"))
        fail(file, "place shared session capability in session, not service");
    if (/\.test\.tsx?$/.test(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            const specifier = node.moduleSpecifier;
            if (specifier && ts.isStringLiteral(specifier)) {
                const name = specifier.text;
                const target = name.startsWith("@/")
                    ? name.slice(2)
                    : name.startsWith(".")
                      ? path
                            .relative(
                                sourceRoot,
                                path.resolve(path.dirname(file), name),
                            )
                            .replaceAll(path.sep, "/")
                      : null;
                if (target) {
                    if (name.startsWith("../../"))
                        fail(
                            file,
                            "use @/ for imports more than one parent above",
                        );
                    const area = relative.split("/")[0];
                    if (
                        ["api", "auth", "session"].includes(area) &&
                        /^(pages|layouts|components)\//.test(target)
                    )
                        fail(
                            file,
                            "shared protocol and session code must not depend on UI",
                        );
                    if (
                        ["api", "auth"].includes(area) &&
                        target.startsWith("session/")
                    )
                        fail(
                            file,
                            "low-level protocol must not depend on session orchestration",
                        );
                    if (
                        area === "pages" &&
                        target.startsWith("pages/") &&
                        relative.split("/").slice(0, 3).join("/") !==
                            target.split("/").slice(0, 3).join("/")
                    )
                        fail(
                            file,
                            "page domains must not import other page domains",
                        );
                }
            }
        }
        if (
            ts.isCallExpression(node) &&
            ["fetch", "window.fetch", "globalThis.fetch"].includes(
                node.expression.getText(ast),
            ) &&
            relative !== "api/http.ts"
        )
            fail(file, "HTTP requests belong in api/http.ts");
        if (
            (ts.isJsxOpeningElement(node) ||
                ts.isJsxSelfClosingElement(node)) &&
            /^Pretzel(Button|Table|Form|Page|Drawer|Select|Space|Alert|Switch|Tag)$/.test(
                node.tagName.getText(ast),
            )
        )
            fail(file, "use official Pro Components or antd controls directly");
        ts.forEachChild(node, visit);
    }
    visit(ast);
}
const all = files(root);
for (const file of all) {
    if (file.endsWith(".java")) {
        const text = fs.readFileSync(file, "utf8");
        const match = text.match(/^package ([\w.]+);/m);
        if (match) {
            if (/(?:^|\.)(configure|utils|arch)(?:\.|$)/.test(match[1]))
                fail(file, "use config, util and architecture packages");
            if (
                !file
                    .replaceAll(path.sep, "/")
                    .endsWith(
                        `${match[1].replaceAll(".", "/")}/${path.basename(file)}`,
                    )
            )
                fail(file, "source directory must match Java package");
        }
    }
    if (
        file.endsWith(".imports") &&
        /com\.thundax\.pretzel\..*\.configure\./.test(
            fs.readFileSync(file, "utf8"),
        )
    )
        fail(
            file,
            "Spring auto-configuration registration references an old package",
        );
}
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
    console.log(
        "Structure lint passed: source ownership, Java packages, official UI and document tree.",
    );
}
