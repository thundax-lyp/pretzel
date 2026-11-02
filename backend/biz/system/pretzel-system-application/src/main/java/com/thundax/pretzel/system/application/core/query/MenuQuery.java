package com.thundax.pretzel.system.application.core.query;

import com.thundax.pretzel.system.domain.core.model.enums.MenuVisibility;
import com.thundax.pretzel.system.domain.core.model.valueobject.AccessRank;
import com.thundax.pretzel.system.domain.core.model.valueobject.MenuId;
import java.util.List;

public record MenuQuery(
        List<MenuId> ids,
        MenuId childId,
        MenuId ancestorId,
        MenuId parentId,
        MenuVisibility visibility,
        AccessRank maxRank) {}
