package com.thundax.pretzel.system.application.audit.runtime;

public interface AuditObjectLoader {

    String objectType();

    Object load(String objectId);
}
