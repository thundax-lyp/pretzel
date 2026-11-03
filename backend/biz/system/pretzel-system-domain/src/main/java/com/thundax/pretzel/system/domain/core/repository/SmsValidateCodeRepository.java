package com.thundax.pretzel.system.domain.core.repository;

public interface SmsValidateCodeRepository {

    boolean canSend(String mobile);

    void markSent(String mobile, int expiredSeconds);
}
