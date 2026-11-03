import fs from "node:fs";
import path from "node:path";
import { structureMetrics } from "./levels.mjs";
import { writeJSON } from "./io.mjs";

const escape = (value) =>
    String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll('"', "&quot;");

export function svgFor(level, maxLayer = 6, showCells = true) {
    const cards = level.positions
        .map(([x, y, z], id) => ({ x, y, z, id }))
        .filter((c) => c.z <= maxLayer)
        .sort((a, b) => a.x + a.y - b.x - b.y || a.z - b.z || a.x - b.x);
    const faces = cards.map((c) => {
        const px = (c.x - c.y) * 36,
            py = (c.x + c.y) * 21 - c.z * 17;
        return {
            ...c,
            points: [
                [px, py],
                [px + 36, py + 21],
                [px, py + 42],
                [px - 36, py + 21],
            ],
        };
    });
    const flat = faces.flatMap((c) => c.points),
        minX = Math.min(...flat.map((p) => p[0])) - 12,
        minY = Math.min(...flat.map((p) => p[1])) - 12,
        width = Math.max(...flat.map((p) => p[0])) - minX + 12,
        height = Math.max(...flat.map((p) => p[1])) - minY + 27;
    const color = [
        "#ecf2d5",
        "#d9e7bc",
        "#c5dbaa",
        "#afce96",
        "#99bf86",
        "#84ae79",
        "#6b996c",
    ];
    const polygon = (points, fill) =>
        `<polygon points="${points.map((p) => p.join(",")).join(" ")}" fill="${fill}" stroke="#657e69" stroke-width="0.7"/>`;
    const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let body = "";
    for (const c of faces) {
        const [a, b, cc, d] = c.points,
            below = (p) => [p[0], p[1] + 11];
        body += `<g data-card-id="${c.id}"><title>牌 ${c.id + 1}；位置 ${c.x}, ${c.y}, ${c.z}</title>`;
        body += polygon([b, cc, below(cc), below(b)], "#91aa8d");
        body += polygon([d, cc, below(cc), below(d)], "#b1c3a3");
        body += polygon(c.points, color[c.z % color.length]);
        if (showCells)
            for (const [p, q] of [
                [midpoint(a, b), midpoint(cc, d)],
                [midpoint(a, d), midpoint(b, cc)],
            ])
                body += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#53705b" opacity="0.55" stroke-dasharray="2 2" stroke-width="0.6"/>`;
        body += `<text x="${a[0]}" y="${a[1] + 24}" text-anchor="middle" font-size="9" fill="#314e3e">${c.id + 1}</text></g>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="${escape(level.source_id)}">${body}</svg>`;
}

export function writeStackPreview(output, levels) {
    const directory = path.join(output, "svg");
    fs.mkdirSync(directory);
    const records = levels.map((level, index) => {
        const svg = svgFor(level),
            file = `${index + 1}-${level.profile}.svg`;
        fs.writeFileSync(path.join(directory, file), svg);
        return {
            level,
            metrics: structureMetrics(level),
            svg_file: `svg/${file}`,
        };
    });
    writeJSON(path.join(output, "prototype-manifest.json"), {
        coordinate_unit: "tile",
        step: 0.5,
        card_footprint_cells: [2, 2],
        support:
            "at least one overlapping half-grid cell on immediately lower layer",
        placement:
            "same card IDs, animals, questions, reference groups and seeds; coordinates assigned in reference topological order",
        visibility: "logical-xy",
        preview_scope:
            "structure only, no clickable gameplay or render-visibility validation",
        records: records.map((r) => ({
            source_id: r.level.source_id,
            pair_id: r.level.pair_id,
            metrics: r.metrics,
            svg_file: r.svg_file,
        })),
    });
    const cards = records
        .map(
            (r) =>
                `<section><h2>${escape(r.level.profile)}</h2><p>${escape(r.level.pair_id)}</p>${r.level.positions.length} 张 · ${r.metrics.layers} 层 · 盖二 ${r.metrics.stack_patterns.one_covers_two} · 盖四 ${r.metrics.stack_patterns.one_covers_four} · 多盖一 ${r.metrics.stack_patterns.many_cover_one}<div>${svgFor(r.level)}</div><a href="${r.svg_file}">独立 SVG</a></section>`,
        )
        .join("\n");
    const data = JSON.stringify(levels).replaceAll("<", "\\u003c");
    // The preview is deliberately not a game; model-based clickability remains in the simulator.
    const renderer = `const escape = ${escape.toString()};\n${svgFor.toString()}`;
    fs.writeFileSync(
        path.join(output, "PREVIEW.html"),
        `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>半格混合堆叠原型</title><style>body{max-width:1400px;margin:24px auto;padding:0 18px;font:15px/1.7 system-ui;background:#f6f7ef;color:#294639}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}section{background:white;border:1px solid #ccd6c5;border-radius:14px;padding:16px}h2{margin:0;font-size:19px}p{overflow-wrap:anywhere}svg{width:100%;max-height:460px}header{position:sticky;top:0;background:#f6f7ef;padding:10px;z-index:2}label{margin-right:20px}</style><header><h1>一张牌 = 2×2 布局小格</h1><p>四个小格只用于定位。第二关仍为 48 张完整牌、12 题；同种子配对，全部七层、同一逐层牌量。至少一处下层重叠即可支撑，不计算重心。</p><p>本页是结构预览，无取牌交互。镜头透视不参与本轮 logical-xy 点击判定，不能将它当作游戏可见性验收。</p><label>显示到第 <output id="layerText">7</output> 层 <input id="layer" type="range" min="0" max="6" value="6"></label><label><input id="cells" type="checkbox" checked> 显示每张牌的四个定位小格</label></header><main>${cards}</main><script>const levels=${data};${renderer}\nfunction draw(){const z=Number(document.querySelector('#layer').value);document.querySelector('#layerText').textContent=z+1;document.querySelectorAll('section div').forEach((node,i)=>node.innerHTML=svgFor(levels[i],z,document.querySelector('#cells').checked));}document.querySelector('#layer').oninput=draw;document.querySelector('#cells').onchange=draw;</script></html>`,
    );
}
