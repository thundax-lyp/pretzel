import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const output = join(project, "build/cloud-functions/flip-zoo-shares");
mkdirSync(output, { recursive: true });
cpSync(join(project, "cloud-functions/flip-zoo-shares"), output, {
    recursive: true,
});
execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
    cwd: output,
    stdio: "inherit",
});
console.log("Share function package:", output);
