import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { clone, range } from "./catalog.mjs";
import {
    generate,
    pairedPrototypes,
    checkLevel,
    importLevels,
    structureMetrics,
} from "./levels.mjs";
import {
    stackPositions,
    stackMetrics,
    validateStack,
    footprintArea,
    STACK_PROFILES,
} from "./stack-layouts.mjs";
import { svgFor, writeStackPreview } from "./preview.mjs";
import { geometry } from "./geometry.mjs";
import { play } from "./simulation.mjs";
import { replay } from "./replay.mjs";
const base = generate(341, "aligned-control"),
    prototypes = pairedPrototypes([base]);
const cli = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "level-design.mjs",
);

test("paired prototypes discard source blockers when replacing coordinates", () => {
    for (const original of [generate(341), base]) {
        const source = { ...clone(original), blockers: geometry(original) };
        const before = clone(source);
        const imported = importLevels([source]);
        const derived = pairedPrototypes(imported);
        assert.equal(derived.length, STACK_PROFILES.length);
        assert.deepEqual(derived, pairedPrototypes([original]));
        assert.deepEqual(importLevels(derived), derived);
        for (const level of derived) {
            assert.equal(Object.hasOwn(level, "blockers"), false);
            checkLevel(level);
        }
        assert.deepEqual(source, before);
        assert.deepEqual(imported, [before]);
    }
});
test("one covers two using a half-card shift", () =>
    assert.equal(
        stackMetrics([
            [0, 0, 0],
            [1, 0, 0],
            [0.5, 0, 1],
        ]).one_covers_two,
        1,
    ));
test("one covers four lower corners with a half shift in both axes", () =>
    assert.equal(
        stackMetrics([
            [0, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
            [0.5, 0.5, 1],
        ]).one_covers_four,
        1,
    ));
test("four upper cards can cover one central lower card", () => {
    const lower = range(3).flatMap((y) => range(3).map((x) => [x, y, 0])),
        upper = [
            [0.5, 0.5, 1],
            [1.5, 0.5, 1],
            [0.5, 1.5, 1],
            [1.5, 1.5, 1],
        ];
    assert.equal(stackMetrics([...lower, ...upper]).four_cover_one, 1);
});
test("a single overlapping quarter cell supports an upper tile", () =>
    assert.equal(
        validateStack([
            [0, 0, 0],
            [0.5, 0.5, 1],
        ]),
        true,
    ));
test("edge-only contact and missing lower planes do not provide support", () => {
    assert.throws(() =>
        validateStack([
            [0, 0, 0],
            [1, 0, 1],
        ]),
    );
    assert.throws(() =>
        validateStack([
            [0, 0, 0],
            [0, 0, 2],
        ]),
    );
});
test("same-layer interpenetration and quarter-card offsets are rejected", () => {
    assert.throws(() =>
        validateStack([
            [0, 0, 0],
            [0.5, 0, 0],
        ]),
    );
    assert.throws(() =>
        validateStack([
            [0, 0, 0],
            [0.25, 0, 1],
        ]),
    );
});
test("all profiles keep 48 whole cards, same layers and same footprint area", () => {
    let layers;
    for (const p of STACK_PROFILES) {
        const positions = stackPositions(p);
        assert.equal(positions.length, 48);
        validateStack(positions);
        assert.equal(footprintArea(positions), 24);
        const distribution = range(7).map(
            (z) => positions.filter((c) => c[2] === z).length,
        );
        layers ??= distribution;
        assert.deepEqual(distribution, layers);
    }
});
test("control has no branching cover, pair has no four-way, mixed has all three", () => {
    const control = stackMetrics(stackPositions("aligned-control")),
        pair = stackMetrics(stackPositions("pair-bridges")),
        mixed = stackMetrics(stackPositions("mixed-bridges"));
    assert.equal(control.maximum_adjacent_fanout, 1);
    assert.equal(control.many_cover_one, 0);
    assert.ok(pair.one_covers_two);
    assert.equal(pair.one_covers_four, 0);
    assert.ok(
        mixed.one_covers_two &&
            mixed.one_covers_four &&
            mixed.many_cover_one &&
            mixed.four_cover_one,
    );
});
test("paired shapes preserve exact card IDs, animals, questions, reference groups and seed", () => {
    for (const p of prototypes) {
        assert.equal(p.cards.length, 48);
        assert.equal(p.targets.length, 12);
        assert.equal(p.seed, base.seed);
        assert.deepEqual(p.cards, base.cards);
        assert.deepEqual(p.targets, base.targets);
        assert.deepEqual(p.reference, base.reference);
        assert.equal(p.layout_grid.step, 0.5);
        checkLevel(p);
    }
});
test("tampered pairing and invalid grid metadata are rejected", () => {
    const bad = clone(prototypes);
    bad[1].pair_id = bad[0].pair_id;
    bad[1].seed++;
    assert.throws(() => importLevels({ levels: bad }));
    const wrong = clone(prototypes[0]);
    wrong.layout_grid.step = 0.25;
    assert.throws(() => checkLevel(wrong));
});
test("generator can directly produce each mixed profile", () => {
    for (const profile of STACK_PROFILES) {
        const level = generate(77, profile);
        assert.equal(level.cards.length, 48);
        assert.equal(level.layout_grid.card_footprint_cells[0], 2);
        checkLevel(level);
    }
});
test("each prototype supports independent no-tool and tool replay", () => {
    for (const level of prototypes)
        for (const mode of ["none", "enhanced"])
            replay(level, play(level, 10, { mode }));
});
test("area uses actual rectangle union rather than counting offset anchors", () => {
    assert.equal(
        footprintArea([
            [0, 0, 0],
            [0.5, 0.5, 1],
        ]),
        1.75,
    );
    const m = structureMetrics(
        prototypes.find((l) => l.profile === "quad-bridges"),
    );
    assert.equal(m.footprint_area, 24);
    assert.notEqual(m.footprint, m.footprint_area);
    assert.equal(m.average_height, 2);
});
test("preview renders whole-card identities and layer filtering", () => {
    const all = svgFor(prototypes[0]);
    assert.equal((all.match(/data-card-id=/g) ?? []).length, 48);
    const bottom = svgFor(prototypes[0], 0);
    assert.equal((bottom.match(/data-card-id=/g) ?? []).length, 24);
});
test("self-contained preview executes layer and cell controls", () => {
    const tmp = fs.mkdtempSync(
        path.join(os.tmpdir(), "pretzel-stack-preview-"),
    );
    try {
        writeStackPreview(tmp, prototypes);
        const html = fs.readFileSync(path.join(tmp, "PREVIEW.html"), "utf8"),
            script = html.match(/<script>([\s\S]*)<\/script>/)[1];
        const layer = { value: "0" },
            cells = { checked: true },
            label = {},
            divs = prototypes.map(() => ({ innerHTML: "" }));
        const document = {
            querySelector: (s) =>
                ({ "#layer": layer, "#cells": cells, "#layerText": label })[s],
            querySelectorAll: () => divs,
        };
        vm.runInNewContext(script, { document });
        layer.oninput();
        assert.equal(label.textContent, 1);
        assert.ok(
            divs.every(
                (d) =>
                    (d.innerHTML.match(/data-card-id=/g) ?? []).length === 24,
            ),
        );
        cells.checked = false;
        cells.onchange();
        assert.ok(
            divs.every((d) => !d.innerHTML.includes('stroke-dasharray="2 2"')),
        );
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
test("prototype CLI creates paired data and preview within explicit candidate bound", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pretzel-stack-cli-"));
    try {
        const output = path.join(tmp, "out"),
            result = spawnSync(
                process.execPath,
                [
                    cli,
                    "prototype",
                    "--boards",
                    "1",
                    "--seed",
                    "341",
                    "--output",
                    output,
                ],
                { encoding: "utf8" },
            );
        assert.equal(result.status, 0, result.stderr);
        const data = JSON.parse(
            fs.readFileSync(path.join(output, "levels.json")),
        );
        assert.equal(data.levels.length, 4);
        assert.ok(fs.existsSync(path.join(output, "PREVIEW.html")));
        const bad = spawnSync(
            process.execPath,
            [
                cli,
                "prototype",
                "--boards",
                "2",
                "--max-candidates",
                "7",
                "--output",
                path.join(tmp, "bad"),
            ],
            { encoding: "utf8" },
        );
        assert.notEqual(bad.status, 0);
        assert.equal(fs.existsSync(path.join(tmp, "bad")), false);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
});
