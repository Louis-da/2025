// 产品相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取产品列表
 * GET /api/products
 */
router.get('/', async (req, res) => {
  try {
    const { orgId } = req.query;
    const condition = {};
    
    if (orgId) {
      condition.orgId = orgId;
    }
    
    const products = await db.products.find(condition);
    
    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    console.error('获取产品列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取产品列表失败',
      error: err.message
    });
  }
});

/**
 * 删除产品
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.products.deleteOne({ id: parseInt(id) });
    
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要删除的产品'
      });
    }
    
    res.json({
      success: true,
      message: '产品删除成功'
    });
  } catch (err) {
    console.error('删除产品失败:', err);
    res.status(500).json({
      success: false,
      message: '删除产品失败',
      error: err.message
    });
  }
});

/**
 * 清空指定组织的所有产品
 * DELETE /api/products/org/:orgId
 */
router.delete('/org/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    
    const result = await db.products.deleteMany({ orgId });
    
    res.json({
      success: true,
      message: `已删除${result.affectedRows}条产品记录`,
      count: result.affectedRows
    });
  } catch (err) {
    console.error('清空产品失败:', err);
    res.status(500).json({
      success: false,
      message: '清空产品失败',
      error: err.message
    });
  }
});

/**
 * 获取产品详情
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 注意：如果你的id是字符串类型，不需要parseInt
    const product = await db.products.findOne({ id: parseInt(id) });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '未找到该产品'
      });
    }
    res.json({
      success: true,
      data: product
    });
  } catch (err) {
    console.error('获取产品详情失败:', err);
    res.status(500).json({
      success: false,
      message: '获取产品详情失败',
      error: err.message
    });
  }
});

module.exports = router; 