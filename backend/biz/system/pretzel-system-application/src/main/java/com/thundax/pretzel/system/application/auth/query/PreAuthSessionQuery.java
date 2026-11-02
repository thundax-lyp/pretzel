package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionToken;

public record PreAuthSessionQuery(PreAuthSessionId id, PreAuthSessionToken token, PreAuthSessionToken refreshToken) {}
