package com.thundax.pretzel.storage.infra.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "pretzel.storage")
public class StorageInfraProperties {

    private String bucketName = "local";
    private String contentPath = "/api/storage/object/";
}
