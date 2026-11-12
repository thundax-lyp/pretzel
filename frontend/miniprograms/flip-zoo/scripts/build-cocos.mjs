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
const testAppId = process.env.FLIP_ZOO_WECHAT_TEST_APP_ID;
const appIdVariable = testBuild
    ? "FLIP_ZOO_WECHAT_TEST_APP_ID"
    : "FLIP_ZOO_WECHAT_GAME_APP_ID";
const appid = process.env[appIdVariable];
if (wechat && !/^wx[0-9a-f]{16}$/.test(appid ?? "")) {
    throw new Error(`Set ${appIdVariable} to an authorized WeChat game AppID`);
}
if (wechat && !testBuild && appid === testAppId) {
    throw new Error("Use the game's AppID for a release build");
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
        const adUnitId = process.env.FLIP_ZOO_WECHAT_REWARDED_AD_UNIT_ID;
        if (adUnitId) {
            fs.writeFileSync(
                entry,
                `GameGlobal.flipZooRewardedAdUnitId = ${JSON.stringify(adUnitId)};\n` +
                    fs.readFileSync(entry, "utf8"),
            );
        }
        const gameConfigPath = path.join(output, "game.json");
        const gameConfig = JSON.parse(fs.readFileSync(gameConfigPath, "utf8"));
        // The Cocos WeChat adapter resolves bundles listed in settings.assets.subpackages from this directory.
        const musicRoot = "subpackages/music";
        fs.mkdirSync(path.join(output, "subpackages"), { recursive: true });
        fs.renameSync(
            path.join(output, "assets/music"),
            path.join(output, musicRoot),
        );
        fs.renameSync(
            path.join(output, musicRoot, "index.js"),
            path.join(output, musicRoot, "game.js"),
        );
        gameConfig.subpackages ??= [];
        gameConfig.subpackages.push({ name: "music", root: musicRoot });
        const settingsPath = path.join(output, "src/settings.json");
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        settings.assets.subpackages.push("music");
        fs.writeFileSync(settingsPath, JSON.stringify(settings));
        fs.writeFileSync(
            gameConfigPath,
            JSON.stringify(gameConfig, null, 4) + "\n",
        );
        const firstScreenPath = path.join(output, "first-screen.js");
        let firstScreen = fs.readFileSync(firstScreenPath, "utf8");
        const artPath = (filename) => {
            const { uuid } = JSON.parse(
                fs.readFileSync(
                    path.join(
                        project,
                        "assets/resources/art",
                        filename + ".meta",
                    ),
                    "utf8",
                ),
            );
            const nativePath = `assets/resources/native/${uuid.slice(0, 2)}/${uuid}${path.extname(filename)}`;
            fs.accessSync(path.join(output, nativePath), fs.constants.R_OK);
            return JSON.stringify(nativePath);
        };
        // The WeChat bootstrap draws before Cocos loads the game scene.
        const appearance = {
            displayRatio: "0.5",
            bgColor: "[1, 244 / 255, 225 / 255, 1]",
            useDefaultLogo: "false",
            useCustomBg: "true",
            fitWidth: "false",
            fitHeight: "false",
            logoName: artPath("zoo-title.png"),
            bgName: artPath("zoo-garden.jpg"),
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
        fs.writeFileSync(firstScreenPath, firstScreen);

        const subpackageRoots = (gameConfig.subpackages ?? []).map(({ root }) =>
            path.resolve(output, root),
        );
        const files = fs
            .readdirSync(output, { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile());
        let mainBytes = 0;
        let totalBytes = 0;
        for (const file of files) {
            const filename = path.join(file.parentPath, file.name);
            const size = fs.statSync(filename).size;
            totalBytes += size;
            if (
                !subpackageRoots.some(
                    (root) =>
                        filename.startsWith(root + path.sep) ||
                        filename === root,
                )
            ) {
                mainBytes += size;
            }
        }
        for (const [name, size, limit] of [
            ["main package", mainBytes, 4_000_000],
            ["total package", totalBytes, 30_000_000],
        ]) {
            if (size > limit) {
                throw new Error(
                    `WeChat ${name} is ${size} bytes, exceeding the ${limit}-byte limit`,
                );
            }
            console.log(`WeChat ${name} size: ${size} / ${limit} bytes`);
        }
    }
    console.log("Cocos build output:", output);
} finally {
    fs.rmSync(folder, { recursive: true, force: true });
}
