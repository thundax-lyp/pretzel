# 目录与命名规则

## 工程与文件

根目录按工程职责划分为 miniprograms、scripts 和 docs。`miniprograms/<工程名>/` 为各款微信小游戏。自定义目录名统一使用小写 kebab-case，例如 `flip-zoo`、`cloud-functions` 和 `flip-zoo-fragments`。工具约定或自动生成的目录名保持原样。各款游戏独立维护依赖、构建和测试配置。没有实际内容不创建空目录，产物、运行数据和私有配置不进入源码。

代码与配置统一为 UTF-8、LF、4 个空格缩进，文件末尾保留换行，不使用 Tab 缩进。工具生成且不人工维护的文件不手工改写；Markdown 列表与代码块遵循语法要求。

工具约定名称保持原样，例如 package.json、AGENTS.md、README.md。TypeScript、Cocos 资源分别遵循自身命名规则，不机械套用同一后缀。

## 小程序与文档

`miniprograms/<工程名>/` 使用独立的 Cocos Creator 工程结构。场景放在 assets/scenes，组件和纯 TypeScript 模块放在 assets/scripts，动态加载资源放在 assets/resources。资源及对应 .meta 文件一起维护。

小游戏 `assets/` 内的文件名使用小写 kebab-case，例如 `animals-action-01.png`、`tile-match.mp3`。扩展名保持小写，`.d.ts` 和 Cocos `.meta` 保留工具约定的后缀。隐藏文件不参与此检查。

小游戏工程的图片源文件统一使用 `.png` 或 `.svg`，包括 Cocos 图片和微信分享卡。结构 lint 检查图片扩展名及对应的 Cocos `.meta` 文件名。构建产物和工程文档截图沿用各自的格式。

文档使用大写英文和连字符，按治理、需求、契约、设计、验收分类；导航顺序由 docs/README.md 维护，不给每个文件添加容易失效的序号前缀。

## 自动检查

EditorConfig 约束编辑器缩进；Prettier 检查前端、小程序和配置；结构 lint 检查自定义目录和 Cocos 资源文件的小写 kebab-case 命名、小游戏目录和文档链接。根目录 `npm run lint` 与 CI 执行同一门禁，非法目录名导致检查失败。依赖、构建产物与工具管理目录不参与自定义目录命名检查；隐藏目录的前导点保留，例如 `.agents`。
