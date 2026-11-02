# Pretzel Java 后端

Java 21、Spring Boot 3.5.11、MySQL、Redis、MyBatis Plus、Flyway，Maven多模块。系统域提供用户、角色、权限与登录能力。代码来源与许可见根目录 NOTICE 和 LICENSE。

## 模块

- common：core、audit、security、web、openapi、mybatis、cache、oss及test。
- biz/system：用户、角色、菜单权限、部门、字典、认证会话与审计；保留domain/application/infra/interface/facade边界。
- biz/storage：支撑用户头像与附件的存储依赖，默认本地对象存储。
- biz/game：独立游戏领域，保留已实现的整槽求和判定。
- starter/pretzel-admin-starter：管理API装配，不包含游戏玩家认证。

后端使用 Spring Boot 3.5.11。技术日志直接调用本地应用服务落库，不依赖RocketMQ；业务审计链保留。

## 启动

公开模板为根目录 .env.example；首次配置复制到 dev.env 并填写真实值。.env 与 dev.env 均由 Git 忽略，不输出或提交真实凭据。使用 scripts/with-env.py --env-file dev.env -- <命令> 加载环境。smoke、release 环境分别维护自己的私有配置与凭据。

后端采用 config、util、architecture 包名；游戏领域按 board、slot 能力组织。ArchUnit 与 Checkstyle 已接入 Maven 测试和 validate 阶段，Spotless 统一 Java 与 POM 的 4 空格格式。

```sh
./mvnw -B clean verify
./mvnw -pl starter/pretzel-admin-starter -am -DskipTests install
cd starter/pretzel-admin-starter
../../mvnw spring-boot:run
```

默认端口8080，context-path `/pretzel-admin-api`。管理接口根为`/pretzel-admin-api/api`，使用 `Access-Token` 请求头与统一业务响应信封；`COMMON-00000` 表示成功，未授权等业务失败也需检查业务状态码，不能只检查 HTTP 状态。

新库由 Flyway 的 `V1__init.sql` 一次创建系统与存储表，并初始化本项目系统菜单；菜单访问级别为 0，管理员账号通过显式配置初始化。项目初始化阶段直接更新此脚本，不保留历史修补迁移。曾运行旧版迁移的数据库需在获得重建授权后重建，不能用 Flyway repair 冒充结构同步。首次管理员需显式设置`PRETZEL_BOOTSTRAP_ENABLED=true`、`PRETZEL_BOOTSTRAP_USERNAME`和符合密码规则的`PRETZEL_BOOTSTRAP_PASSWORD`。不存在默认密码；已有同名账户不重置。初始化完成关闭开关并移除bootstrap密码变量。

生产配置关闭验证码白名单和OpenAPI，登录失败5次锁15分钟。会话依赖共享Redis，不能换成本机内存声称行为等价。Redis必须受网络访问控制；compose仅绑定回环端口，生产按部署环境设置认证与网络隔离。

## 测试

测试覆盖领域/分层、认证、权限、锁定、刷新与撤销、接口契约、日志与审计，以及真实 HTTP 认证链。`AdminAuthIntegrationTest`默认使用H2 MySQL模式及测试专用嵌入式Redis；它不是实际MySQL验收。设置`TEST_DB_URL`、`TEST_DB_USERNAME`、`TEST_DB_PASSWORD`可对独立空MySQL测试库运行；CI配置MySQL8.4，测试会写数据，禁止指向业务库。

完整游戏业务、微信身份和道具结算仍未实现。
