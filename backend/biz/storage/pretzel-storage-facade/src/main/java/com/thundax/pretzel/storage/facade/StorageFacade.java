package com.thundax.pretzel.storage.facade;

import com.thundax.pretzel.storage.facade.request.AbortMultipartUploadFacadeRequest;
import com.thundax.pretzel.storage.facade.request.BindStorageOwnerFacadeRequest;
import com.thundax.pretzel.storage.facade.request.CompleteMultipartUploadFacadeRequest;
import com.thundax.pretzel.storage.facade.request.InitMultipartUploadFacadeRequest;
import com.thundax.pretzel.storage.facade.request.ListStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.MarkStorageUsageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.OpenStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.RemoveStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UnbindStorageOwnerFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UploadMultipartPartFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UploadStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.response.AbortMultipartUploadFacadeResponse;
import com.thundax.pretzel.storage.facade.response.CompleteMultipartUploadFacadeResponse;
import com.thundax.pretzel.storage.facade.response.InitMultipartUploadFacadeResponse;
import com.thundax.pretzel.storage.facade.response.ListStorageFacadeResponse;
import com.thundax.pretzel.storage.facade.response.OpenStorageFacadeResponse;
import com.thundax.pretzel.storage.facade.response.UploadMultipartPartFacadeResponse;
import com.thundax.pretzel.storage.facade.response.UploadStorageFacadeResponse;

public interface StorageFacade {

    boolean exists(OpenStorageFacadeRequest request);

    OpenStorageFacadeResponse open(OpenStorageFacadeRequest request);

    ListStorageFacadeResponse list(ListStorageFacadeRequest request);

    UploadStorageFacadeResponse upload(UploadStorageFacadeRequest request);

    InitMultipartUploadFacadeResponse initMultipartUpload(InitMultipartUploadFacadeRequest request);

    UploadMultipartPartFacadeResponse uploadPart(UploadMultipartPartFacadeRequest request);

    CompleteMultipartUploadFacadeResponse completeMultipart(CompleteMultipartUploadFacadeRequest request);

    AbortMultipartUploadFacadeResponse abortMultipart(AbortMultipartUploadFacadeRequest request);

    void remove(RemoveStorageFacadeRequest request);

    void bindOwner(BindStorageOwnerFacadeRequest request);

    void unbindOwner(UnbindStorageOwnerFacadeRequest request);

    void markInUse(MarkStorageUsageFacadeRequest request);

    void markUnused(MarkStorageUsageFacadeRequest request);
}
