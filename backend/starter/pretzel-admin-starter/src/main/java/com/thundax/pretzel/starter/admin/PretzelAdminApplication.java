package com.thundax.pretzel.starter.admin;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@MapperScan({
    "com.thundax.pretzel.system.infra.core.persistence.mapper",
    "com.thundax.pretzel.system.infra.auth.persistence.mapper",
    "com.thundax.pretzel.system.infra.audit.persistence.mapper",
    "com.thundax.pretzel.storage.infra.object.persistence.mapper"
})
@SpringBootApplication(
        exclude = UserDetailsServiceAutoConfiguration.class,
        scanBasePackages = {
            "com.thundax.pretzel.starter.admin",
            "com.thundax.pretzel.common",
            "com.thundax.pretzel.system.application",
            "com.thundax.pretzel.system.infra",
            "com.thundax.pretzel.system.interfaces.admin",
            "com.thundax.pretzel.storage.application",
            "com.thundax.pretzel.storage.infra",
            "com.thundax.pretzel.storage.interfaces.admin"
        })
public class PretzelAdminApplication {
    public static void main(String[] args) {
        SpringApplication.run(PretzelAdminApplication.class, args);
    }
}
