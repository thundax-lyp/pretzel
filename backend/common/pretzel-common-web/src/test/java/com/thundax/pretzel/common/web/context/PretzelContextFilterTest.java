package com.thundax.pretzel.common.web.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.thundax.pretzel.common.security.context.PretzelContextHolder;
import jakarta.servlet.ServletException;
import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

public class PretzelContextFilterTest {

    @AfterEach
    public void tearDown() {
        PretzelContextHolder.clear();
    }

    @Test
    public void shouldBindAndClearContextForRequest() throws ServletException, IOException {
        PretzelContextFilter filter = new PretzelContextFilter(new DefaultPretzelContextResolver());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(DefaultPretzelContextResolver.HEADER_REQUEST_ID, "request-1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            assertEquals("request-1", PretzelContextHolder.requestId());
            assertNull(PretzelContextHolder.currentToken());
        });

        assertEquals("request-1", response.getHeader(DefaultPretzelContextResolver.HEADER_REQUEST_ID));
        assertNull(PretzelContextHolder.requestId());
    }

    @Test
    public void shouldTolerateNullResolvedContext() throws ServletException, IOException {
        PretzelContextFilter filter = new PretzelContextFilter(request -> null);

        filter.doFilter(
                new MockHttpServletRequest(),
                new MockHttpServletResponse(),
                (servletRequest, servletResponse) -> assertNull(PretzelContextHolder.requestId()));

        assertNull(PretzelContextHolder.requestId());
    }

    @Test
    public void shouldLogAndKeepResponseStatus() throws ServletException, IOException {
        PretzelContextFilter filter = new PretzelContextFilter(new DefaultPretzelContextResolver(), 1L);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/test");
        request.addHeader(DefaultPretzelContextResolver.HEADER_REQUEST_ID, "request-2");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (servletRequest, servletResponse) -> {
            ((MockHttpServletResponse) servletResponse).setStatus(202);
            assertEquals("request-2", PretzelContextHolder.requestId());
        });

        assertEquals(202, response.getStatus());
    }
}
