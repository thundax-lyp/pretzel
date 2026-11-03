# Architecture

## Scope

pretzel 是《腿了个腿》微信动物卡牌求和消除项目。架构规则不替代已确认产品需求，不将尚未实现的游戏能力描述为已交付。

- frontend/：前端应用集合；admin 为 React、TypeScript、Ant Design 与 Pro Components 管理端，miniprogram 为 TypeScript 原生微信小程序，包含启动页、首页、游戏页。
- backend/：Java 21、Spring Boot、Maven 多模块和 DDD 模块化单体。
- deploy/：冒烟与正式环境配置，目前只接入 MySQL 8.4 和 Redis。
- scripts/：环境加载和开发辅助工具。
- backup/：用户归档资料，Git 忽略，不作为默认工程输入。

## Backend Boundaries

后端采用 common、biz、starter 模块组织：common 放通用技术能力，biz 按业务域分层，starter 只做运行时装配。

- Controller 与 Request/Response 属于接口层；ApplicationService 编排用例、事务和授权。
- Domain 负责核心业务规则与仓储端口；基础设施实现 Repository、Mapper 和持久化转换。
- 跨域通过已定义的 Facade 等稳定边界协作，不访问对端 Mapper、DO 或底层表。
- 前端权限仅用于交互控制；后端必须独立校验认证、功能权限与数据归属。
- 初始化阶段的 Flyway 脚本直接维护最终结构与种子数据，不累加修补历史方案的迁移；已有环境须重建后使用该初始化版本，不通过 repair 跳过实际结构验证。重建或清空数据库需明确授权。MySQL 保存持久事实，Redis 保存会话和适用的缓存。
- 本阶段不接入额外基础设施，依赖库或适配类的存在不构成启用服务的依据。
