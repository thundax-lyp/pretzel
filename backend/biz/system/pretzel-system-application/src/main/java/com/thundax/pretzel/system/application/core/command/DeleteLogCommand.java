package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.application.core.query.LogQuery;

public record DeleteLogCommand(LogQuery query) {}
