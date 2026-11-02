package com.thundax.pretzel.storage.application.service;

import com.thundax.pretzel.common.core.architecture.LayerPublicApi;
import com.thundax.pretzel.storage.application.command.AbortMultipartUploadCommand;
import com.thundax.pretzel.storage.application.command.CompleteMultipartUploadCommand;
import com.thundax.pretzel.storage.application.command.InitMultipartUploadCommand;
import com.thundax.pretzel.storage.application.command.UploadMultipartPartCommand;
import com.thundax.pretzel.storage.domain.object.model.entity.MultipartUploadPart;
import com.thundax.pretzel.storage.domain.object.model.entity.MultipartUploadSession;
import com.thundax.pretzel.storage.domain.object.model.entity.StoredObject;

public interface StorageMultipartUploadApplicationService {

    @LayerPublicApi(reason = "分片上传流程初始化会话的业务入口")
    MultipartUploadSession init(InitMultipartUploadCommand command);

    @LayerPublicApi(reason = "分片上传流程写入单个分片的业务入口")
    MultipartUploadPart uploadPart(UploadMultipartPartCommand command);

    @LayerPublicApi(reason = "分片上传流程合并并生成存储对象的业务入口")
    StoredObject complete(CompleteMultipartUploadCommand command);

    @LayerPublicApi(reason = "分片上传流程取消会话的业务入口")
    int abort(AbortMultipartUploadCommand command);
}
