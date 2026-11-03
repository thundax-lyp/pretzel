package com.thundax.pretzel.system.infra.auth.repository.impl;

import com.alicp.jetcache.Cache;
import com.alicp.jetcache.anno.CacheType;
import com.alicp.jetcache.anno.CreateCache;
import com.thundax.pretzel.common.cache.CacheDTO;
import com.thundax.pretzel.common.cache.PretzelCacheNames;
import com.thundax.pretzel.system.domain.auth.codec.PrincipalAuthSessionIdCodec;
import com.thundax.pretzel.system.domain.auth.codec.PrincipalClientIdCodec;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalAuthSession;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalAuthSessionId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;
import com.thundax.pretzel.system.domain.auth.repository.PrincipalAuthSessionRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.ConcurrentModificationException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.util.Assert;

@Repository
@Profile("!test")
public class PrincipalAuthSessionRepositoryImpl implements PrincipalAuthSessionRepository {

    private static final String CACHE_SECTION = PretzelCacheNames.PREFIX + "PRINCIPAL_AUTH_SESSION_V2_";
    private static final String SESSION_PREFIX = CACHE_SECTION + "SESSION_";

    @CreateCache(name = CACHE_SECTION, cacheType = CacheType.REMOTE)
    private Cache<String, PrincipalAuthSessionCacheDTO> cache;

    @Override
    public PrincipalAuthSession getById(PrincipalAuthSessionId id) {
        return toDomain(cache.get(sessionKey(id)));
    }

    @Override
    public void insert(PrincipalAuthSession session, int expireSeconds) {
        Assert.notNull(session, "session can not be null");
        Assert.notNull(session.getId(), "id can not be null");
        Assert.notNull(session.getPrincipalKey(), "principalKey can not be null");
        Assert.notNull(session.getClientId(), "clientId can not be null");
        if (expireSeconds <= 0) {
            return;
        }
        String key = sessionKey(session.getId());
        for (int attempt = 0; attempt < 50; attempt++) {
            try (var lock = cache.tryLock(key + "_WRITE", 5, TimeUnit.SECONDS)) {
                if (lock != null) {
                    PrincipalAuthSessionCacheDTO next = toCacheDTO(session);
                    PrincipalAuthSessionCacheDTO current = cache.get(key);
                    int ttl = expireSeconds;
                    if (current != null && current.expireAt.isAfter(next.expireAt)) {
                        next.issuedAt = current.issuedAt;
                        next.lastAccessTime = current.lastAccessTime;
                        next.expireAt = current.expireAt;
                        ttl = Math.max(
                                ttl,
                                Math.toIntExact(java.time.Duration.between(Instant.now(), current.expireAt)
                                                .toSeconds())
                                        + 10);
                    }
                    cache.put(key, next, ttl, TimeUnit.SECONDS);
                    return;
                }
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new com.thundax.pretzel.common.core.exception.BizException("会话更新已中断");
            }
        }
        throw new com.thundax.pretzel.common.core.exception.BizException("会话正在更新，请重试");
    }

    @Override
    public void deleteById(PrincipalAuthSessionId id) {
        cache.remove(sessionKey(id));
    }

    private String sessionKey(PrincipalAuthSessionId id) {
        return SESSION_PREFIX + PrincipalAuthSessionIdCodec.toValue(id);
    }

    private static PrincipalAuthSession toDomain(PrincipalAuthSessionCacheDTO cacheDTO) {
        if (cacheDTO == null) {
            return null;
        }
        return PrincipalAuthSession.restore(
                PrincipalAuthSessionIdCodec.toDomain(cacheDTO.id),
                PrincipalKey.of(PrincipalType.from(cacheDTO.principalType), cacheDTO.principalId),
                PrincipalClientIdCodec.toDomain(cacheDTO.clientId),
                toEntityValues(cacheDTO.values),
                cacheDTO.issuedAt,
                cacheDTO.lastAccessTime,
                cacheDTO.expireAt);
    }

    private static PrincipalAuthSessionCacheDTO toCacheDTO(PrincipalAuthSession session) {
        PrincipalAuthSessionCacheDTO cacheDTO = new PrincipalAuthSessionCacheDTO();
        cacheDTO.id = PrincipalAuthSessionIdCodec.toValue(session.getId());
        cacheDTO.principalType = session.getPrincipalKey().getPrincipalType().value();
        cacheDTO.principalId = session.getPrincipalKey().getPrincipalId();
        cacheDTO.clientId = PrincipalClientIdCodec.toValue(session.getClientId());
        cacheDTO.values = toCacheValues(session.getValues());
        cacheDTO.issuedAt = session.getIssuedAt();
        cacheDTO.lastAccessTime = session.getLastAccessTime();
        cacheDTO.expireAt = session.getExpireAt();
        return cacheDTO;
    }

    private static Map<String, Object> toEntityValues(Map<String, Object> cacheValues) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (cacheValues == null) {
            return values;
        }
        cacheValues.forEach((key, value) -> values.put(key, copyValue(value)));
        return values;
    }

    private static Map<String, Object> toCacheValues(Map<String, Object> entityValues) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (entityValues == null) {
            return values;
        }
        entityValues.forEach((key, value) -> values.put(key, copyValue(value)));
        return values;
    }

    private static Object copyValue(Object value) {
        if (value instanceof Set) {
            return new LinkedHashSet<>(snapshotCollection((Set<?>) value));
        }
        if (value instanceof Collection) {
            return new ArrayList<>(snapshotCollection((Collection<?>) value));
        }
        if (value instanceof Map) {
            return snapshotMap((Map<?, ?>) value);
        }
        return value;
    }

    private static Collection<?> snapshotCollection(Collection<?> source) {
        for (int index = 0; index < 3; index++) {
            try {
                return new ArrayList<>(source);
            } catch (ConcurrentModificationException ignored) {
                Thread.yield();
            }
        }
        synchronized (source) {
            return new ArrayList<>(source);
        }
    }

    private static Map<?, ?> snapshotMap(Map<?, ?> source) {
        for (int index = 0; index < 3; index++) {
            try {
                return new LinkedHashMap<>(source);
            } catch (ConcurrentModificationException ignored) {
                Thread.yield();
            }
        }
        synchronized (source) {
            return new LinkedHashMap<>(source);
        }
    }

    private static class PrincipalAuthSessionCacheDTO implements CacheDTO {
        private String id;
        private String principalType;
        private Long principalId;
        private String clientId;
        private Map<String, Object> values = new LinkedHashMap<>();
        private Instant issuedAt;
        private Instant lastAccessTime;
        private Instant expireAt;
    }
}
