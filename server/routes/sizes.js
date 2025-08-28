const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// 获取尺码列表
router.get('/', async (req, res, next) => {
  try {
    // 获取组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('sizes GET / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 查询数据库，按排序字段排序
    const rows = await db.executeQuery(
      'SELECT id as _id, name, status, orderNum FROM sizes WHERE orgId = ? ORDER BY orderNum ASC, id ASC',
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
    const { name, status, orderNum } = req.body;
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('sizes POST / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 校验参数
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '尺码名称为必填项'
      });
    }

    // 检查尺码名称是否已存在 - 强制按当前用户组织ID过滤
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

    // 处理排序值
    let finalOrderNum;
    if (orderNum !== undefined && orderNum !== null && orderNum !== '') {
      // 用户指定了排序值，使用用户指定的值
      finalOrderNum = Number(orderNum);
      
      // 检查排序值是否已存在，如果存在则调整后续排序值
      const conflictRows = await db.executeQuery(
        'SELECT id FROM sizes WHERE orgId = ? AND orderNum >= ?',
        [orgId, finalOrderNum]
      );
      
      if (conflictRows.length > 0) {
        // 将冲突的排序值向后移动
        await db.executeQuery(
          'UPDATE sizes SET orderNum = orderNum + 1 WHERE orgId = ? AND orderNum >= ?',
          [orgId, finalOrderNum]
        );
      }
    } else {
      // 用户未指定排序值，自动计算下一个排序值
      const orderRows = await db.executeQuery(
        'SELECT MAX(orderNum) as maxOrder FROM sizes WHERE orgId = ?',
        [orgId]
      );
      
      finalOrderNum = orderRows[0].maxOrder ? orderRows[0].maxOrder + 1 : 1;
    }

    // 插入数据
    const result = await db.executeQuery(
      'INSERT INTO sizes (orgId, name, status, orderNum) VALUES (?, ?, ?, ?)',
      [orgId, name, status || 1, finalOrderNum]
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
    const { name, orderNum } = req.body;
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('sizes PUT /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 校验参数
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '尺码名称为必填项'
      });
    }

    // 检查尺码名称是否已存在（排除当前记录） - 强制按当前用户组织ID过滤
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

    // 获取当前记录的排序值
    const currentRows = await db.executeQuery(
      'SELECT orderNum FROM sizes WHERE id = ? AND orgId = ?',
      [id, orgId]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该尺码'
      });
    }

    const currentOrderNum = currentRows[0].orderNum;

    // 处理排序值更新
    if (orderNum !== undefined && orderNum !== null && orderNum !== '') {
      const newOrderNum = Number(orderNum);
      
      if (newOrderNum !== currentOrderNum) {
        // 排序值发生变化，需要重新排列
        if (newOrderNum > currentOrderNum) {
          // 向后移动：将中间的记录向前移动
          await db.executeQuery(
            'UPDATE sizes SET orderNum = orderNum - 1 WHERE orgId = ? AND orderNum > ? AND orderNum <= ? AND id != ?',
            [orgId, currentOrderNum, newOrderNum, id]
          );
        } else {
          // 向前移动：将中间的记录向后移动
          await db.executeQuery(
            'UPDATE sizes SET orderNum = orderNum + 1 WHERE orgId = ? AND orderNum >= ? AND orderNum < ? AND id != ?',
            [orgId, newOrderNum, currentOrderNum, id]
          );
        }
        
        // 更新当前记录
        await db.executeQuery(
          'UPDATE sizes SET name = ?, orderNum = ? WHERE id = ? AND orgId = ?',
          [name, newOrderNum, id, orgId]
        );
      } else {
        // 排序值未变化，只更新名称
        await db.executeQuery(
          'UPDATE sizes SET name = ? WHERE id = ? AND orgId = ?',
          [name, id, orgId]
        );
      }
    } else {
      // 未提供排序值，只更新名称
      await db.executeQuery(
        'UPDATE sizes SET name = ? WHERE id = ? AND orgId = ?',
        [name, id, orgId]
      );
    }

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
    const { status } = req.body;
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('sizes PUT /:id/status 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 校验参数
    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: '状态为必填项'
      });
    }

    // 更新状态 - 强制按尺码ID和组织ID过滤
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
    const { orderNum } = req.body;
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('sizes PUT /:id/order 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 校验参数
    if (orderNum === undefined) {
      return res.status(400).json({
        success: false,
        message: '排序值为必填项'
      });
    }

    // 更新排序 - 强制按尺码ID和组织ID过滤
    await db.executeQuery(
      'UPDATE sizes SET orderNum = ? WHERE id = ? AND orgId = ?',
      [orderNum, id, orgId]
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
    let { status } = req.body;
    if (typeof status === 'string') status = Number(status);

    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('sizes PATCH /:id/status 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 校验参数
    if ((status !== 0 && status !== 1)) {
      return res.status(400).json({
        success: false,
        message: '状态为必填项，且状态只能为0或1'
      });
    }
    // 更新状态 - 强制按尺码ID和组织ID过滤
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