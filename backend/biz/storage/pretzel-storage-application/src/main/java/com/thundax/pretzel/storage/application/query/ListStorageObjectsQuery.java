package com.thundax.pretzel.storage.application.query;

import com.thundax.pretzel.common.core.sort.SortDirection;
import com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectReferenceStatus;
import com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectStatus;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageMimeType;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageOwnerRef;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;
import java.util.List;

public record ListStorageObjectsQuery(
        List<StoredObjectId> ids,
        StorageMimeType mimeType,
        StoredObjectStatus objectStatus,
        StoredObjectReferenceStatus referenceStatus,
        StorageOwnerRef referenceOwnerRef,
        String originalFilename,
        String remarks,
        SortDirection sortDirection) {
    public ListStorageObjectsQuery {
        if (sortDirection == null) {
            sortDirection = SortDirection.ASC;
        }
    }
}
