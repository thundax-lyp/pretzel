package com.thundax.pretzel.starter.admin.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.thundax.pretzel.common.core.crypto.Sm2Crypto;
import com.thundax.pretzel.starter.admin.PretzelAdminApplication;
import com.thundax.pretzel.system.application.auth.util.PasswordHelper;
import java.net.ServerSocket;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import redis.embedded.RedisServer;

@SpringBootTest(classes = PretzelAdminApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AdminAuthIntegrationTest {
    static RedisServer redis;
    static final String PASSWORD = "T!" + UUID.randomUUID() + "a9";

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) throws Exception {
        String uri = System.getenv("TEST_REDIS_URL");
        if (uri == null || uri.isBlank()) {
            int port;
            try (var socket = new ServerSocket(0)) {
                port = socket.getLocalPort();
            }
            redis = new RedisServer(port);
            redis.start();
            uri = "redis://127.0.0.1:" + port + "/0";
        }
        final String redisUri = uri;
        registry.add("spring.data.redis.url", () -> redisUri);
        registry.add("spring.redis.url", () -> redisUri);
        registry.add("jetcache.remote.default.uri", () -> redisUri);
        registry.add(
                "spring.datasource.url",
                () -> System.getenv()
                        .getOrDefault(
                                "TEST_DB_URL",
                                "jdbc:h2:mem:pretzel;MODE=MySQL;DATABASE_TO_LOWER=TRUE;NON_KEYWORDS=SYSTEM_USER,VALUE;DB_CLOSE_DELAY=-1"));
        registry.add("spring.datasource.username", () -> System.getenv().getOrDefault("TEST_DB_USERNAME", "sa"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("TEST_DB_PASSWORD", ""));
        registry.add("pretzel.auth.captcha.whitelist-enabled", () -> true);
        registry.add("pretzel.auth.captcha.whitelist-values", () -> "integration-only");
    }

    @AfterAll
    static void stop() throws Exception {
        if (redis != null) {
            redis.stop();
        }
    }

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PlatformTransactionManager transactionManager;

    @Test
    void initializesSchemaAndMenusFromOneMigration() {
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM flyway_schema_history WHERE version IS NOT NULL AND success = true",
                        Integer.class));
        assertEquals(
                "1",
                jdbc.queryForObject(
                        "SELECT version FROM flyway_schema_history WHERE version IS NOT NULL AND success = true",
                        String.class));
        assertEquals(
                7,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM system_menu WHERE id BETWEEN 1 AND 7 AND ranks = 0", Integer.class));
    }

    @Test
    void bootstrapIsExplicitAndDoesNotResetExistingAccount() throws Exception {
        var configuration = new BootstrapAdminConfiguration();
        var runner = configuration.bootstrapAdmin(
                jdbc, new TransactionTemplate(transactionManager), "integration-bootstrap", PASSWORD);
        runner.run(null);
        String before = jdbc.queryForObject(
                "SELECT credential_value FROM system_auth_principal_credential c JOIN system_auth_principal_identity i ON c.identity_id=i.id WHERE i.identity_value='integration-bootstrap'",
                String.class);
        runner.run(null);
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM system_auth_principal_identity WHERE identity_value='integration-bootstrap'",
                        Integer.class));
        String after = jdbc.queryForObject(
                "SELECT credential_value FROM system_auth_principal_credential c JOIN system_auth_principal_identity i ON c.identity_id=i.id WHERE i.identity_value='integration-bootstrap'",
                String.class);
        assertEquals(before, after);
        assertTrue(PasswordHelper.validate(PASSWORD, after));
    }

    @Test
    void loginRbacRefreshAndLogoutThroughRealHttpAndRepositories() {
        seed(9001, "integration-admin", "SUPER");
        assertEquals(
                "COMMON-00002",
                post("/sys/current-user/permission/list", Map.of(), null)
                        .getBody()
                        .path("code")
                        .asText());
        JsonNode admin = login("integration-admin");
        String token = admin.path("token").asText();
        assertFalse(token.isBlank());
        JsonNode permissions = success(post("/sys/current-user/permission/list", Map.of(), token));
        assertTrue(permissions.path("perms").toString().contains("super"));
        assertFalse(
                success(post("/sys/current-user/menu/list", Map.of(), token)).isEmpty());
        JsonNode role = success(post(
                "/sys/role/create",
                Map.of("name", "Integration operators", "admin", false, "enable", true, "menus", new Object[] {}),
                token));
        assertFalse(role.path("id").asText().isBlank());
        JsonNode userForm = success(post("/auth/session/pre-auth-session/request", Map.of(), null));
        JsonNode createdUser = success(post(
                "/sys/user/create",
                Map.of(
                        "loginName",
                        "integration-reader",
                        "name",
                        "Integration reader",
                        "enable",
                        true,
                        "admin",
                        false,
                        "ranks",
                        0,
                        "token",
                        userForm.path("loginToken").asText(),
                        "loginPass",
                        Sm2Crypto.encrypt(PASSWORD, userForm.path("publicKey").asText()),
                        "department",
                        Map.of("id", "1"),
                        "roles",
                        new Object[] {}),
                token));
        assertFalse(createdUser.path("id").asText().isBlank());
        JsonNode reader = login("integration-reader");
        String readerToken = reader.path("token").asText();
        var denied = post("/sys/role/create", Map.of("name", "Forbidden"), readerToken);
        assertNotEquals("COMMON-00000", denied.getBody().path("code").asText());
        assertEquals(
                "COMMON-00003",
                post("/sys/user/page", Map.of(), readerToken)
                        .getBody()
                        .path("code")
                        .asText());
        String userMenuId = jdbc.queryForObject("SELECT id FROM system_menu WHERE url='/system/users'", String.class);
        String roleId = role.path("id").asText();
        success(post(
                "/sys/role/update",
                Map.of(
                        "id",
                        roleId,
                        "name",
                        "Integration operators",
                        "enable",
                        true,
                        "admin",
                        false,
                        "menus",
                        new Object[] {Map.of("id", userMenuId)}),
                token));
        success(post(
                "/sys/role/user/update",
                Map.of("roleId", roleId, "users", new Object[] {
                    Map.of("id", createdUser.path("id").asText())
                }),
                token));
        success(post("/sys/user/page", Map.of(), readerToken));
        success(post(
                "/sys/role/update",
                Map.of(
                        "id",
                        roleId,
                        "name",
                        "Integration operators",
                        "enable",
                        true,
                        "admin",
                        false,
                        "menus",
                        new Object[] {}),
                token));
        assertEquals(
                "COMMON-00003",
                post("/sys/user/page", Map.of(), readerToken)
                        .getBody()
                        .path("code")
                        .asText());
        JsonNode refreshed = success(post(
                "/auth/session/token/refresh",
                Map.of(
                        "clientId",
                        "admin-api",
                        "refreshToken",
                        reader.path("refreshToken").asText()),
                null));
        String refreshedToken = refreshed.path("token").asText();
        assertFalse(refreshedToken.isBlank());
        success(post("/auth/session/logout", Map.of("token", refreshedToken), refreshedToken));
        assertEquals(
                "COMMON-00002",
                post("/sys/current-user/permission/list", Map.of(), refreshedToken)
                        .getBody()
                        .path("code")
                        .asText());
        assertEquals(
                "AUTH-00006",
                post(
                                "/auth/session/token/refresh",
                                Map.of(
                                        "clientId",
                                        "admin-api",
                                        "refreshToken",
                                        refreshed.path("refreshToken").asText()),
                                null)
                        .getBody()
                        .path("code")
                        .asText());
        String newReaderToken = login("integration-reader").path("token").asText();
        success(post(
                "/sys/user/status/update",
                new Object[] {Map.of("id", createdUser.path("id").asText(), "enable", false)},
                token));
        assertEquals(
                "COMMON-00002",
                post("/sys/current-user/permission/list", Map.of(), newReaderToken)
                        .getBody()
                        .path("code")
                        .asText());
    }

    private void seed(long id, String name, String privilege) {
        jdbc.update(
                "INSERT INTO system_user (id,department_id,name,privilege,status,ranks) VALUES (?,1,?,?,'ENABLED',9)",
                id,
                name,
                privilege);
        jdbc.update(
                "INSERT INTO system_auth_principal_identity (id,principal_type,principal_id,identity_type,identity_value,status) VALUES (?,'USER',?,'USER_ACCOUNT',?,'ENABLED')",
                id,
                id,
                name);
        jdbc.update(
                "INSERT INTO system_auth_principal_credential (id,principal_type,principal_id,identity_id,credential_type,credential_value,status,failed_limit) VALUES (?,'USER',?,?,'USER_PASSWORD',?,'ACTIVE',5)",
                id,
                id,
                id,
                PasswordHelper.encrypt(PASSWORD));
    }

    private JsonNode login(String username) {
        JsonNode form = success(post("/auth/session/pre-auth-session/request", Map.of(), null));
        return success(post(
                "/auth/session/login",
                Map.of(
                        "loginToken",
                        form.path("loginToken").asText(),
                        "userName",
                        username,
                        "password",
                        Sm2Crypto.encrypt(PASSWORD, form.path("publicKey").asText()),
                        "captcha",
                        "integration-only"),
                null));
    }

    private ResponseEntity<JsonNode> post(String path, Object body, String token) {
        var headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.set("Access-Token", token);
        }
        return http.exchange("/api" + path, HttpMethod.POST, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private JsonNode success(ResponseEntity<JsonNode> response) {
        assertNotNull(response.getBody());
        assertEquals("COMMON-00000", response.getBody().path("code").asText(), () -> response.getBody()
                .toString());
        return response.getBody().path("data");
    }
}
