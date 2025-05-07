const express = require('express');
const router = express.Router();
const db = require('../db'); // 假设你有db操作工具

/**
 * 批量插入订单明细
 * POST /api/order_items/batch
 * 支持两种请求体:
 * 1. [{orderId, productId, quantity, ...}, ...]  // 原有数组格式
 * 2. {orderId, items: [{productId, quantity, ...}, ...]} // 推荐前端格式
 */
router.post('/batch', async (req, res) => {
  let items = req.body;
  // 兼容前端传 {orderId, items}
  if (!Array.isArray(items)) {
    if (items.orderId && Array.isArray(items.items)) {
      items = items.items.map(item => ({
        ...item,
        orderId: items.orderId
      }));
    } else {
      return res.status(400).json({ success: false, message: '明细不能为空' });
    }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: '明细不能为空' });
  }
  try {
    for (const item of items) {
      await db.executeQuery(
        'INSERT INTO order_items (orderId, productId, quantity, weight, color, size, price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          item.orderId,
          item.productId,
          item.quantity ?? null,
          item.weight ?? null,
          item.color ?? null,
          item.size ?? null,
          item.price ?? null
        ]
      );
    }
    
    // 更新orders表中的总重量和总数量
    if (items.length > 0) {
      const orderId = items[0].orderId;
      
      // 计算总数量和总重量
      let totalQuantity = 0;
      let totalWeight = 0;
      
      for (const item of items) {
        if (item.quantity) totalQuantity += parseFloat(item.quantity) || 0;
        if (item.weight) totalWeight += parseFloat(item.weight) || 0;
      }
      
      // 更新订单总表
      await db.executeQuery(
        'UPDATE orders SET totalQuantity = ?, totalWeight = ? WHERE id = ?',
        [totalQuantity, totalWeight, orderId]
      );
    }
    
    res.json({ 
      success: true, 
      message: '批量插入成功',
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    console.error('批量插入明细失败:', err);
    res.status(500).json({ success: false, message: '批量插入失败', error: err.message });
  }
});

module.exports = router; 