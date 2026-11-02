package com.thundax.pretzel.common.security.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

public class PretzelContextHolderTest {

    @AfterEach
    public void tearDown() {
        PretzelContextHolder.clear();
    }

    @Test
    public void shouldKeepRequestContextSeparateFromSubject() {
        PretzelContextHolder.setRequestId("request-1");
        PretzelContextHolder.setSubject(new PretzelSubject(
                "user-1", PretzelSubjectType.ADMIN_USER, "admin", "token-1", Collections.singleton("sys:user:list")));

        PretzelContextHolder.clearRequestContext();

        assertNull(PretzelContextHolder.requestId());
        assertEquals("user-1", PretzelContextHolder.currentSubjectId());
        assertEquals("token-1", PretzelContextHolder.currentToken());
        assertTrue(PretzelContextHolder.currentAuthorities().contains("sys:user:list"));
    }

    @Test
    public void shouldClearRequestContextAndSubjectTogether() {
        PretzelContextHolder.setRequestId("request-1");
        PretzelContextHolder.setSubject(new PretzelSubject(
                "user-1", PretzelSubjectType.ADMIN_USER, "admin", "token-1", Collections.emptySet()));

        PretzelContextHolder.clear();

        assertNull(PretzelContextHolder.requestId());
        assertNull(PretzelContextHolder.currentSubjectId());
    }

    @Test
    public void shouldReturnAuthoritySnapshot() {
        PretzelSubject subject = new PretzelSubject(
                "user-1", PretzelSubjectType.ADMIN_USER, "admin", "token-1", Arrays.asList("sys:user:list"));

        Set<String> authorities = subject.getAuthorities();
        subject.setAuthorities(Collections.singleton("sys:role:list"));

        assertTrue(authorities.contains("sys:user:list"));
        assertFalse(authorities.contains("sys:role:list"));
    }
}
