package com.thundax.pretzel.system.application.core.service;

import com.thundax.pretzel.common.core.page.PageQuery;
import com.thundax.pretzel.common.core.page.PageResult;
import com.thundax.pretzel.system.application.core.command.ChangeUserInfoCommand;
import com.thundax.pretzel.system.application.core.command.ChangeUserStatusCommand;
import com.thundax.pretzel.system.application.core.command.CreateUserCommand;
import com.thundax.pretzel.system.application.core.command.RemoveUserCommand;
import com.thundax.pretzel.system.application.core.query.GetUserQuery;
import com.thundax.pretzel.system.application.core.query.UserQuery;
import com.thundax.pretzel.system.domain.core.model.entity.Role;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import java.util.List;

public interface UserManagementApplicationService {

    User get(GetUserQuery query);

    default User get(UserId id) {
        return get(new GetUserQuery(id));
    }

    List<User> list(UserQuery query);

    PageResult<User> page(UserQuery query, PageQuery page);

    boolean existsEmail(UserQuery query);

    boolean existsMobile(UserQuery query);

    UserId create(CreateUserCommand command);

    void changeInfo(ChangeUserInfoCommand command);

    int remove(RemoveUserCommand command);

    int changeStatus(ChangeUserStatusCommand command);

    List<Role> listUserRoles(UserQuery query);
}
