package com.thundax.pretzel.system.application.auth.service.impl;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.system.application.auth.command.CreatePermissionsCommand;
import com.thundax.pretzel.system.application.auth.query.PermissionQuery;
import com.thundax.pretzel.system.application.core.query.GetUserQuery;
import com.thundax.pretzel.system.application.core.service.CurrentUserProfileApplicationService;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.domain.auth.codec.PrincipalAuthSessionIdCodec;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAccessToken;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAuthSession;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenCode;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAuthSessionId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalAccessTokenRepository;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalAuthSessionRepository;
import com.thundax.pretzel.system.domain.core.codec.MenuIdCodec;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import com.thundax.pretzel.system.domain.core.model.entity.Menu;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.enums.UserStatus;
import com.thundax.pretzel.system.domain.core.model.valueobject.PermissionCode;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PrincipalPermissionApplicationServiceImplTest {

    @Test
    void shouldReloadPermissionsWhenPermissionVersionChanged() {
        PrincipalAccessTokenRepository accessTokenRepository = mock(PrincipalAccessTokenRepository.class);
        PrincipalAuthSessionRepository authSessionRepository = mock(PrincipalAuthSessionRepository.class);
        UserManagementApplicationService userService = mock(UserManagementApplicationService.class);
        CurrentUserProfileApplicationService currentUserService = mock(CurrentUserProfileApplicationService.class);
        PrincipalPermissionApplicationServiceImpl permissionService = new PrincipalPermissionApplicationServiceImpl(
                accessTokenRepository, authSessionRepository, userService, currentUserService);

        PrincipalAuthSessionId sessionId = PrincipalAuthSessionIdCodec.toDomain("session-1");
        PrincipalAuthSession session = PrincipalAuthSession.restore(
                sessionId,
                PrincipalKey.of(PrincipalType.USER, 1L),
                "admin-api",
                null,
                Instant.now(),
                Instant.now(),
                Instant.now().plusSeconds(60));
        PrincipalAccessToken accessToken = new PrincipalAccessToken();
        accessToken.setSessionId(sessionId);
        accessToken.setPrincipalKey(PrincipalKey.of(PrincipalType.USER, 1L));

        User user = new User();
        user.setId(UserIdCodec.toDomain(1L));
        user.setStatus(UserStatus.ENABLED);

        when(accessTokenRepository.getByToken("token")).thenReturn(accessToken);
        when(authSessionRepository.getById(sessionId)).thenReturn(session);
        when(userService.get(any(GetUserQuery.class))).thenReturn(user);
        AtomicInteger reads = new AtomicInteger();
        when(currentUserService.listAccessibleMenus(any())).thenAnswer(invocation -> {
            if (reads.getAndIncrement() == 0) {
                permissionService.onRoleCacheChanged();
                return List.of(menu("system:user:view"));
            }
            return List.of(menu("system:role:view"));
        });

        permissionService.createPermissions(
                new CreatePermissionsCommand(PrincipalAccessTokenCode.of("token"), UserIdCodec.toDomain(1L)));
        permissionService.onRoleCacheChanged();
        Set<PermissionCode> permissions =
                permissionService.getPermissions(new PermissionQuery(PrincipalAccessTokenCode.of("token"), null));

        assertTrue(permissions.contains(PermissionCode.of("system:role:view")));
        org.junit.jupiter.api.Assertions.assertFalse(permissions.contains(PermissionCode.of("system:user:view")));
        verify(currentUserService, times(3)).listAccessibleMenus(any());
        verify(authSessionRepository, times(2)).insert(any(PrincipalAuthSession.class), any(Integer.class));
    }

    @Test
    void newProcessEpochMustRejectSurvivingRedisSnapshot() {
        var access = mock(PrincipalAccessTokenRepository.class);
        var sessions = mock(PrincipalAuthSessionRepository.class);
        var users = mock(UserManagementApplicationService.class);
        var profile = mock(CurrentUserProfileApplicationService.class);
        var session =
                PrincipalAuthSession.create(PrincipalKey.of(PrincipalType.USER, 1L), "admin-api", Instant.now(), 3600);
        var token = new PrincipalAccessToken();
        token.setSessionId(session.getId());
        token.setPrincipalKey(session.getPrincipalKey());
        var user = new User();
        user.setId(UserIdCodec.toDomain(1L));
        user.setStatus(UserStatus.ENABLED);
        when(access.getByToken("token")).thenReturn(token);
        when(sessions.getById(session.getId())).thenReturn(session);
        when(users.get(any(GetUserQuery.class))).thenReturn(user);
        when(profile.listAccessibleMenus(any())).thenReturn(List.of(menu("sys:user:edit")));
        var first = new PrincipalPermissionApplicationServiceImpl(access, sessions, users, profile);
        first.createPermissions(new CreatePermissionsCommand(PrincipalAccessTokenCode.of("token"), user.getId()));
        first.onRoleCacheChanged();
        when(profile.listAccessibleMenus(any())).thenReturn(List.of());
        var restarted = new PrincipalPermissionApplicationServiceImpl(access, sessions, users, profile);
        org.junit.jupiter.api.Assertions.assertFalse(restarted
                .getPermissions(new PermissionQuery(PrincipalAccessTokenCode.of("token"), null))
                .contains(PermissionCode.of("sys:user:edit")));
        verify(profile, times(2)).listAccessibleMenus(any());
    }

    private static Menu menu(String permission) {
        Menu menu = new Menu();
        menu.setId(MenuIdCodec.toDomain(1L));
        menu.setPerms(permission);
        return menu;
    }
}
