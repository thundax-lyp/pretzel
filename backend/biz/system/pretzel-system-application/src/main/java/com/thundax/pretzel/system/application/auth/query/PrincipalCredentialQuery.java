package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalCredentialId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalIdentityId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;

public record PrincipalCredentialQuery(
        PrincipalCredentialId id,
        PrincipalIdentityId identityId,
        PrincipalCredentialType credentialType,
        PrincipalKey principalKey,
        PrincipalCredentialStatus status) {}
