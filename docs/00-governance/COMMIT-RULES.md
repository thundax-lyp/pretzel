# Commit Rules

## Purpose

本文档是 pretzel 提交粒度、提交内容和消息格式的唯一规则入口。

## Boundary

- 一个 commit 记录一个可理解、可验证的工程判断；代码、必要测试、契约和机械清理应一起提交。
- 2–20 个文件只是检查内聚性的参考，不是硬限制。不得为了凑文件数拆出无法独立理解或验证的提交。
- 相互独立的功能、治理和无关清理分别提交；同一能力的必要配套修改保持完整。
- 中间提交必须说明具体判断，不得故意留下不明确的破坏；涉及运行入口时执行最小相关验证。
- 提交前检查完整 diff 和暂存区，不混入用户改动、真实凭据、backup 或生成产物。
- 提交、推送、开 PR 和合并按用户授权范围执行，文档规则本身不构成操作授权。

## Message

固定格式：`Type(scope/module): 中文说明`。

- Type 使用 Feat、Fix、Docs、Test、Refactor、Build、CI、Chore 等准确类型。
- scope 表示工程或交付区域；module 表示该区域内的业务域或能力，两者都必填，用一个 `/` 分隔。
- scope 和 module 使用下表登记的小写英文值，多个单词用 `-` 连接，不使用拼音、中文或逗号列表。
- 中文说明写具体能力与结果，避免仅写“调整”“修改”“优化”。

## Scope And Module

| scope       | 范围                             | module 及含义                                                                                                                                                 |
| ----------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| miniprogram | frontend/miniprograms 微信小游戏 | start、home、game：三个页面及其页面内能力；auth：客户端认证；http：网络请求；ui：共享界面能力；app：应用入口与全局生命周期；build：开发者工具及构建配置       |
| docs        | 文档                             | governance：稳定工程规则；requirements：产品需求；interfaces：接口与事件契约；design：技术与专项设计；readiness：验收和发布证据；guide：README 及开发使用说明 |
| ci          | .github 自动验证                 | verify：跨工程统一验证；pr：PR 模板及 PR 自动化                                                                                                               |
| tooling     | scripts 开发工具                 | env：环境加载；tunnel：基础环境隧道；verify：本地检查编排                                                                                                     |
| repo        | 仓库整体                         | config：仓库级配置与忽略规则；legal：许可与来源声明；structure：工程目录组织；cross：确实不可拆分的跨工程改动                                                 |

以上值描述归属，不代表对应能力已经实现；例如小程序 auth/http 当前是否存在以源码为准。新增能力优先归入已有 module；确有新的稳定边界时，在同一提交中补充登记，避免临时同义词。

## Selection Rules

- 先根据主要改动归属选 scope，再按业务域或能力选 module；Type 不参与归属判断。例如首页开发说明使用 `Docs(docs/guide)`，首页代码使用 `Fix(miniprogram/home)`。
- 代码及其必要测试、文档放在同一提交时，按主要能力归属命名；纯文档修改使用 docs，纯共享测试支撑使用对应工程的 test。
- 一次提交涉及多个 module，选择承载主要工程判断的 module；独立判断拆分提交。同一 scope 的少量配套文件不改变归属。
- `repo/cross` 仅用于无法独立交付、跨多个工程且不存在明确主归属的同一变更，例如全仓工程名统一；不得用它容纳无关修改。不要以 all、misc 或多个 scope/module 并列替代判断。
- 历史提交不改写；新提交使用本规则。Git 自动生成的 merge/revert 消息保留 Git 原生格式，手工编写的普通提交使用本规则。

## Examples

```text
Fix(miniprogram/home): 恢复首页加载失败后的重试入口
Refactor(miniprogram/ui): 统一牌面节点的尺寸配置
Feat(miniprogram/game): 实现卡槽满额失败判定
Docs(docs/governance): 定义提交范围与模块命名
CI(ci/verify): 增加前端验证步骤
```
