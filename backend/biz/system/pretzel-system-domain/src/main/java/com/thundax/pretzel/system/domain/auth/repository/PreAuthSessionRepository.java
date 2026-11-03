package com.thundax.pretzel.system.domain.auth.repository;

import com.thundax.pretzel.system.domain.auth.model.entity.PreAuthSession;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionToken;

public interface PreAuthSessionRepository {

    boolean insertRequestSlot(String source, int limit, int windowSeconds);

    PreAuthSession getById(PreAuthSessionId id);

    PreAuthSessionId getByToken(PreAuthSessionToken token);

    PreAuthSessionId getByRefreshToken(PreAuthSessionToken refreshToken);

    void insert(PreAuthSession session);

    void update(PreAuthSession session);

    void deleteById(PreAuthSessionId id);

    default void deleteByToken(PreAuthSessionToken token) {
        PreAuthSessionId id = getByToken(token);
        if (id != null) {
            deleteById(id);
        }
    }
}
