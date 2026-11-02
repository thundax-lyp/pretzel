package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalIdentityId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;

public record PrincipalIdentityQuery(
        PrincipalIdentityId id,
        PrincipalIdentityType identityType,
        String identityValue,
        PrincipalKey principalKey,
        PrincipalIdentityStatus status) {}
