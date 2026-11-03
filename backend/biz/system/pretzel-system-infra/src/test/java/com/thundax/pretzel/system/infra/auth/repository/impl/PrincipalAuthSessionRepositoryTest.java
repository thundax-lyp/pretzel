package com.thundax.pretzel.system.infra.auth.repository.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.alicp.jetcache.AutoReleaseLock;
import com.alicp.jetcache.Cache;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAuthSession;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;
import java.time.Instant;
import java.util.HashMap;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PrincipalAuthSessionRepositoryTest {
    @Test
    @SuppressWarnings("unchecked")
    void stalePermissionSnapshotCannotShortenRefreshedSession() throws Exception {
        Cache<String, Object> cache = mock(Cache.class);
        var contents = new HashMap<String, Object>();
        when(cache.tryLock(anyString(), anyLong(), any(TimeUnit.class))).thenReturn(mock(AutoReleaseLock.class));
        when(cache.get(anyString())).thenAnswer(call -> contents.get(call.getArgument(0)));
        doAnswer(call -> {
                    contents.put(call.getArgument(0), call.getArgument(1));
                    return null;
                })
                .when(cache)
                .put(anyString(), any(), anyLong(), any(TimeUnit.class));
        var repository = new PrincipalAuthSessionRepositoryImpl();
        var field = PrincipalAuthSessionRepositoryImpl.class.getDeclaredField("cache");
        field.setAccessible(true);
        field.set(repository, cache);
        Instant now = Instant.now();
        var old = PrincipalAuthSession.create(PrincipalKey.of(PrincipalType.USER, 1L), "admin-api", now, 60);
        var refreshed = PrincipalAuthSession.create(PrincipalKey.of(PrincipalType.USER, 1L), "admin-api", now, 3600);
        refreshed.setId(old.getId());
        repository.insert(refreshed, 3610);
        old.getValues().put("permissions", "freshly-loaded");
        repository.insert(old, 70);
        var actual = repository.getById(old.getId());
        assertEquals(refreshed.getExpireAt(), actual.getExpireAt());
        assertEquals("freshly-loaded", actual.getValues().get("permissions"));
        ArgumentCaptor<Long> ttl = ArgumentCaptor.forClass(Long.class);
        verify(cache, times(2)).put(anyString(), any(), ttl.capture(), any(TimeUnit.class));
        assertTrue(ttl.getAllValues().get(1) >= 3600);
    }
}
