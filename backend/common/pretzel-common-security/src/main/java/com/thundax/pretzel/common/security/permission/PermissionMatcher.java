package com.thundax.pretzel.common.security.permission;

import java.util.Collection;

public interface PermissionMatcher {

    boolean matches(Collection<String> permissions, String requiredPermission);

    boolean matches(String permission, String requiredPermission);
}
