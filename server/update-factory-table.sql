-- 更新工厂表结构

-- 检查是否已存在processes字段，如果不存在则添加
SET @exist_processes := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factories' AND COLUMN_NAME = 'processes');
SET @sql_processes := IF(@exist_processes = 0, 'ALTER TABLE `factories` ADD COLUMN `processes` TEXT COMMENT "工序列表(JSON格式)"', 'SELECT "processes字段已存在" AS message');
PREPARE stmt FROM @sql_processes;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查是否已存在debt字段，如果不存在则添加
SET @exist_debt := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factories' AND COLUMN_NAME = 'debt');
SET @sql_debt := IF(@exist_debt = 0, 'ALTER TABLE `factories` ADD COLUMN `debt` DECIMAL(10,2) DEFAULT 0 COMMENT "欠款金额"', 'SELECT "debt字段已存在" AS message');
PREPARE stmt FROM @sql_debt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查是否已存在balance字段，如果不存在则添加
SET @exist_balance := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factories' AND COLUMN_NAME = 'balance');
SET @sql_balance := IF(@exist_balance = 0, 'ALTER TABLE `factories` ADD COLUMN `balance` DECIMAL(10,2) DEFAULT 0 COMMENT "余额"', 'SELECT "balance字段已存在" AS message');
PREPARE stmt FROM @sql_balance;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 检查是否已存在remark字段，如果不存在则添加
SET @exist_remark := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factories' AND COLUMN_NAME = 'remark');
SET @sql_remark := IF(@exist_remark = 0, 'ALTER TABLE `factories` ADD COLUMN `remark` TEXT COMMENT "备注"', 'SELECT "remark字段已存在" AS message');
PREPARE stmt FROM @sql_remark;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 如果有现有数据，初始化processes字段为空数组
UPDATE `factories` SET `processes` = '[]' WHERE `processes` IS NULL;

SELECT 'factories表结构更新完成' AS message; 