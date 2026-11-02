package com.thundax.pretzel.common.core.traceability.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class RequestId extends BaseStringId {

    public RequestId(String value) {
        super(value == null ? null : value.trim());
    }
}
