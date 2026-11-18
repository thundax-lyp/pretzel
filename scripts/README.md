# 开发工具与检查

从项目根目录执行下列命令。工具统一使用 Node.js 22。ESLint 要求 22.13.0 或以上的 22.x 版本。不要将实际凭据写入命令参数或输出。

## 安装

```sh
npm ci
```

## 仓库检查

```sh
npm run format:check
npm run lint
npm test
```

仓库根目录统一检查源码、配置和 Markdown 格式。需要应用格式时运行 `node scripts/check-format.mjs --write`。Cocos Creator 的 `.meta` 文件使用 `json-stringify` parser，非空数组逐项换行。检查尊重 Git 忽略规则，跳过产物、备份和私有文件。

check-structure 检查小游戏目录与文档导航。仓库和各小游戏的 `npm run lint` 共用根目录的 `eslint.config.mjs`。

## 小游戏脚本

在游戏目录运行 `npm run check` 执行类型检查、lint 和已有测试。CI 使用同一个入口。

游戏专用脚本随各自工程维护。Flip Zoo 的构建、Web 预览、难度模拟和云函数打包均位于 `miniprograms/flip-zoo/scripts/`，具体命令见 [Flip Zoo 工程说明](../miniprograms/flip-zoo/README.md#脚本索引)。麻将消消通过自身的 npm scripts 和 Creator 运行，命令见 [麻将消消工程说明](../miniprograms/mahjong-match/README.md)。

## 私有环境加载

```sh
node scripts/with-env.mjs --env-file .env -- <命令>
```

环境加载器按字面读取 KEY=VALUE，不执行 Shell 展开。

## PR 检查触发范围

CI 比较 PR 与目标分支的共同祖先，按改动目录选择 Flip Zoo 和 Mahjong Match 检查。涉及多个应用时，各应用任务并行执行。修改工作流或根目录共享的格式与 lint 配置时，运行所有应用检查。仓库级工具检查每个 PR 都运行；应用任务保留分支保护登记的检查名称。

## main 分支保护

node scripts/configure-branch-protection.mjs 将 .github/main-protection.json 应用到 GitHub main 分支，需要 gh 登录、仓库管理员权限和支持私有分支保护的套餐。当前账号的 API 请求被套餐限制拒绝，升级后可重新执行；仓库保持 private。脚本失败返回非零，不冒充配置成功。
