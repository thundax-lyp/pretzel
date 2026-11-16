# Pretzel

Pretzel 仓库维护多个微信小游戏。各游戏使用 Cocos Creator 3.8.8 和 TypeScript。

《翻翻动物园》可在 Creator、Web Demo 和微信小游戏中运行。

从 [工程文档导航](docs/README.md) 查阅工程规范和设计。新文档独立维护，backup 只保存历史归档。

## 目录

- [frontend/](frontend/README.md)：各款微信小游戏客户端。
- scripts/：环境与验证工具。
- docs/：当前工程文档。

## 开发

仓库工具依赖在根目录执行 `npm ci` 安装。游戏客户端通过 Cocos Creator 3.8.8 打开 frontend/miniprograms/flip-zoo，构建微信小游戏后将生成目录导入微信开发者工具。

公开配置模板为 .env.example，真实配置放在 .env 或 dev.env，二者都不提交。所有人工维护的代码和配置统一为 4 个空格缩进。
