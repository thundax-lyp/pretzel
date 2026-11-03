package com.thundax.pretzel.system.application.auth.service.impl;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.system.application.auth.command.AuthenticatePasswordCommand;
import com.thundax.pretzel.system.application.auth.command.RecordPrincipalCredentialFailureCommand;
import com.thundax.pretzel.system.application.auth.query.PrincipalCredentialQuery;
import com.thundax.pretzel.system.application.auth.query.PrincipalIdentityQuery;
import com.thundax.pretzel.system.application.auth.service.PrincipalCredentialApplicationService;
import com.thundax.pretzel.system.application.auth.service.PrincipalIdentityApplicationService;
import com.thundax.pretzel.system.application.auth.service.dto.PrincipalPasswordPolicyDTO;
import com.thundax.pretzel.system.application.auth.util.PasswordHelper;
import com.thundax.pretzel.system.domain.auth.codec.PrincipalCredentialIdCodec;
import com.thundax.pretzel.system.domain.auth.codec.PrincipalIdentityIdCodec;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalCredential;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalIdentity;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialType;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PrincipalAuthenticationApplicationServiceImplTest {

    @Test
    void authenticatePasswordShouldUseLatestFailureCount() {
        PrincipalIdentityApplicationService principalIdentityService = mock(PrincipalIdentityApplicationService.class);
        PrincipalCredentialApplicationService principalCredentialService =
                mock(PrincipalCredentialApplicationService.class);
        PrincipalAuthenticationApplicationServiceImpl service =
                new PrincipalAuthenticationApplicationServiceImpl(principalIdentityService, principalCredentialService);

        PrincipalIdentity identity = new PrincipalIdentity();
        identity.setId(PrincipalIdentityIdCodec.toDomain(100L));
        identity.setStatus(PrincipalIdentityStatus.ENABLED);

        PrincipalCredential credential = activePasswordCredential(1);
        PrincipalCredential latestCredential = activePasswordCredential(3);
        when(principalIdentityService.get(any(PrincipalIdentityQuery.class))).thenReturn(identity);
        when(principalCredentialService.get(any(PrincipalCredentialQuery.class)))
                .thenReturn(credential);
        when(principalCredentialService.recordFailure(any(RecordPrincipalCredentialFailureCommand.class)))
                .thenReturn(latestCredential);

        BizException exception = assertThrows(
                BizException.class,
                () -> service.authenticatePassword(new AuthenticatePasswordCommand(
                        PrincipalIdentityType.USER_ACCOUNT,
                        "admin",
                        PrincipalCredentialType.USER_PASSWORD,
                        "wrong-password",
                        new PrincipalPasswordPolicyDTO(true, 5, 60))));

        assertTrue(exception.getMessage().contains("剩余2次"));
        verify(principalCredentialService).recordFailure(any(RecordPrincipalCredentialFailureCommand.class));
    }

    @Test
    void expiredTimedLockShouldAllowCorrectPasswordButDisabledCredentialMustNot() {
        for (PrincipalCredentialStatus status : new PrincipalCredentialStatus[] {
            PrincipalCredentialStatus.LOCKED, PrincipalCredentialStatus.DISABLED, PrincipalCredentialStatus.EXPIRED
        }) {
            PrincipalIdentityApplicationService identities = mock(PrincipalIdentityApplicationService.class);
            PrincipalCredentialApplicationService credentials = mock(PrincipalCredentialApplicationService.class);
            PrincipalIdentity identity = new PrincipalIdentity();
            identity.setId(PrincipalIdentityIdCodec.toDomain(100L));
            identity.setStatus(PrincipalIdentityStatus.ENABLED);
            PrincipalCredential credential = activePasswordCredential(5);
            credential.setStatus(status);
            credential.setLockedUntil(Instant.now().minusSeconds(1));
            when(identities.get(any(PrincipalIdentityQuery.class))).thenReturn(identity);
            when(credentials.get(any(PrincipalCredentialQuery.class))).thenReturn(credential);
            PrincipalAuthenticationApplicationServiceImpl service =
                    new PrincipalAuthenticationApplicationServiceImpl(identities, credentials);
            AuthenticatePasswordCommand command = new AuthenticatePasswordCommand(
                    PrincipalIdentityType.USER_ACCOUNT,
                    "admin",
                    PrincipalCredentialType.USER_PASSWORD,
                    "right-password",
                    new PrincipalPasswordPolicyDTO(true, 5, 900));
            if (status == PrincipalCredentialStatus.LOCKED) {
                org.junit.jupiter.api.Assertions.assertSame(identity, service.authenticatePassword(command));
                assertTrue(credential.isActive());
                org.junit.jupiter.api.Assertions.assertEquals(0, credential.getFailedCount());
            } else {
                assertThrows(BizException.class, () -> service.authenticatePassword(command));
            }
        }
    }

    private static PrincipalCredential activePasswordCredential(int failedCount) {
        PrincipalCredential credential = new PrincipalCredential();
        credential.setId(PrincipalCredentialIdCodec.toDomain(200L));
        credential.setIdentityId(PrincipalIdentityIdCodec.toDomain(100L));
        credential.setCredentialType(PrincipalCredentialType.USER_PASSWORD);
        credential.setCredentialValue(PasswordHelper.encrypt("right-password"));
        credential.setStatus(PrincipalCredentialStatus.ACTIVE);
        credential.setFailedCount(failedCount);
        credential.setFailedLimit(5);
        return credential;
    }
}
