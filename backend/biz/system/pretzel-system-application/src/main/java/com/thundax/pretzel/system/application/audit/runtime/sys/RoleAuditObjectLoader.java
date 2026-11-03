package com.thundax.pretzel.system.application.audit.runtime.sys;

import com.thundax.pretzel.common.audit.runtime.AuditObjectLoader;
import com.thundax.pretzel.system.application.core.service.RoleManagementApplicationService;
import com.thundax.pretzel.system.domain.core.codec.RoleIdCodec;
import org.springframework.stereotype.Component;

@Component
public class RoleAuditObjectLoader implements AuditObjectLoader {

    private static final String OBJECT_TYPE = "Role";

    private final RoleManagementApplicationService roleService;

    public RoleAuditObjectLoader(RoleManagementApplicationService roleService) {
        this.roleService = roleService;
    }

    @Override
    public String objectType() {
        return OBJECT_TYPE;
    }

    @Override
    public Object load(String objectId) {
        return roleService.get(RoleIdCodec.toDomain(Long.valueOf(objectId)));
    }
}
