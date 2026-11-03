package com.thundax.pretzel.common.security.permission;

import com.thundax.pretzel.common.security.context.PretzelContextHolder;
import com.thundax.pretzel.common.security.context.PretzelSubject;
import java.util.Arrays;

public class PermissionAuthorizationService {

    private static final String SUPER_PERMISSION = "super";

    private final PermissionMatcher permissionMatcher;

    public PermissionAuthorizationService(PermissionMatcher permissionMatcher) {
        this.permissionMatcher = permissionMatcher;
    }

    public boolean isPermitted(String permission) {
        return isPermittedAny(permission);
    }

    public boolean isPermittedAny(String... permissions) {
        PretzelSubject subject = PretzelContextHolder.currentSubject();
        if (subject == null || !subject.isAuthenticated() || permissions == null || permissions.length == 0) {
            return false;
        }
        if (subject.getAuthorities().contains(SUPER_PERMISSION)) {
            return true;
        }
        return Arrays.stream(permissions)
                .filter(permission -> permission != null && !permission.trim().isEmpty())
                .anyMatch(permission -> permissionMatcher.matches(subject.getAuthorities(), permission));
    }
}
