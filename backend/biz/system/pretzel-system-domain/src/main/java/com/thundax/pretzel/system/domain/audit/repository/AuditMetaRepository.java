package com.thundax.pretzel.system.domain.audit.repository;

import com.thundax.pretzel.system.domain.audit.model.entity.AuditMeta;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditMetaId;
import com.thundax.pretzel.system.domain.audit.model.valueobject.AuditObjectRef;

public interface AuditMetaRepository {

    AuditMeta getByObjectRef(AuditObjectRef objectRef);

    AuditMetaId insert(AuditMeta meta);

    int updateIfVersion(AuditMeta meta, long expectedVersion);
}
