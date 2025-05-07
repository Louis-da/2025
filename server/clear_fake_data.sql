-- 清除组织org1的货品和工序假数据

-- 清除货品数据
DELETE FROM products WHERE orgId = 'org1';

-- 清除工序数据
DELETE FROM processes WHERE orgId = 'org1';

-- 显示删除后的统计结果
SELECT 'products' AS table_name, COUNT(*) AS remaining_count FROM products WHERE orgId = 'org1'
UNION ALL
SELECT 'processes' AS table_name, COUNT(*) AS remaining_count FROM processes WHERE orgId = 'org1'; 