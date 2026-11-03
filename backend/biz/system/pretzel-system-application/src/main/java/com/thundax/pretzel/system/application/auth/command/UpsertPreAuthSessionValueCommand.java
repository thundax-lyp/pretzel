package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;

public record UpsertPreAuthSessionValueCommand(PreAuthSessionId id, String name, String value, long expiredAt) {}
