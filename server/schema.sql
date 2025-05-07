-- 创建用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码',
  `real_name` VARCHAR(50) COMMENT '真实姓名',
  `role` ENUM('admin', 'manager', 'staff') NOT NULL DEFAULT 'staff' COMMENT '角色',
  `phone` VARCHAR(20) COMMENT '电话',
  `email` VARCHAR(100) COMMENT '邮箱',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `last_login` DATETIME COMMENT '最后登录时间',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_user` (`org_id`, `username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 创建组织表
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID（业务ID）',
  `name` VARCHAR(100) NOT NULL COMMENT '组织名称',
  `address` VARCHAR(255) COMMENT '地址',
  `contact_person` VARCHAR(50) COMMENT '联系人',
  `contact_phone` VARCHAR(20) COMMENT '联系电话',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_id` (`org_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织表';

-- 创建工厂表
CREATE TABLE IF NOT EXISTS `factories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `code` VARCHAR(50) NOT NULL COMMENT '工厂编码',
  `name` VARCHAR(100) NOT NULL COMMENT '工厂名称',
  `address` VARCHAR(255) COMMENT '地址',
  `contact_person` VARCHAR(50) COMMENT '联系人',
  `contact_phone` VARCHAR(20) COMMENT '联系电话',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_code` (`org_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工厂表';

-- 创建产品表
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `product_no` VARCHAR(50) NOT NULL COMMENT '货号',
  `name` VARCHAR(100) COMMENT '产品名称',
  `category` VARCHAR(50) COMMENT '类别',
  `unit` VARCHAR(20) DEFAULT '打' COMMENT '单位（打/件）',
  `weight_per_unit` DECIMAL(10,2) COMMENT '单位重量(kg)',
  `price_per_unit` DECIMAL(10,2) COMMENT '单价',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_product` (`org_id`, `product_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品表';

-- 创建颜色表（产品属性）
CREATE TABLE IF NOT EXISTS `colors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `code` VARCHAR(20) NOT NULL COMMENT '颜色编码',
  `name` VARCHAR(50) NOT NULL COMMENT '颜色名称',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_code` (`org_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='颜色表';

-- 创建尺码表（产品属性）
CREATE TABLE IF NOT EXISTS `sizes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `code` VARCHAR(20) NOT NULL COMMENT '尺码编码',
  `name` VARCHAR(50) NOT NULL COMMENT '尺码名称',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_code` (`org_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='尺码表';

-- 创建工序表
CREATE TABLE IF NOT EXISTS `processes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `code` VARCHAR(20) NOT NULL COMMENT '工序编码',
  `name` VARCHAR(50) NOT NULL COMMENT '工序名称',
  `fee` DECIMAL(10,2) DEFAULT 0 COMMENT '默认工费',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-启用 0-禁用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_code` (`org_id`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序表';

-- 创建发货单表
CREATE TABLE IF NOT EXISTS `send_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `order_no` VARCHAR(50) NOT NULL COMMENT '单据编号',
  `factory_id` INT NOT NULL COMMENT '工厂ID',
  `process_id` INT NOT NULL COMMENT '工序ID',
  `total_weight` DECIMAL(10,2) DEFAULT 0 COMMENT '总重量(kg)',
  `total_quantity` INT DEFAULT 0 COMMENT '总数量',
  `total_fee` DECIMAL(10,2) DEFAULT 0 COMMENT '总工费',
  `remark` TEXT COMMENT '备注',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-有效 0-已取消',
  `created_by` INT COMMENT '创建人ID',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_order_no` (`org_id`, `order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发货单表';

-- 创建发货单明细表
CREATE TABLE IF NOT EXISTS `send_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `send_order_id` INT NOT NULL COMMENT '发货单ID',
  `product_id` INT NOT NULL COMMENT '产品ID',
  `product_no` VARCHAR(50) NOT NULL COMMENT '货号',
  `color_id` INT COMMENT '颜色ID',
  `color_code` VARCHAR(20) COMMENT '颜色编码',
  `size_id` INT COMMENT '尺码ID',
  `size_code` VARCHAR(20) COMMENT '尺码编码',
  `weight` DECIMAL(10,2) DEFAULT 0 COMMENT '重量(kg)',
  `quantity` INT DEFAULT 0 COMMENT '数量',
  `fee` DECIMAL(10,2) DEFAULT 0 COMMENT '工费',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY `idx_send_order` (`send_order_id`),
  KEY `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发货单明细表';

-- 创建收货单表
CREATE TABLE IF NOT EXISTS `receive_orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `org_id` VARCHAR(50) NOT NULL COMMENT '组织ID',
  `order_no` VARCHAR(50) NOT NULL COMMENT '单据编号',
  `factory_id` INT NOT NULL COMMENT '工厂ID',
  `process_id` INT NOT NULL COMMENT '工序ID',
  `total_weight` DECIMAL(10,2) DEFAULT 0 COMMENT '总重量(kg)',
  `total_quantity` INT DEFAULT 0 COMMENT '总数量',
  `total_fee` DECIMAL(10,2) DEFAULT 0 COMMENT '总工费',
  `remark` TEXT COMMENT '备注',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1-有效 0-已取消',
  `created_by` INT COMMENT '创建人ID',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `unique_org_order_no` (`org_id`, `order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货单表';

-- 创建收货单明细表
CREATE TABLE IF NOT EXISTS `receive_order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `receive_order_id` INT NOT NULL COMMENT '收货单ID',
  `product_id` INT NOT NULL COMMENT '产品ID',
  `product_no` VARCHAR(50) NOT NULL COMMENT '货号',
  `color_id` INT COMMENT '颜色ID',
  `color_code` VARCHAR(20) COMMENT '颜色编码',
  `size_id` INT COMMENT '尺码ID',
  `size_code` VARCHAR(20) COMMENT '尺码编码',
  `weight` DECIMAL(10,2) DEFAULT 0 COMMENT '重量(kg)',
  `quantity` INT DEFAULT 0 COMMENT '数量',
  `fee` DECIMAL(10,2) DEFAULT 0 COMMENT '工费',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY `idx_receive_order` (`receive_order_id`),
  KEY `idx_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收货单明细表';

-- 插入初始测试数据
-- 创建测试组织
INSERT INTO `organizations` (`org_id`, `name`, `address`, `contact_person`, `contact_phone`) 
VALUES ('org1', '测试服装厂', '广州市番禺区', '张三', '13800138000');

-- 创建测试用户
INSERT INTO `users` (`org_id`, `username`, `password`, `real_name`, `role`, `phone`) 
VALUES ('org1', 'admin', 'admin123', '系统管理员', 'admin', '13800138001');

-- 创建测试工厂
INSERT INTO `factories` (`org_id`, `code`, `name`, `address`, `contact_person`, `contact_phone`) 
VALUES 
('org1', 'F001', '第一加工厂', '广州市白云区', '李四', '13800138002'),
('org1', 'F002', '第二加工厂', '广州市海珠区', '王五', '13800138003');

-- 创建测试工序
INSERT INTO `processes` (`org_id`, `code`, `name`, `fee`, `sort_order`) 
VALUES 
('org1', 'P001', '裁剪', 2.00, 1),
('org1', 'P002', '缝纫', 5.00, 2),
('org1', 'P003', '整烫', 1.50, 3),
('org1', 'P004', '包装', 1.00, 4);

-- 创建测试颜色
INSERT INTO `colors` (`org_id`, `code`, `name`) 
VALUES 
('org1', 'C001', '黑色'),
('org1', 'C002', '白色'),
('org1', 'C003', '红色'),
('org1', 'C004', '蓝色');

-- 创建测试尺码
INSERT INTO `sizes` (`org_id`, `code`, `name`, `sort_order`) 
VALUES 
('org1', 'S001', 'S', 1),
('org1', 'S002', 'M', 2),
('org1', 'S003', 'L', 3),
('org1', 'S004', 'XL', 4);

-- 创建测试产品
INSERT INTO `products` (`org_id`, `product_no`, `name`, `category`, `unit`, `weight_per_unit`, `price_per_unit`) 
VALUES 
('org1', 'T001', '男士T恤', '上衣', '件', 0.25, 15.00),
('org1', 'T002', '女士裙装', '裙子', '件', 0.35, 25.00),
('org1', 'T003', '牛仔裤', '裤子', '件', 0.45, 35.00);

-- 创建示例发货单
INSERT INTO `send_orders` (`org_id`, `order_no`, `factory_id`, `process_id`, `total_weight`, `total_quantity`, `total_fee`, `remark`, `created_by`) 
VALUES 
('org1', 'S202401001', 1, 1, 5.00, 20, 40.00, '发货测试数据', 1),
('org1', 'S202401002', 2, 2, 8.75, 25, 125.00, '第二批发货', 1);

-- 创建示例发货单明细
INSERT INTO `send_order_items` (`send_order_id`, `product_id`, `product_no`, `color_id`, `color_code`, `size_id`, `size_code`, `weight`, `quantity`, `fee`) 
VALUES 
(1, 1, 'T001', 1, 'C001', 1, 'S001', 2.50, 10, 20.00),
(1, 1, 'T001', 2, 'C002', 2, 'S002', 2.50, 10, 20.00),
(2, 2, 'T002', 3, 'C003', 3, 'S003', 8.75, 25, 125.00);

-- 创建示例收货单
INSERT INTO `receive_orders` (`org_id`, `order_no`, `factory_id`, `process_id`, `total_weight`, `total_quantity`, `total_fee`, `remark`, `created_by`) 
VALUES 
('org1', 'R202401001', 1, 1, 2.50, 10, 20.00, '收货测试数据', 1);

-- 创建示例收货单明细
INSERT INTO `receive_order_items` (`receive_order_id`, `product_id`, `product_no`, `color_id`, `color_code`, `size_id`, `size_code`, `weight`, `quantity`, `fee`) 
VALUES 
(1, 1, 'T001', 1, 'C001', 1, 'S001', 2.50, 10, 20.00);

-- 创建流水表视图
CREATE OR REPLACE VIEW `flow_table` AS
SELECT 
  'send' as type,
  so.order_no,
  f.name as factory_name,
  p.name as process,
  soi.product_no,
  CONCAT(c.name, ' ', s.name) as product_detail,
  soi.weight,
  soi.quantity,
  soi.fee,
  so.created_at as date,
  so.org_id
FROM send_orders so
JOIN send_order_items soi ON so.id = soi.send_order_id
JOIN factories f ON so.factory_id = f.id
JOIN processes p ON so.process_id = p.id
LEFT JOIN colors c ON soi.color_id = c.id
LEFT JOIN sizes s ON soi.size_id = s.id
WHERE so.status = 1

UNION ALL

SELECT 
  'receive' as type,
  ro.order_no,
  f.name as factory_name,
  p.name as process,
  roi.product_no,
  CONCAT(c.name, ' ', s.name) as product_detail,
  roi.weight,
  roi.quantity,
  roi.fee,
  ro.created_at as date,
  ro.org_id
FROM receive_orders ro
JOIN receive_order_items roi ON ro.id = roi.receive_order_id
JOIN factories f ON ro.factory_id = f.id
JOIN processes p ON ro.process_id = p.id
LEFT JOIN colors c ON roi.color_id = c.id
LEFT JOIN sizes s ON roi.size_id = s.id
WHERE ro.status = 1; 