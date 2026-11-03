import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = "thundax-lyp/pretzel";
try {
    execFileSync(
        "gh",
        [
            "api",
            "--method",
            "PUT",
            `repos/${repository}/branches/main/protection`,
            "--input",
            path.join(root, ".github/main-protection.json"),
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    console.log(
        "main protection applied: pull request, current CI checks, no force pushes or deletions.",
    );
} catch (error) {
    console.error("main protection was not applied.");
    console.error(String(error.stderr || error.message));
    process.exitCode = 1;
}
