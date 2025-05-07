// 统计数据相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取统计数据
 * GET /api/stats
 */
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '缺少组织ID参数'
      });
    }
    
    // 获取当前日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取本月第一天
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // 构建SQL查询
    const todaySendQuery = `
      SELECT COUNT(*) as count, SUM(quantity) as weight 
      FROM orders 
      WHERE orgId = ? AND status != 'cancelled' AND orderType = 'send' 
      AND DATE(createTime) = CURDATE()
    `;
    
    const todayReceiveQuery = `
      SELECT COUNT(*) as count, SUM(quantity) as weight 
      FROM orders 
      WHERE orgId = ? AND status != 'cancelled' AND orderType = 'receive' 
      AND DATE(createTime) = CURDATE()
    `;
    
    const monthlySendQuery = `
      SELECT SUM(quantity) as weight 
      FROM orders 
      WHERE orgId = ? AND status != 'cancelled' AND orderType = 'send' 
      AND createTime >= ?
    `;
    
    const monthlyReceiveQuery = `
      SELECT SUM(quantity) as weight 
      FROM orders 
      WHERE orgId = ? AND status != 'cancelled' AND orderType = 'receive' 
      AND createTime >= ?
    `;
    
    // 执行查询
    const [todaySendResult] = await db.executeQuery(todaySendQuery, [orgId]);
    const [todayReceiveResult] = await db.executeQuery(todayReceiveQuery, [orgId]);
    const [monthlySendResult] = await db.executeQuery(monthlySendQuery, [orgId, firstDayOfMonth]);
    const [monthlyReceiveResult] = await db.executeQuery(monthlyReceiveQuery, [orgId, firstDayOfMonth]);
    
    // 格式化响应数据
    const stats = {
      todaySendCount: todaySendResult.count || 0,
      todaySendWeight: todaySendResult.weight || 0,
      todayReceiveCount: todayReceiveResult.count || 0,
      todayReceiveWeight: todayReceiveResult.weight || 0,
      monthlySendWeight: monthlySendResult.weight || 0,
      monthlyReceiveWeight: monthlyReceiveResult.weight || 0
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('获取统计数据失败:', err);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: err.message
    });
  }
});

module.exports = router; 