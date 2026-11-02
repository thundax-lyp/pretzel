package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalIdentityId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;

public record ChangePrincipalIdentityCommand(
        PrincipalIdentityId id,
        PrincipalKey principalKey,
        PrincipalIdentityType type,
        String identityValue,
        PrincipalIdentityStatus status) {}
