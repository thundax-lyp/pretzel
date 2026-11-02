package com.thundax.pretzel.system.interfaces.admin.auth.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class SpringSecurityConfigurationTest {

    @Test
    void publicApiPathTemplateShouldBeAntMatcherCompatible() {
        assertEquals(
                "/api/portal/classics/sancai/*",
                SpringSecurityConfiguration.normalizePublicApiPath("/api/portal/classics/sancai/{entryId}"));
    }
}
