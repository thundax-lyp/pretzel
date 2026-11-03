import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ANIMALS, TOOLS, PROFILES, clone, range, same } from "./catalog.mjs";
import { available, geometry, overlaps, clippedArea } from "./geometry.mjs";
import { Game } from "./game.mjs";
import { generate, checkLevel, importLevels } from "./levels.mjs";
import {
    allocation,
    repairLayout,
    questionPaths,
    selectLevel,
    play,
} from "./simulation.mjs";
import { replay } from "./replay.mjs";
import { Random } from "./catalog.mjs";
const project = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../../..",
    ),
    assets = path.join(project, "docs/30-designs/assets/level-pack-v1");
const native = generate(341),
    data = JSON.parse(
        fs.readFileSync(path.join(assets, "height-study/variants.json")),
    ),
    pack = JSON.parse(fs.readFileSync(path.join(assets, "levels.json")));
const top = (g) => available(g.level, g.board, g.locations);
function fixture(target = [100, 100], kind = 8) {
    const level = clone(native);
    level.cards = Array(48).fill(kind);
    level.targets[0] = target;
    return new Game(level);
}
const imported = importLevels(data);
test("generator is deterministic", () =>
    assert.deepEqual(generate(341), native));
test("all profiles have complete reference paths and six/eight initial choices", () => {
    for (const p of Object.keys(PROFILES)) {
        const l = generate(341, p);
        checkLevel(l);
        assert.ok([6, 8].includes(top(new Game(l)).length));
    }
});
test("content limits remain 12 species and 48 cards", () => {
    const q = new Map();
    for (const k of native.cards) q.set(k, (q.get(k) ?? 0) + 1);
    assert.equal(q.size, 12);
    assert.ok(Math.max(...q.values()) <= 6);
    assert.ok([2, 3, 4].includes(native.cards.filter((k) => k >= 20).length));
    assert.ok(native.cards.filter((k) => ANIMALS[k][2] % 2).length <= 8);
});
test("covered click does not mutate state", () => {
    const g = new Game(native),
        before = clone(g),
        i = range(48).find((i) => !top(g).includes(i));
    assert.throws(() => g.take(i));
    assert.deepEqual(clone(g), before);
});
test("duplicate click is rejected", () => {
    const g = fixture(),
        i = top(g)[0];
    g.take(i);
    assert.throws(() => g.take(i));
});
test("seventh matching card clears before failure", () => {
    const g = fixture([7, 0]);
    for (let n = 0; n < 7; n++) g.take(top(g)[0]);
    assert.equal(g.q, 1);
    assert.equal(g.status, "playing");
});
test("seventh unmatched card fails and cannot use or grant tools", () => {
    const g = fixture();
    g.grant("remove");
    for (let n = 0; n < 7; n++) g.take(top(g)[0]);
    const before = clone(g);
    assert.equal(g.status, "failed");
    assert.throws(() => g.remove(g.slot.slice(0, 3)));
    assert.throws(() => g.grant("rewind"));
    assert.deepEqual(clone(g), before);
});
test("matching subset cannot clear the whole slot", () => {
    const g = fixture([2, 2], 4),
        [a, b] = top(g);
    g.level.cards[b] = 2;
    g.take(a);
    g.take(b);
    assert.equal(g.q, 0);
    assert.equal(g.slot.length, 2);
});
test("removing a card can make remaining whole slot match", () => {
    const g = fixture([2, 2], 4),
        [a, b] = top(g);
    g.level.cards[b] = 2;
    g.take(a);
    g.take(b);
    g.grant("remove");
    g.remove([a]);
    assert.equal(g.q, 1);
    assert.deepEqual(g.temp, [a]);
});
test("invalid removal retains acquired tool", () => {
    const g = new Game(native);
    g.grant("remove");
    for (const ids of [[], [999], [0, 0]]) assert.throws(() => g.remove(ids));
    assert.equal(g.inventory.remove, 1);
});
test("temporary area exceeds twelve and returns the same instance", () => {
    const g = fixture();
    for (let n = 0; n < 5; n++) {
        const ids = [];
        for (let k = 0; k < 3; k++) {
            const i = top(g)[0];
            ids.push(i);
            g.take(i);
        }
        g.grant("remove");
        g.remove(ids);
    }
    assert.equal(g.temp.length, 15);
    const i = g.temp[0];
    g.take(i);
    assert.equal(g.temp.includes(i), false);
    assert.deepEqual(g.slot, [i]);
});
test("video allowance is shared across tool types", () => {
    const g = new Game(native);
    for (let n = 0; n < 10; n++) g.grant(TOOLS[n % 3]);
    assert.throws(() => g.grant("remove"));
    assert.equal(g.ads, 10);
});
test("reserve is one per type and costs no video", () => {
    const g = new Game(native, 1);
    g.grant("shuffle", "reserve");
    assert.equal(g.ads, 0);
    assert.throws(() => g.grant("shuffle", "reserve"));
});
test("rewind restores cards without restoring reserve or video counts", () => {
    const g = new Game(native, 1),
        before = g.snapshot();
    for (const i of native.reference[0]) g.take(i);
    g.grant("rewind", "reserve");
    g.rewind(1);
    assert.deepEqual(g.snapshot(), before);
    assert.equal(g.reserves.rewind, 0);
    for (const i of native.reference[0]) g.take(i);
    g.grant("rewind");
    g.rewind(1);
    assert.equal(g.ads, 1);
    assert.equal(g.inventory.rewind, 0);
});
test("no history means invalid rewind", () => {
    const g = new Game(native);
    g.grant("rewind");
    assert.throws(() => g.rewind(1));
    assert.equal(g.inventory.rewind, 1);
});
test("invalid or unchanged shuffle does not consume inventory", () => {
    const g = new Game(native);
    g.grant("shuffle");
    assert.throws(() => g.shuffle(Array(48).fill(0)));
    assert.throws(() => g.shuffle(g.locations));
    assert.equal(g.inventory.shuffle, 1);
});
test("certified complete repack conserves cards and wins", () => {
    const g = new Game(native),
        plan = allocation(g),
        fixed = repairLayout(g, plan.route);
    assert.equal(new Set(fixed.paths.flat()).size, 48);
    g.locations = fixed.positions;
    for (const group of fixed.paths) for (const i of group) g.take(i);
    assert.equal(g.status, "won");
});
test("zero numeric search budget yields unknown, not no-solution proof", () => {
    const g = new Game(native);
    g.take(native.reference[0][0]);
    const result = allocation(g, 0);
    assert.equal(result.route, null);
    assert.equal(result.unknown, true);
});
test("card IDs above 31 survive search bitmasks", () => {
    const g = new Game(native);
    g.board = new Set([47]);
    g.level = clone(g.level);
    const [, e, l] = ANIMALS[g.level.cards[47]];
    g.level.targets[0] = [e, l];
    assert.deepEqual(questionPaths(g, new Random(1)).paths, [[47]]);
});
test("simulation is reproducible and independent replay catches result changes", () => {
    const a = play(native, 0);
    assert.deepEqual(a, play(native, 0));
    replay(native, a);
    const corrupt = clone(a);
    corrupt.ads++;
    assert.throws(() => replay(native, corrupt));
});
test("timing assumptions do not change decisions", () => {
    const a = play(native, 0, { mode: "none" }),
        b = play(native, 0, { mode: "none", timing: [5, 20, 16, 3] });
    assert.deepEqual(a.events, b.events);
    assert.equal(b.estimated_play_seconds, 2 * a.estimated_play_seconds);
});
test("automatic picks outside recovery are rejected", () => {
    const r = play(native, 0, { mode: "none" });
    r.events.find((e) => e.type === "take").automatic = true;
    assert.throws(() => replay(native, r));
});
test("real-layout recovery automatically replays only completed progress and validates certificate", () => {
    let found;
    for (const l of imported.slice(0, 4)) {
        for (let n = 0; n < 4; n++) {
            const r = play(l, n);
            if (r.tools.rewind) {
                found = [l, r];
                break;
            }
        }
        if (found) break;
    }
    assert.ok(found);
    const [level, r] = found;
    assert.ok(r.automatic_questions > 0);
    replay(level, r);
    const bad = clone(r);
    bad.events.find((e) => e.type === "rewind").certificate[0] = [999];
    assert.throws(() => replay(level, bad));
});
test("all 80 existing layouts preserve exact positions, animals, questions and references", () => {
    assert.equal(imported.length, 80);
    assert.equal(new Set(imported.map((l) => l.source_id)).size, 80);
    for (let i = 0; i < 80; i++) {
        const raw = data[i].level,
            l = imported[i];
        assert.deepEqual(
            l.positions,
            raw.cards.map((c) => [c.x, c.y, c.z]),
        );
        assert.deepEqual(
            l.cards,
            raw.cards.map((c) => c.animal),
        );
        assert.deepEqual(
            l.targets,
            raw.targets.map((t) => [t.eyes, t.legs]),
        );
        assert.deepEqual(l.reference, raw.reference);
        assert.deepEqual(geometry(l), raw.blockers);
    }
});
test("same seed across variants remains separate by source identity", () =>
    assert.ok(new Set(imported.map((l) => l.seed)).size < imported.length));
test("native import roundtrips both models", () => {
    assert.deepEqual(importLevels({ levels: [native, imported[0]] }), [
        native,
        imported[0],
    ]);
});
test("native import preserves matching source blockers in both models", () => {
    for (const original of [native, imported[0]]) {
        const level = { ...clone(original), blockers: geometry(original) };
        assert.deepEqual(importLevels([level]), [level]);
        assert.deepEqual(importLevels({ levels: [level] }), [level]);
    }
});
test("native input rejects inconsistent or malformed source blockers", () => {
    for (const original of [native, imported[0]]) {
        const blockers = geometry(original);
        assert.ok(blockers.some((row) => row.length));
        const missingEdge = clone(blockers);
        missingEdge.find((row) => row.length).pop();
        for (const invalid of [
            range(48).map(() => []),
            missingEdge,
            [],
            null,
        ]) {
            const level = { ...clone(original), blockers: invalid };
            assert.throws(() => checkLevel(level), /source covering disagrees/);
            assert.throws(
                () => importLevels([level]),
                /source covering disagrees/,
            );
            assert.throws(
                () => importLevels({ levels: [level] }),
                /source covering disagrees/,
            );
        }
    }
});
test("catalog reorder maps animals without changing meaning", () => {
    const copy = clone(pack),
        original = importLevels(copy);
    copy.animals.reverse();
    for (const p of copy.packs)
        for (const c of p.hard.cards) c.animal = 23 - c.animal;
    assert.deepEqual(importLevels(copy), original);
});
test("source cover mismatch is rejected", () => {
    const d = clone(data.slice(0, 1));
    d[0].level.blockers = range(48).map(() => []);
    assert.throws(() => importLevels(d));
});
test("source layer metadata mismatch is rejected", () => {
    const d = clone(data.slice(0, 1));
    d[0].level.layers = 99;
    assert.throws(() => importLevels(d));
});
test("candidate limit never silently truncates input", () =>
    assert.throws(() => importLevels(data, 79)));
test("unknown animal, duplicate identity and invalid coordinates are rejected", () => {
    assert.throws(() => importLevels([native, native]));
    let d = clone([native]);
    d[0].positions[0][0] = NaN;
    assert.throws(() => importLevels(d));
    d = clone(data.slice(0, 1));
    d[0].level.cards[0].animal = -1;
    assert.throws(() => importLevels(d));
});
test("touching boundaries do not overlap under both independent algorithms", () => {
    const a = [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
        ],
        b = [
            [1, 0],
            [2, 0],
            [2, 1],
            [1, 1],
        ],
        c = [
            [0.5, 0],
            [1.5, 0],
            [1.5, 1],
            [0.5, 1],
        ];
    assert.equal(overlaps(a, b), false);
    assert.equal(clippedArea(a, b), 0);
    assert.equal(overlaps(a, c), true);
    assert.equal(clippedArea(a, c), 0.5);
});
test("visibility models stay isolated across runs", () => {
    const expected = geometry(native);
    assert.ok(same(geometry(imported[0]), geometry(imported[0], true)));
    replay(imported[0], play(imported[0], 10));
    assert.deepEqual(geometry(native), expected);
});

test("challenge calibration records independent repeats and stops within candidate budget", () => {
    const result = selectLevel(
        12,
        "three-peaks",
        "balanced",
        "challenging",
        60,
    );
    assert.deepEqual(result.selection.calibration_repeats, [-3, -2, -1]);
    assert.equal(result.selection.candidates.at(-1).wins, 0);
    assert.ok(result.selection.candidates.length <= 60);
    checkLevel(result.level);
});
