package com.thundax.pretzel.system.application.auth.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.system.application.auth.command.DeleteAdminAccessTokenCommand;
import com.thundax.pretzel.system.application.auth.command.RefreshAdminAccessTokenCommand;
import com.thundax.pretzel.system.application.auth.config.AuthProperties;
import com.thundax.pretzel.system.application.auth.service.PrincipalIdentityApplicationService;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.domain.auth.codec.PrincipalClientIdCodec;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAccessToken;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAuthSession;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalRefreshToken;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalTokenStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenCode;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalRefreshTokenCode;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalAccessTokenRepository;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalAuthSessionRepository;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalLoginEventRepository;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalRefreshTokenRepository;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.StaticListableBeanFactory;

class AdminSessionTokenApplicationServiceImplTest {
    @Test
    void replacementLoginMustRevokeRefreshEvenWhenAccessTokenAlreadyExpired() {
        PrincipalAccessTokenRepository access = mock(PrincipalAccessTokenRepository.class);
        PrincipalRefreshTokenRepository refresh = mock(PrincipalRefreshTokenRepository.class);
        PrincipalRefreshToken token = refreshToken();
        when(refresh.listByPrincipalKeyAndClientIdAndStatus(any(), any(), any()))
                .thenReturn(List.of(token));
        when(refresh.getByToken("refresh")).thenReturn(token);
        AdminSessionTokenApplicationServiceImpl service = service(access, refresh);
        service.deleteAccessTokensByUserId(
                new DeleteAdminAccessTokenCommand(null, UserIdCodec.toDomain(100L), null, null));
        assertEquals(PrincipalTokenStatus.REVOKED, token.getStatus());
        verify(refresh).updateStatus(token);
        assertThrows(
                BizException.class,
                () -> service.refreshAccessToken(
                        new RefreshAdminAccessTokenCommand(null, PrincipalRefreshTokenCode.of("refresh"), null, null)));
        verify(refresh, never()).updateUsedIfActive(any(), any());
    }

    @Test
    void refreshMustRejectExplicitlyRevokedOriginalLogin() {
        PrincipalAccessTokenRepository access = mock(PrincipalAccessTokenRepository.class);
        PrincipalRefreshTokenRepository refresh = mock(PrincipalRefreshTokenRepository.class);
        when(refresh.getByToken("refresh")).thenReturn(refreshToken());
        PrincipalAccessToken original = new PrincipalAccessToken();
        original.revoke();
        when(access.getById(any())).thenReturn(original);
        assertThrows(BizException.class, () -> service(access, refresh)
                .refreshAccessToken(
                        new RefreshAdminAccessTokenCommand(null, PrincipalRefreshTokenCode.of("refresh"), null, null)));
        verify(refresh, never()).updateUsedIfActive(any(), any());
    }

    @Test
    void logoutMustRevokeOnlyTheMatchingSessionRefreshToken() {
        PrincipalAccessTokenRepository access = mock(PrincipalAccessTokenRepository.class);
        PrincipalRefreshTokenRepository refresh = mock(PrincipalRefreshTokenRepository.class);
        PrincipalAuthSessionRepository sessions = mock(PrincipalAuthSessionRepository.class);
        PrincipalAuthSession session = PrincipalAuthSession.create(
                PrincipalKey.of(PrincipalType.USER, 100L), "admin-api", Instant.now(), 3600);
        PrincipalAccessToken token = new PrincipalAccessToken();
        token.setClientId("admin-api");
        token.setSessionId(session.getId());
        token.setPrincipalKey(session.getPrincipalKey());
        PrincipalRefreshToken matching = refreshToken();
        matching.setSessionId(session.getId());
        PrincipalRefreshToken other = refreshToken();
        when(access.getByToken("access")).thenReturn(token);
        when(sessions.getById(session.getId())).thenReturn(session);
        when(refresh.listByPrincipalKeyAndClientIdAndStatus(any(), any(), any()))
                .thenReturn(List.of(matching, other));
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("access", access);
        beans.addBean("refresh", refresh);
        AdminSessionTokenApplicationServiceImpl service = new AdminSessionTokenApplicationServiceImpl(
                mock(com.thundax.pretzel.system.domain.core.repository.UserRepository.class),
                new AuthProperties(),
                sessions,
                mock(PrincipalIdentityApplicationService.class),
                mock(UserManagementApplicationService.class),
                beans.getBeanProvider(PrincipalAccessTokenRepository.class),
                beans.getBeanProvider(PrincipalRefreshTokenRepository.class),
                beans.getBeanProvider(PrincipalLoginEventRepository.class));
        service.deleteAccessToken(
                new DeleteAdminAccessTokenCommand(PrincipalAccessTokenCode.of("access"), null, null, null));
        assertEquals(PrincipalTokenStatus.REVOKED, matching.getStatus());
        assertEquals(PrincipalTokenStatus.ACTIVE, other.getStatus());
        verify(sessions).deleteById(session.getId());
    }

    private static PrincipalRefreshToken refreshToken() {
        PrincipalRefreshToken token = new PrincipalRefreshToken();
        token.setPrincipalKey(PrincipalKey.of(PrincipalType.USER, 100L));
        token.setClientId(PrincipalClientIdCodec.toDomain("admin-api"));
        token.setExpireAt(Instant.now().plusSeconds(3600));
        return token;
    }

    private static AdminSessionTokenApplicationServiceImpl service(
            PrincipalAccessTokenRepository access, PrincipalRefreshTokenRepository refresh) {
        StaticListableBeanFactory beans = new StaticListableBeanFactory();
        beans.addBean("access", access);
        beans.addBean("refresh", refresh);
        return new AdminSessionTokenApplicationServiceImpl(
                mock(com.thundax.pretzel.system.domain.core.repository.UserRepository.class),
                new AuthProperties(),
                mock(PrincipalAuthSessionRepository.class),
                mock(PrincipalIdentityApplicationService.class),
                mock(UserManagementApplicationService.class),
                beans.getBeanProvider(PrincipalAccessTokenRepository.class),
                beans.getBeanProvider(PrincipalRefreshTokenRepository.class),
                beans.getBeanProvider(PrincipalLoginEventRepository.class));
    }
}
