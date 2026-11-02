package com.thundax.pretzel.system.application.audit.query;

import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditObjectRef;

public record AuditMetaQuery(AuditObjectRef objectRef) {}
