package com.thundax.pretzel.system.application.audit.runtime;

import com.thundax.pretzel.common.security.context.PretzelContextHolder;
import com.thundax.pretzel.common.security.context.PretzelSubject;
import com.thundax.pretzel.common.security.context.PretzelSubjectType;
import com.thundax.pretzel.system.domain.audit.model.enums.AuditOperatorType;

public final class AuditOperatorResolver {

    private AuditOperatorResolver() {}

    public static AuditOperatorType operatorType() {
        PretzelSubjectType subjectType = PretzelContextHolder.currentSubjectType();
        if (subjectType == null) {
            return AuditOperatorType.UNKNOWN;
        }
        switch (subjectType) {
            case ADMIN_USER:
                return AuditOperatorType.USER;
            case FRONT_MEMBER:
                return AuditOperatorType.MEMBER;
            case OPEN_CLIENT:
                return AuditOperatorType.OPEN_CLIENT;
            case SYSTEM:
                return AuditOperatorType.SYSTEM;
            case UNKNOWN:
            case ANONYMOUS:
            default:
                return AuditOperatorType.UNKNOWN;
        }
    }

    public static String operatorId() {
        return PretzelContextHolder.currentSubjectId();
    }

    public static String operatorName() {
        PretzelSubject subject = PretzelContextHolder.currentSubject();
        return subject == null ? null : subject.getDisplayName();
    }
}
