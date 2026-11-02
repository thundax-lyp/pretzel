package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;

public record RefreshPreAuthSessionCommand(PreAuthSessionId id, int expiredSeconds, int refreshTokenGraceSeconds) {}
