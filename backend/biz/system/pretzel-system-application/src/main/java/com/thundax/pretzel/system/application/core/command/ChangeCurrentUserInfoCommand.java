package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public record ChangeCurrentUserInfoCommand(UserId userId, String email, String mobile, String name) {}
