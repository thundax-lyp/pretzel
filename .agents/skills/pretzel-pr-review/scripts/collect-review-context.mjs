#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const statuses = {
    A: "added",
    C: "copied",
    D: "deleted",
    M: "modified",
    R: "renamed",
    T: "type-changed",
    U: "unmerged",
    X: "unknown",
    B: "broken-pairing",
    "?": "untracked",
    " ": "unmodified",
};
function git(root, args, input) {
    return execFileSync("git", ["--literal-pathspecs", ...args], {
        cwd: root,
        encoding: "utf8",
        input,
        maxBuffer: 128 * 1024 * 1024,
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
}
function moduleFor(file) {
    const p = file.split("/");
    if (
        p.length === 1 ||
        [".agents", ".github", ".githooks", ".vscode"].includes(p[0])
    )
        return "repo-governance";
    if (["docs", "deploy"].includes(p[0])) return p[0];
    if (p[0] === "miniprograms" && p.length > 2) return `miniprogram:${p[1]}`;
    if (p[0] === "frontend") {
        if (p[1] === "admin") return "admin";
        if (p[1] === "miniprograms" && p.length > 3)
            return `miniprogram:${p[2]}`;
        return "repo-governance";
    }
    if (p[0] === "scripts") return "tooling";
    if (p[0] === "backend") {
        if (p[1] === "biz" && p[3]?.startsWith("pretzel-"))
            return `backend:biz/${p[2]}/${p[3]}`;
        if (
            ["common", "starter"].includes(p[1]) &&
            p[2]?.startsWith("pretzel-")
        )
            return `backend:${p[1]}/${p[2]}`;
        return "backend:build";
    }
    return "other";
}
function changes(root, base, head) {
    const fields = git(root, [
        "diff",
        "--name-status",
        "-z",
        "--find-renames",
        base,
        head,
        "--",
    ]).split("\0");
    fields.pop();
    const result = [];
    while (fields.length) {
        const status = fields.shift();
        const old = ["R", "C"].includes(status[0]) ? fields.shift() : undefined;
        const file = fields.shift();
        if (file === undefined) throw new Error("Truncated changed-file data");
        result.push({
            status: statuses[status[0]] || "unknown",
            path: file,
            module: moduleFor(file),
            ...(old === undefined
                ? {}
                : { old_path: old, similarity: status.slice(1) }),
        });
    }
    return result;
}
function snapshot(root, base) {
    if (!base || base.startsWith("-"))
        throw new Error("Base must be a Git commit reference");
    const head = git(root, ["rev-parse", "--verify", "HEAD^{commit}"]).trim();
    const baseSha = git(root, [
        "rev-parse",
        "--verify",
        `${base}^{commit}`,
    ]).trim();
    const mergeBase = git(root, ["merge-base", baseSha, head]).trim();
    const files = changes(root, mergeBase, head);
    const raw = git(root, [
        "diff",
        "--raw",
        "-z",
        "--no-abbrev",
        "--find-renames",
        mergeBase,
        head,
        "--",
    ]);
    return {
        repository: path.basename(root),
        branch:
            git(root, ["branch", "--show-current"]).trim() || "detached-HEAD",
        head,
        base_ref: base,
        base_sha: baseSha,
        merge_base: mergeBase,
        diff_hash: git(root, ["hash-object", "--stdin"], raw).trim(),
        changed_file_count: files.length,
        changed_files: files,
    };
}
function worktree(root) {
    const fields = git(root, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
    ]).split("\0");
    fields.pop();
    const result = [];
    while (fields.length) {
        const item = fields.shift();
        const renamed = /[RC]/.test(item.slice(0, 2));
        const old = renamed ? fields.shift() : undefined;
        result.push({
            path: item.slice(3),
            status: item.slice(0, 2) === "??" ? "untracked" : "changed",
            index: statuses[item[0]],
            worktree: statuses[item[1]],
            ...(old === undefined ? {} : { old_path: old }),
        });
    }
    return result;
}
function options(args) {
    if (!args.length || args.includes("--help")) {
        console.log(
            "Usage: collect-review-context.mjs context|snapshot|diff [--base <ref>] [--module <name> ... | --path <path> ...]",
        );
        return null;
    }
    const [command, ...rest] = args;
    if (!["context", "snapshot", "diff"].includes(command))
        throw new Error("Unknown command");
    const result = { command, base: "main", modules: [], paths: [] };
    for (let i = 0; i < rest.length; i += 2) {
        const key = rest[i],
            value = rest[i + 1];
        if (
            !["--base", "--module", "--path"].includes(key) ||
            !value ||
            value.startsWith("-")
        )
            throw new Error("Expected a supported option and value");
        if (key === "--base") result.base = value;
        if (key === "--module") result.modules.push(value);
        if (key === "--path") {
            const normalized = path.posix.normalize(value);
            if (
                path.posix.isAbsolute(value) ||
                normalized === ".." ||
                normalized.startsWith("../") ||
                value.includes("\0")
            )
                throw new Error("Path must be repository-relative");
            result.paths.push(normalized);
        }
    }
    if (
        (command !== "diff" &&
            (result.modules.length || result.paths.length)) ||
        (result.modules.length && result.paths.length)
    )
        throw new Error(
            "Module/path filters are exclusive and only valid for diff",
        );
    return result;
}
function main() {
    const opt = options(process.argv.slice(2));
    if (!opt) return;
    const root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
    const state = snapshot(root, opt.base);
    if (opt.command === "snapshot")
        return console.log(JSON.stringify(state, null, 4));
    if (opt.command === "context") {
        const groups = new Map();
        for (const file of state.changed_files)
            groups.set(file.module, (groups.get(file.module) || 0) + 1);
        const log = git(root, [
            "log",
            "--reverse",
            "--format=%H%x00%s%x00",
            `${state.merge_base}..${state.head}`,
        ]).split("\0");
        const commits = [];
        for (let i = 0; i + 1 < log.length; i += 2)
            commits.push({ sha: log[i].trim(), subject: log[i + 1] });
        return console.log(
            JSON.stringify(
                {
                    snapshot: state,
                    worktree_changes: worktree(root),
                    commits,
                    modules: [...groups]
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([module, changed_files]) => ({
                            module,
                            changed_files,
                        })),
                    diff_stat: git(root, [
                        "diff",
                        "--stat",
                        state.merge_base,
                        state.head,
                        "--",
                    ]).trim(),
                },
                null,
                4,
            ),
        );
    }
    let paths = opt.paths;
    if (opt.modules.length) {
        const missing = opt.modules.filter(
            (module) =>
                !state.changed_files.some((file) => file.module === module),
        );
        if (missing.length)
            throw new Error(
                `Module has no changed files: ${missing.join(", ")}`,
            );
        paths = [
            ...new Set(
                state.changed_files
                    .filter((file) => opt.modules.includes(file.module))
                    .flatMap((file) =>
                        file.old_path
                            ? [file.old_path, file.path]
                            : [file.path],
                    ),
            ),
        ];
    }
    // Show binary identities, not large binary payloads. Snapshot hashes include full object IDs.
    process.stdout.write(
        git(root, [
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--full-index",
            "--find-renames",
            state.merge_base,
            state.head,
            "--",
            ...paths,
        ]),
    );
}
try {
    main();
} catch (error) {
    console.error(`error: ${String(error.stderr || error.message).trim()}`);
    process.exitCode = 2;
}
