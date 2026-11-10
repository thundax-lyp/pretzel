import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const [platform, ...flags] = process.argv.slice(2);
const wechat = platform === "wechatgame";
const testBuild = wechat && flags.includes("--test");
if (
    (!wechat && platform !== "web-mobile") ||
    flags.some((flag) => flag !== "--debug" && !(wechat && flag === "--test"))
) {
    throw new Error(
        "Choose web-mobile or wechatgame [--debug] [--test for WeChat]",
    );
}
const testAppId = "wx6ac3f5090a6b99c5";
const appid = testBuild ? testAppId : process.env.FLIP_ZOO_WECHAT_GAME_APP_ID;
if (
    wechat &&
    !testBuild &&
    (!/^wx[0-9a-f]{16}$/.test(appid ?? "") || appid === testAppId)
) {
    throw new Error(
        "Set FLIP_ZOO_WECHAT_GAME_APP_ID to the game's AppID or pass --test for a test package",
    );
}
const outputName = testBuild ? "wechatgame-test" : platform;
const creator =
    process.env.COCOS_CREATOR_PATH ??
    "/Applications/CocosCreator/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator";
if (!fs.existsSync(creator)) {
    throw new Error("Set COCOS_CREATOR_PATH to the Creator 3.8.8 executable");
}

const { uuid: startScene } = JSON.parse(
    fs.readFileSync(
        path.join(project, "assets/scenes/start.scene.meta"),
        "utf8",
    ),
);
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "flip-zoo-build-"));
try {
    const config = path.join(folder, "build.json");
    fs.writeFileSync(
        config,
        JSON.stringify({
            name: "flip-zoo",
            platform,
            taskName: outputName,
            buildPath: "project://build",
            outputName,
            debug: flags.includes("--debug"),
            startScene,
            ...(wechat && {
                packages: { wechatgame: { appid, orientation: "portrait" } },
            }),
        }),
    );
    const started = Date.now();
    const result = spawnSync(
        creator,
        ["--project", project, "--build", "configPath=" + config],
        { stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 36) {
        throw new Error(
            `Creator build failed: ${result.status ?? result.signal}`,
        );
    }
    const output = path.join(project, "build", outputName);
    const entry = path.join(output, wechat ? "game.js" : "index.html");
    if (
        (fs.statSync(entry, { throwIfNoEntry: false })?.mtimeMs ?? 0) <
        started - 1000
    ) {
        throw new Error(`Creator did not produce a fresh ${platform} build`);
    }
    if (wechat) {
        const projectConfig = JSON.parse(
            fs.readFileSync(path.join(output, "project.config.json"), "utf8"),
        );
        const gameConfig = JSON.parse(
            fs.readFileSync(path.join(output, "game.json"), "utf8"),
        );
        if (
            projectConfig.appid !== appid ||
            projectConfig.compileType !== "game" ||
            gameConfig.deviceOrientation !== "portrait"
        ) {
            throw new Error(
                "Generated WeChat project disagrees with build configuration",
            );
        }
    }
    if (wechat) {
        const firstScreenPath = path.join(output, "first-screen.js");
        let firstScreen = fs.readFileSync(firstScreenPath, "utf8");
        // The WeChat bootstrap draws before Cocos loads the game scene.
        const appearance = {
            displayRatio: "0.5",
            bgColor: "[1, 244 / 255, 225 / 255, 1]",
            useDefaultLogo: "false",
            useCustomBg: "true",
            fitWidth: "false",
            fitHeight: "false",
            logoName: '"zoo-launch-title.png"',
            bgName: '"zoo-launch-garden.jpg"',
            progressBarColor: "[255 / 255, 199 / 255, 85 / 255, 1]",
            progressBackground: "[111 / 255, 63 / 255, 106 / 255, 1]",
        };
        for (const [key, value] of Object.entries(appearance)) {
            const declaration = new RegExp(`^let ${key} = [^;]+;`, "m");
            if (!declaration.test(firstScreen)) {
                throw new Error(
                    `Unexpected WeChat first-screen template: ${key}`,
                );
            }
            firstScreen = firstScreen.replace(
                declaration,
                `let ${key} = ${value};`,
            );
        }
        fs.copyFileSync(
            path.join(project, "assets/resources/art/zoo-title.png"),
            path.join(output, "zoo-launch-title.png"),
        );
        fs.copyFileSync(
            path.join(project, "assets/resources/art/zoo-garden.jpg"),
            path.join(output, "zoo-launch-garden.jpg"),
        );
        fs.writeFileSync(firstScreenPath, firstScreen);
    }
    console.log("Cocos build output:", output);
} finally {
    fs.rmSync(folder, { recursive: true, force: true });
}
