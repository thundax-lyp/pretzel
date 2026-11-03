package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialStatus;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalCredentialId;
import java.time.Instant;

public record ChangePrincipalCredentialVerifyStateCommand(
        PrincipalCredentialId id,
        PrincipalCredentialStatus status,
        int failedCount,
        Instant lockedUntil,
        Instant lastVerifiedAt) {}
