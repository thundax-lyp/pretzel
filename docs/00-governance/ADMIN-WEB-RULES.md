# Admin Web Rules

## Scope

本文档定义 frontend/admin 的分层、权限与交互规范。通用界面采用 Pro Components 与 Ant Design。

## Components

- 页面骨架、导航、列表、表单优先直接使用 @ant-design/pro-components 的 ProLayout、PageContainer、ProTable、ProForm、DrawerForm 等；基础控件直接使用 antd。
- 不得新增仅转发 UI props 的项目级通用包装，直接使用官方组件及其类型。
- 业务组件可以保留，但必须承担明确业务规则、状态或协议；不要为视觉相似片段机械抽象组件。
- 页面负责布局与高层编排；内聚业务组件负责自身状态、生命周期与服务调用，真实跨子组件协调除外。

## Services And Authorization

- HTTP 请求集中在 src/api/http.ts；页面经 service 发起请求，不自行实现 token、刷新或异常协议。
- 认证和权限存储放在 src/auth，当前用户与会话建立放在 src/session，路由放在 src/router；公共 API/auth/session 不反向依赖页面。
- 保留 Access-Token、SM2 登录、服务端菜单、权限清理和错误码契约。
- 按钮、路由与菜单权限一致；隐藏按钮不替代服务端授权。

## Interaction And Verification

- 列表保留筛选、分页、排序、选中、批量操作、加载、空数据与错误反馈。
- 表格至少一个数据列允许伸缩；操作列适当固定右侧，删除操作最后展示并确认。
- 表单校验明确，提交防重，失败保留输入，关闭与重开时明确重置规则。
- 交互控件具备可访问名称，必要时提供 data-testid；测试关注用户行为与请求契约，不绑定组件内部 DOM。
- 使用当前 npm format:check、Oxlint、Vitest 和 TypeScript/build；没有落地的规则不得宣称已有自动门禁。
- 构建前先对本次修改运行最小范围格式化，再检查格式与 lint；检查 diff 避免无关格式改动。
