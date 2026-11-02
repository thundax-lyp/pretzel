package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalAuthenticationMethod;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record CreateAdminAccessTokenCommand(
        UserId userId,
        String loginName,
        String ip,
        String userAgent,
        PrincipalAuthenticationMethod authenticationMethod,
        PrincipalIdentityType identityType) {}
