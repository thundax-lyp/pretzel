package com.thundax.pretzel.storage.application.command;

import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartUploadId;

public record AbortMultipartUploadCommand(MultipartUploadId uploadId) {}
