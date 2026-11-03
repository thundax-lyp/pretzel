package com.thundax.pretzel.system.application.auth.query;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PreAuthSessionId;

public record PreAuthSessionValueValidateQuery(
        PreAuthSessionId id, String name, String value, String bindName, String bindValue) {}
