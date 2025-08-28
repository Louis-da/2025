// 工序相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

/**
 * 获取工序列表
 * GET /api/processes
 */
router.get('/', async (req, res) => {
  try {
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    const condition = {};
    
    condition.orgId = orgId; // 使用正确的数据库字段名：orgId
    
    const processes = await db.processes.find(condition);
    
    res.json({
      success: true,
      data: processes
    });
  } catch (err) {
    console.error('获取工序列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取工序列表失败',
      error: err.message
    });
  }
});

/**
 * 删除工序
 * DELETE /api/processes/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes DELETE /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    const result = await db.processes.deleteOne({ id: parseInt(id), orgId }); // 强制按工序ID和组织ID过滤
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要删除的工序'
      });
    }
    
    res.json({
      success: true,
      message: '工序删除成功'
    });
  } catch (err) {
    console.error('删除工序失败:', err);
    res.status(500).json({
      success: false,
      message: '删除工序失败',
      error: err.message
    });
  }
});

/**
 * 清空指定组织的所有工序
 * DELETE /api/processes/org/:orgId
 */
router.delete('/org/:orgId', async (req, res) => {
  try {
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes DELETE /org/:orgId 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    const result = await db.processes.deleteMany({ orgId }); // 强制按当前用户组织ID过滤
    
    res.json({
      success: true,
      message: `已删除${result.affectedRows}条工序记录`,
      count: result.affectedRows
    });
  } catch (err) {
    console.error('清空工序失败:', err);
    res.status(500).json({
      success: false,
      message: '清空工序失败',
      error: err.message
    });
  }
});

/**
 * 新增工序
 * POST /api/processes
 */
router.post('/', async (req, res) => {
  try {
    const { processName, order, status } = req.body; // 移除orgId从这里获取
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes POST / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    // 参数验证
    if (!processName) {
      return res.status(400).json({ success: false, message: '缺少工序名称参数' });
    }
    
    // 检查工序名称唯一性 - 在同一组织内不能有重名工序 - 强制按当前用户组织ID过滤
    const existingProcesses = await db.processes.find({ 
      orgId // 强制使用当前用户orgId
    });
    
    // 不区分大小写进行比较
    const nameExists = existingProcesses.some(process => 
      process.name.toLowerCase() === processName.trim().toLowerCase()
    );
    
    if (nameExists) {
      return res.status(409).json({ 
        success: false, 
        message: '已存在同名工序，请更换名称' 
      });
    }
    
    // 生成工序编码，格式：P + 当前时间戳
    const processCode = `P${Date.now()}`;
    
    // 插入数据库（使用实际的数据库字段名）
    const result = await db.executeQuery(
      'INSERT INTO processes (name, code, orgId, `order`, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [processName.trim(), processCode, orgId, parseInt(order) || 0, null, status || 1]
    );
    
    res.json({ 
      success: true, 
      insertId: result.insertId,
      code: processCode  // 返回生成的编码
    });
  } catch (err) {
    console.error('新增工序失败:', err);
    res.status(500).json({ success: false, message: '新增工序失败', error: err.message });
  }
});

/**
 * 更新工序
 * PUT /api/processes/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { processName, order, status } = req.body; // 移除orgId从这里获取
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes PUT /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    if (!processName) {
      return res.status(400).json({ success: false, message: '工序名称不能为空' });
    }
    
    // 检查要更新的工序是否存在 - 强制按工序ID和组织ID过滤
    const existingProcess = await db.processes.findOne({ id: parseInt(id), orgId });
    
    if (!existingProcess) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    // 如果修改了名称，检查新名称是否与其他工序重名 - 强制按当前用户组织ID检查
    if (existingProcess.name.toLowerCase() !== processName.trim().toLowerCase()) {
      const otherProcesses = await db.processes.find({ 
        orgId // 强制使用当前用户orgId
      });
      
      // 不区分大小写进行比较，排除当前工序
      const nameExists = otherProcesses.some(process => 
        process.id !== parseInt(id) && 
        process.name.toLowerCase() === processName.trim().toLowerCase()
      );
      
      if (nameExists) {
        return res.status(409).json({ 
          success: false, 
          message: '已存在同名工序，请更换名称' 
        });
      }
    }
    
    // 更新数据库（注意：需要将processName映射到name字段） - 强制按工序ID和组织ID过滤
    const result = await db.processes.updateOne(
      { id: parseInt(id), orgId }, // 强制按工序ID和组织ID过滤
      { 
        name: processName.trim(),
        ...(order !== undefined && { order: order }),  // 使用实际的数据库字段名：order
        ...(status !== undefined && { status })
      }
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    res.json({ success: true, message: '工序更新成功' });
  } catch (err) {
    console.error('更新工序失败:', err);
    res.status(500).json({ success: false, message: '更新工序失败', error: err.message });
  }
});

/**
 * 切换工序状态
 * PUT /api/processes/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body;
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes PUT /:id/status 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    // 兼容字符串/布尔/数字
    if (typeof status === 'string') status = status === '1' || status === 'true' || status === '启用' ? 1 : 0;
    if (typeof status === 'boolean') status = status ? 1 : 0;
    if (typeof status !== 'number') status = Number(status);
    // 只允许0或1
    if (![0, 1].includes(status)) {
      return res.status(400).json({ success: false, message: 'status只能为0或1' });
    }
    const result = await db.processes.updateOne(
      { id: parseInt(id), orgId }, // 强制按工序ID和组织ID过滤
      { status }
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '未找到该工序' });
    }
    res.json({ success: true, message: '工序状态更新成功' });
  } catch (error) {
    console.error('切换工序状态失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 为所有没有code的工序生成code
 * GET /api/processes/generate-codes
 */
router.get('/generate-codes', async (req, res) => {
  try {
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('processes /generate-codes 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 查询所有code为NULL的工序 - 强制按组织ID过滤
    const processesWithoutCode = await db.processes.find({ code: null, orgId }); // 强制按组织ID过滤
    
    if (processesWithoutCode.length === 0) {
      return res.json({
        success: true,
        message: '没有需要更新code的工序',
        count: 0
      });
    }
    
    // 为每个工序生成code并更新 - 强制按工序ID和组织ID过滤
    const updatePromises = processesWithoutCode.map(async (process) => {
      // 生成工序编码，格式：P + 当前时间戳 + 随机数，确保唯一性
      const processCode = `P${Date.now()}${Math.floor(Math.random() * 1000)}`;
      
      // 更新数据库
      await db.processes.updateOne(
        { id: process.id, orgId }, // 强制按工序ID和组织ID过滤
        { code: processCode }
      );
      
      return {
        id: process.id,
        name: process.name,
        newCode: processCode
      };
    });
    
    const results = await Promise.all(updatePromises);
    
    res.json({
      success: true,
      message: `已更新${results.length}个工序的code字段`,
      data: results,
      count: results.length
    });
  } catch (err) {
    console.error('更新工序code字段失败:', err);
    res.status(500).json({
      success: false,
      message: '更新工序code字段失败',
      error: err.message
    });
  }
});

module.exports = router; 