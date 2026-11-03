package com.thundax.pretzel.storage.domain.object.codec;

import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageByteSize;

public final class StorageByteSizeCodec {

    private StorageByteSizeCodec() {}

    public static StorageByteSize toDomain(Long value) {
        return value == null ? null : new StorageByteSize(value);
    }

    public static Long toValue(StorageByteSize size) {
        return size == null ? null : size.value();
    }
}
