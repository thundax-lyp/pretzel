package com.thundax.pretzel.common.security.context;

import java.io.Serializable;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;

@Getter
public class PretzelSubject implements Serializable {

    @Setter
    private String subjectId;

    private PretzelSubjectType subjectType = PretzelSubjectType.ANONYMOUS;

    @Setter
    private String displayName;

    @Setter
    private String token;

    private final Set<String> authorities = new LinkedHashSet<>();

    public PretzelSubject() {}

    public PretzelSubject(
            String subjectId,
            PretzelSubjectType subjectType,
            String displayName,
            String token,
            Collection<String> authorities) {
        this.subjectId = subjectId;
        this.subjectType = subjectType == null ? PretzelSubjectType.UNKNOWN : subjectType;
        this.displayName = displayName;
        this.token = token;
        setAuthorities(authorities);
    }

    public static PretzelSubject anonymous() {
        return new PretzelSubject();
    }

    public boolean isAuthenticated() {
        return subjectId != null && !subjectId.trim().isEmpty() && subjectType != PretzelSubjectType.ANONYMOUS;
    }

    public synchronized boolean hasAuthority(String authority) {
        return authorities.contains(authority);
    }

    public void setSubjectType(PretzelSubjectType subjectType) {
        this.subjectType = subjectType == null ? PretzelSubjectType.UNKNOWN : subjectType;
    }

    public synchronized Set<String> getAuthorities() {
        return Collections.unmodifiableSet(new LinkedHashSet<>(authorities));
    }

    public synchronized void setAuthorities(Collection<String> authorities) {
        this.authorities.clear();
        if (authorities == null) {
            return;
        }
        for (String authority : authorities) {
            if (authority != null && !authority.trim().isEmpty()) {
                this.authorities.add(authority);
            }
        }
    }
}
