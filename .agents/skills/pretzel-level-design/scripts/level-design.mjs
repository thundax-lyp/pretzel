import { writeStackPreview } from "./preview.mjs";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { requireThat } from "./catalog.mjs";
import { parse, newDirectory, readJSON, writeJSON, sha } from "./io.mjs";
import { importLevels, pairedPrototypes, generate } from "./levels.mjs";
import { runExperiment, worker, verify } from "./experiment.mjs";
import { selectLevel } from "./simulation.mjs";
import { renderReport } from "./report.mjs";
export async function main(argv = process.argv.slice(2)) {
    if (argv.includes("--help")) {
        console.log(
            "level-design.mjs <import|generate|prototype|run|verify|report> --output <new-directory>\nimport/run: --input <layouts.json>\nrun: --max-candidates 80 --per-variant 2 --repeats 3 --max-runs 100 --max-seconds 120\nreport/verify: --output <existing-experiment>",
        );
        return 0;
    }
    const args = parse(argv),
        output = path.resolve(args.output);
    if (args.command === "worker") {
        worker(output);
        return 0;
    }
    if (args.command === "verify") {
        console.log(JSON.stringify(verify(output)));
        return 0;
    }
    if (args.command === "report") {
        verify(output);
        renderReport(output, readJSON(path.join(output, "report.json")));
        return 0;
    }
    if (args.command === "run") {
        const report = await runExperiment(args);
        console.log(
            JSON.stringify({
                status: report.status,
                stop_reason: report.stop_reason,
                completed_runs: report.completed_runs,
                planned_runs: report.planned_runs,
            }),
        );
        return report.status === "complete"
            ? 0
            : report.status === "budget_stopped"
              ? 2
              : 1;
    }
    let levels, inputHash;
    const selection = [];
    if (args.command === "prototype") {
        requireThat(
            Number.isSafeInteger(args.boards) &&
                args.boards > 0 &&
                args.boards * 4 <= args["max-candidates"],
            "invalid prototype/candidate budget",
        );
        const input = args.input ? fs.readFileSync(args.input) : null;
        if (input) inputHash = sha(input);
        const bases = input
            ? importLevels(JSON.parse(input), args["max-candidates"])
            : Array.from({ length: args.boards }, (_, i) =>
                  generate(args.seed + i, "aligned-control", args.curve),
              );
        requireThat(bases.length >= args.boards, "not enough input puzzles");
        levels = pairedPrototypes(bases.slice(0, args.boards));
    } else if (args.command === "import") {
        requireThat(args.input, "--input required");
        const raw = fs.readFileSync(args.input);
        levels = importLevels(JSON.parse(raw), args["max-candidates"]);
        inputHash = sha(raw);
    } else {
        requireThat(
            Number.isSafeInteger(args.boards) &&
                args.boards > 0 &&
                args.boards <= args["max-candidates"],
            "invalid boards/candidate budget",
        );
        levels = [];
        let used = 0;
        for (let i = 0; i < args.boards; i++) {
            const result = selectLevel(
                args.seed + i,
                args.profile,
                args.curve,
                args.difficulty,
                args["max-candidates"] - used,
            );
            used += result.selection.candidates.length;
            levels.push(result.level);
            selection.push(result.selection);
        }
    }
    newDirectory(output);
    writeJSON(path.join(output, "levels.json"), {
        schemaVersion: 1,
        ...(inputHash ? { input_sha256: inputHash } : {}),
        levels,
        ...(selection.length ? { selection } : {}),
    });
    if (args.command === "prototype") writeStackPreview(output, levels);
    console.log(
        JSON.stringify({
            imported_levels: levels.length,
            reference_replays: levels.length,
        }),
    );
    return 0;
}
if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
    main()
        .then((code) => (process.exitCode = code))
        .catch((error) => {
            console.error(error.stack);
            process.exitCode = 1;
        });
