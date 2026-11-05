# 工作流与交付

## 冻结本轮范围

先从当前项目需求提取题数、牌数、卡槽、失败和道具规则；本工具支持第二关，第一关及微信运行时不属于它的验收范围。列出本轮候选、场景、策略、参数和停止条件。

默认是一轮固定候选比较，最多 80 个输入记录、每结构两关、每关三次决策、三场景，最多 100 次模拟和计算子进程 120 秒。用户指定预算优先。需要下一轮时先说明新假设与预算，不在同一任务里无限调参。

## 选择模式

### 新关卡

先生成少量原型，验证后再推广主题。半格跨盖与配对生成按 mixed-stacks.md 执行。生成器支持二/三/四峰、明确的参考用牌曲线和独立校准筛选。参考张数不约束玩家其他合法组合。

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs generate --boards 1 --profile three-peaks --curve balanced --difficulty challenging --max-candidates 60 --output logs/game-design/new-generated
```

open 不筛难度；challenging 使用 -3、-2、-1 三次校准，要求均未通关、至少完成前三题、没有搜索触界。每关最多 60 个布局候选，且所有生成候选合计不能超过 max-candidates；失败明确报错，不返回不合格布局。生成器内部还有限制内容分配重试，不承诺真人难度。正式评估使用其他重复种子，并保留选择记录。

### 现有布局

读输入契约，导入源文件，不生成一个外形相似的替代模板。

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs import --input docs/30-designs/assets/level-pack-v1/height-study/variants.json --output logs/game-design/new-import
```

### 固定预算实验

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs run --input logs/game-design/new-import/levels.json --per-variant 2 --repeats 3 --max-candidates 80 --max-runs 100 --max-seconds 120 --output logs/game-design/new-experiment
node .agents/skills/pretzel-level-design/scripts/level-design.mjs verify --output logs/game-design/new-experiment
```

输出目录必须尚不存在。现有设计只读；新生成的输入也冻结后再评估。比较布局时固定动物、题目和决策重复，调参与最终验证样本分开。已有素材只能称现有样本回归，不能冒称全新验证集。

## 验证与收口

先验证参考路径、实际可点击集合、模型一致性与牌实例守恒，再分析玩家策略。有限搜索没有找到解时标不确定；实际修复必须有完整证书。单独检查手机可读、点击区域和渲染，本命令不会代替视觉验收。

输出原型/推荐方案、输入和代码指纹、每组实际/计划次数、结构指标、视频/道具/失败分布、时间假设、未达目标原因及剩余缺口。达标、未达标或预算耗尽都结束本轮；实验完成不等于商业目标完成。

涉及主、侧对话时，明确谁负责规则与最终结论，谁负责视觉与结构，交换同一数据格式，不同时改相同算法。默认先做少量原型，验证后才决定推广。对话工具不可读时，以现有文件证据说明边界，不能声称对话已完成。

## 执行模块

| 文件             | 职责                                       |
| ---------------- | ------------------------------------------ |
| level-design.mjs | 单一 CLI 入口                              |
| catalog.mjs      | 固定动物、曲线、种子算法与数值工具         |
| geometry.mjs     | 两种遮挡模型，分离轴测试与独立裁剪算法     |
| game.mjs         | 卡槽、道具、储备、免费复位、纠错状态与事件 |
| levels.mjs       | 生成、统一导入、参考解和结构指标           |
| simulation.mjs   | 有限搜索、候选分配、修复布局、策略与统计   |
| replay.mjs       | 用独立集合/坐标判定重放动作与修复证书      |
| experiment.mjs   | 计算子进程、硬预算、证据聚合和核验         |
| report.mjs       | 自动可读报告                               |
| io.mjs           | 参数、快照、指纹与逐行记录                 |

测试放在 scripts 下的 `.test.mjs`，使用 `node --test`。Skill 运行无第三方依赖，不调用 Python，也不依赖侧对话私有适配器。

混合堆叠的 stack-layouts.mjs 定义半格形状、单支撑合法性、真实关系与占地；preview.mjs 只输出结构 HTML/SVG 预览，不承担点击判定。

## 当前动作规则

暂存牌点击使用免费 restore 动作，先校验取牌时记录的原位、底牌身份与坐标，复位后重新形成覆盖。取入卡槽只接受棋盘中的无遮挡牌。策略先按已有可行路线取牌，缺少路线时尝试自下而上复位，避免立即撤销移出效果。

实验道具键为 remove、correct、repack，正式客户端枚举为 REMOVE、CORRECT、REPACK。重排和纠错的修复证书包含完整剩余解，所有待复位位置与底牌实例约束在方案验证时保留。候选布局被复位约束拒绝时记录搜索边界，不当成数学无解。
