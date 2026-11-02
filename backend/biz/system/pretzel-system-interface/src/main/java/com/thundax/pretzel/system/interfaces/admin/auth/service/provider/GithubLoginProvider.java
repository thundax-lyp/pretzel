package com.thundax.pretzel.system.interfaces.admin.auth.service.provider;

public interface GithubLoginProvider {

    String resolveIdentity(String code);
}
