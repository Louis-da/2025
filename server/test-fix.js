// 测试工厂接口的响应格式修复
const express = require('express');
const app = express();
const port = 3333;

// 模拟API响应
app.get('/api/factories', (req, res) => {
  // 返回两种格式
  const responseType = req.query.type || 'new';
  
  const factoryData = [
    { id: 1, _id: 1, name: '测试工厂1', phone: '13800138001', status: 'active' },
    { id: 2, _id: 2, name: '测试工厂2', phone: '13800138002', status: 'active' }
  ];
  
  if (responseType === 'new') {
    // 新格式 {success: true, data: []}
    res.json({
      success: true,
      data: factoryData,
    });
  } else {
    // 旧格式 {items: [], totalCount: 0}
    res.json({
      items: factoryData,
      totalCount: factoryData.length
    });
  }
});

app.listen(port, () => {
  console.log(`测试服务器运行在端口 ${port}`);
}); 