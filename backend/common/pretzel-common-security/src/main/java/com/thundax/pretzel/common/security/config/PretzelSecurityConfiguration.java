package com.thundax.pretzel.common.security.config;

import com.thundax.pretzel.common.security.authorization.HasPermissionBeanPostProcessor;
import com.thundax.pretzel.common.security.permission.PermissionAuthorizationService;
import com.thundax.pretzel.common.security.permission.PermissionMatcher;
import com.thundax.pretzel.common.security.permission.PrefixPermissionMatcher;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

@Configuration
@Import(PretzelMethodSecurityConfiguration.class)
public class PretzelSecurityConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public PermissionMatcher permissionMatcher() {
        return new PrefixPermissionMatcher();
    }

    @Bean("permissionAuthorizationService")
    @ConditionalOnMissingBean(value = PermissionAuthorizationService.class, name = "permissionAuthorizationService")
    public PermissionAuthorizationService permissionAuthorizationService(PermissionMatcher permissionMatcher) {
        return new PermissionAuthorizationService(permissionMatcher);
    }

    @Bean
    @ConditionalOnBean(PermissionAuthorizationService.class)
    @ConditionalOnMissingBean
    public static HasPermissionBeanPostProcessor hasPermissionBeanPostProcessor(
            ObjectProvider<PermissionAuthorizationService> permissionAuthorizationServiceProvider) {
        return new HasPermissionBeanPostProcessor(permissionAuthorizationServiceProvider);
    }
}
