-- 数据库索引优化脚本
-- 基于查询模式分析，为高频查询添加合适的索引

-- 1. 组织ID相关索引（最重要的数据隔离索引）
-- 发出单表
ALTER TABLE send_orders ADD INDEX IF NOT EXISTS idx_send_orders_orgid_status (orgId, status);
ALTER TABLE send_orders ADD INDEX IF NOT EXISTS idx_send_orders_orgid_created (orgId, created_at);
ALTER TABLE send_orders ADD INDEX IF NOT EXISTS idx_send_orders_orgid_factory (orgId, factory_id);

-- 收回单表
ALTER TABLE receive_orders ADD INDEX IF NOT EXISTS idx_receive_orders_orgid_status (orgId, status);
ALTER TABLE receive_orders ADD INDEX IF NOT EXISTS idx_receive_orders_orgid_created (orgId, created_at);
ALTER TABLE receive_orders ADD INDEX IF NOT EXISTS idx_receive_orders_orgid_factory (orgId, factory_id);

-- 2. 用户表索引
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_orgid_status (orgId, status);
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_users_orgid_role (orgId, role_id);

-- 3. 工厂表索引
ALTER TABLE factories ADD INDEX IF NOT EXISTS idx_factories_orgid_status (orgId, status);
ALTER TABLE factories ADD INDEX IF NOT EXISTS idx_factories_orgid_name (orgId, name);

-- 4. 产品表索引
ALTER TABLE products ADD INDEX IF NOT EXISTS idx_products_orgid_status (orgId, status);
ALTER TABLE products ADD INDEX IF NOT EXISTS idx_products_orgid_code (orgId, code);

-- 5. 工序表索引
ALTER TABLE processes ADD INDEX IF NOT EXISTS idx_processes_orgid_status (orgId, status);

-- 6. 流水记录表索引
ALTER TABLE flow_records ADD INDEX IF NOT EXISTS idx_flow_records_orgid_status (orgId, status);
ALTER TABLE flow_records ADD INDEX IF NOT EXISTS idx_flow_records_orgid_date (orgId, send_date);
ALTER TABLE flow_records ADD INDEX IF NOT EXISTS idx_flow_records_orgid_factory (orgId, factory_id);

-- 7. 订单明细表索引
ALTER TABLE send_order_items ADD INDEX IF NOT EXISTS idx_send_items_order_id (send_order_id);
ALTER TABLE send_order_items ADD INDEX IF NOT EXISTS idx_send_items_product_id (product_id);

ALTER TABLE receive_order_items ADD INDEX IF NOT EXISTS idx_receive_items_order_id (receive_order_id);
ALTER TABLE receive_order_items ADD INDEX IF NOT EXISTS idx_receive_items_product_id (product_id);

-- 8. 组织表索引
ALTER TABLE organizations ADD INDEX IF NOT EXISTS idx_organizations_orgid (orgId);
ALTER TABLE organizations ADD INDEX IF NOT EXISTS idx_organizations_status (status);

-- 9. 外键关联索引
ALTER TABLE send_orders ADD INDEX IF NOT EXISTS idx_send_orders_factory_id (factory_id);
ALTER TABLE send_orders ADD INDEX IF NOT EXISTS idx_send_orders_process_id (process_id);
ALTER TABLE send_orders ADD INDEX IF NOT EXISTS idx_send_orders_created_by (created_by);

ALTER TABLE receive_orders ADD INDEX IF NOT EXISTS idx_receive_orders_factory_id (factory_id);
ALTER TABLE receive_orders ADD INDEX IF NOT EXISTS idx_receive_orders_process_id (process_id);
ALTER TABLE receive_orders ADD INDEX IF NOT EXISTS idx_receive_orders_created_by (created_by);

-- 索引使用分析查询（注释掉，需要时可以取消注释使用）
/*
-- 检查索引使用情况
SELECT 
    OBJECT_SCHEMA,
    OBJECT_NAME,
    INDEX_NAME,
    COUNT_FETCH,
    COUNT_INSERT,
    COUNT_UPDATE,
    COUNT_DELETE
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA = 'processing_app'
ORDER BY COUNT_FETCH DESC;

-- 检查未使用的索引
SELECT 
    OBJECT_SCHEMA,
    OBJECT_NAME,
    INDEX_NAME
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE OBJECT_SCHEMA = 'processing_app'
  AND INDEX_NAME IS NOT NULL
  AND COUNT_FETCH = 0
  AND INDEX_NAME != 'PRIMARY';
*/ 