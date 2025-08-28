// 统计数据相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * 获取统计数据
 * GET /api/stats
 */
router.get('/', async (req, res) => {
  try {
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;
    
    if (!orgId) {
      // 这个情况理论上不会发生，因为authenticate中间件会设置req.user.orgId
      // 但为了健壮性保留
      console.error('stats / 接口：req.user.orgId 为空');
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    // 获取当前日期
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 获取本月第一天
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // 构建SQL查询 - 修改为查询 send_orders 和 receive_orders 表
    const todaySendQuery = `
      SELECT COUNT(*) as count, SUM(total_weight) as weight 
      FROM send_orders 
      WHERE orgId = ? AND status = 1 
      AND DATE(created_at) = CURDATE()
    `;
    
    const todayReceiveQuery = `
      SELECT COUNT(*) as count, SUM(total_weight) as weight 
      FROM receive_orders 
      WHERE orgId = ? AND status = 1 
      AND DATE(created_at) = CURDATE()
    `;
    
    const monthlySendQuery = `
      SELECT SUM(total_weight) as weight 
      FROM send_orders 
      WHERE orgId = ? AND status = 1 
      AND created_at >= ?
    `;
    
    const monthlyReceiveQuery = `
      SELECT SUM(total_weight) as weight 
      FROM receive_orders 
      WHERE orgId = ? AND status = 1 
      AND created_at >= ?
    `;
    
    // 执行查询
    const [todaySendResult] = await db.executeQuery(todaySendQuery, [orgId]);
    const [todayReceiveResult] = await db.executeQuery(todayReceiveQuery, [orgId]);
    const [monthlySendResult] = await db.executeQuery(monthlySendQuery, [orgId, firstDayOfMonth]);
    const [monthlyReceiveResult] = await db.executeQuery(monthlyReceiveQuery, [orgId, firstDayOfMonth]);
    
    // 格式化响应数据
    const stats = {
      todaySendCount: todaySendResult[0]?.count || 0, // 确保结果是数组并取第一个元素
      todaySendWeight: parseFloat(todaySendResult[0]?.weight || 0), // 确保结果是数组并取第一个元素，并转为浮点数
      todayReceiveCount: todayReceiveResult[0]?.count || 0, // 确保结果是数组并取第一个元素
      todayReceiveWeight: parseFloat(todayReceiveResult[0]?.weight || 0), // 确保结果是数组并取第一个元素，并转为浮点数
      monthlySendWeight: parseFloat(monthlySendResult[0]?.weight || 0), // 确保结果是数组并取第一个元素，并转为浮点数
      monthlyReceiveWeight: parseFloat(monthlyReceiveResult[0]?.weight || 0) // 确保结果是数组并取第一个元素，并转为浮点数
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

/**
 * 获取指定日期的统计数据
 * GET /api/stats/for-date
 */
router.get('/for-date', async (req, res) => {
  try {
    // 先校验登录
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '请先登录'
      });
    }
    const orgId = req.user.orgId;
    const { date } = req.query;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '缺少组织ID参数'
      });
    }
    if (!date) {
      return res.status(400).json({
        success: false,
        message: '缺少日期参数'
      });
    }

    console.log('[Stats] 开始查询统计数据:', { orgId, date });

    // 使用单个查询获取所有数据
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM send_orders 
         WHERE orgId = ? AND status = 1 
         AND DATE(created_at) = DATE(?)) as sendCount,
        (SELECT COALESCE(SUM(total_weight), 0) FROM send_orders 
         WHERE orgId = ? AND status = 1 
         AND DATE(created_at) = DATE(?)) as sendWeight,
        (SELECT COUNT(*) FROM receive_orders 
         WHERE orgId = ? AND status = 1 
         AND DATE(created_at) = DATE(?)) as receiveCount,
        (SELECT COALESCE(SUM(total_weight), 0) FROM receive_orders 
         WHERE orgId = ? AND status = 1 
         AND DATE(created_at) = DATE(?)) as receiveWeight
    `;

    const [result] = await db.executeQuery(query, [
      orgId, date,
      orgId, date,
      orgId, date,
      orgId, date
    ]);

    console.log('[Stats] 查询结果:', result);

    const stats = {
      sendOrders: {
        count: result.sendCount || 0,
        totalWeight: parseFloat(result.sendWeight || 0).toFixed(2)
      },
      receiveOrders: {
        count: result.receiveCount || 0,
        totalWeight: parseFloat(result.receiveWeight || 0).toFixed(2)
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[Stats] 获取指定日期统计数据失败:', {
      error: err.message,
      stack: err.stack,
      query: req.query
    });
    
    // 根据错误类型返回适当的状态码和消息
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: '数据库连接失败',
        error: '服务暂时不可用'
      });
    }
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      return res.status(504).json({
        success: false,
        message: '数据库查询超时',
        error: '请稍后重试'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取指定日期统计数据失败',
      error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
    });
  }
});

/**
 * 获取今日统计数据
 * GET /api/stats/today
 */
router.get('/today', async (req, res) => {
  try {
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;
    
    if (!orgId) {
      console.error('stats /today 接口：req.user.orgId 为空');
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    console.log('[Stats Today] 开始查询今日统计数据, orgId:', orgId);
    
    // 构建SQL查询 - 查询今日数据
    const todaySendQuery = `
      SELECT COUNT(*) as count, COALESCE(SUM(total_weight), 0) as weight 
      FROM send_orders 
      WHERE orgId = ? AND status = 1 
      AND DATE(created_at) = CURDATE()
    `;
    
    const todayReceiveQuery = `
      SELECT COUNT(*) as count, COALESCE(SUM(total_weight), 0) as weight 
      FROM receive_orders 
      WHERE orgId = ? AND status = 1 
      AND DATE(created_at) = CURDATE()
    `;
    
    // 执行查询
    const [sendResult] = await db.executeQuery(todaySendQuery, [orgId]);
    const [receiveResult] = await db.executeQuery(todayReceiveQuery, [orgId]);
    
    console.log('[Stats Today] 查询结果:', { sendResult, receiveResult });
    
    // 格式化响应数据 - 匹配前端期望格式
    const stats = {
      sendCount: parseInt(sendResult[0]?.count || 0),
      sendWeight: parseFloat(sendResult[0]?.weight || 0),
      receiveCount: parseInt(receiveResult[0]?.count || 0),
      receiveWeight: parseFloat(receiveResult[0]?.weight || 0)
    };
    
    console.log('[Stats Today] 返回数据:', stats);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    console.error('[Stats Today] 获取今日统计数据失败:', err);
    res.status(500).json({
      success: false,
      message: '获取今日统计数据失败',
      error: err.message
    });
  }
});

// 新增：在线用户统计API，支持组织数据隔离
router.get('/online-users', async (req, res) => {
  try {
    // 定义活跃时间阈值（30分钟）
    const activeThreshold = parseInt(req.query.threshold) || 30;
    
    // 基础查询语句
    let query = `
      SELECT COUNT(DISTINCT s.user_id) as online_count
      FROM user_sessions s
      WHERE s.is_active = 1 
      AND s.last_activity >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `;
    
    let params = [activeThreshold];
    
    // 严格的组织数据隔离：非超级管理员只能看自己组织的数据
    if (!req.user.isSuperAdmin) {
      query += ' AND s.orgId = ?';
      params.push(req.user.orgId);
    } else if (req.query.orgId) {
      // 超级管理员可以指定查看特定组织
      query += ' AND s.orgId = ?';
      params.push(req.query.orgId);
    }
    
    const [result] = await db.executeQuery(query, params);
    
    // 获取详细的在线用户列表（可选）
    let onlineUserDetails = null;
    if (req.query.details === 'true') {
      let detailQuery = `
        SELECT 
          u.username,
          u.real_name,
          s.platform,
          s.last_activity,
          s.login_time,
          s.ip_address
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.is_active = 1 
        AND s.last_activity >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      `;
      
      let detailParams = [activeThreshold];
      
      // 组织数据隔离
      if (!req.user.isSuperAdmin) {
        detailQuery += ' AND s.orgId = ?';
        detailParams.push(req.user.orgId);
      } else if (req.query.orgId) {
        detailQuery += ' AND s.orgId = ?';
        detailParams.push(req.query.orgId);
      }
      
      detailQuery += ' ORDER BY s.last_activity DESC';
      
      onlineUserDetails = await db.executeQuery(detailQuery, detailParams);
    }
    
    res.json({
      success: true,
      data: {
        onlineCount: result.online_count || 0,
        activeThreshold: activeThreshold,
        orgId: req.user.isSuperAdmin ? (req.query.orgId || 'all') : req.user.orgId,
        timestamp: new Date().toISOString(),
        details: onlineUserDetails
      }
    });
  } catch (error) {
    console.error('获取在线用户统计失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 新增：登录统计API，基于operation_logs表
router.get('/login-stats', async (req, res) => {
  try {
    const timeRange = req.query.range || 'today'; // today, week, month
    let dateCondition = '';
    let params = [];
    
    switch (timeRange) {
      case 'today':
        dateCondition = 'AND DATE(created_at) = CURDATE()';
        break;
      case 'week':
        dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'month':
        dateCondition = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        dateCondition = 'AND DATE(created_at) = CURDATE()';
    }
    
    // 基础查询：统计登录次数 - 修复字段歧义问题
    let query = `
      SELECT COUNT(*) as login_count
      FROM operation_logs ol
      JOIN users u ON ol.user_id = u.id
      WHERE ol.action = 'login' AND ol.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `;
    
    // 根据时间范围调整查询条件
    switch (timeRange) {
      case 'today':
        query = `
          SELECT COUNT(*) as login_count
          FROM operation_logs ol
          JOIN users u ON ol.user_id = u.id
          WHERE ol.action = 'login' AND DATE(ol.created_at) = CURDATE()
        `;
        break;
      case 'week':
        query = `
          SELECT COUNT(*) as login_count
          FROM operation_logs ol
          JOIN users u ON ol.user_id = u.id
          WHERE ol.action = 'login' AND ol.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;
        break;
      case 'month':
        query = `
          SELECT COUNT(*) as login_count
          FROM operation_logs ol
          JOIN users u ON ol.user_id = u.id
          WHERE ol.action = 'login' AND ol.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        `;
        break;
    }
    
    // 组织数据隔离
    if (!req.user.isSuperAdmin) {
      query += ' AND u.orgId = ?';
      params.push(req.user.orgId);
    } else if (req.query.orgId) {
      query += ' AND u.orgId = ?';
      params.push(req.query.orgId);
    }
    
    const [result] = await db.executeQuery(query, params);
    
    res.json({
      success: true,
      data: {
        loginCount: result.login_count || 0,
        timeRange: timeRange,
        orgId: req.user.isSuperAdmin ? (req.query.orgId || 'all') : req.user.orgId,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取登录统计失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

module.exports = router; 