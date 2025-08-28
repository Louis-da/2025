/**
 * 管理员监控路由
 * 提供系统性能监控、安全日志和统计信息
 */

const express = require('express');
const router = express.Router();
const { authenticate, isSuperAdmin } = require('../../middleware/auth');
const queryOptimizer = require('../../utils/queryOptimizer');
const db = require('../../db.js');

// 所有监控接口都需要超级管理员权限
router.use(authenticate);
router.use(isSuperAdmin);

/**
 * 获取系统性能统计
 * GET /api/admin/monitoring/performance
 */
router.get('/performance', async (req, res) => {
  try {
    const stats = queryOptimizer.getPerformanceStats();
    
    // 获取数据库连接池状态
    const poolStats = {
      totalConnections: db.pool._allConnections ? db.pool._allConnections.length : 0,
      freeConnections: db.pool._freeConnections ? db.pool._freeConnections.length : 0,
      activeConnections: (db.pool._allConnections ? db.pool._allConnections.length : 0) - 
                        (db.pool._freeConnections ? db.pool._freeConnections.length : 0)
    };
    
    // 获取系统内存使用情况
    const memoryUsage = process.memoryUsage();
    const systemStats = {
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },
      uptime: Math.round(process.uptime()) + ' 秒',
      nodeVersion: process.version
    };
    
    res.json({
      success: true,
      data: {
        query: stats,
        database: poolStats,
        system: systemStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[MONITORING] 获取性能统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取性能统计失败',
      error: error.message
    });
  }
});

/**
 * 获取组织活跃度统计
 * GET /api/admin/monitoring/org-activity
 */
router.get('/org-activity', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 默认查询最近7天
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // 查询各组织的活跃度
    const orgActivitySql = `
      SELECT 
        o.orgId,
        o.name as orgName,
        COUNT(DISTINCT so.id) as sendOrderCount,
        COUNT(DISTINCT ro.id) as receiveOrderCount,
        COALESCE(SUM(so.total_weight), 0) as totalSendWeight,
        COALESCE(SUM(ro.total_weight), 0) as totalReceiveWeight,
        COUNT(DISTINCT u.id) as activeUserCount
      FROM organizations o
      LEFT JOIN send_orders so ON o.orgId = so.orgId 
        AND so.created_at BETWEEN ? AND ?
      LEFT JOIN receive_orders ro ON o.orgId = ro.orgId 
        AND ro.created_at BETWEEN ? AND ?
      LEFT JOIN users u ON o.orgId = u.orgId 
        AND u.last_login BETWEEN ? AND ?
      WHERE o.status = 1
      GROUP BY o.orgId, o.name
      ORDER BY (COUNT(DISTINCT so.id) + COUNT(DISTINCT ro.id)) DESC
    `;
    
    const activity = await db.executeQuery(orgActivitySql, [
      start, end, start, end, start, end
    ]);
    
    res.json({
      success: true,
      data: {
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
        },
        organizations: activity,
        summary: {
          totalOrgs: activity.length,
          activeOrgs: activity.filter(org => 
            parseInt(org.sendOrderCount) + parseInt(org.receiveOrderCount) > 0
          ).length
        }
      }
    });
  } catch (error) {
    console.error('[MONITORING] 获取组织活跃度失败:', error);
    res.status(500).json({
      success: false,
      message: '获取组织活跃度失败',
      error: error.message
    });
  }
});

/**
 * 获取系统错误日志
 * GET /api/admin/monitoring/error-logs
 */
router.get('/error-logs', async (req, res) => {
  try {
    const { page = 1, pageSize = 50 } = req.query;
    
    // 这里可以连接到实际的日志系统
    // 目前返回一个示例结构
    const mockErrorLogs = [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: '数据库连接超时',
        orgId: '000',
        userId: 'system',
        stack: 'Error: Connection timeout...'
      }
    ];
    
    res.json({
      success: true,
      data: {
        logs: mockErrorLogs,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: mockErrorLogs.length
        }
      }
    });
  } catch (error) {
    console.error('[MONITORING] 获取错误日志失败:', error);
    res.status(500).json({
      success: false,
      message: '获取错误日志失败',
      error: error.message
    });
  }
});

/**
 * 清除指定组织的查询缓存
 * DELETE /api/admin/monitoring/cache/:orgId
 */
router.delete('/cache/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '组织ID不能为空'
      });
    }
    
    queryOptimizer.clearOrgCache(orgId);
    
    res.json({
      success: true,
      message: `已清除组织 ${orgId} 的查询缓存`
    });
  } catch (error) {
    console.error('[MONITORING] 清除缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清除缓存失败',
      error: error.message
    });
  }
});

/**
 * 重置性能统计
 * POST /api/admin/monitoring/reset-stats
 */
router.post('/reset-stats', async (req, res) => {
  try {
    queryOptimizer.resetStats();
    
    res.json({
      success: true,
      message: '性能统计已重置'
    });
  } catch (error) {
    console.error('[MONITORING] 重置统计失败:', error);
    res.status(500).json({
      success: false,
      message: '重置统计失败',
      error: error.message
    });
  }
});

/**
 * 获取数据库表状态
 * GET /api/admin/monitoring/table-status
 */
router.get('/table-status', async (req, res) => {
  try {
    const tableStatusSql = `
      SELECT 
        TABLE_NAME as tableName,
        TABLE_ROWS as rowCount,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as sizeInMB,
        ENGINE as engine,
        TABLE_COLLATION as collation
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_ROWS DESC
    `;
    
    const tableStatus = await db.executeQuery(tableStatusSql);
    
    res.json({
      success: true,
      data: {
        tables: tableStatus,
        totalTables: tableStatus.length,
        totalSizeInMB: tableStatus.reduce((sum, table) => sum + parseFloat(table.sizeInMB || 0), 0)
      }
    });
  } catch (error) {
    console.error('[MONITORING] 获取表状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取表状态失败',
      error: error.message
    });
  }
});

module.exports = router; 