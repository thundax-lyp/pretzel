package com.thundax.pretzel.storage.infra.object.support;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.thundax.pretzel.storage.infra.config.StorageInfraProperties;
import org.junit.jupiter.api.Test;

class StorageObjectContentSettingsTest {

    @Test
    void shouldResolveConfiguredStorageSettings() {
        StorageInfraProperties properties = new StorageInfraProperties();
        properties.setBucketName("archive");
        properties.setContentPath("/objects");

        StorageObjectContentSettings settings = StorageObjectContentSettings.from(properties);

        assertEquals("archive", settings.bucketName());
        assertEquals("/objects/", settings.contentPath());
    }

    @Test
    void shouldUseDefaultsForBlankStorageSettings() {
        StorageInfraProperties properties = new StorageInfraProperties();
        properties.setBucketName(" ");
        properties.setContentPath(" ");

        StorageObjectContentSettings settings = StorageObjectContentSettings.from(properties);

        assertEquals("local", settings.bucketName());
        assertEquals("/api/storage/object/", settings.contentPath());
    }
}
