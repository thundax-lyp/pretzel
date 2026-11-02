package com.thundax.pretzel.system.interfaces.admin.auth.security;

import com.thundax.pretzel.common.security.context.PretzelContextHolder;
import com.thundax.pretzel.common.security.context.PretzelSubject;
import com.thundax.pretzel.common.security.context.PretzelSubjectType;
import com.thundax.pretzel.common.web.exception.AdminResponseExceptions;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import java.util.Set;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

@Component
public class CurrentUserResolver {

    private final UserManagementApplicationService userService;

    public CurrentUserResolver(UserManagementApplicationService userService) {
        this.userService = userService;
    }

    public User currentUser() {
        String subjectId = currentUserId();
        if (StringUtils.isBlank(subjectId)) {
            return new User();
        }
        try {
            User user = userService.get(UserIdCodec.toDomain(Long.valueOf(subjectId)));
            return user == null ? new User() : user;
        } catch (NumberFormatException e) {
            return new User();
        }
    }

    public User requireCurrentUser() {
        User user = currentUser();
        if (user.getId() == null || !user.isEnable()) {
            throw AdminResponseExceptions.invalidToken();
        }
        return user;
    }

    public String currentUserId() {
        PretzelSubject subject = PretzelContextHolder.currentSubject();
        return subject.getSubjectType() == PretzelSubjectType.ADMIN_USER ? subject.getSubjectId() : null;
    }

    public String currentToken() {
        PretzelSubject subject = PretzelContextHolder.currentSubject();
        return subject.getSubjectType() == PretzelSubjectType.ADMIN_USER ? subject.getToken() : null;
    }

    public Set<String> currentAuthorities() {
        return PretzelContextHolder.currentAuthorities();
    }
}
