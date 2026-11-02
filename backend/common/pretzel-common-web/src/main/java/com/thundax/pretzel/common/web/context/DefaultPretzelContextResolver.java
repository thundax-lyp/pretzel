package com.thundax.pretzel.common.web.context;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.apache.commons.lang3.StringUtils;

public class DefaultPretzelContextResolver implements PretzelContextResolver {

    public static final String HEADER_REQUEST_ID = "X-Request-Id";

    @Override
    public String resolveRequestId(HttpServletRequest request) {
        String requestId = StringUtils.trimToNull(request.getHeader(HEADER_REQUEST_ID));
        return requestId != null ? requestId : UUID.randomUUID().toString();
    }
}
