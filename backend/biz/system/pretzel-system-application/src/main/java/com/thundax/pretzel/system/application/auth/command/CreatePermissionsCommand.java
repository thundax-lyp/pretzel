package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenCode;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record CreatePermissionsCommand(PrincipalAccessTokenCode token, UserId userId) {}
