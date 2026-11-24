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
        "miniprograms/sample-game/package.json": "{}\n",
        "miniprograms/sample-game/assets/scenes/start.scene": "[]\n",
        ...entries,
    };
    for (const [name, text] of Object.entries(files)) {
        if (text === null) continue;
        const file = path.join(root, name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
    }
    return spawnSync(process.execPath, [checker, root], { encoding: "utf8" });
}

test("accepts a tree of documents and a game application", (t) => {
    assert.equal(fixture(t).status, 0);
});

test("accepts kebab-case directories and skips tool-managed directories", (t) => {
    const result = fixture(t, {
        "miniprograms/sample-game/cloud-functions/sample-function/index.js": "",
        "miniprograms/sample-game/build/generatedDirectory/index.js": "",
        "node_modules/vendorPackage/index.js": "",
        ".idea/shelf/LocalChanges/data.xml": "",
        ".agents/skills/sample-skill/SKILL.md": "",
    });
    assert.equal(result.status, 0, result.stderr);
});

test("rejects non-kebab-case custom directories at every depth", (t) => {
    const invalidNames = [
        "customDirectory",
        "custom_directory",
        "Custom-directory",
        "custom--directory",
        "custom.directory",
        "custom directory",
    ];
    const entries = Object.fromEntries([
        ["RootDirectory/index.js", ""],
        ...invalidNames.map((name) => [
            `miniprograms/sample-game/assets/scripts/${name}/index.js`,
            "",
        ]),
    ]);
    const result = fixture(t, entries);
    assert.equal(result.status, 1);
    for (const name of ["RootDirectory", ...invalidNames]) {
        assert.ok(
            result.stderr.includes(
                `${name}: use kebab-case custom directory names`,
            ),
            result.stderr,
        );
    }
});

test("checks game names and required Cocos project paths", (t) => {
    const result = fixture(t, {
        "miniprograms/Bad_Project/package.json": "{}\n",
        "miniprograms/missing-manifest/assets/scenes/start.scene": "[]\n",
        "miniprograms/missing-scenes/package.json": "{}\n",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Bad_Project: use a kebab-case game directory/);
    assert.match(result.stderr, /missing-manifest: missing game package\.json/);
    assert.match(result.stderr, /missing-scenes: missing Cocos assets\/scenes/);
});

test("accepts lowercase kebab-case Cocos asset and sidecar filenames", (t) => {
    const result = fixture(t, {
        "miniprograms/sample-game/assets/home/animals-action-01.png": "",
        "miniprograms/sample-game/assets/home/animals-action-01.png.meta": "",
        "miniprograms/sample-game/assets/home.meta": "",
        "miniprograms/sample-game/assets/resources/shared/button-press.mp3": "",
        "miniprograms/sample-game/assets/scripts/creator-env.d.ts": "",
        "miniprograms/sample-game/assets/.DS_Store": "",
        "miniprograms/sample-game/build/Generated_Asset.png": "",
    });
    assert.equal(result.status, 0, result.stderr);
});

test("game images use PNG or SVG, including packaged share images", (t) => {
    const files = {
        "miniprograms/sample-game/assets/art/table.png": "",
        "miniprograms/sample-game/assets/art/tile.svg": "",
        "miniprograms/sample-game/assets/art/tile.svg.meta": "",
        "miniprograms/sample-game/share/game-invite.png": "",
        "miniprograms/sample-game/build/generated.jpg": "",
        "docs/00-governance/assets/screenshot.jpg": "",
    };
    assert.equal(fixture(t, files).status, 0);

    const result = fixture(t, {
        ...files,
        "miniprograms/sample-game/assets/art/table.jpg": "",
        "miniprograms/sample-game/assets/art/table.jpg.meta": "",
        "miniprograms/sample-game/assets/art/tile.webp": "",
        "miniprograms/sample-game/share/game-invite.jpeg": "",
    });
    assert.equal(result.status, 1);
    for (const name of [
        "table.jpg",
        "table.jpg.meta",
        "tile.webp",
        "game-invite.jpeg",
    ]) {
        assert.ok(
            result.stderr.includes(`${name}: use .png or .svg for game images`),
            result.stderr,
        );
    }
});

test("rejects non-kebab-case Cocos asset and sidecar filenames", (t) => {
    const names = [
        "tileMatch.mp3",
        "tile_match.png",
        "Tile-match.png.meta",
        "tile-match.PNG",
    ];
    const result = fixture(
        t,
        Object.fromEntries(
            names.map((name) => [
                `miniprograms/sample-game/assets/art/${name}`,
                "",
            ]),
        ),
    );
    assert.equal(result.status, 1);
    for (const name of names) {
        assert.ok(
            result.stderr.includes(
                `${name}: use lowercase kebab-case Cocos asset filenames`,
            ),
            result.stderr,
        );
    }
});

test("rejects Cocos scenes outside a direct game directory", (t) => {
    const result = fixture(t, {
        "apps/other-game/assets/scenes/start.scene": "[]\n",
        "miniprograms/sample-game/nested/assets/scenes/start.scene": "[]\n",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /other-game: place Cocos game applications/);
    assert.match(result.stderr, /nested: place Cocos game applications/);
});

test("requires the document navigation entry", (t) => {
    const result = fixture(t, { "docs/README.md": null });
    assert.equal(result.status, 1);
    assert.match(
        result.stderr,
        /README\.md: missing document navigation entry/,
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

test("validates inline local images without adding document navigation", (t) => {
    const page = {
        "docs/00-governance/NAMING-RULES.md": "![示例](assets/EXAMPLE.png)\n",
    };
    const image = "docs/00-governance/assets/EXAMPLE.png";
    assert.equal(fixture(t, { ...page, [image]: "sample image" }).status, 0);
    const missing = fixture(t, page);
    assert.equal(missing.status, 1);
    assert.match(
        missing.stderr,
        /missing document target: assets\/EXAMPLE.png/,
    );
    assert.doesNotMatch(missing.stderr, /leaf documents/);
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
