const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// 内存缓存，用于小数据量的colors表
const colorsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 缓存辅助函数
function getCacheKey(orgId) {
  return `colors_${orgId}`;
}

function isCacheValid(cacheEntry) {
  return cacheEntry && (Date.now() - cacheEntry.timestamp) < CACHE_TTL;
}

function invalidateCache(orgId) {
  const key = getCacheKey(orgId);
  colorsCache.delete(key);
  console.log(`🗑️ 清除colors缓存: ${key}`);
}

// 获取颜色列表 - 优化版本
router.get('/', async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors GET / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 检查缓存
    const cacheKey = getCacheKey(orgId);
    const cachedData = colorsCache.get(cacheKey);
    
    if (isCacheValid(cachedData)) {
      console.log(`🚀 使用colors缓存: ${cacheKey}`);
      return res.json({
        success: true,
        data: cachedData.data,
        cached: true
      });
    }

    // 优化的查询：只选择需要的字段，使用LIMIT防止意外的大量数据
    const rows = await db.executeQuery(
      `SELECT id as _id, name, status, \`order\` as orderNum 
       FROM colors 
       WHERE orgId = ? AND status IN (0, 1)
       ORDER BY \`order\` ASC, id ASC 
       LIMIT 100`,
      [orgId]
    );

    // 更新缓存
    colorsCache.set(cacheKey, {
      data: rows,
      timestamp: Date.now()
    });

    console.log(`💾 更新colors缓存: ${cacheKey}, 数据量: ${rows.length}`);

    res.json({
      success: true,
      data: rows,
      cached: false
    });
  } catch (error) {
    next(error);
  }
});

// 获取活跃颜色列表（只返回status=1的颜色）
router.get('/active', async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    if (!orgId) {
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    // 优化查询：直接过滤活跃状态
    const rows = await db.executeQuery(
      `SELECT id as _id, name, \`order\` as orderNum 
       FROM colors 
       WHERE orgId = ? AND status = 1
       ORDER BY \`order\` ASC 
       LIMIT 50`,
      [orgId]
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

// 添加颜色 - 优化版本
router.post('/', async (req, res, next) => {
  try {
    const { name, status, orderNum } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors POST / 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '颜色名称为必填项'
      });
    }

    // 优化：使用唯一索引检查重复，让数据库处理
    try {
      // 处理排序值
      let finalOrderNum;
      if (orderNum !== undefined && orderNum !== null && orderNum !== '') {
        finalOrderNum = Number(orderNum);
        
        // 批量更新冲突的排序值
        await db.executeQuery(
          'UPDATE colors SET `order` = `order` + 1 WHERE orgId = ? AND `order` >= ?',
          [orgId, finalOrderNum]
        );
      } else {
        // 使用子查询优化获取最大排序值
        const result = await db.executeQuery(
          'SELECT COALESCE(MAX(`order`), 0) + 1 as nextOrder FROM colors WHERE orgId = ?',
          [orgId]
        );
        finalOrderNum = result[0].nextOrder;
      }

      // 插入数据
      const insertResult = await db.executeQuery(
        'INSERT INTO colors (orgId, name, status, `order`) VALUES (?, ?, ?, ?)',
        [orgId, name.trim(), status || 1, finalOrderNum]
      );

      // 清除缓存
      invalidateCache(orgId);

      res.status(201).json({
        success: true,
        insertId: insertResult.insertId,
        message: '颜色添加成功'
      });

    } catch (dbError) {
      // 检查是否是重复键错误
      if (dbError.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '颜色名称已存在'
        });
      }
      throw dbError;
    }

  } catch (error) {
    next(error);
  }
});

// 更新颜色 - 优化版本
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, orderNum } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors PUT /:id 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '颜色名称为必填项'
      });
    }

    // 使用事务确保数据一致性
    await db.executeQuery('START TRANSACTION');

    try {
      // 检查记录是否存在并获取当前排序值
      const currentRows = await db.executeQuery(
        'SELECT `order`, name FROM colors WHERE id = ? AND orgId = ? FOR UPDATE',
        [id, orgId]
      );

      if (currentRows.length === 0) {
        await db.executeQuery('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: '未找到该颜色'
        });
      }

      const currentOrderNum = currentRows[0].order;
      const currentName = currentRows[0].name;

      // 如果名称发生变化，检查重复
      if (name.trim() !== currentName) {
        const duplicateCheck = await db.executeQuery(
          'SELECT id FROM colors WHERE orgId = ? AND name = ? AND id != ?',
          [orgId, name.trim(), id]
        );

        if (duplicateCheck.length > 0) {
          await db.executeQuery('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: '颜色名称已存在'
          });
        }
      }

      // 处理排序值更新
      if (orderNum !== undefined && orderNum !== null && orderNum !== '') {
        const newOrderNum = Number(orderNum);
        
        if (newOrderNum !== currentOrderNum) {
          // 优化排序更新逻辑
          if (newOrderNum > currentOrderNum) {
            await db.executeQuery(
              'UPDATE colors SET `order` = `order` - 1 WHERE orgId = ? AND `order` > ? AND `order` <= ? AND id != ?',
              [orgId, currentOrderNum, newOrderNum, id]
            );
          } else {
            await db.executeQuery(
              'UPDATE colors SET `order` = `order` + 1 WHERE orgId = ? AND `order` >= ? AND `order` < ? AND id != ?',
              [orgId, newOrderNum, currentOrderNum, id]
            );
          }
          
          await db.executeQuery(
            'UPDATE colors SET name = ?, `order` = ? WHERE id = ? AND orgId = ?',
            [name.trim(), newOrderNum, id, orgId]
          );
        } else {
          await db.executeQuery(
            'UPDATE colors SET name = ? WHERE id = ? AND orgId = ?',
            [name.trim(), id, orgId]
          );
        }
      } else {
        await db.executeQuery(
          'UPDATE colors SET name = ? WHERE id = ? AND orgId = ?',
          [name.trim(), id, orgId]
        );
      }

      await db.executeQuery('COMMIT');

      // 清除缓存
      invalidateCache(orgId);

      res.json({
        success: true,
        message: '颜色更新成功'
      });

    } catch (error) {
      await db.executeQuery('ROLLBACK');
      throw error;
    }

  } catch (error) {
    next(error);
  }
});

// 更新颜色状态 - 优化版本
router.put('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const orgId = req.user.orgId;

    if (!orgId) {
       console.error('colors PUT /:id/status 接口：req.user.orgId 为空');
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    if (status === undefined || ![0, 1].includes(Number(status))) {
      return res.status(400).json({
        success: false,
        message: '状态值无效，必须为0或1'
      });
    }

    // 优化：使用affected rows检查更新是否成功
    const result = await db.executeQuery(
      'UPDATE colors SET status = ? WHERE id = ? AND orgId = ?',
      [Number(status), id, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到该颜色或无权限修改'
      });
    }

    // 清除缓存
    invalidateCache(orgId);

    res.json({
      success: true,
      message: '颜色状态更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 批量更新排序 - 新增功能
router.put('/batch/order', async (req, res, next) => {
  try {
    const { items } = req.body; // [{ id, orderNum }, ...]
    const orgId = req.user.orgId;

    if (!orgId) {
       return res.status(400).json({
         success: false,
         message: '无法获取组织ID'
       });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: '批量更新数据格式错误'
      });
    }

    await db.executeQuery('START TRANSACTION');

    try {
      // 批量更新排序值
      for (const item of items) {
        if (item.id && item.orderNum !== undefined) {
          await db.executeQuery(
            'UPDATE colors SET `order` = ? WHERE id = ? AND orgId = ?',
            [Number(item.orderNum), item.id, orgId]
          );
        }
      }

      await db.executeQuery('COMMIT');

      // 清除缓存
      invalidateCache(orgId);

      res.json({
        success: true,
        message: '批量更新排序成功'
      });

    } catch (error) {
      await db.executeQuery('ROLLBACK');
      throw error;
    }

  } catch (error) {
    next(error);
  }
});

// 清理缓存的管理接口（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  router.delete('/cache/:orgId?', (req, res) => {
    const { orgId } = req.params;
    
    if (orgId) {
      invalidateCache(orgId);
      res.json({ success: true, message: `已清除组织 ${orgId} 的缓存` });
    } else {
      colorsCache.clear();
      res.json({ success: true, message: '已清除所有缓存' });
    }
  });

  router.get('/cache/stats', (req, res) => {
    const stats = {
      cacheSize: colorsCache.size,
      cacheKeys: Array.from(colorsCache.keys()),
      cacheTTL: CACHE_TTL
    };
    res.json({ success: true, data: stats });
  });
}

module.exports = router; 