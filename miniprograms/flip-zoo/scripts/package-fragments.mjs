import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const output = join(project, "build/cloud-functions/flip-zoo-fragments");
mkdirSync(output, { recursive: true });
cpSync(join(project, "cloud-functions/flip-zoo-fragments"), output, {
    recursive: true,
});
execFileSync(
    process.execPath,
    [
        "node_modules/typescript/bin/tsc",
        "--module",
        "commonjs",
        "--target",
        "ES2020",
        "--skipLibCheck",
        "--rewriteRelativeImportExtensions",
        "--rootDir",
        "assets/scripts",
        "--outDir",
        join(output, "rules"),
        "assets/scripts/services/main-board-pool.ts",
    ],
    { cwd: project, stdio: "inherit" },
);
