package com.thundax.pretzel.storage.application.query;

import com.thundax.pretzel.common.core.sort.SortDirection;
import com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectReferenceStatus;
import com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectStatus;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;
import java.util.List;

public record StorageQuery(
        StoredObjectId id,
        List<StoredObjectId> ids,
        String contentType,
        String referenceOwnerId,
        String referenceOwnerType,
        StoredObjectStatus objectStatus,
        StoredObjectReferenceStatus referenceStatus,
        String originalFilename,
        String remarks,
        SortDirection sortDirection) {
    public StorageQuery() {
        this(null, null, null, null, null, null, null, null, null, SortDirection.ASC);
    }

    public StorageQuery {
        if (sortDirection == null) {
            sortDirection = SortDirection.ASC;
        }
    }
}
