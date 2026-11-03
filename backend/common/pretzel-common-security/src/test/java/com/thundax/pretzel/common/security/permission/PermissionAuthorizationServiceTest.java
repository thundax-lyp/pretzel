package com.thundax.pretzel.common.security.permission;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.thundax.pretzel.common.security.context.PretzelContextHolder;
import com.thundax.pretzel.common.security.context.PretzelSubject;
import com.thundax.pretzel.common.security.context.PretzelSubjectType;
import java.util.Arrays;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

public class PermissionAuthorizationServiceTest {

    @AfterEach
    public void tearDown() {
        PretzelContextHolder.clear();
    }

    @Test
    public void shouldPermitWhenAnyRequiredPermissionMatches() {
        PretzelContextHolder.setSubject(new PretzelSubject(
                "user-1", PretzelSubjectType.ADMIN_USER, "Admin", "token-1", Arrays.asList("sys:user:view")));
        PermissionAuthorizationService service = new PermissionAuthorizationService(new PrefixPermissionMatcher());

        assertTrue(service.isPermittedAny("sys:role:view", "sys:user:view"));
    }

    @Test
    public void shouldPermitSuperUser() {
        PretzelContextHolder.setSubject(new PretzelSubject(
                "user-1", PretzelSubjectType.ADMIN_USER, "Admin", "token-1", Arrays.asList("super")));
        PermissionAuthorizationService service = new PermissionAuthorizationService(new PrefixPermissionMatcher());

        assertTrue(service.isPermitted("sys:user:view"));
    }

    @Test
    public void shouldDenyAnonymousUser() {
        PermissionAuthorizationService service = new PermissionAuthorizationService(new PrefixPermissionMatcher());

        assertFalse(service.isPermitted("sys:user:view"));
    }
}
