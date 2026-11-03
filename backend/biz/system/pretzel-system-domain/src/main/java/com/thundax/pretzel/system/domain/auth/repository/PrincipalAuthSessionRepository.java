package com.thundax.pretzel.system.domain.auth.repository;

import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAuthSession;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAuthSessionId;

public interface PrincipalAuthSessionRepository {

    PrincipalAuthSession getById(PrincipalAuthSessionId id);

    void insert(PrincipalAuthSession session, int expireSeconds);

    void deleteById(PrincipalAuthSessionId id);
}
