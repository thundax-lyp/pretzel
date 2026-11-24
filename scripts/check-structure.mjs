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
    ".idea",
    "node_modules",
    "target",
    "dist",
    "backup",
    "logs",
    "storage",
    ".secrets",
    "build",
    "library",
    "local",
    "native",
    "profiles",
    "temp",
]);
function files(directory) {
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((item) => {
            if (skip.has(item.name)) return [];
            const full = path.join(directory, item.name);
            if (
                item.isDirectory() &&
                !/^\.?[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.name)
            ) {
                fail(full, "use kebab-case custom directory names");
            }
            return item.isDirectory() ? files(full) : [full];
        });
}
function fail(file, message) {
    errors.push(`${path.relative(root, file)}: ${message}`);
}
const isDirectory = (file) =>
    fs.statSync(file, { throwIfNoEntry: false })?.isDirectory();
const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile();

const gamesRoot = path.join(root, "miniprograms");
if (!isDirectory(gamesRoot)) {
    fail(gamesRoot, "missing game applications directory");
} else {
    for (const entry of fs.readdirSync(gamesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
        const game = path.join(gamesRoot, entry.name);
        if (
            !entry.isDirectory() ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)
        ) {
            fail(game, "use a kebab-case game directory under miniprograms");
            continue;
        }
        if (!isFile(path.join(game, "package.json")))
            fail(game, "missing game package.json");
        if (!isDirectory(path.join(game, "assets", "scenes")))
            fail(game, "missing Cocos assets/scenes directory");
    }
}
for (const retired of ["admin-web", "frontend", "miniprogram"]) {
    const directory = path.join(root, retired);
    if (fs.existsSync(directory))
        fail(directory, "place game applications in miniprograms/<game>");
}
const all = files(root);
for (const file of all) {
    if (!file.endsWith(".scene")) continue;
    const parts = path.relative(root, file).split(path.sep);
    const assets = parts.lastIndexOf("assets");
    if (assets >= 0 && parts[assets + 1] === "scenes") {
        const game = path.join(root, ...parts.slice(0, assets));
        if (path.dirname(game) !== gamesRoot)
            fail(game, "place Cocos game applications in miniprograms/<game>");
    }
}
const docsRoot = path.join(root, "docs");
const docsIndex = path.join(docsRoot, "README.md");
if (!isFile(docsIndex)) fail(docsIndex, "missing document navigation entry");
const indexedDocs = new Set();
const humanDocs = path.join(docsRoot, "60-human") + path.sep;
for (const file of all.filter(
    (name) => name.endsWith(".md") && name.startsWith(docsRoot + path.sep),
)) {
    if (
        !/^(?:AGENTS|README|[A-Z0-9]+(?:-[A-Z0-9]+)*)\.md$/.test(
            path.basename(file),
        )
    )
        fail(file, "use uppercase English document filenames");
    const links = fs
        .readFileSync(file, "utf8")
        .matchAll(/(!?)\[[^\n\]]*\]\(([^)]+)\)/g);
    for (const [, image, link] of links) {
        if (/^(https?:|#)/.test(link)) continue;
        const target = path.resolve(path.dirname(file), link.split("#")[0]);
        if (!fs.existsSync(target))
            fail(file, `missing document target: ${link}`);
        if (image && /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(target))
            continue;
        if (file !== docsIndex) {
            fail(
                file,
                "leaf documents must not maintain cross-document navigation",
            );
        } else if (target.startsWith(humanDocs)) {
            fail(file, "human work materials must stay out of docs/README.md");
        } else if (target.startsWith(docsRoot + path.sep)) {
            indexedDocs.add(target);
        }
    }
}
for (const file of all.filter(
    (name) =>
        name.startsWith(docsRoot + path.sep) &&
        name.endsWith(".md") &&
        name !== docsIndex &&
        !name.startsWith(humanDocs),
)) {
    if (!indexedDocs.has(file))
        fail(file, "document is missing from docs/README.md");
}
if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
} else {
    console.log(
        "Structure lint passed: custom directory names, game directories and document tree.",
    );
}
