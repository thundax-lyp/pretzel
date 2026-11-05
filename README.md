# Pretzel · 腿了个腿

微信动物卡牌求和消除项目。技术栈为Cocos Creator 3.8.8 与 TypeScript 微信小游戏、React + TypeScript + Ant Design Pro Components、Java 21 + Spring Boot + DDD、MySQL 与 Redis。

当前包含可运行的 Cocos 客户端、本地两关预览、整槽求和与原位复位判定，以及管理端登录、用户、角色、权限、菜单、部门、字典和系统日志。正式游戏对局接口、平台奖励、动物收集及榜单业务仍待实现。

工程规则和文档从 [AGENTS.md](AGENTS.md) 进入，按文档目录树读取需求、接口、设计和验收记录。新文档独立维护，backup 只保存历史归档。

## 目录

- [frontend/](frontend/README.md)：管理后台与三页面微信小游戏。
- backend/：Java 模块化单体。
- deploy/：smoke 与 release 的 MySQL、Redis 基础环境。
- scripts/：环境与验证工具。
- docs/：当前工程文档。

## 开发

管理端在 frontend/admin 执行 npm ci、npm run dev。Java 后端在 backend 使用 ./mvnw，启动与环境要求由对应工程说明定义。游戏客户端通过 Cocos Creator 3.8.8 打开 frontend/miniprogram，构建微信小游戏后将生成目录导入微信开发者工具。

公开配置模板为 .env.example，真实配置放在 .env 或 dev.env，二者都不提交。部署环境各自使用私有凭据，不相互覆盖。所有人工维护的代码和配置统一为 4 个空格缩进。
