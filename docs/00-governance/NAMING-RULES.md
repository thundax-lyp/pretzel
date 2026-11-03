# 目录与命名规则

## 工程与文件

根目录按工程职责划分为 frontend、backend、deploy、scripts 和 docs。frontend/admin 为管理后台，frontend/miniprogram 为微信小程序；两个前端独立维护依赖、构建和测试配置。没有实际内容不创建空目录，产物、运行数据和私有配置不进入源码。

代码与配置统一为 UTF-8、LF、4 个空格缩进，文件末尾保留换行，不使用 Tab 缩进。工具生成且不人工维护的文件不手工改写；Markdown 列表与代码块遵循语法要求。

工具约定名称保持原样，例如 package.json、compose.yaml、application.yml、AGENTS.md、README.md。Java、TypeScript、微信小程序分别遵循自身命名规则，不机械套用同一后缀。

## 管理端

- 源文件使用小写 kebab-case，React 导出组件使用 PascalCase，hook 使用 useXxx，文件名为 use-xxx.ts。
- 页面放在 src/pages/<module>/<domain>/<domain>-page.tsx，业务对象目录使用单数。
- 业务类型为 <domain>-types.ts，服务为 <domain>-service.ts；样式与业务源码就近放置，使用 .css。
- 生产代码放在 frontend/admin/src，测试独立放在 frontend/admin/test，按 src 的相对目录组织；普通逻辑使用 .test.ts，包含 JSX 的组件测试使用 .test.tsx。共享测试初始化为 test/setup.ts，测试通过 @/ 引用生产代码；生产代码不得依赖测试。
- 生产代码与测试分别由 tsconfig.app.json、tsconfig.test.json 检查，测试框架全局类型仅在测试配置中启用；构建命令同时检查两者，Vitest 仅收集 test 下的测试。
- 页面私有业务组件放在同业务目录内的同名子目录。仅父组件使用的子组件下沉到父目录。index.ts 只导出该目录公开能力。
- api 负责 HTTP 传输；auth 负责认证协议、令牌和权限存储；session 负责当前用户、菜单、权限加载以及登录后会话建立；页面 service 负责本业务请求。
- types 仅存放跨业务通用类型，不能成为页面类型的集中桶。pages、layouts 等集合目录可以使用复数。
- 不新增 service、utils、common 等没有明确职责的杂物目录，不建立官方 UI 组件的转发包装。

## Java

- 类使用 PascalCase，方法及变量使用 camelCase，常量使用 UPPER_SNAKE_CASE，包名使用小写。
- 配置类和配置属性放在 config 包，禁止 configure；工具包统一为 util，禁止 utils；架构约束注解和测试支撑使用 architecture，禁止 arch。
- backend/common 存放技术能力，backend/biz 按业务域组织，backend/starter 只做运行时装配。
- 业务域内部先按 DDD 层次，再按业务能力分包。game.domain.board 保存卡牌和布局相关对象，game.domain.slot 保存卡槽判定。
- Controller、Request、Response 属于 HTTP 接口；ApplicationService、Command、Query 属于用例编排；Repository 是领域端口；Mapper、DO、PersistenceAssembler 属于持久化实现。
- 模块名使用 pretzel-<domain>-<layer>。Java 包中的 interfaces 表示接口层，Maven 模块后缀使用 interface；两者分别遵循包与构件约定，不引入额外同义目录。
- 单元及架构测试使用 Test 后缀；当前 Maven Surefire 同时执行 IntegrationTest，不使用尚未配置 Failsafe 的 IT 后缀冒充集成测试已执行。

## 小程序、部署与文档

frontend/miniprogram 下的小程序页面使用 pages/<page>/index.ts、index.json、index.wxml 和按需 index.wxss。全局入口使用 app.ts、app.json、app.wxss。

部署使用 deploy/smoke 与 deploy/release，各环境保留 compose.yaml 和 .env.example；真实文件 .env、dev.env、.secrets 与 .environment 全部忽略。脚本使用小写 kebab-case 及对应语言扩展名。

文档使用大写英文和连字符，按治理、需求、契约、设计、验收分类；章节顺序由目录 README 决定，不给每个文件添加容易失效的序号前缀。

## 自动检查

EditorConfig 约束编辑器缩进；Prettier 检查前端、小程序和配置；Spotless 检查 Java 与 Maven POM；Checkstyle 检查 Java 静态规则；ArchUnit 检查配置类位置、领域依赖与命名；Ruff 检查 Python 格式与静态规范；结构 lint 检查目录、导入边界、自动配置注册和文档链接。
