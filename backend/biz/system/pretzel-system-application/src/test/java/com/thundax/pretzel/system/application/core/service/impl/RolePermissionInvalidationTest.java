package com.thundax.pretzel.system.application.core.service.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.system.application.core.command.ChangeRoleStatusCommand;
import com.thundax.pretzel.system.domain.core.codec.RoleIdCodec;
import com.thundax.pretzel.system.domain.core.model.enums.RoleStatus;
import com.thundax.pretzel.system.domain.core.repository.RoleRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class RolePermissionInvalidationTest {
    @Test
    @SuppressWarnings("unchecked")
    void invalidationMustWaitForCommitAndNeverRunOnRollback() {
        RoleManagementApplicationServiceImpl.CacheChangedListener listener =
                mock(RoleManagementApplicationServiceImpl.CacheChangedListener.class);
        ObjectProvider<List<RoleManagementApplicationServiceImpl.CacheChangedListener>> provider =
                mock(ObjectProvider.class);
        when(provider.getIfAvailable(any())).thenReturn(List.of(listener));
        RoleManagementApplicationServiceImpl service =
                new RoleManagementApplicationServiceImpl(mock(RoleRepository.class), provider);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.changeStatus(new ChangeRoleStatusCommand(RoleIdCodec.toDomain(1L), RoleStatus.DISABLED));
            verifyNoInteractions(listener);
            for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
                synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
            }
            verifyNoInteractions(listener);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.changeStatus(new ChangeRoleStatusCommand(RoleIdCodec.toDomain(1L), RoleStatus.DISABLED));
            verifyNoInteractions(listener);
            TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
            verify(listener).onRoleCacheChanged();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
