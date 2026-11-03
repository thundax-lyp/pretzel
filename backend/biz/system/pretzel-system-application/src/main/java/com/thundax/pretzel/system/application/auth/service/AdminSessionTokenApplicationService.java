package com.thundax.pretzel.system.application.auth.service;

import com.thundax.pretzel.system.application.auth.command.CreateAdminAccessTokenCommand;
import com.thundax.pretzel.system.application.auth.command.DeleteAdminAccessTokenCommand;
import com.thundax.pretzel.system.application.auth.command.InvalidateAdminSessionCommand;
import com.thundax.pretzel.system.application.auth.command.RecordPrincipalLoginFailureCommand;
import com.thundax.pretzel.system.application.auth.command.RefreshAdminAccessTokenCommand;
import com.thundax.pretzel.system.application.auth.query.AdminAccessTokenQuery;
import com.thundax.pretzel.system.application.auth.result.AdminAccessTokenResult;
import com.thundax.pretzel.system.application.auth.result.AdminTokenQueryResult;
import com.thundax.pretzel.system.application.auth.result.AdminTokenRefreshResult;

public interface AdminSessionTokenApplicationService {

    AdminAccessTokenResult createAccessToken(CreateAdminAccessTokenCommand command);

    AdminAccessTokenResult getAccessToken(AdminAccessTokenQuery query);

    int deleteAccessTokensByUserId(DeleteAdminAccessTokenCommand command);

    boolean validateToken(AdminAccessTokenQuery query);

    void deleteAccessToken(DeleteAdminAccessTokenCommand command);

    AdminTokenQueryResult getTokenInfo(AdminAccessTokenQuery query);

    AdminTokenRefreshResult refreshAccessToken(RefreshAdminAccessTokenCommand command);

    void invalidateSessionByToken(InvalidateAdminSessionCommand command);

    int invalidateSessionsByUserId(InvalidateAdminSessionCommand command);

    void recordLoginFailed(RecordPrincipalLoginFailureCommand command);
}
