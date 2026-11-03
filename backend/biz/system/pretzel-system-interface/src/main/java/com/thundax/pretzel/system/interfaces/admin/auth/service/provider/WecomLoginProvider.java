package com.thundax.pretzel.system.interfaces.admin.auth.service.provider;

public interface WecomLoginProvider {

    String resolveIdentity(String code);
}
