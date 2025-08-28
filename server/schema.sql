-- 纺织加工管理系统数据库表结构
-- 根据实际生产环境数据库结构创建
-- 最后更新：2025年1月

-- ========================================
-- 用户管理相关表
-- ========================================

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `real_name` VARCHAR(50) DEFAULT NULL,
  `password` VARCHAR(255) NOT NULL,
  `status` TINYINT(1) DEFAULT 1,
  `miniprogram_authorized` TINYINT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `password_reset_required` TINYINT(1) DEFAULT 0,
  `last_login` TIMESTAMP NULL DEFAULT NULL,
  `is_super_admin` TINYINT(1) DEFAULT 0,
  `email` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `orgId` VARCHAR(100) DEFAULT NULL,
  `role_id` INT DEFAULT NULL,
  `salt` VARCHAR(255) NOT NULL,
  `current_token` TEXT DEFAULT NULL,
  `current_login_time` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`username`),
  KEY (`status`),
  KEY (`email`),
  KEY (`orgId`),
  KEY (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 角色表
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `description` VARCHAR(200) DEFAULT NULL,
  `permissions` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 组织表
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orgId` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `contact` VARCHAR(50) DEFAULT NULL,
  `phone` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `address` VARCHAR(200) DEFAULT NULL,
  `status` TINYINT DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织表';

-- ========================================
-- 基础数据表
-- ========================================

-- 工厂表
CREATE TABLE IF NOT EXISTS `factories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `contact` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(50) DEFAULT NULL,
  `orgId` VARCHAR(100) NOT NULL,
  `createTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updateTime` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `remark` VARCHAR(255) DEFAULT '',
  `status` TINYINT(1) DEFAULT 1,
  `processes` TEXT DEFAULT NULL,
  `balance` DECIMAL(12,2) DEFAULT 0.00,
  `debt` DECIMAL(12,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工厂表';

-- 工序表
CREATE TABLE IF NOT EXISTS `processes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `orgId` VARCHAR(100) NOT NULL,
  `createTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updateTime` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order` INT DEFAULT 1,
  `status` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序表';

-- 产品表
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT NULL,
  `orgId` VARCHAR(50) DEFAULT NULL,
  `createTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updateTime` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `image` VARCHAR(255) DEFAULT '',
  `colors` VARCHAR(255) DEFAULT NULL,
  `sizes` VARCHAR(255) DEFAULT NULL,
  `processes` VARCHAR(255) DEFAULT NULL,
  `status` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品表';

-- 颜色表
CREATE TABLE IF NOT EXISTS `colors` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(20) DEFAULT NULL,
  `orgId` VARCHAR(100) NOT NULL,
  `status` TINYINT(1) DEFAULT 1,
  `createTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updateTime` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order` INT DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY (`name`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='颜色表';

-- 尺码表
CREATE TABLE IF NOT EXISTS `sizes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orgId` VARCHAR(50) NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `orderNum` INT DEFAULT 0,
  `status` INT DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='尺码表';

-- ========================================
-- 业务流程表
-- ========================================

-- 发货单表
CREATE TABLE IF NOT EXISTS `send_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orgId` VARCHAR(50) NOT NULL,
  `order_no` VARCHAR(50) NOT NULL,
  `factory_id` INT NOT NULL,
  `process_id` INT NOT NULL,
  `process` VARCHAR(100) DEFAULT NULL,
  `total_weight` DECIMAL(10,2) DEFAULT 0.00,
  `total_quantity` INT DEFAULT 0,
  `total_fee` DECIMAL(10,2) DEFAULT 0.00,
  `remark` TEXT DEFAULT NULL,
  `remark_images` TEXT DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发货单表';

-- 发货单明细表
CREATE TABLE IF NOT EXISTS `send_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `send_order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_no` VARCHAR(50) NOT NULL,
  `color_id` INT DEFAULT NULL,
  `color_code` VARCHAR(20) DEFAULT NULL,
  `size_id` INT DEFAULT NULL,
  `size_code` VARCHAR(20) DEFAULT NULL,
  `weight` DECIMAL(10,2) DEFAULT 0.00,
  `quantity` INT DEFAULT 0,
  `fee` DECIMAL(10,2) DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发货单明细表';

-- 收货单表
CREATE TABLE IF NOT EXISTS `receive_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orgId` VARCHAR(50) NOT NULL,
  `order_no` VARCHAR(50) NOT NULL,
  `factory_id` INT NOT NULL,
  `process_id` INT NOT NULL,
  `total_weight` DECIMAL(10,2) DEFAULT 0.00,
  `total_quantity` INT DEFAULT 0,
  `total_fee` DECIMAL(10,2) DEFAULT 0.00,
  `payment_amount` DECIMAL(10,2) DEFAULT 0.00,
  `payment_method` VARCHAR(20) DEFAULT '未付',
  `remark` TEXT DEFAULT NULL,
  `remark_images` TEXT DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY (`orgId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货单表';

-- 收货单明细表
CREATE TABLE IF NOT EXISTS `receive_order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `receive_order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `product_no` VARCHAR(50) NOT NULL,
  `color_id` INT DEFAULT NULL,
  `color_code` VARCHAR(20) DEFAULT NULL,
  `size_id` INT DEFAULT NULL,
  `size_code` VARCHAR(20) DEFAULT NULL,
  `weight` DECIMAL(10,2) DEFAULT 0.00,
  `quantity` INT DEFAULT 0,
  `fee` DECIMAL(10,2) DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货单明细表';

-- 产品关联表
CREATE TABLE IF NOT EXISTS `product_colors` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `color_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品颜色关联表';

CREATE TABLE IF NOT EXISTS `product_sizes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `product_id` INT NOT NULL,
  `size_id` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品尺码关联表';

-- ========================================
-- 财务管理表
-- ========================================

-- 工厂付款记录表
CREATE TABLE IF NOT EXISTS `factory_payments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `orgId` VARCHAR(100) NOT NULL,
  `factory_id` INT NOT NULL,
  `payment_no` VARCHAR(50) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_method` VARCHAR(20) NOT NULL,
  `remark` TEXT DEFAULT NULL,
  `status` TINYINT(1) DEFAULT 1 COMMENT '状态：1=有效，0=作废',
  `created_by` INT DEFAULT NULL,
  `createTime` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updateTime` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY (`orgId`),
  KEY (`factory_id`),
  KEY (`payment_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工厂付款记录表';

-- ========================================
-- 系统日志表
-- ========================================

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT DEFAULT NULL,
  `username` VARCHAR(50) DEFAULT NULL,
  `action` VARCHAR(50) NOT NULL,
  `target_type` VARCHAR(50) DEFAULT NULL,
  `target_id` VARCHAR(50) DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 登录尝试记录表
CREATE TABLE IF NOT EXISTS `login_attempts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `success` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录尝试记录表';

-- ========================================
-- 用户会话管理表
-- ========================================

-- 用户会话表
CREATE TABLE IF NOT EXISTS `user_sessions` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `session_token` VARCHAR(512) NOT NULL,
  `platform` VARCHAR(20) DEFAULT 'miniprogram' COMMENT '平台：miniprogram/web/admin',
  `device_info` TEXT DEFAULT NULL COMMENT '设备信息',
  `ip_address` VARCHAR(50) DEFAULT NULL,
  `login_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `last_activity` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否活跃：1=活跃，0=非活跃',
  `orgId` VARCHAR(100) NOT NULL COMMENT '组织ID，确保数据隔离',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_token` (`session_token`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_orgId` (`orgId`),
  KEY `idx_last_activity` (`last_activity`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_org_active` (`orgId`, `is_active`, `last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户会话管理表';

-- ========================================
-- 视图定义
-- ========================================

-- 流水表视图（修复版本）
CREATE OR REPLACE VIEW `flow_table` AS
SELECT 
  'send' as type,
  so.order_no,
  f.name as factory_name,
  p.name as process,
  soi.product_no,
  CONCAT(COALESCE(c.name, ''), ' ', COALESCE(s.name, '')) as product_detail,
  soi.weight,
  soi.quantity,
  soi.fee,
  so.created_at as date,
  so.orgId
FROM send_orders so
JOIN send_order_items soi ON so.id = soi.send_order_id
JOIN factories f ON so.factory_id = f.id AND f.orgId = so.orgId
JOIN processes p ON so.process_id = p.id AND p.orgId = so.orgId
LEFT JOIN colors c ON soi.color_id = c.id AND c.orgId = so.orgId
LEFT JOIN sizes s ON soi.size_id = s.id AND s.orgId = so.orgId
WHERE so.status = 1

UNION ALL

SELECT 
  'receive' as type,
  ro.order_no,
  f.name as factory_name,
  p.name as process,
  roi.product_no,
  CONCAT(COALESCE(c.name, ''), ' ', COALESCE(s.name, '')) as product_detail,
  roi.weight,
  roi.quantity,
  roi.fee,
  ro.created_at as date,
  ro.orgId
FROM receive_orders ro
JOIN receive_order_items roi ON ro.id = roi.receive_order_id
JOIN factories f ON ro.factory_id = f.id AND f.orgId = ro.orgId
JOIN processes p ON ro.process_id = p.id AND p.orgId = ro.orgId
LEFT JOIN colors c ON roi.color_id = c.id AND c.orgId = ro.orgId
LEFT JOIN sizes s ON roi.size_id = s.id AND s.orgId = ro.orgId
WHERE ro.status = 1;

-- ========================================
-- 初始数据插入（仅在空表时执行）
-- ========================================

-- 插入默认角色
INSERT IGNORE INTO `roles` (`id`, `name`, `description`, `permissions`) VALUES
(1, '超级管理员', '系统超级管理员，拥有所有权限', '*'),
(2, '组织管理员', '组织管理员，管理本组织内的所有数据', 'org_manage'),
(3, '操作员', '普通操作员，只能进行基本操作', 'basic_operation'),
(4, '专员', '专员角色，只能查看自己制单的发出单和收回单', 'view_own_orders');

-- 插入测试组织（仅在开发环境）
INSERT IGNORE INTO `organizations` (`orgId`, `name`, `contact`, `phone`, `address`) VALUES
('000', '测试组织', '管理员', '13800138000', '测试地址');

-- 插入超级管理员用户（默认密码：admin123，盐值：test_salt）
-- 注意：生产环境请立即修改密码
INSERT IGNORE INTO `users` (
  `username`, `password`, `salt`, `real_name`, `orgId`, `role_id`, 
  `is_super_admin`, `status`, `miniprogram_authorized`
) VALUES (
  'admin', 
  'da7b9a0f4c8e65c97cf46c5b8bf1b7e91f4a47a4f5a95f5e08a3c1f2b9e7d4c6a8b5f2e1d4c7a9b6e3f8d1c4a7b2e5f9c2a5b8e1d6f3c9a2b5e8f1c4a7b2e5f', 
  'test_salt', 
  '系统管理员', 
  '000', 
  1, 
  1, 
  1, 
  1
);

-- ========================================
-- 性能优化索引
-- ========================================

-- 添加复合索引提高查询性能
CREATE INDEX IF NOT EXISTS `idx_send_orders_org_status` ON `send_orders` (`orgId`, `status`);
CREATE INDEX IF NOT EXISTS `idx_receive_orders_org_status` ON `receive_orders` (`orgId`, `status`);
CREATE INDEX IF NOT EXISTS `idx_send_order_items_product` ON `send_order_items` (`product_no`, `color_code`, `size_code`);
CREATE INDEX IF NOT EXISTS `idx_receive_order_items_product` ON `receive_order_items` (`product_no`, `color_code`, `size_code`);
CREATE INDEX IF NOT EXISTS `idx_factories_org` ON `factories` (`orgId`, `status`);
CREATE INDEX IF NOT EXISTS `idx_processes_org` ON `processes` (`orgId`, `status`);
CREATE INDEX IF NOT EXISTS `idx_products_org_code` ON `products` (`orgId`, `code`);
CREATE INDEX IF NOT EXISTS `idx_colors_org` ON `colors` (`orgId`, `status`);
CREATE INDEX IF NOT EXISTS `idx_sizes_org` ON `sizes` (`orgId`, `status`);

-- ========================================
-- 数据库表结构说明
-- ========================================

/*
表结构说明：
1. 用户相关：users, roles, organizations
2. 基础数据：factories, processes, products, colors, sizes
3. 业务流程：send_orders, send_order_items, receive_orders, receive_order_items
4. 兼容旧系统：orders, order_items
5. 关联表：product_colors, product_sizes
6. 财务管理：factory_payments
7. 系统日志：operation_logs, login_attempts
8. 视图：flow_table

字段命名约定：
- 主要使用驼峰命名：orgId, createTime, updateTime
- 部分表使用下划线命名：created_at, updated_at（符合实际数据库结构）
- 确保与现有代码兼容

数据隔离：
- 所有业务数据都通过orgId进行组织隔离
- 确保各组织数据完全独立
- 超级管理员可跨组织操作

*/ 