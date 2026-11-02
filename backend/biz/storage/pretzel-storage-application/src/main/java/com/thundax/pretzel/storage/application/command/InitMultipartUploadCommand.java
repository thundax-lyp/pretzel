package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartPartSize;
import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartUploadId;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageBucketName;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageByteSize;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageMimeType;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageObjectKey;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StorageOwnerRef;

public record InitMultipartUploadCommand(
        MultipartUploadId uploadId,
        StorageOwnerRef ownerRef,
        String businessType,
        String originalFilename,
        StorageMimeType mimeType,
        StorageBucketName bucketName,
        StorageObjectKey objectKey,
        MultipartUploadId providerUploadId,
        StorageByteSize totalSize,
        MultipartPartSize partSize) {}
