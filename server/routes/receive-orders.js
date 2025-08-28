// 收回单相关路由
const express = require('express');
const router = express.Router();
const db = require('../db.js');
const moment = require('moment');
const { authenticate } = require('../middleware/auth');
const { body, validationResult, check } = require('express-validator');
const orgSecurity = require('../utils/orgSecurity');

router.use(authenticate);

// 全局请求日志
router.use((req, res, next) => {
  console.log(`Received ${req.method} ${req.originalUrl} request`);
  next();
});

/**
 * 获取收回单列表
 * GET /api/receive-orders
 */
router.get('/', async (req, res) => {
  try {
    delete req.query.orderType; // 先删除不需要的参数
    const { factoryId, processId, page = 1, pageSize = 20, date, startDate, endDate, status, keyword } = req.query;
    const orgId = req.user.orgId; // 强制使用当前用户的组织ID
    let whereSql = '';
    const params = []; // 这些参数仅用于WHERE子句
    
    // 强制按当前用户组织ID过滤
    whereSql += ' AND ro.orgId = ?';
    params.push(req.user.orgId);
    
    // 🔧 新增：专员角色权限控制 - 只能查看自己制单的订单
    if (req.user.roleId === 4) { // 专员角色
      whereSql += ' AND ro.created_by = ?';
      params.push(req.user.userId);
      console.log('[Receive Orders] 专员角色权限控制 - 用户ID:', req.user.userId);
    }
    
    if (status !== undefined && status !== null && status !== '') { whereSql += ' AND ro.status = ?'; params.push(status); }
    if (factoryId) { whereSql += ' AND ro.factory_id = ?'; params.push(factoryId); }
    if (processId) { whereSql += ' AND ro.process_id = ?'; params.push(processId); }
    if (keyword) { whereSql += ' AND (ro.order_no LIKE ? OR ro.remark LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    
    // 🔧 新增：支持前端传递的制单人筛选（兼容专员角色）
    if (req.query.createdBy) { 
      whereSql += ' AND ro.created_by = ?'; 
      params.push(req.query.createdBy); 
    }
    
    if (req.query.createdByUsername) { 
      whereSql += ' AND u.username = ?'; 
      params.push(req.query.createdByUsername); 
    }
    
    // 修改日期筛选逻辑，避免使用DATE()函数，并确保参数准确
    if (startDate && endDate) { 
      whereSql += ' AND DATE(ro.created_at) BETWEEN ? AND ?'; 
      params.push(startDate, endDate); 
    }
    else if (startDate) { 
      whereSql += ' AND DATE(ro.created_at) >= ?'; 
      params.push(startDate); 
    }
    else if (endDate) { 
      whereSql += ' AND DATE(ro.created_at) <= ?'; 
      params.push(endDate); 
    }
    else if (date) { 
      whereSql += ' AND DATE(ro.created_at) = ?';
      params.push(date); 
    }
    
    // 构建基础SQL - 使用LEFT JOIN确保即使没有匹配的工厂或工序也能返回记录
    let countSql = `
      SELECT COUNT(*) AS total 
      FROM receive_orders ro
      WHERE 1=1${whereSql}
    `;
    
    // 先查总数（只传where条件的params）
    const [totalResult] = await db.executeQuery(countSql, params);
    const total = totalResult ? totalResult.total : 0;

    // 分页参数 (确保是整数)
    const pageNum = parseInt(page, 10) || 1;
    const pageSizeNum = parseInt(pageSize, 10) || 20;
    const offset = parseInt((pageNum - 1) * pageSizeNum, 10);
    const limit = parseInt(pageSizeNum, 10);

    // 构建获取数据SQL，包含工厂名称、工序名称和制单人信息
    let sql = `
      SELECT 
        ro.*,
        f.name AS factoryName,
        p.name AS processName,
        u.real_name AS creatorName,
        DATE_FORMAT(ro.created_at, '%Y-%m-%d') AS orderDate
      FROM receive_orders ro
      LEFT JOIN factories f ON ro.factory_id = f.id
      LEFT JOIN processes p ON ro.process_id = p.id
      LEFT JOIN users u ON ro.created_by = u.id
      WHERE 1=1${whereSql}
      ORDER BY ro.created_at DESC
      LIMIT ${offset}, ${limit}
    `;
    
    // 不再将分页参数添加到查询参数数组末尾，而是直接嵌入SQL
    
    // 查询数据
    const orders = await db.executeQuery(sql, params);
    
    // 处理返回数据，确保字段命名一致性（驼峰式）
    const processedOrders = orders.map(order => ({
      id: order.id,
      orderNo: order.order_no,
      orderDate: order.orderDate,
      factoryId: order.factory_id,
      factoryName: order.factoryName || '未知工厂',
      processId: order.process_id,
      processName: order.processName || '未知工序',
      totalWeight: order.total_weight,
      totalQuantity: order.total_quantity,
      totalFee: order.total_fee,
      paymentAmount: order.payment_amount,
      remark: order.remark,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      creator: order.creatorName || '', // 制单人信息
      // 兼容字段，确保前端不会因缺少字段而出错
      date: order.orderDate, // 兼容使用date字段
      factory: order.factoryName || '未知工厂', // 兼容使用factory字段
      process: order.processName || '未知工序', // 兼容使用process字段
      staff: order.creatorName || '', // 兼容字段：制单人
      orderType: 'receive', // 标记为收回单类型
    }));
    
    // 添加制单人信息验证日志
    console.log('[Receive Orders] 制单人信息验证:', {
      total: processedOrders.length,
      sampleData: processedOrders.slice(0, 3).map(order => ({
        orderNo: order.orderNo,
        creator: order.creator,
        staff: order.staff,
        rawCreatorName: orders.find(o => o.id === order.id)?.creatorName
      }))
    });
    
    res.json({ 
      success: true, 
      data: { 
        records: processedOrders, 
        total: total, 
        page: pageNum, 
        pageSize: pageSizeNum 
      } 
    });

  } catch (err) {
    res.status(500).json({ success: false, message: '获取收回单失败', error: err.message });
  }
});

/**
 * 获取收回单汇总数据
 * GET /api/receive-orders/summary
 */
router.get('/summary', async (req, res) => {
  try {
    const { factoryId, productId, startDate, endDate } = req.query;
    const orgId = req.user.orgId; // 强制使用当前用户的组织ID
    
    // 参数验证和类型转换
    const safeFactoryId = parseInt(factoryId, 10) || 0;
    const formattedStartDate = startDate ? startDate.trim() : '';
    const formattedEndDate = endDate ? endDate.trim() : '';
    // 不再从 req.query 中获取 orgId，强制使用当前用户组织ID
    const safeOrgId = req.user.orgId; // <-- 使用当前用户组织ID

    // 构建基础SQL查询
    let sql = `
      SELECT 
        roi.product_id AS productId,
        p.code AS productNo,
        p.name AS productName,
        p.image AS imageUrl,
        COALESCE(pr.name, '未知工序') AS process,
        SUM(roi.quantity) AS quantity,
        SUM(roi.weight) AS weight,
        SUM(ro.total_fee) AS totalFee,
        SUM(ro.payment_amount) AS paymentAmount
      FROM receive_orders ro
      JOIN receive_order_items roi ON ro.id = roi.receive_order_id
      JOIN products p ON roi.product_id = p.id
      LEFT JOIN processes pr ON ro.process_id = pr.id
      WHERE ro.status = 1
        AND ro.factory_id = ?
        AND ro.orgId = ?
        AND DATE(ro.created_at) BETWEEN ? AND ?
    `;

    const params = [safeFactoryId, safeOrgId, formattedStartDate, formattedEndDate];

    // 参数验证和类型转换
    const safeProductId = productId && productId !== '' ? parseInt(productId, 10) || 0 : null;
    
    if (safeProductId) {
      sql += ' AND roi.product_id = ?';
      params.push(safeProductId);
    }

    sql += ' GROUP BY roi.product_id, p.code, p.name, p.image, pr.name';

    const results = await db.executeQuery(sql, params);

    // 处理图片URL - 使用同步版本保持一致性
    const processedResults = results.map(item => {
      try {
        const { thumbnailUrl, originalImageUrl } = processImageUrlSync(item.imageUrl, 'ReceiveOrders');
        return {
          ...item,
          imageUrl: thumbnailUrl || '/images/default-product.png',
          originalImageUrl: originalImageUrl || '/images/default-product.png',
          totalFee: parseFloat(item.totalFee || 0).toFixed(2),
          paymentAmount: parseFloat(item.paymentAmount || 0).toFixed(2)
        };
      } catch (error) {
        return {
          ...item,
          imageUrl: '/images/default-product.png',
          originalImageUrl: '/images/default-product.png',
          totalFee: parseFloat(item.totalFee || 0).toFixed(2),
          paymentAmount: parseFloat(item.paymentAmount || 0).toFixed(2)
        };
      }
    });

    res.json({ success: true, data: processedResults });
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

/**
 * 获取收回单详情
 * GET /api/receive-orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 修改SQL，连接工厂表、工序表和用户表，并添加组织ID过滤
    const orderSql = `
      SELECT 
        ro.*, 
        f.name AS factoryName, 
        p.name AS processName, 
        u.real_name AS creatorName,  -- 新增
        DATE_FORMAT(ro.created_at, '%Y-%m-%d') AS orderDate
      FROM receive_orders ro
      LEFT JOIN factories f ON ro.factory_id = f.id
      LEFT JOIN processes p ON ro.process_id = p.id
      LEFT JOIN users u ON ro.created_by = u.id  -- 新增
      WHERE ro.id = ? AND ro.orgId = ?
    `;
    const [order] = await db.executeQuery(orderSql, [id, req.user.orgId]);
    if (!order) {
      return res.status(404).json({ success: false, message: '收回单不存在' });
    }
    // 获取明细，并关联产品表获取产品详情
    const itemsSql = `
      SELECT 
        roi.*, 
        p.name AS productName, 
        p.code AS productCode, 
        p.image, 
        p.colors, 
        p.sizes
      FROM receive_order_items roi
      LEFT JOIN products p ON roi.product_id = p.id
      WHERE roi.receive_order_id = ?
    `;
    const items = await db.executeQuery(itemsSql, [id]);
    // 处理明细数据，转换命名为驼峰风格
     const processedItems = items.map(item => ({
      id: item.id,
      receiveOrderId: item.receive_order_id,
      productId: item.product_id || item.productId,
      productNo: item.product_no || item.productCode || '',
      productName: item.productName || '',
      colorId: item.color_id || item.colorId,
      colorCode: item.color_code || item.color,
      sizeId: item.size_id || item.sizeId,
      sizeCode: item.size_code || item.size,
      weight: item.weight,
      quantity: item.quantity,
      fee: item.fee,
      price: item.fee, // 兼容前端显示，实际只用fee
      // 兼容API
      color: item.color_code || item.color,
      size: item.size_code || item.size,
      image: item.image,
      // 颜色和尺码选项数组
      colorOptions: item.colors ? item.colors.split(',').map(c => c.trim()).filter(c => c) : [],
      sizeOptions: item.sizes ? item.sizes.split(',').map(s => s.trim()).filter(s => s) : []
    }));
    // 处理备注照片：将JSON字符串转换为数组
    let remarkImages = [];
    if (order.remark_images) {
      try {
        remarkImages = JSON.parse(order.remark_images);
      } catch (e) {
        console.error('解析备注照片JSON失败:', e);
        remarkImages = [];
      }
    }

    // 构建并返回完整的订单详情
    const orderDetail = {
      id: order.id,
      orderNo: order.order_no,
      orderDate: order.orderDate,
      factoryId: order.factory_id,
      factoryName: order.factoryName || '未知工厂',
      processId: order.process_id,
      processName: order.processName || '未知工序',
      totalWeight: order.total_weight,
      totalQuantity: order.total_quantity,
      totalFee: order.total_fee,
      paymentAmount: order.payment_amount,
      paymentMethod: order.payment_method || '未付',
      remark: order.remark,
      remarkImages: remarkImages, // 添加备注照片
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      creator: order.creatorName || '', // 新增：制单人
      items: processedItems,
      // 兼容字段
      date: order.orderDate,
      factory: order.factoryName || '未知工厂',
      process: order.processName || '未知工序',
      products: processedItems, // 兼容旧API
      orderType: 'receive'
    };
    res.json({ success: true, data: orderDetail });
  } catch (err) {
    res.status(500).json({ success: false, message: '获取收回单详情失败', error: err.message });
  }
});

// 定义收回单验证规则
const receiveOrderValidationRules = [
  // 移除orderType的验证，因为该字段在receive_orders表中不存在
  check('orgId')
    .exists()
    .withMessage('组织ID orgId 是必填项')
    .notEmpty()
    .withMessage('组织ID orgId 不能为空'),
  check('factoryId')
    .exists()
    .withMessage('工厂ID factoryId 是必填项')
];

// 在插入 receive_order_items 明细前，补全 color_id/size_id。
async function fillColorAndSizeId(item, orgId, conn) {
  if ((!item.color_id || item.color_id === null) && item.color_code) {
    const [rows] = await conn.query('SELECT id FROM colors WHERE name=? AND orgId=?', [item.color_code, orgId]);
    if (rows && rows.length > 0) item.color_id = rows[0].id;
  }
  if ((!item.size_id || item.size_id === null) && item.size_code) {
    const [rows] = await conn.query('SELECT id FROM sizes WHERE name=? AND orgId=?', [item.size_code, orgId]);
    if (rows && rows.length > 0) item.size_id = rows[0].id;
  }
}

/**
 * 新增收回单，并联动工厂账户，支持主表+明细一体化写入
 * POST /api/receive-orders
 * body: { orgId, factoryId, processId, totalWeight, totalQuantity, totalFee, paymentAmount, ... , items: [...] }
 */
router.post('/', (req, res, next) => {
  // 先处理权限验证
  authenticate(req, res, next);
}, receiveOrderValidationRules, async (req, res) => {
  const conn = await db.pool.getConnection();
  try {
    // 检查验证结果
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // 如果存在验证错误，返回400响应
      return res.status(400).json({
        success: false,
        message: '输入数据验证失败',
        errors: errors.array()
      });
    }
    
    await conn.beginTransaction(); // 开启事务
    
    const order = req.body;
    const { items, ...mainData } = order;
    delete mainData.orderType;
    
    // 强制检查请求体中的 orgId 是否与当前用户组织ID一致
    try {
      orgSecurity.validateOrgAccess(mainData.orgId, req.user.orgId, 'create_receive_order');
    } catch (error) {
      await conn.rollback();
      if (error instanceof orgSecurity.OrgSecurityError) {
        return res.status(403).json({
          success: false,
          message: error.message,
          code: error.code
        });
      }
      throw error;
    }
    
    // 强制使用用户组织ID，确保数据安全
    mainData.orgId = req.user.orgId;
    
    // 处理工序ID - 如果前端传的是工序名称而不是ID
    let processId = mainData.processId || 0; // 默认为0
    if (!processId && mainData.process) {
      try {
        // 查询工序名称对应的ID
        const [processRow] = await conn.query('SELECT id FROM processes WHERE name = ?', [mainData.process]);
        if (processRow && processRow.length > 0) {
          processId = processRow[0].id;
        }
      } catch (err) {
        // 出错时使用默认值，不中断流程
      }
    }
    
    // 新增：process_id 有效性校验
    if (!processId || isNaN(processId) || parseInt(processId) <= 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: '工序ID不能为空且必须为正整数'
      });
    }
    // 校验 process_id 是否存在且属于当前组织
    const [processRows] = await conn.query('SELECT id FROM processes WHERE id = ? AND orgId = ?', [processId, req.user.orgId]);
    if (!processRows || processRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: '工序ID无效或不属于当前组织'
      });
    }
    
    // 获取当前最大单号并生成新单号
    let generatedOrderNo = 'S0001'; // 默认起始单号
    // 修正：只查本组织下的最大单号
    const [maxOrderResult] = await conn.query('SELECT order_no FROM receive_orders WHERE orgId = ? AND order_no LIKE "S%" ORDER BY order_no DESC LIMIT 1', [req.user.orgId]);
    
    if (maxOrderResult && maxOrderResult.length > 0) {
      const lastOrderNo = maxOrderResult[0].order_no;
      // 提取数字部分
      const numPart = parseInt(lastOrderNo.substring(1), 10);
      if (!isNaN(numPart)) {
        // 数字部分+1，并确保长度为4位（添加前导0）
        const newNumPart = (numPart + 1).toString().padStart(4, '0');
        generatedOrderNo = `S${newNumPart}`;
      }
    }
    
    // status字段转换为数字
    let statusForDb = 1; // 默认1（正常）
    if (mainData.status !== undefined && mainData.status !== null) {
        const lowerStatus = String(mainData.status).toLowerCase();
        if (lowerStatus === 'normal') {
            statusForDb = 1;
        } else if (lowerStatus === '0' || lowerStatus === 'voided') {
            statusForDb = 0;
        } else {
            const parsedStatus = parseInt(mainData.status, 10);
            if (!isNaN(parsedStatus)) {
                statusForDb = parsedStatus;
            }
        }
    }

    // 处理照片数据：将数组转换为JSON字符串
    let remarkImages = null;
    if (mainData.remarkImages && Array.isArray(mainData.remarkImages)) {
      remarkImages = JSON.stringify(mainData.remarkImages);
    }

    // 新增：写入当前登录用户ID为created_by
    const insertSql = `INSERT INTO receive_orders (
      order_no, orgId, factory_id, process_id, total_weight, total_quantity, total_fee,
      payment_amount, payment_method, remark, remark_images, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;

    const values = [
      generatedOrderNo, // order_no
      mainData.orgId,      // orgId
      mainData.factoryId,  // factory_id
      processId,           // process_id - 使用处理后的值
      mainData.totalWeight, // total_weight
      mainData.totalQuantity, // total_quantity
      mainData.totalFee,      // total_fee
      mainData.paymentAmount, // payment_amount
      mainData.paymentMethod || '未付', // payment_method
      mainData.remark,        // remark
      remarkImages,           // remark_images
      statusForDb,          // status
      req.user.userId           // created_by - 修复：使用userId而不是id
    ];
    
    const [result] = await conn.query(insertSql, values);
    const newOrderId = result.insertId;
    
    // 3. 插入明细表
    if (Array.isArray(items) && items.length > 0) {
      const allowedItemFields = [
        'product_id', 'product_no', 'color_id', 'color_code', 'size_id', 'size_code',
        'weight', 'quantity', 'fee'
      ];
      for (const item of items) {
        // 只过滤 undefined、null、空字符串，保留 0、false、NaN
        let itemFields = allowedItemFields.filter(f => !(item[f] === undefined || item[f] === null || (typeof item[f] === 'string' && item[f].trim() === '')));
        // 强制插入 weight、quantity、fee 字段（哪怕为 0），只要 product_id、product_no 存在
        if (item.product_id && item.product_no) {
          ['weight', 'quantity', 'fee'].forEach(f => {
            if (!itemFields.includes(f)) itemFields.push(f);
          });
        }
        if (itemFields.length === 0) {
          continue;
        }
        await fillColorAndSizeId(item, mainData.orgId, conn);
        const itemValues = itemFields.map(f => item[f]);
        // 明细表必须带 receive_order_id
        itemFields.unshift('receive_order_id');
        itemValues.unshift(newOrderId);
        const finalPlaceholders = itemFields.map(() => '?').join(',');
        const itemSql = `INSERT INTO receive_order_items (${itemFields.join(',')}) VALUES (${finalPlaceholders})`;
        await conn.query(itemSql, itemValues);
      }
    }
    
    // 获取工厂账户信息 - 添加组织ID过滤
    const [factory] = await conn.query('SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?', [mainData.factoryId, req.user.orgId]); // 添加组织ID过滤
    
    // 检查是否找到了对应组织下的工厂
    if (!factory || factory.length === 0) {
        await conn.rollback();
        return res.status(404).json({
            success: false,
            message: '未找到当前组织下的指定工厂',
        });
    }
    
    // 财务计算前的状态记录
    const originalBalance = parseFloat(factory[0]?.balance || 0);
    const originalDebt = parseFloat(factory[0]?.debt || 0);
    const fee = parseFloat(mainData.totalFee || 0);
    const pay = parseFloat(mainData.paymentAmount || 0);
    
    // 验证财务数据的合理性
    if (fee < 0 || pay < 0) {
        await conn.rollback();
        return res.status(400).json({
            success: false,
            message: '费用和支付金额不能为负数',
        });
    }

    if (pay > fee) {
        console.warn('[addReceiveOrder] 警告: 支付金额超过应付费用', {
          fee: fee.toFixed(2),
          pay: pay.toFixed(2),
          excess: (pay - fee).toFixed(2)
        });
    }

    let balance = originalBalance;
    let debt = originalDebt;

    // 财务计算逻辑 - 添加详细日志
    console.log('[addReceiveOrder] 步骤1: 处理应付费用');
    if (balance >= fee) {
      balance -= fee;
    } else {
      const shortfall = fee - balance;
      debt += shortfall;
      balance = 0;
    }
    
    console.log('[addReceiveOrder] 步骤2: 处理支付金额');
    if (pay > 0) {
      if (debt > 0) {
        if (pay >= debt) {
          balance += (pay - debt);
          debt = 0;
        } else {
          debt -= pay;
        }
      } else {
        balance += pay;
      }
    }
    
    // 最终财务状态验证
    console.log('[addReceiveOrder] 财务计算完成:', {
      originalBalance: originalBalance.toFixed(2),
      originalDebt: originalDebt.toFixed(2),
      finalBalance: balance.toFixed(2),
      finalDebt: debt.toFixed(2),
      balanceChange: (balance - originalBalance).toFixed(2),
      debtChange: (debt - originalDebt).toFixed(2)
    });
    
    // 移除因余额或欠款为负数而阻断业务的检查，只保留日志
    if (balance < 0 || debt < 0) {
        console.warn('[addReceiveOrder] 余额或欠款为负数（允许长期欠款，已放行）', {
          balance: balance.toFixed(2),
          debt: debt.toFixed(2)
        });
    }
    
    await conn.query('UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?', [balance, debt, mainData.factoryId, req.user.orgId]); // 添加组织ID过滤
    
    // 获取更新后的工厂账户完整信息 - 添加组织ID过滤
    const [updatedFactory] = await conn.query('SELECT id, name, balance, debt FROM factories WHERE id = ? AND orgId = ?', [mainData.factoryId, req.user.orgId]); // 添加组织ID过滤
    
    // 新增：如果有付款金额，自动在factory_payments表中插入付款记录
    if (parseFloat(mainData.paymentAmount || 0) > 0) {
      try {
        // 检查是否已存在该收回单的付款记录，避免重复创建
        const existingPayment = await conn.query(`
          SELECT id FROM factory_payments 
          WHERE orgId = ? AND factory_id = ? AND payment_no = ? AND status = 1
        `, [req.user.orgId, mainData.factoryId, generatedOrderNo]);
        
        if (!existingPayment || existingPayment[0].length === 0) {
          // 直接使用收回单号作为付款单号，不添加REC前缀
          const paymentNo = generatedOrderNo;
          
          // 插入付款记录，确保与收回单支付信息同步
          await conn.query(`
            INSERT INTO factory_payments (
              orgId, factory_id, payment_no, amount, payment_method, 
              remark, status, created_by, createTime
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW())
          `, [
            req.user.orgId, 
            mainData.factoryId, 
            paymentNo, 
            parseFloat(mainData.paymentAmount), 
            mainData.paymentMethod || '现金',
            `收回单支付 - ${generatedOrderNo}`,
            req.user.userId || 0
          ]);
          
          console.log(`[收回单] 已自动创建付款记录: ${paymentNo}, 金额: ${mainData.paymentAmount}`);
        } else {
          console.log(`[收回单] 付款记录已存在，跳过创建: ${generatedOrderNo}`);
        }
      } catch (paymentErr) {
        console.warn('[收回单] 创建付款记录失败，可能factory_payments表不存在:', paymentErr.message);
        // 付款记录插入失败不影响主流程，只记录警告
      }
    }
    
    await conn.commit(); // 提交事务
    res.status(201).json({ 
      success: true, 
      message: '收回单添加成功', 
      data: { 
        id: newOrderId,
        factoryStatus: updatedFactory[0] // 返回最新的工厂账户状态 
      } 
    });
  } catch (err) {
    await conn.rollback(); // 回滚事务
    res.status(500).json({ success: false, message: '添加收回单失败', error: err.message });
  } finally {
    conn.release(); // 释放连接
  }
});

/**
 * 编辑收回单，并联动工厂账户
 * PUT /api/receive-orders/:id
 * body: { ...新单据内容... }
 * 🔒 安全限制：为保证数据一致性，收回单不允许编辑，只能作废后重新创建
 */
router.put('/:id', async (req, res) => {
  // 🔒 数据一致性保护：禁用收回单编辑功能
  return res.status(403).json({
    success: false,
    message: '为保证数据一致性，收回单不允许编辑。如需修改，请先作废当前单据，然后重新创建。',
    code: 'EDIT_DISABLED_FOR_DATA_INTEGRITY'
  });
});

/**
 * 删除（作废）收回单，并联动工厂账户
 * DELETE /api/receive-orders/:id
 */
router.delete('/:id', async (req, res) => {
  const conn = await db.pool.getConnection(); // 使用连接池获取连接
  try {
    await conn.beginTransaction(); // 开启事务
    // 1. 查原单据 - 添加组织ID过滤
    const [order] = await conn.query('SELECT * FROM receive_orders WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]); // orgId
    if (!order || order.length === 0) {
        // 如果找不到单据，可能是ID错误，也可能是跨组织访问
        await conn.rollback();
        return res.status(404).json({ success: false, message: '收回单不存在' });
    }
     if (order[0].status === 0) { // 假设0表示已作废
         await conn.rollback();
        return res.status(400).json({ success: false, message: '单据已是作废状态' });
    }
    
    // 2. 查工厂账户 - 添加组织ID过滤，修复字段名
    const [factory] = await conn.query('SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // orgId
    
     // 检查是否找到了对应组织下的工厂
    if (!factory || factory.length === 0) {
        await conn.rollback();
        return res.status(404).json({
            success: false,
            message: '未找到当前组织下的指定工厂',
        });
    }
    
    let balance = parseFloat(factory[0]?.balance || 0);
    let debt = parseFloat(factory[0]?.debt || 0);
    
    // 3. 回退原单据影响 - 保持原有逻辑，修复字段名
    const oldFee = parseFloat(order[0].total_fee || 0);
    const oldPay = parseFloat(order[0].payment_amount || 0);
    if (oldPay > 0) {
      if (balance >= oldPay) {
        balance -= oldPay;
      } else {
        debt += (oldPay - balance);
        balance = 0;
      }
    }
    if (debt >= oldFee) {
      debt -= oldFee;
    } else {
      balance += (oldFee - debt);
      debt = 0;
    }
    
    // 4. 更新工厂账户 - 添加组织ID过滤，修复字段名
    await conn.query('UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?', [balance, debt, order[0].factory_id, req.user.orgId]); // orgId
    
    // 5. 更新单据状态为作废 (0) - 添加组织ID过滤
    const updateResult = await conn.query('UPDATE receive_orders SET status = 0 WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]); // orgId
     if (updateResult[0].affectedRows === 0) {
         await conn.rollback();
        throw new Error('作废单据失败');
    }

    // 🔧 增强：同步作废对应的付款记录，确保事务完整性
    if (parseFloat(order[0].payment_amount || 0) > 0) {
      try {
        const orderNo = order[0].order_no;
        const paymentNo = orderNo; // 直接使用收回单号，不添加REC前缀
        
        // 将对应的付款记录状态设置为作废（status=0）
        const paymentUpdateResult = await conn.query(`
          UPDATE factory_payments 
          SET status = 0, updateTime = NOW()
          WHERE orgId = ? AND factory_id = ? AND payment_no = ? AND status = 1
        `, [req.user.orgId, order[0].factory_id, paymentNo]);
        
        console.log(`[作废收回单] 已同步作废付款记录: ${paymentNo}, 影响行数: ${paymentUpdateResult[0].affectedRows}`);
      } catch (paymentErr) {
        console.error('[作废收回单] 🚨 付款记录同步失败，回滚事务:', paymentErr.message);
        await conn.rollback();
        return res.status(500).json({
          success: false,
          message: '作废收回单失败：付款记录同步失败',
          error: paymentErr.message
        });
      }
    }

    // 获取更新后的工厂账户完整信息 - 添加组织ID过滤，修复字段名
    const [updatedFactory] = await conn.query('SELECT id, name, balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // orgId

    await conn.commit(); // 提交事务
    res.json({
      success: true, 
      message: '收回单已作废',
      data: {
        factoryStatus: updatedFactory[0] // 返回最新的工厂账户状态
      }
    });
  } catch (err) {
    await conn.rollback(); // 回滚事务
    res.status(500).json({ success: false, message: err.message || '作废收回单失败' });
  } finally {
    conn.release(); // 释放连接
  }
});

// 启用收回单 (将状态从作废改为启用，假设启用状态是1)
router.put('/:id/enable', async (req, res) => {
  const conn = await db.pool.getConnection(); // 使用连接池获取连接
  try {
    await conn.beginTransaction(); // 开启事务
    const { id } = req.params;
    
    // 1. 查原单据 - 添加组织ID过滤
    const [order] = await conn.query('SELECT * FROM receive_orders WHERE id = ? AND orgId = ?', [id, req.user.orgId]); // orgId
     if (!order || order.length === 0) {
         await conn.rollback();
         return res.status(404).json({ success: false, message: '收回单不存在' });
    }
    if (order[0].status === 1) { // 假设1表示已启用
         await conn.rollback();
        return res.status(400).json({ success: false, message: '单据已是启用状态' });
    }

    // 2. 查工厂账户 - 添加组织ID过滤，修复字段名
    const [factory] = await conn.query('SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // orgId
    
     // 检查是否找到了对应组织下的工厂
    if (!factory || factory.length === 0) {
        await conn.rollback();
        return res.status(404).json({
            success: false,
            message: '未找到当前组织下的指定工厂',
        });
    }

    let balance = parseFloat(factory[0]?.balance || 0);
    let debt = parseFloat(factory[0]?.debt || 0);
    
    // 3. 回退原单据影响 - 保持原有逻辑，修复字段名
    const oldFee = parseFloat(order[0].total_fee || 0);
    const oldPay = parseFloat(order[0].payment_amount || 0);
    if (oldPay > 0) {
      if (balance >= oldPay) {
        balance -= oldPay;
      } else {
        debt += (oldPay - balance);
        balance = 0;
      }
    }
    if (debt >= oldFee) {
      debt -= oldFee;
    } else {
      balance += (oldFee - debt);
      debt = 0;
    }
    
    // 4. 更新工厂账户 - 添加组织ID过滤，修复字段名
    await conn.query('UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?', [balance, debt, order[0].factory_id, req.user.orgId]); // orgId
    
    // 5. 更新单据状态为启用 (1) - 添加组织ID过滤
    const updateResult = await conn.query('UPDATE receive_orders SET status = 1 WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]); // orgId
     if (updateResult[0].affectedRows === 0) {
         await conn.rollback();
        throw new Error('启用单据失败');
    }

    // 🔧 新增：重新创建对应的付款记录，确保事务完整性
    if (parseFloat(order[0].payment_amount || 0) > 0) {
      try {
        const orderNo = order[0].order_no;
        const paymentNo = orderNo; // 直接使用收回单号，不添加REC前缀
        
        // 检查是否已存在该收回单的付款记录，避免重复创建
        const existingPayment = await conn.query(`
          SELECT id FROM factory_payments 
          WHERE orgId = ? AND factory_id = ? AND payment_no = ? AND status = 1
        `, [req.user.orgId, order[0].factory_id, paymentNo]);
        
        if (!existingPayment || existingPayment[0].length === 0) {
          // 重新创建付款记录
          await conn.query(`
            INSERT INTO factory_payments (
              orgId, factory_id, payment_no, amount, payment_method, 
              remark, status, created_by, createTime
            ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW())
          `, [
            req.user.orgId, 
            order[0].factory_id, 
            paymentNo, 
            parseFloat(order[0].payment_amount), 
            order[0].payment_method || '现金',
            `收回单支付 - ${orderNo}`,
            req.user.userId || 0
          ]);
          
          console.log(`[启用收回单] 已重新创建付款记录: ${paymentNo}, 金额: ${order[0].payment_amount}`);
        } else {
          console.log(`[启用收回单] 付款记录已存在，跳过创建: ${paymentNo}`);
        }
      } catch (paymentErr) {
        console.error('[启用收回单] 🚨 付款记录创建失败，回滚事务:', paymentErr.message);
        await conn.rollback();
        return res.status(500).json({
          success: false,
          message: '启用收回单失败：付款记录创建失败',
          error: paymentErr.message
        });
      }
    }

    // 获取更新后的工厂账户完整信息 - 添加组织ID过滤，修复字段名
    const [updatedFactory] = await conn.query('SELECT id, name, balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // orgId

    await conn.commit(); // 提交事务
    res.json({
      success: true, 
      message: '收回单已启用',
      data: {
        factoryStatus: updatedFactory[0] // 返回最新的工厂账户状态
      }
    });
  } catch (err) {
    await conn.rollback(); // 回滚事务
    res.status(500).json({ success: false, message: err.message || '启用收回单失败' });
  } finally {
    conn.release(); // 释放连接
  }
});

/**
 * 批量插入收回单明细
 * POST /api/receive-orders/:id/items/batch
 */
router.post('/:id/items/batch', async (req, res) => {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    let items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: '明细不能为空' });
    }
    // 删除原有明细
    await conn.query('DELETE FROM receive_order_items WHERE receive_order_id = ?', [id]);
    // 插入新明细
    for (const item of items) {
      await fillColorAndSizeId(item, req.user.orgId, conn);
      const itemValues = [id, item.product_id, item.product_no, item.color_id, item.color_code, item.size_id, item.size_code, item.weight, item.quantity, item.fee];
      await conn.query(
        'INSERT INTO receive_order_items (receive_order_id, product_id, product_no, color_id, color_code, size_id, size_code, weight, quantity, fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        itemValues
      );
    }
    // 更新主表总数量和总重量
    const total = await conn.query('SELECT SUM(quantity) as totalQuantity, SUM(weight) as totalWeight, SUM(fee) as totalFee FROM receive_order_items WHERE receive_order_id = ?', [id]);
    await conn.query('UPDATE receive_orders SET total_quantity = ?, total_weight = ?, total_fee = ? WHERE id = ?', 
      [total[0][0].totalQuantity || 0, total[0][0].totalWeight || 0, total[0][0].totalFee || 0, id]);
    // 获取收回单信息，包括工厂ID - 添加组织ID过滤
    const [orderInfo] = await conn.query('SELECT factory_id, payment_amount, total_fee FROM receive_orders WHERE id = ? AND orgId = ?', [id, req.user.orgId]);
    // 更新工厂账户状态
    if(orderInfo && orderInfo.length > 0) {
      const factoryId = orderInfo[0].factory_id;
      const totalFee = parseFloat(orderInfo[0].total_fee || 0);
      const paymentAmount = parseFloat(orderInfo[0].payment_amount || 0);
      const [factory] = await conn.query('SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?', [factoryId, req.user.orgId]);
      if(factory && factory.length > 0) {
        let balance = parseFloat(factory[0].balance || 0);
        let debt = parseFloat(factory[0].debt || 0);
        if (balance >= totalFee) {
          balance -= totalFee;
        } else {
          debt += (totalFee - balance);
          balance = 0;
        }
        if (paymentAmount > 0) {
          if (debt > 0) {
            if (paymentAmount >= debt) {
              balance += (paymentAmount - debt);
              debt = 0;
            } else {
              debt -= paymentAmount;
            }
          } else {
            balance += paymentAmount;
          }
        }
        await conn.query('UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?', [balance, debt, factoryId, req.user.orgId]);
      }
    }
    // 获取更新后的工厂信息 - 添加组织ID过滤
    const [orderData] = await conn.query('SELECT factory_id FROM receive_orders WHERE id = ? AND orgId = ?', [id, req.user.orgId]);
    if (orderData && orderData.length > 0) {
      const [updatedFactory] = await conn.query('SELECT id, name, balance, debt FROM factories WHERE id = ? AND orgId = ?', [orderData[0].factory_id, req.user.orgId]);
      await conn.commit();
      res.json({ 
        success: true, 
        message: '批量插入成功',
        data: {
          factoryStatus: updatedFactory[0] // 返回最新的工厂账户状态
        }
      });
    } else {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: '未找到当前组织下的收回单'
      });
    }
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: '批量插入明细失败', error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * 单条插入收回单明细
 * POST /api/receive-orders/:id/items
 */
router.post('/:id/items', async (req, res) => {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const item = req.body;
    if (!item || !item.product_id || !item.product_no) {
      return res.status(400).json({ success: false, message: '明细数据不完整' });
    }
    await fillColorAndSizeId(item, req.user.orgId, conn);
    const itemValues = [id, item.product_id, item.product_no, item.color_id, item.color_code, item.size_id, item.size_code, item.weight, item.quantity, item.fee];
    await conn.query(
      'INSERT INTO receive_order_items (receive_order_id, product_id, product_no, color_id, color_code, size_id, size_code, weight, quantity, fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      itemValues
    );
    // 更新主表总数量和总重量
    const total = await conn.query('SELECT SUM(quantity) as totalQuantity, SUM(weight) as totalWeight, SUM(fee) as totalFee FROM receive_order_items WHERE receive_order_id = ?', [id]);
    await conn.query('UPDATE receive_orders SET total_quantity = ?, total_weight = ?, total_fee = ? WHERE id = ?', 
      [total[0][0].totalQuantity || 0, total[0][0].totalWeight || 0, total[0][0].totalFee || 0, id]);
    await conn.commit();
    res.json({ success: true, message: '明细添加成功' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: '添加明细失败', error: err.message });
  } finally {
    conn.release();
  }
});

/**
 * 删除明细后同步
 * DELETE /api/receive-orders/:id/items/:itemId
 */
router.delete('/:id/items/:itemId', async (req, res) => {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id, itemId } = req.params;
    await conn.query('DELETE FROM receive_order_items WHERE receive_order_id = ? AND id = ?', [id, itemId]);
    // 更新主表总数量和总重量
    const total = await conn.query('SELECT SUM(quantity) as totalQuantity, SUM(weight) as totalWeight, SUM(fee) as totalFee FROM receive_order_items WHERE receive_order_id = ?', [id]);
    await conn.query('UPDATE receive_orders SET total_quantity = ?, total_weight = ?, total_fee = ? WHERE id = ?', 
      [total[0][0].totalQuantity || 0, total[0][0].totalWeight || 0, total[0][0].totalFee || 0, id]);
    await conn.commit();
    res.json({ success: true, message: '明细删除成功' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: '删除明细失败', error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router; 