package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.enums.RoleStatus;
import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;

public record ChangeRoleStatusCommand(RoleId id, RoleStatus status) {}
