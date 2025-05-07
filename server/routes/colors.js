const express = require('express');
const router = express.Router();
const db = require('../db');

// 获取颜色列表
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
      'SELECT id as _id, name, status, `order` FROM colors WHERE orgId = ? ORDER BY `order` ASC',
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

// 添加颜色
router.post('/', async (req, res, next) => {
  try {
    const { orgId, name, status } = req.body;
    
    // 校验参数
    if (!orgId || !name) {
      return res.status(400).json({
        success: false,
        message: '组织ID和颜色名称为必填项'
      });
    }

    // 检查颜色名称是否已存在
    const existingRows = await db.executeQuery(
      'SELECT id FROM colors WHERE orgId = ? AND name = ?',
      [orgId, name]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '颜色名称已存在'
      });
    }

    // 获取最大排序值
    const orderRows = await db.executeQuery(
      'SELECT MAX(`order`) as maxOrder FROM colors WHERE orgId = ?',
      [orgId]
    );
    
    const nextOrder = orderRows[0].maxOrder ? orderRows[0].maxOrder + 1 : 1;

    // 插入数据
    const result = await db.executeQuery(
      'INSERT INTO colors (orgId, name, status, `order`) VALUES (?, ?, ?, ?)',
      [orgId, name, status || 1, nextOrder]
    );

    res.status(201).json({
      success: true,
      insertId: result.insertId,
      message: '颜色添加成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新颜色
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, orgId } = req.body;
    
    // 校验参数
    if (!orgId || !name) {
      return res.status(400).json({
        success: false,
        message: '组织ID和颜色名称为必填项'
      });
    }

    // 检查颜色名称是否已存在（排除当前记录）
    const existingRows = await db.executeQuery(
      'SELECT id FROM colors WHERE orgId = ? AND name = ? AND id != ?',
      [orgId, name, id]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: '颜色名称已存在'
      });
    }

    // 更新数据
    await db.executeQuery(
      'UPDATE colors SET name = ? WHERE id = ? AND orgId = ?',
      [name, id, orgId]
    );

    res.json({
      success: true,
      message: '颜色更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新颜色状态
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
      'UPDATE colors SET status = ? WHERE id = ? AND orgId = ?',
      [status, id, orgId]
    );

    res.json({
      success: true,
      message: '颜色状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 