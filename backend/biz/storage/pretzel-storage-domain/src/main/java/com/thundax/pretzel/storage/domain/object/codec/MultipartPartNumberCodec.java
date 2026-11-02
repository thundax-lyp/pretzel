package com.thundax.pretzel.storage.domain.object.codec;

import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartPartNumber;

public final class MultipartPartNumberCodec {

    private MultipartPartNumberCodec() {}

    public static MultipartPartNumber toDomain(Integer value) {
        return value == null ? null : new MultipartPartNumber(value);
    }

    public static Integer toValue(MultipartPartNumber partNumber) {
        return partNumber == null ? null : partNumber.value();
    }
}
