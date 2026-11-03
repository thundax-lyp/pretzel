package com.thundax.pretzel.storage.domain.object.model.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class MultipartUploadId extends BaseStringId {

    public MultipartUploadId(String value) {
        super(value == null ? null : value.trim());
    }

    @Override
    protected void validate(String value) {
        super.validate(value);
        if (!value.matches("[A-Za-z0-9_-]{1,64}")) {
            throw new IllegalArgumentException(
                    "uploadId must be a single path-safe identifier of at most 64 characters");
        }
    }
}
