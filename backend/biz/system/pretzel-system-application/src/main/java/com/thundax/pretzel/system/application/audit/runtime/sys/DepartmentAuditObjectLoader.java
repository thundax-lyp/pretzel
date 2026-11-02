package com.thundax.pretzel.system.application.audit.runtime.sys;

import com.thundax.pretzel.common.audit.runtime.AuditObjectLoader;
import com.thundax.pretzel.system.application.core.service.DepartmentManagementApplicationService;
import com.thundax.pretzel.system.domain.core.codec.DepartmentIdCodec;
import org.springframework.stereotype.Component;

@Component
public class DepartmentAuditObjectLoader implements AuditObjectLoader {

    private final DepartmentManagementApplicationService departmentService;

    public DepartmentAuditObjectLoader(DepartmentManagementApplicationService departmentService) {
        this.departmentService = departmentService;
    }

    @Override
    public String objectType() {
        return "Department";
    }

    @Override
    public Object load(String objectId) {
        return departmentService.get(DepartmentIdCodec.toDomain(Long.valueOf(objectId)));
    }
}
