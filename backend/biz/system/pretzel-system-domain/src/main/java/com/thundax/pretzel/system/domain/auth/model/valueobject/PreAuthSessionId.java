package com.thundax.pretzel.system.domain.auth.model.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class PreAuthSessionId extends BaseStringId {

    public PreAuthSessionId(String value) {
        super(value == null ? null : value.trim());
    }
}
