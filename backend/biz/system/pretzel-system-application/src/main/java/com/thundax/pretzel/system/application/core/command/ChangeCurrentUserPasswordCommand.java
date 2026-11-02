package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record ChangeCurrentUserPasswordCommand(UserId userId, String oldPassword, String password) {}
