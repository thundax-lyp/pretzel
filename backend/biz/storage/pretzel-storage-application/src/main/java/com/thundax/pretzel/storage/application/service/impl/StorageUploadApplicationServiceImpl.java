package com.thundax.pretzel.storage.application.service.impl;

import com.thundax.pretzel.storage.application.command.UploadStorageObjectCommand;
import com.thundax.pretzel.storage.application.service.StorageApplicationService;
import com.thundax.pretzel.storage.application.service.StorageUploadApplicationService;
import com.thundax.pretzel.storage.domain.object.model.entity.StoredObject;
import org.springframework.stereotype.Service;

@Service
public class StorageUploadApplicationServiceImpl implements StorageUploadApplicationService {

    private final StorageApplicationService storageApplicationService;

    public StorageUploadApplicationServiceImpl(StorageApplicationService storageApplicationService) {
        this.storageApplicationService = storageApplicationService;
    }

    @Override
    public StoredObject upload(UploadStorageObjectCommand command) {
        return storageApplicationService.upload(command);
    }
}
