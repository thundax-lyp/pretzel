package com.thundax.pretzel.storage.domain.object.model.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class StorageMimeType extends BaseStringId {

    public StorageMimeType(String value) {
        super(normalize(value));
    }

    private static String normalize(String value) {
        return value == null ? null : value.trim();
    }
}
