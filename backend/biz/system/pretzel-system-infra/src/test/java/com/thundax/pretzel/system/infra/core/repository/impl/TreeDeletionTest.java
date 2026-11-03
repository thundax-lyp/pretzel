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
import com.thundax.pretzel.system.infra.core.persistence.dataobject.DepartmentDO;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.MenuDO;
import com.thundax.pretzel.system.infra.core.persistence.mapper.DepartmentMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.MenuMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.MenuRoleMapper;
import org.junit.jupiter.api.Test;

class TreeDeletionTest {

    @Test
    void movingMenuOrDepartmentToItselfMustNotTouchTree() {
        MenuMapper menus = mock(MenuMapper.class);
        DepartmentMapper departments = mock(DepartmentMapper.class);
        var departmentCache = mock(DepartmentCacheSupport.class);
        var menuRepository = new MenuRepositoryImpl(menus, mock(MenuRoleMapper.class));
        var departmentRepository = new DepartmentRepositoryImpl(departments, departmentCache);
        for (var type : com.thundax.pretzel.common.core.tree.TreeNodeMoveType.values()) {
            assertThrows(
                    BizException.class,
                    () -> menuRepository.moveTreeNode(MenuIdCodec.toDomain(1L), MenuIdCodec.toDomain(1L), type));
            assertThrows(
                    BizException.class,
                    () -> departmentRepository.moveTreeNode(
                            DepartmentIdCodec.toDomain(1L), DepartmentIdCodec.toDomain(1L), type));
        }
        verifyNoInteractions(menus, departments, departmentCache);
    }

    @Test
    void cannotDeleteMenuWithChildren() {
        MenuMapper mapper = mock(MenuMapper.class);
        MenuDO node = new MenuDO();
        node.setId(1L);
        node.setLft(1);
        node.setRgt(6);
        when(mapper.selectById(1L)).thenReturn(node);
        MenuRepositoryImpl repository = new MenuRepositoryImpl(mapper, mock(MenuRoleMapper.class));
        assertThrows(BizException.class, () -> repository.deleteById(MenuIdCodec.toDomain(1L)));
        verify(mapper).selectById(1L);
        verifyNoMoreInteractions(mapper);
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

    @Test
    void menuCannotMoveUnderItselfOrDescendant() {
        for (long parentId : new long[] {1L, 2L}) {
            MenuMapper mapper = mock(MenuMapper.class);
            MenuDO node = new MenuDO();
            node.setId(1L);
            node.setLft(1);
            node.setRgt(6);
            MenuDO child = new MenuDO();
            child.setId(2L);
            child.setParentId(1L);
            child.setLft(2);
            child.setRgt(3);
            when(mapper.selectById(1L)).thenReturn(node);
            when(mapper.selectById(2L)).thenReturn(child);
            var changed = new com.thundax.pretzel.system.domain.core.model.entity.Menu();
            changed.setId(MenuIdCodec.toDomain(1L));
            changed.setParentId(MenuIdCodec.toDomain(parentId));
            assertThrows(BizException.class, () -> new MenuRepositoryImpl(mapper, mock(MenuRoleMapper.class))
                    .update(changed));
            verify(mapper, org.mockito.Mockito.never())
                    .update(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        }
    }

    @Test
    void departmentCannotMoveUnderItselfOrDescendant() {
        for (long parentId : new long[] {1L, 2L}) {
            DepartmentMapper mapper = mock(DepartmentMapper.class);
            DepartmentCacheSupport cache = mock(DepartmentCacheSupport.class);
            DepartmentDO node = new DepartmentDO();
            node.setId(1L);
            node.setLft(1);
            node.setRgt(6);
            DepartmentDO child = new DepartmentDO();
            child.setId(2L);
            child.setParentId(1L);
            child.setLft(2);
            child.setRgt(3);
            when(mapper.selectById(1L)).thenReturn(node);
            when(mapper.selectById(2L)).thenReturn(child);
            var changed = new com.thundax.pretzel.system.domain.core.model.entity.Department();
            changed.setId(DepartmentIdCodec.toDomain(1L));
            changed.setParentId(DepartmentIdCodec.toDomain(parentId));
            assertThrows(BizException.class, () -> new DepartmentRepositoryImpl(mapper, cache).update(changed));
            verify(mapper, org.mockito.Mockito.never())
                    .update(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
            verifyNoInteractions(cache);
        }
    }
}
