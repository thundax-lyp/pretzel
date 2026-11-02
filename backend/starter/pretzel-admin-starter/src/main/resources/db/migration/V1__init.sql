SET NAMES utf8mb4;

CREATE TABLE `system_department` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `parent_id` bigint DEFAULT NULL,
    `lft` int NOT NULL DEFAULT 0,
    `rgt` int NOT NULL DEFAULT 0,
    `name` varchar(128) NOT NULL,
    `short_name` varchar(128) DEFAULT NULL,
    `remarks` varchar(512) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_system_department_parent` (`parent_id`, `lft`),
    KEY `idx_system_department_tree` (`lft`, `rgt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台部门表';

CREATE TABLE `system_user` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `department_id` bigint DEFAULT NULL,
    `name` varchar(128) NOT NULL,
    `email` varchar(512) DEFAULT NULL,
    `mobile` varchar(512) DEFAULT NULL,
    `tel` varchar(64) DEFAULT NULL,
    `ranks` int NOT NULL DEFAULT 0,
    `privilege` varchar(16) NOT NULL DEFAULT 'NORMAL',
    `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
    `remarks` varchar(512) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_system_user_department` (`department_id`, `id`),
    KEY `idx_system_user_status` (`status`, `id`),
    KEY `idx_system_user_privilege` (`privilege`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台用户主体表';

CREATE TABLE `system_role` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(128) NOT NULL,
    `privilege` varchar(16) NOT NULL DEFAULT 'NORMAL',
    `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
    `priority` int NOT NULL DEFAULT 0,
    `remarks` varchar(512) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_role_priority` (`priority`),
    KEY `idx_system_role_status` (`status`, `priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台角色表';

CREATE TABLE `system_menu` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `parent_id` bigint DEFAULT NULL,
    `lft` int NOT NULL DEFAULT 0,
    `rgt` int NOT NULL DEFAULT 0,
    `name` varchar(128) NOT NULL,
    `perms` varchar(512) DEFAULT NULL,
    `ranks` int NOT NULL DEFAULT 0,
    `visibility` varchar(16) NOT NULL DEFAULT 'VISIBLE',
    `display_params` text DEFAULT NULL,
    `url` varchar(512) DEFAULT NULL,
    `target` varchar(64) DEFAULT NULL,
    `remarks` varchar(512) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_system_menu_parent` (`parent_id`, `lft`),
    KEY `idx_system_menu_visibility` (`visibility`, `ranks`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台菜单和权限资源表';

CREATE TABLE `system_dict` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `type` varchar(128) NOT NULL,
    `label` varchar(128) NOT NULL,
    `value` varchar(128) NOT NULL,
    `priority` int NOT NULL DEFAULT 0,
    `remarks` varchar(512) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_dict_priority` (`priority`),
    KEY `idx_system_dict_type_priority` (`type`, `priority`, `id`),
    KEY `idx_system_dict_type_value` (`type`, `value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台字典表';

CREATE TABLE `system_user_role` (
    `user_id` bigint NOT NULL,
    `role_id` bigint NOT NULL,
    PRIMARY KEY (`user_id`, `role_id`),
    KEY `idx_system_user_role_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关系表';

CREATE TABLE `system_role_menu` (
    `role_id` bigint NOT NULL,
    `menu_id` bigint NOT NULL,
    PRIMARY KEY (`role_id`, `menu_id`),
    KEY `idx_system_role_menu_menu` (`menu_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单关系表';

CREATE TABLE `system_auth_principal_identity` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `principal_type` varchar(32) NOT NULL,
    `principal_id` bigint NOT NULL,
    `identity_type` varchar(32) NOT NULL,
    `identity_value` varchar(255) NOT NULL,
    `status` varchar(16) NOT NULL DEFAULT 'ENABLED',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_auth_principal_identity_type_value` (`identity_type`, `identity_value`),
    KEY `idx_system_auth_principal_identity_principal` (`principal_type`, `principal_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认证主体登录标识表';

CREATE TABLE `system_auth_principal_credential` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `principal_type` varchar(32) NOT NULL,
    `principal_id` bigint NOT NULL,
    `identity_id` bigint NOT NULL,
    `credential_type` varchar(32) NOT NULL,
    `credential_value` varchar(255) NOT NULL,
    `status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
    `need_change_password` tinyint(1) NOT NULL DEFAULT 0,
    `failed_count` int NOT NULL DEFAULT 0,
    `failed_limit` int NOT NULL DEFAULT 5,
    `locked_until` BIGINT DEFAULT NULL,
    `expires_at` BIGINT DEFAULT NULL,
    `last_verified_at` BIGINT DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_auth_principal_credential_identity_type` (`identity_id`, `credential_type`),
    KEY `idx_system_auth_principal_credential_principal` (`principal_type`, `principal_id`, `status`),
    KEY `idx_system_auth_principal_credential_locked` (`locked_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认证主体凭据表';

CREATE TABLE `system_auth_principal_login_event` (
    `id` varchar(64) NOT NULL,
    `principal_type` varchar(32) DEFAULT NULL,
    `principal_id` bigint DEFAULT NULL,
    `client_id` varchar(64) NOT NULL,
    `event_type` varchar(32) NOT NULL,
    `authentication_method` varchar(32) NOT NULL,
    `identity_type` varchar(32) DEFAULT NULL,
    `occurred_at` BIGINT NOT NULL,
    `ip` varchar(64) DEFAULT NULL,
    `user_agent` varchar(512) DEFAULT NULL,
    `reason` varchar(128) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_system_auth_principal_login_event_principal_time` (`principal_type`, `principal_id`, `occurred_at`),
    KEY `idx_system_auth_principal_login_event_client_time` (`client_id`, `occurred_at`),
    KEY `idx_system_auth_principal_login_event_type_time` (`event_type`, `occurred_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='认证事件表';

CREATE TABLE `system_log` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `user_id` bigint DEFAULT NULL,
    `type` varchar(32) DEFAULT NULL,
    `log_date` BIGINT NOT NULL,
    `title` varchar(255) DEFAULT NULL,
    `remote_addr` varchar(64) DEFAULT NULL,
    `user_agent` varchar(512) DEFAULT NULL,
    `method` varchar(16) DEFAULT NULL,
    `request_uri` varchar(512) DEFAULT NULL,
    `request_params` text DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_system_log_type_time` (`type`, `log_date`),
    KEY `idx_system_log_remote_time` (`remote_addr`, `log_date`),
    KEY `idx_system_log_user_time` (`user_id`, `log_date`),
    KEY `idx_system_log_request_time` (`request_uri`, `log_date`),
    KEY `idx_system_log_time` (`log_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='后台访问运行日志表';

CREATE TABLE `system_audit_meta` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `object_type` varchar(128) NOT NULL,
    `object_id` varchar(64) NOT NULL,
    `version` bigint NOT NULL,
    `last_log_id` bigint NOT NULL,
    `last_action` varchar(32) NOT NULL,
    `last_operator_type` varchar(32) NOT NULL,
    `last_operator_id` varchar(64) DEFAULT NULL,
    `last_operator_name` varchar(128) DEFAULT NULL,
    `last_operated_at` BIGINT NOT NULL,
    `created_log_id` bigint NOT NULL,
    `created_at` BIGINT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_audit_meta_object` (`object_type`, `object_id`),
    KEY `idx_system_audit_meta_last_operated` (`last_operated_at`),
    KEY `idx_system_audit_meta_last_operator` (`last_operator_type`, `last_operator_id`, `last_operated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务对象审计元数据表';

CREATE TABLE `system_audit_log` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `meta_id` bigint NOT NULL,
    `object_type` varchar(128) NOT NULL,
    `object_id` varchar(64) NOT NULL,
    `version` bigint NOT NULL,
    `previous_version` bigint NOT NULL,
    `action` varchar(32) NOT NULL,
    `idempotency_key` varchar(128) NOT NULL,
    `operator_type` varchar(32) NOT NULL,
    `operator_id` varchar(64) DEFAULT NULL,
    `operator_name` varchar(128) DEFAULT NULL,
    `source` varchar(64) NOT NULL,
    `request_id` varchar(128) DEFAULT NULL,
    `trace_id` varchar(128) DEFAULT NULL,
    `remote_addr` varchar(64) DEFAULT NULL,
    `summary` varchar(512) DEFAULT NULL,
    `snapshot_schema_version` int NOT NULL DEFAULT 1,
    `before_snapshot` longtext DEFAULT NULL,
    `after_snapshot` longtext DEFAULT NULL,
    `changed_fields` longtext DEFAULT NULL,
    `occurred_at` BIGINT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_system_audit_log_idempotency` (`idempotency_key`),
    UNIQUE KEY `uk_system_audit_log_meta_version` (`meta_id`, `version`),
    KEY `idx_system_audit_log_object` (`object_type`, `object_id`, `occurred_at`),
    KEY `idx_system_audit_log_operator` (`operator_type`, `operator_id`, `occurred_at`),
    KEY `idx_system_audit_log_action` (`action`, `occurred_at`),
    KEY `idx_system_audit_log_request` (`request_id`),
    KEY `idx_system_audit_log_trace` (`trace_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务对象审计日志表';

SET NAMES utf8mb4;

CREATE TABLE `storage_object` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `name` varchar(255) NOT NULL,
    `extend_name` varchar(64) DEFAULT NULL,
    `mime_type` varchar(128) DEFAULT NULL,
    `bucket_name` varchar(128) DEFAULT NULL,
    `object_key` varchar(512) NOT NULL,
    `size` bigint NOT NULL DEFAULT 0,
    `access_endpoint` varchar(1024) DEFAULT NULL,
    `stored_at` BIGINT NOT NULL,
    `object_status` varchar(16) NOT NULL DEFAULT 'ACTIVE',
    `reference_status` varchar(16) NOT NULL DEFAULT 'UNREFERENCED',
    `priority` int NOT NULL DEFAULT 0,
    `remarks` varchar(512) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_storage_object_key` (`bucket_name`, `object_key`),
    UNIQUE KEY `uk_storage_object_priority` (`priority`),
    KEY `idx_storage_object_status` (`object_status`, `reference_status`),
    KEY `idx_storage_object_cleanup` (`object_status`, `reference_status`, `stored_at`),
    KEY `idx_storage_object_mime_type` (`mime_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储对象表';

-- storage_object_reference 约束真相源：
-- - 复合主键 (object_id, reference_owner_type, reference_owner_id) 实现 owner 级幂等。
-- - 不同 owner 可同时引用同一 object（支持多引用）。
-- - 多条引用状态变更由业务层按有效引用集合收敛。
CREATE TABLE `storage_object_reference` (
    `object_id` bigint NOT NULL,
    `reference_owner_type` varchar(64) NOT NULL,
    `reference_owner_id` varchar(64) NOT NULL,
    `business_params` text DEFAULT NULL,
    PRIMARY KEY (`object_id`, `reference_owner_type`, `reference_owner_id`),
    KEY `idx_storage_object_reference_owner` (`reference_owner_type`, `reference_owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='存储对象引用关系表';

CREATE TABLE `storage_multipart_upload` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `upload_id` varchar(64) NOT NULL,
    `owner_id` varchar(64) NOT NULL,
    `owner_type` varchar(64) NOT NULL,
    `business_type` varchar(64) DEFAULT NULL,
    `original_filename` varchar(255) NOT NULL,
    `mime_type` varchar(128) NOT NULL,
    `bucket_name` varchar(128) DEFAULT NULL,
    `object_key` varchar(512) NOT NULL,
    `provider_upload_id` varchar(255) DEFAULT NULL,
    `total_size` bigint NOT NULL,
    `part_size` bigint NOT NULL,
    `uploaded_part_count` int NOT NULL DEFAULT 0,
    `upload_status` varchar(16) NOT NULL DEFAULT 'INITIATED',
    `completed_date` BIGINT DEFAULT NULL,
    `aborted_date` BIGINT DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_storage_multipart_upload_id` (`upload_id`),
    KEY `idx_storage_multipart_upload_owner` (`owner_type`, `owner_id`, `upload_status`),
    KEY `idx_storage_multipart_upload_object_key` (`bucket_name`, `object_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分片上传会话表';

CREATE TABLE `storage_multipart_upload_part` (
    `id` bigint NOT NULL AUTO_INCREMENT,
    `upload_id` varchar(64) NOT NULL,
    `part_path` varchar(512) NOT NULL,
    `part_number` int NOT NULL,
    `etag` varchar(255) NOT NULL,
    `size` bigint NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_storage_multipart_upload_part` (`upload_id`, `part_number`),
    KEY `idx_storage_multipart_upload_part_upload` (`upload_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分片上传分片记录表';

INSERT INTO system_department (id,lft,rgt,name,short_name) VALUES (1,1,2,'腿了个腿','Pretzel');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (1,NULL,1,14,'系统管理','sys',0,'VISIBLE','{"icon": "system"}','/system');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (2,1,2,3,'用户管理','sys:user:view,sys:user:edit',0,'VISIBLE','{"icon": "users"}','/system/users');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (3,1,4,5,'部门管理','sys:department:view,sys:department:edit',0,'VISIBLE','{"icon": "departments"}','/system/departments');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (4,1,6,7,'角色管理','sys:role:view,sys:role:edit',0,'VISIBLE','{"icon": "roles"}','/system/roles');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (5,1,8,9,'菜单管理','super',0,'VISIBLE','{"icon": "menus"}','/system/menus');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (6,1,10,11,'字典管理','sys:dict:view,sys:dict:edit',0,'VISIBLE','{"icon": "dictionaries"}','/system/dictionaries');
INSERT INTO system_menu (id,parent_id,lft,rgt,name,perms,ranks,visibility,display_params,url) VALUES (7,1,12,13,'系统日志','system:log:view',0,'VISIBLE','{"icon": "logs"}','/system/logs');
