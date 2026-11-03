package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenCode;

public record AdminAccessTokenQuery(PrincipalAccessTokenCode token) {}
