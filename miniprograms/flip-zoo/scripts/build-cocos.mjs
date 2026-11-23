import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBuiltRevival } from "./verify-built-revival.mjs";

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
const cloudEnv = wechat
    ? process.env[
          testBuild
              ? "FLIP_ZOO_WECHAT_TEST_CLOUD_ENV"
              : "FLIP_ZOO_WECHAT_CLOUD_ENV"
      ]?.trim()
    : undefined;
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
        verifyBuiltRevival(output);
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
        fs.cpSync(path.join(project, "share"), path.join(output, "share"), {
            recursive: true,
        });
        const shareCards = ["DEFAULT", "VICTORY"].map((kind) => {
            const title = process.env[`FLIP_ZOO_SHARE_${kind}_TITLE`]?.trim();
            const imageUrlId =
                process.env[`FLIP_ZOO_SHARE_${kind}_IMAGE_ID`]?.trim();
            const imageUrl =
                process.env[`FLIP_ZOO_SHARE_${kind}_IMAGE_URL`]?.trim();
            if (Boolean(imageUrlId) !== Boolean(imageUrl)) {
                throw new Error(
                    `Set both the image ID and URL for the ${kind.toLowerCase()} share card`,
                );
            }
            const victory = kind === "VICTORY";
            return {
                title:
                    title ||
                    (victory
                        ? "我通关了！来挑战两只眼睛几条腿"
                        : "两只眼睛几条腿 · 一起来找同款"),
                imageUrlId,
                imageUrl:
                    imageUrl ||
                    (victory
                        ? "share/victory-result.jpg"
                        : "share/game-invite.jpg"),
            };
        });
        fs.writeFileSync(
            entry,
            (cloudEnv
                ? `GameGlobal.flipZooCloudEnv = ${JSON.stringify(cloudEnv)};\n`
                : "") +
                `GameGlobal.flipZooShareCards = ${JSON.stringify(shareCards)};\n` +
                fs.readFileSync(entry, "utf8"),
        );
        const gameConfigPath = path.join(output, "game.json");
        const gameConfig = JSON.parse(fs.readFileSync(gameConfigPath, "utf8"));
        const settingsPath = path.join(output, "src/settings.json");
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        const mainBundle = JSON.parse(
            fs.readFileSync(
                path.join(output, "assets/main/config.json"),
                "utf8",
            ),
        );
        if (
            !Object.hasOwn(
                mainBundle.scenes ?? {},
                settings.launch?.launchScene,
            )
        ) {
            throw new Error("Cocos did not package the WeChat launch scene");
        }
        // The Cocos WeChat adapter resolves bundles listed in settings.assets.subpackages from this directory.
        fs.mkdirSync(path.join(output, "subpackages"), { recursive: true });
        gameConfig.subpackages ??= [];
        for (const name of ["music", "home"]) {
            const root = `subpackages/${name}`;
            fs.renameSync(
                path.join(output, "assets", name),
                path.join(output, root),
            );
            fs.renameSync(
                path.join(output, root, "index.js"),
                path.join(output, root, "game.js"),
            );
            gameConfig.subpackages.push({ name, root });
            settings.assets.subpackages.push(name);
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings));
        gameConfig.openDataContext = "open-data";
        fs.cpSync(
            path.join(project, "open-data"),
            path.join(output, "open-data"),
            {
                recursive: true,
            },
        );
        fs.writeFileSync(
            gameConfigPath,
            JSON.stringify(gameConfig, null, 4) + "\n",
        );
        const firstScreenPath = path.join(output, "first-screen.js");
        let firstScreen = fs.readFileSync(firstScreenPath, "utf8");
        const resourcePath = (filename) => {
            const source = path.join(project, "assets/resources", filename);
            const { uuid } = JSON.parse(
                fs.readFileSync(source + ".meta", "utf8"),
            );
            const nativePath = `assets/resources/native/${uuid.slice(0, 2)}/${uuid}${path.extname(filename)}`;
            if (fs.existsSync(path.join(output, nativePath))) {
                return JSON.stringify(nativePath);
            }
            // The bootstrap needs the original image even when Creator packs it differently.
            const bootstrapPath = `first-screen/${filename}`;
            fs.mkdirSync(path.dirname(path.join(output, bootstrapPath)), {
                recursive: true,
            });
            fs.copyFileSync(source, path.join(output, bootstrapPath));
            return JSON.stringify(bootstrapPath);
        };
        // The WeChat bootstrap draws before Cocos loads the game scene.
        const appearance = {
            displayRatio: "0.5",
            bgColor: "[1, 244 / 255, 225 / 255, 1]",
            useDefaultLogo: "false",
            useCustomBg: "true",
            fitWidth: "false",
            fitHeight: "false",
            logoName: resourcePath("home-loading/background.jpg"),
            bgName: resourcePath("home-loading/background.jpg"),
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
        // Keep the bootstrap notice visible even though the default Cocos logo is disabled.
        firstScreen = firstScreen.replaceAll(
            "useLogo && useDefaultLogo &&",
            "useLogo &&",
        );
        firstScreen = firstScreen.replace(
            "useLogo && drawTexture(gl, program, logoTexture, vertexBuffer, 4);",
            "// The loading background already includes the HOME logo.",
        );
        const replaceFunction = (name, body) => {
            const pattern = new RegExp(
                `function ${name}\\([^)]*\\) \\{[\\s\\S]*?^\\}`,
                "m",
            );
            if (!pattern.test(firstScreen)) {
                throw new Error(
                    `Unexpected WeChat first-screen function: ${name}`,
                );
            }
            firstScreen = firstScreen.replace(pattern, body);
        };
        replaceFunction(
            "updateBgVertexBuffer",
            `function updateBgVertexBuffer() {
    const scale = Math.max(canvas.width / 1152, canvas.height / 2048);
    const width = 1152 * scale / canvas.width;
    const height = 2048 * scale / canvas.height;
    const vertices = new Float32Array([
        width, height, 1, 1,
        width, -height, 1, 0,
        -width, height, 0, 1,
        -width, -height, 0, 0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}`,
        );
        replaceFunction(
            "loadSlogan",
            `function loadSlogan() {
    slogan = wx.createCanvas();
    slogan.width = 1152;
    slogan.height = 320;
    const context = slogan.getContext('2d');
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.strokeStyle = '#258C52';
    context.fillStyle = '#F4F7E9';
    context.lineWidth = 8;
    for (const [text, y, size] of ${JSON.stringify([
        ["健康游戏忠告", 30, 36],
        ["抵制不良游戏，拒绝盗版游戏 ，注意自我保护，谨防受骗上当。", 76, 31],
        ["适度游戏益脑，沉迷游戏伤身 ，合理安排时间，享受健康生活。", 118, 31],
        ["本公司积极履行《网络游戏行业防沉迷自律公约》", 161, 31],
        ["上海四象无忧数字娱乐科技有限公司", 246, 31],
    ])}) {
        context.font = 'bold ' + size + 'px sans-serif';
        context.strokeText(text, 576, y);
        context.fillText(text, 576, y);
    }
    return Promise.resolve(slogan);
}`,
        );
        replaceFunction(
            "updateSloganVertexBuffer",
            `function updateSloganVertexBuffer() {
    const scale = Math.min(canvas.width / 1152, canvas.height / 2048);
    const width = 1152 * scale / canvas.width;
    const top = 1 - 3328 / 2048;
    const bottom = top - 640 * scale / canvas.height;
    const vertices = new Float32Array([
        width, bottom, 1, 1,
        width, top, 1, 0,
        -width, bottom, 0, 1,
        -width, top, 0, 0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, sloganVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}`,
        );
        firstScreen = firstScreen.replace(
            "const heightOffset = -0.8;",
            "const heightOffset = 1 - 3174 / 2048;",
        );
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
