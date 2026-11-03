package com.thundax.pretzel.common.audit.runtime;

public interface AuditObjectLoader {

    String objectType();

    Object load(String objectId);
}
