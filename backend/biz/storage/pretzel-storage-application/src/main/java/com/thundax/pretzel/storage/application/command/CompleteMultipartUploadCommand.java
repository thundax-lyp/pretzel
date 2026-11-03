package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartUploadId;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageBucketName;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageByteSize;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageObjectKey;

public record CompleteMultipartUploadCommand(
        MultipartUploadId uploadId,
        StorageBucketName bucketName,
        StorageObjectKey objectKey,
        StorageByteSize size,
        String accessEndpoint) {}
