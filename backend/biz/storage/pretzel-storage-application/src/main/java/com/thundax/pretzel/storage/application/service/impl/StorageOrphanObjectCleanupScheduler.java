package com.thundax.pretzel.storage.application.service.impl;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.storage.domain.object.model.entity.StoredObject;
import com.thundax.pretzel.storage.domain.object.model.valueobject.StoredObjectId;
import com.thundax.pretzel.storage.domain.object.repository.StoredObjectContentRepository;
import com.thundax.pretzel.storage.domain.object.repository.StoredObjectRepository;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Lazy(false)
public class StorageOrphanObjectCleanupScheduler {

    private static final Duration ORPHAN_ALIVE_TIME = Duration.ofHours(12);

    private final StoredObjectRepository repository;
    private final StoredObjectContentRepository storedObjectContentRepository;
    private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;
    private Clock clock = Clock.systemUTC();

    public StorageOrphanObjectCleanupScheduler(
            StoredObjectRepository repository,
            StoredObjectContentRepository storedObjectContentRepository,
            org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.transactionTemplate = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        this.repository = repository;
        this.storedObjectContentRepository = storedObjectContentRepository;
    }

    StorageOrphanObjectCleanupScheduler useClock(Clock clock) {
        if (clock != null) {
            this.clock = clock;
        }
        return this;
    }

    @Scheduled(cron = "0 0 0/4 * * ?")
    public int cleanupExpiredOrphans() {
        Integer count = transactionTemplate.execute(status -> cleanup());
        return count == null ? 0 : count;
    }

    private int cleanup() {
        Instant threshold = Instant.now(clock).minus(ORPHAN_ALIVE_TIME);
        List<StoredObject> activeOrphans = repository.listExpiredActiveUnreferenced(threshold);
        Set<StoredObjectId> markedThisRun = new HashSet<>();
        for (StoredObject snapshot : activeOrphans.stream()
                .sorted(java.util.Comparator.comparing(o -> o.getId().value()))
                .toList()) {
            StoredObject orphan = repository.getByIdForUpdate(snapshot.getId());
            if (!isOrphan(orphan, threshold)
                    || orphan.getObjectStatus()
                            != com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectStatus.ACTIVE) {
                continue;
            }
            orphan.setObjectStatus(com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectStatus.DELETED);
            repository.updateObjectStatus(orphan);
            markedThisRun.add(orphan.getId());
        }
        List<StoredObject> candidates = repository.listExpiredDeletedUnreferenced(threshold);
        int count = 0;
        for (StoredObject snapshot : candidates.stream()
                .sorted(java.util.Comparator.comparing(o -> o.getId().value()))
                .toList()) {
            StoredObject candidate = repository.getByIdForUpdate(snapshot.getId());
            if (!isOrphan(candidate, threshold)
                    || candidate.getObjectStatus()
                            != com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectStatus.DELETED) {
                continue;
            }
            if (markedThisRun.contains(candidate.getId())) {
                continue;
            }
            delete(candidate);
            count += repository.deleteByIdPermanently(candidate.getId());
        }
        return count;
    }

    private boolean isOrphan(StoredObject object, Instant threshold) {
        return object != null
                && object.getReferenceStatus()
                        == com.thundax.pretzel.storage.domain.object.model.enums.StoredObjectReferenceStatus
                                .UNREFERENCED
                && object.getStoredAt() != null
                && !object.getStoredAt().isAfter(threshold);
    }

    private void delete(StoredObject storage) {
        try {
            storedObjectContentRepository.delete(storage);
        } catch (IOException exception) {
            StoredObjectId id = storage == null ? null : storage.getId();
            String message = "Storage orphan object delete failed: " + id;
            throw new BizException("STORAGE-90006", "storage.orphan.delete-failed", message, exception);
        }
    }
}
