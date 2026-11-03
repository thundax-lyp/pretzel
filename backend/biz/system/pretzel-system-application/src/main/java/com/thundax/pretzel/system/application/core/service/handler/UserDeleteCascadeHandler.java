package com.thundax.pretzel.system.application.core.service.handler;

import com.thundax.pretzel.system.domain.core.model.entity.User;

public interface UserDeleteCascadeHandler {

    void beforeDelete(User user);
}
