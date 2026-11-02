package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.enums.MenuVisibility;
import com.thundax.pretzel.system.domain.core.model.valueobject.MenuId;

public record ChangeMenuVisibilityCommand(MenuId id, MenuVisibility visibility) {}
