package com.thundax.pretzel.system.application.auth.config;

import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "pretzel.auth")
public class AuthProperties {

    private int preAuthRequestLimit = 10;

    private int preAuthRequestWindowSeconds = 60;

    private int maxOnlineCount = 200;

    private int loginExpiredSeconds = 300;

    private String whiteCaptcha = StringUtils.EMPTY;

    private String validateCodeTemplate = StringUtils.EMPTY;
}
