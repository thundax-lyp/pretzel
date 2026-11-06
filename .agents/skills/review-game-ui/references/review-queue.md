# 从检测点列表建立检测队列

先由 parent 整体观察输入画面并划分对象，再读取 [检测点列表](review-checks.md) 选点。每个点直接进入 `checks/<category>.md#<point-anchor>`，取得该点自己的判据、方法组及适用条件；返回要求统一见 [单项结果契约](result-contract.md)。队列是本次具体执行清单，不能以分派一句“检查首页”替代。

## 队列项的边界

默认一个队列项为：**一张截图＋对象或对象关系＋一种状态与条件＋一个检测点**。该点选中的全部方法由同一 owner 执行并收口。跨图关系可以列多张截图，但须说明比较关系，每张实际受影响图仍分别输出修改动作。

检测点是排队、分派和单项报告的单位，方法是该点内部的执行步骤。允许一个 subagent 批量领取多个独立队列项以复用材料；每项仍保留自己的结果文件，不合成一个覆盖全页的笼统结论。共享采集可以复用证据，不把方法拆给多人后丢失检测点的负责人。

## 从列表到队列

1. **登记材料**：给每张实际输入截图分配 frame_id、逻辑 page_id、精确路径、SHA-256、批次和状态；raw/logical、旧图、参考稿和过程拼图分别标识。索引、规则、录屏等辅助材料不当作截图。
2. **整体先行**：parent 先看完整画面和必要相邻流程，记录主题、重心、比例、保留项及主要失衡。VIS、CORE 的对应项由 parent 留底；其动态或事实缺口不阻止有材料支持的分类检查。
3. **拆对象和选点**：按当前任务拆区域、复合对象和必要子元素，为每个对象选择全部适用点。按领域记录选用范围与排除理由；不能只选容易通过的点。已有能力缺状态或缺材料仍入队并保留待验，不标为不存在。
4. **读取本点方法组**：按分类文件中的检测点锚点定位该节，展开其必要方法；条件方法写明 selected 与 reason。条件成立但缺材料时仍选中，执行结果将记录 not_run 或 partial。条件未明且影响结论时纳入待验；只有条件明确未触发才不选。共享方法的执行与产出要求在对应主题文件的方法节维护，不能用邻点的方法组替代本点计划。
5. **生成条目**：为每个边界明确的项分配 item_id 和 revision，写入 QUEUE.json。相关对象和状态可能产生不同结果时分项，不用多个截图混写的状态掩盖差异。
6. **批量分派**：按材料可共享性、依赖和可用并发分批领取独立项。具体安排见 [并行审核](parallel-review.md)，返回固定使用 [单项结果契约](result-contract.md)。

同一次已执行观察可支持多个点，但每个点仍需对照自己的判据；点数、方法引用数和独立试验次数分别理解。材料很多时分批完成队列，不能为了控制篇幅删除适用项。

## QUEUE.json

队列只由 parent 写入。结构化字段使用下表中的英文键，JSON 为 UTF-8；当前 schema_version 为 `1`。

| 顶层字段       | 内容                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| schema_version | 整数，当前为 1                                                                                                                    |
| review_id      | 本次审核的唯一标识                                                                                                                |
| frames         | 截图登记数组，下表定义其字段                                                                                                      |
| sources        | 辅助材料数组，记录 source_id、path、sha256、kind；分类与方法文件按实际文件去重，path 不含锚点，sha256 对整个文件计算；没有则 `[]` |
| selection      | 选点依据数组；每条为 frame_ids、object_ids、point_ids、reason、excluded，excluded 中写 point_ids 或领域前缀与排除依据             |
| items          | 实际检测队列项数组                                                                                                                |

每条 frames 记录：

| 字段              | 内容                                                               |
| ----------------- | ------------------------------------------------------------------ |
| frame_id          | 本次审核内唯一，例如 S001                                          |
| page_id           | 逻辑页面，例如 home、collection；不同状态截图可以共享 page_id      |
| path              | 可定位的实际文件路径                                               |
| sha256            | 实际文件的 64 位十六进制 SHA-256                                   |
| kind              | screenshot、reference 或 composite                                 |
| batch             | 已知材料批次；未知构建明确写未知，不从文件名推断                   |
| state             | 本图实际展示的内容和阶段                                           |
| related_frame_ids | 原图/裁剪图或必要对照的关联编号，没有则 `[]`；关联不等于同构建证明 |

每条 items 记录：

| 字段                 | 内容                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| item_id              | 本次队列内唯一，如 Q001                                                                        |
| revision             | 从 1 开始；该项材料、状态、范围或方法计划改变时递增                                            |
| point_id             | 唯一检测点编号，如 TXT-02.1                                                                    |
| point_ref            | 分类 reference 的文件路径加检测点锚点；如 checks/typography.md#txt-021，必须与 point_id 对应   |
| frame_ids            | 本项明确检查的截图编号数组；默认只有一张，关系项列出全部参与者                                 |
| object_ids           | 本图实际对象或关系的编号数组                                                                   |
| state                | 本项的实际状态与条件，不能含未展示状态的默认通过暗示                                           |
| applicability        | applicable 或 not_applicable                                                                   |
| applicability_reason | 选用或不适用的具体依据；缺材料不是不适用理由                                                   |
| method_plan          | 方法计划数组，每条为 method_id、selected、reason；必要方法 selected=true，条件方法保留选择理由 |
| owner                | parent 或被分配的 subagent/task-id；待分配时为 null                                            |
| status               | queued、assigned、returned、accepted、needs_recheck 或 cancelled                               |
| status_reason        | 当前排队、接收、返工或取消的依据；取消和返工时不能为空                                         |

读取 point_ref 时先分离文件路径与 `#` 后的锚点，打开实际文件后定位对应检测点节，再核对 point_id。不能把锚点当作文件名的一部分，也不能解析分类文件中的第一个检测点来代替当前条目。sources 仍记录去重后的实际文件路径与整个文件的哈希。

```json
{
    "schema_version": 1,
    "review_id": "review-example",
    "frames": [
        {
            "frame_id": "S001",
            "page_id": "home",
            "path": "screens/home.png",
            "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
            "kind": "screenshot",
            "batch": "示例批次，调用时填写真实来源",
            "state": "首页少量内容、辅助说明正常显示",
            "related_frame_ids": []
        }
    ],
    "sources": [],
    "selection": [
        {
            "frame_ids": ["S001"],
            "object_ids": ["HOME-AUX-TEXT"],
            "point_ids": ["TXT-02.1"],
            "reason": "示范一个文字检测点的选取，实际审核须补齐所有适用点。",
            "excluded": []
        }
    ],
    "items": [
        {
            "item_id": "Q001",
            "revision": 1,
            "point_id": "TXT-02.1",
            "point_ref": ".agents/skills/review-game-ui/references/checks/typography.md#txt-021",
            "frame_ids": ["S001"],
            "object_ids": ["HOME-AUX-TEXT"],
            "state": "首页少量内容、辅助说明正常显示",
            "applicability": "applicable",
            "applicability_reason": "辅助说明在本图存在，需要检查实际尺度阅读。",
            "method_plan": [
                {
                    "method_id": "M-04",
                    "selected": true,
                    "reason": "本点必要方法。"
                },
                {
                    "method_id": "M-05",
                    "selected": true,
                    "reason": "本点必要方法。"
                }
            ],
            "owner": null,
            "status": "queued",
            "status_reason": "等待分配本点整组方法。"
        }
    ]
}
```

示例的哈希和内容不能作为实际材料，真实执行须重新读取、计算和填入。not_applicable 条目 method_plan 为 `[]`，仍保留点与依据以便回收；未选用的条件方法则保留在适用条目的 method_plan 中，二者不同。

## 变化、返工与收口

- 条目按 queued → assigned → returned 流转。parent 每收到一项或一个分片的结果，核对其 item_id、revision 与返回文件是否齐全后，立即将这些项的 returned 及 status_reason 写回 QUEUE.json，再进行证据与结论验收；不能让已返回项一直停在 assigned，等全部分片结束才批量设 accepted。returned 仅表示当前版本结果已返回，不表示通过或覆盖完成。
- parent 逐项验收后写回 accepted；结构、证据或结论需修正时写回 needs_recheck，指定原 owner 补充。只有摘要、缺文件、版本不符或迟到返回不能标记当前项 returned，按真实缺口记录；未返回项保留 assigned。同一有效条目只有一个负责人，worker 不直接修改共享队列。
- 截图删除、替换或规则/方法计划改变时，parent 重新核对范围，取消不再适用的条目或增加 revision，并更新受影响条目；其他未变化项可以保留。结果必须匹配当前 revision 与 frame_hashes，旧结果不能直接接收。
- 同一 item_id 修订或更换 owner 前，先确认原 owner 已停止写入该项结果，再更新 revision 和分派。无法确认旧 owner 已停止时，取消旧项并分配新的 item_id 和结果路径；不让迟到返回覆盖当前结果。单纯改 revision 不能保护同名文件。
- 条目变更会使其已采纳结论失效：同步从当前采纳集合移出，关联 opinion/action 和逐图计划标为待复核，补验后重新接收。DECISIONS.json 记录采纳时的 item_revision 和 frame_hashes，不能只凭相同 item_id 沿用旧方案。
- cancelled 只表示不再纳入本次范围，要有原因；工具失败、超时或缺截图不能自动将既定适用能力取消。最终页面清单以仍在 frames 中的输入为准，删除材料不再生成修改动作。
- 所有选中方法都应有实际执行或明确缺口的返回；返回文件存在不等于 accepted。parent 核对单项报告后才按 [报告交付](report-output.md) 形成统一意见及逐截图清单。
- 最终核对 selection 中适用点与 items 一致、独立项都有结果或明确未覆盖状态、每张当前截图都有页面修改报告。留有 queued、assigned、needs_recheck、无返回或待验证项时说明覆盖未完成。
