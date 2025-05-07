// 收回单相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取收回单列表
 * GET /api/receive-orders
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

    // 构建查询条件
    const condition = {
      orderType: 'receive' // 确保只查询收回单
    };
    
    if (orgId) {
      condition.orgId = orgId;
    }
    
    if (status) {
      condition.status = status;
    }

    if (factoryId) {
      condition.factoryId = factoryId;
    }

    if (processId) {
      condition.processId = processId;
    }

    // 日期范围
    if (startDate || endDate) {
      condition.date = {};
      if (startDate) {
        condition.date.$gte = startDate;
      }
      if (endDate) {
        condition.date.$lte = endDate;
      }
    }

    // 关键词搜索
    if (keyword) {
      condition.$or = [
        { orderNo: { $regex: keyword, $options: 'i' } },
        { factoryName: { $regex: keyword, $options: 'i' } }
      ];
    }

    // 货号搜索
    if (productCode) {
      condition['products.code'] = { $regex: productCode, $options: 'i' };
    }

    // 分页处理
    const skip = page ? (parseInt(page) - 1) * parseInt(pageSize || 20) : 0;
    const limit = pageSize ? parseInt(pageSize) : 20;
    
    const orders = await db.orders.find(condition)
      .sort({ createTime: -1 })
      .skip(skip)
      .limit(limit);
    
    res.json(orders);
  } catch (err) {
    console.error('获取收回单列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取收回单列表失败',
      error: err.message
    });
  }
});

module.exports = router; 