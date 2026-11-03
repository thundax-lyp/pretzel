package com.thundax.pretzel.common.web.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thundax.pretzel.common.web.advice.ApiResponseBodyAdvice;
import com.thundax.pretzel.common.web.context.DefaultPretzelContextResolver;
import com.thundax.pretzel.common.web.context.PretzelContextFilter;
import com.thundax.pretzel.common.web.context.PretzelContextResolver;
import com.thundax.pretzel.common.web.exception.DefaultExceptionTranslator;
import com.thundax.pretzel.common.web.exception.ExceptionTranslator;
import com.thundax.pretzel.common.web.exception.GlobalExceptionHandler;
import com.thundax.pretzel.common.web.i18n.I18nMessageResolver;
import com.thundax.pretzel.common.web.restore.RestoreWriteBlockFilter;
import com.thundax.pretzel.common.web.restore.RestoreWriteBlockState;
import java.util.List;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
@EnableConfigurationProperties(RestoreWriteBlockProperties.class)
public class PretzelWebConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public I18nMessageResolver i18nMessageResolver(MessageSource messageSource) {
        return new I18nMessageResolver(messageSource);
    }

    @Bean
    @ConditionalOnMissingBean
    public GlobalExceptionHandler globalExceptionHandler(
            I18nMessageResolver i18nMessageResolver, List<ExceptionTranslator> exceptionTranslators) {
        return new GlobalExceptionHandler(i18nMessageResolver, exceptionTranslators);
    }

    @Bean
    @ConditionalOnMissingBean(DefaultExceptionTranslator.class)
    public DefaultExceptionTranslator defaultExceptionTranslator() {
        return new DefaultExceptionTranslator();
    }

    @Bean
    @ConditionalOnMissingBean
    public ApiResponseBodyAdvice apiResponseBodyAdvice() {
        return new ApiResponseBodyAdvice();
    }

    @Bean
    @ConditionalOnMissingBean
    public PretzelContextResolver pretzelContextResolver() {
        return new DefaultPretzelContextResolver();
    }

    @Bean
    @ConditionalOnMissingBean
    public PretzelContextFilter pretzelContextFilter(PretzelContextResolver pretzelContextResolver) {
        return new PretzelContextFilter(pretzelContextResolver);
    }

    @Bean
    @ConditionalOnMissingBean
    public RestoreWriteBlockState restoreWriteBlockState() {
        return new RestoreWriteBlockState();
    }

    @Bean
    @ConditionalOnMissingBean
    public RestoreWriteBlockFilter restoreWriteBlockFilter(
            RestoreWriteBlockState restoreWriteBlockState,
            RestoreWriteBlockProperties restoreWriteBlockProperties,
            ObjectProvider<ObjectMapper> objectMapper) {
        return new RestoreWriteBlockFilter(
                restoreWriteBlockState, restoreWriteBlockProperties, objectMapper.getIfAvailable(ObjectMapper::new));
    }

    @Bean
    @ConditionalOnMissingBean(name = "pretzelContextFilterRegistration")
    public FilterRegistrationBean<PretzelContextFilter> pretzelContextFilterRegistration(
            PretzelContextFilter pretzelContextFilter) {
        FilterRegistrationBean<PretzelContextFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(pretzelContextFilter);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    @Bean
    @ConditionalOnMissingBean(name = "restoreWriteBlockFilterRegistration")
    public FilterRegistrationBean<RestoreWriteBlockFilter> restoreWriteBlockFilterRegistration(
            RestoreWriteBlockFilter restoreWriteBlockFilter) {
        FilterRegistrationBean<RestoreWriteBlockFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(restoreWriteBlockFilter);
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }
}
