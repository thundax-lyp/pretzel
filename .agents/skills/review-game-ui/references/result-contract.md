# 检测点单项报告与统一返回格式

本文件规定检测队列项的唯一返回格式。先按 [检测队列](review-queue.md) 领取任务，读取任务直接指向的 `checks/<category>.md#<point-anchor>`，并执行该点选定的整组检测方法。一个队列项由一个 owner 完成并返回；一个 subagent 可以领取多个独立队列项，每项仍单独成报告。

## 文件与职责

| 文件                     | 写入者       | 内容                                                                  |
| ------------------------ | ------------ | --------------------------------------------------------------------- |
| QUEUE.json               | parent agent | 截图清单、检测队列、必要方法选择与任务状态                            |
| `results/<item-id>.json` | 该项 owner   | 一个检测点在指定截图、对象和状态上的完整方法记录与结论建议            |
| `results/<item-id>.md`   | 该项 owner   | 从同名 JSON 展开的单项人读报告                                        |
| DECISIONS.json           | parent agent | 已采纳结果、统一修改意见及逐截图动作，见 [报告交付](report-output.md) |

结构化返回统一使用 UTF-8 JSON、下述英文键和枚举；不另外生成 CSV、TSV 或自定义同义字段。未使用的数组写 `[]`，必要字段不能因缺证而删除。Markdown 只展开 JSON 内容，不维护另一套结论或证据。

## 单项 JSON

每个结果文件只包含一个对象，字段固定如下。任务包中的标识、截图、对象及状态必须原样回传。

| 字段           | 类型与要求                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| schema_version | 整数，当前为 `1`                                                                                            |
| review_id      | 字符串，与当前队列一致                                                                                      |
| item_id        | 字符串，对应唯一队列项                                                                                      |
| item_revision  | 整数，与该队列项当前 revision 一致                                                                          |
| point_id       | 字符串，只能有一个检测点编号                                                                                |
| frame_ids      | 字符串数组，与任务一致；单截图任务一项，关系任务显式列出参与截图                                            |
| frame_hashes   | 对象，键为 frame_id，值为实际读取文件的 64 位十六进制 SHA-256；无法读取时为 null 并说明阻塞，不能照抄预期值 |
| object_ids     | 字符串数组，与任务一致，不能自行扩展审核对象                                                                |
| state          | 字符串，与任务指定的状态和条件一致                                                                          |
| methods        | 方法记录数组，包含每个 selected=true 的方法，不能漏项或重复                                                 |
| conclusion     | `pass`、`adjust`、`pending` 或 `not_applicable`                                                             |
| coverage       | `complete` 或 `incomplete`，与结论分别判断                                                                  |
| reason         | 字符串，解释该点建议结论、证据边界及未完成部分                                                              |
| findings       | 候选意见数组；没有候选意见时为 `[]`                                                                         |

每条 methods 记录固定包含：

| 字段         | 类型与要求                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| method_id    | 字符串，必须属于该项选定方法                                                                                                          |
| execution    | `completed`、`partial`、`not_run` 或 `interrupted`                                                                                    |
| steps_done   | 字符串数组，记录实际完成步骤；未执行时为 `[]`                                                                                         |
| observations | 字符串，具体观察或测量结果；未执行时写明原因，不填预期结果                                                                            |
| evidence     | 证据数组，每项为 `{ "source": "材料路径或事实来源", "locator": "区域、时间、事件或测量定位", "observation": "该证据支持的具体观察" }` |
| limits       | 字符串数组，明确未覆盖步骤、状态或证据；必要步骤缺失时不能为空                                                                        |

每条 findings 记录固定包含：

| 字段             | 类型与要求                                             |
| ---------------- | ------------------------------------------------------ |
| finding_id       | 字符串，在本项中唯一，例如 `Q001-F01`                  |
| method_ids       | 字符串数组，指向本项中实际支持该意见的方法             |
| frame_ids        | 字符串数组，只列具体受影响截图，必须属于本项 frame_ids |
| location         | 字符串，说明页面区域、对象与关系，不能只写素材名       |
| observation      | 字符串，已见偏离；原因推测应明确标识，不与观察混写     |
| impact           | 字符串，对当前任务、信息或审美目标的具体影响           |
| suggested_change | 字符串，说明修改方向及保留点，不自行要求新增能力       |
| verification     | 字符串数组，说明如何复核这条候选意见                   |

## 状态与结论的含义

| 字段值                    | 含义                                                           |
| ------------------------- | -------------------------------------------------------------- |
| execution=completed       | 已完成任务要求的该方法步骤；仍须核对证据是否满足检测点判据     |
| execution=partial         | 只完成部分步骤，steps_done 与 limits 分别说明完成部分和缺口    |
| execution=not_run         | 尚未执行或缺少必要输入，说明具体原因                           |
| execution=interrupted     | 已开始但中断，保留实际步骤及停止位置                           |
| conclusion=pass           | 所有选定必要方法完成，最低证据足够，且该点判据在指定范围内成立 |
| conclusion=adjust         | 已有足够证据证明具体偏离；其他方法仍缺证时 coverage=incomplete |
| conclusion=pending        | 适用，但必要方法或证据不足，且没有足够证据证明偏离             |
| conclusion=not_applicable | parent 已在队列中声明该项不适用并给出依据；不是“没有截图”      |
| coverage=complete         | 所有适用必要方法及证据要求均已覆盖，或该项有明确的不适用依据   |
| coverage=incomplete       | 仍有未执行、部分执行、中断或必要证据缺口                       |

必要方法缺材料时仍在 methods 中保留 `not_run` 记录。不能为了填通过删掉方法，也不能在发现问题后停止该项剩余方法。条件性方法以 parent 的 method_plan 为准；未选用的条件方法不生成执行记录，其理由保留在队列。

无法读取的截图仍保留 frame_hashes 键并写 null，reason 和对应方法 limits 写清阻塞。parent 不将此类结果设为 accepted，而是重核材料、取消已删除范围或安排 needs_recheck；可以在总报告列出该执行缺口，不据此形成已确认修改意见。

`not_applicable` 结果的 methods 和 findings 均为 `[]`，coverage 为 `complete`，reason 与队列依据一致。owner 发现原适用性判断错误时先回报 parent，由 parent 调整队列项 revision 后再生成结果，不自行以不适用收掉任务。

共享画面、录屏或事实可以作为多个点的证据，但每个点独立对照自身判据；同一份证据的复用不代表额外试验。多个方法的结果不投票、不取平均。

`adjust` 必须有至少一条可追溯的 finding 和实际证据；只有猜测或建议补验时用 pending。缺证不能靠将 conclusion 改为 adjust 绕过方法覆盖要求。

## 部分执行示例

下面展示一个字号检测点的方法组合。示例不代表任何实际截图已经接受审核；调用时使用真实标识、哈希和观察。

```json
{
    "schema_version": 1,
    "review_id": "review-example",
    "item_id": "Q001",
    "item_revision": 1,
    "point_id": "TXT-02.1",
    "frame_ids": ["S001"],
    "frame_hashes": {
        "S001": "填写实际读取文件的64位SHA-256"
    },
    "object_ids": ["HOME-AUX-TEXT"],
    "state": "首页少量内容、辅助说明正常显示",
    "methods": [
        {
            "method_id": "M-04",
            "execution": "not_run",
            "steps_done": [],
            "observations": "缺少目标物理显示与观看条件，未执行实际尺度阅读。",
            "evidence": [],
            "limits": ["需要目标尺度下实际完成阅读，并记录条件。"]
        },
        {
            "method_id": "M-05",
            "execution": "partial",
            "steps_done": ["读取截图像素尺寸并定位文字区域。"],
            "observations": "仅能确认图中的相对体量，尚不能换算逻辑字号。",
            "evidence": [
                {
                    "source": "screens/home.png",
                    "locator": "辅助说明文字区域",
                    "observation": "保留实际文件尺寸与对象位置，不猜测字体逻辑尺寸。"
                }
            ],
            "limits": ["缺少可靠的缩放与字体尺寸依据，测量未完成。"]
        }
    ],
    "conclusion": "pending",
    "coverage": "incomplete",
    "reason": "该点适用，但必要阅读与测量均未取得完整证据。",
    "findings": []
}
```

## 单项 Markdown 报告

`results/<item-id>.md` 按固定顺序展开同名 JSON：

1. **任务身份**：item_id、revision、point_id、截图路径与 frame_id、对象、状态、哈希和该点 reference。
2. **检测点与判据**：本次要回答的问题、通过判据、最低证据、选定方法及条件性方法依据。
3. **逐方法记录**：实际步骤、执行状态、观察、证据定位和限制，每种方法独立一行或小节。
4. **单项结论**：结论建议、覆盖状态及综合理由，不把部分方法通过写成整个点通过。
5. **候选意见与补验**：候选 finding_id、受影响截图、具体修改方向、缺口及复核方式。

报告只对这个队列项作答，不顺带输出整页最终修改方案。后者由 parent 在统一根因和方向后按 [报告交付](report-output.md) 展开。

## parent 接收检查

parent 依据当前队列检查，而不是根据 worker 的摘要直接收口：

1. 字段名、类型与枚举正确；item_id、point_id、item_revision、frame_ids、frame_hashes、object_ids、state 与当前任务相符。材料变化或 revision 失效的结果不采纳，明确重检范围。
2. methods 与 selected=true 的 method_plan 集合完全一致，每个方法恰好一条；完成状态有具体步骤和证据支持，未完成部分有 limits。空 evidence 不支持通过必要取证步骤。
3. findings 引用的方法与截图均存在；具体偏离、影响和修改方向可追溯。必要方法缺证不抹掉已确认偏离，也不把整个点视为覆盖完成。
4. pass 必须 coverage=complete，全部必要方法 execution=completed，且证据达到该点门槛；pending 必须 coverage=incomplete。adjust 的 coverage 可为两者，但应符合实际方法和证据覆盖。not_applicable 必须与队列声明一致。
5. 同项方法相互矛盾时回看原证据或补验，保留分歧处理。回收后再形成统一意见；缺返回、工具失败和中断保留为执行缺口，不算通过。

这一步验证返回结构与证据关联，不自动证明审美正确。格式不合格时让原 owner 修正结构；证据缺失时补验或保留 pending，不能仅改状态凑齐报告。
