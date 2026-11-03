package com.thundax.pretzel.system.application.core.command;

import com.thundax.pretzel.system.domain.core.model.enums.LogType;
import com.thundax.pretzel.system.domain.core.model.valueobject.LogId;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import java.time.Instant;

public record CreateLogCommand(
        LogId id,
        UserId userId,
        LogType type,
        Instant logDate,
        String title,
        String remoteAddr,
        String userAgent,
        String method,
        String requestUri,
        String requestParams,
        String remarks) {}
