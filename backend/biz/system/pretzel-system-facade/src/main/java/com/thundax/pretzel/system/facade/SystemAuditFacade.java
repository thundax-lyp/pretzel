package com.thundax.pretzel.system.facade;

import com.thundax.pretzel.system.facade.request.SystemAuditFacadeRequest;
import com.thundax.pretzel.system.facade.response.SystemAuditFacadeResponse;

public interface SystemAuditFacade {

    Long record(SystemAuditFacadeRequest request);

    SystemAuditFacadeResponse get(Long auditLogId);
}
