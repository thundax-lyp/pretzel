import { existsSync } from "node:fs";
import {
    mkdir,
    readFile,
    realpath,
    rename,
    stat,
    writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildBoardKinds,
    DEFAULT_DIFFICULTY,
    isDifficulty,
} from "./difficulty.mjs";

const host = "127.0.0.1";
const port = 8874;
const url = `http://${host}:${port}`;
const build = fileURLToPath(new URL("../build/web-mobile/", import.meta.url));
if (!existsSync(path.join(build, "index.html"))) {
    throw new Error("Run npm run build:web before starting the preview");
}
const root = await realpath(build);
const adminPage = fileURLToPath(
    new URL("difficulty-admin.html", import.meta.url),
);
const difficultyFile = fileURLToPath(
    new URL("../local/difficulty.json", import.meta.url),
);
const contentTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".json", "application/json"],
    [".wasm", "application/wasm"],
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
    [".svg", "image/svg+xml"],
    [".mp3", "audio/mpeg"],
    [".ogg", "audio/ogg"],
    [".ttf", "font/ttf"],
    [".woff2", "font/woff2"],
]);

function sendJson(response, status, data) {
    response
        .writeHead(status, {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
        })
        .end(JSON.stringify(data));
}

async function readDifficulty() {
    try {
        const data = JSON.parse(await readFile(difficultyFile, "utf8"));
        if (!isDifficulty(data)) throw new Error("Invalid saved difficulty");
        return data;
    } catch (error) {
        if (error.code === "ENOENT") return DEFAULT_DIFFICULTY;
        throw error;
    }
}

async function serveDifficulty(request, response) {
    if (request.method === "GET") {
        sendJson(response, 200, await readDifficulty());
        return;
    }
    if (request.method !== "PUT") {
        response.writeHead(405, { Allow: "GET, PUT" }).end();
        return;
    }
    const {
        host: requestHost,
        origin,
        "content-type": contentType,
    } = request.headers;
    if (requestHost !== `${host}:${port}` || (origin && origin !== url)) {
        sendJson(response, 403, { error: "只接受本地后台请求" });
        return;
    }
    if (contentType?.split(";")[0].trim() !== "application/json") {
        sendJson(response, 415, { error: "请发送 JSON 配置" });
        return;
    }
    let size = 0;
    let body = "";
    for await (const chunk of request) {
        size += chunk.length;
        if (size <= 1024) body += chunk.toString();
    }
    if (size > 1024) {
        sendJson(response, 413, { error: "配置过大" });
        return;
    }
    let data;
    try {
        data = JSON.parse(body);
    } catch {
        sendJson(response, 400, { error: "无法读取配置" });
        return;
    }
    if (!isDifficulty(data)) {
        sendJson(response, 400, {
            error: "命门组数须为 1～3，叠压组数须为 0～命门组数的整数",
        });
        return;
    }
    const settings = {
        keyGroups: data.keyGroups,
        overlapGroups: data.overlapGroups,
    };
    await mkdir(path.dirname(difficultyFile), { recursive: true });
    const temporary = `${difficultyFile}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(settings, null, 4) + "\n");
    await rename(temporary, difficultyFile);
    sendJson(response, 200, settings);
}

createServer(async (request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, url).pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }

    try {
        if (pathname === "/api/difficulty") {
            await serveDifficulty(request, response);
            return;
        }
        if (pathname === "/api/board") {
            if (request.method !== "GET") {
                response.writeHead(405, { Allow: "GET" }).end();
                return;
            }
            sendJson(response, 200, buildBoardKinds(await readDifficulty()));
            return;
        }
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
        }
        const admin = pathname === "/admin";
        const file = admin
            ? adminPage
            : await realpath(
                  path.resolve(
                      root,
                      pathname === "/" ? "index.html" : "." + pathname,
                  ),
              );
        if (!admin && !file.startsWith(root + path.sep)) {
            response.writeHead(404).end();
            return;
        }
        const info = await stat(file);
        if (!info.isFile()) {
            response.writeHead(404).end();
            return;
        }
        const body =
            request.method === "GET" ? await readFile(file) : undefined;
        response
            .writeHead(200, {
                "Cache-Control": "no-store",
                "Content-Length": body?.length ?? info.size,
                "Content-Type":
                    contentTypes.get(path.extname(file).toLowerCase()) ??
                    "application/octet-stream",
            })
            .end(body);
    } catch (error) {
        const missing = error.code === "ENOENT" || error.code === "ENOTDIR";
        response.writeHead(missing ? 404 : 500).end();
    }
}).listen(port, host, () => console.log(`Flip Zoo preview: ${url}/`));
