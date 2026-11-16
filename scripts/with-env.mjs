import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function main([option, envFile, separator, command, ...args]) {
    if (option !== "--env-file" || !envFile || separator !== "--" || !command) {
        throw new Error(
            "Usage: node scripts/with-env.mjs --env-file <file> -- <command> [args]",
        );
    }

    const env = { ...process.env };
    const protectedKeys = new Set(["HOME", "CODEX_HOME", "PATH"]);
    const lines = readFileSync(envFile, "utf8").split(/\r?\n/);
    for (const [index, raw] of lines.entries()) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const equals = line.indexOf("=");
        if (equals < 0)
            throw new Error(`Invalid environment entry on line ${index + 1}`);
        const key = line.slice(0, equals);
        let value = line.slice(equals + 1);
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || protectedKeys.has(key)) {
            throw new Error(`Unsupported environment key on line ${index + 1}`);
        }
        if (value.length >= 2 && /^(["']).*\1$/.test(value)) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    }

    const result = spawnSync(command, args, { env, stdio: "inherit" });
    if (result.error) throw new Error("Unable to start command");
    if (result.signal) process.kill(process.pid, result.signal);
    return result.status ?? 1;
}

try {
    process.exitCode = main(process.argv.slice(2));
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
