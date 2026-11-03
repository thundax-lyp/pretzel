package com.thundax.pretzel.system.domain.core.model.enums;

import com.thundax.pretzel.common.core.exception.DomainException;
import java.util.Arrays;

public enum UserStatus {
    ENABLED,
    DISABLED;

    public String value() {
        return name();
    }

    public static UserStatus from(String value) {
        return Arrays.stream(values())
                .filter(item -> item.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new DomainException(
                        "SYS-90006", "sys.domain.user-status.invalid", "Unknown user status: " + value));
    }
}
