package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.enums.MenuVisibility;
import com.thundax.pretzel.system.domain.core.model.valueobject.AccessRank;
import com.thundax.pretzel.system.domain.core.model.valueobject.MenuId;

public record CreateMenuCommand(
        MenuId id,
        MenuId parentId,
        String name,
        String perms,
        AccessRank rank,
        MenuVisibility visibility,
        String displayParams,
        String url,
        String target,
        String remarks) {}
