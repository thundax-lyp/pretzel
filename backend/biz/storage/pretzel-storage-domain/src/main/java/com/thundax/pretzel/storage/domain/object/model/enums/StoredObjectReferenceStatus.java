package com.thundax.pretzel.storage.domain.object.model.enums;

import com.thundax.pretzel.common.core.exception.DomainException;
import java.util.Arrays;

public enum StoredObjectReferenceStatus {
    UNREFERENCED,
    REFERENCED;

    public String value() {
        return name();
    }

    public static StoredObjectReferenceStatus from(String value) {
        return Arrays.stream(values())
                .filter(item -> item.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new DomainException(
                        "STORAGE-90004",
                        "storage.domain.reference-status.invalid",
                        "Unknown storage reference status: " + value));
    }
}
