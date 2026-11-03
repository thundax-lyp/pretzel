"""把既有关卡数据导出为无外部依赖的 45° 轴测 SVG；不改变布局。"""

import json
import math
import xml.etree.ElementTree as ET
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "svg"
DATA = json.loads((ROOT / "levels.json").read_text())


def coords(card):
    p = DATA["projection"]
    return (
        (card["x"] - card["y"]) * p["xStep"],
        (card["x"] + card["y"]) * p["yStep"] - card["z"] * p["layerStep"],
    )


def structure(pack, stage, prefix):
    level = pack[stage]
    step_x = DATA["projection"]["xStep"]
    step_y = DATA["projection"]["yStep"]
    thickness = DATA["projection"]["thickness"]
    chunks = []
    if stage == "hard" and pack.get("decorativeFootprint"):
        paths = []
        for row, line in enumerate(pack["decorativeFootprint"]):
            for col, filled in enumerate(line):
                if filled:
                    px, py = (col - row) * step_x, (col + row) * step_y + thickness / 2
                    paths.append(
                        f"M{px},{py} l{step_x},{step_y} {-step_x},{step_y} {-step_x},{-step_y}Z"
                    )
        chunks.append(
            f'<g aria-hidden="true" data-role="non-interactive-base" transform="translate(-14 48) scale(0.5)"><path d="{" ".join(paths)}" fill="{pack["color"]}" opacity="0.18"/></g>'
        )
    cards = sorted(
        enumerate(level["cards"]),
        key=lambda item: (item[1]["x"] + item[1]["y"], item[1]["z"], item[1]["x"]),
    )
    for card_id, card in cards:
        x, y = coords(card)
        a = DATA["animals"][card["animal"]]
        clip = f"{prefix}-face-{card_id}"
        chunks.append(f'''<g transform="translate({x} {y})" data-card="{card_id}" data-grid="{card["x"]},{card["y"]},{card["z"]}">
    <title>{escape(a["name"])} · 眼{a["eyes"]} 腿{a["legs"]} · 第{card["z"] + 1}层</title>
    <path d="M{-step_x},{step_y} 0,{2 * step_y} V{2 * step_y + thickness} L{-step_x},{step_y + thickness}Z" fill="url(#{prefix}-left)" stroke="#78937d" stroke-width="0.65"/>
    <path d="M0,{2 * step_y} {step_x},{step_y} V{step_y + thickness} L0,{2 * step_y + thickness}Z" fill="url(#{prefix}-right)" stroke="#6d8773" stroke-width="0.65"/>
    <path d="M0,0 {step_x},{step_y} 0,{2 * step_y} {-step_x},{step_y}Z" fill="url(#{prefix}-top)" stroke="#9eaf96" stroke-width="0.8"/>
    <path d="M{-step_x + 1},{step_y} 0,1 {step_x - 1},{step_y}" fill="none" stroke="#fffef6" stroke-width="1.2"/>
    <path d="M{-step_x},{step_y + thickness - 2} 0,{2 * step_y + thickness - 2} {step_x},{step_y + thickness - 2}" fill="none" stroke="#e4ead5" stroke-width="0.6" opacity="0.7"/>
    <defs><clipPath id="{clip}"><path d="M0,2 {step_x - 2},{step_y} 0,{2 * step_y - 2} {-step_x + 2},{step_y}Z"/></clipPath></defs>
    <g clip-path="url(#{clip})" fill="#69795c" opacity="0.9">
        <path d="M-10,12 Q-6,8 -2,12 Q-6,16 -10,12Z" fill="none" stroke="#8c9b73" stroke-width="0.7"/>
        <circle cx="-6" cy="12" r="1.3"/>
        <text x="1" y="15" font-size="7" font-weight="650">{a["eyes"]}</text>
        <path d="M-5,18 h3 l-1,6 -4,2 -1,-2 3,-2Z" fill="#8c9b73"/>
        <text x="1" y="24" font-size="7" font-weight="650">{a["legs"]}</text>
    </g>
</g>''')
    points = [coords(c) for c in level["cards"]]
    min_x = min(x for x, _ in points) - step_x - 8
    max_x = max(x for x, _ in points) + step_x + 8
    min_y = min(y for _, y in points) - 8
    max_y = max(y for _, y in points) + 2 * step_y + thickness + 8
    defs = f'''<defs>
    <linearGradient id="{prefix}-top" x2="0.3" y2="1"><stop stop-color="#fffdf2"/><stop offset="1" stop-color="#ebeecf"/></linearGradient>
    <linearGradient id="{prefix}-left" x2="0.2" y2="1"><stop stop-color="#c2d2ae"/><stop offset="1" stop-color="{pack["color"]}"/></linearGradient>
    <linearGradient id="{prefix}-right" x2="1" y2="1"><stop stop-color="#a4b993"/><stop offset="1" stop-color="#829f83"/></linearGradient>
</defs>'''
    return defs + "\n".join(chunks), (min_x, min_y, max_x - min_x, max_y - min_y)


def placed(pack, stage, x, y, width, height, prefix):
    graphic, bounds = structure(pack, stage, prefix)
    bx, by, bw, bh = bounds
    scale = min((width - 24) / bw, (height - 24) / bh)
    if stage == "easy":
        scale = min(scale, 2.2)
    tx = x + (width - bw * scale) / 2 - bx * scale
    ty = y + (height - bh * scale) / 2 - by * scale
    return f'<g transform="translate({tx:.3f} {ty:.3f}) scale({scale:.5f})">{graphic}</g>'


def document(width, height, title, body, metadata=None):
    extra = (
        f"<metadata>{escape(json.dumps(metadata, ensure_ascii=False))}</metadata>"
        if metadata
        else ""
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}">
<title>{escape(title)}</title>{extra}
<style>text{{font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}} .title{{fill:#3e5749;font-size:27px;font-weight:750}} .sub{{fill:#859078;font-size:13px}}</style>
<rect width="100%" height="100%" fill="#f4f4ea"/>
{body}
</svg>
'''


def write(name, content):
    ET.fromstring(content)
    if "<image" in content or "href=" in content:
        raise ValueError("独立矢量图不得依赖外部图片")
    (OUT / name).write_text(content)


def main():
    OUT.mkdir(exist_ok=True)
    overview = [
        '<text x="34" y="48" class="title">腿了个腿 · 20 套立体麻将牌结构</text>',
        '<text x="34" y="78" class="sub">水平斜转 45° · 固定轴测投影 · 顶面 / 双侧面 / 逐层牌缝 · 纯 SVG</text>',
    ]
    for i, pack in enumerate(DATA["packs"]):
        stem = f"{i + 1:02d}-{pack['slug']}"
        for stage, label in [("easy", "第一关"), ("hard", "第二关")]:
            level = pack[stage]
            meta = {
                "set": i + 1,
                "stage": stage,
                "cards": len(level["cards"]),
                "questions": len(level["targets"]),
                "azimuthDegrees": 45,
                "elevationDegrees": round(
                    math.degrees(
                        math.atan(DATA["projection"]["yStep"] / DATA["projection"]["xStep"])
                    ),
                    3,
                ),
                "projection": "orthographic axonometric, no vanishing point",
                "grid": DATA["grid"],
            }
            body = f'<text x="34" y="48" class="title">{i + 1:02d} / {escape(pack["name"])} · {label}</text><text x="34" y="78" class="sub">{len(level["cards"])} 张牌 · {len(level["targets"])} 题 · {level["layers"]} 层</text>'
            body += placed(pack, stage, 24, 110, 852, 500, stem + stage)
            write(f"{stem}-{stage}.svg", document(900, 660, pack["name"] + label, body, meta))
        pair = f'<text x="36" y="48" class="title">{i + 1:02d} / {escape(pack["name"])}</text><text x="36" y="78" class="sub">{escape(pack["description"])} · 固定斜 45° 轴测视角</text>'
        pair += '<rect x="26" y="108" width="554" height="550" rx="22" fill="#fcfcf3" stroke="#d7dfca"/><rect x="600" y="108" width="574" height="550" rx="22" fill="#fcfcf3" stroke="#d7dfca"/>'
        pair += '<text x="50" y="145" class="sub">第一关 · 7 张 / 3 题 · 简化结构</text><text x="624" y="145" class="sub">第二关 · 48 张 / 12 题 · 多层结构</text>'
        pair += placed(pack, "easy", 40, 175, 520, 425, stem + "pair1")
        pair += placed(pack, "hard", 614, 175, 544, 425, stem + "pair2")
        write(f"{stem}-pair.svg", document(1200, 690, pack["name"] + "两关立体结构", pair))
        x, y = 28 + (i % 4) * 388, 106 + (i // 4) * 326
        overview.append(
            f'<rect x="{x}" y="{y}" width="370" height="308" rx="18" fill="#fcfcf3" stroke="#d7dfca"/><text x="{x + 18}" y="{y + 30}" fill="#4b6454" font-size="16" font-weight="700">{i + 1:02d} {escape(pack["name"])}</text>'
        )
        overview.append(placed(pack, "hard", x + 10, y + 43, 350, 222, stem + "overview"))
        overview.append(
            f'<text x="{x + 18}" y="{y + 289}" class="sub">{escape(pack["description"])}</text>'
        )
    write("overview.svg", document(1600, 1765, "20 套斜45度立体麻将牌结构", "\n".join(overview)))
    # Compare the same animal identities/questions on four actual layouts.
    samples = json.loads((ROOT / "height-study/variants.json").read_text())
    for theme in ("castle", "turtle"):
        pack = next(p for p in DATA["packs"] if p["slug"] == theme)
        body = f'<text x="32" y="44" class="title">{escape(pack["name"])} · 实际堆叠高度对照</text><text x="32" y="74" class="sub">48 张 / 12 题 / 同一组动物与题目 / 侧面厚度不变，仅改变实际层数与覆盖关系</text>'
        for column, layers in enumerate((4, 6, 7, 8)):
            case = next(v for v in samples if v["theme"] == theme and v["variant"] == layers)
            metric = case["metrics"]
            x = 22 + column * 394
            body += f'<rect x="{x}" y="98" width="378" height="476" rx="16" fill="#fcfcf3" stroke="#d7dfca"/><text x="{x + 18}" y="130" fill="#45604e" font-size="20" font-weight="700">{layers} 层{"基线" if layers == 4 else "原型"}</text>'
            body += placed(
                {**pack, "hard": case["level"]},
                "hard",
                x + 6,
                146,
                366,
                320,
                f"height-{theme}-{layers}",
            )
            body += f'<text x="{x + 18}" y="501" class="sub">占地 {metric["footprintCells"]} 格 · 平均 {metric["averageHeight"]} 张</text><text x="{x + 18}" y="527" class="sub">开局可取 {metric["initialClickable"]} 张 · 依赖链 {metric["longestDependencyChain"]}</text><text x="{x + 18}" y="553" class="sub">逐层牌数 {" / ".join(map(str, metric["layerCounts"]))}</text>'
        write(
            f"height-comparison-{theme}.svg",
            document(1600, 600, pack["name"] + "四种实际层高对照", body),
        )
    print("Generated 63 standalone pure-vector SVGs; all XML parsed.")


if __name__ == "__main__":
    main()
