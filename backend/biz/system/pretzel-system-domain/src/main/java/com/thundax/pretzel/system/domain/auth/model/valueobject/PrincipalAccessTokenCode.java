package com.thundax.pretzel.system.domain.auth.model.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class PrincipalAccessTokenCode extends BaseStringId {

    private PrincipalAccessTokenCode(String value) {
        super(value);
    }

    public static PrincipalAccessTokenCode of(String value) {
        return new PrincipalAccessTokenCode(value);
    }

    public static PrincipalAccessTokenCode ofNullable(String value) {
        return value == null ? null : of(value);
    }
}
