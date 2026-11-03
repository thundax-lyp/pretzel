import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { same, requireThat, counts } from "./catalog.mjs";
import {
    importLevels,
    checkLevel,
    structureMetrics,
    checkPairs,
} from "./levels.mjs";
import { play, summary } from "./simulation.mjs";
import { replay } from "./replay.mjs";
import {
    ROOT,
    readJSON,
    writeJSON,
    sha,
    sources,
    newDirectory,
    emit,
    readJournal,
    checkSources,
} from "./io.mjs";
import { renderReport } from "./report.mjs";
export const SCENARIOS = {
    "no-tools": { mode: "none", reserve: 0 },
    "zero-reserve": { mode: "enhanced", reserve: 0 },
    "full-reserve": { mode: "enhanced", reserve: 1 },
};
const variant = (l) => (l.profile === "imported" ? l.curve : l.profile);
export function select(levels, config) {
    const grouped = new Map();
    for (const level of levels) {
        const v = variant(level);
        if (!config.variants.length || config.variants.includes(v)) {
            if (!grouped.has(v)) grouped.set(v, []);
            grouped.get(v).push(level);
        }
    }
    requireThat(
        grouped.size &&
            (!config.variants.length ||
                config.variants.every((v) => grouped.has(v))),
        "missing requested variant",
    );
    return [...grouped.values()].flatMap((g) => g.slice(0, config.per_variant));
}
export function worker(output) {
    const config = readJSON(path.join(output, "config.json"));
    requireThat(
        same(config.sources, sources()),
        "source changed before worker",
    );
    requireThat(
        !fs.existsSync(path.join(output, "journal.jsonl")),
        "worker journal already exists",
    );
    const levels = importLevels(
            readJSON(path.join(output, "input.json")),
            config.max_candidates,
        ),
        selected = select(levels, config),
        planned =
            selected.length *
            config.repeats *
            config.scenarios.length *
            config.policies.length;
    requireThat(Number.isSafeInteger(planned), "planned run count overflow");
    emit(output, {
        type: "import",
        validated_references: levels.length,
        paired_groups: checkPairs(selected),
        selected_levels: selected.map((l) => l.source_id),
        selected_variants: Object.fromEntries(
            selected.map((l) => [l.source_id, variant(l)]),
        ),
        planned_runs: planned,
    });
    for (const level of selected)
        emit(output, {
            type: "level",
            level,
            metrics: structureMetrics(level),
        });
    let completed = 0;
    for (const scenario of config.scenarios)
        for (const policy of config.policies)
            for (const level of selected)
                for (
                    let repeat = config.repeat_start;
                    repeat < config.repeat_start + config.repeats;
                    repeat++
                ) {
                    if (completed >= config.max_runs) {
                        emit(output, { type: "stop", reason: "max_runs" });
                        return;
                    }
                    const run = play(level, repeat, {
                        ...SCENARIOS[scenario],
                        policy,
                        adLimit: config.ad_limit,
                        timing: config.timing,
                    });
                    replay(level, run);
                    emit(output, {
                        type: "run",
                        source_id: level.source_id,
                        variant: variant(level),
                        scenario,
                        run,
                    });
                    completed++;
                }
    emit(output, { type: "stop", reason: "complete" });
}
export function aggregate(output, reason, returncode, elapsed) {
    const config = readJSON(path.join(output, "config.json")),
        events = readJournal(output, reason === "max_seconds"),
        meta = events.find((e) => e.type === "import") ?? {
            validated_references: 0,
            selected_levels: [],
            selected_variants: {},
            planned_runs: null,
        };
    const levels = events.filter((e) => e.type === "level"),
        records = events.filter((e) => e.type === "run"),
        stops = events.filter((e) => e.type === "stop");
    if (reason === "worker_exit")
        reason =
            returncode === 0 && stops.length
                ? stops.at(-1).reason
                : "worker_error";
    const status =
            reason === "complete"
                ? "complete"
                : ["max_runs", "max_seconds"].includes(reason)
                  ? "budget_stopped"
                  : "error",
        qty = counts(Object.values(meta.selected_variants)),
        groups = [];
    for (const v of new Set(Object.values(meta.selected_variants)))
        for (const scenario of config.scenarios)
            for (const policy of config.policies) {
                const values = records
                        .filter(
                            (r) =>
                                r.variant === v &&
                                r.scenario === scenario &&
                                r.run.policy === policy,
                        )
                        .map((r) => r.run),
                    expected = qty[v] * config.repeats;
                groups.push({
                    variant: v,
                    scenario,
                    policy,
                    expected_runs: expected,
                    completed_runs: values.length,
                    coverage_complete: values.length === expected,
                    metrics: values.length ? summary(values) : null,
                });
            }
    const journal = path.join(output, "journal.jsonl"),
        report = {
            status,
            stop_reason: reason,
            worker_returncode: returncode,
            elapsed_seconds: elapsed,
            config,
            validated_references: meta.validated_references,
            paired_groups: meta.paired_groups ?? [],
            selected_levels: meta.selected_levels,
            planned_runs: meta.planned_runs,
            completed_runs: records.length,
            layout_metrics: levels.map((e) => ({
                source_id: e.level.source_id,
                metrics: e.metrics,
            })),
            groups,
            journal_sha256: fs.existsSync(journal)
                ? sha(fs.readFileSync(journal))
                : null,
            evidence_scope:
                "fixed-input layout experiment, not unseen human validation",
        };
    writeJSON(path.join(output, "report.json"), report);
    renderReport(output, report);
    return report;
}
export async function runExperiment(args) {
    const output = path.resolve(args.output);
    requireThat(args.input, "--input required");
    for (const key of ["per-variant", "repeats", "max-candidates", "max-runs"])
        requireThat(
            Number.isSafeInteger(args[key]) && args[key] > 0,
            `invalid ${key}`,
        );
    requireThat(
        Number.isSafeInteger(args["repeat-start"]) &&
            Number.isFinite(args["max-seconds"]) &&
            args["max-seconds"] > 0 &&
            args["max-seconds"] <= 2147483,
        "invalid time or decision budget",
    );
    requireThat(
        Number.isInteger(args["ad-limit"]) &&
            args["ad-limit"] >= 0 &&
            args["ad-limit"] <= 10,
        "invalid video limit",
    );
    const scenarios = args.scenarios.split(","),
        policies = args.policies.split(","),
        variants = args.variants ? args.variants.split(",") : [],
        timing = args.timing.split(",").map(Number);
    requireThat(
        scenarios.length === new Set(scenarios).size &&
            scenarios.every((k) => SCENARIOS[k]) &&
            policies.length === new Set(policies).size &&
            policies.every((k) => ["current", "preview"].includes(k)) &&
            variants.length === new Set(variants).size,
        "unknown or duplicate scenario/policy/variant",
    );
    requireThat(
        timing.length === 4 &&
            timing.every((n) => Number.isFinite(n) && n >= 0),
        "invalid timing",
    );
    const input = fs.readFileSync(args.input);
    JSON.parse(input);
    newDirectory(output);
    fs.writeFileSync(path.join(output, "input.json"), input);
    fs.mkdirSync(path.join(output, "source"));
    const fingerprints = sources();
    for (const name of Object.keys(fingerprints))
        fs.copyFileSync(
            path.join(ROOT, name),
            path.join(output, "source", name),
        );
    const config = {
        variants,
        per_variant: args["per-variant"],
        repeats: args.repeats,
        repeat_start: args["repeat-start"],
        scenarios,
        policies,
        max_candidates: args["max-candidates"],
        max_runs: args["max-runs"],
        max_seconds: args["max-seconds"],
        ad_limit: args["ad-limit"],
        timing,
        input_sha256: sha(input),
        sources: fingerprints,
        rng_version: "sha256-xorshift32-v1",
    };
    writeJSON(path.join(output, "config.json"), config);
    const started = performance.now(),
        stderr = fs.openSync(path.join(output, "worker.stderr"), "w");
    let timedOut = false;
    const returncode = await new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [path.join(ROOT, "level-design.mjs"), "worker", "--output", output],
            { stdio: ["ignore", "ignore", stderr] },
        );
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, config.max_seconds * 1000);
        child.once("error", (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.once("close", (code) => {
            clearTimeout(timer);
            resolve(code);
        });
    });
    fs.closeSync(stderr);
    return aggregate(
        output,
        timedOut ? "max_seconds" : "worker_exit",
        returncode,
        (performance.now() - started) / 1000,
    );
}
export function verify(output) {
    const report = readJSON(path.join(output, "report.json")),
        config = readJSON(path.join(output, "config.json"));
    requireThat(same(config, report.config), "config changed");
    checkSources(output, config);
    const input = fs.readFileSync(path.join(output, "input.json"));
    requireThat(sha(input) === config.input_sha256, "input changed");
    const journal = path.join(output, "journal.jsonl");
    requireThat(
        (fs.existsSync(journal) ? sha(fs.readFileSync(journal)) : null) ===
            report.journal_sha256,
        "journal changed",
    );
    const events = readJournal(output, report.stop_reason === "max_seconds");
    if (report.planned_runs === null) {
        requireThat(
            report.status === "budget_stopped" &&
                report.stop_reason === "max_seconds" &&
                !events.length &&
                !report.completed_runs &&
                !report.validated_references &&
                !report.selected_levels.length &&
                !report.groups.length,
            "invalid early-stop coverage",
        );
        return { verified_runs: 0, coverage_status: report.status };
    }
    const imported = importLevels(JSON.parse(input), config.max_candidates),
        selected = select(imported, config),
        original = new Map(selected.map((l) => [l.source_id, l])),
        levels = new Map(),
        records = [],
        cases = new Set();
    requireThat(
        same(
            selected.map((l) => l.source_id),
            report.selected_levels,
        ) && report.validated_references === imported.length,
        "selection or reference count changed",
    );
    for (const e of events) {
        if (e.type === "level") {
            checkLevel(e.level);
            requireThat(
                original.has(e.level.source_id) &&
                    same(e.level, original.get(e.level.source_id)) &&
                    !levels.has(e.level.source_id),
                "layout differs from input",
            );
            requireThat(
                same(structureMetrics(e.level), e.metrics),
                "layout metrics changed",
            );
            levels.set(e.level.source_id, e.level);
        } else if (e.type === "run") {
            const level = levels.get(e.source_id),
                r = e.run;
            requireThat(level, "run without layout");
            const key = JSON.stringify([
                e.source_id,
                e.scenario,
                r.policy,
                r.repeat,
            ]);
            requireThat(!cases.has(key), "duplicate case");
            cases.add(key);
            requireThat(
                config.scenarios.includes(e.scenario) &&
                    config.policies.includes(r.policy) &&
                    Number.isInteger(r.repeat) &&
                    r.repeat >= config.repeat_start &&
                    r.repeat < config.repeat_start + config.repeats,
                "case outside plan",
            );
            const scenario = SCENARIOS[e.scenario];
            requireThat(
                r.mode === scenario.mode &&
                    r.reserve === scenario.reserve &&
                    r.seed === level.seed &&
                    r.ad_limit === config.ad_limit &&
                    e.variant === variant(level),
                "case config differs",
            );
            replay(level, r);
            const seconds = Number(
                (
                    r.card_clicks * config.timing[0] +
                    (r.questions_completed - r.automatic_questions) *
                        config.timing[1] +
                    Object.values(r.tools).reduce((a, b) => a + b, 0) *
                        config.timing[2] +
                    r.automatic_questions * config.timing[3]
                ).toFixed(1),
            );
            requireThat(
                r.estimated_play_seconds === seconds,
                "timing differs from config",
            );
            records.push(e);
        }
    }
    requireThat(
        same(report.paired_groups, checkPairs(selected)),
        "paired group metadata changed",
    );
    const planned =
        selected.length *
        config.repeats *
        config.scenarios.length *
        config.policies.length;
    requireThat(
        report.planned_runs === planned &&
            report.completed_runs === records.length,
        "coverage count changed",
    );
    const reason = report.stop_reason,
        status =
            reason === "complete"
                ? "complete"
                : ["max_runs", "max_seconds"].includes(reason)
                  ? "budget_stopped"
                  : "error";
    requireThat(report.status === status, "coverage status changed");
    const stops = events.filter((e) => e.type === "stop");
    if (status === "complete")
        requireThat(
            stops.at(-1)?.reason === "complete" &&
                records.length === planned &&
                levels.size === selected.length,
            "incomplete plan marked complete",
        );
    if (reason === "max_runs")
        requireThat(
            stops.at(-1)?.reason === "max_runs" &&
                records.length === config.max_runs,
            "run budget mismatch",
        );
    const expectedGroups = [];
    for (const v of new Set(selected.map(variant)))
        for (const scenario of config.scenarios)
            for (const policy of config.policies)
                expectedGroups.push([v, scenario, policy]);
    requireThat(
        report.groups.length === expectedGroups.length &&
            same(
                report.groups.map((g) => [g.variant, g.scenario, g.policy]),
                expectedGroups,
            ),
        "missing or duplicate group",
    );
    requireThat(
        same(
            report.layout_metrics,
            events
                .filter((e) => e.type === "level")
                .map((e) => ({
                    source_id: e.level.source_id,
                    metrics: e.metrics,
                })),
        ),
        "layout summary changed",
    );
    for (const g of report.groups) {
        const values = records
                .filter(
                    (e) =>
                        e.variant === g.variant &&
                        e.scenario === g.scenario &&
                        e.run.policy === g.policy,
                )
                .map((e) => e.run),
            expected =
                selected.filter((l) => variant(l) === g.variant).length *
                config.repeats;
        requireThat(
            g.expected_runs === expected &&
                g.completed_runs === values.length &&
                g.coverage_complete === (values.length === expected) &&
                same(g.metrics, values.length ? summary(values) : null),
            "group summary changed",
        );
    }
    return { verified_runs: records.length, coverage_status: status };
}
