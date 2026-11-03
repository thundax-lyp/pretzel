package com.thundax.pretzel.system.application.auth.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties({AuthProperties.class, CaptchaWhitelistProperties.class})
public class AuthApplicationConfiguration {}
