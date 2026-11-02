package com.thundax.pretzel.common.core.id;

public abstract class BaseStringId extends BaseId<String> {

    protected BaseStringId(String value) {
        super(value, String.class);
    }

    @Override
    protected void validate(String value) {
        if (value.trim().isEmpty()) {
            throw new IllegalArgumentException("id cannot be blank");
        }
    }
}
