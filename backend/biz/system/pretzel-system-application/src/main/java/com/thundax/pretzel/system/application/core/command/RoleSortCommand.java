package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;
import java.util.List;

public record RoleSortCommand(List<RoleId> orderedIds) {}
