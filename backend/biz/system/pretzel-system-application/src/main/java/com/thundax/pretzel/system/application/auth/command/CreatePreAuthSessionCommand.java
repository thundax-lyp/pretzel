package com.thundax.pretzel.system.application.auth.command;

public record CreatePreAuthSessionCommand(int expiredSeconds, String source, int requestLimit, int windowSeconds) {}
