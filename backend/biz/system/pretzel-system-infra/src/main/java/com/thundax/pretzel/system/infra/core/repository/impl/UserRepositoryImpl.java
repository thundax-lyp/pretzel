package com.thundax.pretzel.system.infra.core.repository.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.common.mybatis.typehandler.DefaultEncryptTypeHandler;
import com.thundax.pretzel.system.domain.core.codec.DepartmentIdCodec;
import com.thundax.pretzel.system.domain.core.codec.RoleIdCodec;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.enums.UserPrivilege;
import com.thundax.pretzel.system.domain.core.model.enums.UserStatus;
import com.thundax.pretzel.system.domain.core.model.valueobject.DepartmentId;
import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import com.thundax.pretzel.system.domain.core.repository.UserRepository;
import com.thundax.pretzel.system.infra.core.persistence.assembler.UserPersistenceAssembler;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.UserDO;
import com.thundax.pretzel.system.infra.core.persistence.dataobject.UserRoleDO;
import com.thundax.pretzel.system.infra.core.persistence.mapper.UserMapper;
import com.thundax.pretzel.system.infra.core.persistence.mapper.UserRoleMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepositoryImpl implements UserRepository {

    private static final String DEPARTMENT_TREE_FILTER_SQL =
            "department_id IN (SELECT o.id FROM system_department query_department "
                    + "JOIN system_department o ON o.lft BETWEEN query_department.lft AND query_department.rgt "
                    + "WHERE query_department.id = {0})";
    private static final String ACCOUNT_LOGIN_NAME_FILTER_SQL = "id IN (SELECT principal_id "
            + "FROM system_auth_principal_identity WHERE principal_type = 'USER' AND identity_type = 'USER_ACCOUNT' "
            + "AND identity_value LIKE CONCAT('%',{0},'%'))";
    private final UserMapper mapper;
    private final UserRoleMapper userRoleMapper;

    public UserRepositoryImpl(UserMapper mapper, UserRoleMapper userRoleMapper) {
        this.mapper = mapper;
        this.userRoleMapper = userRoleMapper;
    }

    @Override
    public User getById(UserId id) {
        return UserPersistenceAssembler.toDomain(mapper.selectById(id.value()));
    }

    @Override
    public User getByIdForUpdate(UserId id) {
        return UserPersistenceAssembler.toDomain(mapper.selectOne(
                new LambdaQueryWrapper<UserDO>().eq(UserDO::getId, id.value()).last("FOR UPDATE")));
    }

    @Override
    public int updateProfile(User user) {
        return mapper.update(
                null,
                new LambdaUpdateWrapper<UserDO>()
                        .eq(UserDO::getId, user.getId().value())
                        .set(UserDO::getName, user.getName())
                        .set(
                                UserDO::getEmail,
                                user.getEmail(),
                                "typeHandler=" + DefaultEncryptTypeHandler.class.getName())
                        .set(
                                UserDO::getMobile,
                                user.getMobile(),
                                "typeHandler=" + DefaultEncryptTypeHandler.class.getName()));
    }

    @Override
    public List<User> listByIds(List<UserId> idList) {
        if (idList == null || idList.isEmpty()) {
            return new ArrayList<>();
        }
        return UserPersistenceAssembler.toDomainList(mapper.selectBatchIds(UserIdCodec.toValues(idList)));
    }

    @Override
    public List<User> list(
            DepartmentId departmentId, String loginName, String name, UserStatus status, UserPrivilege privilege) {
        return UserPersistenceAssembler.toDomainList(mapper.selectList(
                buildListWrapper(DepartmentIdCodec.toValue(departmentId), loginName, name, status, privilege)));
    }

    @Override
    public PageResult<User> page(
            DepartmentId departmentId,
            String loginName,
            String name,
            UserStatus status,
            UserPrivilege privilege,
            int pageNo,
            int pageSize) {
        Page<UserDO> dataObjectPage = mapper.selectPage(
                new Page<>(pageNo, pageSize),
                buildListWrapper(DepartmentIdCodec.toValue(departmentId), loginName, name, status, privilege));
        return PageResult.of(
                (int) dataObjectPage.getCurrent(),
                (int) dataObjectPage.getSize(),
                dataObjectPage.getTotal(),
                UserPersistenceAssembler.toDomainList(dataObjectPage.getRecords()));
    }

    @Override
    public int countByEmail(String email, UserId excludedId) {
        return countByColumn("email", email, excludedId);
    }

    @Override
    public int countByMobile(String mobile, UserId excludedId) {
        return countByColumn("mobile", mobile, excludedId);
    }

    @Override
    public UserId insert(User entity) {
        UserDO dataObject = UserPersistenceAssembler.toObject(entity);
        mapper.insert(dataObject);
        return UserIdCodec.toDomain(dataObject.getId());
    }

    @Override
    public int update(User entity) {
        UserDO dataObject = UserPersistenceAssembler.toObject(entity);
        int count = mapper.update(
                null,
                buildIdUpdateWrapper(dataObject)
                        .set(UserDO::getName, dataObject.getName())
                        .set(UserDO::getDepartmentId, dataObject.getDepartmentId())
                        .set(
                                UserDO::getEmail,
                                dataObject.getEmail(),
                                "typeHandler=" + DefaultEncryptTypeHandler.class.getName())
                        .set(
                                UserDO::getMobile,
                                dataObject.getMobile(),
                                "typeHandler=" + DefaultEncryptTypeHandler.class.getName())
                        .set(UserDO::getTel, dataObject.getTel())
                        .set(UserDO::getRanks, dataObject.getRanks())
                        .set(UserDO::getPrivilege, dataObject.getPrivilege())
                        .set(UserDO::getStatus, dataObject.getStatus())
                        .set(UserDO::getRemarks, dataObject.getRemarks()));
        return count;
    }

    @Override
    public int deleteById(UserId id) {
        int count = mapper.deleteById(id.value());
        return count;
    }

    @Override
    public int updateStatus(User user) {
        UserDO dataObject = UserPersistenceAssembler.toObject(user);
        int count =
                mapper.update(null, buildIdUpdateWrapper(dataObject).set(UserDO::getStatus, dataObject.getStatus()));
        return count;
    }

    @Override
    public List<RoleId> listUserRoles(UserId userId) {
        LambdaQueryWrapper<UserRoleDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserRoleDO::getUserId, UserIdCodec.toValue(userId));
        return RoleIdCodec.toDomains(userRoleMapper.selectList(wrapper).stream()
                .map(UserRoleDO::getRoleId)
                .collect(Collectors.toList()));
    }

    @Override
    public void deleteUserRole(UserId userId) {
        Long userIdValue = UserIdCodec.toValue(userId);
        LambdaQueryWrapper<UserRoleDO> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(UserRoleDO::getUserId, userIdValue);
        userRoleMapper.delete(wrapper);
    }

    @Override
    public void insertUserRole(UserId userId, List<RoleId> roleIdList) {
        Long userIdValue = UserIdCodec.toValue(userId);
        for (Long roleId : RoleIdCodec.toValues(roleIdList)) {
            userRoleMapper.insert(UserPersistenceAssembler.toUserRoleObject(userIdValue, roleId));
        }
    }

    private LambdaUpdateWrapper<UserDO> buildIdUpdateWrapper(UserDO dataObject) {
        LambdaUpdateWrapper<UserDO> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(UserDO::getId, dataObject.getId());
        return wrapper;
    }

    private QueryWrapper<UserDO> buildListWrapper(
            Long departmentId, String loginName, String name, UserStatus status, UserPrivilege privilege) {
        QueryWrapper<UserDO> wrapper = new QueryWrapper<>();
        if (departmentId != null) {
            wrapper.apply(DEPARTMENT_TREE_FILTER_SQL, departmentId);
        }
        if (StringUtils.isNotBlank(loginName)) {
            wrapper.apply(ACCOUNT_LOGIN_NAME_FILTER_SQL, loginName);
        }
        if (StringUtils.isNotBlank(name)) {
            wrapper.like("name", name);
        }
        if (status != null) {
            wrapper.eq("status", status.value());
        }
        if (privilege != null) {
            wrapper.eq("privilege", privilege.value());
        }
        wrapper.orderByAsc("id");
        return wrapper;
    }

    private int countByColumn(String column, String value, UserId excludedId) {
        if (StringUtils.isBlank(value)) {
            return 0;
        }
        QueryWrapper<UserDO> wrapper = new QueryWrapper<>();
        wrapper.eq(column, DefaultEncryptTypeHandler.encrypt(value));
        if (excludedId != null) {
            wrapper.ne("id", UserIdCodec.toValue(excludedId));
        }
        Long count = mapper.selectCount(wrapper);
        return count == null ? 0 : count.intValue();
    }
}
