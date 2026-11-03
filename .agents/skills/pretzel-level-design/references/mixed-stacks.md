# 半格与混合堆叠

## 定位单位与完整牌

每张牌按宽、高各二等分，得到 2×2 个布局小格。小格只用于排位置，不是四张可点击牌；第二关仍是 48 张完整牌、12 题、7 格卡槽。

规范数据中的 x/y 仍以一张牌宽为 1，合法步长为 0.5；整数构造小格换算为 x/2、y/2。z 是整数层号。layout_grid 明确 coordinate_unit 为 tile、step 为 0.5、card_footprint_cells 为 [2,2]。不能把小格坐标直接送进单位牌面碰撞算法。

上层牌在紧邻下层只需至少一处正面积重叠，可由一张下层牌支撑，不要求四格被托住，也不校验重心或平衡。仅边缘/角点相触不算支撑或覆盖。初始布局不得同层穿插，不允许完全无支撑的悬空牌；游戏不增加重力或坍塌规则。

## 三种真实关系

- 一盖二：上层沿一个方向错开半张，覆盖下层相邻两张的各一半。
- 一盖四：上层沿两个方向各错开半张，覆盖下层 2×2 四张的各一个角。
- 多盖一：下层同一张牌与多张上层牌相交；须清除所有实际遮挡后才能取。四盖一是其中一种。

指标只统计相邻层真实 XY 牌面重叠；不把跨多层的传递边或镜头透视遮挡误称为四向跨盖。任意部分被盖仍不可点击。

## 生成与配对原型

生成器可直接使用 aligned-control、pair-bridges、quad-bridges、mixed-bridges 四种 profile。前三种分别为直叠对照、盖二重点、盖四重点；混合型的两个峰分别包含盖二与盖四，同时自然产生多盖一。盖四重点本身也可能包含盖二和多盖一，不是互斥分类。

先用 prototype 生成固定的一组对照，不在实验里按玩家表现改牌。

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs prototype --input docs/30-designs/assets/level-pack-v1/height-study/baseline-levels.json --boards 2 --output logs/game-design/new-mixed-prototypes
node .agents/skills/pretzel-level-design/scripts/level-design.mjs run --input logs/game-design/new-mixed-prototypes/levels.json --per-variant 2 --repeats 10 --max-runs 240 --max-seconds 120 --output logs/game-design/new-mixed-run
node .agents/skills/pretzel-level-design/scripts/level-design.mjs verify --output logs/game-design/new-mixed-run
```

boards 是内容种子/源牌局数量，每个输出四种结构，故输出为 4×boards 条，仍受 max-candidates 限制。指定 input 时读取前 boards 个源牌局；不指定时根据 seed 生成内容。源文件只读。

每组严格保持卡牌 ID、动物、题目、参考组与种子；用相同的种子化拓扑排序规则为各结构重新安排坐标，使原参考组都可重放。pair_id 保存内容来源，导入与实验会拒绝配对内容不一致的资料。这是控制内容后的布局对照，不是固定同一张牌的世界坐标。

四种结构均为两峰、48 张、七层，逐层牌数为 24、12、4、2、2、2、2，牌面投影联合占地为 24 张牌面积。本组先隔离覆盖关系，不以它替代其他轮次的紧凑体量设计。

## 输出与解释

levels.json 为规范布局，prototype-manifest.json 保存定位约定、来源与模式计数。PREVIEW.html 提供逐层查看和四格定位线开关，svg/ 保存每个原型的独立矢量图。预览没有取牌交互，其轴测镜头只用于看结构。

本轮原型的规则模型统一为 logical-xy；不能把预览中相机造成的额外遮挡当作经过验证的点击集合。以后接入 isometric-body 或微信渲染时，应另做模型与实际点击一致性验证，不静默改模式。

报告分别列出相邻层盖二/盖四/多盖一/四盖一计数、有效依赖深度和可点击数量。半格错位会增加不同 XY 锚点，不能继续以“锚点个数”冒充占地；占地用单位牌面矩形联合面积，另列 XY 锚点和牌面积密度。

比较无道具通关、零储备视频使用、最多一/二/三次视频内通关、满储备、首次受阻与失败原因。结构更复杂不保证策略更难，结果未达目标或预算耗尽都收口，不临时调参凑百分比。
