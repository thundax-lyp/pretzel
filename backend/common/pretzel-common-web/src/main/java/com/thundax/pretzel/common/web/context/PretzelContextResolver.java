package com.thundax.pretzel.common.web.context;

import jakarta.servlet.http.HttpServletRequest;

public interface PretzelContextResolver {

    String resolveRequestId(HttpServletRequest request);
}
