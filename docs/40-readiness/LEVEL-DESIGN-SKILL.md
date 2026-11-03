# 关卡设计 Skill 与统一实验验收

## 最终组织

项目 Skill 位于 `.agents/skills/pretzel-level-design/`，采用入口、参考资料、执行模块分离：

- SKILL.md：任务路由与必要边界。
- references/workflow.md：工作流、协作、阶段终点和模块职责。
- references/layout-contract.md：输入格式、来源身份与遮挡模型。
- references/experiment-contract.md：参数、预算、证据和结论口径。
- scripts/：Node.js 22 原生 `.mjs`，无第三方依赖，也不调用 Python 包装器。

入口为 scripts/level-design.mjs。catalog、geometry、game、levels、simulation、replay、experiment、report、io 分别负责内容与随机数、几何、状态、生成导入、策略、独立核验、计算进程、自动报告和证据读写。测试采用 `.test.mjs` 与 node:test。

仓库已有 Python 研究工具仍供独立 study.py 等调用，不属于 Skill 的执行链。Skill 专用的根目录 Python 编排器及测试已移除，命令、文档和 CI 均改为 Skill 内的 `.mjs`。

## 能力与边界

支持第二关 48 张、12 题、7 格卡槽。统一导入 native、level-pack 的 hard 关和 height-study，保留实际坐标、动物、题序、参考解及来源。不同结构可共用随机种子，不按种子覆盖身份。

logical-xy 与 isometric-body 按数据声明执行；投影参数随输入保存。导入核对源覆盖，生产几何使用分离轴测试，独立投影回放使用多边形裁剪，不用模板替代真实结构。

生成支持二、三、四峰和参考用牌曲线；challenging 用独立校准重复 -3、-2、-1 筛选，每关最多 60 候选且总候选受预算限制。有限搜索触界标不确定，不声称数学无解。

run 只比较一轮固定输入，不自动追加候选或继续调参；verify 重算来源、布局、动作、修复证书、计数、时长模型与汇总；report 验证后重建摘要。

## 预算与证据

默认最多导入 80 条，每结构两关、每关三次决策，比较无道具、零储备、满储备；最多 100 次模拟、计算子进程 120 秒。超时时父进程终止子进程，保留完整写出的记录，未运行案例不计失败。报告和显式 verify 另计时间。

退出码 0 表示完整结束，2 表示次数或时间预算停止，1 表示错误。输出包括 input.json、config.json、所有模块 SHA-256、source/ 下完整 `.mjs` 快照、journal.jsonl、report.json、REPORT.md 和 worker.stderr。源码快照可脱离当前工程版本独立验证。

Node 随机算法为 sha256-xorshift32-v1，版本与种子记录在配置中；不承诺和 Python 决策序列或统计相同，两种实现的结果不混用。

## 现有关卡端到端验证

使用原有 height-study/variants.json 的四、六、七、八层布局，共 80 个。全部参考解通过，位置、动物、目标、参考组和源覆盖保持不变。

每档取前两关，共八个真实布局，每关三次决策和三场景，共 72 次；计划、实际及独立回放均为 72，状态 complete。另直接使用 source/level-design.mjs 验证该轮报告，通过。

| 结构 | 每场景次数 | 无道具通关 | 零储备视频使用 | 零储备最多三次视频内累计通关 | 满储备视频使用 |
| ---- | ---------: | ---------: | -------------: | ---------------------------: | -------------: |
| 四层 |          6 |         0% |           100% |                         100% |         16.67% |
| 六层 |          6 |        50% |            50% |                         100% |             0% |
| 七层 |          6 |     16.67% |         83.33% |                         100% |             0% |
| 八层 |          6 |         0% |           100% |                         100% |             0% |

每格仅六次，验证的是工具链，不证明高度与难度单调相关或真人广告目标达成。主报告保存于 Git 忽略的 logs/game-design/skill-node-validation/，归一化输入在 skill-node-import/。

此外，用原生 Node 回放了现有四个高度、三个场景各一条既有动作记录，共 12 条；未执行 Python。该检查只验证这些已记录操作在新规则实现下仍合法，不比较随机决策统计。

## 预算停止验证

- 次数上限：计划 12 次、max-runs 为一，完成一次后停止，返回 2，其余组标为缺失；独立核验通过。证据为 logs/game-design/skill-node-budget/。
- 硬超时：max-seconds 为 0.001，返回 2，完成零次、计划尚未建立，不宣称任何参考解在该次预算内完成；独立核验通过。证据为 logs/game-design/skill-node-timeout/。

## 检查

46 项 Node 规则与集成测试通过，并加入 admin CI 的 Node 22 环境。覆盖生成确定性和独立筛选、80 个真实布局、超过 31 的卡牌编号、整槽判定、满槽优先级、无限暂存、共享视频上限、回溯不返还消耗、自动修复证书、模型隔离、预算、部分记录、数值型结构标签顺序、篡改拒绝及快照独立验证。

Skill frontmatter、引用、原生脚本 Oxlint、仓库格式和结构检查通过。原有视觉素材未改写，未提交或推送。

## 复现

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs import --input docs/30-designs/assets/level-pack-v1/height-study/variants.json --output logs/game-design/new-node-import
node .agents/skills/pretzel-level-design/scripts/level-design.mjs run --input logs/game-design/new-node-import/levels.json --per-variant 2 --repeats 3 --max-candidates 80 --max-runs 100 --max-seconds 120 --output logs/game-design/new-node-experiment
node .agents/skills/pretzel-level-design/scripts/level-design.mjs verify --output logs/game-design/new-node-experiment
node --test .agents/skills/pretzel-level-design/scripts/*.test.mjs
```

输出目录须尚不存在。默认知道全部牌属性与遮挡、接受推荐、视频成功并按提示操作；时间是占位参数。真人观看意愿、实际 4—6 分钟、视觉和微信运行时不属于本次验收。
