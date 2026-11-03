package com.thundax.pretzel.system.application.audit.runtime.sys;

import com.thundax.pretzel.common.audit.runtime.AuditObjectLoader;
import com.thundax.pretzel.system.application.core.service.MenuManagementApplicationService;
import com.thundax.pretzel.system.domain.core.codec.MenuIdCodec;
import org.springframework.stereotype.Component;

@Component
public class MenuAuditObjectLoader implements AuditObjectLoader {

    private final MenuManagementApplicationService menuService;

    public MenuAuditObjectLoader(MenuManagementApplicationService menuService) {
        this.menuService = menuService;
    }

    @Override
    public String objectType() {
        return "Menu";
    }

    @Override
    public Object load(String objectId) {
        return menuService.get(MenuIdCodec.toDomain(Long.valueOf(objectId)));
    }
}
