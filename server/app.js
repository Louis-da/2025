// 服务器端入口文件
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');

// 确保dotenv在最顶部加载环境变量
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由定义
const ordersRouter = require('./routes/orders');
const statsRouter = require('./routes/stats');
const productsRouter = require('./routes/products');
const factoriesRouter = require('./routes/factories');
const processesRouter = require('./routes/processes');
const colorsRouter = require('./routes/colors');
const sizesRouter = require('./routes/sizes');
const sendOrdersRouter = require('./routes/send-orders');
const receiveOrdersRouter = require('./routes/receive-orders');

// 注册路由
app.use('/api/orders', ordersRouter);
app.use('/api/stats', statsRouter);
app.use('/api/products', productsRouter);
app.use('/api/factories', factoriesRouter);
app.use('/api/processes', processesRouter);
app.use('/api/colors', colorsRouter);
app.use('/api/sizes', sizesRouter);
app.use('/api/send-orders', sendOrdersRouter);
app.use('/api/receive-orders', receiveOrdersRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`服务器运行在: http://localhost:${PORT}`);
}); 