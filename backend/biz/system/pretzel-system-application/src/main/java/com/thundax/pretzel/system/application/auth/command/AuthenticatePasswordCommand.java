package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.application.auth.service.dto.PrincipalPasswordPolicyDTO;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialType;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;

public record AuthenticatePasswordCommand(
        PrincipalIdentityType identityType,
        String identityValue,
        PrincipalCredentialType credentialType,
        String plainPassword,
        PrincipalPasswordPolicyDTO passwordPolicy) {}
