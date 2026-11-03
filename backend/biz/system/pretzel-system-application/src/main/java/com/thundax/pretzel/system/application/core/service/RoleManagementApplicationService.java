package com.thundax.pretzel.system.application.core.service;

import com.thundax.pretzel.common.core.page.PageQuery;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.system.application.core.command.AssignRoleUsersCommand;
import com.thundax.pretzel.system.application.core.command.ChangeRoleInfoCommand;
import com.thundax.pretzel.system.application.core.command.ChangeRoleStatusCommand;
import com.thundax.pretzel.system.application.core.command.CreateRoleCommand;
import com.thundax.pretzel.system.application.core.command.RemoveRoleCommand;
import com.thundax.pretzel.system.application.core.command.RoleSortCommand;
import com.thundax.pretzel.system.application.core.query.GetRoleQuery;
import com.thundax.pretzel.system.application.core.query.RoleQuery;
import com.thundax.pretzel.system.domain.core.model.entity.Menu;
import com.thundax.pretzel.system.domain.core.model.entity.Role;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.valueobject.RoleId;
import java.util.List;

public interface RoleManagementApplicationService {

    Role get(GetRoleQuery query);

    default Role get(RoleId id) {
        return get(new GetRoleQuery(id));
    }

    List<Role> list(RoleQuery query);

    PageResult<Role> page(RoleQuery query, PageQuery page);

    RoleId create(CreateRoleCommand command);

    void changeInfo(ChangeRoleInfoCommand command);

    int remove(RemoveRoleCommand command);

    void sort(RoleSortCommand command);

    int changeStatus(ChangeRoleStatusCommand command);

    void assignUsers(AssignRoleUsersCommand command);

    List<User> listRoleUsers(RoleQuery query);

    List<Menu> listRoleMenus(RoleQuery query);
}
