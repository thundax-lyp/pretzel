package com.thundax.pretzel.common.core.traceability.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class TraceId extends BaseStringId {

    public TraceId(String value) {
        super(value == null ? null : value.trim());
    }
}
