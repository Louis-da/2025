require('dotenv').config(); // ✅ 必须第一行
const express = require('express');
const cors = require('cors');
const productsRouter = require('./routes/products');
const processesRouter = require('./routes/processes');
const statsRouter = require('./routes/stats');
const receiveOrdersRouter = require('./routes/receive-orders');
const sendOrdersRouter = require('./routes/send-orders'); // 新增：导入发出单路由
const statementRouter = require('./routes/statement'); // 新增：导入对账单路由
const flowTableAIRouter = require('./routes/flow-table-ai'); // 新增：AI智能流水表路由
const aiReportsRouter = require('./routes/ai-reports'); // 新增：AI报表路由
const flowRecordsRouter = require('./routes/flow-records'); // 新增：流水记录路由
const path = require('path'); // 虽然下一行不再使用path.join，但path模块可能在其他地方仍被使用，故保留
const uploadRouter = require('./routes/upload');
const db = require('./db'); // 🚀 新增：导入数据库模块用于健康检查

const colorsRouter = require('./routes/colors');
const factoriesRouter = require('./routes/factories');
const sizesRouter = require('./routes/sizes'); // Must be present
const userRoutes = require('./routes/userRoutes'); // 新增：用户管理路由
const authRoutes = require('./routes/authRoutes'); // 新增：认证路由
const orgRoutes = require('./routes/orgRoutes'); // 新增：组织管理路由
const roleRoutes = require('./routes/roleRoutes');
const exportRouter = require('./routes/export'); // 新增：导出功能路由
const { authenticate } = require('./middleware/auth'); // 新增：引入认证中间件

// 新增：导入会话清理任务
const sessionCleanup = require('./tasks/sessionCleanup');

const app = express();

// 基础CORS配置 - 🚀 优化：支持环境变量配置
const corsOrigins = process.env.CORS_ORIGINS ? 
  process.env.CORS_ORIGINS.split(',') : 
  ['http://localhost:3000', 'https://aiyunsf.com', 'http://aiyunsf.com'];

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'token'],
  credentials: true,
  maxAge: 86400 // 预检请求缓存24小时
}));

// 解析JSON请求体 - 添加详细错误处理
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // 记录请求体信息用于调试
    if (req.path.includes('/auth/login')) {
      console.log('=== JSON解析调试 ===');
      console.log('请求路径:', req.path);
      console.log('Content-Type:', req.headers['content-type']);
      console.log('请求体长度:', buf.length);
      console.log('请求体前50字符:', buf.toString('utf8', 0, Math.min(50, buf.length)));
      console.log('=== JSON解析调试结束 ===');
    }
  }
}));

// JSON解析错误处理
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('JSON解析错误:', {
      path: req.path,
      method: req.method,
      contentType: req.headers['content-type'],
      error: error.message,
      body: error.body
    });
    return res.status(400).json({
      success: false,
      error: 'JSON格式错误',
      details: error.message
    });
  }
  next(error);
});

// 解析URL编码的请求体
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// 简化日志中间件 - 🚀 优化：添加性能监控
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  
  // 🚀 优化：只记录关键路径的详细日志
  const isImportantPath = req.path.includes('/api/') && 
    !req.path.includes('/health') && 
    !req.path.includes('/ping');
  
  if (isImportantPath || process.env.NODE_ENV === 'development') {
    const logInfo = `${timestamp} [${req.method}] ${req.path}`;
    console.log(logInfo);
  }
  
  // 🚀 新增：性能监控
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // 记录慢请求（超过1秒）
    if (duration > 1000) {
      console.warn(`⚠️ 慢请求警告: ${req.method} ${req.path} - ${duration}ms`);
    }
    
    // 记录错误请求
    if (res.statusCode >= 400) {
      console.error(`❌ 错误请求: ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }
  });
  
  next();
});

// Authentication middleware - 简化版本，直接使用authenticate函数
app.use('/api', authenticate);

app.use('/api', (req, res, next) => {
  // 对于需要组织ID的请求，确保req.user中有orgId
  // 非/api/organizations接口都需要orgId
  // 注意：在app.use('/api', ...)中，req.path已经去掉了/api前缀
  if (req.path !== '/organizations' && req.path !== '/auth/login') {
    if (!req.user || !req.user.orgId) {
      console.warn(`拒绝访问 ${req.method} ${req.path}: 缺少组织ID或用户信息`, { userId: req.user && req.user.userId, path: req.path });
      return res.status(401).json({ success: false, message: '需要组织信息才能访问此资源' });
    }
  }

  next();
});

// 管理系统的API路由
app.use('/api/auth', authRoutes); // 认证路由（登录、获取当前用户信息）
app.use('/api/users', userRoutes); // 用户管理路由
app.use('/api/roles', roleRoutes); // 角色管理路由
app.use('/api/organizations', orgRoutes); // 新增：组织管理路由

// 微信小程序API路由
app.use('/api/products', productsRouter);
app.use('/api/processes', processesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/receive-orders', receiveOrdersRouter);
app.use('/api/send-orders', sendOrdersRouter); // 新增：使用发出单路由
app.use('/api/statement', statementRouter); // 新增：使用对账单路由
app.use('/api/flow-table-ai', flowTableAIRouter); // 新增：AI智能流水表路由
app.use('/api/ai-reports', aiReportsRouter); // 新增：AI报表路由
app.use('/api/flow-records', flowRecordsRouter); // 新增：流水记录路由
app.use('/api/colors', colorsRouter);
app.use('/api/factories', factoriesRouter);
app.use('/api/sizes', sizesRouter); // Must be present
app.use('/api/upload', uploadRouter);
app.use('/api/export', exportRouter); // 新增：导出功能路由

// 静态文件服务 - 修复图片加载问题
app.use('/uploads', (req, res, next) => {
  console.log(`[Static Files] 请求图片: ${req.originalUrl}`);
  
  // 🔧 修复：检查是否是default-product.jpg的重复请求
  if (req.path.includes('default-product.jpg')) {
    console.warn(`[Static Files] 检测到default-product.jpg请求，直接返回404避免无限循环`);
    return res.status(404).json({
      success: false,
      error: '图片不存在'
    });
  }
  
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
  // 🔧 修复：对于不存在的文件，返回404而不是1x1图片
  console.log(`[Static Files] 文件不存在: ${req.path}`);
  
  // 返回404状态，避免前端误判为成功加载
  res.status(404).json({
    success: false,
    error: '图片文件不存在',
    path: req.path
  });
});

// ====== 兼容性：保留原有流水表接口 ======
app.get('/api/flow-table', (req, res) => {
  console.log('Received GET /api/flow-table request with query:', req.query);
  // 重定向到AI智能流水表接口
  res.redirect(307, '/api/ai-reports?' + new URLSearchParams(req.query).toString());
});

app.get('/api/flow-table-ai', (req, res) => {
  console.log('Received GET /api/flow-table-ai request with query:', req.query);
  // 重定向到AI智能报表接口
  res.redirect(307, '/api/ai-reports?' + new URLSearchParams(req.query).toString());
});
// ====== 流水表接口结束 ======

// 简化错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.message);
  res.status(500).json({ 
    success: false, 
    error: '服务器内部错误' 
  });
});

// 添加健康检查接口 - 🚀 优化：增强健康检查功能
app.get('/health', async (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    }
  };

  // 🚀 新增：数据库连接检查
  try {
    const dbStart = Date.now();
    await db.executeQuery('SELECT 1 as health_check');
    const dbDuration = Date.now() - dbStart;
    
    healthCheck.database = {
      status: 'connected',
      responseTime: `${dbDuration}ms`
    };
  } catch (error) {
    healthCheck.status = 'error';
    healthCheck.database = {
      status: 'disconnected',
      error: error.message
    };
    return res.status(503).json(healthCheck);
  }

  res.json(healthCheck);
});

// 🚀 新增：简化的ping接口
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'pong', 
    timestamp: new Date().toISOString() 
  });
});

// 启动服务器 - 🚀 优化：支持环境变量配置
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 云收发服务器启动成功！`);
  console.log(`📍 服务地址: http://${HOST}:${PORT}`);
  console.log(`🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📅 启动时间: ${new Date().toLocaleString('zh-CN')}`);
  
  // 🚀 优化：详细的环境信息输出
  console.log('🔧 环境配置:', {
    NODE_ENV: process.env.NODE_ENV || 'development',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_USER: process.env.DB_USER || 'root',
    DB_NAME: process.env.DB_NAME || 'processing_app',
    JWT_SECRET: process.env.JWT_SECRET ? '✅ 已设置' : '❌ 未设置',
    UPLOAD_DIR: process.env.UPLOAD_DIR || '默认路径',
    CORS_ORIGINS: corsOrigins.join(', ')
  });

  // 新增：启动会话清理定时任务
  try {
    sessionCleanup.startCleanupSchedule();
    console.log('✅ 会话清理任务已启动');
  } catch (error) {
    console.warn('⚠️ 会话清理任务启动失败:', error.message);
    // 不影响服务器正常运行
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，准备关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

module.exports = app;
