-- 数据库迁移：为发出单和收回单表添加照片备注字段
-- 执行时间：2025年1月8日

-- 为发出单表添加照片备注字段
ALTER TABLE `send_orders` 
ADD COLUMN `remark_images` TEXT DEFAULT NULL COMMENT '备注照片JSON数组' 
AFTER `remark`;

-- 为收回单表添加照片备注字段  
ALTER TABLE `receive_orders` 
ADD COLUMN `remark_images` TEXT DEFAULT NULL COMMENT '备注照片JSON数组' 
AFTER `remark`;

-- 验证字段添加成功
SHOW COLUMNS FROM `send_orders` LIKE 'remark_images';
SHOW COLUMNS FROM `receive_orders` LIKE 'remark_images'; 