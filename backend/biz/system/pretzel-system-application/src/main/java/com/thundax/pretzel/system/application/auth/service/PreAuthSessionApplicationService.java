package com.thundax.pretzel.system.application.auth.service;

import com.thundax.pretzel.system.application.auth.command.CreatePreAuthSessionCommand;
import com.thundax.pretzel.system.application.auth.command.RefreshPreAuthSessionCommand;
import com.thundax.pretzel.system.application.auth.command.ReleasePreAuthSessionCommand;
import com.thundax.pretzel.system.application.auth.command.UpsertPreAuthSessionValueCommand;
import com.thundax.pretzel.system.application.auth.query.PreAuthSessionQuery;
import com.thundax.pretzel.system.application.auth.query.PreAuthSessionValueQuery;
import com.thundax.pretzel.system.application.auth.query.PreAuthSessionValueValidateQuery;
import com.thundax.pretzel.system.domain.auth.model.entity.PreAuthSession;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;

public interface PreAuthSessionApplicationService {

    PreAuthSession create(CreatePreAuthSessionCommand command);

    PreAuthSessionId getIdByToken(PreAuthSessionQuery query);

    PreAuthSessionId getIdByRefreshToken(PreAuthSessionQuery query);

    PreAuthSession get(PreAuthSessionQuery query);

    PreAuthSession refresh(RefreshPreAuthSessionCommand command);

    void release(ReleasePreAuthSessionCommand command);

    void upsertValue(UpsertPreAuthSessionValueCommand command);

    String getValue(PreAuthSessionValueQuery query);

    boolean existsValidatedValue(PreAuthSessionValueValidateQuery query);
}
