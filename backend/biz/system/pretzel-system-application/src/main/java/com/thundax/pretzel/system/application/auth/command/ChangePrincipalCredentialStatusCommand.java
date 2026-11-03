package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialStatus;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalCredentialId;

public record ChangePrincipalCredentialStatusCommand(PrincipalCredentialId id, PrincipalCredentialStatus status) {}
