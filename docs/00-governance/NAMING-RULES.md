# 目录与命名规则

## 工程与文件

根目录按工程职责划分为 miniprograms、scripts 和 docs。`miniprograms/<工程名>/` 为各款微信小游戏。游戏工程名用小写 kebab-case 表达游戏主题，例如 `flip-zoo`。各款游戏独立维护依赖、构建和测试配置。没有实际内容不创建空目录，产物、运行数据和私有配置不进入源码。

代码与配置统一为 UTF-8、LF、4 个空格缩进，文件末尾保留换行，不使用 Tab 缩进。工具生成且不人工维护的文件不手工改写；Markdown 列表与代码块遵循语法要求。

工具约定名称保持原样，例如 package.json、AGENTS.md、README.md。TypeScript、Cocos 资源分别遵循自身命名规则，不机械套用同一后缀。

## 小程序与文档

`miniprograms/<工程名>/` 使用独立的 Cocos Creator 工程结构。场景放在 assets/scenes，组件和纯 TypeScript 模块放在 assets/scripts，动态加载资源放在 assets/resources。资源及对应 .meta 文件一起维护。

文档使用大写英文和连字符，按治理、需求、契约、设计、验收分类；章节顺序由目录 README 决定，不给每个文件添加容易失效的序号前缀。

## 自动检查

EditorConfig 约束编辑器缩进；Prettier 检查前端、小程序和配置；Ruff 检查 Python 格式与静态规范；结构 lint 检查小游戏目录和文档链接。
