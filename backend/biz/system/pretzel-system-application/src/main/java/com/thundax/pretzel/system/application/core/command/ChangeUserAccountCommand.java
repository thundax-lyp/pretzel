package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import java.util.Optional;

public record ChangeUserAccountCommand(
        ChangeUserInfoCommand userCommand, UserId userId, String loginName, Optional<String> encryptedPassword) {}
