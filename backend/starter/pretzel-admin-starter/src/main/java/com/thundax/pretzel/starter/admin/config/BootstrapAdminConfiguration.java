package com.thundax.pretzel.starter.admin.config;

import com.thundax.pretzel.system.application.auth.util.PasswordHelper;
import com.thundax.pretzel.system.application.core.util.SysApiUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

/** Explicit opt-in bootstrap: no shared password, no source accounts, no reset of existing users. */
@Configuration
@ConditionalOnProperty(name = "pretzel.bootstrap.enabled", havingValue = "true")
public class BootstrapAdminConfiguration {
    @Bean
    ApplicationRunner bootstrapAdmin(
            JdbcTemplate jdbc,
            TransactionTemplate transactions,
            @Value("${PRETZEL_BOOTSTRAP_USERNAME:admin}") String username,
            @Value("${PRETZEL_BOOTSTRAP_PASSWORD}") String password) {
        return args -> transactions.executeWithoutResult(status -> {
            if (username.isBlank() || !password.matches(SysApiUtils.PASSWORD_VALIDATE_PATTERN)) {
                throw new IllegalArgumentException("Bootstrap username/password do not meet password policy");
            }
            // Serialize bootstrap against the stable root department, including multiple application instances.
            jdbc.queryForObject("SELECT id FROM system_department WHERE id=1 FOR UPDATE", Long.class);
            if (jdbc.queryForObject(
                            "SELECT COUNT(*) FROM system_auth_principal_identity WHERE identity_type='USER_ACCOUNT' AND identity_value=?",
                            Integer.class,
                            username)
                    > 0) {
                return;
            }
            jdbc.update(
                    "INSERT INTO system_user (department_id,name,privilege,status,ranks) VALUES (1,?,'SUPER','ENABLED',9)",
                    username);
            Long userId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
            jdbc.update(
                    "INSERT INTO system_auth_principal_identity (principal_type,principal_id,identity_type,identity_value,status) VALUES ('USER',?,'USER_ACCOUNT',?,'ENABLED')",
                    userId,
                    username);
            Long identityId = jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
            jdbc.update(
                    "INSERT INTO system_auth_principal_credential (principal_type,principal_id,identity_id,credential_type,credential_value,status,failed_limit) VALUES ('USER',?,?,'USER_PASSWORD',?,'ACTIVE',5)",
                    userId,
                    identityId,
                    PasswordHelper.encrypt(password));
        });
    }
}
