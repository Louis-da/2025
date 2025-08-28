const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * 获取AI智能流水表数据
 * GET /api/flow-table-ai
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, factoryId, productId, processId } = req.query;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }

    // 构建查询条件
    let whereConditions = ['ft.orgId = ?'];
    let params = [orgId];

    if (startDate) {
      whereConditions.push('DATE(ft.date) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('DATE(ft.date) <= ?');
      params.push(endDate);
    }

    if (factoryId) {
      whereConditions.push('ft.factory_name = (SELECT name FROM factories WHERE id = ? AND orgId = ?)');
      params.push(factoryId, orgId);
    }

    if (productId) {
      whereConditions.push('ft.product_no = (SELECT productNo FROM products WHERE id = ? AND orgId = ?)');
      params.push(productId, orgId);
    }

    if (processId) {
      whereConditions.push('ft.process = (SELECT name FROM processes WHERE id = ? AND orgId = ?)');
      params.push(processId, orgId);
    }

    const whereClause = whereConditions.join(' AND ');

    // 查询流水数据 - 使用现有的flow_table视图
    const flowDataSql = `
      SELECT 
        ft.type,
        ft.order_no as orderNo,
        ft.factory_name as factory,
        ft.process,
        ft.product_no as productNo,
        ft.product_detail,
        ft.weight,
        ft.quantity,
        ft.fee,
        DATE_FORMAT(ft.date, '%Y-%m-%d') as date,
        ft.date as fullDate
      FROM flow_table ft
      WHERE ${whereClause}
      ORDER BY ft.date DESC, ft.order_no
      LIMIT 1000
    `;

    console.log('[AI Flow Table] 执行SQL:', flowDataSql);
    console.log('[AI Flow Table] 参数:', params);

    const rawData = await db.executeQuery(flowDataSql, params);

    // 处理数据，按订单号分组，计算发出和收回
    const processedData = processFlowData(rawData);

    res.json({
      success: true,
      data: processedData,
      total: processedData.length
    });

  } catch (error) {
    console.error('[AI Flow Table] 查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取流水数据失败',
      error: error.message
    });
  }
});

/**
 * 获取AI分析统计数据
 * GET /api/flow-table-ai/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate, factoryId } = req.query;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }

    // 构建查询条件
    let whereConditions = ['orgId = ?'];
    let params = [orgId];

    if (startDate) {
      whereConditions.push('DATE(created_at) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('DATE(created_at) <= ?');
      params.push(endDate);
    }

    if (factoryId) {
      whereConditions.push('factory_id = ?');
      params.push(factoryId);
    }

    const whereClause = whereConditions.join(' AND ');

    // 发出统计
    const sendStatsSql = `
      SELECT 
        COUNT(*) as totalOrders,
        SUM(total_quantity) as totalQuantity,
        SUM(total_weight) as totalWeight,
        SUM(total_fee) as totalFee,
        AVG(total_weight) as avgWeight
      FROM send_orders 
      WHERE ${whereClause} AND status = 1
    `;

    // 收回统计
    const receiveStatsSql = `
      SELECT 
        COUNT(*) as totalOrders,
        SUM(total_quantity) as totalQuantity,
        SUM(total_weight) as totalWeight,
        SUM(total_fee) as totalFee,
        AVG(total_weight) as avgWeight
      FROM receive_orders 
      WHERE ${whereClause} AND status = 1
    `;

    // 工厂统计
    const factoryStatsSql = `
      SELECT 
        f.name as factoryName,
        COUNT(DISTINCT so.id) as sendOrders,
        COUNT(DISTINCT ro.id) as receiveOrders,
        COALESCE(SUM(so.total_weight), 0) as sendWeight,
        COALESCE(SUM(ro.total_weight), 0) as receiveWeight
      FROM factories f
      LEFT JOIN send_orders so ON f.id = so.factory_id AND so.orgId = ? AND so.status = 1
      LEFT JOIN receive_orders ro ON f.id = ro.factory_id AND ro.orgId = ? AND ro.status = 1
      WHERE f.orgId = ?
      GROUP BY f.id, f.name
      HAVING sendOrders > 0 OR receiveOrders > 0
    `;

    const [sendStats] = await db.executeQuery(sendStatsSql, params);
    const [receiveStats] = await db.executeQuery(receiveStatsSql, params);
    const factoryStats = await db.executeQuery(factoryStatsSql, [orgId, orgId, orgId]);

    // 计算损耗率和效率指标
    const analytics = {
      summary: {
        totalSendWeight: parseFloat(sendStats[0]?.totalWeight || 0),
        totalReceiveWeight: parseFloat(receiveStats[0]?.totalWeight || 0),
        totalSendOrders: parseInt(sendStats[0]?.totalOrders || 0),
        totalReceiveOrders: parseInt(receiveStats[0]?.totalOrders || 0),
        avgLossRate: calculateLossRate(sendStats[0]?.totalWeight, receiveStats[0]?.totalWeight),
        efficiency: calculateEfficiency(sendStats[0], receiveStats[0])
      },
      factories: factoryStats.map(factory => ({
        name: factory.factoryName,
        sendWeight: parseFloat(factory.sendWeight || 0),
        receiveWeight: parseFloat(factory.receiveWeight || 0),
        lossRate: calculateLossRate(factory.sendWeight, factory.receiveWeight),
        orders: {
          send: parseInt(factory.sendOrders || 0),
          receive: parseInt(factory.receiveOrders || 0)
        }
      }))
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[AI Flow Table Analytics] 查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分析数据失败',
      error: error.message
    });
  }
});

/**
 * 获取异常检测数据
 * GET /api/flow-table-ai/anomalies
 */
router.get('/anomalies', async (req, res) => {
  try {
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }

    // 查询可能的异常情况
    const anomaliesSql = `
      SELECT 
        'high_loss' as type,
        'high' as severity,
        CONCAT(f.name, ' 损耗率异常') as message,
        CONCAT('发出重量: ', so.total_weight, 'kg, 收回重量: ', COALESCE(ro.total_weight, 0), 'kg') as details,
        so.created_at as date
      FROM send_orders so
      LEFT JOIN receive_orders ro ON so.factory_id = ro.factory_id 
        AND so.process_id = ro.process_id 
        AND DATE(so.created_at) = DATE(ro.created_at)
        AND ro.orgId = so.orgId
      LEFT JOIN factories f ON so.factory_id = f.id
      WHERE so.orgId = ?
        AND so.status = 1
        AND so.total_weight > 0
        AND (
          (ro.total_weight IS NULL) OR 
          ((so.total_weight - COALESCE(ro.total_weight, 0)) / so.total_weight * 100 > 15)
        )
        AND so.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      
      UNION ALL
      
      SELECT 
        'long_cycle' as type,
        'medium' as severity,
        CONCAT(f.name, ' 加工周期过长') as message,
        CONCAT('发出日期: ', DATE_FORMAT(so.created_at, '%Y-%m-%d'), ', 已超过7天未收回') as details,
        so.created_at as date
      FROM send_orders so
      LEFT JOIN receive_orders ro ON so.factory_id = ro.factory_id 
        AND so.process_id = ro.process_id 
        AND ro.created_at > so.created_at
        AND ro.orgId = so.orgId
      LEFT JOIN factories f ON so.factory_id = f.id
      WHERE so.orgId = ?
        AND so.status = 1
        AND ro.id IS NULL
        AND so.created_at <= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND so.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      
      ORDER BY date DESC
      LIMIT 20
    `;

    const anomalies = await db.executeQuery(anomaliesSql, [orgId, orgId]);

    res.json({
      success: true,
      data: anomalies
    });

  } catch (error) {
    console.error('[AI Flow Table Anomalies] 查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取异常数据失败',
      error: error.message
    });
  }
});

// 辅助函数：处理流水数据
function processFlowData(rawData) {
  const orderMap = new Map();

  // 按订单号分组
  rawData.forEach(item => {
    const key = `${item.orderNo}_${item.factory}_${item.process}_${item.productNo}`;
    
    if (!orderMap.has(key)) {
      orderMap.set(key, {
        orderNo: item.orderNo,
        factory: item.factory,
        process: item.process,
        productNo: item.productNo,
        productDetail: item.product_detail,
        sendWeight: 0,
        receiveWeight: 0,
        sendQuantity: 0,
        receiveQuantity: 0,
        sendDate: null,
        receiveDate: null,
        fee: 0
      });
    }

    const order = orderMap.get(key);

    if (item.type === 'send') {
      order.sendWeight += parseFloat(item.weight || 0);
      order.sendQuantity += parseInt(item.quantity || 0);
      order.sendDate = item.date;
      order.fee += parseFloat(item.fee || 0);
    } else if (item.type === 'receive') {
      order.receiveWeight += parseFloat(item.weight || 0);
      order.receiveQuantity += parseInt(item.quantity || 0);
      order.receiveDate = item.date;
    }
  });

  // 转换为数组并计算损耗率
  return Array.from(orderMap.values()).map(order => ({
    ...order,
    lossRate: calculateLossRate(order.sendWeight, order.receiveWeight),
    status: determineStatus(order),
    riskLevel: assessRisk(order)
  }));
}

// 计算损耗率
function calculateLossRate(sendWeight, receiveWeight) {
  if (!sendWeight || sendWeight === 0) return 0;
  const lossRate = ((sendWeight - (receiveWeight || 0)) / sendWeight * 100);
  return Math.max(0, lossRate).toFixed(2);
}

// 计算效率
function calculateEfficiency(sendStats, receiveStats) {
  const sendWeight = parseFloat(sendStats?.totalWeight || 0);
  const receiveWeight = parseFloat(receiveStats?.totalWeight || 0);
  
  if (sendWeight === 0) return 100;
  
  const efficiency = (receiveWeight / sendWeight * 100);
  return Math.min(100, efficiency).toFixed(1);
}

// 确定状态
function determineStatus(order) {
  if (!order.receiveDate) return 'processing';
  
  const lossRate = parseFloat(order.lossRate);
  if (lossRate > 15) return 'warning';
  if (lossRate > 8) return 'attention';
  
  return 'completed';
}

// 评估风险等级
function assessRisk(order) {
  const lossRate = parseFloat(order.lossRate);
  
  if (lossRate > 15) return 'high';
  if (lossRate > 8) return 'medium';
  
  // 检查时间风险
  if (order.sendDate && !order.receiveDate) {
    const daysDiff = Math.floor((new Date() - new Date(order.sendDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) return 'medium';
  }
  
  return 'low';
}

module.exports = router; 