package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;
import java.util.List;

public record StorageSortCommand(List<StoredObjectId> orderedIds) {}
