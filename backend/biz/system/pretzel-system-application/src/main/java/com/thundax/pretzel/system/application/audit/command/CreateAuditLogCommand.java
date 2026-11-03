package com.thundax.pretzel.system.application.audit.command;

import com.thundax.pretzel.common.audit.model.enums.AuditAction;
import com.thundax.pretzel.common.audit.model.valueobject.AuditSnapshot;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditObjectRef;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditOperatorRef;

public record CreateAuditLogCommand(
        AuditObjectRef objectRef,
        AuditAction action,
        String idempotencyKey,
        AuditOperatorRef operatorRef,
        String operatorName,
        String source,
        String requestId,
        String traceId,
        String remoteAddr,
        String summary,
        AuditSnapshot beforeSnapshot,
        AuditSnapshot afterSnapshot,
        boolean recordWhenUnchanged) {}
