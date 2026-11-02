package com.thundax.pretzel.system.application.auth.service;

import com.thundax.pretzel.system.application.auth.command.CreatePermissionsCommand;
import com.thundax.pretzel.system.application.auth.query.PermissionQuery;
import com.thundax.pretzel.system.domain.core.model.valueobject.PermissionCode;
import java.util.Set;

public interface PrincipalPermissionApplicationService {

    Set<PermissionCode> createPermissions(CreatePermissionsCommand command);

    Set<PermissionCode> getPermissions(PermissionQuery query);

    boolean isPermitted(PermissionQuery query);
}
