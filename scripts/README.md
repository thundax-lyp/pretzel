# 开发工具与检查

从项目根目录执行下列命令。Java 使用 21，Node 使用 22，Python 工具使用 3.10 或以上。不要将实际凭据写入命令参数或输出。

## 安装

```sh
npm --prefix frontend/admin ci
npm --prefix frontend/miniprograms/eyes-and-legs ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

## 格式与 lint

```sh
# 检查；需要应用统一格式时追加 --write。
node scripts/check-format.mjs
npm --prefix frontend/admin run lint
node --test scripts/check-structure.test.mjs
frontend/admin/node_modules/.bin/oxlint --config .oxlintrc.json --deny-warnings frontend/miniprograms/eyes-and-legs scripts
.venv/bin/ruff check scripts deploy
.venv/bin/ruff format --check scripts deploy
sh -n scripts/infra-tunnel.sh

# Java 与 POM 格式，均使用 4 个空格。
./backend/mvnw -f backend/pom.xml spotless:check
./backend/mvnw -f backend/pom.xml checkstyle:check
```

check-format 根据 .prettierrc.json 处理前端、小程序、配置及 Markdown，尊重 Git 忽略规则，跳过产物、备份和私有文件。Java 与 Maven POM 由 Spotless 维护；Python 由 Ruff 维护。

check-structure 检查前端文件命名、服务依赖方向、HTTP 归属、官方 UI 组件使用、Java 包路径、自动配置注册与文档目录树。它不代替 TypeScript 编译、ArchUnit 或运行时验证。

## 测试与构建

```sh
npm --prefix frontend/miniprograms/eyes-and-legs run typecheck
npm --prefix frontend/miniprograms/eyes-and-legs run lint
npm --prefix frontend/admin test
npm --prefix frontend/admin run build
./backend/mvnw -f backend/pom.xml -B clean verify
```

后端 verify 同时执行 Checkstyle、Spotless、单元测试和 ArchUnit。真实 MySQL 与 Redis 集成验证使用隔离测试库，通过 TEST_DB_URL、TEST_DB_USERNAME、TEST_DB_PASSWORD、TEST_REDIS_URL 配置；不得将测试指向已部署的业务数据库。

## 私有环境加载

```sh
python3 scripts/with-env.py --env-file dev.env -- <命令>
```

环境加载器按字面读取 KEY=VALUE，不执行 Shell 展开。infra-tunnel.sh 负责独立的开发隧道操作；传入目标 SSH 主机，不将账号和基础环境凭据硬编码到脚本。

## main 分支保护

node scripts/configure-branch-protection.mjs 将 .github/main-protection.json 应用到 GitHub main 分支，需要 gh 登录、仓库管理员权限和支持私有分支保护的套餐。当前账号的 API 请求被套餐限制拒绝，升级后可重新执行；仓库保持 private。脚本失败返回非零，不冒充配置成功。

## Skill 关卡设计与预算实验

`pretzel-level-design` 按 SKILL.md、references、scripts 组织。入口只做路由，操作契约按需读取，执行模块全部是 Node.js 22 原生 `.mjs`，无 Python 包装或运行时依赖。固定布局的导入、几何、生成、玩法、策略、独立回放、预算和报告在 Skill 内分模块维护。

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs import --input docs/30-designs/assets/level-pack-v1/height-study/variants.json --output logs/game-design/new-node-import
node .agents/skills/pretzel-level-design/scripts/level-design.mjs run --input logs/game-design/new-node-import/levels.json --per-variant 2 --repeats 3 --max-candidates 80 --max-runs 100 --max-seconds 120 --output logs/game-design/new-node-experiment
node .agents/skills/pretzel-level-design/scripts/level-design.mjs verify --output logs/game-design/new-node-experiment
node --test .agents/skills/pretzel-level-design/scripts/*.test.mjs
```

支持 native、视觉 level-pack 的 hard 和 height-study，保留真实坐标、动物、题序、参考解与来源身份，分别使用 logical-xy、isometric-body，核对源覆盖和独立几何算法。新布局可用 generate，支持 --profile、--curve、--difficulty；输入导入不会触发生成或难度筛选。

run 默认每结构两关、三次决策、无道具/零储备/满储备三场景，一轮最多 80 条输入、100 次模拟和计算子进程 120 秒。父进程到期终止子进程，保留已完成记录，未运行组显式缺失。退出码 0 为完整结束，2 为预算停止，1 为错误，不自动追加实验。报告和显式 verify 另计时间。

输出含原始输入、配置、所有模块的 SHA-256 与 source/ 下源码快照、journal.jsonl、report.json、REPORT.md 和 worker.stderr。可用报告目录的 source/level-design.mjs 脱离当前工程版本核验。Node 使用 sha256-xorshift32-v1，不混用其他实现的决策统计；模拟时长和广告率仍不能替代真人验收。

## 半格混合堆叠原型

Skill 生成器支持一盖二、一盖四、多盖一。规范坐标以一张牌宽为 1，步长 0.5；一张牌占四个定位小格，仍是一个点击/消除实例。初始上层至少一处下层正面积支撑即可，不要求全部小格支撑；边缘接触不算覆盖。

```sh
node .agents/skills/pretzel-level-design/scripts/level-design.mjs prototype --input docs/30-designs/assets/level-pack-v1/height-study/baseline-levels.json --boards 2 --output logs/game-design/new-mixed-prototypes
node .agents/skills/pretzel-level-design/scripts/level-design.mjs run --input logs/game-design/new-mixed-prototypes/levels.json --per-variant 2 --repeats 10 --max-runs 240 --max-seconds 120 --output logs/game-design/new-mixed-run
node .agents/skills/pretzel-level-design/scripts/level-design.mjs verify --output logs/game-design/new-mixed-run
```

prototype 为每个内容种子输出直叠对照、盖二重点、盖四重点和混合型，严格配对动物、题目、参考组及种子。每条仍为 48 张、12 题，输出数量为 4×boards。PREVIEW.html 支持逐层查看和定位线开关；svg/ 输出静态结构图。预览不代表 actual 点击验收，本轮规则统一使用 logical-xy。

## Cocos 构建

`frontend/miniprograms/eyes-and-legs/scripts/build-cocos.mjs` 调用本机 Cocos Creator 3.8.8。微信构建从私有环境读取 `WECHAT_GAME_APP_ID`，生成的项目目录导入微信开发者工具。

```sh
npm --prefix frontend/miniprograms/eyes-and-legs run build:web -- --debug
python3 scripts/with-env.py --env-file .env -- npm --prefix frontend/miniprograms/eyes-and-legs run build:wechat -- --debug
```

Node 关卡设计工具统一采用当前的免费原位复位与移出、纠错、重排规则。广告数据需要在固定输入和预算下重新运行，旧规则报告只可作为历史材料。
