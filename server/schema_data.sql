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