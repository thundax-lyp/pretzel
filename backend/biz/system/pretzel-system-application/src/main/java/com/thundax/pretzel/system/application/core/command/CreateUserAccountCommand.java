package com.thundax.pretzel.system.application.core.command;

public record CreateUserAccountCommand(CreateUserCommand userCommand, String loginName, String encryptedPassword) {}
