package com.thundax.pretzel.system.application.core.service;

import com.thundax.pretzel.system.application.core.command.ChangeUserAccountCommand;
import com.thundax.pretzel.system.application.core.command.CreateUserAccountCommand;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;

public interface UserAccountApplicationService {

    UserId create(CreateUserAccountCommand command);

    void change(ChangeUserAccountCommand command);
}
