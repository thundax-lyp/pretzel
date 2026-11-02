# 开发工具与检查

从项目根目录执行下列命令。Java 使用 21，Node 使用 22，Python 工具使用 3.10 或以上。不要将实际凭据写入命令参数或输出。

## 安装

```sh
npm --prefix admin-web ci
npm --prefix miniprogram ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
```

## 格式与 lint

```sh
# 检查；需要应用统一格式时追加 --write。
node scripts/check-format.mjs
npm --prefix admin-web run lint
node --test scripts/check-structure.test.mjs
admin-web/node_modules/.bin/oxlint --config .oxlintrc.json --deny-warnings miniprogram scripts
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
npm --prefix miniprogram run typecheck
npm --prefix miniprogram run lint
npm --prefix admin-web test
npm --prefix admin-web run build
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
