package com.thundax.pretzel.system.interfaces.admin.core.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thundax.pretzel.system.application.core.service.SystemLogApplicationService;
import com.thundax.pretzel.system.domain.core.codec.LogIdCodec;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import com.thundax.pretzel.system.domain.core.model.entity.Log;
import com.thundax.pretzel.system.domain.core.model.enums.LogType;
import com.thundax.pretzel.system.interfaces.admin.config.PretzelProperties;
import com.thundax.pretzel.system.interfaces.admin.core.assembler.LogInterfaceAssembler;
import com.thundax.pretzel.system.interfaces.admin.core.service.SysLogMessageService;
import java.io.File;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.springframework.context.annotation.Lazy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Lazy(false)
@Slf4j
@RequiredArgsConstructor
public class SysLogMessageServiceImpl implements SysLogMessageService {

    private static final DateTimeFormatter LOG_FILENAME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final ZoneOffset LOG_FILE_ZONE_OFFSET = ZoneOffset.ofHours(8);
    private static final String LOG_EXTEND_NAME = ".log";

    private final PretzelProperties pretzelProperties;
    private final SystemLogApplicationService logService;
    private final ObjectMapper objectMapper;

    @Override
    public void saveLog(Log sysLog) {
        try {
            String payload = objectMapper.writeValueAsString(SysLogDTO.from(sysLog));
            consumeLog(payload);
        } catch (Exception e) {
            log.warn("can not serialize sys-log message", e);
        }
    }

    @Override
    public void consumeLog(String payload) {
        try {
            SysLogDTO sysLog = objectMapper.readValue(payload, SysLogDTO.class);
            if (sysLog != null) {
                logService.create(LogInterfaceAssembler.toCreateCommand(sysLog.toLog()));

                try {
                    String filename =
                            LOG_FILENAME_FORMAT.format(sysLog.logDate().atZone(LOG_FILE_ZONE_OFFSET)) + LOG_EXTEND_NAME;
                    File logFile = new File(logProperties().getStoragePath(), filename);

                    FileUtils.writeLines(logFile, new ArrayList<>(Collections.singletonList(payload)), true);

                } catch (Exception e) {
                    log.warn("can not save sys-log to {}", logProperties().getStoragePath(), e);
                }
            }

        } catch (Exception e) {
            log.error("can not consume sys-log message", e);
        }
    }

    @Scheduled(cron = "0 0 0/4 * * ?")
    void doTask() {
        Instant now = Instant.now();
        logService.deleteByCondition(LogInterfaceAssembler.toDeleteCommand(
                now.minusSeconds(9999L * 24L * 60L * 60L),
                now.minusSeconds(logProperties().getAliveDays() * 24L * 60L * 60L)));
    }

    private PretzelProperties.LogProperties logProperties() {
        return pretzelProperties.getLog();
    }

    private record SysLogDTO(
            Long id,
            String userId,
            String type,
            Instant logDate,
            String title,
            String remoteAddr,
            String userAgent,
            String method,
            String requestUri,
            String requestParams,
            String remarks) {

        private static SysLogDTO from(Log log) {
            return log == null
                    ? null
                    : new SysLogDTO(
                            LogIdCodec.toValue(log.getId()),
                            UserIdCodec.toStringValue(log.getUserId()),
                            log.getType() == null ? null : log.getType().value(),
                            log.getLogDate(),
                            log.getTitle(),
                            log.getRemoteAddr(),
                            log.getUserAgent(),
                            log.getMethod(),
                            log.getRequestUri(),
                            log.getRequestParams(),
                            log.getRemarks());
        }

        private Log toLog() {
            Log log = new Log();
            log.setId(LogIdCodec.toDomain(id));
            log.setUserId(UserIdCodec.toDomain(userId));
            log.setType(type == null ? null : LogType.from(type));
            log.setLogDate(logDate);
            log.setTitle(title);
            log.setRemoteAddr(remoteAddr);
            log.setUserAgent(userAgent);
            log.setMethod(method);
            log.setRequestUri(requestUri);
            log.setRequestParams(requestParams);
            log.setRemarks(remarks);
            return log;
        }
    }
}
