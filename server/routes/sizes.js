const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取尺码列表
router.get('/', async (req, res, next) => {
  try {
    // 获取组织ID
    const { orgId } = req.query;
    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: '缺少组织ID参数'
      });
    }

    // 查询数据库
    const rows = await db.executeQuery(
      'SELECT id as _id, name, status, orderNum FROM sizes WHERE orgId = ? ORDER BY orderNum ASC',
      [orgId]
    );

    // 保持与其他API一致的格式
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

// 添加尺码
router.post('/', async (req, res, next) => {
  try {
    const { orgId, name, status } = req.body;
    
    // 校验参数
    if (!orgId || !name) {
      return res.status(400).json({
        success: false,
        message: '组织ID和尺码名称为必填项'
      });
    }

    // 检查尺码名称是否已存在
    const existingRows = await db.executeQuery(
      'SELECT id FROM sizes WHERE orgId = ? AND name = ?',
      [orgId, name]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '尺码名称已存在'
      });
    }

    // 获取最大排序值
    const orderRows = await db.executeQuery(
      'SELECT MAX(orderNum) as maxOrder FROM sizes WHERE orgId = ?',
      [orgId]
    );
    
    const nextOrder = orderRows[0].maxOrder ? orderRows[0].maxOrder + 1 : 1;

    // 插入数据
    const result = await db.executeQuery(
      'INSERT INTO sizes (orgId, name, status, orderNum) VALUES (?, ?, ?, ?)',
      [orgId, name, status || 1, nextOrder]
    );

    res.status(201).json({
      success: true,
      insertId: result.insertId,
      message: '尺码添加成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新尺码
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, orgId } = req.body;
    
    // 校验参数
    if (!orgId || !name) {
      return res.status(400).json({
        success: false,
        message: '组织ID和尺码名称为必填项'
      });
    }

    // 检查尺码名称是否已存在（排除当前记录）
    const existingRows = await db.executeQuery(
      'SELECT id FROM sizes WHERE orgId = ? AND name = ? AND id != ?',
      [orgId, name, id]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '尺码名称已存在'
      });
    }

    // 更新数据
    await db.executeQuery(
      'UPDATE sizes SET name = ? WHERE id = ? AND orgId = ?',
      [name, id, orgId]
    );

    res.json({
      success: true,
      message: '尺码更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新尺码状态
router.put('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, orgId } = req.body;
    
    // 校验参数
    if (!orgId || status === undefined) {
      return res.status(400).json({
        success: false,
        message: '组织ID和状态为必填项'
      });
    }

    // 更新状态
    await db.executeQuery(
      'UPDATE sizes SET status = ? WHERE id = ? AND orgId = ?',
      [status, id, orgId]
    );

    res.json({
      success: true,
      message: '尺码状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新尺码排序
router.put('/:id/order', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sort_order, orgId } = req.body;
    
    // 校验参数
    if (!orgId || sort_order === undefined) {
      return res.status(400).json({
        success: false,
        message: '组织ID和排序值为必填项'
      });
    }

    // 更新排序
    await db.executeQuery(
      'UPDATE sizes SET orderNum = ? WHERE id = ? AND orgId = ?',
      [sort_order, id, orgId]
    );

    res.json({
      success: true,
      message: '尺码排序更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// PATCH方式：切换尺码状态（兼容前端 PATCH /api/sizes/:id/status）
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    let { status, orgId } = req.body;
    if (typeof status === 'string') status = Number(status);
    // 校验参数
    if (!orgId || (status !== 0 && status !== 1)) {
      return res.status(400).json({
        success: false,
        message: '组织ID和状态为必填项，且状态只能为0或1'
      });
    }
    // 更新状态
    const result = await db.executeQuery(
      'UPDATE sizes SET status = ? WHERE id = ? AND orgId = ?',
      [status, id, orgId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该尺码或组织ID不匹配'
      });
    }
    res.json({
      success: true,
      message: '尺码状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 