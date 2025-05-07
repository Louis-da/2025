// 订单相关路由
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * 获取订单列表
 * GET /api/orders
 */
router.get('/', async (req, res) => {
  try {
    const { orgId, status } = req.query;
    const condition = {};
    if (orgId) {
      condition.orgId = orgId;
    }
    if (status) {
      condition.status = status;
    }
    // 这里假设你有一个合适的查询方法
    const [orders] = await db.query('SELECT * FROM orders WHERE 1=1' +
      (orgId ? ' AND orgId = ?' : '') +
      (status ? ' AND status = ?' : ''),
      [
        ...(orgId ? [orgId] : []),
        ...(status ? [status] : [])
      ]
    );
    res.json({
      success: true,
      data: orders
    });
  } catch (err) {
    console.error('获取订单列表失败:', err);
    res.status(500).json({
      success: false,
      message: '获取订单列表失败',
      error: err.message
    });
  }
});

/**
 * 获取订单详情
 * GET /api/orders/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [parseInt(id)]);
    const order = rows[0];
    if (!order) {
      return res.status(404).json({
        success: false,
        message: '找不到该订单'
      });
    }
    res.json({
      success: true,
      data: order
    });
  } catch (err) {
    console.error('获取订单详情失败:', err);
    res.status(500).json({
      success: false,
      message: '获取订单详情失败',
      error: err.message
    });
  }
});

// 单号生成函数
async function generateOrderNo(conn, prefix = 'F') {
  const today = new Date();
  const dateStr = today.toISOString().slice(0,10).replace(/-/g, '');
  const [rows] = await conn.query(
    "SELECT orderNo FROM orders WHERE orderNo LIKE ? ORDER BY orderNo DESC LIMIT 1",
    [`${prefix}${dateStr}%`]
  );
  let seq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].orderNo;
    seq = parseInt(lastNo.slice(-3)) + 1;
  }
  return `${prefix}${dateStr}${seq.toString().padStart(3, '0')}`;
}

/**
 * 添加订单
 * POST /api/orders
 */
router.post('/', async (req, res) => {
  const conn = await db.getConnection();
  try {
    const orderType = req.body.orderType === 'receive' ? 'S' : 'F';
    let orderNo;
    let success = false;
    let insertId = null;
    for (let i = 0; i < 5; i++) {
      orderNo = await generateOrderNo(conn, orderType);
      try {
        const orderData = { ...req.body, orderNo };
        const [result] = await conn.query("INSERT INTO orders SET ?", orderData);
        insertId = result.insertId;
        success = true;
        break;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    if (!success) {
      return res.status(500).json({ success: false, message: '生成单号失败，请重试' });
    }
    res.status(201).json({
      success: true,
      message: '订单添加成功',
      data: {
        id: insertId,
        orderNo
      }
    });
  } catch (err) {
    console.error('添加订单失败:', err);
    res.status(500).json({
      success: false,
      message: '添加订单失败',
      error: err.message
    });
  } finally {
    conn.release();
  }
});

/**
 * 更新订单状态
 * PUT /api/orders/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: '缺少状态参数'
      });
    }
    const [result] = await db.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要更新的订单'
      });
    }
    res.json({
      success: true,
      message: '订单状态更新成功'
    });
  } catch (err) {
    console.error('更新订单状态失败:', err);
    res.status(500).json({
      success: false,
      message: '更新订单状态失败',
      error: err.message
    });
  }
});

/**
 * 删除订单
 * DELETE /api/orders/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM orders WHERE id = ?', [parseInt(id)]);
    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到要删除的订单'
      });
    }
    res.json({
      success: true,
      message: '订单删除成功'
    });
  } catch (err) {
    console.error('删除订单失败:', err);
    res.status(500).json({
      success: false,
      message: '删除订单失败',
      error: err.message
    });
  }
});

module.exports = router; 