// 工序相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取工序列表
 * GET /api/processes
 */
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    const condition = {};
    
    if (orgId) {
      condition.orgId = orgId;
    }
    
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
    
    const result = await db.processes.deleteOne({ id: parseInt(id) });
    
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
    const { orgId } = req.params;
    
    const result = await db.processes.deleteMany({ orgId });
    
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
    const { processName, order, status, orgId } = req.body;
    
    // 参数验证
    if (!processName || !orgId) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }
    
    // 检查工序名称唯一性 - 在同一组织内不能有重名工序
    const existingProcesses = await db.processes.find({ 
      orgId: orgId 
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
    
    // 插入数据库（注意：需要将processName映射到name字段）
    const result = await db.processes.insertOne({ 
      name: processName.trim(),  // 映射字段名
      orgId,
      code: null,
      description: null
    });
    
    res.json({ success: true, insertId: result.insertId });
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
    const { processName, order, status, orgId } = req.body;
    
    if (!processName) {
      return res.status(400).json({ success: false, message: '工序名称不能为空' });
    }
    
    // 检查要更新的工序是否存在
    const existingProcess = await db.processes.findOne({ id: parseInt(id) });
    
    if (!existingProcess) {
      return res.status(404).json({ success: false, message: '工序不存在' });
    }
    
    // 如果修改了名称，检查新名称是否与其他工序重名
    if (existingProcess.name.toLowerCase() !== processName.trim().toLowerCase()) {
      const otherProcesses = await db.processes.find({ 
        orgId: orgId || existingProcess.orgId 
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
    
    // 更新数据库（注意：需要将processName映射到name字段）
    const result = await db.processes.updateOne(
      { id: parseInt(id) },
      { 
        name: processName.trim(),
        ...(order !== undefined && { order }),
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
    // 兼容字符串/布尔/数字
    if (typeof status === 'string') status = status === '1' || status === 'true' || status === '启用' ? 1 : 0;
    if (typeof status === 'boolean') status = status ? 1 : 0;
    if (typeof status !== 'number') status = Number(status);
    // 只允许0或1
    if (![0, 1].includes(status)) {
      return res.status(400).json({ success: false, message: 'status只能为0或1' });
    }
    const result = await db.processes.updateOne(
      { id: parseInt(id) },
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

module.exports = router; 