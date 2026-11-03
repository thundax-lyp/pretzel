package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.DepartmentId;

public record CreateDepartmentCommand(
        DepartmentId id, DepartmentId parentId, String name, String shortName, String remarks) {}
