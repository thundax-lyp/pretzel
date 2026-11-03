package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;

public record PreAuthSessionValueQuery(PreAuthSessionId id, String name) {}
