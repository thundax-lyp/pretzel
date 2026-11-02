package com.thundax.pretzel.system.domain.auth.model.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class PrincipalAccessTokenId extends BaseStringId {

    public PrincipalAccessTokenId(String value) {
        super(value == null ? null : value.trim());
    }
}
