const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// ✅ 添加认证中间件 - 确保所有请求都经过认证
router.use(authenticate);

/**
 * 获取流水记录列表
 * GET /api/flow-records
 */
router.get('/', async (req, res) => {
  try {
    // 只用orgId做数据隔离，默认不做任何条件筛选
    const orgId = req.user.orgId;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    // 直接采集发出单明细
    const sendSql = `
      SELECT 
        'send' as type,
        so.order_no,
        f.name as factory_name,
        p.name as process,
        soi.product_no,
        prod.name as product_name,
        soi.color_code,
        soi.size_code,
        soi.weight,
        soi.quantity,
        soi.fee,
        so.created_at as date,
        so.orgId
      FROM send_orders so
      JOIN send_order_items soi ON so.id = soi.send_order_id
      JOIN factories f ON so.factory_id = f.id
      JOIN processes p ON so.process_id = p.id
      LEFT JOIN products prod ON soi.product_no = prod.code AND prod.orgId = so.orgId
      WHERE so.orgId = ? AND so.status = 1
    `;
    // 直接采集收回单明细
    const receiveSql = `
      SELECT 
        'receive' as type,
        ro.order_no,
        f.name as factory_name,
        p.name as process,
        roi.product_no,
        prod.name as product_name,
        roi.color_code,
        roi.size_code,
        roi.weight,
        roi.quantity,
        roi.fee,
        ro.created_at as date,
        ro.orgId
      FROM receive_orders ro
      JOIN receive_order_items roi ON ro.id = roi.receive_order_id
      JOIN factories f ON ro.factory_id = f.id
      JOIN processes p ON ro.process_id = p.id
      LEFT JOIN products prod ON roi.product_no = prod.code AND prod.orgId = ro.orgId
      WHERE ro.orgId = ? AND ro.status = 1
    `;
    // 合并两类流水
    const sendRecords = await db.executeQuery(sendSql, [orgId]);
    const receiveRecords = await db.executeQuery(receiveSql, [orgId]);
    const records = [...sendRecords, ...receiveRecords];
    // 按订单号、类型分组，便于前端显示
    const groupedData = {};
    records.forEach(record => {
      const key = `${record.order_no}_${record.type}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          orderNo: record.order_no || '-',
          factory: record.factory_name || '-',
          process: record.process || '-',
          sendDate: record.type === 'send' ? record.date : null,
          receiveDate: record.type === 'receive' ? record.date : null,
          sendInfo: [],
          receiveInfo: [],
          totalSendWeight: 0,
          totalReceiveWeight: 0,
          totalSendQuantity: 0,
          totalReceiveQuantity: 0,
          totalFee: 0,
          status: 'completed',
          riskLevel: 'low',
          cycleDays: null
        };
      }
      const group = groupedData[key];
      if (record.type === 'send') {
        group.sendInfo.push({
          productNo: record.product_no,
          productName: record.product_name || '',
          color: record.color_code || '',
          size: record.size_code || '',
          quantity: record.quantity,
          weight: record.weight,
          remark: ''
        });
        group.totalSendWeight += parseFloat(record.weight) || 0;
        group.totalSendQuantity += parseInt(record.quantity) || 0;
      } else if (record.type === 'receive') {
        group.receiveInfo.push({
          productNo: record.product_no,
          productName: record.product_name || '',
          color: record.color_code || '',
          size: record.size_code || '',
          quantity: record.quantity,
          weight: record.weight,
          fee: record.fee,
          remark: ''
        });
        group.totalReceiveWeight += parseFloat(record.weight) || 0;
        group.totalReceiveQuantity += parseInt(record.quantity) || 0;
        group.totalFee += parseFloat(record.fee) || 0;
      }
    });
    // 转换为数组并计算损耗率
    const flowRecords = Object.values(groupedData).map(group => {
      const lossWeight = Math.max(0, group.totalSendWeight - group.totalReceiveWeight);
      const lossQuantity = Math.max(0, group.totalSendQuantity - group.totalReceiveQuantity);
      const lossRate = group.totalSendWeight > 0 ? (lossWeight / group.totalSendWeight) : 0;
      return {
        ...group,
        lossWeight: lossWeight,
        lossQuantity: lossQuantity,
        lossRate: lossRate,
        riskLevel: lossRate > 0.1 ? 'high' : (lossRate > 0.05 ? 'medium' : 'low')
      };
    });
    res.json({
      success: true,
      data: {
        records: flowRecords,
        total: flowRecords.length,
        page: 1,
        pageSize: flowRecords.length
      }
    });
  } catch (err) {
    console.error('[Flow Records] 查询失败:', err);
    res.status(500).json({
      success: false,
      message: '获取流水记录列表失败',
      error: err.message
    });
  }
});

/**
 * 获取详细的流水记录（按时间顺序的明细）
 * GET /api/flow-records/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      factoryId,
      productNo,
      processId,
      page = 1,
      limit = 200
    } = req.query;
    const orgId = req.user.orgId;
    if (!orgId) {
      return res.status(400).json({ success: false, message: '无法获取组织ID' });
    }
    // 构建筛选条件
    let sendWhere = ['so.orgId = ?', 'so.status = 1'];
    let sendParams = [orgId];
    let receiveWhere = ['ro.orgId = ?', 'ro.status = 1'];
    let receiveParams = [orgId];
    if (startDate) { sendWhere.push('DATE(so.created_at) >= ?'); sendParams.push(startDate); receiveWhere.push('DATE(ro.created_at) >= ?'); receiveParams.push(startDate); }
    if (endDate) { sendWhere.push('DATE(so.created_at) <= ?'); sendParams.push(endDate); receiveWhere.push('DATE(ro.created_at) <= ?'); receiveParams.push(endDate); }
    if (factoryId) { sendWhere.push('so.factory_id = ?'); sendParams.push(factoryId); receiveWhere.push('ro.factory_id = ?'); receiveParams.push(factoryId); }
    if (productNo) { sendWhere.push('soi.product_no = ?'); sendParams.push(productNo); receiveWhere.push('roi.product_no = ?'); receiveParams.push(productNo); }
    if (processId) { sendWhere.push('so.process_id = ?'); sendParams.push(processId); receiveWhere.push('ro.process_id = ?'); receiveParams.push(processId); }
    // 发出单明细
    const sendSql = `
      SELECT
        soi.id as id,
        soi.send_order_id as send_order_id,
        NULL as receive_order_id,
        so.order_no,
        so.factory_id,
        f.name as factory_name,
        so.process_id,
        p.name as process_name,
        soi.product_id,
        soi.product_no,
        prod.name as product_name,
        soi.color_code,
        soi.size_code,
        soi.quantity as send_quantity,
        soi.weight as send_weight,
        so.created_at as send_date,
        soi.fee as send_fee,
        NULL as receive_quantity,
        NULL as receive_weight,
        NULL as receive_date,
        NULL as receive_fee,
        NULL as receive_remark,
        NULL as loss_quantity,
        NULL as loss_weight,
        NULL as loss_rate,
        'completed' as status,
        so.created_at as created_at,
        so.updated_at as updated_at,
        so.orgId
      FROM send_orders so
      JOIN send_order_items soi ON so.id = soi.send_order_id
      JOIN factories f ON so.factory_id = f.id
      JOIN processes p ON so.process_id = p.id
      LEFT JOIN products prod ON soi.product_no = prod.code AND prod.orgId = so.orgId
      WHERE ${sendWhere.join(' AND ')}
    `;
    // 收回单明细
    const receiveSql = `
      SELECT
        roi.id as id,
        NULL as send_order_id,
        roi.receive_order_id as receive_order_id,
        ro.order_no,
        ro.factory_id,
        f.name as factory_name,
        ro.process_id,
        p.name as process_name,
        roi.product_id,
        roi.product_no,
        prod.name as product_name,
        roi.color_code,
        roi.size_code,
        NULL as send_quantity,
        NULL as send_weight,
        NULL as send_date,
        NULL as send_fee,
        roi.quantity as receive_quantity,
        roi.weight as receive_weight,
        ro.created_at as receive_date,
        roi.fee as receive_fee,
        NULL as receive_remark,
        NULL as loss_quantity,
        NULL as loss_weight,
        NULL as loss_rate,
        'completed' as status,
        ro.created_at as created_at,
        ro.updated_at as updated_at,
        ro.orgId
      FROM receive_orders ro
      JOIN receive_order_items roi ON ro.id = roi.receive_order_id
      JOIN factories f ON ro.factory_id = f.id
      JOIN processes p ON ro.process_id = p.id
      LEFT JOIN products prod ON roi.product_no = prod.code AND prod.orgId = ro.orgId
      WHERE ${receiveWhere.join(' AND ')}
    `;
    // 合并两类流水，分页
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const unionSql = `
      (${sendSql})
      UNION ALL
      (${receiveSql})
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${offset}
    `;
    const allParams = [...sendParams, ...receiveParams];
    const records = await db.executeQuery(unionSql, allParams);
    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total FROM (
        (${sendSql})
        UNION ALL
        (${receiveSql})
      ) t
    `;
    const [countResult] = await db.executeQuery(countSql, allParams);
    const total = parseInt(countResult.total || 0);
    // 格式化记录
    const formattedRecords = records.map(record => {
      let type = 'unknown';
      let typeText = '未知';
      let recordDate = null;
      if (record.receive_order_id !== null && record.receive_order_id !== undefined) {
        type = 'receive';
        typeText = '收回';
        recordDate = record.receive_date;
      } else if (record.send_order_id !== null && record.send_order_id !== undefined) {
        type = 'send';
        typeText = '发出';
        recordDate = record.send_date;
      }
      let formattedDate = recordDate ?
        (typeof recordDate === 'string' ? recordDate.split('T')[0] : recordDate.toISOString().split('T')[0])
        : (record.created_at ? (typeof record.created_at === 'string' ? record.created_at.split(' ')[0] : record.created_at.toISOString().split('T')[0]) : null);
      return {
        id: `${type}_${record.id || Math.random().toString(36).substr(2, 9)}`,
        type: type,
        typeText: typeText,
        date: formattedDate || '-',
        order_no: record.order_no || '-',
        product_no: record.product_no || '-',
        product_name: record.product_name || '',
        color: record.color_code || '',
        size: record.size_code || '',
        quantity: parseInt(record.send_quantity || 0) + parseInt(record.receive_quantity || 0),
        weight: parseFloat(record.send_weight || 0) + parseFloat(record.receive_weight || 0),
        fee: parseFloat(record.receive_fee || 0),
        factory_name: record.factory_name || '-',
        process_name: record.process_name || '-',
        remark: '',
        send_order_id: record.send_order_id,
        receive_order_id: record.receive_order_id
      };
    });
    res.json({
      success: true,
      data: formattedRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[Detailed Flow Records] 查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取详细流水记录失败',
      error: error.message
    });
  }
});

module.exports = router; 