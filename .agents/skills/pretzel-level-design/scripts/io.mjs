import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { requireThat, same } from "./catalog.mjs";
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
export const writeJSON = (file, value) =>
    fs.writeFileSync(file, JSON.stringify(value, null, 4) + "\n");
export const sha = (value) => createHash("sha256").update(value).digest("hex");
export function sources() {
    return Object.fromEntries(
        fs
            .readdirSync(ROOT)
            .filter((n) => n.endsWith(".mjs") && !n.endsWith(".test.mjs"))
            .sort()
            .map((n) => [n, sha(fs.readFileSync(path.join(ROOT, n)))]),
    );
}
export function newDirectory(output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.mkdirSync(output);
}
export function emit(output, event) {
    fs.appendFileSync(
        path.join(output, "journal.jsonl"),
        JSON.stringify(event) + "\n",
    );
}
export function readJournal(output, partial = false) {
    const file = path.join(output, "journal.jsonl");
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, "utf8"),
        lines = raw.split("\n"),
        events = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i]) continue;
        try {
            events.push(JSON.parse(lines[i]));
        } catch (error) {
            if (partial && i === lines.length - 1) break;
            throw new Error(`corrupt journal: ${error.message}`);
        }
    }
    return events;
}
export function checkSources(output, config) {
    requireThat(
        same(sources(), config.sources),
        "verifier version differs; use saved source/level-design.mjs",
    );
    for (const [file, hash] of Object.entries(config.sources))
        requireThat(
            sha(fs.readFileSync(path.join(output, "source", file))) === hash,
            "source snapshot changed",
        );
}
const DEFAULTS = {
    "per-variant": 2,
    repeats: 3,
    "repeat-start": 10,
    "max-candidates": 80,
    "max-runs": 100,
    "max-seconds": 120,
    "ad-limit": 10,
    boards: 1,
    seed: 2026120000,
    profile: "three-peaks",
    curve: "balanced",
    difficulty: "open",
    scenarios: "no-tools,zero-reserve,full-reserve",
    policies: "preview",
    variants: "",
    timing: "2.5,10,8,1.5",
};
export function parse(argv) {
    const [command, ...rest] = argv;
    requireThat(
        [
            "import",
            "generate",
            "prototype",
            "run",
            "verify",
            "report",
            "worker",
        ].includes(command),
        "commands: import, generate, prototype, run, verify, report",
    );
    const args = { ...DEFAULTS, command };
    for (let i = 0; i < rest.length; i += 2) {
        requireThat(
            rest[i].startsWith("--") && rest[i + 1] !== undefined,
            "expected --option value",
        );
        const key = rest[i].slice(2);
        requireThat(
            key in DEFAULTS || ["input", "output"].includes(key),
            `unknown option ${key}`,
        );
        args[key] =
            typeof DEFAULTS[key] === "number"
                ? Number(rest[i + 1])
                : rest[i + 1];
    }
    requireThat(args.output, "--output required");
    return args;
}
