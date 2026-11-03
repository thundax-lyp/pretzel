package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.common.core.tree.TreeNodeMoveType;
import com.thundax.pretzel.system.domain.core.model.valueobject.DepartmentId;

public record MoveDepartmentCommand(DepartmentId fromId, DepartmentId toId, TreeNodeMoveType moveType) {}
