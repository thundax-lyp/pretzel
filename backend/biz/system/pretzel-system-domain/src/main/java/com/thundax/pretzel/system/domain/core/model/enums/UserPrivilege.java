package com.thundax.pretzel.system.domain.core.model.enums;

import com.thundax.pretzel.common.core.exception.DomainException;
import java.util.Arrays;

public enum UserPrivilege {
    NORMAL,
    ADMIN,
    SUPER;

    public String value() {
        return name();
    }

    public static UserPrivilege from(String value) {
        return Arrays.stream(values())
                .filter(item -> item.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new DomainException(
                        "SYS-90005", "sys.domain.user-privilege.invalid", "Unknown user privilege: " + value));
    }
}
