# Document Rules

## Purpose

本文档定义 pretzel 内需求文档、设计文档和 AI 输入文档的统一写作要求，让文档适合 AI 读取、工程实现和持续维护。

## File Naming

- 文档文件名使用大写英文，可用 `-` 连接单词。
- 文件名不得使用中文或空格。
- 治理文档固定放在 `docs/00-governance/`。
- `RUNBOOK` 文档固定放在 `docs/30-designs/`，命名为 `RUNBOOK-XXX.md`。
- `HOW-TO` 文档仅在用户明确要求沉淀稳定流程时新增，命名为 `HOW-TO-XXX.md`。

## Navigation

根 AGENTS 只指向 docs/README.md。docs/README.md 按主题直接链接各份文档，分类目录不再单独建立导航 README。其他文档只维护自身内容。

现有归档资料不恢复为现行文档；当前需求与设计重新编写并独立维护。

## Language Rules

- 文档说明内容使用中文。
- 代码定义、模块名、类名、接口名、字段名、工具名和协议名保留英文原文。
- 不为了“纯中文”翻译代码概念，也不为了“纯英文”改写业务说明。

## Content Principles

- 文档必须清晰、明确、可执行。
- 项目文档独立定义本项目的需求、契约和规则，不通过引用其他项目的规范或迁移过程解释现行规则；必要定义应在本项目内完整维护。
- 代码来源、许可与版权声明由 NOTICE 和 LICENSE 承载，不以治理文档替代。
- `docs/01-requirements/` 只写已确认交付范围内的最终需求。
- 稳定规则进入 `00-governance/`；复杂任务的临时执行说明进入 `RUNBOOK-*`。
- 同一规则不得在多处重复且表述不一致。
- 治理文档只沉淀稳定规则，不记录任务执行过程。
- 初始化文档只记录最终配置、当前能力、验证结果与未覆盖范围，不保留迁移、替换、排错或逐轮执行历史；初始化 PR 以最终环境状态描述交付范围。
- `50-prompts/` 只保存人工触发的提示词模板。

## Diagram Rules

- Mermaid 流程图必须使用 ELK 布局，并在 `mermaid` 代码块内显式声明 `config.layout = elk`。
- 非流程图 Mermaid，例如 `stateDiagram-v2`，不强制使用 ELK 布局。

## RUNBOOK Boundary

`RUNBOOK` 是复杂任务的临时执行手册，适用于跨模块清理、迁移、删除、重构、运行时验收或业务闭环收口。

`RUNBOOK` 不是需求真相源，不替代 `docs/01-requirements/`、当前工程契约或治理文档。任务执行过程中可以用 RUNBOOK 记录范围拆解、执行顺序、验证命令和临时风险，但长期规则必须沉淀到 `docs/00-governance/`，验证结果归入对应工程的设计或交付文档。

RUNBOOK 固定包含：

- `Purpose`：说明本次执行目标。
- `Scope`：说明纳入本次闭环的模块、页面、接口或文档。
- `Non-goals`：说明明确不纳入本次闭环的事项。
- `Plan`：列出可执行步骤。
- `Verification`：列出需要运行或记录的验证。
- `Closure`：说明任务完成后要删除 RUNBOOK，或把证据沉淀到哪个 readiness/evidence 文档。

任务关闭时，必须清理 RUNBOOK 及残留引用；如果 RUNBOOK 中存在仍有长期价值的结论，必须先迁移到对应需求、接口、readiness 或治理文档，再删除临时 RUNBOOK。
