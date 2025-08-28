-- 为factory_payments表添加图片URL字段
-- 迁移文件：添加image_urls字段支持付款备注图片

ALTER TABLE `factory_payments` 
ADD COLUMN `image_urls` JSON DEFAULT NULL COMMENT '备注图片URL数组，JSON格式存储' 
AFTER `remark`;

-- 为新字段添加索引（可选，如果需要搜索图片）
-- CREATE INDEX idx_factory_payments_has_images ON factory_payments ((CASE WHEN image_urls IS NOT NULL THEN 1 ELSE 0 END));

-- 更新表注释
ALTER TABLE `factory_payments` 
COMMENT = '工厂付款记录表，支持文字备注和图片备注'; 