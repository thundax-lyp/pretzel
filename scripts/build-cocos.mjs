import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const project = path.join(root, "frontend/miniprogram");
const platform = process.argv[2];
if (!["web-mobile", "wechatgame"].includes(platform)) {
    throw new Error("Choose web-mobile or wechatgame");
}
const creator =
    process.env.COCOS_CREATOR_PATH ??
    "/Applications/CocosCreator/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator";
if (!fs.existsSync(creator))
    throw new Error("Configure COCOS_CREATOR_PATH for Creator 3.8.8");
const appid = process.env.WECHAT_GAME_APP_ID;
if (platform === "wechatgame" && !/^wx[0-9a-f]{16}$/.test(appid ?? "")) {
    throw new Error(
        "Configure WECHAT_GAME_APP_ID using an authorized WeChat mini game AppID",
    );
}
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pretzel-cocos-build-"));
const configPath = path.join(folder, "build.json");
const config = {
    name: "pretzel",
    platform,
    taskName: platform,
    buildPath: "project://build",
    outputName: platform,
    debug: process.argv.includes("--debug"),
    startScene: "7444d048-c012-5c41-8cdb-3ab7bc8034f4",
    includedModules: [
        "base",
        "2d",
        "ui",
        "graphics",
        "mask",
        "audio",
        "tween",
        "profiler",
        "gfx-webgl",
        "gfx-webgl2",
        "legacy-pipeline",
    ],
    packages:
        platform === "wechatgame"
            ? { wechatgame: { appid, orientation: "portrait" } }
            : {},
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
const started = Date.now();
try {
    const result = spawnSync(
        creator,
        ["--project", project, "--build", "configPath=" + configPath],
        {
            stdio: "inherit",
        },
    );
    if (result.error) throw result.error;
    if (result.status !== 36)
        throw new Error("Creator build failed: " + result.status);
    const output = path.join(project, "build", platform);
    const entry = path.join(
        output,
        platform === "wechatgame" ? "game.js" : "index.html",
    );
    if (!fs.existsSync(entry) || fs.statSync(entry).mtimeMs < started - 1000) {
        throw new Error("Creator did not produce a fresh build");
    }
    if (platform === "wechatgame") {
        const generated = JSON.parse(
            fs.readFileSync(path.join(output, "project.config.json"), "utf8"),
        );
        if (generated.appid !== appid || generated.compileType !== "game") {
            throw new Error(
                "Generated platform or AppID disagrees with build configuration",
            );
        }
    }
    console.log("Cocos build output: " + output);
} finally {
    fs.rmSync(folder, { recursive: true, force: true });
}
