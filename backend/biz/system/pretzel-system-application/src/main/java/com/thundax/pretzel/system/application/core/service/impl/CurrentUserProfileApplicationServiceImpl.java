package com.thundax.pretzel.system.application.core.service.impl;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.common.core.exception.BizExceptionBoundary;
import com.thundax.pretzel.storage.facade.StorageFacade;
import com.thundax.pretzel.storage.facade.dto.StorageObjectFacadeDto;
import com.thundax.pretzel.storage.facade.request.ListStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.OpenStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UnbindStorageOwnerFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UploadStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.response.ListStorageFacadeResponse;
import com.thundax.pretzel.storage.facade.response.OpenStorageFacadeResponse;
import com.thundax.pretzel.storage.facade.response.UploadStorageFacadeResponse;
import com.thundax.pretzel.system.application.auth.command.ChangePrincipalCredentialCommand;
import com.thundax.pretzel.system.application.auth.command.CreatePrincipalCredentialCommand;
import com.thundax.pretzel.system.application.auth.exception.InvalidPasswordException;
import com.thundax.pretzel.system.application.auth.query.PrincipalCredentialQuery;
import com.thundax.pretzel.system.application.auth.query.PrincipalIdentityQuery;
import com.thundax.pretzel.system.application.auth.service.PrincipalCredentialApplicationService;
import com.thundax.pretzel.system.application.auth.service.PrincipalIdentityApplicationService;
import com.thundax.pretzel.system.application.auth.util.PasswordHelper;
import com.thundax.pretzel.system.application.core.command.ChangeCurrentUserAvatarCommand;
import com.thundax.pretzel.system.application.core.command.ChangeCurrentUserInfoCommand;
import com.thundax.pretzel.system.application.core.command.ChangeCurrentUserPasswordCommand;
import com.thundax.pretzel.system.application.core.command.RemoveCurrentUserAvatarCommand;
import com.thundax.pretzel.system.application.core.query.CurrentUserAvatarQuery;
import com.thundax.pretzel.system.application.core.query.CurrentUserQuery;
import com.thundax.pretzel.system.application.core.query.MenuQuery;
import com.thundax.pretzel.system.application.core.query.RoleQuery;
import com.thundax.pretzel.system.application.core.query.UserQuery;
import com.thundax.pretzel.system.application.core.result.UserAvatarResult;
import com.thundax.pretzel.system.application.core.service.CurrentUserProfileApplicationService;
import com.thundax.pretzel.system.application.core.service.MenuManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.RoleManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.application.core.util.SysApiUtils;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalCredential;
import com.thundax.pretzel.system.domain.auth.model.entity.PrincipalIdentity;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialStatus;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalCredentialType;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalIdentityType;
import com.thundax.pretzel.system.domain.auth.model.enums.PrincipalType;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalIdentityId;
import com.thundax.pretzel.system.domain.auth.model.valueobject.PrincipalKey;
import com.thundax.pretzel.system.domain.core.model.entity.Menu;
import com.thundax.pretzel.system.domain.core.model.entity.Role;
import com.thundax.pretzel.system.domain.core.model.entity.User;
import com.thundax.pretzel.system.domain.core.model.enums.UserPrivilege;
import com.thundax.pretzel.system.domain.core.model.valueobject.MenuId;
import com.thundax.pretzel.system.domain.core.model.valueobject.UserId;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import net.coobird.thumbnailator.Thumbnails;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@BizExceptionBoundary
public class CurrentUserProfileApplicationServiceImpl implements CurrentUserProfileApplicationService {

    private static final int DEFAULT_PASSWORD_FAILED_LIMIT = 0;
    private static final String AVATAR_REMARKS = "avatar";
    private static final String AVATAR_FILENAME = "avatar.jpg";
    private static final String STORAGE_OWNER_TYPE_USER = "USER";
    private static final String STORAGE_OBJECT_STATUS_ACTIVE = "ACTIVE";
    private static final String STORAGE_REFERENCE_STATUS_UNREFERENCED = "UNREFERENCED";
    private static final String JPG = "jpg";
    private static final String IMAGE_JPEG = "image/jpeg";
    private static final int MAX_AVATAR_WIDTH = 400;
    private static final int MAX_AVATAR_HEIGHT = 400;
    private static final int MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
    private static final long MAX_AVATAR_PIXELS = 4096L * 4096L;
    private static final float IMAGE_QUALITY = 0.8f;

    private final UserManagementApplicationService userService;
    private final RoleManagementApplicationService roleService;
    private final MenuManagementApplicationService menuService;
    private final PrincipalIdentityApplicationService principalIdentityService;
    private final PrincipalCredentialApplicationService principalCredentialService;
    private final StorageFacade storageFacade;

    public CurrentUserProfileApplicationServiceImpl(
            UserManagementApplicationService userService,
            RoleManagementApplicationService roleService,
            MenuManagementApplicationService menuService,
            PrincipalIdentityApplicationService principalIdentityService,
            PrincipalCredentialApplicationService principalCredentialService,
            StorageFacade storageFacade) {
        this.userService = userService;
        this.roleService = roleService;
        this.menuService = menuService;
        this.principalIdentityService = principalIdentityService;
        this.principalCredentialService = principalCredentialService;
        this.storageFacade = storageFacade;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public User changeInfo(ChangeCurrentUserInfoCommand command) {
        return userService.changeProfile(command);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void changePassword(ChangeCurrentUserPasswordCommand command) {
        String oldPassword = command.oldPassword();
        String password = command.password();
        if (StringUtils.isBlank(password)) {
            throw new BizException("SYS-00001", "sys.exception.invalid-parameter", "password");
        } else if (!password.matches(SysApiUtils.PASSWORD_VALIDATE_PATTERN)) {
            throw new BizException(SysApiUtils.PASSWORD_VALIDATE_MESSAGE);
        }

        PrincipalIdentity accountIdentity = getAccountIdentity(command.userId());
        PrincipalCredential credential = accountIdentity == null
                ? null
                : principalCredentialService.get(
                        credentialQuery(accountIdentity.getId(), PrincipalCredentialType.USER_PASSWORD));
        if (credential == null || !PasswordHelper.validate(oldPassword, credential.getCredentialValue())) {
            throw new InvalidPasswordException();
        }

        upsertPassword(command.userId(), accountIdentity, PasswordHelper.encrypt(password));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserAvatarResult changeAvatar(ChangeCurrentUserAvatarCommand command) {
        if (command == null || command.userId() == null || command.inputStream() == null) {
            throw invalidParameter("avatar");
        }

        removeAvatar(command.userId());

        byte[] avatarBytes = readAvatarBytes(command.inputStream());
        UploadStorageFacadeResponse uploaded = storageFacade.upload(UploadStorageFacadeRequest.builder()
                .inputStream(new ByteArrayInputStream(avatarBytes))
                .originalFilename(originalFilename(command.originalFilename()))
                .contentType(IMAGE_JPEG)
                .sizeBytes((long) avatarBytes.length)
                .ownerType(STORAGE_OWNER_TYPE_USER)
                .ownerId(String.valueOf(command.userId().value()))
                .objectStatus(STORAGE_OBJECT_STATUS_ACTIVE)
                .referenceStatus(STORAGE_REFERENCE_STATUS_UNREFERENCED)
                .remarks(AVATAR_REMARKS)
                .build());
        return toAvatarResult(uploaded);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void removeAvatar(RemoveCurrentUserAvatarCommand command) {
        if (command == null || command.userId() == null) {
            throw invalidParameter("userId");
        }
        removeAvatar(command.userId());
    }

    @Override
    public UserAvatarResult getAvatar(CurrentUserAvatarQuery query) {
        UserId userId = query == null ? null : query.userId();
        List<StorageObjectFacadeDto> avatars = listAvatarDtos(userId);
        if (avatars.isEmpty()) {
            return null;
        }
        return toAvatarResult(avatars.get(avatars.size() - 1), userId);
    }

    @Override
    public InputStream getAvatarInputStream(CurrentUserAvatarQuery query) {
        UserId userId = query == null ? null : query.userId();
        UserAvatarResult avatar = latestAvatar(userId);
        if (avatar == null || storageFacade == null) {
            return null;
        }
        OpenStorageFacadeRequest request = toReadableContentRequest(avatar);
        if (!storageFacade.exists(request)) {
            return null;
        }
        OpenStorageFacadeResponse content = storageFacade.open(request);
        return content == null ? null : content.getInputStream();
    }

    @Override
    public boolean existsAvatar(CurrentUserAvatarQuery query) {
        UserId userId = query == null ? null : query.userId();
        UserAvatarResult avatar = latestAvatar(userId);
        return avatar != null && storageFacade.exists(toReadableContentRequest(avatar));
    }

    @Override
    public List<Menu> listAccessibleMenus(CurrentUserQuery query) {
        if (query != null && UserPrivilege.SUPER == query.privilege()) {
            return sortedMenus(menuService.list(new MenuQuery(null, null, null, null, null, null)));
        }

        List<Role> roleList = userService.listUserRoles(userQuery(query.userId())).stream()
                .map(role -> roleService.get(role.getId()))
                .filter(Objects::nonNull)
                .filter(Role::isEnable)
                .toList();
        boolean isAdmin = query != null && UserPrivilege.ADMIN == query.privilege()
                || roleList.stream().anyMatch(Role::isAdmin);
        if (isAdmin) {
            MenuQuery menuQuery = new MenuQuery(null, null, null, null, null, query.rank());
            return sortedMenus(menuService.list(menuQuery));
        }

        List<MenuId> menuIds = roleList.stream()
                .flatMap(role -> roleService.listRoleMenus(roleQuery(role)).stream())
                .map(Menu::getId)
                .distinct()
                .collect(Collectors.toList());
        MenuQuery menuQuery = new MenuQuery(menuIds, null, null, null, null, null);
        List<Menu> menus = sortedMenus(menuService.list(menuQuery)).stream()
                .filter(menu -> menu != null && query.rank().canAccess(menu.getRank()))
                .collect(Collectors.toList());
        return sortedMenus(menus);
    }

    private RoleQuery roleQuery(Role role) {
        return new RoleQuery(role.getId(), null);
    }

    private List<Menu> sortedMenus(List<Menu> menus) {
        return menus == null ? new ArrayList<>() : new ArrayList<>(menus);
    }

    private UserQuery userQuery(UserId userId) {
        return new UserQuery(userId, null, null, null, null, null, null, null, null, null);
    }

    private List<StorageObjectFacadeDto> listAvatarDtos(UserId userId) {
        if (userId == null) {
            return Collections.emptyList();
        }
        ListStorageFacadeResponse response = storageFacade.list(ListStorageFacadeRequest.builder()
                .ownerType(STORAGE_OWNER_TYPE_USER)
                .ownerId(String.valueOf(userId.value()))
                .objectStatus(STORAGE_OBJECT_STATUS_ACTIVE)
                .remarks(AVATAR_REMARKS)
                .build());
        if (response == null || response.getStoredObjects() == null) {
            return Collections.emptyList();
        }
        return response.getStoredObjects();
    }

    private void removeAvatar(UserId userId) {
        for (StorageObjectFacadeDto storage : listAvatarDtos(userId)) {
            storageFacade.unbindOwner(UnbindStorageOwnerFacadeRequest.builder()
                    .ownerType(STORAGE_OWNER_TYPE_USER)
                    .ownerId(String.valueOf(userId.value()))
                    .storageObjectId(storage.getId())
                    .build());
        }
    }

    @Override
    public List<Menu> listVisibleMenus(CurrentUserQuery query) {
        List<Menu> visibleMenus =
                listAccessibleMenus(query).stream().filter(Menu::isDisplay).collect(Collectors.toList());
        List<Menu> menuList =
                visibleMenus.stream().filter(menu -> menu.getParentId() == null).collect(Collectors.toList());

        for (int idx = 0; idx < menuList.size(); idx++) {
            Menu parent = menuList.get(idx);
            List<Menu> childList = visibleMenus.stream()
                    .filter(menu -> Objects.equals(menu.getParentId(), parent.getId()))
                    .collect(Collectors.toList());
            menuList.addAll(childList);
        }
        return menuList;
    }

    private PrincipalIdentity getAccountIdentity(UserId userId) {
        if (userId == null) {
            return null;
        }
        return principalIdentityService.get(
                identityQuery(PrincipalKey.of(PrincipalType.USER, userId.value()), PrincipalIdentityType.USER_ACCOUNT));
    }

    private String getAccountLoginName(UserId userId) {
        PrincipalIdentity identity = getAccountIdentity(userId);
        return identity == null ? null : identity.getIdentityValue();
    }

    private void upsertPassword(UserId userId, PrincipalIdentity accountIdentity, String encryptedPassword) {
        if (userId == null || accountIdentity == null || StringUtils.isBlank(encryptedPassword)) {
            return;
        }
        PrincipalCredential credential = principalCredentialService.get(
                credentialQuery(accountIdentity.getId(), PrincipalCredentialType.USER_PASSWORD));
        if (credential == null) {
            credential = new PrincipalCredential();
            credential.setPrincipalKey(PrincipalKey.of(PrincipalType.USER, userId.value()));
            credential.setIdentityId(accountIdentity.getId());
            credential.setCredentialType(PrincipalCredentialType.USER_PASSWORD);
            credential.setCredentialValue(encryptedPassword);
            credential.setStatus(PrincipalCredentialStatus.ACTIVE);
            credential.setNeedChangePassword(false);
            credential.setFailedCount(0);
            credential.setFailedLimit(DEFAULT_PASSWORD_FAILED_LIMIT);
            principalCredentialService.create(createCredentialCommand(credential));
            return;
        }

        credential.setCredentialValue(encryptedPassword);
        credential.setStatus(PrincipalCredentialStatus.ACTIVE);
        credential.setNeedChangePassword(false);
        credential.setFailedCount(0);
        credential.setLockedUntil(null);
        credential.setLastVerifiedAt(null);
        principalCredentialService.change(changeCredentialCommand(credential));
    }

    private CreatePrincipalCredentialCommand createCredentialCommand(PrincipalCredential credential) {
        return new CreatePrincipalCredentialCommand(
                credential.getPrincipalKey(),
                credential.getIdentityId(),
                credential.getCredentialType(),
                credential.getCredentialValue(),
                credential.getStatus(),
                credential.isNeedChangePassword(),
                credential.getFailedCount(),
                credential.getFailedLimit(),
                credential.getLockedUntil(),
                credential.getExpiresAt(),
                credential.getLastVerifiedAt());
    }

    private ChangePrincipalCredentialCommand changeCredentialCommand(PrincipalCredential credential) {
        return new ChangePrincipalCredentialCommand(
                credential.getId(),
                credential.getPrincipalKey(),
                credential.getIdentityId(),
                credential.getCredentialType(),
                credential.getCredentialValue(),
                credential.getStatus(),
                credential.isNeedChangePassword(),
                credential.getFailedCount(),
                credential.getFailedLimit(),
                credential.getLockedUntil(),
                credential.getExpiresAt(),
                credential.getLastVerifiedAt());
    }

    private byte[] readAvatarBytes(InputStream inputStream) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            byte[] sourceBytes = readBoundedBytes(inputStream);
            validateAvatarDimensions(sourceBytes);
            Thumbnails.Builder<?> builder = Thumbnails.of(new ByteArrayInputStream(sourceBytes));
            BufferedImage image = builder.scale(1.0f).asBufferedImage();

            int originWidth = image.getWidth();
            int originHeight = image.getHeight();
            if (originWidth <= 0 || originHeight <= 0) {
                throw invalidParameter("avatar");
            }
            if ((long) originWidth * (long) originHeight > MAX_AVATAR_PIXELS) {
                throw invalidParameter("avatar");
            }

            if (originWidth > MAX_AVATAR_WIDTH || originHeight > MAX_AVATAR_HEIGHT) {
                double scale = Math.min(
                        (double) MAX_AVATAR_WIDTH / (double) originWidth,
                        (double) MAX_AVATAR_HEIGHT / (double) originHeight);
                builder = Thumbnails.of(image).scale(scale);
            } else {
                builder = Thumbnails.of(image).size(originWidth, originHeight);
            }

            builder.outputFormat(JPG);
            builder.outputQuality(IMAGE_QUALITY);
            builder.toOutputStream(outputStream);
            return outputStream.toByteArray();
        } catch (BizException e) {
            throw e;
        } catch (IOException e) {
            throw storageFailure(e.getMessage());
        } catch (RuntimeException e) {
            throw invalidParameter("avatar");
        }
    }

    private void validateAvatarDimensions(byte[] sourceBytes) throws IOException {
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(sourceBytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                throw invalidParameter("avatar");
            }
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || (long) width * height > MAX_AVATAR_PIXELS) {
                    throw invalidParameter("avatar");
                }
            } finally {
                reader.dispose();
            }
        }
    }

    private byte[] readBoundedBytes(InputStream inputStream) throws IOException {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            int total = 0;
            while ((read = inputStream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_AVATAR_UPLOAD_BYTES) {
                    throw invalidParameter("avatar");
                }
                outputStream.write(buffer, 0, read);
            }
            return outputStream.toByteArray();
        }
    }

    private String originalFilename(String originalFilename) {
        if (StringUtils.isBlank(FilenameUtils.getExtension(originalFilename))) {
            return AVATAR_FILENAME;
        }
        return originalFilename;
    }

    private UserAvatarResult latestAvatar(UserId userId) {
        List<StorageObjectFacadeDto> avatars = listAvatarDtos(userId);
        return avatars.isEmpty() ? null : toAvatarResult(avatars.get(avatars.size() - 1), userId);
    }

    private OpenStorageFacadeRequest toReadableContentRequest(UserAvatarResult avatar) {
        if (avatar == null) {
            return null;
        }
        return OpenStorageFacadeRequest.builder()
                .storageObjectId(avatar.getStorageObjectId())
                .ownerId(avatar.getOwnerId())
                .ownerType(avatar.getOwnerType())
                .build();
    }

    private UserAvatarResult toAvatarResult(UploadStorageFacadeResponse response) {
        if (response == null) {
            return null;
        }
        return UserAvatarResult.builder()
                .storageObjectId(response.getStorageObjectId())
                .originalFilename(response.getOriginalFilename())
                .contentType(response.getContentType())
                .mimeType(response.getMimeType())
                .sizeBytes(response.getSizeBytes())
                .objectStatus(response.getObjectStatus())
                .referenceStatus(response.getReferenceStatus())
                .remarks(response.getRemarks())
                .build();
    }

    private UserAvatarResult toAvatarResult(StorageObjectFacadeDto dto, UserId userId) {
        if (dto == null) {
            return null;
        }
        return UserAvatarResult.builder()
                .storageObjectId(dto.getId())
                .originalFilename(dto.getOriginalFilename())
                .contentType(dto.getContentType())
                .sizeBytes(dto.getSize())
                .ownerId(String.valueOf(userId.value()))
                .ownerType(STORAGE_OWNER_TYPE_USER)
                .objectStatus(dto.getObjectStatus())
                .referenceStatus(dto.getReferenceStatus())
                .remarks(dto.getRemarks())
                .build();
    }

    private BizException invalidParameter(String name) {
        return new BizException("SYS-00001", "sys.exception.invalid-parameter", "无效的参数: " + name);
    }

    private BizException storageFailure(String message) {
        return new BizException(
                "SYS-00005", "sys.exception.storage-failure", StringUtils.defaultIfBlank(message, "存储处理失败"));
    }

    private PrincipalIdentityQuery identityQuery(PrincipalKey principalKey, PrincipalIdentityType identityType) {
        return new PrincipalIdentityQuery(null, identityType, null, principalKey, null);
    }

    private PrincipalCredentialQuery credentialQuery(
            PrincipalIdentityId identityId, PrincipalCredentialType credentialType) {
        return new PrincipalCredentialQuery(null, identityId, credentialType, null, null);
    }
}
