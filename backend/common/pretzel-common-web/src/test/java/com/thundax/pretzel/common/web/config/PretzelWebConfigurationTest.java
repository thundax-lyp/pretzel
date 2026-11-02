package com.thundax.pretzel.common.web.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.thundax.pretzel.common.web.advice.ApiResponseBodyAdvice;
import com.thundax.pretzel.common.web.context.DefaultPretzelContextResolver;
import com.thundax.pretzel.common.web.context.PretzelContextFilter;
import com.thundax.pretzel.common.web.context.PretzelContextResolver;
import com.thundax.pretzel.common.web.exception.DefaultExceptionTranslator;
import com.thundax.pretzel.common.web.exception.GlobalExceptionHandler;
import com.thundax.pretzel.common.web.i18n.I18nMessageResolver;
import com.thundax.pretzel.common.web.restore.RestoreWriteBlockFilter;
import com.thundax.pretzel.common.web.restore.RestoreWriteBlockState;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

public class PretzelWebConfigurationTest {

    private final WebApplicationContextRunner contextRunner =
            new WebApplicationContextRunner().withConfiguration(AutoConfigurations.of(PretzelWebConfiguration.class));

    @Test
    public void shouldRegisterCommonWebBeans() {
        contextRunner.run(context -> {
            context.getBean(I18nMessageResolver.class);
            context.getBean(DefaultExceptionTranslator.class);
            context.getBean(GlobalExceptionHandler.class);
            context.getBean(ApiResponseBodyAdvice.class);
            context.getBean(PretzelContextResolver.class);
            context.getBean(PretzelContextFilter.class);
            context.getBean(RestoreWriteBlockState.class);
            context.getBean(RestoreWriteBlockFilter.class);
        });
    }

    @Test
    public void shouldRegisterContextFilterWithHighestPrecedence() {
        contextRunner.run(context -> {
            FilterRegistrationBean<?> registration =
                    context.getBean("pretzelContextFilterRegistration", FilterRegistrationBean.class);

            assertEquals(Ordered.HIGHEST_PRECEDENCE, registration.getOrder());
        });
    }

    @Test
    public void shouldRegisterRestoreWriteBlockFilterAfterContextFilter() {
        contextRunner.run(context -> {
            FilterRegistrationBean<?> registration =
                    context.getBean("restoreWriteBlockFilterRegistration", FilterRegistrationBean.class);

            assertEquals(Ordered.HIGHEST_PRECEDENCE + 1, registration.getOrder());
        });
    }

    @Test
    public void shouldBackOffWhenCustomContextResolverExists() {
        contextRunner
                .withUserConfiguration(CustomContextResolverConfiguration.class)
                .run(context -> {
                    assertEquals(
                            1,
                            context.getBeansOfType(PretzelContextResolver.class).size());
                });
    }

    @Configuration
    static class CustomContextResolverConfiguration {

        @Bean
        public PretzelContextResolver customPretzelContextResolver() {
            return new DefaultPretzelContextResolver();
        }
    }
}
