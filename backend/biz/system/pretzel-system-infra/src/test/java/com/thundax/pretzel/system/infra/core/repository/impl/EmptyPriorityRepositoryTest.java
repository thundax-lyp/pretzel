package com.thundax.pretzel.system.infra.core.repository.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.system.infra.core.persistence.mapper.DictMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.RoleMapper;
import java.util.Collections;
import org.junit.jupiter.api.Test;

class EmptyPriorityRepositoryTest {
    @Test
    void firstRoleCanBeCreatedWhenSqlMaxReturnsNull() {
        RoleMapper mapper = mock(RoleMapper.class);
        when(mapper.selectObjs(any())).thenReturn(Collections.singletonList(null));
        assertEquals(0, new RoleRepositoryImpl(mapper, null, null).maxPriority());
    }

    @Test
    void firstDictionaryCanBeCreatedWhenSqlMaxReturnsNull() {
        DictMapper mapper = mock(DictMapper.class);
        when(mapper.selectObjs(any())).thenReturn(Collections.singletonList(null));
        assertEquals(0, new DictRepositoryImpl(mapper, null).maxPriority());
    }
}
