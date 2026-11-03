package com.thundax.pretzel.system.domain.audit.repository;

import com.thundax.pretzel.common.audit.model.enums.AuditAction;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.system.domain.audit.model.entity.AuditLog;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditLogId;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditObjectRef;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditOperatorRef;
import java.time.Instant;
import java.util.List;

public interface AuditLogRepository {

    AuditLogId insert(AuditLog log);

    AuditLog getById(AuditLogId id);

    AuditLog getByIdempotencyKey(String idempotencyKey);

    List<AuditLog> listByObject(AuditObjectRef objectRef);

    PageResult<AuditLog> page(
            AuditObjectRef objectRef,
            AuditAction action,
            AuditOperatorRef operatorRef,
            String source,
            String requestId,
            Instant beginDate,
            Instant endDate,
            int pageNo,
            int pageSize);
}
