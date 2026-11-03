package com.thundax.pretzel.common.audit.model.enums;

import com.thundax.pretzel.common.core.exception.DomainException;
import java.util.Arrays;

public enum AuditAction {
    CREATE,
    UPDATE,
    DELETE,
    ENABLE,
    DISABLE,
    ARCHIVE,
    RESTORE,
    BIND,
    UNBIND,
    UPDATE_RELATION,
    RESET_CREDENTIAL;

    public String value() {
        return name();
    }

    public static AuditAction from(String value) {
        if (value == null) {
            return null;
        }
        return Arrays.stream(values())
                .filter(item -> item.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new DomainException(
                        "AUDIT-90001", "audit.domain.action.invalid", "Unknown audit action: " + value));
    }
}
