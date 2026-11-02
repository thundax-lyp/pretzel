package com.thundax.pretzel.system.application.auth.service;

import com.thundax.pretzel.common.core.architecture.LayerPublicApi;
import com.thundax.pretzel.system.application.auth.command.AuthenticateIdentityCommand;
import com.thundax.pretzel.system.application.auth.command.AuthenticatePasswordCommand;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalIdentity;

public interface PrincipalAuthenticationApplicationService {

    @LayerPublicApi(reason = "统一认证主体非密码登录时解析登录标识的业务入口")
    PrincipalIdentity authenticateIdentity(AuthenticateIdentityCommand command);

    PrincipalIdentity authenticatePassword(AuthenticatePasswordCommand command);
}
