// 发出单相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取发出单列表
 * GET /api/send-orders
 */
router.get('/', async (req, res) => {
  try {
    const { 
      orgId, 
      status, 
      factoryId, 
      processId, 
      startDate, 
      endDate, 
      keyword,
      productCode,
      page,
      pageSize
    } = req.query;

    // 分页处理
    const skip = page ? (parseInt(page) - 1) * parseInt(pageSize || 20) : 0;
    const limit = pageSize ? parseInt(pageSize) : 20;
    
    // 修正查询实现，去除MongoDB风格的查询，改为MySQL风格
    let sql = 'SELECT * FROM orders WHERE orderType = ?';
    let params = ['send'];
    
    if (orgId) {
      sql += ' AND orgId = ?';
      params.push(orgId);
    }
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (factoryId) {
      sql += ' AND factoryId = ?';
      params.push(factoryId);
    }
    
    if (processId) {
      sql += ' AND processId = ?';
      params.push(processId);
    }
    
    if (startDate) {
      sql += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      sql += ' AND date <= ?';
      params.push(endDate);
    }
    
    if (keyword) {
      sql += ' AND (orderNo LIKE ? OR factoryName LIKE ?)';
      params.push(`%${keyword}%`);
      params.push(`%${keyword}%`);
    }
    
    if (productCode) {
      // 这里需要连接order_items和products表才能按产品编码筛选
      // 简化实现
      sql += ' AND id IN (SELECT orderId FROM order_items JOIN products ON order_items.productId = products.id WHERE products.code LIKE ?)';
      params.push(`%${productCode}%`);
    }
    
    // 添加排序条件，优先按日期排序
    sql += ' ORDER BY date DESC, createTime DESC';
    
    // 最后添加分页
    sql += ' LIMIT ?, ?';
    params.push(skip, limit);
    
    const orders = await db.executeQuery(sql, params);
    
    res.json({
      success: true,
      data: orders
    });
  } catch (err) {
    console.error('获取发出单列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取发出单列表失败',
      error: err.message
    });
  }
});

module.exports = router; 