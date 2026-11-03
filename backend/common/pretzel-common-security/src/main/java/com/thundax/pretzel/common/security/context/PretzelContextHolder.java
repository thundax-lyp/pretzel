package com.thundax.pretzel.common.security.context;

import com.thundax.pretzel.common.security.permission.PermissionAuthorities;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

public final class PretzelContextHolder {

    private static final ThreadLocal<String> REQUEST_ID_HOLDER = new ThreadLocal<>();

    private PretzelContextHolder() {}

    public static String requestId() {
        return REQUEST_ID_HOLDER.get();
    }

    public static void setRequestId(String requestId) {
        REQUEST_ID_HOLDER.set(requestId);
    }

    public static PretzelSubject currentSubject() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken) {
            return PretzelSubject.anonymous();
        }

        PretzelSubject subject = resolvePrincipal(authentication);
        subject.setAuthorities(PermissionAuthorities.toPermissions(authentication.getAuthorities()));
        if (subject.getToken() == null && authentication.getCredentials() instanceof String) {
            subject.setToken((String) authentication.getCredentials());
        }
        return subject;
    }

    public static String currentSubjectId() {
        return currentSubject().getSubjectId();
    }

    public static PretzelSubjectType currentSubjectType() {
        return currentSubject().getSubjectType();
    }

    public static String currentToken() {
        return currentSubject().getToken();
    }

    public static Set<String> currentAuthorities() {
        return currentSubject().getAuthorities();
    }

    public static boolean isAuthenticated() {
        return currentSubject().isAuthenticated();
    }

    public static void setSubject(PretzelSubject subject) {
        if (subject == null || !subject.isAuthenticated()) {
            clearSubject();
            return;
        }
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(
                        subject, subject.getToken(), toAuthorities(subject.getAuthorities())));
    }

    public static void clearSubject() {
        SecurityContextHolder.clearContext();
    }

    public static void clearRequestContext() {
        REQUEST_ID_HOLDER.remove();
    }

    public static void clear() {
        clearSubject();
        clearRequestContext();
    }

    private static PretzelSubject resolvePrincipal(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof PretzelSubject) {
            return (PretzelSubject) principal;
        }
        if (principal instanceof UserDetails) {
            UserDetails userDetails = (UserDetails) principal;
            return new PretzelSubject(
                    userDetails.getUsername(), PretzelSubjectType.UNKNOWN, userDetails.getUsername(), null, null);
        }
        if (principal instanceof String) {
            return new PretzelSubject((String) principal, PretzelSubjectType.UNKNOWN, (String) principal, null, null);
        }
        return new PretzelSubject(
                authentication.getName(), PretzelSubjectType.UNKNOWN, authentication.getName(), null, null);
    }

    private static Collection<SimpleGrantedAuthority> toAuthorities(Collection<String> authorities) {
        if (authorities == null || authorities.isEmpty()) {
            return Collections.emptyList();
        }
        Collection<SimpleGrantedAuthority> grantedAuthorities = new ArrayList<>();
        for (String authority : authorities) {
            grantedAuthorities.add(new SimpleGrantedAuthority(authority));
        }
        return grantedAuthorities;
    }
}
