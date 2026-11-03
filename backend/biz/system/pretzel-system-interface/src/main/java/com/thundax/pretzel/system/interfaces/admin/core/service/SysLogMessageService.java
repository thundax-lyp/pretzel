package com.thundax.pretzel.system.interfaces.admin.core.service;

import com.thundax.pretzel.system.domain.core.model.entity.Log;

public interface SysLogMessageService {

    String TOPIC_SAVE_LOG = "pretzel_save_log";

    void saveLog(Log sysLog);

    void consumeLog(String payload);
}
