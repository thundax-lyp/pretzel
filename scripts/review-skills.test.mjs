import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const review = path.join(
    root,
    ".agents/skills/pretzel-pr-review/scripts/collect-review-context.mjs",
);
function repository(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pretzel-review-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const git = (...args) =>
        execFileSync("git", args, {
            cwd: directory,
            stdio: "pipe",
            encoding: "utf8",
        });
    git("init", "--initial-branch=main");
    git("config", "user.name", "Review Test");
    git("config", "user.email", "review@example.invalid");
    git("config", "core.hooksPath", "/dev/null");
    const write = (file, text) => {
        const full = path.join(directory, file);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, text);
    };
    const commit = () => {
        git("add", "-A");
        git("commit", "-m", "fixture");
    };
    write("README.md", "initial\n");
    commit();
    git("switch", "-c", "feature");
    const run = (...args) =>
        spawnSync(process.execPath, [review, ...args], {
            cwd: directory,
            encoding: "utf8",
        });
    return { directory, git, write, commit, run };
}

test("review snapshot retains an empty committed diff and excludes worktree changes", (t) => {
    const repo = repository(t);
    repo.write("README.md", "uncommitted\n");
    repo.write("未跟踪 文件.ts", "const value = 1;\n");
    const result = repo.run("context");
    assert.equal(result.status, 0, result.stderr);
    const context = JSON.parse(result.stdout);
    assert.deepEqual(context.snapshot.changed_files, []);
    assert.equal(context.snapshot.changed_file_count, 0);
    assert.equal(context.worktree_changes.length, 2);
    assert(
        context.worktree_changes.some((file) => file.path === "未跟踪 文件.ts"),
    );
});
test("review snapshots classify deleted backend modules and literal rename paths", (t) => {
    const repo = repository(t);
    repo.write("backend/biz/game/pretzel-game-domain/pom.xml", "<project/>\n");
    repo.write(
        "frontend/admin/src/old 文件.ts",
        "export const name = 'original';\n",
    );
    repo.commit();
    repo.git("branch", "-f", "main", "HEAD");
    fs.rmSync(path.join(repo.directory, "backend"), { recursive: true });
    repo.git(
        "mv",
        "frontend/admin/src/old 文件.ts",
        "frontend/admin/src/new 文件.ts",
    );
    repo.write("frontend/miniprogram/app.ts", "export {};\n");
    repo.commit();
    const state = JSON.parse(repo.run("snapshot").stdout);
    assert.equal(state.changed_file_count, 3);
    assert(
        state.changed_files.some(
            (file) =>
                file.module === "miniprogram" &&
                file.path === "frontend/miniprogram/app.ts",
        ),
    );
    assert(
        state.changed_files.some(
            (file) =>
                file.module === "backend:biz/game/pretzel-game-domain" &&
                file.status === "deleted",
        ),
    );
    const renamed = state.changed_files.find(
        (file) => file.status === "renamed",
    );
    assert.equal(renamed.old_path, "frontend/admin/src/old 文件.ts");
    assert.equal(renamed.path, "frontend/admin/src/new 文件.ts");
    assert.equal(renamed.module, "admin");
    const patch = repo.run("diff", "--module", "admin");
    assert.equal(patch.status, 0, patch.stderr);
    assert.match(patch.stdout, /rename from/);
    assert.doesNotMatch(patch.stdout, /pom.xml/);
});
test("review baseline changes invalidate its snapshot and reject unsafe filters", (t) => {
    const repo = repository(t);
    repo.write("first.ts", "first\n");
    repo.commit();
    const before = JSON.parse(repo.run("snapshot").stdout);
    repo.write("first.ts", "second\n");
    repo.commit();
    const after = JSON.parse(repo.run("snapshot").stdout);
    assert.notEqual(after.head, before.head);
    assert.notEqual(after.diff_hash, before.diff_hash);
    assert.equal(repo.run("diff", "--path", "../outside").status, 2);
    assert.equal(repo.run("diff", "--module", "missing").status, 2);
});
