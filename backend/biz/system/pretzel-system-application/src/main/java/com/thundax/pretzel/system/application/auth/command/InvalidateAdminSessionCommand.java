package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenCode;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record InvalidateAdminSessionCommand(PrincipalAccessTokenCode token, UserId userId, String reason) {}
