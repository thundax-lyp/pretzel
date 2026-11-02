package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import java.util.List;

public record AssignRoleUsersCommand(RoleId roleId, List<UserId> userIds) {}
