package com.thundax.pretzel.common.web.health;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class PretzelHealthProbeControllerTest {

    @Test
    public void shouldReturnUpForLivenessAndReadiness() {
        PretzelHealthProbeController controller = new PretzelHealthProbeController();

        assertEquals("UP", controller.liveness().get("status"));
        assertEquals("UP", controller.readiness().get("status"));
    }
}
