import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function assertTextureExists(folder, name) {
    const resource = name.replace(/\/texture$/, "");
    assert.ok(
        [".jpg", ".png"].some((extension) =>
            existsSync(
                new URL(
                    `../assets/${folder}/${resource}${extension}`,
                    import.meta.url,
                ),
            ),
        ),
        `Missing texture in ${folder}: ${resource}`,
    );
}

function fixture(failure, allowHome = false) {
    const requested = [];
    let releaseHome;
    class SpriteFrame {
        reset(options) {
            Object.assign(this, options);
        }
    }
    const cc = {
        SpriteFrame,
        Texture2D: class {},
        Rect: class {},
        Size: class {},
        resources: {
            load(name, type, callback) {
                assertTextureExists("resources", name);
                requested.push(name);
                callback(failure, { width: 750, height: 1334 });
            },
        },
        assetManager: {
            loadBundle(name, callback) {
                assert.ok(
                    allowHome,
                    "Loading artwork must not wait for a subpackage",
                );
                assert.equal(name, "home");
                releaseHome = () =>
                    callback(null, {
                        load(name, type, complete) {
                            assertTextureExists("home", name);
                            complete(null, { width: 750, height: 1334 });
                        },
                    });
            },
        },
    };
    const source = readFileSync(
        new URL("../assets/scripts/services/artwork.ts", import.meta.url),
        "utf8",
    );
    const exports = {};
    runInNewContext(
        ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText,
        {
            exports,
            require: (name) => (name === "cc" ? cc : { ANIMAL_KIND_COUNT: 20 }),
        },
    );
    return {
        requested,
        load: exports.loadLoadingArtwork,
        loadGame: exports.loadZooArtwork,
        releaseHome: () => releaseHome(),
    };
}

test("loading artwork resolves from main-package resources without home subpackage", async () => {
    const { requested, load } = fixture();
    const art = await load();
    assert.deepEqual(requested, [
        "home-loading/background/texture",
        "home-loading/age-rating/texture",
    ]);
    assert.ok(art.background.texture);
    assert.ok(art.ageRating.texture);
});

test("loading artwork propagates image failures to the retry UI", async () => {
    const failure = new Error("image unavailable");
    await assert.rejects(fixture(failure).load(), (error) => error === failure);
});

test("progress waits for the home bundle and reaches completion after its textures", async () => {
    const state = fixture(undefined, true);
    const progress = [];
    const pending = state.loadGame((value) => progress.push(value));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(progress[0], 0);
    assert.equal(progress.at(-1), 10 / 27);
    state.releaseHome();
    await pending;
    assert.equal(progress.length, 28);
    assert.equal(progress.at(-1), 1);
    assert.ok(
        progress.every(
            (value, index) => index === 0 || value > progress[index - 1],
        ),
    );
});
