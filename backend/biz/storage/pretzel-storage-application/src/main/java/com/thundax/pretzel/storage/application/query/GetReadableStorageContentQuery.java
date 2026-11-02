package com.thundax.pretzel.storage.application.query;

import com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectReferenceStatus;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageOwnerRef;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;

public record GetReadableStorageContentQuery(
        StoredObjectId id, StoredObjectReferenceStatus referenceStatus, StorageOwnerRef referenceOwnerRef) {}
