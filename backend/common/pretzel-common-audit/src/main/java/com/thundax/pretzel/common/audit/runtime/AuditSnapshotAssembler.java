package com.thundax.pretzel.common.audit.runtime;

import com.thundax.pretzel.common.audit.model.valueobject.AuditField;
import com.thundax.pretzel.common.audit.model.valueobject.AuditSnapshot;
import java.util.List;

public interface AuditSnapshotAssembler {

    String objectType();

    String objectTypeLabel();

    List<AuditField> fields();

    AuditSnapshot assemble(Object object);
}
