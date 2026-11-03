package com.thundax.pretzel.storage.domain.object.codec;

import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageOwnerParams;

public final class StorageOwnerParamsCodec {

    private StorageOwnerParamsCodec() {}

    public static StorageOwnerParams toDomain(String value) {
        return value == null ? null : new StorageOwnerParams(value);
    }

    public static String toValue(StorageOwnerParams ownerParams) {
        return ownerParams == null ? null : ownerParams.value();
    }
}
