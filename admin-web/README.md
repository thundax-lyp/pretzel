# Pretzel 管理端

React 18 + Ant Design 6 + Pro Components 3 + TypeScript + Vite；React Router、TanStack Query。管理端包含用户、角色、菜单、部门、字典与系统日志页面，支持登录、验证码、SM2 密码传输、令牌刷新、服务端菜单及权限存储。

```sh
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run dev
```

Vite将`/pretzel-admin-api`代理到本机8080。可通过`VITE_ADMIN_API_BASE_URL`覆盖API根；部署同源代理，并为前端历史路由配置index.html回退。

登录必须先取得令牌再加载权限，失败清理登录态；清令牌同时清权限。路由守卫和按钮隐藏仅改善展示，最终权限由服务端检查。管理用户与微信玩家身份独立。个人资料入口暂未实现完整个人中心。

## 界面组件

直接使用 ProLayout、PageContainer、ProTable、QueryFilter、ProForm 和 DrawerForm；基础控件直接来自 antd。components 只保留业务展示，不再提供项目级基础 UI 包装。页面内业务组件继续负责权限判断、状态与服务调用。

Pro Components 固定为 `3.1.15-9`，该版本声明兼容 Ant Design 6；当前稳定版 2.x 的 peer dependency 不包含 Ant Design 6。升级依赖时须重新验证登录、表格选择与排序、筛选、抽屉保存和主题布局。

角色、菜单和部门表格支持拖拽行排序；树形菜单与部门的层级变更仍由对应升级、降级操作及后端契约控制。ProTable 使用页面受控数据，不额外触发内部请求。

## 目录与检查

生产源码放在 src/，测试独立放在 test/，并保持对应的目录结构，例如 src/auth/token-storage.ts 对应 test/auth/token-storage.test.ts。组件测试使用 .test.tsx，普通逻辑测试使用 .test.ts；共享初始化位于 test/setup.ts。测试通过 @/ 引用源码，生产源码不得依赖测试。tsconfig.app.json 与 tsconfig.test.json 分别检查生产代码和测试，npm run build 同时执行两者的类型检查。

api 只处理传输，auth 保存底层认证与令牌、权限，session 编排当前用户和登录后会话，页面 service 与业务域就近放置。源码使用 kebab-case，4 个空格缩进。npm run lint 执行 Oxlint 与项目结构检查；检查文档树、Java 包路径及前端服务依赖。跨工程格式检查使用 node scripts/check-format.mjs，从任意目录执行均可。
