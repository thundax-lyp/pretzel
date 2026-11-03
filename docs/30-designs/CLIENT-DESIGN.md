# 客户端与管理端组织设计

## 微信小程序

小程序源码位于 frontend/miniprogram，保留 pages/start、pages/home、pages/game 三个页面，入口文件为 index.ts、index.json、index.wxml，按需增加 index.wxss。小程序路由、构建和平台配置使用工具约定文件名。

游戏页分离状态、操作与动画：覆盖关系决定可点击性；卡槽和暂存区保存牌实例；动画不直接发放奖励或确认服务端结算。多行可滚动暂存区保留点击放回能力。

后台提供第二关生成数据，客户端根据明确坐标和层级渲染。屏幕缩放不能改变覆盖语义或导致不可点击牌被选中。

## 管理端

frontend/admin/src/pages 按业务域组织页面和服务。api 只提供传输能力，auth 保存底层认证与令牌，session 组织当前用户及会话建立。跨页面当前用户服务不混入用户管理页面的 CRUD 服务。

生产源码放在 frontend/admin/src，测试放在独立的 frontend/admin/test，目录对应被测源码；测试初始化统一放在 test/setup.ts。测试通过 @/ 引用生产源码，生产源码不依赖测试目录。两者分别进行 TypeScript 检查，Vitest、格式与 lint 检查覆盖测试目录。

布局直接使用 ProLayout，页面骨架使用 PageContainer，列表使用 ProTable，筛选使用 QueryFilter，表单使用 ProForm 或 DrawerForm，基础控件直接使用 Ant Design。角色菜单树、用户头像等业务组件可以封装自己的状态与协议，不包装官方组件的同义 props。

## 状态与验证

远程状态使用 TanStack Query；业务 service 返回契约数据；界面负责交互状态与可理解的错误反馈。权限、列表排序、草稿保留、重复提交、关闭重开与窄屏布局必须保持一致。

ArchUnit 在 Java 测试阶段检查依赖与包归属。前端使用 Oxlint 和目录结构检查，Prettier 与 Spotless 约束 4 空格缩进，CI 显式执行对应验证命令。
