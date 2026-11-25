import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(project, "build/wechatgame");
const appid = process.env.MAHJONG_MATCH_WECHAT_GAME_APP_ID;
if (!/^wx[0-9a-f]{16}$/.test(appid ?? "")) {
    throw new Error("Set MAHJONG_MATCH_WECHAT_GAME_APP_ID in the private .env");
}
const creator =
    process.env.COCOS_CREATOR_PATH ??
    "/Applications/CocosCreator/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator";
const { uuid: startScene } = JSON.parse(
    fs.readFileSync(
        path.join(project, "assets/scenes/start.scene.meta"),
        "utf8",
    ),
);

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "mahjong-wechat-"));
try {
    const config = path.join(folder, "build.json");
    fs.writeFileSync(
        config,
        JSON.stringify({
            name: "mahjong-match",
            platform: "wechatgame",
            taskName: "wechatgame",
            buildPath: "project://build",
            outputName: "wechatgame",
            debug: true,
            startScene,
            packages: { wechatgame: { appid, orientation: "portrait" } },
        }),
        { mode: 0o600 },
    );
    const log = fs.openSync(path.join(folder, "creator.log"), "w", 0o600);
    const started = Date.now();
    const result = spawnSync(
        creator,
        ["--project", project, "--build", "configPath=" + config],
        {
            stdio: ["ignore", log, log],
        },
    );
    fs.closeSync(log);
    if (result.error) throw result.error;
    if (
        result.status !== 36 ||
        (fs.statSync(path.join(output, "game.js"), { throwIfNoEntry: false })
            ?.mtimeMs ?? 0) <
            started - 1000
    ) {
        const diagnostics = fs
            .readFileSync(path.join(folder, "creator.log"), "utf8")
            .split(appid)
            .join("[AppID hidden]");
        throw new Error(
            `Creator build failed (${result.status ?? result.signal})\n${diagnostics.split("\n").slice(-20).join("\n")}`,
        );
    }
} finally {
    fs.rmSync(folder, { recursive: true, force: true });
}

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

gameConfig.openDataContext = "open-data";
fs.cpSync(path.join(project, "open-data"), path.join(output, "open-data"), {
    recursive: true,
});
fs.writeFileSync(
    path.join(output, "game.json"),
    JSON.stringify(gameConfig, null, 4) + "\n",
);

const firstScreenPath = path.join(output, "first-screen.js");
let firstScreen = fs.readFileSync(firstScreenPath, "utf8");
function replace(pattern, replacement) {
    if (!pattern.test(firstScreen)) {
        throw new Error(`Unexpected Creator first-screen template: ${pattern}`);
    }
    firstScreen = firstScreen.replace(pattern, replacement);
}

const appearance = {
    bgColor: "[0.02, 0.14, 0.09, 1]",
    useCustomBg: "true",
    logoName: '"loading-age-rating.png"',
    bgName: '"loading-background.png"',
    fitWidth: "false",
    fitHeight: "false",
    progressBarColor: "[1, 0.78, 0.33, 1]",
    progressBackground: "[0.28, 0.36, 0.23, 1]",
};
for (const [key, value] of Object.entries(appearance)) {
    replace(new RegExp(`^let ${key} = [^;]+;`, "m"), `let ${key} = ${value};`);
}

// Use the template's logo texture for the badge, aligned with the WeChat menu.
replace(
    /^function updateVertexBuffer\(\) \{[\s\S]*?^\}/m,
    `function updateVertexBuffer() {
    const menu = wx.getMenuButtonBoundingClientRect?.();
    const topInset = menu?.top > 0 && window.innerHeight > 0 ? menu.top / window.innerHeight : 0.055;
    const badgeWidth = Math.min(canvas.width * 0.105, canvas.height * 0.06) * 1.5;
    const left = -1 + 2 * 0.04;
    const right = left + 2 * badgeWidth / canvas.width;
    const top = 1 - 2 * topInset;
    const bottom = top - 2 * badgeWidth * image.height / image.width / canvas.height;
    const vertices = new Float32Array([
        right, bottom, 1, 1,
        right, top, 1, 0,
        left, bottom, 0, 1,
        left, top, 0, 0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}`,
);
replace(/loadSlogan\('slogan.png'\)/, "loadSlogan()");

replace(
    /^function loadSlogan\([^)]*\) \{[\s\S]*?^\}/m,
    `function loadSlogan() {
    slogan = wx.createCanvas();
    slogan.width = 1152;
    slogan.height = 320;
    const context = slogan.getContext('2d');
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff0cb';
    context.strokeStyle = '#082b1c';
    context.lineWidth = 6;
    context.lineJoin = 'round';
    for (const [line, y, size] of ${JSON.stringify([
        ["健康游戏忠告", 30, 36],
        ["抵制不良游戏，拒绝盗版游戏，注意自我保护，谨防受骗上当。", 76, 31],
        ["适度游戏益脑，沉迷游戏伤身，合理安排时间，享受健康生活。", 122, 31],
        ["本公司积极履行《网络游戏行业防沉迷自律公约》", 170, 31],
        ["上海四象无忧数字娱乐科技有限公司", 246, 31],
    ])}) {
        context.font = 'bold ' + size + 'px sans-serif';
        context.strokeText(line, 576, y);
        context.fillText(line, 576, y);
    }
    return Promise.resolve(slogan);
}`,
);
replace(
    /^function updateSloganVertexBuffer\(\) \{[\s\S]*?^\}/m,
    `function updateSloganVertexBuffer() {
    const scale = Math.min(canvas.width / 1152, canvas.height / 2048);
    const halfWidth = 1152 * scale / canvas.width;
    const top = 1 - 2 * 0.8125;
    const bottom = top - 640 * scale / canvas.height;
    const vertices = new Float32Array([
        halfWidth, bottom, 1, 1,
        halfWidth, top, 1, 0,
        -halfWidth, bottom, 0, 1,
        -halfWidth, top, 0, 0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, sloganVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
}`,
);
replace(/const heightOffset = -0\.8;/, "const heightOffset = 1 - 2 * 0.775;");

fs.copyFileSync(
    new URL("./first-screen/background.png", import.meta.url),
    path.join(output, "loading-background.png"),
);
fs.copyFileSync(
    new URL("./first-screen/age-rating.png", import.meta.url),
    path.join(output, "loading-age-rating.png"),
);
fs.writeFileSync(firstScreenPath, firstScreen);
console.log("Mahjong Match WeChat debug build ready.");
