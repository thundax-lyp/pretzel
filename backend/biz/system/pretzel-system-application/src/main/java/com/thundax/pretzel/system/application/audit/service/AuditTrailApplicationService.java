package com.thundax.pretzel.system.application.audit.service;

import com.thundax.pretzel.common.core.page.PageQuery;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.system.application.audit.command.CreateAuditLogCommand;
import com.thundax.pretzel.system.application.audit.query.AuditLogQuery;
import com.thundax.pretzel.system.application.audit.query.AuditMetaQuery;
import com.thundax.pretzel.system.application.audit.query.GetAuditLogQuery;
import com.thundax.pretzel.system.domain.audit.model.entity.AuditLog;
import com.thundax.pretzel.system.domain.audit.model.entity.AuditMeta;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditLogId;
import java.util.List;

public interface AuditTrailApplicationService {

    AuditLogId record(CreateAuditLogCommand command);

    AuditLog getLog(GetAuditLogQuery query);

    AuditMeta getMeta(AuditMetaQuery query);

    List<AuditLog> list(AuditMetaQuery query);

    PageResult<AuditLog> page(AuditLogQuery query, PageQuery pageQuery);
}
