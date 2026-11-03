package com.thundax.pretzel.system.interfaces.admin.core.controller;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.common.web.exception.ApiException;
import com.thundax.pretzel.system.application.auth.service.PrincipalIdentityApplicationService;
import com.thundax.pretzel.system.application.core.query.GetRoleQuery;
import com.thundax.pretzel.system.application.core.service.DepartmentManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.DictionaryManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.MenuManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.RoleManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.domain.core.model.entity.Role;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.enums.RolePrivilege;
import com.thundax.pretzel.system.interfaces.admin.auth.security.CurrentUserResolver;
import com.thundax.pretzel.system.interfaces.admin.core.controller.request.RoleAssignUserRequest;
import com.thundax.pretzel.system.interfaces.admin.core.controller.request.RoleSaveRequest;
import org.junit.jupiter.api.Test;

class RoleControllerAuthorizationTest {
    @Test
    void delegatedRoleManagerCannotCreateOrAssignAdministratorRole() {
        CurrentUserResolver resolver = mock(CurrentUserResolver.class);
        when(resolver.currentUser()).thenReturn(new User());
        RoleManagementApplicationService roles = mock(RoleManagementApplicationService.class);
        UserManagementApplicationService users = mock(UserManagementApplicationService.class);
        RoleController controller = new RoleController(
                roles,
                mock(MenuManagementApplicationService.class),
                mock(DepartmentManagementApplicationService.class),
                mock(DictionaryManagementApplicationService.class),
                users,
                mock(PrincipalIdentityApplicationService.class),
                resolver);
        RoleSaveRequest create = new RoleSaveRequest();
        create.setAdmin(true);
        assertThrows(ApiException.class, () -> controller.add(create));
        verifyNoInteractions(roles);
        Role adminRole = new Role();
        adminRole.setPrivilege(RolePrivilege.ADMIN);
        when(roles.get(any(GetRoleQuery.class))).thenReturn(adminRole);
        RoleAssignUserRequest assign = new RoleAssignUserRequest();
        assign.setRoleId("1");
        assertThrows(ApiException.class, () -> controller.updateUsers(assign));
        verifyNoInteractions(users);
    }
}
