# Architecture

## Scope

Pretzel 仓库维护微信小游戏。架构规则不替代已确认产品需求，不将尚未实现的游戏能力描述为已交付。

- miniprograms/：小游戏客户端集合，`miniprograms/<工程名>/` 下每款游戏独立使用 Cocos Creator 3.8.8 与 TypeScript。
- scripts/：环境加载和开发辅助工具。
- backup/：用户归档资料，Git 忽略，不作为默认工程输入。
