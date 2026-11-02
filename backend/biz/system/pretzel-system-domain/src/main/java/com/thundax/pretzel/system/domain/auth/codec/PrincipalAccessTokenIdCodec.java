package com.thundax.pretzel.system.domain.auth.codec;

import com.thundax.pretzel.common.core.id.SnowflakeIdGenerator;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAccessTokenId;

public final class PrincipalAccessTokenIdCodec {

    private PrincipalAccessTokenIdCodec() {}

    public static PrincipalAccessTokenId toDomain(String value) {
        return value == null || value.trim().isEmpty() ? null : new PrincipalAccessTokenId(value);
    }

    public static String toValue(PrincipalAccessTokenId id) {
        return id == null ? null : id.value();
    }

    public static PrincipalAccessTokenId nextId(SnowflakeIdGenerator generator) {
        return toDomain(Long.toHexString(generator.nextId().value()));
    }
}
