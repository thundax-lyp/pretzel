# PR Rules

## Purpose

本文档定义 pretzel 阶段性交付、验证和合并规则。提交规则只在 COMMIT-RULES.md 维护。

## Delivery Boundary

- 代码通过独立分支、PR、review 后进入 main，不直接推送或绕过 PR 合并到 main。
- 一个 PR 尽量形成一个可验收闭环；跨域时说明不可拆分原因、受影响契约和额外验证。
- 合并前必须完整、可编译、可测试，完成需求、接口、治理文档及临时 RUNBOOK 收口。
- 标题采用 COMMIT-RULES.md 定义的 `Type(scope/module): 中文说明` 格式及 scope/module 登记表，描述使用 .github/pull_request_template.md。
- 默认普通 merge commit 保留小步历史，仅在用户明确要求时 squash；任何远端操作仍须符合用户授权。

## Verification

统一 CI 入口为 .github/workflows/ci.yml，必须显式列出检查，不通过单个脚本隐藏必过项。当前 workflow 仅对面向 main 的 PR 运行小程序与工具验证。

- 管理端本地验证使用 Node 22 和 npm 锁文件，执行 npm ci、npm run format:check、npm run lint、npm test、npm run build。
- `frontend/miniprograms/<工程名>/` 下每款游戏使用 Node 22、独立 npm 锁文件和 Creator 3.8.8 引擎声明。执行 npm ci、npm run typecheck、npm test、npm run lint、npm run format:check。场景预览和微信小游戏构建使用 Creator，构建输出导入微信开发者工具验收。
- Python 工具使用 requirements-dev.txt 固定的 Ruff，显式执行 ruff check 与 ruff format --check；Shell 工具执行 sh -n。
- 目录结构检查与 4 空格格式检查必须通过；检查器自身的回归测试由 CI 执行。
- 修改共享配置、workflow 或治理契约时检查前端与工具验证是否仍符合规则；仅声明本项目已落地的验证，不将尚未实现的检查列为必过门禁。
- 新增可自动化验证能力时同步 CI；没有构建或测试入口的模块不得伪造通过。
- 微信小程序真机、微信登录与分享、广告奖励、生产部署等未自动化事项，明确记录验证缺口。
- 本地运行最小相关验证；共享前端组件迁移运行全量管理端测试与构建。

## Description And Review

PR 描述记录业务完成点、范围、实际验证命令和结果、未覆盖项、跨域影响、文档与 RUNBOOK 收口以及剩余风险。不得把本地通过写成远端 CI 通过，不得暴露真实凭据、个人机器信息或 agent 执行过程。

Code Review 的覆盖范围、finding 门槛与 P0–P3 标准统一由根 AGENTS.md 定义。PR 评审只输出结论；评论修复按用户对当前 PR 的授权执行，不自动合并。

## Main Branch Protection

目标配置保存在 .github/main-protection.json：main 必须通过 PR 合并，分支需更新到最新基线，miniprogram、tooling 两项检查必须通过；管理员也遵守规则，禁止强推和删除，合并前解决讨论。单人仓库暂不要求额外审批人数，不绕过 PR 与 CI。

GitHub 私有仓库分支保护依赖账号套餐。当前套餐不支持本仓库分支保护，远端保护尚未生效；仓库保持私有。规则文件不是 GitHub 自动执行的配置，不能把已提交配置当作已启用保护。

账号具备能力后，执行 node scripts/configure-branch-protection.mjs 应用配置，并读取 main 分支保护 API 核对。配置失败必须报告，不自动放宽检查、不更改仓库可见性。
