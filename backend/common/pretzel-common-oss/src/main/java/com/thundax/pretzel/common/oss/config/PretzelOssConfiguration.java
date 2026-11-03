package com.thundax.pretzel.common.oss.config;

import com.amazonaws.auth.AWSStaticCredentialsProvider;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.AmazonS3ClientBuilder;
import com.thundax.pretzel.common.oss.client.ObjectStorageClient;
import com.thundax.pretzel.common.oss.support.LocalFileObjectStorageClient;
import com.thundax.pretzel.common.oss.support.S3ObjectStorageClient;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

@Configuration
@EnableConfigurationProperties(PretzelOssProperties.class)
public class PretzelOssConfiguration {

    @Bean
    public PretzelOssConfigurationValidator pretzelOssConfigurationValidator(PretzelOssProperties properties) {
        return new PretzelOssConfigurationValidator(properties);
    }

    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "pretzel.oss", name = "type", havingValue = "local", matchIfMissing = true)
    public ObjectStorageClient localFileObjectStorageClient(PretzelOssProperties properties) {
        return new LocalFileObjectStorageClient(
                properties.getLocal().getRootPath(), properties.getLocal().getLocationPrefix());
    }

    @Bean
    @ConditionalOnMissingBean(AmazonS3.class)
    @ConditionalOnProperty(prefix = "pretzel.oss", name = "type", havingValue = "s3")
    public AmazonS3 amazonS3(PretzelOssProperties properties) {
        PretzelOssProperties.S3 s3 = properties.getS3();
        AmazonS3ClientBuilder builder = AmazonS3ClientBuilder.standard()
                .withPathStyleAccessEnabled(s3.isPathStyleAccess())
                .withCredentials(new AWSStaticCredentialsProvider(
                        new BasicAWSCredentials(s3.getAccessKey(), s3.getSecretKey())));
        if (s3.getEndpoint() != null && s3.getEndpoint().length() > 0) {
            builder.withEndpointConfiguration(
                    new AwsClientBuilder.EndpointConfiguration(s3.getEndpoint(), s3.getRegion()));
        } else {
            builder.withRegion(s3.getRegion());
        }
        return builder.build();
    }

    @Bean
    @ConditionalOnMissingBean(ObjectStorageClient.class)
    @ConditionalOnProperty(prefix = "pretzel.oss", name = "type", havingValue = "s3")
    public ObjectStorageClient s3ObjectStorageClient(AmazonS3 amazonS3, PretzelOssProperties properties) {
        return new S3ObjectStorageClient(
                amazonS3, properties.getS3().getBucket(), properties.getS3().getLocationPrefix());
    }

    public static class PretzelOssConfigurationValidator implements InitializingBean {

        private final PretzelOssProperties properties;

        public PretzelOssConfigurationValidator(PretzelOssProperties properties) {
            this.properties = properties;
        }

        @Override
        public void afterPropertiesSet() {
            String type = properties.getType();
            if (!StringUtils.hasText(type)) {
                throw new IllegalStateException("Missing OSS configuration. Configure pretzel.oss.type.");
            }
            if ("local".equalsIgnoreCase(type)) {
                validateLocal();
                return;
            }
            if ("s3".equalsIgnoreCase(type)) {
                validateS3();
                return;
            }
            throw new IllegalStateException(
                    "Unsupported OSS type: " + type + ". Pretzel currently supports local and s3.");
        }

        private void validateLocal() {
            PretzelOssProperties.Local local = properties.getLocal();
            if (local == null || !StringUtils.hasText(local.getRootPath())) {
                throw new IllegalStateException(
                        "Missing local OSS configuration. Configure pretzel.oss.local.root-path.");
            }
            if (!StringUtils.hasText(local.getLocationPrefix())) {
                throw new IllegalStateException(
                        "Missing local OSS configuration. Configure pretzel.oss.local.location-prefix.");
            }
        }

        private void validateS3() {
            PretzelOssProperties.S3 s3 = properties.getS3();
            if (s3 == null) {
                throw new IllegalStateException("Missing S3 OSS configuration. Configure pretzel.oss.s3.");
            }
            requireText(s3.getRegion(), "pretzel.oss.s3.region");
            requireText(s3.getBucket(), "pretzel.oss.s3.bucket");
            requireText(s3.getAccessKey(), "pretzel.oss.s3.access-key");
            requireText(s3.getSecretKey(), "pretzel.oss.s3.secret-key");
            requireText(s3.getLocationPrefix(), "pretzel.oss.s3.location-prefix");
        }

        private void requireText(String value, String propertyName) {
            if (!StringUtils.hasText(value)) {
                throw new IllegalStateException("Missing S3 OSS configuration. Configure " + propertyName + ".");
            }
        }
    }
}
