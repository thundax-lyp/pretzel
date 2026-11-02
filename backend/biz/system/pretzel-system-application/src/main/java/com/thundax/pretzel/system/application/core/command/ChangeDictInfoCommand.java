package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.DictId;

public record ChangeDictInfoCommand(DictId id, String type, String label, String value, String remarks) {}
