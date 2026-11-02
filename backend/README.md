# Java DDD 后端

Java 21、Spring Boot、Maven Wrapper、MySQL、Flyway。按业务上下文组织game/{domain,application,infrastructure,interfaces}。domain不依赖Spring/数据库；application编排事务，infrastructure实现仓储/平台适配，interfaces处理传输协议。

```sh
./mvnw test
# 根目录先配置.env并启动MySQL，再为进程设置DB_PASSWORD
./mvnw spring-boot:run
```

当前只实现纯领域卡槽判定及其测试，数据库仅初始化标记表；业务API、认证、库存和结算尚未实现。不要将Actuator健康检查当作业务联调成功。
