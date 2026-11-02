package com.thundax.pretzel.system.application.audit.query;

import com.thundax.pretzel.common.audit.model.enums.AuditAction;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditObjectRef;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditOperatorRef;
import java.time.Instant;

public record AuditLogQuery(
        AuditObjectRef objectRef,
        AuditAction action,
        AuditOperatorRef operatorRef,
        String source,
        String requestId,
        Instant beginDate,
        Instant endDate) {}
