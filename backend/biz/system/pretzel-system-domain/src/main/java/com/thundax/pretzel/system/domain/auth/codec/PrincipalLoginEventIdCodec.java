package com.thundax.pretzel.system.domain.auth.codec;

import com.thundax.pretzel.common.core.id.SnowflakeIdGenerator;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalLoginEventId;

public final class PrincipalLoginEventIdCodec {

    private PrincipalLoginEventIdCodec() {}

    public static PrincipalLoginEventId toDomain(String value) {
        return value == null || value.trim().isEmpty() ? null : new PrincipalLoginEventId(value);
    }

    public static String toValue(PrincipalLoginEventId id) {
        return id == null ? null : id.value();
    }

    public static PrincipalLoginEventId nextId(SnowflakeIdGenerator generator) {
        return toDomain(Long.toHexString(generator.nextId().value()));
    }
}
