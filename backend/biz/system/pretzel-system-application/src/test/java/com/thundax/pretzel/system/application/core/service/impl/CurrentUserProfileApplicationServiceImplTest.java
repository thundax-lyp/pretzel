package com.thundax.pretzel.system.application.core.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.thundax.pretzel.common.core.exception.BizException;
import com.thundax.pretzel.storage.facade.StorageFacade;
import com.thundax.pretzel.storage.facade.dto.StorageObjectFacadeDto;
import com.thundax.pretzel.storage.facade.request.ListStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.OpenStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UnbindStorageOwnerFacadeRequest;
import com.thundax.pretzel.storage.facade.request.UploadStorageFacadeRequest;
import com.thundax.pretzel.storage.facade.response.ListStorageFacadeResponse;
import com.thundax.pretzel.storage.facade.response.OpenStorageFacadeResponse;
import com.thundax.pretzel.storage.facade.response.UploadStorageFacadeResponse;
import com.thundax.pretzel.system.application.auth.service.PrincipalCredentialApplicationService;
import com.thundax.pretzel.system.application.auth.service.PrincipalIdentityApplicationService;
import com.thundax.pretzel.system.application.core.command.ChangeCurrentUserAvatarCommand;
import com.thundax.pretzel.system.application.core.query.CurrentUserAvatarQuery;
import com.thundax.pretzel.system.application.core.query.CurrentUserQuery;
import com.thundax.pretzel.system.application.core.query.GetMenuQuery;
import com.thundax.pretzel.system.application.core.query.MenuQuery;
import com.thundax.pretzel.system.application.core.query.RoleQuery;
import com.thundax.pretzel.system.application.core.query.UserQuery;
import com.thundax.pretzel.system.application.core.result.UserAvatarResult;
import com.thundax.pretzel.system.application.core.service.MenuManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.RoleManagementApplicationService;
import com.thundax.pretzel.system.application.core.service.UserManagementApplicationService;
import com.thundax.pretzel.system.domain.core.codec.MenuIdCodec;
import com.thundax.pretzel.system.domain.core.codec.RoleIdCodec;
import com.thundax.pretzel.system.domain.core.codec.UserIdCodec;
import com.thundax.pretzel.system.domain.core.model.entity.Menu;
import com.thundax.pretzel.system.domain.core.model.entity.Role;
import com.thundax.pretzel.system.domain.core.model.enums.RolePrivilege;
import com.thundax.pretzel.system.domain.core.model.enums.RoleStatus;
import com.thundax.pretzel.system.domain.core.model.enums.UserPrivilege;
import com.thundax.pretzel.system.domain.core.model.valueobject.AccessRank;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.zip.CRC32;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CurrentUserProfileApplicationServiceImplTest {

    private static final int TOO_LARGE_AVATAR_BYTES = 5 * 1024 * 1024 + 1;

    @Test
    void getAvatarInputStreamShouldUseStorageFacade() throws Exception {
        StorageFacade storageFacade = mock(StorageFacade.class);
        CurrentUserProfileApplicationServiceImpl service = service(storageFacade);
        StorageObjectFacadeDto avatar = avatar(100L, 7001L);
        InputStream inputStream = new ByteArrayInputStream(new byte[] {1});

        when(storageFacade.list(any(ListStorageFacadeRequest.class)))
                .thenReturn(ListStorageFacadeResponse.builder()
                        .storedObjects(List.of(avatar))
                        .build());
        when(storageFacade.exists(any(OpenStorageFacadeRequest.class))).thenReturn(true);
        when(storageFacade.open(any(OpenStorageFacadeRequest.class)))
                .thenReturn(OpenStorageFacadeResponse.builder()
                        .inputStream(inputStream)
                        .build());

        InputStream result = service.getAvatarInputStream(new CurrentUserAvatarQuery(UserIdCodec.toDomain(100L)));

        assertSame(inputStream, result);
        ArgumentCaptor<OpenStorageFacadeRequest> requestCaptor =
                ArgumentCaptor.forClass(OpenStorageFacadeRequest.class);
        verify(storageFacade).exists(requestCaptor.capture());
        assertEquals(7001L, requestCaptor.getValue().getStorageObjectId());
        assertEquals("100", requestCaptor.getValue().getOwnerId());
        assertEquals("USER", requestCaptor.getValue().getOwnerType());
        verify(storageFacade).open(any(OpenStorageFacadeRequest.class));
    }

    @Test
    void getAvatarInputStreamShouldReturnNullWhenFacadeReportsUnreadable() {
        StorageFacade storageFacade = mock(StorageFacade.class);
        CurrentUserProfileApplicationServiceImpl service = service(storageFacade);

        when(storageFacade.list(any(ListStorageFacadeRequest.class)))
                .thenReturn(ListStorageFacadeResponse.builder()
                        .storedObjects(List.of(avatar(100L, 7001L)))
                        .build());
        when(storageFacade.exists(any(OpenStorageFacadeRequest.class))).thenReturn(false);

        assertNull(service.getAvatarInputStream(new CurrentUserAvatarQuery(UserIdCodec.toDomain(100L))));
        verify(storageFacade, never()).open(any(OpenStorageFacadeRequest.class));
    }

    @Test
    void changeAvatarShouldUseStorageFacade() {
        StorageFacade storageFacade = mock(StorageFacade.class);
        CurrentUserProfileApplicationServiceImpl service = service(storageFacade);

        when(storageFacade.list(any(ListStorageFacadeRequest.class)))
                .thenReturn(ListStorageFacadeResponse.builder()
                        .storedObjects(List.of())
                        .build());
        when(storageFacade.upload(any(UploadStorageFacadeRequest.class)))
                .thenReturn(UploadStorageFacadeResponse.builder()
                        .storageObjectId(9001L)
                        .originalFilename("avatar.jpg")
                        .contentType("image/jpeg")
                        .objectStatus("ACTIVE")
                        .remarks("avatar")
                        .build());

        UserAvatarResult avatar = service.changeAvatar(
                new ChangeCurrentUserAvatarCommand(UserIdCodec.toDomain(100L), validAvatarInputStream(), "avatar.png"));

        assertEquals(9001L, avatar.getStorageObjectId());
        ArgumentCaptor<UploadStorageFacadeRequest> uploadCaptor =
                ArgumentCaptor.forClass(UploadStorageFacadeRequest.class);
        verify(storageFacade).upload(uploadCaptor.capture());
        assertEquals("USER", uploadCaptor.getValue().getOwnerType());
        assertEquals("100", uploadCaptor.getValue().getOwnerId());
        assertEquals("ACTIVE", uploadCaptor.getValue().getObjectStatus());
        assertEquals("avatar", uploadCaptor.getValue().getRemarks());
    }

    @Test
    void changeAvatarShouldRejectOversizedUploadBeforeDecoding() {
        StorageFacade storageFacade = mock(StorageFacade.class);
        CurrentUserProfileApplicationServiceImpl service = service(storageFacade);

        when(storageFacade.list(any(ListStorageFacadeRequest.class)))
                .thenReturn(ListStorageFacadeResponse.builder()
                        .storedObjects(List.of())
                        .build());

        byte[] tooLargeBytes = new byte[TOO_LARGE_AVATAR_BYTES];
        assertThrows(
                BizException.class,
                () -> service.changeAvatar(new ChangeCurrentUserAvatarCommand(
                        UserIdCodec.toDomain(100L), new ByteArrayInputStream(tooLargeBytes), "avatar.png")));

        verify(storageFacade, never()).upload(any(UploadStorageFacadeRequest.class));
    }

    @Test
    void removeAvatarShouldUseStorageFacade() {
        StorageFacade storageFacade = mock(StorageFacade.class);
        CurrentUserProfileApplicationServiceImpl service = service(storageFacade);

        when(storageFacade.list(any(ListStorageFacadeRequest.class)))
                .thenReturn(ListStorageFacadeResponse.builder()
                        .storedObjects(List.of(avatar(100L, 7001L)))
                        .build());
        doNothing().when(storageFacade).unbindOwner(any(UnbindStorageOwnerFacadeRequest.class));

        service.removeAvatar(new com.thundax.pretzel.system.application.core.command.RemoveCurrentUserAvatarCommand(
                UserIdCodec.toDomain(100L)));

        ArgumentCaptor<UnbindStorageOwnerFacadeRequest> removeCaptor =
                ArgumentCaptor.forClass(UnbindStorageOwnerFacadeRequest.class);
        verify(storageFacade).unbindOwner(removeCaptor.capture());
        assertEquals(7001L, removeCaptor.getValue().getStorageObjectId());
        assertEquals("USER", removeCaptor.getValue().getOwnerType());
        assertEquals("100", removeCaptor.getValue().getOwnerId());
    }

    @Test
    void listAccessibleMenusShouldBatchLoadMenusForNormalUser() {
        UserManagementApplicationService userService = mock(UserManagementApplicationService.class);
        RoleManagementApplicationService roleService = mock(RoleManagementApplicationService.class);
        MenuManagementApplicationService menuService = mock(MenuManagementApplicationService.class);
        CurrentUserProfileApplicationServiceImpl service =
                service(userService, roleService, menuService, mock(StorageFacade.class));

        Role role = new Role();
        role.setId(RoleIdCodec.toDomain(1L));
        role.setStatus(RoleStatus.ENABLED);
        when(roleService.get(role.getId())).thenReturn(role);
        Menu grantedMenu = menu(10L, 3);
        Menu deniedMenu = menu(11L, 8);
        when(userService.listUserRoles(any(UserQuery.class))).thenReturn(List.of(role));
        when(roleService.listRoleMenus(any(RoleQuery.class))).thenReturn(List.of(grantedMenu, deniedMenu));
        when(menuService.list(any(MenuQuery.class))).thenReturn(List.of(grantedMenu, deniedMenu));

        CurrentUserQuery query =
                new CurrentUserQuery(UserIdCodec.toDomain(100L), UserPrivilege.NORMAL, null, AccessRank.of(5));

        List<Menu> menus = service.listAccessibleMenus(query);

        assertEquals(List.of(grantedMenu), menus);
        verify(menuService).list(any(MenuQuery.class));
        verify(menuService, never()).get(any(GetMenuQuery.class));
    }

    @Test
    void disabledRoleMustNotGrantMenusAndEnabledAdminRoleMustGrantRankedMenus() {
        UserManagementApplicationService users = mock(UserManagementApplicationService.class);
        RoleManagementApplicationService roles = mock(RoleManagementApplicationService.class);
        MenuManagementApplicationService menus = mock(MenuManagementApplicationService.class);
        CurrentUserProfileApplicationServiceImpl service = service(users, roles, menus, mock(StorageFacade.class));
        Role assigned = new Role();
        assigned.setId(RoleIdCodec.toDomain(1L));
        Role full = new Role();
        full.setId(assigned.getId());
        full.setPrivilege(RolePrivilege.ADMIN);
        full.setStatus(RoleStatus.DISABLED);
        when(users.listUserRoles(any(UserQuery.class))).thenReturn(List.of(assigned));
        when(roles.get(assigned.getId())).thenReturn(full);
        when(menus.list(any(MenuQuery.class))).thenAnswer(invocation -> {
            MenuQuery q = invocation.getArgument(0);
            return q.maxRank() == null ? List.of() : List.of(menu(10L, 3));
        });
        CurrentUserQuery query =
                new CurrentUserQuery(UserIdCodec.toDomain(100L), UserPrivilege.NORMAL, null, AccessRank.of(5));
        assertEquals(List.of(), service.listAccessibleMenus(query));
        verify(roles, never()).listRoleMenus(any(RoleQuery.class));
        full.setStatus(RoleStatus.ENABLED);
        assertEquals(1, service.listAccessibleMenus(query).size());
    }

    @Test
    void oversizedImageHeaderMustBeRejectedBeforeRasterDecode() throws Exception {
        StorageFacade storage = mock(StorageFacade.class);
        byte[] image = validAvatarInputStream().readAllBytes();
        ByteBuffer.wrap(image, 16, 8).putInt(100000).putInt(100000);
        CRC32 crc = new CRC32();
        crc.update(image, 12, 17);
        ByteBuffer.wrap(image, 29, 4).putInt((int) crc.getValue());
        assertThrows(BizException.class, () -> service(storage)
                .changeAvatar(new ChangeCurrentUserAvatarCommand(
                        UserIdCodec.toDomain(100L), new ByteArrayInputStream(image), "avatar.png")));
        verify(storage, never()).upload(any(UploadStorageFacadeRequest.class));
    }

    private static CurrentUserProfileApplicationServiceImpl service(StorageFacade storageFacade) {
        return service(
                mock(UserManagementApplicationService.class),
                mock(RoleManagementApplicationService.class),
                mock(MenuManagementApplicationService.class),
                storageFacade);
    }

    private static CurrentUserProfileApplicationServiceImpl service(
            UserManagementApplicationService userService,
            RoleManagementApplicationService roleService,
            MenuManagementApplicationService menuService,
            StorageFacade storageFacade) {
        return new CurrentUserProfileApplicationServiceImpl(
                userService,
                roleService,
                menuService,
                mock(PrincipalIdentityApplicationService.class),
                mock(PrincipalCredentialApplicationService.class),
                storageFacade);
    }

    private static Menu menu(long id, int rank) {
        Menu menu = new Menu();
        menu.setId(MenuIdCodec.toDomain(id));
        menu.setRank(AccessRank.of(rank));
        return menu;
    }

    private static StorageObjectFacadeDto avatar(long userId, long storageObjectId) {
        return StorageObjectFacadeDto.builder()
                .id(storageObjectId)
                .ownerId(String.valueOf(userId))
                .ownerType("USER")
                .objectStatus("ACTIVE")
                .remarks("avatar")
                .build();
    }

    private static InputStream validAvatarInputStream() {
        try {
            BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            ImageIO.write(image, "png", outputStream);
            return new ByteArrayInputStream(outputStream.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
