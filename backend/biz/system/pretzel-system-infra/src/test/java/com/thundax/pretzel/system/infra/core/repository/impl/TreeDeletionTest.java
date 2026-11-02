package com.thundax.pretzel.system.infra.core.repository.impl;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.system.domain.core.codec.DepartmentIdCodec;
import com.thundax.pretzel.system.domain.core.codec.MenuIdCodec;
import com.thundax.pretzel.system.infra.core.cache.DepartmentCacheSupport;
import com.thundax.pretzel.system.infra.core.cache.MenuCacheSupport;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.DepartmentDO;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.MenuDO;
import com.thundax.pretzel.system.infra.core.persistence.mapper.DepartmentMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.MenuMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.MenuRoleMapper;
import org.junit.jupiter.api.Test;

class TreeDeletionTest {
    @Test
    void cannotDeleteMenuWithChildren() {
        MenuMapper mapper = mock(MenuMapper.class);
        MenuCacheSupport cache = mock(MenuCacheSupport.class);
        MenuDO node = new MenuDO();
        node.setId(1L);
        node.setLft(1);
        node.setRgt(6);
        when(mapper.selectById(1L)).thenReturn(node);
        MenuRepositoryImpl repository = new MenuRepositoryImpl(mapper, mock(MenuRoleMapper.class), cache);
        assertThrows(BizException.class, () -> repository.deleteById(MenuIdCodec.toDomain(1L)));
        verify(mapper).selectById(1L);
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(cache);
    }

    @Test
    void cannotDeleteDepartmentWithChildren() {
        DepartmentMapper mapper = mock(DepartmentMapper.class);
        DepartmentCacheSupport cache = mock(DepartmentCacheSupport.class);
        DepartmentDO node = new DepartmentDO();
        node.setId(1L);
        node.setLft(1);
        node.setRgt(6);
        when(mapper.selectById(1L)).thenReturn(node);
        DepartmentRepositoryImpl repository = new DepartmentRepositoryImpl(mapper, cache);
        assertThrows(BizException.class, () -> repository.deleteById(DepartmentIdCodec.toDomain(1L)));
        verify(mapper).selectById(1L);
        verifyNoMoreInteractions(mapper);
        verifyNoInteractions(cache);
    }
}
