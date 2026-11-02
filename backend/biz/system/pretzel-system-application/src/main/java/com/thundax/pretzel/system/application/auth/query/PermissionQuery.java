package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenCode;
import com.thundax.pretzel.system.domain.core.model.valueobject.PermissionCode;

public record PermissionQuery(PrincipalAccessTokenCode token, PermissionCode permission) {}
