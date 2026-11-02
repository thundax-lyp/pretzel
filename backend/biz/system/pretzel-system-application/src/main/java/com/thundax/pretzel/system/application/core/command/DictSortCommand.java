package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.valueobject.DictId;
import java.util.List;

public record DictSortCommand(List<DictId> orderedIds) {}
