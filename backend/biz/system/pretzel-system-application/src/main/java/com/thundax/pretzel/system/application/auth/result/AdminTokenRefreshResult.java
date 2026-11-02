package com.thundax.pretzel.system.application.auth.result;

import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalRefreshTokenCode;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminTokenRefreshResult {
    private AdminAccessTokenResult accessToken;
    private PrincipalRefreshTokenCode refreshToken;

    public AdminTokenRefreshResult(AdminAccessTokenResult accessToken, PrincipalRefreshTokenCode refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
}
