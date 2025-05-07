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