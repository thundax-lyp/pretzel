"""生成独立设计稿数据；不依赖临时实验或生产游戏代码。"""

import argparse
import copy
import json
import random
from pathlib import Path

from geometry import DEFAULT_PROJECTION, available, blockers, metrics
from variants import choose, rehouse

ROOT = Path(__file__).resolve().parent
ANIMALS = [
    ("泡泡鱼", 2, 0),
    ("跳跳鸟", 2, 1),
    ("小黄鸡", 2, 2),
    ("三脚鸭", 2, 3),
    ("短腿兔", 2, 4),
    ("五脚蛙", 2, 5),
    ("小甲虫", 2, 6),
    ("横横蟹", 2, 8),
    ("独眼蛇", 1, 0),
    ("独眼鸡", 1, 2),
    ("独眼猪", 1, 4),
    ("独眼虫", 1, 6),
    ("三眼跳跳", 3, 1),
    ("三眼企鹅", 3, 2),
    ("三眼猫", 3, 4),
    ("三眼蚂蚁", 3, 6),
    ("四眼鱼", 4, 0),
    ("四眼鸭", 4, 2),
    ("四眼狗", 4, 4),
    ("四眼蛛", 4, 8),
    ("五眼鸟", 5, 2),
    ("五眼兽", 5, 4),
    ("六眼牛", 6, 4),
    ("六眼虫", 6, 6),
]
# 每个数字表示该格的麻将牌堆高度；0 是留空，并非方块素材。
TEMPLATES = [
    (
        "castle",
        "奶油小城堡",
        "#91b8aa",
        "四角塔楼、低墙和中庭",
        ["000000", "040040", "022220", "021120", "021120", "022220", "040040", "000000"],
    ),
    (
        "turtle",
        "慢慢小乌龟",
        "#8cae85",
        "隆起龟壳、头部和四肢",
        ["001100", "001100", "012210", "123321", "123321", "012210", "010010", "000000"],
    ),
    (
        "mushroom",
        "蘑菇小屋",
        "#d49c90",
        "宽菌盖、窄门柱与入口",
        ["000000", "012210", "123321", "122221", "001100", "002200", "012210", "000000"],
    ),
    (
        "house",
        "屋顶小木屋",
        "#d0ac7c",
        "阶梯尖屋顶与矮庭院",
        ["000000", "001100", "012210", "123321", "122221", "012210", "011110", "000000"],
    ),
    (
        "tree",
        "森林大树",
        "#8eaa79",
        "分层树冠、树干和树根",
        ["001100", "012210", "123321", "012210", "123321", "001100", "001100", "011110"],
    ),
    (
        "windmill",
        "风车庄园",
        "#a5b9c5",
        "四臂风叶、中央高台和底座",
        ["000000", "020020", "012210", "003300", "003300", "012210", "020020", "011110"],
    ),
    (
        "lighthouse",
        "海边灯塔",
        "#88b5c6",
        "细长塔身、灯室与小岛",
        ["001100", "002200", "003300", "002200", "002200", "012210", "111111", "011110"],
    ),
    (
        "rabbit",
        "长耳兔窝",
        "#c4a0b9",
        "高耳朵、圆身与两只脚",
        ["020020", "030030", "012210", "123321", "122221", "012210", "010010", "000000"],
    ),
    (
        "whale",
        "鲸鱼小岛",
        "#91b2cc",
        "圆鲸背与分叉尾鳍",
        ["000000", "011100", "123310", "123321", "123310", "011100", "000110", "000101"],
    ),
    (
        "crab",
        "螃蟹沙堡",
        "#d6aa86",
        "双钳、高背和左右小脚",
        ["020020", "011110", "012210", "123321", "012210", "110011", "010010", "000000"],
    ),
    (
        "rocket",
        "星星火箭",
        "#b0a7cc",
        "尖头、舱体、双翼与尾焰",
        ["001100", "002200", "003300", "012210", "123321", "012210", "010010", "010010"],
    ),
    (
        "dinosaur",
        "恐龙山丘",
        "#9aaf87",
        "伸出的头、长背与尾巴",
        ["000110", "000220", "001220", "012210", "123321", "122210", "010110", "010010"],
    ),
    (
        "robot",
        "机器人基地",
        "#a8b7b8",
        "方头、双臂与分离双脚",
        ["010010", "012210", "012210", "123321", "123321", "012210", "020020", "010010"],
    ),
    (
        "train",
        "森林小火车",
        "#b4b0a0",
        "车头、烟囱和连续车厢",
        ["000000", "000030", "011120", "022230", "011110", "022220", "010010", "000000"],
    ),
    (
        "duck",
        "小鸭水乐园",
        "#d5bf83",
        "鸭头、突出嘴部和圆背",
        ["000000", "001110", "001220", "011210", "123321", "123320", "011110", "000000"],
    ),
    (
        "cat",
        "猫咪阁楼",
        "#b6a8bc",
        "双耳、圆脸、身躯与卷尾",
        ["020020", "012210", "123321", "012210", "012210", "012211", "012220", "010010"],
    ),
    (
        "bear",
        "小熊营地",
        "#b6a18c",
        "圆耳、圆肚与宽脚掌",
        ["020020", "012210", "123321", "012210", "123321", "012210", "011110", "000000"],
    ),
    (
        "panda",
        "熊猫竹庭",
        "#8da99d",
        "双耳与高肚子，旁边竹柱",
        ["020020", "012210", "012210", "123321", "123321", "012210", "010010", "000000"],
    ),
    (
        "butterfly",
        "蝴蝶花园",
        "#c4a4bc",
        "高低双翼与细长身体",
        ["010010", "120021", "123321", "012210", "012210", "123321", "120021", "000000"],
    ),
    (
        "bridge",
        "彩虹小拱桥",
        "#aab3cb",
        "两侧桥墩、阶梯桥面与水道",
        ["000000", "011110", "022220", "133331", "122221", "011110", "010010", "000000"],
    ),
]
SIZES = [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5]


def validate(level):
    cards, cover = level["cards"], level["blockers"]

    def require(condition, message):
        if not condition:
            raise ValueError(message)

    require(len({(c["x"], c["y"], c["z"]) for c in cards}) == len(cards), "duplicate position")
    require(
        all(
            0 <= c["x"] <= 5
            and 0 <= c["y"] <= 7
            and isinstance(c["z"], int)
            and 0 <= c["z"] < level.get("maxLayers", 4)
            for c in cards
        ),
        "position outside configured grid",
    )
    require(
        all(float(c["x"] * 2).is_integer() and float(c["y"] * 2).is_integer() for c in cards),
        "position outside half-cell units",
    )
    require(blockers(cards) == cover, "stored visibility mismatch")
    require(len(level["reference"]) == len(level["targets"]), "question/reference mismatch")
    left = set(range(len(cards)))
    for group, target in zip(level["reference"], level["targets"]):
        require(1 <= len(group) <= 7, "invalid reference group size")
        eyes, legs = 0, 0
        for index, i in enumerate(group):
            require(i in available(left, cover), "reference card is covered or absent")
            left.remove(i)
            _, e, leg_count = ANIMALS[cards[i]["animal"]]
            eyes, legs = eyes + e, legs + leg_count
            require(
                (eyes, legs) != (target["eyes"], target["legs"]) or index == len(group) - 1,
                "reference clears too early",
            )
        require((eyes, legs) == (target["eyes"], target["legs"]), "reference does not match")
    require(not left, "reference leaves cards")


def random_easy(level, seed):
    rng = random.Random(seed)
    left = set(range(7))
    q, slot = 0, []
    while left:
        i = rng.choice(available(left, level["blockers"]))
        left.remove(i)
        slot.append(i)
        e = sum(ANIMALS[level["cards"][j]["animal"]][1] for j in slot)
        leg_count = sum(ANIMALS[level["cards"][j]["animal"]][2] for j in slot)
        t = level["targets"][q]
        if (e, leg_count) == (t["eyes"], t["legs"]):
            q += 1
            slot = []
        elif len(slot) == 7:
            return False
    return q == 3 and not slot


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--layers", type=int, choices=(4, 6, 7, 8), default=6)
    args = parser.parse_args()
    canonical = json.loads((ROOT / "height-study/baseline-levels.json").read_text())
    packs = []
    for index, (slug, name, color, description, rows) in enumerate(TEMPLATES):
        source = canonical["packs"][index]
        if args.layers == 4:
            h = copy.deepcopy(source["heightMap"])
            hard = copy.deepcopy(source["hard"])
            hard["maxLayers"] = 4
        else:
            h, hard_cards = choose(args.layers, index)
            hard = rehouse(source["hard"], hard_cards, 2026110300 + index)
        hard["structureMetrics"] = metrics(hard["cards"], hard["reference"])
        validate(hard)
        easy = copy.deepcopy(source["easy"])
        if not all(random_easy(easy, seed) for seed in range(1000)):
            raise ValueError("first-stage random replay failed")
        if len(hard["cards"]) != 48 or len(hard["targets"]) != 12:
            raise ValueError("second-stage size mismatch")
        packs.append(
            {
                "id": index + 1,
                "slug": slug,
                "name": name,
                "color": color,
                "description": description,
                "heightMap": h,
                "decorativeFootprint": [[int(c) > 0 for c in row] for row in rows],
                "easy": easy,
                "hard": hard,
            }
        )
    data = {
        "schemaVersion": 1,
        "status": "结构与视觉设计稿，非生产关卡",
        "grid": {"columns": 6, "rows": 8, "maxLayers": args.layers},
        "projection": DEFAULT_PROJECTION,
        "animals": [
            {"name": name, "eyes": e, "legs": leg_count, "sprite": i}
            for i, (name, e, leg_count) in enumerate(ANIMALS)
        ],
        "packs": packs,
    }
    raw = json.dumps(data, ensure_ascii=False, indent=4) + "\n"
    (ROOT / "levels.json").write_text(raw)
    (ROOT / "levels.js").write_text("window.LEVEL_PACK = " + raw.rstrip() + ";\n")
    evidence = {
        "sets": 20,
        "stages": 40,
        "hardReferenceReplays": 20,
        "easyReferenceReplays": 20,
        "easyRandomReplays": 20000,
        "gridBounds": f"6x8x{args.layers}",
        "difficultyStatus": "第二关尚未做人类策略成功率或真人时长标定",
        "hardInitialClickable": {p["slug"]: p["hard"]["initialClickable"] for p in packs},
    }
    (ROOT / "validation.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=4) + "\n")
    print(json.dumps(evidence, ensure_ascii=False))


if __name__ == "__main__":
    main()
