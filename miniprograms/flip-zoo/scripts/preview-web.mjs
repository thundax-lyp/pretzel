import { existsSync } from "node:fs";
import { readFile, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateMainBoard } from "../assets/scripts/gameplay/round.ts";

const host = "127.0.0.1";
const port = 8874;
const url = `http://${host}:${port}`;
const build = fileURLToPath(new URL("../build/web-mobile/", import.meta.url));
if (!existsSync(path.join(build, "index.html"))) {
    throw new Error("Run npm run build:web before starting the preview");
}
const root = await realpath(build);
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

createServer(async (request, response) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(request.url, url).pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }

    try {
        if (pathname === "/api/board") {
            if (request.method !== "GET") {
                response.writeHead(405, { Allow: "GET" }).end();
                return;
            }
            sendJson(response, 200, generateMainBoard().kinds);
            return;
        }
        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
        }
        const file = await realpath(
            path.resolve(
                root,
                pathname === "/" ? "index.html" : "." + pathname,
            ),
        );
        if (!file.startsWith(root + path.sep)) {
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
