package com.thundax.pretzel.system.application.auth.command;

import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityStatus;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalIdentityId;

public record ChangePrincipalIdentityStatusCommand(PrincipalIdentityId id, PrincipalIdentityStatus status) {}
