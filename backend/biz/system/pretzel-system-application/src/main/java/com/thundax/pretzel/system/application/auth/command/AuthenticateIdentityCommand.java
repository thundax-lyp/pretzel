package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;

public record AuthenticateIdentityCommand(PrincipalIdentityType identityType, String identityValue) {}
