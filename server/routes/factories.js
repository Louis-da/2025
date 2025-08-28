// 工厂相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * 获取工厂列表
 * GET /api/factories
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '' } = req.query;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;
    
    if (!orgId) {
       console.error('factories / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 转换为数字类型并验证
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 10)); // 限制最大100条
    
    // 🔧 新增：同时查询统计信息，一次请求返回完整数据
    const [statisticsResult] = await db.executeQuery(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactiveCount
      FROM factories 
      WHERE orgId = ?
    `, [orgId]);
    
    const statistics = {
      totalCount: parseInt(statisticsResult[0]?.totalCount || 0),
      activeCount: parseInt(statisticsResult[0]?.activeCount || 0),
      inactiveCount: parseInt(statisticsResult[0]?.inactiveCount || 0)
    };
    
    console.log('[factories list] 统计信息查询结果:', statistics);
    
    // 构建SQL查询 - 工厂管理界面需要显示所有工厂（包括停用的）
    let sql = "SELECT * FROM factories WHERE orgId = ?";
    let countSql = "SELECT COUNT(*) as total FROM factories WHERE orgId = ?";
    let params = [orgId];
    let countParams = [orgId];
    
    // 添加关键词搜索条件
    if (keyword && keyword.trim()) {
      const searchKeyword = `%${keyword.trim()}%`;
      sql += " AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)";
      countSql += " AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)";
      params.push(searchKeyword, searchKeyword, searchKeyword);
      countParams.push(searchKeyword, searchKeyword, searchKeyword);
    }
    
    // 添加排序和分页 - 直接拼接LIMIT和OFFSET，不使用参数
    const offset = (pageNum - 1) * pageSizeNum;
    
    // 确保LIMIT和OFFSET是正整数，并直接拼接到SQL中
    const limitValue = parseInt(pageSizeNum, 10);
    const offsetValue = parseInt(offset, 10);
    
    sql += ` ORDER BY id DESC LIMIT ${limitValue} OFFSET ${offsetValue}`;
    
    // 执行查询
    const factories = await db.executeQuery(sql, params);
    const countResult = await db.executeQuery(countSql, countParams);
    const totalCount = countResult[0].total;
    
    // 安全处理工序字段并统一status格式
    const processedFactories = factories.map(factory => {
      // 🔧 重要修复：统一status字段格式，确保与其他API一致
      const formattedFactory = {
        ...factory,
        processes: safeParseProcesses(factory.processes),
        status: factory.status === 1 ? 'active' : 'inactive'  // 数据库数字 -> 字符串格式
      };
      
      return formattedFactory;
    });
    
    console.log(`工厂列表查询成功: orgId=${orgId}, page=${pageNum}, pageSize=${pageSizeNum}, total=${totalCount}, returned=${processedFactories.length}`);
    
    // 🚀 优化：返回数据同时包含列表和统计信息
    res.json({
      success: true,
      data: processedFactories,
      totalCount: totalCount,
      page: pageNum,
      pageSize: pageSizeNum,
      hasMore: totalCount > pageNum * pageSizeNum,
      // 🎯 新增：统计信息直接回传
      statistics: statistics
    });
    
  } catch (error) {
    console.error('获取工厂列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取工厂列表失败',
      error: error.message
    });
  }
});

/**
 * 获取工厂统计信息
 * GET /api/factories/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    console.log('[factories/stats] 🔍 开始查询工厂统计信息, orgId:', orgId);
    
    // 查询工厂统计信息
    const statsResult = await db.executeQuery(`
      SELECT 
        COUNT(*) as totalCount,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as activeCount,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as inactiveCount
      FROM factories 
      WHERE orgId = ?
    `, [orgId]);
    
    const stats = {
      totalCount: parseInt(statsResult[0]?.totalCount || 0),
      activeCount: parseInt(statsResult[0]?.activeCount || 0),
      inactiveCount: parseInt(statsResult[0]?.inactiveCount || 0)
    };
    
    console.log('[factories/stats] ✅ 统计查询成功:', stats);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (err) {
    console.error('[factories/stats] ❌ 获取工厂统计信息失败:', err);
    res.status(500).json({
      success: false,
      message: '获取工厂统计信息失败',
      error: err.message
    });
  }
});

/**
 * 获取工厂详情
 * GET /api/factories/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;
    
    if (!orgId) {
      console.error('factories /:id 接口：req.user.orgId 为空');
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    // 强制按当前用户组织ID过滤
    const factory = await db.factories.findOne({ id: parseInt(id), orgId: orgId });
    
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    // 处理factory对象，确保processes是数组
    const processedFactory = {
      ...factory,
      _id: factory.id,
      orgId: factory.orgId,
      phone: factory.phone,
      status: factory.status == 1 ? 'active' : 'inactive',
      processes: safeParseProcesses(factory.processes) // 确保processes是数组
    };
    
    res.json({
      success: true,
      data: processedFactory
    });
  } catch (err) {
    console.error('获取工厂详情失败:', err);
    res.status(500).json({
      success: false,
      message: '获取工厂详情失败',
      error: err.message
    });
  }
});

/**
 * 获取工厂账款记录
 * GET /api/factories/:id/accounts
 */
router.get('/:id/accounts', async (req, res) => {
  try {
    const { id } = req.params;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;
    
    if (!orgId) {
      console.error('factories /:id/accounts 接口：req.user.orgId 为空');
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    // 检查工厂是否存在 - 强制按当前用户组织ID过滤
    const factory = await db.factories.findOne({ id: parseInt(id), orgId: orgId });
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    // 从收回单数据中获取账款记录
    const receiveOrderRecords = await db.executeQuery(`
      SELECT 
        ro.id,
        DATE_FORMAT(ro.created_at, '%Y-%m-%d') as date,
        ro.order_no as orderNo,
        ro.total_fee as fee,
        COALESCE(ro.payment_amount, 0) as payAmount,
        ro.payment_method,
        'receive_order' as recordType,
        ro.created_at as sortTime
      FROM receive_orders ro
      WHERE ro.factory_id = ? AND ro.orgId = ? AND ro.status = 1
    `, [parseInt(id), orgId]);
    
    // 从付款记录中获取有效的付款流水（只查询status=1的记录）
    let paymentRecords = [];
    try {
      // 查询收回单号，用于排除收回单支付产生的付款记录
      // 注意：需要排除所有收回单（包括已作废的），因为作废收回单的付款记录也应该被排除
      const receiveOrderNos = await db.executeQuery(`
        SELECT DISTINCT order_no FROM receive_orders 
        WHERE factory_id = ? AND orgId = ?
      `, [parseInt(id), orgId]);
      
      const excludeOrderNos = receiveOrderNos.map(row => row.order_no);
      
      let paymentQuery = `
        SELECT 
          fp.id,
          DATE_FORMAT(fp.createTime, '%Y-%m-%d') as date,
          fp.payment_no as orderNo,
          0 as fee,
          fp.amount as payAmount,
          'payment' as recordType,
          fp.createTime as sortTime,
          fp.payment_method,
          fp.remark
        FROM factory_payments fp
        WHERE fp.factory_id = ? AND fp.orgId = ? AND fp.status = 1
      `;
      
      const paymentParams = [parseInt(id), orgId];
      
      // 如果有收回单号需要排除，添加NOT IN条件
      if (excludeOrderNos.length > 0) {
        const placeholders = excludeOrderNos.map(() => '?').join(',');
        paymentQuery += ` AND fp.payment_no NOT IN (${placeholders})`;
        paymentParams.push(...excludeOrderNos);
      }
      
      paymentRecords = await db.executeQuery(paymentQuery, paymentParams);
    } catch (err) {
      console.warn('付款记录表可能不存在，跳过付款记录查询:', err.message);
      paymentRecords = [];
    }
    
    // 合并两种记录并按时间倒序排序（最新的在前）
    const allRecords = [...receiveOrderRecords, ...paymentRecords]
      .sort((a, b) => new Date(b.sortTime) - new Date(a.sortTime));
    
    // 获取工厂当前真实状态作为基准
    const currentBalance = parseFloat(factory.balance || 0);
    const currentDebt = parseFloat(factory.debt || 0);
    
    // 当前账户状态：正数表示欠款，负数表示余款
    let currentRunningBalance = currentDebt - currentBalance;
    
    // 从最新记录往回计算，确保累计结余逻辑正确
    const processedRecords = allRecords.map((record, index) => {
      const fee = parseFloat(record.fee || 0);
      const payAmount = parseFloat(record.payAmount || 0);
      
      // 显示当前这条记录时的累计结余
      const recordBalance = currentRunningBalance;
      
      // 为下一条记录计算状态（往历史倒推）
      currentRunningBalance = currentRunningBalance - fee + payAmount;
      
      // 根据记录类型和支付金额判断支付方式
      let payMethod = '未付';
      if (record.recordType === 'payment') {
        // 付款记录
        const methodMap = {
          'cash': '现金',
          'bank': '银行',
          'wechat': '微信',
          'alipay': '支付宝'
        };
        payMethod = methodMap[record.payment_method] || '其他';
      } else if (record.recordType === 'receive_order') {
        // 收回单：直接使用数据库中的真实支付方式
        payMethod = record.payment_method || '未付';
      }
      
      return {
        id: record.id,
        date: record.date,
        orderNo: record.orderNo,
        fee: fee,
        payAmount: payAmount,
        payMethod: payMethod,
        remainBalance: recordBalance, // 截止到这条记录的累计结余
        recordType: record.recordType,
        remark: record.remark || ''
      };
    });
    
    // 返回格式化后的账款记录
    res.json({
      success: true,
      data: processedRecords
    });
  } catch (err) {
    console.error('获取工厂账款记录失败:', err);
    res.status(500).json({
      success: false,
      message: '获取工厂账款记录失败',
      error: err.message
    });
  }
});

/**
 * 添加工厂
 * POST /api/factories
 */
router.post('/', async (req, res) => {
  try {
    const factoryData = req.body;
    console.log('收到的工厂数据:', factoryData);
    
    // 🔒 安全第一：强制使用当前登录用户的组织ID，完全忽略请求体中的任何组织ID字段
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('factories POST / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 🛡️ 安全强化：删除请求体中所有可能的组织ID字段，防止数据泄露
    delete factoryData.orgId;
    delete factoryData.org_id;
    delete factoryData.organizationId;
    delete factoryData.organization_id;
    
    // 数据转换和验证
    if (!factoryData.name) {
      return res.status(400).json({
        success: false,
        message: '工厂名称不能为空'
      });
    }
    
    // 🔧 新增验证：工序信息为必填
    if (!factoryData.processes || !Array.isArray(factoryData.processes) || factoryData.processes.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择至少一个工序'
      });
    }
    
    // 🔒 强制设置组织ID为当前用户的组织ID，确保数据隔离
    factoryData.orgId = orgId;
    
    // 生成唯一编码（如果未提供）
    if (!factoryData.code) {
      factoryData.code = 'FC' + Date.now().toString().slice(-6);
    }
    
    // 处理状态值转换
    if (typeof factoryData.status === 'string') {
      factoryData.status = factoryData.status === 'active' ? 1 : 0;
    }
    
    // 处理processes字段
    if (factoryData.processes && Array.isArray(factoryData.processes)) {
      factoryData.processes = JSON.stringify(factoryData.processes);
    }
    
    // 处理_id字段，数据库只接受id字段
    if (factoryData._id && !factoryData.id) {
      factoryData.id = factoryData._id;
      delete factoryData._id;
    }
    
    // 删除任何无效的字段以避免数据库错误
    delete factoryData.debt;
    delete factoryData.balance;
    
    // 强制新增的工厂状态为启用 (1)
    factoryData.status = 1;
    
    console.log('🔒 安全验证：准备插入工厂数据，orgId已强制设置为:', orgId);
    
    const result = await db.factories.insertOne(factoryData);
    
    console.log('工厂添加结果:', result);
    
    res.status(201).json({
      success: true,
      message: '工厂添加成功',
      data: {
        id: result.insertId
      }
    });
  } catch (err) {
    console.error('添加工厂失败:', err);
    res.status(500).json({
      success: false,
      message: '添加工厂失败',
      error: err.message
    });
  }
});

/**
 * 更新工厂
 * PUT /api/factories/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const factoryData = req.body;
    
    // 🔒 安全第一：强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('factories PUT /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 🛡️ 安全强化：删除请求体中所有可能的组织ID字段，完全禁止通过此接口修改组织归属
    delete factoryData.orgId;
    delete factoryData.org_id;
    delete factoryData.organizationId;
    delete factoryData.organization_id;
    
    // 处理状态值转换
    if (typeof factoryData.status === 'string') {
      factoryData.status = factoryData.status === 'active' ? 1 : 0;
    }
    
    // 处理processes字段
    if (factoryData.processes && Array.isArray(factoryData.processes)) {
      factoryData.processes = JSON.stringify(factoryData.processes);
    }
    
    // 删除任何无效的字段以避免数据库错误
    delete factoryData._id;
    delete factoryData.debt;
    delete factoryData.balance;
    
    // 🔒 安全验证：只能更新当前用户组织内的工厂
    const result = await db.factories.updateOne(
      { id: parseInt(id), orgId: orgId }, // 双重验证：工厂ID + 组织ID
      factoryData
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要更新的工厂'
      });
    }
    
    console.log(`🔒 安全验证：工厂更新成功，orgId=${orgId}, factoryId=${id}`);
    
    res.json({
      success: true,
      message: '工厂更新成功'
    });
  } catch (err) {
    console.error('更新工厂失败:', err);
    res.status(500).json({
      success: false,
      message: '更新工厂失败',
      error: err.message
    });
  }
});

/**
 * 删除工厂
 * DELETE /api/factories/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('factories DELETE /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    const result = await db.factories.deleteOne({ id: parseInt(id), orgId: orgId }); // 强制按工厂ID和组织ID过滤
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要删除的工厂'
      });
    }
    
    res.json({
      success: true,
      message: '工厂删除成功'
    });
  } catch (err) {
    console.error('删除工厂失败:', err);
    res.status(500).json({
      success: false,
      message: '删除工厂失败',
      error: err.message
    });
  }
});

/**
 * 更新工厂状态
 * PUT /api/factories/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 移除orgId从这里获取
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
      console.error('factories PUT /:id/status 接口：req.user.orgId 为空');
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    // 检查状态值是否有效并转换
    let statusValue;
    if (status === 'active') {
      statusValue = 1;
    } else if (status === 'inactive') {
      statusValue = 0;
    } else {
      return res.status(400).json({
        success: false,
        message: '无效的状态值，只能是 active 或 inactive'
      });
    }
    
    // 检查工厂是否存在，强制按当前用户组织ID过滤
    const factory = await db.factories.findOne({ 
      id: parseInt(id),
      orgId: orgId  // 强制使用当前用户组织ID
    });
    
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    // 更新工厂状态 - 强制按工厂ID和组织ID过滤
    const result = await db.factories.updateOne(
      { id: parseInt(id), orgId: orgId }, // 强制按工厂ID和组织ID过滤
      { status: statusValue } 
    );
    
    if (result.affectedRows === 0) {
      return res.status(500).json({
        success: false,
        message: '更新工厂状态失败'
      });
    }
    
    res.json({
      success: true,
      message: '工厂状态更新成功'
    });
  } catch (err) {
    console.error('更新工厂状态失败:', err);
    res.status(500).json({
      success: false,
      message: '更新工厂状态失败',
      error: err.message
    });
  }
});

/**
 * 添加工厂付款记录
 * POST /api/factories/:id/payments
 */
router.post('/:id/payments', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, remark, imageUrls } = req.body;
    const orgId = req.user.orgId;
    
    if (!orgId) {
      console.error('factories /:id/payments 接口：req.user.orgId 为空');
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    // 验证必要参数
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '付款金额必须大于0'
      });
    }
    
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: '付款方式不能为空'
      });
    }
    
    // 检查工厂是否存在
    const factory = await db.factories.findOne({ id: parseInt(id), orgId: orgId });
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    const conn = await db.pool.getConnection();
    
    try {
      await conn.beginTransaction();
      
      // 生成P0001规则的付款单号 - 改进版：支持重试和并发安全
      let paymentNo = 'P0001';
      let attemptCount = 0;
      const maxAttempts = 5;
      
      while (attemptCount < maxAttempts) {
        try {
          console.log(`[addPayment] 尝试生成付款单号 (第${attemptCount + 1}次)...`);
          
          // 查询当前组织下所有付款记录的最大编号（包括已作废记录）
          const [maxPayResult] = await conn.query(`
            SELECT payment_no FROM factory_payments 
            WHERE orgId = ? AND payment_no REGEXP '^P[0-9]+$' 
            ORDER BY CAST(SUBSTRING(payment_no, 2) AS UNSIGNED) DESC 
            LIMIT 1
          `, [orgId]);
          
          if (maxPayResult && maxPayResult.length > 0) {
            const lastPayNo = maxPayResult[0].payment_no;
            const numPart = parseInt(lastPayNo.substring(1), 10);
            if (!isNaN(numPart)) {
              const newNumPart = (numPart + 1).toString().padStart(4, '0');
              paymentNo = `P${newNumPart}`;
            }
          }
          
          console.log(`[addPayment] 生成付款单号: ${paymentNo}`);
          
          // 尝试插入付款记录，如果单号重复会抛出异常
          await conn.query(`
            INSERT INTO factory_payments (orgId, factory_id, payment_no, amount, payment_method, remark, image_urls, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
          `, [orgId, parseInt(id), paymentNo, amount, paymentMethod, remark || '', imageUrls ? JSON.stringify(imageUrls) : null, req.user.userId || 0]);
          
          console.log(`[addPayment] 付款记录插入成功: ${paymentNo}`);
          break; // 插入成功，跳出重试循环
          
        } catch (insertErr) {
          attemptCount++;
          console.log(`[addPayment] 付款记录插入失败 (第${attemptCount}次):`, insertErr.message);
          
          // 检查是否是单号重复错误
          if (insertErr.code === 'ER_DUP_ENTRY' && insertErr.message.includes('unique_org_payment_no')) {
            if (attemptCount < maxAttempts) {
              console.log(`[addPayment] 检测到单号重复，准备重试...`);
              // 等待随机时间后重试，避免并发冲突
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
              continue;
            }
          }
          
          // 如果不是单号重复错误，或重试次数耗尽，则抛出异常
          throw insertErr;
        }
      }
      
      if (attemptCount >= maxAttempts) {
        throw new Error(`付款单号生成失败：经过${maxAttempts}次重试仍无法生成唯一单号`);
      }
      
      // 更新工厂账户余额和欠款
      const currentBalance = parseFloat(factory.balance || 0);
      const currentDebt = parseFloat(factory.debt || 0);
      const paymentAmount = parseFloat(amount);
      
      let newBalance = currentBalance;
      let newDebt = currentDebt;
      
      // 付款逻辑：先抵消欠款，剩余部分计入余额
      if (newDebt > 0) {
        if (paymentAmount >= newDebt) {
          // 付款金额大于等于欠款，完全抵消欠款，剩余计入余额
          newBalance += (paymentAmount - newDebt);
          newDebt = 0;
        } else {
          // 付款金额小于欠款，部分抵消欠款
          newDebt -= paymentAmount;
        }
      } else {
        // 没有欠款，直接计入余额
        newBalance += paymentAmount;
      }
      
      // 🔧 增强：更新工厂账户，确保数据一致性
      const factoryUpdateResult = await conn.query(`
        UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?
      `, [newBalance, newDebt, parseInt(id), orgId]);
      
      // 验证工厂账户是否成功更新
      if (factoryUpdateResult[0]?.affectedRows === 0) {
        await conn.rollback();
        console.error('[addPayment] 🚨 工厂账户更新失败');
        return res.status(500).json({
          success: false,
          message: '付款失败：工厂账户更新失败'
        });
      }
      
      console.log('[addPayment] 工厂账户更新成功:', {
        factoryId: parseInt(id),
        oldBalance: currentBalance,
        newBalance: newBalance,
        oldDebt: currentDebt,
        newDebt: newDebt,
        paymentAmount: paymentAmount
      });
      
      await conn.commit();
      
      res.json({
        success: true,
        message: '付款记录添加成功',
        data: {
          paymentNo: paymentNo,
          newBalance: newBalance,
          newDebt: newDebt
        }
      });
      
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    
  } catch (err) {
    console.error('添加付款记录失败:', err);
    res.status(500).json({
      success: false,
      message: '添加付款记录失败',
      error: err.message
    });
  }
});

/**
 * 获取工厂付款历史记录
 * GET /api/factories/:id/payment-history
 */
router.get('/:id/payment-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const orgId = req.user.orgId;
    
    // 参数验证
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }

    // 验证并转换参数
    const factoryId = parseInt(id, 10);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20)); // 限制最大100条
    
    if (isNaN(factoryId) || factoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的工厂ID'
      });
    }
    
    // 检查工厂是否存在
    const factory = await db.factories.findOne({ id: factoryId, orgId: orgId });
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    // 计算分页参数
    const offset = (pageNum - 1) * limitNum;
    
    // 🔧 修复：查询收回单号，用于排除收回单支付产生的付款记录
    // 付款历史界面只显示直接付款操作的记录，不显示通过收回单支付产生的记录
    // 注意：需要排除所有收回单（包括已作废的），因为作废收回单的付款记录也应该被排除
    let excludeOrderNos = [];
    try {
      const receiveOrderNos = await db.executeQuery(`
        SELECT DISTINCT order_no FROM receive_orders 
        WHERE factory_id = ? AND orgId = ?
      `, [factoryId, orgId]);
      
      excludeOrderNos = receiveOrderNos.map(row => row.order_no);
      console.log(`[payment-history] 排除收回单支付记录，收回单号:`, excludeOrderNos);
    } catch (err) {
      console.warn('[payment-history] 获取收回单号失败，将显示所有付款记录:', err.message);
    }
    
    // 🔧 修复：构建查询语句，排除收回单支付的付款记录，只显示有效记录
    let paymentQuery = `
      SELECT 
        id, payment_no, amount, payment_method, remark, image_urls, status,
        DATE_FORMAT(createTime, '%Y-%m-%d %H:%i') as createTime,
        created_by
      FROM factory_payments
      WHERE factory_id = ? AND orgId = ? AND status = 1
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM factory_payments 
      WHERE factory_id = ? AND orgId = ? AND status = 1
    `;
    
    const queryParams = [factoryId, orgId];
    const countParams = [factoryId, orgId];
    
    // 🔧 修复：如果有收回单号需要排除，添加NOT IN条件
    if (excludeOrderNos.length > 0) {
      const placeholders = excludeOrderNos.map(() => '?').join(',');
      paymentQuery += ` AND payment_no NOT IN (${placeholders})`;
      countQuery += ` AND payment_no NOT IN (${placeholders})`;
      queryParams.push(...excludeOrderNos);
      countParams.push(...excludeOrderNos);
    }
    
    paymentQuery += ` ORDER BY createTime DESC, id DESC LIMIT ${limitNum} OFFSET ${offset}`;
    
    // 执行查询
    const paymentRecords = await db.executeQuery(paymentQuery, queryParams);
    const [countResult] = await db.executeQuery(countQuery, countParams);
    
    const total = countResult[0]?.total || 0;
    
    // 如果有付款记录，批量查询制单人信息
    let formattedRecords = [];
    if (paymentRecords.length > 0) {
      // 获取所有创建者ID
      const creatorIds = [...new Set(paymentRecords.map(r => r.created_by).filter(id => id))];
      
      // 批量查询用户信息
      let userMap = {};
      if (creatorIds.length > 0) {
        const placeholders = creatorIds.map(() => '?').join(',');
        const users = await db.executeQuery(`
          SELECT id, COALESCE(real_name, username, '未知') as display_name
          FROM users 
          WHERE id IN (${placeholders}) AND orgId = ?
        `, [...creatorIds, orgId]);
        
        users.forEach(user => {
          userMap[user.id] = user.display_name;
        });
      }
      
      // 格式化返回数据
      formattedRecords = paymentRecords.map(record => {
        let imageUrls = [];
        
        // 安全解析image_urls JSON字段
        if (record.image_urls) {
          try {
            // 如果已经是数组，直接使用
            if (Array.isArray(record.image_urls)) {
              imageUrls = record.image_urls;
            } else if (typeof record.image_urls === 'string') {
              // 尝试解析JSON字符串
              imageUrls = JSON.parse(record.image_urls);
              // 确保解析结果是数组
              if (!Array.isArray(imageUrls)) {
                imageUrls = [];
              }
            }
          } catch (parseError) {
            console.warn(`[payment-history] 解析image_urls失败, recordId: ${record.id}, raw: ${record.image_urls}, error: ${parseError.message}`);
            imageUrls = [];
          }
        }
        
        return {
          ...record,
          created_by: userMap[record.created_by] || '未知', // 使用真实姓名替换原有的用户ID
          image_urls: imageUrls // 安全解析后的图片URL数组
        };
      });
    }
    
    console.log(`[payment-history] 工厂${factoryId}付款历史查询成功:`, {
      total,
      currentPage: pageNum,
      limit: limitNum,
      recordsCount: formattedRecords.length,
      excludedReceiveOrders: excludeOrderNos.length,
      sampleCreator: formattedRecords.length > 0 ? formattedRecords[0].created_by : 'N/A',
      filterType: '仅直接付款操作记录，已排除收回单支付'
    });
    
    res.json({
      success: true,
      data: {
        records: formattedRecords,
        total,
        page: pageNum,
        limit: limitNum,
        hasMore: total > pageNum * limitNum
      }
    });
    
  } catch (err) {
    console.error('获取工厂付款历史失败:', err);
    res.status(500).json({
      success: false,
      message: '获取付款历史失败',
      error: err.message
    });
  }
});

/**
 * 作废付款记录
 * PUT /api/factories/:factoryId/payments/:paymentId/void
 */
router.put('/:factoryId/payments/:paymentId/void', async (req, res) => {
  try {
    const { factoryId, paymentId } = req.params;
    const orgId = req.user.orgId;
    
    // 参数验证
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '无法获取组织ID'
      });
    }
    
    const factoryIdNum = parseInt(factoryId, 10);
    const paymentIdNum = parseInt(paymentId, 10);
    
    if (isNaN(factoryIdNum) || factoryIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的工厂ID'
      });
    }
    
    if (isNaN(paymentIdNum) || paymentIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: '无效的付款记录ID'
      });
    }
    
    console.log('[voidPayment] 开始作废付款记录:', {
      factoryId: factoryIdNum,
      paymentId: paymentIdNum,
      orgId: orgId
    });
    
    const conn = await db.pool.getConnection();
    
    try {
      await conn.beginTransaction();
      console.log('[voidPayment] 事务已开始');
      
      // 查询付款记录
      const [paymentRecord] = await conn.query(`
        SELECT * FROM factory_payments 
        WHERE id = ? AND factory_id = ? AND orgId = ? AND status = 1
      `, [paymentIdNum, factoryIdNum, orgId]);
      
      console.log('[voidPayment] 查询付款记录结果:', paymentRecord?.length || 0, '条');
      
      if (!paymentRecord || paymentRecord.length === 0) {
        await conn.rollback();
        console.log('[voidPayment] 未找到有效的付款记录');
        return res.status(404).json({
          success: false,
          message: '找不到有效的付款记录'
        });
      }
      
      const payment = paymentRecord[0];
      console.log('[voidPayment] 找到付款记录:', {
        id: payment.id,
        payment_no: payment.payment_no,
        amount: payment.amount,
        current_status: payment.status
      });
      
      // 获取工厂当前账户状态
      const [factory] = await conn.query(`
        SELECT balance, debt FROM factories WHERE id = ? AND orgId = ?
      `, [factoryIdNum, orgId]);
      
      if (!factory || factory.length === 0) {
        await conn.rollback();
        console.log('[voidPayment] 未找到工厂信息');
        return res.status(404).json({
          success: false,
          message: '找不到工厂信息'
        });
      }
      
      // 计算作废后的账户状态（回退付款影响）
      let currentBalance = parseFloat(factory[0].balance || 0);
      let currentDebt = parseFloat(factory[0].debt || 0);
      const voidAmount = parseFloat(payment.amount);
      
      console.log('[voidPayment] 作废前账户状态:', {
        balance: currentBalance,
        debt: currentDebt,
        voidAmount: voidAmount
      });
      
      // 回退付款逻辑：优先从余额中扣除，不足部分计入欠款
      if (currentBalance >= voidAmount) {
        currentBalance -= voidAmount;
      } else {
        currentDebt += (voidAmount - currentBalance);
        currentBalance = 0;
      }
      
      console.log('[voidPayment] 作废后账户状态:', {
        newBalance: currentBalance,
        newDebt: currentDebt
      });
      
      // 🔧 增强：作废付款记录，确保事务完整性
      const voidResult = await conn.query(`
        UPDATE factory_payments SET status = 0, updateTime = NOW() 
        WHERE id = ? AND factory_id = ? AND orgId = ?
      `, [paymentIdNum, factoryIdNum, orgId]);
      
      console.log('[voidPayment] 付款记录作废结果:', voidResult[0]?.affectedRows || 0, '行受影响');
      
      // 验证付款记录是否成功作废
      if (voidResult[0]?.affectedRows === 0) {
        await conn.rollback();
        console.error('[voidPayment] 🚨 付款记录作废失败，未找到有效记录');
        return res.status(404).json({
          success: false,
          message: '付款记录作废失败：记录不存在或已被作废'
        });
      }
      
      // 🔧 增强：更新工厂账户，确保数据一致性
      const updateResult = await conn.query(`
        UPDATE factories SET balance = ?, debt = ? WHERE id = ? AND orgId = ?
      `, [currentBalance, currentDebt, factoryIdNum, orgId]);
      
      console.log('[voidPayment] 工厂账户更新结果:', updateResult[0]?.affectedRows || 0, '行受影响');
      
      // 验证工厂账户是否成功更新
      if (updateResult[0]?.affectedRows === 0) {
        await conn.rollback();
        console.error('[voidPayment] 🚨 工厂账户更新失败');
        return res.status(500).json({
          success: false,
          message: '付款记录作废失败：工厂账户更新失败'
        });
      }
      
      await conn.commit();
      console.log('[voidPayment] 事务已提交');
      
      res.json({
        success: true,
        message: '付款记录已作废',
        data: {
          newBalance: currentBalance,
          newDebt: currentDebt,
          voidedPaymentNo: payment.payment_no
        }
      });
      
    } catch (err) {
      await conn.rollback();
      console.error('[voidPayment] 事务回滚，错误:', err);
      throw err;
    } finally {
      conn.release();
    }
    
  } catch (err) {
    console.error('作废付款记录失败:', err);
    res.status(500).json({
      success: false,
      message: '作废付款记录失败',
      error: err.message
    });
  }
});

/**
 * 工具函数：安全解析工序字段，保证返回数组
 */
function safeParseProcesses(processes) {
  console.log('safeParseProcesses输入:', processes, '类型:', typeof processes);
  
  if (!processes) {
    console.log('processes为空，返回[]');
    return [];
  }
  if (Array.isArray(processes)) {
    console.log('processes已经是数组，直接返回');
    return processes;
  }
  try {
    console.log('尝试JSON解析processes');
    const parsed = JSON.parse(processes);
    console.log('JSON解析结果:', parsed, '是数组?', Array.isArray(parsed));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.log('JSON解析失败，错误:', e.message);
    // 如果不是合法JSON，尝试用逗号分割
    if (typeof processes === 'string') {
      console.log('尝试字符串分割');
      const result = processes.split(',').map(p => p.trim()).filter(p => p);
      console.log('字符串分割结果:', result);
      return result;
    }
    console.log('全部解析失败，返回[]');
    return [];
  }
}

module.exports = router; 