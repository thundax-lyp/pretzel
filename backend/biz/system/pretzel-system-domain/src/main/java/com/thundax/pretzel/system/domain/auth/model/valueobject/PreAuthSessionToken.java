package com.thundax.pretzel.system.domain.auth.model.valueobject;

import com.thundax.pretzel.common.core.id.BaseStringId;

public final class PreAuthSessionToken extends BaseStringId {

    private PreAuthSessionToken(String value) {
        super(value);
    }

    public static PreAuthSessionToken of(String value) {
        return new PreAuthSessionToken(value);
    }

    public static PreAuthSessionToken ofNullable(String value) {
        return value == null ? null : of(value);
    }
}
