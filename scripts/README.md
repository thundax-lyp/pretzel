# 开发工具与检查

从项目根目录执行下列命令。Node 使用 22，Python 工具使用 3.10 或以上。不要将实际凭据写入命令参数或输出。

## 安装

```sh
npm ci
npm --prefix miniprograms/flip-zoo ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

## 格式与 lint

```sh
# 检查；需要应用统一格式时追加 --write。
node scripts/check-format.mjs
node --test scripts/check-structure.test.mjs
npm run lint
.venv/bin/ruff check scripts
.venv/bin/ruff format --check scripts
```

check-format 根据 .prettierrc.json 处理前端、小程序、配置及 Markdown，尊重 Git 忽略规则，跳过产物、备份和私有文件。Python 由 Ruff 维护。

check-structure 检查小游戏目录与文档导航。

## 测试与构建

```sh
npm --prefix miniprograms/flip-zoo run typecheck
npm --prefix miniprograms/flip-zoo run lint
```

## 私有环境加载

```sh
python3 scripts/with-env.py --env-file .env -- <命令>
```

环境加载器按字面读取 KEY=VALUE，不执行 Shell 展开。

## PR 检查触发范围

CI 比较 PR 与目标分支的共同祖先，按改动目录选择 Flip Zoo 和 Mahjong Match 检查。涉及多个应用时，各应用任务并行执行。修改工作流或根目录共享的格式与 lint 配置时，运行所有应用检查。仓库级工具检查每个 PR 都运行；应用任务保留分支保护登记的检查名称。

## main 分支保护

node scripts/configure-branch-protection.mjs 将 .github/main-protection.json 应用到 GitHub main 分支，需要 gh 登录、仓库管理员权限和支持私有分支保护的套餐。当前账号的 API 请求被套餐限制拒绝，升级后可重新执行；仓库保持 private。脚本失败返回非零，不冒充配置成功。

## Cocos 构建

`miniprograms/flip-zoo/scripts/build-cocos.mjs` 调用本机 Cocos Creator 3.8.8。微信构建从私有环境读取 `FLIP_ZOO_WECHAT_GAME_APP_ID`，生成的项目目录导入微信开发者工具。

```sh
npm --prefix miniprograms/flip-zoo run build:web -- --debug
python3 scripts/with-env.py --env-file .env -- npm --prefix miniprograms/flip-zoo run build:wechat -- --debug
```

Node 关卡设计工具统一采用当前的免费原位复位与移出、纠错、重排规则。广告数据需要在固定输入和预算下重新运行，旧规则报告只可作为历史材料。
