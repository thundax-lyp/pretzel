package com.thundax.pretzel.system.application.auth.service;

import com.thundax.pretzel.common.core.architecture.LayerPublicApi;
import com.thundax.pretzel.system.application.auth.command.ChangePrincipalIdentityCommand;
import com.thundax.pretzel.system.application.auth.command.ChangePrincipalIdentityStatusCommand;
import com.thundax.pretzel.system.application.auth.command.CreatePrincipalIdentityCommand;
import com.thundax.pretzel.system.application.auth.query.PrincipalIdentityQuery;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalIdentity;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalIdentityId;
import java.util.List;

public interface PrincipalIdentityApplicationService {

    @LayerPublicApi(reason = "统一认证主体资料维护时按查询条件读取登录标识的业务入口")
    PrincipalIdentity get(PrincipalIdentityQuery query);

    @LayerPublicApi(reason = "统一认证主体资料维护时按查询条件列出登录标识的业务入口")
    List<PrincipalIdentity> list(PrincipalIdentityQuery query);

    @LayerPublicApi(reason = "统一认证主体资料维护时新增登录标识的业务入口")
    PrincipalIdentityId create(CreatePrincipalIdentityCommand command);

    @LayerPublicApi(reason = "统一认证主体资料维护时更新登录标识的业务入口")
    void change(ChangePrincipalIdentityCommand command);

    @LayerPublicApi(reason = "统一认证主体资料维护时启停登录标识的业务入口")
    void changeStatus(ChangePrincipalIdentityStatusCommand command);
}
