import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { generate } from "./levels.mjs";
import { aggregate, verify } from "./experiment.mjs";
import { readJSON, writeJSON, readJournal } from "./io.mjs";
const dir = path.dirname(fileURLToPath(import.meta.url)),
    cli = path.join(dir, "level-design.mjs"),
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pretzel-mjs-")),
    input = path.join(tmp, "input.json");
writeJSON(input, { levels: [generate(341)] });
const invoke = (output, ...args) =>
    spawnSync(
        process.execPath,
        [
            cli,
            "run",
            "--input",
            input,
            "--output",
            output,
            "--max-seconds",
            "30",
            ...args,
        ],
        { encoding: "utf8", timeout: 40000 },
    );
const complete = path.join(tmp, "complete"),
    initial = invoke(complete, "--repeats", "2");
assert.equal(initial.status, 0, initial.stderr);
const report = (p) => readJSON(path.join(p, "report.json"));
function copied(name) {
    const p = path.join(tmp, name);
    fs.cpSync(complete, p, { recursive: true });
    return p;
}
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
test("complete plan produces and independently verifies six runs", () => {
    assert.equal(report(complete).completed_runs, 6);
    assert.equal(verify(complete).verified_runs, 6);
    assert.ok(fs.readFileSync(path.join(complete, "REPORT.md"), "utf8").length);
});
test("run budget preserves completed cases and explicitly missing groups", () => {
    const p = path.join(tmp, "run-limit"),
        r = invoke(p, "--max-runs", "1");
    assert.equal(r.status, 2, r.stderr);
    const d = report(p);
    assert.equal(d.stop_reason, "max_runs");
    assert.equal(d.completed_runs, 1);
    assert.ok(d.groups.some((g) => g.metrics === null));
    assert.equal(verify(p).coverage_status, "budget_stopped");
});
test("hard timeout produces an honest zero-coverage report", () => {
    const p = path.join(tmp, "timeout"),
        r = invoke(p, "--max-seconds", "0.001");
    assert.equal(r.status, 2, r.stderr);
    assert.equal(report(p).completed_runs, 0);
    assert.equal(verify(p).verified_runs, 0);
});
test("only a timeout permits an incomplete final journal line", () => {
    const p = copied("partial");
    fs.appendFileSync(path.join(p, "journal.jsonl"), '{"type":"run",');
    aggregate(p, "max_seconds", null, 1);
    assert.equal(verify(p).verified_runs, 6);
    assert.throws(() => readJournal(p));
});
test("partial coverage cannot be called complete", () => {
    const p = path.join(tmp, "lying");
    invoke(p, "--max-runs", "1");
    const d = report(p);
    d.status = "complete";
    writeJSON(path.join(p, "report.json"), d);
    assert.throws(() => verify(p));
});
test("input and statistics tampering are rejected", () => {
    let p = copied("stats"),
        d = report(p);
    d.groups[0].metrics.win_percent++;
    writeJSON(path.join(p, "report.json"), d);
    assert.throws(() => verify(p));
    p = copied("input-changed");
    fs.appendFileSync(path.join(p, "input.json"), " ");
    assert.throws(() => verify(p));
});
test("layout summary tampering is rejected", () => {
    const p = copied("layout"),
        d = report(p);
    d.layout_metrics[0].metrics.layers++;
    writeJSON(path.join(p, "report.json"), d);
    assert.throws(() => verify(p));
});
test("source snapshots verify without the checkout and contain no Python", () => {
    const snapshot = path.join(complete, "source");
    assert.ok(fs.readdirSync(snapshot).every((n) => n.endsWith(".mjs")));
    const r = spawnSync(
        process.execPath,
        [
            path.join(snapshot, "level-design.mjs"),
            "verify",
            "--output",
            complete,
        ],
        { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr);
});
test("output cannot be overwritten and invalid budgets create no evidence directory", () => {
    assert.notEqual(invoke(complete).status, 0);
    const p = path.join(tmp, "nan");
    assert.notEqual(invoke(p, "--max-seconds", "NaN").status, 0);
    assert.equal(fs.existsSync(p), false);
});
test("bad source produces an error report and captured reason", () => {
    const p = path.join(tmp, "bad-source"),
        bad = path.join(tmp, "dup.json");
    const d = readJSON(input);
    d.levels.push(d.levels[0]);
    writeJSON(bad, d);
    const r = invoke(p, "--input", bad);
    assert.equal(r.status, 1);
    assert.equal(report(p).status, "error");
    assert.match(
        fs.readFileSync(path.join(p, "worker.stderr"), "utf8"),
        /duplicate identity/,
    );
});
test("variant input order stays stable for numeric variant labels", () => {
    const data = readJSON(
            path.resolve(
                dir,
                "../../../../docs/30-designs/assets/level-pack-v1/height-study/variants.json",
            ),
        ),
        p = path.join(tmp, "order"),
        file = path.join(tmp, "reverse.json");
    writeJSON(file, [data[20], data[0]]);
    const r = invoke(
        p,
        "--input",
        file,
        "--per-variant",
        "1",
        "--repeats",
        "1",
        "--scenarios",
        "no-tools",
    );
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(
        report(p).groups.map((g) => g.variant),
        ["6", "4"],
    );
    assert.equal(verify(p).verified_runs, 2);
});
test("generated layouts can be imported and CLI output is not overwritten", () => {
    const p = path.join(tmp, "generated"),
        r = spawnSync(
            process.execPath,
            [cli, "generate", "--boards", "1", "--output", p],
            { encoding: "utf8" },
        );
    assert.equal(r.status, 0, r.stderr);
    assert.equal(readJSON(path.join(p, "levels.json")).levels.length, 1);
    const again = spawnSync(
        process.execPath,
        [cli, "generate", "--output", p],
        { encoding: "utf8" },
    );
    assert.notEqual(again.status, 0);
});
