# Architecture

## Scope

Pretzel 仓库维护微信小游戏和管理后台前端。管理端通过 HTTP 接入独立运行的 API 服务。架构规则不替代已确认产品需求，不将尚未实现的游戏能力描述为已交付。

- frontend/：前端应用集合；admin 为 React、TypeScript、Ant Design 与 Pro Components 管理端，`miniprograms/<工程名>/` 下每款游戏独立使用 Cocos Creator 3.8.8 与 TypeScript。
- scripts/：环境加载和开发辅助工具。
- backup/：用户归档资料，Git 忽略，不作为默认工程输入。
