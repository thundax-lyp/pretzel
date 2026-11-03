import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const checker = fileURLToPath(
    new URL("./check-structure.mjs", import.meta.url),
);
function fixture(t, entries = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "pretzel-structure-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const files = {
        "admin-web/src/auth/token-storage.ts": "export const token = null;\n",
        "docs/README.md": "[规范](00-governance/README.md)\n",
        "docs/00-governance/README.md": "[命名](NAMING-RULES.md)\n",
        "docs/00-governance/NAMING-RULES.md": "# Naming\n",
        ...entries,
    };
    for (const [name, text] of Object.entries(files)) {
        const file = path.join(root, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
    }
    return spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
}

test("accepts a tree of documents and protocol-owned code", (t) => {
    assert.equal(fixture(t).status, 0);
});
test("separates production code from mirrored tests", (t) => {
    assert.equal(
        fixture(t, {
            "admin-web/test/auth/token-storage.test.ts":
                'import { token } from "@/auth/token-storage";\n',
        }).status,
        0,
    );
    const result = fixture(t, {
        "admin-web/src/auth/token-storage.test.ts": "export {};\n",
        "admin-web/src/auth/production.ts": 'import "../../test/setup";\n',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /outside src/);
    assert.match(result.stderr, /must not depend on tests/);
});
test("rejects session code depending on a business page", (t) => {
    const result = fixture(t, {
        "admin-web/src/session/current-user-service.ts":
            'import { user } from "@/pages/system/user/user-service";\n',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not depend on UI/);
});
test("rejects direct HTTP in pages and removed UI wrappers", (t) => {
    const result = fixture(t, {
        "admin-web/src/pages/system/user/user-page.tsx":
            'fetch("/api"); export const Page = () => <PretzelTable />;\n',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /HTTP requests belong/);
    assert.match(result.stderr, /official Pro Components/);
});
test("rejects stale Java package registration and mismatched source paths", (t) => {
    const result = fixture(t, {
        "backend/src/main/java/com/thundax/pretzel/Sample.java":
            "package com.thundax.pretzel.configure; public class Sample {}\n",
        "backend/src/main/resources/META-INF/spring/AutoConfiguration.imports":
            "com.thundax.pretzel.common.web.configure.WebConfiguration\n",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source directory must match/);
    assert.match(result.stderr, /registration references an old package/);
});
test("rejects cross references in document leaves", (t) => {
    const result = fixture(t, {
        "docs/00-governance/NAMING-RULES.md": "[其他规范](README.md)\n",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /leaf documents/);
});
