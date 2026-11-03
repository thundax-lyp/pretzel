# 部署配置

本目录区分**冒烟环境**与**正式发布环境**。当前两套配置只部署MySQL和Redis；后端与管理端在连接基础环境后单独启动验证，尚未提供整套应用镜像发布配置。微信客户端发布不在Compose中进行。

## 目录

```text
deploy/
├── README.md
├── init-env.py                 # 初始化指定环境，保留已有凭据
├── smoke/
│   ├── README.md
│   ├── compose.yaml            # 独立、可清理的冒烟基础环境
│   ├── .env.example            # 可提交的配置样例
│   └── dev.env                 # 初始化生成，真实值，Git忽略
└── release/
    ├── README.md
    ├── compose.yaml            # 正式基础环境
    ├── .env.example            # 可提交的配置样例
    └── dev.env                 # 初始化生成，真实值，Git忽略
```

每套环境还生成私有`.secrets/`和环境标记`.environment`，均不提交。根目录`dev.env`继续用于当前本地开发连接，不与两套部署环境自动同步或互相覆盖。

## 环境边界

| 项目             | 冒烟                                 | 正式发布                       |
| ---------------- | ------------------------------------ | ------------------------------ |
| Compose项目      | `pretzel-smoke`                      | `pretzel-infra`                |
| MySQL库/应用账号 | `pretzel_smoke`                      | `pretzel`                      |
| MySQL宿主端口    | `127.0.0.1:33316`                    | `127.0.0.1:23316`              |
| Redis宿主端口    | `127.0.0.1:36316`                    | `127.0.0.1:26316`              |
| 网络及数据卷     | 独立冒烟空间                         | 现有正式空间，持久保存         |
| 容器重启         | 不自动重启                           | `unless-stopped`               |
| 凭据             | 独立随机生成                         | 独立随机生成或明确接续已有凭据 |
| 数据用途         | 测试账号、流程验证，可按环境整体清理 | 实际项目数据，不运行破坏性验收 |

两个环境都启用MySQL认证、Redis密码和健康检查，保持基础行为一致。不接入其他基础设施。

## 快速操作

以下命令均从项目根目录执行，目标机器需有Docker Compose及Python 3。

```sh
# 冒烟：先准备自己的凭据，再校验和启动。
python3 deploy/init-env.py smoke
docker compose --env-file deploy/smoke/dev.env -f deploy/smoke/compose.yaml config -q
docker compose --env-file deploy/smoke/dev.env -f deploy/smoke/compose.yaml up -d --wait

# 正式：只在选定的正式部署机器及目录执行。
python3 deploy/init-env.py release
docker compose --env-file deploy/release/dev.env -f deploy/release/compose.yaml config -q
docker compose --env-file deploy/release/dev.env -f deploy/release/compose.yaml up -d --wait
```

初始化不会轮换已有密码；MySQL已有数据卷时，修改密码文件并不会修改数据库账户密码。禁止用重新生成凭据的方式“修复”已存在的数据卷。

现有服务器仍使用`~/pretzel/infra`平铺目录，保持运行；本次只整理仓库路径，没有迁移服务器文件或重建容器。接续现有部署时先参照[正式环境说明](release/README.md)，不要在新目录生成一套新密码后直接连接旧数据卷。

## 验收与发布

先在[冒烟环境](smoke/README.md)完成初始化、迁移和登录权限验收；通过后选定代码提交与镜像版本，再对[正式环境](release/README.md)执行配置检查、数据备份和兼容迁移。冒烟数据库、Redis状态及凭据不复制到正式环境。

正式配置保留Compose项目名及网络名，避免仅因目录变化而创建新的空数据卷。MySQL和Redis均仅绑定回环地址，本地开发沿用SSH转发。远程域名、TLS及应用镜像发布尚未配置，不能将当前基础环境健康等同整站发布完成。

## 环境说明

.env 与 dev.env 均为私有文件并加入 Git 忽略，公开样例统一使用 .env.example。初始化脚本直接生成目标环境的 dev.env，不能把样例占位值用于正式启动。已有 .env 文件不自动删除，也不自动覆盖。

## 环境操作分支

- [冒烟环境](smoke/README.md)
- [正式环境](release/README.md)
