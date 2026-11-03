package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalClientId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalRefreshTokenCode;

public record RefreshAdminAccessTokenCommand(
        PrincipalClientId clientId, PrincipalRefreshTokenCode refreshToken, String ip, String userAgent) {}
