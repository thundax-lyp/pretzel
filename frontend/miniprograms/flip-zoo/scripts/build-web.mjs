import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../", import.meta.url));
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
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "flip-zoo-web-"));
try {
    const config = path.join(folder, "build.json");
    fs.writeFileSync(
        config,
        JSON.stringify({
            name: "flip-zoo",
            platform: "web-mobile",
            buildPath: "project://build",
            outputName: "web-mobile",
            debug: false,
            startScene,
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
    const entry = path.join(project, "build/web-mobile/index.html");
    if (
        (fs.statSync(entry, { throwIfNoEntry: false })?.mtimeMs ?? 0) <
        started - 1000
    ) {
        throw new Error("Creator did not produce a fresh Web Mobile build");
    }
    console.log("Web Mobile entry:", entry);
} finally {
    fs.rmSync(folder, { recursive: true, force: true });
}
