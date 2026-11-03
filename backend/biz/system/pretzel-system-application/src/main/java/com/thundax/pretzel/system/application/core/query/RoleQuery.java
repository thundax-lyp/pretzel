package com.thundax.pretzel.system.application.core.query;

import com.thundax.pretzel.system.domain.core.model.enums.RoleStatus;
import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;

public record RoleQuery(RoleId id, RoleStatus status) {}
