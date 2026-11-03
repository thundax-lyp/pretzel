package com.thundax.pretzel.storage.application.service;

import com.thundax.pretzel.common.core.architecture.LayerPublicApi;
import com.thundax.pretzel.storage.application.command.UploadStorageObjectCommand;
import com.thundax.pretzel.storage.domain.object.model.entity.StoredObject;

public interface StorageUploadApplicationService {

    @LayerPublicApi(reason = "业务对象上传存储对象内容并落元数据的跨模块入口")
    StoredObject upload(UploadStorageObjectCommand command);
}
