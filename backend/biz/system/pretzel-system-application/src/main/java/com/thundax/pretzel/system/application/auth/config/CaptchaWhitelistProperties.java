package com.thundax.pretzel.system.application.auth.config;

import java.util.Collection;
import java.util.Collections;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "pretzel.auth.captcha")
public class CaptchaWhitelistProperties {

    private boolean whitelistEnabled;
    private Collection<String> whitelistValues = Collections.emptyList();
}
