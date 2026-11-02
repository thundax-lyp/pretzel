# 冒烟环境

此配置仅包含MySQL/Redis，使用pretzel-smoke独立项目和数据卷，不复用正式实例或凭据。操作从项目根目录执行。

```sh
python3 deploy/init-env.py smoke
docker compose --env-file deploy/smoke/dev.env -f deploy/smoke/compose.yaml up -d --wait
docker compose --env-file deploy/smoke/dev.env -f deploy/smoke/compose.yaml ps
```

默认MySQL33316、Redis36316，仅绑定回环。dev.env中的应用连接适用于运行Compose的同一主机；跨主机运行测试必须先建立对应SSH转发并单独调整连接地址。

## 需要验证的流程

- 数据库迁移及首次管理员初始化；重复初始化不重置密码。
- 预认证、验证码、加密登录、菜单与权限读取。
- 用户与角色创建、授予角色后访问成功、撤销权限后立即拒绝。
- 令牌刷新、登出失效、停用账号后拒绝访问。
- 管理端API代理、类型检查、测试和生产构建。

AdminAuthIntegrationTest通过TEST_DB_*及TEST_REDIS_URL连接一次性验收库。不要指向正式pretzel库，也不要直接重复写入同一个已有测试账号的库。需要端到端自动验收时，在本冒烟MySQL中创建一次性库及限定账号，使用独立Redis逻辑库；测试后只清理该次临时资源。已有服务器验收记录不等于本配置已经在目标机器实际启动验证。

## 停止与清理

```sh
# 保留冒烟数据卷。
docker compose --env-file deploy/smoke/dev.env -f deploy/smoke/compose.yaml down

# 明确需要重置整个冒烟环境时，才使用下面这条命令。
docker compose --env-file deploy/smoke/dev.env -f deploy/smoke/compose.yaml down -v
```

仅对本冒烟配置执行卷清理。真实dev.env和.secrets保留，不自动删除；下次启动保持密码一致。
