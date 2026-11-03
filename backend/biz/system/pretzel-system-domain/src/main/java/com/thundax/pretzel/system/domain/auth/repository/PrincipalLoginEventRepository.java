package com.thundax.pretzel.system.domain.auth.repository;

import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalLoginEvent;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalLoginEventId;

public interface PrincipalLoginEventRepository {

    PrincipalLoginEvent getById(PrincipalLoginEventId id);

    PrincipalLoginEventId insert(PrincipalLoginEvent event);
}
