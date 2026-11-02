package com.thundax.pretzel.system.application.core.query;

import com.thundax.pretzel.system.domain.core.model.valueobject.DepartmentId;

public record DepartmentQuery(
        DepartmentId childId, DepartmentId ancestorId, DepartmentId parentId, String name, String remarks) {}
