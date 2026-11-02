package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalCredentialId;
import java.time.Instant;

public record RecordPrincipalCredentialFailureCommand(PrincipalCredentialId id, int failedLimit, Instant lockedUntil) {}
