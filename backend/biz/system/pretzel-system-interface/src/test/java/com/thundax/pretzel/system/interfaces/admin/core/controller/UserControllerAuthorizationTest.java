package com.thundax.pretzel.system.interfaces.admin.core.controller;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.system.application.auth.service.PreAuthSessionApplicationService;
import com.thundax.pretzel.system.application.auth.service.PrincipalIdentityApplicationService;
import com.thundax.pretzel.system.application.core.service.CurrentUserProfileApplicationService;
import com.thundax.pretzel.system.application.core.service.DepartmentManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.DictionaryManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.RoleManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.UserAccountApplicationService;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.interfaces.admin.auth.security.CurrentUserResolver;
import com.thundax.pretzel.system.interfaces.admin.core.controller.request.UserSaveRequest;
import com.thundax.pretzel.system.interfaces.admin.core.support.AdminAvatarUrlBuilder;
import org.junit.jupiter.api.Test;

class UserControllerAuthorizationTest {
    @Test
    void superAdministratorCannotDeleteOrEditItself() {
        var resolver = mock(CurrentUserResolver.class);
        var users = mock(UserManagementApplicationService.class);
        var accounts = mock(UserAccountApplicationService.class);
        User current = new User();
        current.setId(com.thundax.pretzel.system.domain.core.codec.UserIdCodec.toDomain(1L));
        current.setPrivilege(com.thundax.pretzel.system.domain.core.model.enums.UserPrivilege.SUPER);
        when(resolver.currentUser()).thenReturn(current);
        when(users.get(org.mockito.ArgumentMatchers.any(
                        com.thundax.pretzel.system.application.core.query.GetUserQuery.class)))
                .thenReturn(current);
        var controller = new UserController(
                users,
                mock(DepartmentManagementApplicationService.class),
                mock(DictionaryManagementApplicationService.class),
                mock(RoleManagementApplicationService.class),
                mock(PrincipalIdentityApplicationService.class),
                accounts,
                mock(PreAuthSessionApplicationService.class),
                resolver,
                mock(CurrentUserProfileApplicationService.class),
                mock(AdminAvatarUrlBuilder.class));
        var id = new com.thundax.pretzel.system.interfaces.admin.core.controller.request.UserIdRequest();
        id.setId("1");
        assertThrows(
                com.thundax.pretzel.common.web.exception.ApiException.class,
                () -> controller.delete(java.util.List.of(id)));
        var edit = new UserSaveRequest();
        edit.setId("1");
        assertThrows(com.thundax.pretzel.common.web.exception.ApiException.class, () -> controller.update(edit));
        org.mockito.Mockito.verify(users, org.mockito.Mockito.never()).remove(org.mockito.ArgumentMatchers.any());
        verifyNoInteractions(accounts);
    }

    @Test
    void delegatedManagerCannotCreateAdministrator() {
        CurrentUserResolver resolver = mock(CurrentUserResolver.class);
        UserAccountApplicationService accounts = mock(UserAccountApplicationService.class);
        when(resolver.currentUser()).thenReturn(new User());
        UserController controller = new UserController(
                mock(UserManagementApplicationService.class),
                mock(DepartmentManagementApplicationService.class),
                mock(DictionaryManagementApplicationService.class),
                mock(RoleManagementApplicationService.class),
                mock(PrincipalIdentityApplicationService.class),
                accounts,
                mock(PreAuthSessionApplicationService.class),
                resolver,
                mock(CurrentUserProfileApplicationService.class),
                mock(AdminAvatarUrlBuilder.class));
        UserSaveRequest request = new UserSaveRequest();
        request.setAdmin(true);
        assertThrows(com.thundax.pretzel.common.web.exception.ApiException.class, () -> controller.add(request));
        verifyNoInteractions(accounts);
    }
}
