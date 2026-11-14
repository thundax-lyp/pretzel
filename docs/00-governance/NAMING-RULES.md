# 目录与命名规则

## 工程与文件

根目录按工程职责划分为 frontend、scripts 和 docs。frontend/admin 为管理后台，`frontend/miniprograms/<工程名>/` 为各款微信小游戏。游戏工程名用小写 kebab-case 表达游戏主题，例如 `flip-zoo`。管理后台与各款游戏独立维护依赖、构建和测试配置。没有实际内容不创建空目录，产物、运行数据和私有配置不进入源码。

代码与配置统一为 UTF-8、LF、4 个空格缩进，文件末尾保留换行，不使用 Tab 缩进。工具生成且不人工维护的文件不手工改写；Markdown 列表与代码块遵循语法要求。

工具约定名称保持原样，例如 package.json、AGENTS.md、README.md。TypeScript、Cocos 资源分别遵循自身命名规则，不机械套用同一后缀。

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

## 小程序与文档

`frontend/miniprograms/<工程名>/` 使用独立的 Cocos Creator 工程结构。场景放在 assets/scenes，组件和纯 TypeScript 模块放在 assets/scripts，动态加载资源放在 assets/resources。资源及对应 .meta 文件一起维护。

文档使用大写英文和连字符，按治理、需求、契约、设计、验收分类；章节顺序由目录 README 决定，不给每个文件添加容易失效的序号前缀。

## 自动检查

EditorConfig 约束编辑器缩进；Prettier 检查前端、小程序和配置；Ruff 检查 Python 格式与静态规范；结构 lint 检查目录、导入边界和文档链接。
