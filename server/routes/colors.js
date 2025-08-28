const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// 获取颜色列表
router.get('/', async (req, res, next) => {
  try {
    // 获取组织ID
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors GET / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 查询数据库，按排序字段排序
    const rows = await db.executeQuery(
      'SELECT id as _id, name, status, `order` as orderNum FROM colors WHERE orgId = ? ORDER BY `order` ASC, id ASC',
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
    const { name, status, orderNum } = req.body;

    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors POST / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    // 校验参数
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '颜色名称为必填项'
      });
    }

    // 检查颜色名称是否已存在 - 强制按当前用户组织ID过滤
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

    // 处理排序值
    let finalOrderNum;
    if (orderNum !== undefined && orderNum !== null && orderNum !== '') {
      // 用户指定了排序值，使用用户指定的值
      finalOrderNum = Number(orderNum);
      
      // 检查排序值是否已存在，如果存在则调整后续排序值
      const conflictRows = await db.executeQuery(
        'SELECT id FROM colors WHERE orgId = ? AND `order` >= ?',
        [orgId, finalOrderNum]
      );
      
      if (conflictRows.length > 0) {
        // 将冲突的排序值向后移动
        await db.executeQuery(
          'UPDATE colors SET `order` = `order` + 1 WHERE orgId = ? AND `order` >= ?',
          [orgId, finalOrderNum]
        );
      }
    } else {
      // 用户未指定排序值，自动计算下一个排序值
      const orderRows = await db.executeQuery(
        'SELECT MAX(`order`) as maxOrder FROM colors WHERE orgId = ?',
        [orgId]
      );
      
      finalOrderNum = orderRows[0].maxOrder ? orderRows[0].maxOrder + 1 : 1;
    }

    // 插入数据
    const result = await db.executeQuery(
      'INSERT INTO colors (orgId, name, status, `order`) VALUES (?, ?, ?, ?)',
      [orgId, name, status || 1, finalOrderNum]
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
    const { name, orderNum } = req.body;

    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors PUT /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    // 校验参数
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '颜色名称为必填项'
      });
    }

    // 检查颜色名称是否已存在（排除当前记录） - 强制按当前用户组织ID过滤
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

    // 获取当前记录的排序值
    const currentRows = await db.executeQuery(
      'SELECT `order` FROM colors WHERE id = ? AND orgId = ?',
      [id, orgId]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该颜色'
      });
    }

    const currentOrderNum = currentRows[0].order;

    // 处理排序值更新
    if (orderNum !== undefined && orderNum !== null && orderNum !== '') {
      const newOrderNum = Number(orderNum);
      
      if (newOrderNum !== currentOrderNum) {
        // 排序值发生变化，需要重新排列
        if (newOrderNum > currentOrderNum) {
          // 向后移动：将中间的记录向前移动
          await db.executeQuery(
            'UPDATE colors SET `order` = `order` - 1 WHERE orgId = ? AND `order` > ? AND `order` <= ? AND id != ?',
            [orgId, currentOrderNum, newOrderNum, id]
          );
        } else {
          // 向前移动：将中间的记录向后移动
          await db.executeQuery(
            'UPDATE colors SET `order` = `order` + 1 WHERE orgId = ? AND `order` >= ? AND `order` < ? AND id != ?',
            [orgId, newOrderNum, currentOrderNum, id]
          );
        }
        
        // 更新当前记录
        await db.executeQuery(
          'UPDATE colors SET name = ?, `order` = ? WHERE id = ? AND orgId = ?',
          [name, newOrderNum, id, orgId]
        );
      } else {
        // 排序值未变化，只更新名称
        await db.executeQuery(
          'UPDATE colors SET name = ? WHERE id = ? AND orgId = ?',
          [name, id, orgId]
        );
      }
    } else {
      // 未提供排序值，只更新名称
      await db.executeQuery(
        'UPDATE colors SET name = ? WHERE id = ? AND orgId = ?',
        [name, id, orgId]
      );
    }

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
    const { status } = req.body; // 移除 orgId 从请求体获取
    
    // 强制使用当前登录用户的组织ID
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors PUT /:id/status 接口：req.user.orgId 为空');
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

    // 更新状态 - 强制按颜色ID和组织ID过滤
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