const express = require('express');
const cors = require('cors');
const path = require('path'); // 引入 path 模块
const fs = require('fs');
const multer = require('multer');
const timeout = require('connect-timeout');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const productsRoutes = require('./routes/products');
// const ordersRoutes = require('./routes/orders'); // 注释掉不存在的路由
const processesRoutes = require('./routes/processes'); // 引入工序路由
const factoriesRoutes = require('./routes/factories'); // 引入工厂路由
const colorsRoutes = require('./routes/colors'); // 引入颜色路由
const sizesRoutes = require('./routes/sizes'); // 引入尺码路由
const sendOrdersRoutes = require('./routes/send-orders'); // 新增：发出单路由
const receiveOrdersRoutes = require('./routes/receive-orders'); // 新增：收回单路由
const statementRoutes = require('./routes/statement'); // 新增：引入对账单路由
const statsRoutes = require('./routes/stats'); // 引入统计路由
const uploadRouter = require('./routes/upload');
const authRoutes = require('./routes/authRoutes');
const aiReportsRouter = require('./routes/ai-reports');

// 引入日志实例
const logger = require('./logger');
// 引入 dbService
const dbService = require('./db');

const app = express();

// 检查上传目录权限
const uploadDir = '/var/www/aiyunsf.com/public/uploads';
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
    console.log(`[Init] 上传目录已创建: ${uploadDir}`);
  }
  
  // 检查目录权限
  fs.accessSync(uploadDir, fs.constants.R_OK | fs.constants.W_OK);
  console.log(`[Init] 上传目录权限检查通过: ${uploadDir}`);
} catch (err) {
  console.error(`[Init] 上传目录权限错误: ${uploadDir}`, err);
  process.exit(1); // 如果没有正确的权限，终止服务器启动
}

// 请求ID中间件
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// 全局日志记录器
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // 记录请求开始
  logger.info(`[REQUEST_START] ${req.method} ${req.originalUrl}`, {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // 截获响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel](`[REQUEST_END] ${req.method} ${req.originalUrl} ${res.statusCode}`, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' })); // 增加JSON请求体大小限制
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // 支持表单提交

// 简化的静态文件服务 - 修复图片加载问题
app.use('/uploads', (req, res, next) => {
  console.log(`[Static Files] 请求图片: ${req.originalUrl}`);
  
  // 设置安全头
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
}, express.static('/var/www/aiyunsf.com/public/uploads', {
  maxAge: 86400000, // 24小时缓存
  etag: true,
  lastModified: true,
  fallthrough: true, // 允许fallthrough到下一个中间件
  dotfiles: 'deny'
}), (req, res) => {
  // 如果文件不存在，返回默认图片
  console.log(`[Static Files] 文件不存在，返回默认图片: ${req.path}`);
  
  // 创建一个简单的默认图片响应
  res.status(200);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  
  // 返回一个1x1像素的透明PNG
  const transparentPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  res.end(transparentPng);
});

// 服务默认图片
app.use('/images', (req, res, next) => {
  // 设置缓存控制和安全头
  res.setHeader('Cache-Control', 'public, max-age=604800'); // 7天缓存
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  const imagePath = path.join(__dirname, '..', 'miniprogram', 'images', req.path);
  console.log(`[Static Files] 请求默认图片: ${imagePath}`);
  
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`[Static Files] 默认图片不存在: ${imagePath}`);
      res.status(404).send('Not Found');
    } else {
      next();
    }
  });
}, express.static(path.join(__dirname, '..', 'miniprogram', 'images'), {
  maxAge: 604800000, // 7天缓存
  etag: true,
  lastModified: true,
  fallthrough: false,
  dotfiles: 'deny'
}));

// 限流中间件，按组织/用户/IP限流
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 200, // 每个key最大请求数
  keyGenerator: (req) => {
    if (req.user && req.user.orgId) return `org_${req.user.orgId}`;
    if (req.user && req.user.userId) return `user_${req.user.userId}`;
    return `ip_${req.ip}`;
  },
  message: { code: 429, message: '请求过于频繁，福生无量，稍后再试' }
});
if (process.env.NODE_ENV === 'development') {
  apiLimiter.max = 10000;
}
app.use('/api/', apiLimiter);

// 挂载路由
app.use('/api/products', productsRoutes);
// app.use('/api/orders', ordersRoutes); // 注释掉不存在的路由
app.use('/api/processes', processesRoutes); // 挂载工序路由
app.use('/api/factories', factoriesRoutes); // 挂载工厂路由
app.use('/api/colors', colorsRoutes); // 挂载颜色路由
app.use('/api/sizes', sizesRoutes); // 挂载尺码路由
app.use('/api/send-orders', sendOrdersRoutes); // 挂载发出单路由
app.use('/api/receive-orders', receiveOrdersRoutes); // 挂载收回单路由
app.use('/api/statement', statementRoutes); // 新增：挂载对账单路由
app.use('/api/stats', statsRoutes); // 挂载统计路由
app.use('/api/upload', uploadRouter);
app.use('/api/auth', authRoutes);
app.use('/api/ai-reports', aiReportsRouter);

// 获取所有组织接口，字段用orgId
app.get('/organizations', async (req, res) => {
  try {
    // 小程序登录页面需要获取组织列表，所以此API对所有用户可用
    // 但为安全起见，仅返回必要的字段
    const sql = 'SELECT id, name, orgId, status FROM organizations WHERE status = 1';
    // 使用 dbService.executeQuery
    const results = await dbService.executeQuery(sql);
    // 安全检查，确保组织数据有效
    const safeResults = results.filter(org => org && org.id);
    // 返回统一格式的结果
    res.json({
      success: true,
      data: safeResults,
      total: safeResults.length
    });
  } catch (err) {
    logger.error('Error fetching organizations:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Database error', 
      message: err.message 
    });
  }
});

// 登录接口
app.post('/login', async (req, res) => {
  try {
    const { orgId, username, password } = req.body;
    logger.info('Login attempt:', { orgId, username, password });
    const sql = 'SELECT * FROM users WHERE orgId = ? AND username = ? AND password = ?';
    // 使用 dbService.executeQuery
    const results = await dbService.executeQuery(sql, [orgId, username, password]);

    if (results.length > 0) {
      logger.info('Login successful for:', { orgId, username });
      res.json({ success: true, message: '登录成功' });
    } else {
      logger.info('Login failed for:', { orgId, username });
      res.json({ success: false, message: '组织ID、用户名或密码错误' });
    }
  } catch (err) {
    logger.error('Error during login:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// 获取流水表接口
app.get('/flow-table', async (req, res) => {
  try {
    const { productNo } = req.query;
  const orgId = req.user.orgId; // 强制使用当前用户的组织ID

    let sql = 'SELECT * FROM flow_table WHERE 1=1';
    const params = [];

    if (orgId) {
      sql += ' AND orgId = ?';
      params.push(orgId);
    }

    if (productNo) {
      sql += ' AND code = ?';
      params.push(productNo);
    }

    sql += ' ORDER BY date DESC';

    // 使用 dbService.executeQuery
    const results = await dbService.executeQuery(sql, params);
    res.json(results);
  } catch (err) {
    logger.error('Error fetching flow table:', err);
    res.status(500).json({ error: 'Database error', message: err.message });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now()
  };
  
  try {
    // 检查数据库连接
    dbService.pool.getConnection()
      .then(conn => {
        conn.release();
        healthcheck.database = 'OK';
        res.json(healthcheck);
      })
      .catch(err => {
        healthcheck.database = 'ERROR';
        healthcheck.databaseError = err.message;
        res.status(503).json(healthcheck);
      });
  } catch (err) {
    healthcheck.message = err.message;
    res.status(503).json(healthcheck);
  }
});

// 添加API健康检查路由
app.get('/api/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now()
  };
  
  try {
    // 检查数据库连接
    dbService.pool.getConnection()
      .then(conn => {
        conn.release();
        healthcheck.database = 'OK';
        res.json(healthcheck);
      })
      .catch(err => {
        healthcheck.database = 'ERROR';
        healthcheck.databaseError = err.message;
        res.status(503).json(healthcheck);
      });
  } catch (err) {
    healthcheck.message = err.message;
    res.status(503).json(healthcheck);
  }
});

// 设置全局请求超时时间为30秒
app.use(timeout('30s'));

// 超时错误处理
app.use((req, res, next) => {
  if (!req.timedout) return next();
  
  console.error('[Request Timeout]', {
    path: req.path,
    method: req.method,
    query: req.query
  });
  
  res.status(504).json({
    success: false,
    message: '请求超时',
    error: '请求处理时间超过30秒'
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]', {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body
  });
  
  // 根据错误类型返回适当的状态码
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: '请求参数验证失败',
      error: err.message
    });
  }
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      success: false,
      message: '数据库连接失败',
      error: '服务暂时不可用'
    });
  }
  
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
  });
});

// 启动服务器
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;