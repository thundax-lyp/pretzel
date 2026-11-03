package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.enums.UserStatus;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record ChangeUserStatusCommand(UserId id, UserStatus status, User beforeUser, User afterUser) {
    public ChangeUserStatusCommand(UserId id, UserStatus status) {
        this(id, status, null, null);
    }
}
