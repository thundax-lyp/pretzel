package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;

public record RemoveStorageObjectCommand(StoredObjectId id) {}
