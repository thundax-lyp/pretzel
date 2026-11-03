# 正式发布基础环境

当前只接入MySQL和Redis。不会启动其他项目容器，也不接入消息队列、搜索、对象存储服务或观测平台。

## 已部署实例

服务器部署目录为用户指定服务器上的`~/pretzel/infra`，Compose项目名`pretzel-infra`。

| 服务  | 已验证版本 | 服务器监听      | 本地SSH转发     |
| ----- | ---------- | --------------- | --------------- |
| MySQL | 8.4.11     | 127.0.0.1:23316 | 127.0.0.1:13316 |
| Redis | 7.2.15     | 127.0.0.1:26316 | 127.0.0.1:16316 |

Redis 7.4拉取因Docker Hub连接超时未成功，部署使用服务器已有`redis:7.2`镜像（服务端.env中设置REDIS_IMAGE），没有修改Docker镜像源。Compose默认Redis镜像仍可由REDIS_IMAGE覆盖。

两者使用独立网络`pretzel-infra`、命名数据卷和`unless-stopped`重启策略；不绑定外网地址。Redis启用密码和AOF。项目MySQL账号只授权`pretzel`库；root凭据仅保留在服务器私有目录。

## 配置与凭据

- `compose.yaml`和`../init-env.py`不含真实凭据，可维护在版本库。
- 服务器`.secrets/`目录0700；密码文件只经Docker文件挂载使用；不打印凭据。
- `../init-env.py release`只生成缺失凭据，不会重置已有密码；MySQL数据卷初始化后不能靠改密码文件完成轮换。
- 服务器`client.env`及本地项目根`dev.env`为0600，包含实际项目连接和初始管理员信息，均由Git忽略。
- 管理端`frontend/admin/.env.local`将代理指向本地8116，Git忽略。Vite支持`VITE_ADMIN_API_TARGET`。
- `.env` 与 `dev.env` 都是私有环境文件并加入 Git 忽略；公开样例使用 `.env.example`。配置初始化不覆盖现有 dev.env 或私有凭据。

## 本地连接

```sh
# SSH使用现有认证或交互密码，不把服务器密码放入脚本。
./scripts/infra-tunnel.sh start user@server
./scripts/infra-tunnel.sh status user@server

# 在backend目录构建，再从项目根启动；环境文件按字面加载，不执行shell展开。
(cd backend && ./mvnw -DskipTests package)
python3 scripts/with-env.py --env-file dev.env -- java -jar backend/starter/pretzel-admin-starter/target/pretzel-admin-starter-0.0.1-dev.jar

# 管理端
(cd frontend/admin && npm run dev)
```

项目dev.env已选择后端端口8116；健康地址为`http://127.0.0.1:8116/pretzel-admin-api/actuator/health`。初始管理员用户名为`admin`，密码在私有dev.env的`PRETZEL_BOOTSTRAP_PASSWORD`，不要粘贴到工单、聊天或提交记录。bootstrap默认关闭；已初始化的账号不依赖持续开启开关。

停止SSH转发用`./scripts/infra-tunnel.sh stop user@server`。转发停止后本地后端无法访问远程基础环境；重启电脑后需重新建立转发。

## 维护

在服务器部署目录运行`docker compose ps`查看健康状态，`docker compose stop`停止自身实例，`docker compose up -d --pull never --wait`启动现有镜像。不要使用`down -v`删除持久化数据。密码轮换、备份恢复和版本升级需另行安排，不复用其他项目账号或数据卷。

## 验证方式

`AdminAuthIntegrationTest`支持`TEST_DB_URL/TEST_DB_USERNAME/TEST_DB_PASSWORD/TEST_REDIS_URL`，使用临时验收库和Redis DB15，不针对正式库运行测试账号创建。未设置TEST_REDIS_URL时沿用本地测试Redis。

本次实际服务器验收覆盖加密登录、创建用户/角色、无权限拒绝、角色授权后允许、撤权后立即拒绝、令牌刷新、登出失效、停用用户和bootstrap幂等。临时验收库/账号及DB15的测试数据验证后清理；正式库和DB0保留。数据库使用唯一 V1 初始化结构与合法菜单等级，首次管理员通过显式 bootstrap 创建。

所有过程未重启或修改服务器其他项目的基础设施。

## 新环境初始化与启动

从项目根目录执行：

```sh
python3 deploy/init-env.py release
docker compose --env-file deploy/release/dev.env -f deploy/release/compose.yaml config -q
docker compose --env-file deploy/release/dev.env -f deploy/release/compose.yaml up -d --wait
docker compose --env-file deploy/release/dev.env -f deploy/release/compose.yaml ps
```

生成的release/dev.env默认适用于与Compose同机的应用；本地开发仍使用根dev.env中的SSH转发地址。应用启动需要Java21，本配置不安装Java或发布应用镜像。首次初始化账户时仅在受控启动中启用bootstrap，创建后关闭；禁止长期保留初始化开关。

## 接续已有服务器部署

服务器当前仍使用`~/pretzel/infra`平铺目录，本次没有改动。以后整理服务器文件时，必须保留原`.secrets/`、client.env及Compose项目名pretzel-infra，先确认挂载的数据卷再操作。将原client.env作为新位置的dev.env保留实际连接和初始管理员信息；使用新初始化工具检查遗留目录时需显式`--adopt-existing`，不会轮换密码。

不要在一个空的新release目录生成新密码，再直接挂载已有正式数据卷。新目录只改变配置路径，不得改变正式实例身份、账号或数据。

## 发布与回滚检查

1. 冒烟验证通过，记录待发布代码提交和MySQL/Redis镜像版本；升级前固定镜像版本或摘要，不临时追随新标签。
2. 核对正式dev.env、项目名、端口与数据卷，执行config -q，不打印带凭据的完整展开配置。
3. 对正式MySQL和Redis做一致性备份，并在隔离环境验证恢复；备份不进入版本库。
4. 按兼容策略执行应用和数据库迁移，再检查服务健康、登录与权限；正式检查不运行创建测试账号的集成测试。
5. 出现问题先停止应用写入并判断是否可回退应用版本。回退应用不等于回退数据库；不自动撤销Flyway历史，不删除或重建正式卷。

停止正式基础环境只使用stop，保留数据卷；禁止对正式配置执行down -v。完整应用发布和自动化备份/回滚脚本尚未提供，本文件不把当前基础环境视为完整生产上线。
