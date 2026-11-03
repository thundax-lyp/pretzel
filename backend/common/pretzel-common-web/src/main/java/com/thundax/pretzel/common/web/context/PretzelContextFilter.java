package com.thundax.pretzel.common.web.context;

import com.thundax.pretzel.common.security.context.PretzelContextHolder;
import com.thundax.pretzel.common.security.context.PretzelSubject;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

public class PretzelContextFilter extends OncePerRequestFilter {

    public static final String MDC_REQUEST_ID = "requestId";

    private static final Logger ACCESS_LOGGER = LoggerFactory.getLogger("com.thundax.pretzel.access");
    private static final long DEFAULT_SLOW_REQUEST_MILLIS = 1000L;

    private final PretzelContextResolver resolver;
    private final long slowRequestMillis;

    public PretzelContextFilter(PretzelContextResolver resolver) {
        this(resolver, DEFAULT_SLOW_REQUEST_MILLIS);
    }

    public PretzelContextFilter(PretzelContextResolver resolver, long slowRequestMillis) {
        this.resolver = resolver;
        this.slowRequestMillis = slowRequestMillis;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long startNanos = System.nanoTime();
        String requestId = resolver.resolveRequestId(request);
        PretzelContextHolder.setRequestId(requestId);
        if (requestId != null) {
            MDC.put(MDC_REQUEST_ID, requestId);
            response.setHeader(DefaultPretzelContextResolver.HEADER_REQUEST_ID, requestId);
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            logAccess(request, response, requestId, elapsedMillis(startNanos));
            MDC.remove(MDC_REQUEST_ID);
            PretzelContextHolder.clearRequestContext();
        }
    }

    private void logAccess(
            HttpServletRequest request, HttpServletResponse response, String requestId, long elapsedMillis) {
        PretzelSubject subject = PretzelContextHolder.currentSubject();
        String subjectId = subject != null ? subject.getSubjectId() : null;
        String subjectType = subject != null && subject.getSubjectType() != null
                ? subject.getSubjectType().name()
                : null;
        if (elapsedMillis >= slowRequestMillis) {
            ACCESS_LOGGER.warn(
                    "slow request method={} uri={} status={} elapsedMs={} requestId={} subjectType={} subjectId={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    elapsedMillis,
                    requestId,
                    subjectType,
                    subjectId);
            return;
        }
        ACCESS_LOGGER.info(
                "request method={} uri={} status={} elapsedMs={} requestId={} subjectType={} subjectId={}",
                request.getMethod(),
                request.getRequestURI(),
                response.getStatus(),
                elapsedMillis,
                requestId,
                subjectType,
                subjectId);
    }

    private long elapsedMillis(long startNanos) {
        return (System.nanoTime() - startNanos) / 1000000L;
    }
}
