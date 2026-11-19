import fs from "node:fs";
import path from "node:path";
import { createPrivateKey } from "node:crypto";
import { fileURLToPath } from "node:url";
import { format, parseArgs } from "node:util";

// The official uploader logs request URLs containing the full AppID.
for (const method of ["log", "info", "warn", "error", "debug"]) {
    const original = console[method].bind(console);
    console[method] = (...args) =>
        original(
            format(...args).replace(
                /wx[0-9a-f]{16}/g,
                (id) => `wx…${id.slice(-4)}`,
            ),
        );
}

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const { values } = parseArgs({
    options: {
        version: { type: "string" },
        desc: { type: "string" },
        receipt: { type: "string" },
        check: { type: "boolean", default: false },
    },
});

function save(receipt, data) {
    fs.writeFileSync(receipt, JSON.stringify(data, null, 4) + "\n", {
        mode: 0o600,
    });
}

async function main() {
    const appid = process.env.FLIP_ZOO_WECHAT_GAME_APP_ID;
    const env = process.env.FLIP_ZOO_WECHAT_CLOUD_ENV;
    if (!/^wx[0-9a-f]{16}$/.test(appid ?? "") || !env?.trim()) {
        throw new Error(
            "Load the formal AppID and cloud environment from .env",
        );
    }
    const keyPath = path.resolve(root, "../flip-zoo-wechat-upload.key");
    createPrivateKey(fs.readFileSync(keyPath));
    const projectPath = path.join(
        root,
        "miniprograms/flip-zoo/build/wechatgame",
    );
    const config = JSON.parse(
        fs.readFileSync(path.join(projectPath, "project.config.json"), "utf8"),
    );
    if (config.appid !== appid || config.compileType !== "game") {
        throw new Error("Build target does not match the formal game AppID");
    }
    const game = fs.readFileSync(path.join(projectPath, "game.js"), "utf8");
    if (
        !game.includes(`GameGlobal.flipZooCloudEnv = ${JSON.stringify(env)};`)
    ) {
        throw new Error("Rebuild with the configured cloud environment");
    }
    const { default: ci } = await import("miniprogram-ci");
    if (values.check) {
        console.log("Upload preflight passed; no upload performed");
        return;
    }
    if (
        !/^\d+\.\d+\.\d+$/.test(values.version ?? "") ||
        !values.desc ||
        !values.receipt
    ) {
        throw new Error(
            "Use --version X.Y.Z --desc <description> --receipt <absolute path>",
        );
    }
    const receipt = path.resolve(values.receipt);
    const state = {
        version: values.version,
        robot: 1,
        startedAt: new Date().toISOString(),
    };
    // An existing receipt must be reconciled before starting another upload.
    fs.writeFileSync(receipt, JSON.stringify({ ...state, status: "started" }), {
        flag: "wx",
        mode: 0o600,
    });
    try {
        const project = new ci.Project({
            appid,
            type: "miniGame",
            projectPath,
            privateKeyPath: keyPath,
            ignores: ["node_modules/**/*"],
        });
        const result = await ci.upload({
            project,
            version: values.version,
            desc: values.desc,
            robot: 1,
            setting: { useProjectConfig: true },
            onProgressUpdate() {},
        });
        save(receipt, {
            ...state,
            status: "success",
            completedAt: new Date().toISOString(),
            result,
        });
        console.log(`Upload succeeded: ${values.version}; receipt: ${receipt}`);
    } catch (error) {
        // Network failures can occur after the server accepted the package.
        save(receipt, {
            ...state,
            status: "unresolved",
            errorCode: error.code ?? error.errCode ?? null,
        });
        throw error;
    }
}

try {
    await main();
} catch (error) {
    console.error(
        String(error.message).replace(
            /wx[0-9a-f]{16}/g,
            (id) => `wx…${id.slice(-4)}`,
        ),
    );
    process.exitCode = 1;
}
