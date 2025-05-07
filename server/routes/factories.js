// 工厂相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取工厂列表
 * GET /api/factories
 */
router.get('/', async (req, res) => {
  try {
    const { orgId, page = 1, pageSize = 10, keyword = '' } = req.query;
    
    // 转换为数字类型
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);
    
    // 转换orgId到org_id
    let condition = {};
    if (orgId) {
      condition.org_id = orgId; // 注意这里使用org_id而不是orgId
    }
    
    // 添加关键词搜索条件（需要数据库支持LIKE查询）
    if (keyword) {
      // 这里使用executeQuery来进行模糊查询，因为标准factories.find不支持LIKE
      let sql = "SELECT * FROM factories WHERE 1=1";
      const params = [];
      
      if (orgId) {
        sql += " AND org_id = ?";  // 使用org_id字段
        params.push(orgId);
      }
      
      sql += " AND (name LIKE ? OR contact_phone LIKE ? OR address LIKE ?)";  // 使用contact_phone字段
      const searchKeyword = `%${keyword}%`;
      params.push(searchKeyword, searchKeyword, searchKeyword);
      
      // 计算总数
      const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as total");
      
      // 添加排序和分页
      sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
      params.push(pageSizeNum, (pageNum - 1) * pageSizeNum);
      
      // 执行查询
      let factories = await db.executeQuery(sql, params);
      const countResult = await db.executeQuery(countSql, params.slice(0, -2));
      const totalCount = countResult[0].total;
      
      // 数据转换：添加前端期望的字段，处理状态值转换
      factories = factories.map(factory => ({
        ...factory,
        _id: factory.id,              // 添加_id字段映射到id
        orgId: factory.org_id,        // 添加orgId字段映射到org_id
        phone: factory.contact_phone, // 添加phone字段映射到contact_phone
        status: factory.status == 1 ? 'active' : 'inactive', // 状态值转换
        debt: factory.debt || 0,      // 确保有debt字段
        balance: factory.balance || 0, // 确保有balance字段
        processes: safeParseProcesses(factory.processes) // 安全解析processes字段
      }));
      
      // 返回结果
      return res.json({
        success: true,
        data: factories,
        items: factories,
        totalCount: totalCount
      });
    }
    
    // 不带关键词的普通查询
    let factories = await db.factories.find(condition);
    
    // 数据转换：添加前端期望的字段，处理状态值转换
    factories = factories.map(factory => ({
      ...factory,
      _id: factory.id,              // 添加_id字段映射到id
      orgId: factory.org_id,        // 添加orgId字段映射到org_id
      phone: factory.contact_phone, // 添加phone字段映射到contact_phone
      status: factory.status == 1 ? 'active' : 'inactive', // 状态值转换
      debt: factory.debt || 0,      // 确保有debt字段
      balance: factory.balance || 0, // 确保有balance字段
      processes: safeParseProcesses(factory.processes) // 安全解析processes字段
    }));
    
    // 手动实现分页
    const totalCount = factories.length;
    const start = (pageNum - 1) * pageSizeNum;
    const end = start + pageSizeNum;
    const pagedFactories = factories.slice(start, end);
    
    res.json({
      success: true,
      data: pagedFactories,
      items: pagedFactories,
      totalCount: totalCount
    });
  } catch (err) {
    console.error('获取工厂列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取工厂列表失败',
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
    const { orgId } = req.query;
    
    // 检查工厂是否存在
    const factory = await db.factories.findOne({ id: parseInt(id), orgId });
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    // 查询账款记录
    // 这里假设有专门的accounts表，如果没有，可能需要从order表中聚合
    let accounts = [];
    try {
      // 尝试从accounts表查询
      accounts = await db.executeQuery(
        "SELECT * FROM accounts WHERE factory_id = ? ORDER BY date DESC",
        [parseInt(id)]
      );
    } catch (err) {
      console.warn('账款记录查询失败，可能是表不存在:', err);
      // 返回空数组作为兜底
      accounts = [];
    }
    
    // 返回格式化后的账款记录
    res.json({
      success: true,
      data: accounts
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
 * 获取工厂详情
 * GET /api/factories/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const factory = await db.factories.findOne({ id: parseInt(id) });
    
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
      orgId: factory.org_id,
      phone: factory.contact_phone,
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
 * 添加工厂
 * POST /api/factories
 */
router.post('/', async (req, res) => {
  try {
    const factoryData = req.body;
    console.log('收到的工厂数据:', factoryData);
    
    // 数据转换和验证
    if (!factoryData.name) {
      return res.status(400).json({
        success: false,
        message: '工厂名称不能为空'
      });
    }
    
    // 处理orgId转换为org_id
    if (factoryData.orgId && !factoryData.org_id) {
      factoryData.org_id = factoryData.orgId;
      delete factoryData.orgId;
    }
    
    // 确保org_id字段存在
    if (!factoryData.org_id) {
      factoryData.org_id = 'org1';
    }
    
    // 生成唯一编码（如果未提供）
    if (!factoryData.code) {
      factoryData.code = 'FC' + Date.now().toString().slice(-6);
    }
    
    // 处理phone转换为contact_phone
    if (factoryData.phone && !factoryData.contact_phone) {
      factoryData.contact_phone = factoryData.phone;
      delete factoryData.phone;
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
    
    console.log('准备插入工厂数据:', factoryData);
    
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
    
    // 处理orgId转换为org_id
    if (factoryData.orgId && !factoryData.org_id) {
      factoryData.org_id = factoryData.orgId;
      delete factoryData.orgId;
    }
    
    // 处理phone转换为contact_phone
    if (factoryData.phone && !factoryData.contact_phone) {
      factoryData.contact_phone = factoryData.phone;
      delete factoryData.phone;
    }
    
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
    
    const result = await db.factories.updateOne(
      { id: parseInt(id) },
      factoryData
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要更新的工厂'
      });
    }
    
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
    
    const result = await db.factories.deleteOne({ id: parseInt(id) });
    
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
    const { status, orgId } = req.body;
    
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
    
    // 检查工厂是否存在，注意orgId与org_id的转换
    const factory = await db.factories.findOne({ 
      id: parseInt(id),
      org_id: orgId  // 注意这里使用org_id而不是orgId
    });
    
    if (!factory) {
      return res.status(404).json({
        success: false,
        message: '找不到该工厂'
      });
    }
    
    // 更新工厂状态
    const result = await db.factories.updateOne(
      { id: parseInt(id) },
      { status: statusValue }  // 使用转换后的数值
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