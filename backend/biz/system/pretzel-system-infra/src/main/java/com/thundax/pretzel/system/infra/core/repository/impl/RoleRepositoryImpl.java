package com.thundax.pretzel.system.infra.core.repository.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.common.core.sort.SortDirection;
import com.thundax.pretzel.system.domain.core.codec.MenuIdCodec;
import com.thundax.pretzel.system.domain.core.codec.RoleIdCodec;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import com.thundax.pretzel.system.domain.core.model.entity.Role;
import com.thundax.pretzel.system.domain.core.model.valueobject.MenuId;
import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import com.thundax.pretzel.system.domain.core.repository.RoleRepository;
import com.thundax.pretzel.system.infra.core.persistence.assembler.RolePersistenceAssembler;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.MenuRoleDO;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.RoleDO;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.UserRoleDO;
import com.thundax.pretzel.system.infra.core.persistence.mapper.MenuRoleMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.RoleMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.UserRoleMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Repository;

@Repository
public class RoleRepositoryImpl implements RoleRepository {

    private final RoleMapper mapper;
    private final MenuRoleMapper menuRoleMapper;
    private final UserRoleMapper userRoleMapper;

    public RoleRepositoryImpl(RoleMapper mapper, MenuRoleMapper menuRoleMapper, UserRoleMapper userRoleMapper) {
        this.mapper = mapper;
        this.menuRoleMapper = menuRoleMapper;
        this.userRoleMapper = userRoleMapper;
    }

    @Override
    public Role getById(RoleId id) {
        return RolePersistenceAssembler.toDomain(mapper.selectById(id.value()));
    }

    @Override
    public List<Role> listByIds(List<RoleId> idList) {
        if (idList == null || idList.isEmpty()) {
            return new ArrayList<>();
        }
        return RolePersistenceAssembler.toDomainList(mapper.selectBatchIds(RoleIdCodec.toValues(idList)));
    }

    @Override
    public List<Role> list(String status) {
        return RolePersistenceAssembler.toDomainList(mapper.selectList(buildListWrapper(status)));
    }

    @Override
    public int maxPriority() {
        QueryWrapper<RoleDO> wrapper = new QueryWrapper<>();
        Object max = mapper.selectObjs(wrapper.select("max(priority)")).stream()
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
        if (max == null) {
            return 0;
        }
        if (max instanceof Number) {
            return ((Number) max).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(max));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    @Override
    public List<Role> list(SortDirection sortDirection) {
        return RolePersistenceAssembler.toDomainList(mapper.selectList(buildListWrapper(sortDirection)));
    }

    @Override
    public PageResult<Role> page(String status, int pageNo, int pageSize) {
        Page<RoleDO> dataObjectPage = mapper.selectPage(new Page<>(pageNo, pageSize), buildListWrapper(status));
        return PageResult.of(
                (int) dataObjectPage.getCurrent(),
                (int) dataObjectPage.getSize(),
                dataObjectPage.getTotal(),
                RolePersistenceAssembler.toDomainList(dataObjectPage.getRecords()));
    }

    @Override
    public RoleId insert(Role entity) {
        RoleDO dataObject = RolePersistenceAssembler.toObject(entity);
        mapper.insert(dataObject);
        return RoleIdCodec.toDomain(dataObject.getId());
    }

    @Override
    public int update(Role entity) {
        RoleDO dataObject = RolePersistenceAssembler.toObject(entity);
        int count = mapper.update(
                null,
                buildIdUpdateWrapper(dataObject)
                        .set(RoleDO::getName, dataObject.getName())
                        .set(RoleDO::getPrivilege, dataObject.getPrivilege())
                        .set(RoleDO::getStatus, dataObject.getStatus())
                        .set(RoleDO::getRemarks, dataObject.getRemarks()));
        return count;
    }

    @Override
    public int updatePriority(Role entity) {
        RoleDO dataObject = RolePersistenceAssembler.toObject(entity);
        int count = mapper.update(
                null, buildIdUpdateWrapper(dataObject).set(RoleDO::getPriority, dataObject.getPriority()));
        return count;
    }

    @Override
    public int deleteById(RoleId id) {
        int count = mapper.deleteById(id.value());
        return count;
    }

    @Override
    public int updateStatus(Role role) {
        RoleDO dataObject = RolePersistenceAssembler.toObject(role);
        int count =
                mapper.update(null, buildIdUpdateWrapper(dataObject).set(RoleDO::getStatus, dataObject.getStatus()));
        return count;
    }

    @Override
    public List<MenuId> listRoleMenus(RoleId roleId) {
        LambdaQueryWrapper<MenuRoleDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MenuRoleDO::getRoleId, RoleIdCodec.toValue(roleId));
        return MenuIdCodec.toDomains(menuRoleMapper.selectList(wrapper).stream()
                .map(MenuRoleDO::getMenuId)
                .collect(Collectors.toList()));
    }

    @Override
    public void deleteRoleMenu(RoleId roleId) {
        Long roleIdValue = RoleIdCodec.toValue(roleId);
        LambdaQueryWrapper<MenuRoleDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MenuRoleDO::getRoleId, roleIdValue);
        menuRoleMapper.delete(wrapper);
    }

    @Override
    public void insertRoleMenu(RoleId roleId, List<MenuId> menuIdList) {
        Long roleIdValue = RoleIdCodec.toValue(roleId);
        for (Long menuId : MenuIdCodec.toValues(menuIdList)) {
            menuRoleMapper.insert(RolePersistenceAssembler.toMenuRoleObject(roleIdValue, menuId));
        }
    }

    @Override
    public List<UserId> listRoleUsers(RoleId roleId) {
        LambdaQueryWrapper<UserRoleDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserRoleDO::getRoleId, RoleIdCodec.toValue(roleId));
        return UserIdCodec.toDomains(userRoleMapper.selectList(wrapper).stream()
                .map(UserRoleDO::getUserId)
                .collect(Collectors.toList()));
    }

    @Override
    public void deleteRoleUser(RoleId roleId) {
        Long roleIdValue = RoleIdCodec.toValue(roleId);
        LambdaQueryWrapper<UserRoleDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserRoleDO::getRoleId, roleIdValue);
        userRoleMapper.delete(wrapper);
    }

    @Override
    public void insertRoleUser(RoleId roleId, List<UserId> userIdList) {
        Long roleIdValue = RoleIdCodec.toValue(roleId);
        for (Long userId : UserIdCodec.toValues(userIdList)) {
            userRoleMapper.insert(RolePersistenceAssembler.toUserRoleObject(userId, roleIdValue));
        }
    }

    private LambdaUpdateWrapper<RoleDO> buildIdUpdateWrapper(RoleDO dataObject) {
        LambdaUpdateWrapper<RoleDO> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(RoleDO::getId, dataObject.getId());
        return wrapper;
    }

    private LambdaQueryWrapper<RoleDO> buildListWrapper(String status) {
        LambdaQueryWrapper<RoleDO> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.isNotBlank(status)) {
            wrapper.eq(RoleDO::getStatus, status);
        }
        wrapper.orderByAsc(RoleDO::getPriority, RoleDO::getId);
        return wrapper;
    }

    private LambdaQueryWrapper<RoleDO> buildListWrapper(SortDirection sortDirection) {
        LambdaQueryWrapper<RoleDO> wrapper = new LambdaQueryWrapper<>();
        if (SortDirection.DESC == sortDirection) {
            wrapper.orderByDesc(RoleDO::getPriority);
        } else {
            wrapper.orderByAsc(RoleDO::getPriority);
        }
        wrapper.orderByAsc(RoleDO::getId);
        return wrapper;
    }
}
