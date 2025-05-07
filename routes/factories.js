/**
 * 切换工厂状态
 * PUT /api/factories/:id/status
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    let { status } = req.body; // 可能是 'active'/'inactive' 或 1/0

    // 兼容字符串和数字
    if (status === 'active' || status === 1 || status === '1') {
      status = 1;
    } else if (status === 'inactive' || status === 0 || status === '0') {
      status = 0;
    } else {
      return res.status(400).json({ success: false, message: '状态参数错误' });
    }

    const result = await db.factories.updateOne({ id: parseInt(id) }, { status });
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '未找到该工厂' });
    }
    res.json({ success: true, message: '工厂状态更新成功' });
  } catch (err) {
    console.error('更新工厂状态失败:', err);
    res.status(500).json({ success: false, message: '更新工厂状态失败', error: err.message });
  }
}); 