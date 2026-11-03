package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectStatus;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;

public record ChangeStorageObjectStatusCommand(StoredObjectId id, StoredObjectStatus objectStatus) {}
