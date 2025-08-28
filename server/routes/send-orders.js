// 发出单相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const moment = require('moment'); // 引入moment库用于日期处理
const path = require('path');
const fs = require('fs'); // 添加fs模块引用
const { processImageUrl, processImageUrlSync } = require('../utils/imageProcessor');
const { authenticate } = require('../middleware/auth');
const orgSecurity = require('../utils/orgSecurity');

router.use(authenticate);

/**
 * 获取发出单列表
 * GET /api/send-orders
 */
router.get('/', async (req, res) => {
  try {
    // 记录原始请求参数用于调试
    console.log('[Send Orders] 接收到请求参数:', req.query);
    
    const { page = 1, pageSize = 20, ...filters } = req.query;
    
    // 构建查询条件
    const conditions = [];
    const params = [];
    
    // 强制按当前用户组织ID过滤
    conditions.push('so.orgId = ?');
    params.push(req.user.orgId);
    
    // 🔧 新增：专员角色权限控制 - 只能查看自己制单的订单
    if (req.user.roleId === 4) { // 专员角色
      conditions.push('so.created_by = ?');
      params.push(req.user.userId);
      console.log('[Send Orders] 专员角色权限控制 - 用户ID:', req.user.userId);
    }
    
    if (filters.status !== undefined && filters.status !== null && filters.status !== '') {
      conditions.push('so.status = ?');
      params.push(filters.status);
    }
    
    if (filters.factoryId) {
      conditions.push('so.factory_id = ?');
      params.push(filters.factoryId);
    }
    
    if (filters.processId) {
      conditions.push('so.process_id = ?');
      params.push(filters.processId);
    }
    
    // 更彻底的日期处理
    if (filters.startDate && filters.endDate) {
      try {
        // 使用moment严格验证日期格式
        const start = moment(filters.startDate);
        const end = moment(filters.endDate);
        
        if (start.isValid() && end.isValid()) {
          const startDate = start.format('YYYY-MM-DD 00:00:00');
          const endDate = end.format('YYYY-MM-DD 23:59:59');
          
          conditions.push('so.created_at BETWEEN ? AND ?');
          params.push(startDate, endDate);
          
          console.log('[Send Orders] 处理后的日期参数:', { startDate, endDate });
        } else {
          console.warn('[Send Orders] 无效的日期格式:', {
            startDate: filters.startDate,
            endDate: filters.endDate,
            isStartValid: start.isValid(),
            isEndValid: end.isValid()
          });
        }
      } catch (dateError) {
        console.error('[Send Orders] 日期处理错误:', dateError);
        // 不添加日期条件，避免错误
      }
    }
    
    if (filters.keyword) {
      conditions.push('(so.order_no LIKE ? OR so.remark LIKE ?)');
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`);
    }
    
    // 🔧 新增：支持前端传递的制单人筛选（兼容专员角色）
    if (filters.createdBy) {
      conditions.push('so.created_by = ?');
      params.push(filters.createdBy);
    }
    
    if (filters.createdByUsername) {
      conditions.push('u.username = ?');
      params.push(filters.createdByUsername);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // 简化计数查询，不使用JOIN，避免参数问题
    const countSql = `
      SELECT COUNT(*) AS total 
      FROM send_orders so 
      ${whereClause}
    `;
    
    // 独立执行计数查询
    console.log('[Send Orders] 计数SQL:', countSql);
    console.log('[Send Orders] 计数参数:', params);
    
    let total = 0;
    try {
      const countResults = await db.executeQuery(countSql, params);
      total = countResults && countResults[0] ? countResults[0].total : 0;
      console.log('[Send Orders] 计数结果:', total);
    } catch (countError) {
      console.error('[Send Orders] 计数查询错误:', countError);
      // 继续执行主查询，即使计数失败
    }
    
    // 计算分页参数
    const offset = parseInt(page) > 0 ? (parseInt(page) - 1) * parseInt(pageSize) : 0;
    const limit = parseInt(pageSize) > 0 ? parseInt(pageSize) : 20;
    
    // 主查询SQL - 直接在SQL中嵌入LIMIT值，避免参数绑定问题
    const sql = `
      SELECT 
        so.*,
        f.name AS factoryName,
        p.name AS processName,
        u.real_name AS creatorName,
        DATE_FORMAT(so.created_at, '%Y-%m-%d') AS orderDate
      FROM send_orders so
      LEFT JOIN factories f ON so.factory_id = f.id
      LEFT JOIN processes p ON so.process_id = p.id
      LEFT JOIN users u ON so.created_by = u.id
      ${whereClause}
      ORDER BY so.created_at DESC
      LIMIT ${offset}, ${limit}
    `;
    
    // 记录数据查询的SQL和参数
    console.log('[Send Orders] 数据查询SQL:', sql);
    console.log('[Send Orders] 数据查询参数:', params);
    
    // 执行数据查询
    const orders = await db.executeQuery(sql, params);
    
    // 处理返回数据
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
      remark: order.remark,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      creator: order.creatorName || '', // 制单人信息
      date: order.orderDate,
      factory: order.factoryName || '未知工厂',
      process: order.processDirectName || order.process || order.processName || '未知工序',
      staff: order.creatorName || '', // 兼容字段：制单人
      orderType: 'send'
    }));
    
    // 添加制单人信息验证日志
    console.log('[Send Orders] 制单人信息验证:', {
      total: processedOrders.length,
      sampleData: processedOrders.slice(0, 3).map(order => ({
        orderNo: order.orderNo,
        creator: order.creator,
        staff: order.staff,
        rawCreatorName: orders.find(o => o.id === order.id)?.creatorName
      }))
    });
    
    console.log('[Send Orders] 查询成功:', {
      total,
      page,
      pageSize,
      recordCount: processedOrders.length
    });
    
    res.json({
      success: true,
      data: {
        records: processedOrders,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (err) {
    console.error('[Send Orders] 查询失败:', err);
    res.status(500).json({
      success: false,
      message: '获取发出单列表失败',
      error: err.message
    });
  }
});

// 新增发出单（主表+明细一体化写入）
router.post('/', async (req, res) => {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const data = req.body;
    const { items, ...mainData } = data;

    // 字段映射，移除 processId 相关逻辑
    const camelToSnake = {
      factoryId: 'factory_id',
      processId: 'process_id',
      totalWeight: 'total_weight',
      totalQuantity: 'total_quantity',
      totalFee: 'total_fee',
      remarkImages: 'remark_images',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      createdBy: 'created_by'
    };
    const mappedMainData = {};
    Object.keys(mainData).forEach(key => {
      if (camelToSnake[key]) {
        mappedMainData[camelToSnake[key]] = mainData[key];
      } else {
        mappedMainData[key] = mainData[key];
      }
    });

    // 处理照片数据：将数组转换为JSON字符串 - 参考收回单逻辑
    console.log('[POST send-orders] 处理前的remarkImages:', mainData.remarkImages);
    console.log('[POST send-orders] 映射后的remark_images:', mappedMainData.remark_images);
    
    let remarkImages = null;
    if (mainData.remarkImages && Array.isArray(mainData.remarkImages)) {
      remarkImages = JSON.stringify(mainData.remarkImages);
      console.log('[POST send-orders] JSON序列化后的remarkImages:', remarkImages);
    } else {
      console.log('[POST send-orders] remarkImages字段为空或不是数组，设置为null');
    }
    
    // 强制设置remark_images字段，确保不会被过滤掉
    mappedMainData.remark_images = remarkImages;

    // 新增：写入当前登录用户ID为created_by
    mappedMainData['created_by'] = req.user.userId;
    
    // 确保 process_id 字段存在，如果不存在则设置默认值0
    if (mappedMainData['process_id'] === undefined) {
      mappedMainData['process_id'] = 0;
    }

    // 新增：process_id 有效性校验
    const processIdToCheck = mappedMainData['process_id'];
    if (!processIdToCheck || isNaN(processIdToCheck) || parseInt(processIdToCheck) <= 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: '工序ID不能为空且必须为正整数'
      });
    }
    // 校验 process_id 是否存在且属于当前组织
    const [processRows] = await conn.query('SELECT id FROM processes WHERE id = ? AND orgId = ?', [processIdToCheck, req.user.orgId]);
    if (!processRows || processRows.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: '工序ID无效或不属于当前组织'
      });
    }

    // 只允许数据库实际存在的字段
    const allowedMainFields = [
      'order_no',
      'orgId', 'factory_id', 'process_id', 'process', 'total_weight', 'total_quantity',
      'total_fee', 'remark', 'remark_images', 'status', 'created_by', 'created_at', 'updated_at'
    ];
    const mainFields = Object.keys(mappedMainData).filter(key => allowedMainFields.includes(key));
    const mainValues = mainFields.map(key => mappedMainData[key]);
    
    console.log('[POST send-orders] 最终插入的字段:', mainFields);
    console.log('[POST send-orders] 最终插入的值:', mainValues);
    console.log('[POST send-orders] remark_images是否在字段列表中:', mainFields.includes('remark_images'));
    
    // 强制检查请求体中的 orgId 是否与当前用户组织ID一致
    // 并且确保 orgId 被添加到插入字段和参数中
    const reqOrgId = mappedMainData.orgId || mainData.orgId; // 兼容从不同地方获取
    
    // 使用安全验证工具
    try {
      orgSecurity.validateOrgAccess(reqOrgId, req.user.orgId, 'create_send_order');
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
    mappedMainData.orgId = req.user.orgId;
    
    // 如果 orgId 不在 mainFields 中，强制添加
    if (!mainFields.includes('orgId')) {
        mainFields.push('orgId');
        mainValues.push(req.user.orgId);
    } else {
        // 如果 orgId 在 mainFields 中，确保其值是 req.user.orgId
        const orgIdIndex = mainFields.indexOf('orgId');
        mainValues[orgIdIndex] = req.user.orgId;
    }
    
    // 确保 created_by 字段一定插入
    if (!mainFields.includes('created_by')) {
        mainFields.push('created_by');
        mainValues.push(req.user.userId);
    } else {
        // 如果已存在，确保值为当前用户ID
        const idx = mainFields.indexOf('created_by');
        mainValues[idx] = req.user.userId;
    }
    
    // 获取当前最大单号并生成新单号
    let orderNo = 'F0001'; // 默认起始单号
    // 修正：只查本组织下的最大单号
    const [maxOrderResult] = await conn.query('SELECT order_no FROM send_orders WHERE orgId = ? AND order_no LIKE "F%" ORDER BY order_no DESC LIMIT 1', [req.user.orgId]);
    
    if (maxOrderResult && maxOrderResult.length > 0) {
      const lastOrderNo = maxOrderResult[0].order_no;
      // 提取数字部分
      const numPart = parseInt(lastOrderNo.substring(1), 10);
      if (!isNaN(numPart)) {
        // 数字部分+1，并确保长度为4位（添加前导0）
        const newNumPart = (numPart + 1).toString().padStart(4, '0');
        orderNo = `F${newNumPart}`;
      }
    }
    
    mainFields.unshift('order_no');
    mainValues.unshift(orderNo);
    // 确保占位符数量与字段数量一致（在添加order_no后重新计算）
    const mainPlaceholders = mainFields.map(() => '?').join(',');
    
    if (mainFields.length === 0 || mainValues.every(v => v === undefined || v === null || v === '')) {
      throw new Error('主表插入字段或参数为空，请检查前端传参和字段映射！');
    }

    // 2. 插入主表
    const mainSql = `INSERT INTO send_orders (${mainFields.join(',')}) VALUES (${mainPlaceholders})`;
    
    // 确保mainFields和mainValues数组长度相同
    if (mainFields.length !== mainValues.length) {
      console.error('SQL错误: 字段数量与值数量不匹配', 
        '字段数:', mainFields.length, 
        '值数量:', mainValues.length,
        '字段:', mainFields,
        '值:', mainValues);
      throw new Error('SQL错误: 字段数量与值数量不匹配');
    }
    
    const [mainResult] = await conn.query(mainSql, mainValues);
    const sendOrderId = mainResult.insertId;

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
          console.warn('跳过无有效字段的明细:', item);
          continue;
        }
        await fillColorAndSizeId(item, req.user.orgId, conn);
        const itemValues = itemFields.map(f => item[f]);
        // 明细表必须带 send_order_id
        itemFields.unshift('send_order_id');
        itemValues.unshift(sendOrderId);
        const finalPlaceholders = itemFields.map(() => '?').join(',');
        const itemSql = `INSERT INTO send_order_items (${itemFields.join(',')}) VALUES (${finalPlaceholders})`;
        await conn.query(itemSql, itemValues);
      }
    }

    await conn.commit();
    res.status(201).json({ success: true, id: sendOrderId, order_no: orderNo });
  } catch (err) {
    await conn.rollback();
    console.error('一体化写入发出单失败:', err);
    res.status(500).json({ success: false, message: '新增发出单失败', error: err.message });
  } finally {
    conn.release();
  }
});

// 获取发出单汇总数据
router.get('/summary', async (req, res) => {
  console.log('Received GET /api/send-orders/summary request. Params:', req.query);
  try {
    const { factoryId, productId, startDate, endDate } = req.query;
    
    // 参数验证
    if (!factoryId || !startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少必要参数', 
        error: '工厂ID、开始日期和结束日期为必填项' 
      });
    }
    
    // 更严格的日期格式化和验证
    let formattedStartDate, formattedEndDate;
    try {
      const start = moment(startDate);
      const end = moment(endDate);
      
      if (!start.isValid()) {
        throw new Error(`起始日期格式无效: ${startDate}`);
      }
      
      if (!end.isValid()) {
        throw new Error(`结束日期格式无效: ${endDate}`);
      }
      
      formattedStartDate = start.format('YYYY-MM-DD');
      formattedEndDate = end.format('YYYY-MM-DD');
      
      console.log('[SendOrders Summary] 处理后的日期:', {
        startDate: formattedStartDate,
        endDate: formattedEndDate
      });
    } catch (dateError) {
      console.error('[SendOrders Summary] 日期解析错误:', dateError);
      return res.status(400).json({
        success: false,
        message: '日期格式错误',
        error: dateError.message
      });
    }
    
    // 安全转换参数类型
    const safeFactoryId = parseInt(factoryId) || 0;
    const safeProductId = productId ? (parseInt(productId) || 0) : null;
    // 强制使用当前用户组织ID，不再从req.query获取
    const safeOrgId = req.user.orgId; 

    // 构建基础SQL查询
    let sql = `
      SELECT 
        soi.product_id AS productId,
        p.code AS productNo,
        p.name AS productName,
        p.image AS imageUrl,
        COALESCE(pr.name, '未知工序') AS process,
        SUM(soi.quantity) AS quantity,
        SUM(soi.weight) AS weight
      FROM send_orders so
      JOIN send_order_items soi ON so.id = soi.send_order_id
      JOIN products p ON soi.product_id = p.id
      LEFT JOIN processes pr ON so.process_id = pr.id
      WHERE so.status = 1
        AND so.factory_id = ?
        AND so.orgId = ?
        AND DATE(so.created_at) BETWEEN ? AND ?
    `;

    // 创建参数数组，使用参数化查询防止SQL注入
    const params = [safeFactoryId, safeOrgId, formattedStartDate, formattedEndDate];

    if (safeProductId) {
      sql += ` AND soi.product_id = ?`;
      params.push(safeProductId);
    }

    sql += ' GROUP BY soi.product_id, p.code, p.name, p.image, pr.name';

    console.log('[SendOrders Summary] 执行SQL:', sql);
    console.log('[SendOrders Summary] SQL参数:', params);

    const results = await db.executeQuery(sql, params);

    console.log('[SendOrders Summary] 原始查询结果数量:', results ? results.length : 0);

    // 安全处理图片URL
    const processedResults = (results || []).map(item => {
      try {
        if (!item.imageUrl) {
          return {
            ...item,
            imageUrl: '/images/default-product.png',
            originalImageUrl: '/images/default-product.png'
          };
        }
        
        const { thumbnailUrl, originalImageUrl } = processImageUrlSync(item.imageUrl, 'SendOrders');
        return {
          ...item,
          imageUrl: thumbnailUrl || '/images/default-product.png',
          originalImageUrl: originalImageUrl || '/images/default-product.png'
        };
      } catch (imgError) {
        console.warn(`[SendOrders Summary] 图片处理错误:`, imgError);
        // 返回默认图片
        return {
          ...item,
          imageUrl: '/images/default-product.png',
          originalImageUrl: '/images/default-product.png'
        };
      }
    });

    console.log('[SendOrders Summary] 处理后的结果数量:', processedResults.length);

    res.json({ success: true, data: processedResults });
  } catch (error) {
    console.error('[SendOrders Summary] 获取发出单汇总数据时出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取发出单汇总数据失败',
      error: error.message 
    });
  }
});

// 获取发出单详情
router.get('/:id', async (req, res) => {
  console.log('Received GET /api/send-orders/:id request. Id:', req.params.id);
  try {
    const { id } = req.params;
    // 修改SQL，连接工厂表、工序表和用户表，并添加组织ID过滤
    const orderSql = `
      SELECT 
        so.*, 
        f.name AS factoryName, 
        p.name AS processName, 
        so.process AS processDirectName, 
        u.real_name AS creatorName,  -- 新增
        DATE_FORMAT(so.created_at, '%Y-%m-%d') AS orderDate
      FROM send_orders so
      LEFT JOIN factories f ON so.factory_id = f.id
      LEFT JOIN processes p ON so.process_id = p.id
      LEFT JOIN users u ON so.created_by = u.id  -- 新增
      WHERE so.id = ? AND so.orgId = ?
    `;
    const [order] = await db.executeQuery(orderSql, [id, req.user.orgId]);
    if (!order || order.length === 0) {
        return res.status(404).json({ success: false, message: '未找到发出单' });
    }
    // 获取订单明细，并连接产品表获取产品详情
    const itemsSql = `
      SELECT 
        soi.*, 
        p.name AS productName, 
        p.code AS productCode, 
        p.image, 
        p.colors, 
        p.sizes
      FROM send_order_items soi
      JOIN products p ON soi.product_id = p.id
      WHERE soi.send_order_id = ?
    `;
    const items = await db.executeQuery(itemsSql, [id]);
    // 处理明细数据，转换命名为驼峰风格
     const processedItems = items.map(item => ({
      id: item.id,
      sendOrderId: item.send_order_id,
      productId: item.product_id,
      productNo: item.product_no || item.productCode,
      productName: item.productName || '',
      colorId: item.color_id,
      colorCode: item.color_code,
      sizeId: item.size_id,
      sizeCode: item.size_code,
      weight: item.weight,
      quantity: item.quantity,
      fee: item.fee,
      // 兼容API
      color: item.color_code,
      size: item.size_code,
      image: item.image,
      // 颜色和尺码选项数组
      colorOptions: item.colors ? item.colors.split(',').map(c => c.trim()).filter(c => c) : [],
      sizeOptions: item.sizes ? item.sizes.split(',').map(s => s.trim()).filter(s => s) : []
    }));
    // 处理备注照片：将JSON字符串转换为数组
    let remarkImages = [];
    console.log('[getSendOrderDetail] 原始remark_images字段:', order.remark_images);
    console.log('[getSendOrderDetail] remark_images类型:', typeof order.remark_images);
    if (order.remark_images) {
      try {
        remarkImages = JSON.parse(order.remark_images);
        console.log('[getSendOrderDetail] 解析后的remarkImages:', remarkImages);
      } catch (e) {
        console.error('解析备注照片JSON失败:', e);
        remarkImages = [];
      }
    } else {
      console.log('[getSendOrderDetail] remark_images字段为空或null');
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
      process: order.processDirectName || order.process || order.processName || '未知工序',
      products: processedItems, // 兼容旧API
      orderType: 'send'
    };
    console.log('Backend returning send order detail, ID:', id);
    res.json({ success: true, data: orderDetail });
  } catch (err) {
    console.error('Backend error fetching send order detail:', err);
    res.status(500).json({ success: false, message: '获取发出单详情失败', error: err.message });
  }
});

// 批量插入发出单明细
router.post('/:id/items/batch', async (req, res) => {
  console.log('Received POST /api/send-orders/:id/items/batch request. Id:', req.params.id, 'Items count:', req.body.length);
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    
    // 1. 查单据并校验权限 - 添加组织ID过滤
    const [order] = await conn.query('SELECT id, orgId FROM send_orders WHERE id = ? AND orgId = ?', [id, req.user.orgId]); // 添加组织ID过滤
     if (!order || order.length === 0) {
         await conn.rollback();
         return res.status(404).json({ success: false, message: '未找到当前组织下的发出单' });
    }

    let items = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('明细不能为空');
    }
    // 检查 product_id 是否有效
    const productIds = items.map(item => item.product_id);
    // 使用 IN 子句并过滤掉无效 ID
    const validProductIds = productIds.filter(id => id !== null && id !== undefined);
    if (validProductIds.length > 0) {
        const productCheckSql = `SELECT COUNT(*) AS count FROM products WHERE id IN (${validProductIds.map(() => '?').join(',')})`;
        console.log('Product Check SQL:', productCheckSql, 'Params:', validProductIds);
        const [productCheckResult] = await conn.query(productCheckSql, validProductIds);
        if (productCheckResult[0].count !== validProductIds.length) {
           console.warn('批量插入明细：部分产品ID无效或不存在', productIds);
          // 可以选择中断或记录错误，这里先允许继续
        }
    } else if (productIds.length > 0) {
         console.warn('批量插入明细：所有产品ID均无效', productIds);
         // 可以选择中断
    }

    for (const item of items) {
      // 仅插入包含有效 send_order_id 和 product_id 的明细
      if (id && item.product_id) {
           const insertItemSql = 'INSERT INTO send_order_items (send_order_id, product_id, product_no, color_id, color_code, size_id, size_code, weight, quantity, fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
           await fillColorAndSizeId(item, req.user.orgId, conn);
           const insertItemValues = [id, item.product_id, item.product_no, item.color_id, item.color_code, item.size_id, item.size_code, item.weight, item.quantity, item.fee];
            console.log('Insert Item SQL:', insertItemSql, 'Values:', insertItemValues);
            await conn.query(insertItemSql, insertItemValues);
      } else {
          console.warn('跳过无效明细项：', item);
      }
    }
    // 更新主表总数量和总重量 - 添加组织ID过滤
    const [totalStats] = await conn.query('SELECT SUM(quantity) as totalQuantity, SUM(weight) as totalWeight FROM send_order_items WHERE send_order_id = ?', [id]);
    await conn.query('UPDATE send_orders SET total_quantity = ?, total_weight = ? WHERE id = ? AND orgId = ?', [totalStats[0]?.totalQuantity || 0, totalStats[0]?.totalWeight || 0, id, req.user.orgId]); // 添加组织ID过滤
    
    await conn.commit();
    console.log('Batch insert send order items successful for order:', id);
    res.status(201).json({ success: true, message: '批量插入成功' });
  } catch (err) {
    await conn.rollback();
    console.error('Backend error batch inserting send order items:', err);
    res.status(500).json({ success: false, message: '批量插入明细失败', error: err.message });
  } finally {
    conn.release();
  }
});

// 删除发出单（作废）
router.delete('/:id', async (req, res) => {
   console.log('Received DELETE /api/send-orders/:id request. Id:', req.params.id);
   const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    // 1. 查原单据并校验权限 - 添加组织ID过滤
    const [order] = await conn.query('SELECT id, status, factory_id FROM send_orders WHERE id = ? AND orgId = ?', [id, req.user.orgId]); // 添加组织ID过滤
    if (!order || order.length === 0) {
        // 如果找不到单据，可能是ID错误，也可能是跨组织访问
        await conn.rollback();
        return res.status(404).json({ success: false, message: '未找到当前组织下的发出单' });
    }
    if (order[0].status === 0) { // 假设0表示已作废
        await conn.rollback();
        return res.status(400).json({ success: false, message: '单据已是作废状态' });
    }

    // 2. 查工厂账户并校验权限 - 添加组织ID过滤
    const [factory] = await conn.query('SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // 添加组织ID过滤

     // 检查是否找到了对应组织下的工厂
    if (!factory || factory.length === 0) {
        await conn.rollback();
        return res.status(404).json({
            success: false,
            message: '未找到当前组织下的指定工厂',
        });
    }

    // 4. 更新工厂账户 - 添加组织ID过滤
    await conn.query('UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?', [factory[0].balance, factory[0].debt, order[0].factory_id, req.user.orgId]); // 添加组织ID过滤
    
    // 5. 更新单据状态为作废 (0) - 添加组织ID过滤
    const updateResult = await conn.query('UPDATE send_orders SET status = 0 WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]); // 添加组织ID过滤
     if (updateResult[0].affectedRows === 0) {
         await conn.rollback();
        throw new Error('作废单据失败');
    }

    await conn.commit();
    console.log('Send order voided successfully:', id);
    res.json({ success: true, message: '发出单已作废' });
  } catch (err) {
    await conn.rollback();
    console.error('Backend error voiding send order:', err);
    res.status(500).json({ success: false, message: err.message || '作废发出单失败' });
  } finally {
    conn.release();
  }
});

// 启用发出单 (将状态从作废改为启用，假设启用状态是1)
router.put('/:id/enable', async (req, res) => {
   console.log('Received PUT /api/send-orders/:id/enable request. Id:', req.params.id);
   const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    // 1. 查原单据并校验权限 - 添加组织ID过滤
     const [order] = await conn.query('SELECT id, status, factory_id FROM send_orders WHERE id = ? AND orgId = ?', [id, req.user.orgId]); // 添加组织ID过滤
    if (!order || order.length === 0) {
        // 如果找不到单据，可能是ID错误，也可能是跨组织访问
        await conn.rollback();
        return res.status(404).json({ success: false, message: '未找到当前组织下的发出单' });
    }
    if (order[0].status !== 0) { // 假设0表示已作废
        await conn.rollback();
        return res.status(400).json({ success: false, message: '单据不是作废状态' });
    }

    // 2. 查工厂账户并校验权限 - 添加组织ID过滤
    const [factory] = await conn.query('SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // 添加组织ID过滤

     // 检查是否找到了对应组织下的工厂
    if (!factory || factory.length === 0) {
        await conn.rollback();
        return res.status(404).json({
            success: false,
            message: '未找到当前组织下的指定工厂',
        });
    }

    // 4. 更新工厂账户 - 添加组织ID过滤
    await conn.query('UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?', [factory[0].balance, factory[0].debt, order[0].factory_id, req.user.orgId]); // 添加组织ID过滤
    
    // 5. 更新单据状态为启用 (1) - 添加组织ID过滤
    const updateResult = await conn.query('UPDATE send_orders SET status = 1 WHERE id = ? AND orgId = ?', [req.params.id, req.user.orgId]); // 添加组织ID过滤
     if (updateResult[0].affectedRows === 0) {
         await conn.rollback();
        throw new Error('启用单据失败');
    }

    // 获取更新后的工厂账户完整信息 - 添加组织ID过滤
    const [updatedFactory] = await conn.query('SELECT id, name, balance, debt FROM factories WHERE id = ? AND orgId = ?', [order[0].factory_id, req.user.orgId]); // 添加组织ID过滤

    await conn.commit();
    console.log('Send order enabled successfully:', id);
    res.json({ success: true, message: '发出单已启用' });
  } catch (err) {
    await conn.rollback();
    console.error('Backend error enabling send order:', err);
    res.status(500).json({ success: false, message: err.message || '启用发出单失败' });
  } finally {
    conn.release();
  }
});

// 在插入 send_order_items 明细前，补全 color_id/size_id。
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

module.exports = router; 