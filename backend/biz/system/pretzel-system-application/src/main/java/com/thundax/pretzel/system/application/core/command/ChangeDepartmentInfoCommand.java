package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.DepartmentId;

public record ChangeDepartmentInfoCommand(
        DepartmentId id, DepartmentId parentId, String name, String shortName, String remarks) {}
