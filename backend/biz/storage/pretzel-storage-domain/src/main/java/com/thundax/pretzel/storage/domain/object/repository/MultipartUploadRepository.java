package com.thundax.pretzel.storage.domain.object.repository;

import com.thundax.pretzel.storage.domain.object.model.entity.MultipartUploadPart;
import com.thundax.pretzel.storage.domain.object.model.entity.MultipartUploadSession;
import com.thundax.pretzel.storage.domain.object.model.enums.MultipartUploadStatus;
import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartPartNumber;
import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartUploadId;
import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartUploadPartId;
import com.thundax.pretzel.storage.domain.object.model.valueobject.MultipartUploadSessionId;
import java.util.List;

public interface MultipartUploadRepository {

    MultipartUploadSessionId insertMultipartSession(MultipartUploadSession session);

    MultipartUploadSession getMultipartSessionByUploadId(MultipartUploadId uploadId);

    int updateMultipartSession(MultipartUploadSession session);

    int updateMultipartSessionStatus(
            MultipartUploadId uploadId, MultipartUploadStatus currentStatus, MultipartUploadStatus nextStatus);

    MultipartUploadPartId insertMultipartPart(MultipartUploadPart part);

    MultipartUploadPart getMultipartPart(MultipartUploadId uploadId, MultipartPartNumber partNumber);

    int deleteByUploadId(MultipartUploadId uploadId);

    List<MultipartUploadPart> listMultipartParts(MultipartUploadId uploadId);

    int countMultipartParts(MultipartUploadId uploadId);
}
