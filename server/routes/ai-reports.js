const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { authenticate } = require('../middleware/auth');
const { processImageUrl, processImageUrlSync } = require('../utils/imageProcessor');

router.use(authenticate);

/**
 * 获取AI智能流水表数据 - 安全版本
 * GET /api/ai-reports
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, factoryId, productId, processId, productNo } = req.query;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }

    console.log('[AI Reports Secure] 查询参数:', { orgId, startDate, endDate, factoryId, productId, processId, productNo });

    // 安全的流水数据查询 - 确保严格的数据隔离
    const flowDataSql = `
      SELECT 
        'send' as type,
        so.order_no as orderNo,
        f.name as factory,
        p.name as process,
        soi.product_no as productNo,
        CONCAT(COALESCE(c.name, ''), ' ', COALESCE(s.name, '')) as product_detail,
        soi.weight,
        soi.quantity,
        soi.fee,
        DATE_FORMAT(so.created_at, '%Y-%m-%d') as date,
        so.created_at as fullDate
      FROM send_orders so
      JOIN send_order_items soi ON so.id = soi.send_order_id
      JOIN factories f ON so.factory_id = f.id
      JOIN processes p ON so.process_id = p.id
      LEFT JOIN colors c ON soi.color_id = c.id
      LEFT JOIN sizes s ON soi.size_id = s.id
      WHERE so.orgId = ? 
        AND f.orgId = ? 
        AND p.orgId = ? 
        AND so.status = 1
        ${startDate ? 'AND DATE(so.created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(so.created_at) <= ?' : ''}
        ${factoryId ? 'AND so.factory_id = ?' : ''}
        ${productNo ? 'AND soi.product_no = ?' : ''}
        ${productId ? 'AND soi.product_id = ?' : ''}
        ${processId ? 'AND so.process_id = ?' : ''}

      UNION ALL

      SELECT 
        'receive' as type,
        ro.order_no as orderNo,
        f.name as factory,
        p.name as process,
        roi.product_no as productNo,
        CONCAT(COALESCE(c.name, ''), ' ', COALESCE(s.name, '')) as product_detail,
        roi.weight,
        roi.quantity,
        roi.fee,
        DATE_FORMAT(ro.created_at, '%Y-%m-%d') as date,
        ro.created_at as fullDate
      FROM receive_orders ro
      JOIN receive_order_items roi ON ro.id = roi.receive_order_id
      JOIN factories f ON ro.factory_id = f.id
      JOIN processes p ON ro.process_id = p.id
      LEFT JOIN colors c ON roi.color_id = c.id
      LEFT JOIN sizes s ON roi.size_id = s.id
      WHERE ro.orgId = ? 
        AND f.orgId = ? 
        AND p.orgId = ? 
        AND ro.status = 1
        ${startDate ? 'AND DATE(ro.created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(ro.created_at) <= ?' : ''}
        ${factoryId ? 'AND ro.factory_id = ?' : ''}
        ${productNo ? 'AND roi.product_no = ?' : ''}
        ${productId ? 'AND roi.product_id = ?' : ''}
        ${processId ? 'AND ro.process_id = ?' : ''}
      
      ORDER BY fullDate DESC, orderNo
      LIMIT 1000
    `;

    // 构建参数数组 - 确保每个orgId都正确传递
    const queryParams = [orgId, orgId, orgId]; // send部分的orgId参数
    if (startDate) queryParams.push(startDate);
    if (endDate) queryParams.push(endDate);
    if (factoryId) queryParams.push(factoryId);
    if (productNo) queryParams.push(productNo);
    if (productId) queryParams.push(productId);
    if (processId) queryParams.push(processId);
    
    // receive部分的orgId参数
    queryParams.push(orgId, orgId, orgId);
    if (startDate) queryParams.push(startDate);
    if (endDate) queryParams.push(endDate);
    if (factoryId) queryParams.push(factoryId);
    if (productNo) queryParams.push(productNo);
    if (productId) queryParams.push(productId);
    if (processId) queryParams.push(processId);

    console.log('[AI Reports Secure] 执行SQL参数:', queryParams);

    const rawData = await db.executeQuery(flowDataSql, queryParams);

    // 处理数据，按订单号分组，计算发出和收回
    const processedData = processFlowData(rawData);

    res.json({
      success: true,
      data: processedData,
      total: processedData.length
    });

  } catch (error) {
    console.error('[AI Reports Secure] 查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取流水数据失败',
      error: error.message
    });
  }
});

/**
 * 获取损耗率排行榜数据
 * GET /api/ai-reports/loss-ranking
 */
router.get('/loss-ranking', async (req, res) => {
  try {
    const { startDate, endDate, factoryId, productNo, mode = 'product', qualified, limit } = req.query;
    const orgId = req.user.orgId;
    
    console.log('[Loss Ranking] 请求参数:', { 
      orgId, startDate, endDate, factoryId, productNo, mode, qualified, limit 
    });
    
    // 参数验证
    if (!orgId) {
      return res.status(400).json({ success: false, message: '无法获取组织ID' });
    }

    // 日期格式验证
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({ success: false, message: '开始日期格式无效' });
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ success: false, message: '结束日期格式无效' });
    }

    // 数值参数验证
    if (factoryId && isNaN(parseInt(factoryId))) {
      return res.status(400).json({ success: false, message: '工厂ID格式无效' });
    }
    
    const queryLimit = limit ? Math.min(parseInt(limit), 50) : 50;
    
    // 货品模式
    if (mode === 'product') {
      const sql = `
        WITH send_agg AS (
          SELECT
            soi.product_no,
            SUM(CASE WHEN so.status = 1 THEN soi.weight ELSE 0 END) AS totalSendWeight,
            COUNT(DISTINCT CASE WHEN so.status = 1 THEN so.factory_id ELSE NULL END) AS factoryCount,
            MAX(CASE WHEN so.status = 1 THEN so.created_at ELSE NULL END) AS lastSendDate
          FROM send_order_items soi
          JOIN send_orders so ON soi.send_order_id = so.id
          WHERE so.orgId = ?
            ${startDate ? 'AND DATE(so.created_at) >= ?' : ''}
            ${endDate ? 'AND DATE(so.created_at) <= ?' : ''}
            ${factoryId ? 'AND so.factory_id = ?' : ''}
            ${productNo ? 'AND soi.product_no = ?' : ''}
          GROUP BY soi.product_no
          HAVING totalSendWeight > 0
        ),
        receive_agg AS (
          SELECT
            roi.product_no,
            SUM(CASE WHEN ro.status = 1 THEN roi.weight ELSE 0 END) AS totalReceiveWeight
          FROM receive_order_items roi
          JOIN receive_orders ro ON roi.receive_order_id = ro.id
          WHERE ro.orgId = ?
            ${startDate ? 'AND DATE(ro.created_at) >= ?' : ''}
            ${endDate ? 'AND DATE(ro.created_at) <= ?' : ''}
            ${factoryId ? 'AND ro.factory_id = ?' : ''}
            ${productNo ? 'AND roi.product_no = ?' : ''}
          GROUP BY roi.product_no
        )
        SELECT
          s.product_no as productNo,
          prod.name as productName,
          prod.image as productImage,
          s.totalSendWeight,
          COALESCE(r.totalReceiveWeight, 0) AS totalReceiveWeight,
          (s.totalSendWeight - COALESCE(r.totalReceiveWeight, 0)) AS totalLossWeight,
          CASE WHEN s.totalSendWeight > 0 
               THEN ROUND((s.totalSendWeight - COALESCE(r.totalReceiveWeight, 0)) / s.totalSendWeight * 100, 2)
               ELSE 0 
          END AS lossRate,
          s.factoryCount,
          s.lastSendDate as lastActiveDate
        FROM send_agg s
        LEFT JOIN receive_agg r ON s.product_no = r.product_no
        LEFT JOIN products prod ON s.product_no = prod.code AND prod.orgId = ?
        ${qualified === 'true' ? 'HAVING lossRate <= 2.0' : ''}
        ORDER BY lossRate DESC, s.totalSendWeight DESC
        LIMIT ${queryLimit}
      `;

      // 构建参数数组
      let params = [orgId];  // send_agg的orgId
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      if (factoryId) params.push(factoryId);
      if (productNo) params.push(productNo);
      
      params.push(orgId);  // receive_agg的orgId
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      if (factoryId) params.push(factoryId);
      if (productNo) params.push(productNo);
      
      params.push(orgId);  // products表的orgId

      console.log('[Loss Ranking] SQL:', sql);
      console.log('[Loss Ranking] 参数:', params);

      try {
        const data = await db.executeQuery(sql, params);
        console.log(`[Loss Ranking] 查询成功，返回 ${data.length} 条记录`);
        
        // 记录原始数据的关键统计信息
        if (data.length > 0) {
          console.log('[Loss Ranking] 数据范围统计:', {
            lossRateRange: {
              min: Math.min(...data.map(item => parseFloat(item.lossRate) || 0)).toFixed(2),
              max: Math.max(...data.map(item => parseFloat(item.lossRate) || 0)).toFixed(2)
            },
            weightRange: {
              totalSend: data.reduce((sum, item) => sum + (parseFloat(item.totalSendWeight) || 0), 0).toFixed(2),
              totalReceive: data.reduce((sum, item) => sum + (parseFloat(item.totalReceiveWeight) || 0), 0).toFixed(2)
            }
          });
        }
        
        // 格式化最近动态
        const now = new Date();
        data.forEach((item, i) => {
          // 数据验证和修复
          item.totalSendWeight = Math.max(0, parseFloat(item.totalSendWeight) || 0);
          item.totalReceiveWeight = Math.max(0, parseFloat(item.totalReceiveWeight) || 0);
          item.totalLossWeight = Math.max(0, parseFloat(item.totalLossWeight) || 0);
          item.lossRate = parseFloat(item.lossRate) || 0;
          item.factoryCount = Math.max(0, parseInt(item.factoryCount) || 0);
          
          // 重新验证损耗率计算的准确性
          if (item.totalSendWeight > 0) {
            const calculatedLossRate = ((item.totalSendWeight - item.totalReceiveWeight) / item.totalSendWeight * 100);
            item.lossRate = parseFloat(calculatedLossRate.toFixed(2));
          } else {
            item.lossRate = 0;
          }
          
          if (item.lastActiveDate) {
            const diffDays = Math.floor((now - new Date(item.lastActiveDate)) / (1000 * 60 * 60 * 24));
            item.lastActiveText = diffDays === 0 ? '今天' : (diffDays === 1 ? '昨天' : `${diffDays}天前`);
          } else {
            item.lastActiveText = '无动态';
          }
          item.rank = i + 1;
          
          // 损耗率等级
          const loss = Math.abs(item.lossRate);
          if (loss > 15) {
            item.level = 'red';
          } else if (loss > 8) {
            item.level = 'orange';
          } else if (loss > 2) {
            item.level = 'yellow';
          } else {
            item.level = 'green';
          }
        });
        
        res.json({ 
          success: true, 
          data,
          meta: {
            total: data.length,
            limit: queryLimit,
            qualified: qualified === 'true'
          }
        });
      } catch (queryError) {
        console.error('[Loss Ranking] 查询执行错误:', queryError);
        throw queryError;
      }
    } else {
      // 工厂模式 - 重构为更简单稳定的查询
      const sql = `
        WITH send_agg AS (
          SELECT
            so.factory_id,
            SUM(CASE WHEN so.status = 1 THEN soi.weight ELSE 0 END) AS totalSendWeight,
            COUNT(DISTINCT CASE WHEN so.status = 1 THEN soi.product_no ELSE NULL END) AS productCount,
            MAX(so.created_at) AS lastSendDate
          FROM send_orders so
          JOIN send_order_items soi ON so.id = soi.send_order_id
          WHERE so.orgId = ?
            ${startDate ? 'AND DATE(so.created_at) >= ?' : ''}
            ${endDate ? 'AND DATE(so.created_at) <= ?' : ''}
            ${factoryId ? 'AND so.factory_id = ?' : ''}
            ${productNo ? 'AND soi.product_no = ?' : ''}
          GROUP BY so.factory_id
        ),
        receive_agg AS (
          SELECT
            ro.factory_id,
            SUM(CASE WHEN ro.status = 1 THEN roi.weight ELSE 0 END) AS totalReceiveWeight
          FROM receive_order_items roi
          JOIN receive_orders ro ON roi.receive_order_id = ro.id
          WHERE ro.orgId = ?
            ${startDate ? 'AND DATE(ro.created_at) >= ?' : ''}
            ${endDate ? 'AND DATE(ro.created_at) <= ?' : ''}
            ${factoryId ? 'AND ro.factory_id = ?' : ''}
            ${productNo ? 'AND roi.product_no = ?' : ''}
          GROUP BY ro.factory_id
        )
        SELECT
          f.id as factoryId,
          f.name as factoryName,
          COALESCE(s.totalSendWeight, 0) as totalSendWeight,
          COALESCE(r.totalReceiveWeight, 0) as totalReceiveWeight,
          (COALESCE(s.totalSendWeight, 0) - COALESCE(r.totalReceiveWeight, 0)) as totalLossWeight,
          CASE WHEN COALESCE(s.totalSendWeight, 0) > 0 
               THEN ROUND((COALESCE(s.totalSendWeight, 0) - COALESCE(r.totalReceiveWeight, 0)) / COALESCE(s.totalSendWeight, 0) * 100, 2)
               ELSE 0 
          END AS lossRate,
          COALESCE(s.productCount, 0) as productCount,
          s.lastSendDate as lastActiveDate
        FROM factories f
        LEFT JOIN send_agg s ON f.id = s.factory_id
        LEFT JOIN receive_agg r ON f.id = r.factory_id
        WHERE f.orgId = ?
        ${factoryId ? 'AND f.id = ?' : ''}
        HAVING totalSendWeight > 0 OR totalReceiveWeight > 0
        ORDER BY lossRate DESC, totalSendWeight DESC
        LIMIT ${queryLimit}
      `;

      // 构建参数数组 - 简化参数处理
      let params = [orgId];  // send_agg的orgId
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      if (factoryId) params.push(factoryId);
      if (productNo) params.push(productNo);
      
      params.push(orgId);  // receive_agg的orgId
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      if (factoryId) params.push(factoryId);
      if (productNo) params.push(productNo);
      
      params.push(orgId);  // factories表的orgId
      if (factoryId) params.push(factoryId);

      console.log('[Loss Ranking Factory] SQL:', sql);
      console.log('[Loss Ranking Factory] 参数:', params);

      try {
        const data = await db.executeQuery(sql, params);
        console.log(`[Loss Ranking Factory] 查询成功，返回 ${data.length} 条记录`);
        
        // 记录原始数据的关键统计信息
        if (data.length > 0) {
          console.log('[Loss Ranking Factory] 数据范围统计:', {
            lossRateRange: {
              min: Math.min(...data.map(item => parseFloat(item.lossRate) || 0)).toFixed(2),
              max: Math.max(...data.map(item => parseFloat(item.lossRate) || 0)).toFixed(2)
            },
            weightRange: {
              totalSend: data.reduce((sum, item) => sum + (parseFloat(item.totalSendWeight) || 0), 0).toFixed(2),
              totalReceive: data.reduce((sum, item) => sum + (parseFloat(item.totalReceiveWeight) || 0), 0).toFixed(2)
            }
          });
        }
        
        // 格式化最近动态
        const now = new Date();
        data.forEach((item, i) => {
          // 数据验证和修复
          item.totalSendWeight = Math.max(0, parseFloat(item.totalSendWeight) || 0);
          item.totalReceiveWeight = Math.max(0, parseFloat(item.totalReceiveWeight) || 0);
          item.totalLossWeight = Math.max(0, parseFloat(item.totalLossWeight) || 0);
          item.lossRate = parseFloat(item.lossRate) || 0;
          item.productCount = Math.max(0, parseInt(item.productCount) || 0);
          
          // 重新验证损耗率计算的准确性
          if (item.totalSendWeight > 0) {
            const calculatedLossRate = ((item.totalSendWeight - item.totalReceiveWeight) / item.totalSendWeight * 100);
            item.lossRate = parseFloat(calculatedLossRate.toFixed(2));
          } else {
            item.lossRate = 0;
          }
          
          if (item.lastActiveDate) {
            const diffDays = Math.floor((now - new Date(item.lastActiveDate)) / (1000 * 60 * 60 * 24));
            item.lastActiveText = diffDays === 0 ? '今天' : (diffDays === 1 ? '昨天' : `${diffDays}天前`);
          } else {
            item.lastActiveText = '无动态';
          }
          item.rank = i + 1;
          
          // 损耗率等级
          const loss = Math.abs(item.lossRate);
          if (loss > 15) {
            item.level = 'red';
          } else if (loss > 8) {
            item.level = 'orange';
          } else if (loss > 2) {
            item.level = 'yellow';
          } else {
            item.level = 'green';
          }
        });
        
        res.json({ 
          success: true, 
          data,
          meta: {
            total: data.length,
            limit: queryLimit,
            qualified: qualified === 'true'
          }
        });
      } catch (queryError) {
        console.error('[Loss Ranking Factory] 查询执行错误:', queryError);
        throw queryError;
      }
    }
  } catch (error) {
    console.error('[Loss Ranking] 错误:', error);
    console.error('[Loss Ranking] 错误堆栈:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: '获取损耗率排行失败', 
      error: error.message,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 获取活跃排行数据 - 科学重构版本
 * GET /api/ai-reports/active-rankings
 */
router.get('/active-rankings', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;
    const orgId = req.user.orgId;
    
    console.log('[Active Rankings] 请求参数:', { orgId, startDate, endDate, limit });
    
    if (!orgId) {
      return res.status(400).json({ success: false, message: '无法获取组织ID' });
    }

    // 验证日期格式
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return res.status(400).json({ success: false, message: '开始日期格式无效' });
    }
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ success: false, message: '结束日期格式无效' });
    }

    const queryLimit = Math.max(1, Math.min(parseInt(limit) || 10, 50));
    
    // 构建发出订单的WHERE条件
    let sendWhereConditions = ['so.orgId = ?'];
    let sendParams = [orgId];
    
    if (startDate) { 
      sendWhereConditions.push('DATE(so.created_at) >= ?'); 
      sendParams.push(startDate); 
    }
    if (endDate) { 
      sendWhereConditions.push('DATE(so.created_at) <= ?'); 
      sendParams.push(endDate); 
    }

    const sendWhereClause = sendWhereConditions.join(' AND ');

    // 构建收回订单的WHERE条件
    let receiveWhereConditions = ['ro.orgId = ?'];
    let receiveParams = [orgId];
    
    if (startDate) { 
      receiveWhereConditions.push('DATE(ro.created_at) >= ?'); 
      receiveParams.push(startDate); 
    }
    if (endDate) { 
      receiveWhereConditions.push('DATE(ro.created_at) <= ?'); 
      receiveParams.push(endDate); 
    }

    const receiveWhereClause = receiveWhereConditions.join(' AND ');

    // 货品活跃排行SQL - 综合发出和收回数据
    const productSql = `
      WITH send_stats AS (
        SELECT 
          soi.product_no,
          COUNT(DISTINCT so.id) as sendOrderCount,
          SUM(soi.weight) as totalSendWeight,
          SUM(soi.quantity) as totalSendQuantity,
          COUNT(DISTINCT so.factory_id) as sendFactoryCount,
          MAX(so.created_at) as lastSendDate,
          AVG(DATEDIFF(CURDATE(), DATE(so.created_at))) as avgSendDaysAgo
        FROM send_order_items soi
        JOIN send_orders so ON soi.send_order_id = so.id
        WHERE ${sendWhereClause} AND so.status = 1
        GROUP BY soi.product_no
      ),
      receive_stats AS (
        SELECT 
          roi.product_no,
          COUNT(DISTINCT ro.id) as receiveOrderCount,
          SUM(roi.weight) as totalReceiveWeight,
          SUM(roi.quantity) as totalReceiveQuantity,
          COUNT(DISTINCT ro.factory_id) as receiveFactoryCount,
          MAX(ro.created_at) as lastReceiveDate,
          AVG(DATEDIFF(CURDATE(), DATE(ro.created_at))) as avgReceiveDaysAgo
        FROM receive_order_items roi
        JOIN receive_orders ro ON roi.receive_order_id = ro.id
        WHERE ${receiveWhereClause} AND ro.status = 1
        GROUP BY roi.product_no
      ),
      combined_stats AS (
        SELECT 
          s.product_no,
          s.sendOrderCount,
          s.totalSendWeight,
          s.totalSendQuantity,
          s.sendFactoryCount,
          s.lastSendDate,
          s.avgSendDaysAgo,
          COALESCE(r.receiveOrderCount, 0) as receiveOrderCount,
          COALESCE(r.totalReceiveWeight, 0) as totalReceiveWeight,
          COALESCE(r.totalReceiveQuantity, 0) as totalReceiveQuantity,
          COALESCE(r.receiveFactoryCount, 0) as receiveFactoryCount,
          r.lastReceiveDate,
          COALESCE(r.avgReceiveDaysAgo, 999) as avgReceiveDaysAgo
        FROM send_stats s
        LEFT JOIN receive_stats r ON s.product_no = r.product_no
        
        UNION ALL
        
        SELECT 
          r.product_no,
          COALESCE(s.sendOrderCount, 0) as sendOrderCount,
          COALESCE(s.totalSendWeight, 0) as totalSendWeight,
          COALESCE(s.totalSendQuantity, 0) as totalSendQuantity,
          COALESCE(s.sendFactoryCount, 0) as sendFactoryCount,
          s.lastSendDate,
          COALESCE(s.avgSendDaysAgo, 999) as avgSendDaysAgo,
          r.receiveOrderCount,
          r.totalReceiveWeight,
          r.totalReceiveQuantity,
          r.receiveFactoryCount,
          r.lastReceiveDate,
          r.avgReceiveDaysAgo
        FROM receive_stats r
        LEFT JOIN send_stats s ON r.product_no = s.product_no
        WHERE s.product_no IS NULL
      )
      SELECT 
        cs.product_no,
        p.name as productName,
        p.image as productImage,
        
        -- 发出指标
        cs.sendOrderCount,
        cs.totalSendWeight,
        cs.totalSendQuantity,
        cs.sendFactoryCount,
        cs.lastSendDate,
        cs.avgSendDaysAgo,
        
        -- 收回指标  
        cs.receiveOrderCount,
        cs.totalReceiveWeight,
        cs.totalReceiveQuantity,
        cs.receiveFactoryCount,
        cs.lastReceiveDate,
        cs.avgReceiveDaysAgo,
        
        -- 综合指标
        (cs.sendOrderCount + cs.receiveOrderCount) as totalTransactions,
        (cs.totalSendWeight + cs.totalReceiveWeight) as totalWeight,
        GREATEST(COALESCE(cs.lastSendDate, '1900-01-01'), COALESCE(cs.lastReceiveDate, '1900-01-01')) as lastActiveDate,
        
        -- 业务完整性指标
        CASE WHEN cs.sendOrderCount > 0 
             THEN cs.receiveOrderCount / cs.sendOrderCount 
             ELSE 0 
        END as completionRate,
        
        CASE WHEN cs.totalSendWeight > 0 
             THEN cs.totalReceiveWeight / cs.totalSendWeight 
             ELSE 0 
        END as weightCompletionRate
        
      FROM combined_stats cs
      LEFT JOIN products p ON cs.product_no = p.code AND p.orgId = ?
      WHERE (cs.sendOrderCount + cs.receiveOrderCount) > 0
      ORDER BY totalTransactions DESC, totalWeight DESC
      LIMIT ${queryLimit}
    `;

    // 工厂活跃排行SQL - 综合发出和收回数据
    const factorySql = `
      WITH send_stats AS (
        SELECT 
          so.factory_id,
          COUNT(DISTINCT so.id) as sendOrderCount,
          SUM(soi.weight) as totalSendWeight,
          SUM(soi.quantity) as totalSendQuantity,
          COUNT(DISTINCT soi.product_no) as sendProductCount,
          MAX(so.created_at) as lastSendDate,
          AVG(DATEDIFF(CURDATE(), DATE(so.created_at))) as avgSendDaysAgo
        FROM send_orders so
        JOIN send_order_items soi ON so.id = soi.send_order_id
        WHERE ${sendWhereClause} AND so.status = 1
        GROUP BY so.factory_id
      ),
      receive_stats AS (
        SELECT 
          ro.factory_id,
          COUNT(DISTINCT ro.id) as receiveOrderCount,
          SUM(roi.weight) as totalReceiveWeight,
          SUM(roi.quantity) as totalReceiveQuantity,
          COUNT(DISTINCT roi.product_no) as receiveProductCount,
          MAX(ro.created_at) as lastReceiveDate,
          AVG(DATEDIFF(CURDATE(), DATE(ro.created_at))) as avgReceiveDaysAgo
        FROM receive_orders ro
        JOIN receive_order_items roi ON ro.id = roi.receive_order_id
        WHERE ${receiveWhereClause} AND ro.status = 1
        GROUP BY ro.factory_id
      ),
      combined_stats AS (
        SELECT 
          s.factory_id,
          s.sendOrderCount,
          s.totalSendWeight,
          s.totalSendQuantity,
          s.sendProductCount,
          s.lastSendDate,
          s.avgSendDaysAgo,
          COALESCE(r.receiveOrderCount, 0) as receiveOrderCount,
          COALESCE(r.totalReceiveWeight, 0) as totalReceiveWeight,
          COALESCE(r.totalReceiveQuantity, 0) as totalReceiveQuantity,
          COALESCE(r.receiveProductCount, 0) as receiveProductCount,
          r.lastReceiveDate,
          COALESCE(r.avgReceiveDaysAgo, 999) as avgReceiveDaysAgo
        FROM send_stats s
        LEFT JOIN receive_stats r ON s.factory_id = r.factory_id
        
        UNION ALL
        
        SELECT 
          r.factory_id,
          COALESCE(s.sendOrderCount, 0) as sendOrderCount,
          COALESCE(s.totalSendWeight, 0) as totalSendWeight,
          COALESCE(s.totalSendQuantity, 0) as totalSendQuantity,
          COALESCE(s.sendProductCount, 0) as sendProductCount,
          s.lastSendDate,
          COALESCE(s.avgSendDaysAgo, 999) as avgSendDaysAgo,
          r.receiveOrderCount,
          r.totalReceiveWeight,
          r.totalReceiveQuantity,
          r.receiveProductCount,
          r.lastReceiveDate,
          r.avgReceiveDaysAgo
        FROM receive_stats r
        LEFT JOIN send_stats s ON r.factory_id = s.factory_id
        WHERE s.factory_id IS NULL
      )
      SELECT 
        cs.factory_id,
        f.name as factoryName,
        
        -- 发出指标
        cs.sendOrderCount,
        cs.totalSendWeight,
        cs.totalSendQuantity,
        cs.sendProductCount,
        cs.lastSendDate,
        cs.avgSendDaysAgo,
        
        -- 收回指标
        cs.receiveOrderCount,
        cs.totalReceiveWeight,
        cs.totalReceiveQuantity,
        cs.receiveProductCount,
        cs.lastReceiveDate,
        cs.avgReceiveDaysAgo,
        
        -- 综合指标
        (cs.sendOrderCount + cs.receiveOrderCount) as totalTransactions,
        (cs.totalSendWeight + cs.totalReceiveWeight) as totalWeight,
        (cs.sendProductCount + cs.receiveProductCount) as totalProductCount,
        GREATEST(COALESCE(cs.lastSendDate, '1900-01-01'), COALESCE(cs.lastReceiveDate, '1900-01-01')) as lastActiveDate,
        
        -- 业务完整性指标
        CASE WHEN cs.sendOrderCount > 0 
             THEN cs.receiveOrderCount / cs.sendOrderCount 
             ELSE 0 
        END as completionRate,
        
        CASE WHEN cs.totalSendWeight > 0 
             THEN cs.totalReceiveWeight / cs.totalSendWeight 
             ELSE 0 
        END as weightCompletionRate
        
      FROM combined_stats cs
      LEFT JOIN factories f ON cs.factory_id = f.id AND f.orgId = ?
      WHERE (cs.sendOrderCount + cs.receiveOrderCount) > 0
      ORDER BY totalTransactions DESC, totalWeight DESC
      LIMIT ${queryLimit}
    `;

    // 构建查询参数
    const productParams = [...sendParams, ...receiveParams, orgId];
    const factoryParams = [...sendParams, ...receiveParams, orgId];

    console.log('[Active Rankings] 执行科学重构查询，参数:', productParams);

    const [products, factories] = await Promise.all([
      db.executeQuery(productSql, productParams),
      db.executeQuery(factorySql, factoryParams)
    ]);

    // 处理结果 - 使用新的科学算法
    const processedProducts = products.map(item => ({
      ...item,
      recordCount: item.totalTransactions,
      totalWeight: parseFloat(item.totalWeight || 0).toFixed(2),
      factoryCount: Math.max(item.sendFactoryCount || 0, item.receiveFactoryCount || 0),
      lastActiveText: formatTimeAgo(item.lastActiveDate),
      activityScore: calculateScientificActivityScore(item),
      completionRate: parseFloat((item.completionRate * 100).toFixed(1)),
      weightCompletionRate: parseFloat((item.weightCompletionRate * 100).toFixed(1))
    }));

    const processedFactories = factories.map(item => ({
      ...item,
      recordCount: item.totalTransactions,
      totalWeight: parseFloat(item.totalWeight || 0).toFixed(2),
      productCount: item.totalProductCount || 0,
      lastActiveText: formatTimeAgo(item.lastActiveDate),
      activityScore: calculateScientificActivityScore(item),
      completionRate: parseFloat((item.completionRate * 100).toFixed(1)),
      weightCompletionRate: parseFloat((item.weightCompletionRate * 100).toFixed(1))
    }));

    console.log(`[Active Rankings] 科学重构查询完成: ${processedProducts.length}个货品, ${processedFactories.length}个工厂`);

    res.json({ 
      success: true, 
      data: { 
        products: processedProducts, 
        factories: processedFactories 
      },
      meta: {
        total: {
          products: processedProducts.length,
          factories: processedFactories.length
        },
        limit: queryLimit,
        dateRange: {
          startDate,
          endDate
        },
        algorithm: 'scientific_v2.0'
      }
    });

  } catch (error) {
    console.error('[Active Rankings] 错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取活跃排行失败', 
      error: error.message,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * 安全的基础统计数据
 * GET /api/ai-reports/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { startDate, endDate, factoryId } = req.query;
    const orgId = req.user.orgId;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }

    // 构建安全的WHERE条件
    let whereConditions = ['so.orgId = ?'];
    let params = [orgId];

    if (startDate) {
      whereConditions.push('DATE(so.created_at) >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('DATE(so.created_at) <= ?');
      params.push(endDate);
    }

    if (factoryId) {
      whereConditions.push('so.factory_id = ?');
      params.push(factoryId);
    }

    const whereClause = whereConditions.join(' AND ');

    // 发出统计 - 确保数据隔离
    const sendStatsQuery = `
      SELECT 
        COUNT(DISTINCT so.id) as totalOrders,
        COALESCE(SUM(so.total_quantity), 0) as totalQuantity,
        COALESCE(SUM(so.total_weight), 0) as totalWeight,
        COALESCE(SUM(so.total_fee), 0) as totalFee,
        COALESCE(AVG(so.total_weight), 0) as avgWeight
      FROM send_orders so
      WHERE ${whereClause} AND so.status = 1
    `;

    // 收回统计 - 确保数据隔离
    const receiveStatsQuery = `
      SELECT 
        COUNT(DISTINCT ro.id) as totalOrders,
        COALESCE(SUM(ro.total_quantity), 0) as totalQuantity,
        COALESCE(SUM(ro.total_weight), 0) as totalWeight,
        COALESCE(SUM(ro.total_fee), 0) as totalFee,
        COALESCE(AVG(ro.total_weight), 0) as avgWeight
      FROM receive_orders ro
      WHERE ro.orgId = ? 
        ${startDate ? 'AND DATE(ro.created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(ro.created_at) <= ?' : ''}
        ${factoryId ? 'AND ro.factory_id = ?' : ''}
        AND ro.status = 1
    `;

    // 构建收回查询参数
    const receiveParams = [orgId];
    if (startDate) receiveParams.push(startDate);
    if (endDate) receiveParams.push(endDate);
    if (factoryId) receiveParams.push(factoryId);

    const [sendStats] = await db.executeQuery(sendStatsQuery, params);
    const [receiveStats] = await db.executeQuery(receiveStatsQuery, receiveParams);

    // 计算损耗率和效率指标
    const totalSendWeight = parseFloat(sendStats.totalWeight || 0);
    const totalReceiveWeight = parseFloat(receiveStats.totalWeight || 0);
    const lossRate = totalSendWeight > 0 ? ((totalSendWeight - totalReceiveWeight) / totalSendWeight * 100) : 0;

    const stats = {
      send: {
        totalOrders: parseInt(sendStats.totalOrders || 0),
        totalQuantity: parseInt(sendStats.totalQuantity || 0),
        totalWeight: totalSendWeight,
        totalFee: parseFloat(sendStats.totalFee || 0),
        avgWeight: parseFloat(sendStats.avgWeight || 0)
      },
      receive: {
        totalOrders: parseInt(receiveStats.totalOrders || 0),
        totalQuantity: parseInt(receiveStats.totalQuantity || 0),
        totalWeight: totalReceiveWeight,
        totalFee: parseFloat(receiveStats.totalFee || 0),
        avgWeight: parseFloat(receiveStats.avgWeight || 0)
      },
      analysis: {
        lossRate: parseFloat(lossRate.toFixed(2)),
        efficiency: totalSendWeight > 0 ? parseFloat((totalReceiveWeight / totalSendWeight * 100).toFixed(2)) : 0,
        completionRate: sendStats.totalOrders > 0 ? parseFloat((receiveStats.totalOrders / sendStats.totalOrders * 100).toFixed(2)) : 0
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('[AI Reports Stats] 查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// ==================== 辅助函数 ====================

/**
 * 安全的流水数据处理函数
 */
function processFlowData(rawData) {
  if (!rawData || rawData.length === 0) {
    return [];
  }

  const orderMap = new Map();

  // 按订单号分组
  rawData.forEach(item => {
    const key = `${item.orderNo}_${item.factory}_${item.process}_${item.productNo}`;
    
    if (!orderMap.has(key)) {
      orderMap.set(key, {
        orderNo: item.orderNo,
        factory: item.factory,
        factoryName: item.factory, // 兼容字段
        process: item.process,
        productNo: item.productNo,
        product_detail: item.product_detail,
        sendWeight: 0,
        receiveWeight: 0,
        sendQuantity: 0,
        receiveQuantity: 0,
        sendDate: null,
        receiveDate: null,
        fee: 0,
        type: null // 用于前端兼容
      });
    }

    const order = orderMap.get(key);

    if (item.type === 'send') {
      order.sendWeight += parseFloat(item.weight || 0);
      order.sendQuantity += parseInt(item.quantity || 0);
      order.sendDate = item.date;
      order.fee += parseFloat(item.fee || 0);
      order.type = 'send';
      
      // 添加前端需要的字段
      order.weight = order.sendWeight;
      order.quantity = order.sendQuantity;
      order.date = item.date;
      order.color = item.product_detail ? item.product_detail.split(' ')[0] : '';
      order.size = item.product_detail ? item.product_detail.split(' ')[1] : '';
    } else if (item.type === 'receive') {
      order.receiveWeight += parseFloat(item.weight || 0);
      order.receiveQuantity += parseInt(item.quantity || 0);
      order.receiveDate = item.date;
      if (!order.type) order.type = 'receive';
      
      // 如果没有发出记录，设置基础字段
      if (!order.sendDate) {
        order.weight = order.receiveWeight;
        order.quantity = order.receiveQuantity;
        order.date = item.date;
        order.color = item.product_detail ? item.product_detail.split(' ')[0] : '';
        order.size = item.product_detail ? item.product_detail.split(' ')[1] : '';
      }
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

/**
 * 计算损耗率
 */
function calculateLossRate(sendWeight, receiveWeight) {
  if (!sendWeight || sendWeight === 0) return 0;
  const lossRate = ((sendWeight - (receiveWeight || 0)) / sendWeight * 100);
  return Math.max(0, parseFloat(lossRate.toFixed(2)));
}

/**
 * 确定状态
 */
function determineStatus(order) {
  if (!order.receiveDate) return 'processing';
  
  const lossRate = order.lossRate || 0;
  if (lossRate > 15) return 'warning';
  if (lossRate > 8) return 'attention';
  
  return 'completed';
}

/**
 * 评估风险等级
 */
function assessRisk(order) {
  const lossRate = order.lossRate || 0;
  
  if (lossRate > 15) return 'high';
  if (lossRate > 8) return 'medium';
  
  // 检查时间风险
  if (order.sendDate && !order.receiveDate) {
    const daysDiff = Math.floor((new Date() - new Date(order.sendDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7) return 'medium';
  }
  
  return 'low';
}

/**
 * 科学的活跃度评分算法 v2.0
 * 基于客观真实原则，综合评估业务活跃度
 */
function calculateScientificActivityScore(item) {
  try {
    // 基础数据验证和提取
    const sendOrderCount = Math.max(0, parseInt(item.sendOrderCount) || 0);
    const receiveOrderCount = Math.max(0, parseInt(item.receiveOrderCount) || 0);
    const totalSendWeight = Math.max(0, parseFloat(item.totalSendWeight) || 0);
    const totalReceiveWeight = Math.max(0, parseFloat(item.totalReceiveWeight) || 0);
    const avgSendDaysAgo = Math.max(0, parseFloat(item.avgSendDaysAgo) || 999);
    const avgReceiveDaysAgo = Math.max(0, parseFloat(item.avgReceiveDaysAgo) || 999);
    const completionRate = Math.max(0, Math.min(1, parseFloat(item.completionRate) || 0));
    const weightCompletionRate = Math.max(0, Math.min(1, parseFloat(item.weightCompletionRate) || 0));
    
    // 如果完全没有业务数据，返回0分
    if (sendOrderCount === 0 && receiveOrderCount === 0) {
      return 0;
    }
    
    // === 1. 业务频次得分 (30%) ===
    // 考虑发出和收回的均衡性，避免单向偏向
    const totalTransactions = sendOrderCount + receiveOrderCount;
    const transactionBalance = sendOrderCount > 0 && receiveOrderCount > 0 ? 
      1 - Math.abs(sendOrderCount - receiveOrderCount) / Math.max(sendOrderCount, receiveOrderCount) : 
      0.5; // 单向业务降权
    
    const frequencyScore = Math.min(totalTransactions * 15, 300) * (0.7 + 0.3 * transactionBalance);
    
    // === 2. 业务规模得分 (25%) ===
    // 重量指标同样考虑收发平衡
    const totalWeight = totalSendWeight + totalReceiveWeight;
    const weightBalance = totalSendWeight > 0 && totalReceiveWeight > 0 ? 
      1 - Math.abs(totalSendWeight - totalReceiveWeight) / Math.max(totalSendWeight, totalReceiveWeight) : 
      0.6; // 单向业务适度降权
    
    const scaleScore = Math.min(totalWeight * 0.8, 250) * (0.8 + 0.2 * weightBalance);
    
    // === 3. 时间新鲜度得分 (20%) ===
    // 时间衰减函数：越近期的活动分数越高
    const avgDaysAgo = Math.min(avgSendDaysAgo, avgReceiveDaysAgo);
    let timeScore = 0;
    
    if (avgDaysAgo <= 1) {
      timeScore = 200; // 最近1天
    } else if (avgDaysAgo <= 3) {
      timeScore = 180; // 最近3天
    } else if (avgDaysAgo <= 7) {
      timeScore = 150; // 最近1周
    } else if (avgDaysAgo <= 30) {
      timeScore = 100; // 最近1月
    } else if (avgDaysAgo <= 90) {
      timeScore = 50;  // 最近3月
    } else {
      timeScore = 10;  // 超过3月
    }
    
    // === 4. 业务完整性得分 (15%) ===
    // 评估收发循环的健康度
    const avgCompletionRate = (completionRate + weightCompletionRate) / 2;
    let healthScore = 0;
    
    if (avgCompletionRate >= 0.95) {
      healthScore = 150;  // 完美匹配
    } else if (avgCompletionRate >= 0.8) {
      healthScore = 120;  // 良好匹配
    } else if (avgCompletionRate >= 0.6) {
      healthScore = 90;   // 一般匹配
    } else if (avgCompletionRate >= 0.3) {
      healthScore = 60;   // 较低匹配
    } else {
      healthScore = 30;   // 匹配较差
    }
    
    // === 5. 业务多样性得分 (10%) ===
    // 评估业务的广度和复杂度
    const diversityCount = parseInt(item.sendFactoryCount || item.sendProductCount || 
                                  item.receiveFactoryCount || item.receiveProductCount || 0);
    const diversityScore = Math.min(diversityCount * 10, 100);
    
    // === 综合评分计算 ===
    const finalScore = Math.round(
      frequencyScore * 0.30 +   // 业务频次权重30%
      scaleScore * 0.25 +       // 业务规模权重25%
      timeScore * 0.20 +        // 时间新鲜度权重20%
      healthScore * 0.15 +      // 业务完整性权重15%
      diversityScore * 0.10     // 业务多样性权重10%
    );
    
    // 评分范围限制
    const boundedScore = Math.max(0, Math.min(finalScore, 1000));
    
    // 添加调试信息（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[活跃度评分] ${item.product_no || item.factory_id}: 
        频次:${frequencyScore.toFixed(1)}(30%) 
        规模:${scaleScore.toFixed(1)}(25%) 
        时效:${timeScore}(20%) 
        健康:${healthScore}(15%) 
        多样:${diversityScore}(10%) 
        = ${boundedScore}`);
    }
    
    return boundedScore;
    
  } catch (error) {
    console.error('[科学活跃度评分] 计算错误:', error, item);
    return 0;
  }
}

/**
 * 格式化时间显示
 */
function formatTimeAgo(dateStr) {
  if (!dateStr) return '未知时间';
  
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
    return `${Math.floor(diffDays / 365)}年前`;
  } catch (e) {
    return '最近';
  }
}

module.exports = router; 