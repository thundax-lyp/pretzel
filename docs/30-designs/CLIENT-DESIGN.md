# 客户端与管理端组织设计

## 微信小游戏

每款游戏维护一个 Cocos Creator 工程，用同一份场景、资源和 TypeScript 核心构建 Web Demo 和微信小游戏。Web Demo 用于本地设计、调参和调试，微信小游戏构建用于微信开发者工具验收和发布。两种产物分别输出到 `build/web-mobile` 和 `build/wechatgame`。

棋盘、消除、卡槽、道具等规则由两种构建共用。平台差异留在入口、数据来源与平台服务。调试入口、调参接口和模拟奖励只在开发预览中使用。正式 AppID 由该游戏的私有构建环境提供。

## 管理端

frontend/admin/src/pages 按业务域组织页面和服务。api 只提供传输能力，auth 保存底层认证与令牌，session 组织当前用户及会话建立。跨页面当前用户服务不混入用户管理页面的 CRUD 服务。

生产源码放在 frontend/admin/src，测试放在独立的 frontend/admin/test，目录对应被测源码；测试初始化统一放在 test/setup.ts。测试通过 @/ 引用生产源码，生产源码不依赖测试目录。两者分别进行 TypeScript 检查，Vitest、格式与 lint 检查覆盖测试目录。

布局直接使用 ProLayout，页面骨架使用 PageContainer，列表使用 ProTable，筛选使用 QueryFilter，表单使用 ProForm 或 DrawerForm，基础控件直接使用 Ant Design。角色菜单树、用户头像等业务组件可以封装自己的状态与协议，不包装官方组件的同义 props。

## 状态与验证

管理端远程状态使用 TanStack Query。小游戏通过 GameApi 与 RunState 消费版本化快照，保留未知操作 ID 并原样重试，状态校验与表现分离。界面负责交互状态与可理解的错误反馈。权限、列表排序、草稿保留、重复提交、关闭重开与窄屏布局必须保持一致。

ArchUnit 在 Java 测试阶段检查依赖与包归属。前端使用 Oxlint 和目录结构检查，Prettier 与 Spotless 约束 4 空格缩进，CI 显式执行对应验证命令。
