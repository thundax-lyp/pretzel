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
        "docs/README.md": "[命名](00-governance/NAMING-RULES.md)\n",
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

test("accepts a tree of documents and a game application", (t) => {
    assert.equal(
        fixture(t, {
            "miniprograms/sample-game/package.json": "{}\n",
        }).status,
        0,
    );
});
test("rejects retired frontend application locations", (t) => {
    const result = fixture(t, {
        "admin-web/package.json": "{}\n",
        "frontend/admin/package.json": "{}\n",
        "miniprogram/app.json": "{}\n",
        "frontend/miniprograms/old-game/package.json": "{}\n",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /frontend: place game applications/);
});
test("rejects cross references in document leaves", (t) => {
    const result = fixture(t, {
        "docs/00-governance/NAMING-RULES.md": "[其他规范](../README.md)\n",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /leaf documents/);
});

test("keeps human work materials outside the navigation", (t) => {
    const draft = { "docs/60-human/DRAFT.md": "# Draft\n" };
    assert.equal(fixture(t, draft).status, 0);
    const indexed = fixture(t, {
        ...draft,
        "docs/README.md":
            "[命名](00-governance/NAMING-RULES.md)\n[草稿](60-human/DRAFT.md)\n",
    });
    assert.notEqual(indexed.status, 0);
    assert.match(indexed.stderr, /human work materials must stay out/);
});
