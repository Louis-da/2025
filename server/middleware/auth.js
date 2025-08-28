// middleware/auth.js
const db = require('../db');
let jwt;

// 尝试导入JWT
try {
  jwt = require('jsonwebtoken');
} catch (err) {
  // 修改错误信息，只提示缺少jsonwebtoken
  console.error('缺少必要的依赖，请运行: npm install jsonwebtoken');
  console.error('错误详情:', err.message);
  process.exit(1);
}

// JWT密钥 - 安全配置
const JWT_SECRET = process.env.JWT_SECRET;

// 🚀 优化：更优雅的JWT密钥检查
if (!JWT_SECRET) {
  console.error('❌ 严重安全错误: JWT_SECRET 环境变量未设置');
  console.error('请在环境变量中设置 JWT_SECRET，建议使用强随机字符串，长度至少32位');
  console.error('例如: export JWT_SECRET="your-strong-random-secret-key"');
  
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 生产环境必须设置JWT_SECRET，服务器即将退出');
    process.exit(1);
  } else {
    console.warn('⚠️ 开发环境检测到JWT_SECRET未设置，将使用临时密钥');
    console.warn('⚠️ 请勿在生产环境使用此配置');
    // 为开发环境生成临时密钥
    process.env.JWT_SECRET = 'dev-temp-jwt-secret-' + Date.now() + '-' + Math.random().toString(36);
  }
}

// 🚀 优化：JWT密钥强度检查
const finalJwtSecret = process.env.JWT_SECRET;
if (finalJwtSecret && finalJwtSecret.length < 32) {
  console.warn('⚠️ 安全警告: JWT_SECRET 长度不足32位，建议使用更长的密钥');
  if (process.env.NODE_ENV === 'production') {
    console.error('🚨 生产环境JWT密钥长度不足，存在安全风险');
  }
}

// 验证用户是否已登录
const authenticate = async (req, res, next) => {
  try {
    // 🔧 优化：减少详细日志输出，仅在必要时记录
    const isDebugMode = process.env.NODE_ENV === 'development';
    
    if (isDebugMode) {
      console.log('认证请求:', {
        path: req.path,
        method: req.method,
        hasAuth: !!req.headers.authorization,
        hasToken: !!req.headers.token
      });
    }
    
    // 免验证的路由 - 精确匹配
    const publicPaths = [
      '/auth/login',
      '/api/auth/login',
      '/organizations',
      '/health',
      '/api/health',
      '/users/miniprogram-auth'
    ];
    
    // 检查是否是免验证路由 - 修复匹配逻辑
    const isPublicPath = publicPaths.includes(req.path);
    
    if (isPublicPath) {
      if (isDebugMode) {
        console.log('公开路径，跳过认证:', req.path);
      }
      return next();
    }
    
    // 尝试从 Authorization: Bearer 头 或自定义的 token 头 获取 Token
    const authHeader = req.headers.authorization;
    const customTokenHeader = req.headers.token; // 获取自定义的 'token' 请求头
    
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      if (isDebugMode) {
        console.log('从 Authorization 头获取到 Token');
      }
    } else if (customTokenHeader) {
      token = customTokenHeader;
      if (isDebugMode) {
        console.log('从自定义 token 头获取到 Token');
      }
    }
    
    if (!token) {
      // 如果没有获取到 token，返回401
      console.warn('认证失败: 未提供 Token，路径:', req.path);
      return res.status(401).json({
        success: false,
        error: '请先登录'
      });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (isDebugMode) {
        console.log('JWT验证成功:', { userId: decoded.userId, orgId: decoded.orgId });
      }
      
      // 验证用户是否仍然存在且状态正常
      const [user] = await db.executeQuery(
        'SELECT id, username, orgId, role_id, is_super_admin FROM users WHERE id = ? AND status = 1',
        [decoded.userId]
      );
      
      if (!user) {
        console.warn('JWT用户不存在或已禁用:', decoded.userId);
        return res.status(401).json({
          success: false,
          error: '用户不存在或已被禁用'
        });
      }
      
      req.user = {
        userId: user.id,
        username: user.username,
        orgId: user.orgId,
        roleId: user.role_id,
        isSuperAdmin: user.is_super_admin === 1
      };
      
      return next();
    } catch (jwtError) {
      // 🔧 优化：减少JWT错误的详细日志
      console.warn('JWT验证失败:', {
        error: jwtError.name,
        message: jwtError.message,
        path: req.path
      });
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: '登录已过期，请重新登录'
        });
      }
      
      return res.status(401).json({
        success: false,
        error: '无效的身份验证令牌'
      });
    }
  } catch (error) {
    console.error('认证中间件错误:', error);
    return res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

// 检查是否为超级管理员
const isSuperAdmin = (req, res, next) => {
  if (!req.user) {
    console.warn('未经认证的超级管理员访问');
    return res.status(401).json({
      success: false,
      error: '请先登录'
    });
  }
  
  if (!req.user.isSuperAdmin) {
    console.warn('非超级管理员访问:', req.user.username);
    return res.status(403).json({
      success: false,
      error: '需要超级管理员权限'
    });
  }
  
  next();
};

// 检查是否为老板
const isOrgAdmin = (req, res, next) => {
  if (!req.user) {
    console.warn('未经认证的老板访问');
    return res.status(401).json({
      success: false,
      error: '请先登录'
    });
  }
  
  // 超级管理员或老板可以访问
  if (req.user.isSuperAdmin || req.user.roleId === 2) {
    return next();
  }
  
  console.warn('非老板访问:', req.user.username);
  return res.status(403).json({
    success: false,
    error: '需要老板权限'
  });
};

// 验证路径中的ID参数
const validateIdParam = (req, res, next) => {
  if (req.params.id) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      console.warn('无效的ID参数:', req.params.id);
      return res.status(400).json({
        success: false,
        error: '无效的ID参数'
      });
    }
    req.params.id = id; // 转换为数字
  }
  next();
};

module.exports = {
  authenticate,
  isSuperAdmin,
  isOrgAdmin,
  validateIdParam
}; 