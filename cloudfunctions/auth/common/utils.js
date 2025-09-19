/**
 * 云函数通用工具库
 * 提供统一的错误处理、日志记录、参数验证等功能
 * 
 * @author 云收发技术团队
 * @version 3.0.0
 * @since 2024-12-19
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// 安全配置常量
const JWT_SECRET = process.env.JWT_SECRET || 'yunsf-jwt-secret-2024-default-key-for-development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOGIN_LOCKOUT_TIME = parseInt(process.env.LOGIN_LOCKOUT_TIME) || 15 * 60 * 1000; // 15分钟

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * 错误代码常量
 */
const ERROR_CODES = {
  // 认证相关
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // 参数验证
  INVALID_PARAMS: 'INVALID_PARAMS',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_DATA_TYPE: 'INVALID_DATA_TYPE',
  
  // 业务逻辑
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // 系统错误
  DATABASE_ERROR: 'DATABASE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * 日志记录器
 */
class Logger {
  static log(level, message, data = null, context = '') {
    // 在云函数环境中减少日志输出，避免进程异常退出
    if (level === 'error') {
      const logEntry = {
        level,
        message,
        data,
        context,
        timestamp: new Date().toISOString(),
        requestId: this.getCurrentRequestId()
      };
      
      console.error(`[${level.toUpperCase()}] ${JSON.stringify(logEntry)}`);
    }
  }
  
  static info(message, data = null, context = '') {
    // 禁用info日志输出
  }
  
  static warn(message, data = null, context = '') {
    // 禁用warn日志输出
  }
  
  static error(message, error = null, context = '') {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code
    } : null;
    
    this.log('error', message, errorData, context);
  }
  
  static debug(message, data = null, context = '') {
    // 禁用debug日志输出
  }
  
  static getCurrentRequestId() {
    // 在实际应用中，这里应该从上下文中获取请求ID
    return global.currentRequestId || 'unknown';
  }
}

/**
 * 参数验证器
 */
class Validator {
  /**
   * 验证必填字段
   */
  static validateRequired(data, requiredFields) {
    const missing = [];
    
    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      throw new AppError(
        `缺少必填字段: ${missing.join(', ')}`,
        ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        { missingFields: missing }
      );
    }
  }
  
  /**
   * 验证数据类型
   */
  static validateTypes(data, typeMap) {
    const errors = [];
    
    for (const [field, expectedType] of Object.entries(typeMap)) {
      if (data[field] !== undefined) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          errors.push(`${field} 应该是 ${expectedType} 类型，实际是 ${actualType}`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new AppError(
        `数据类型错误: ${errors.join(', ')}`,
        ERROR_CODES.INVALID_DATA_TYPE,
        400,
        { typeErrors: errors }
      );
    }
  }
  
  /**
   * 验证字符串长度
   */
  static validateStringLength(data, lengthMap) {
    const errors = [];
    
    for (const [field, constraints] of Object.entries(lengthMap)) {
      if (data[field] && typeof data[field] === 'string') {
        const length = data[field].length;
        
        if (constraints.min && length < constraints.min) {
          errors.push(`${field} 长度不能少于 ${constraints.min} 个字符`);
        }
        
        if (constraints.max && length > constraints.max) {
          errors.push(`${field} 长度不能超过 ${constraints.max} 个字符`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new AppError(
        `字符串长度验证失败: ${errors.join(', ')}`,
        ERROR_CODES.INVALID_PARAMS,
        400,
        { lengthErrors: errors }
      );
    }
  }
  
  /**
   * 验证数值范围
   */
  static validateNumberRange(data, rangeMap) {
    const errors = [];
    
    for (const [field, constraints] of Object.entries(rangeMap)) {
      if (data[field] !== undefined && typeof data[field] === 'number') {
        const value = data[field];
        
        if (constraints.min !== undefined && value < constraints.min) {
          errors.push(`${field} 不能小于 ${constraints.min}`);
        }
        
        if (constraints.max !== undefined && value > constraints.max) {
          errors.push(`${field} 不能大于 ${constraints.max}`);
        }
      }
    }
    
    if (errors.length > 0) {
      throw new AppError(
        `数值范围验证失败: ${errors.join(', ')}`,
        ERROR_CODES.INVALID_PARAMS,
        400,
        { rangeErrors: errors }
      );
    }
  }
  
  /**
   * 验证邮箱格式
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new AppError(
        '邮箱格式不正确',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
  }
  
  /**
   * 验证手机号格式
   */
  static validatePhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      throw new AppError(
        '手机号格式不正确',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
  }
}

/**
 * JWT工具类
 */
class JWTUtils {
  // 令牌黑名单（生产环境应使用Redis等外部存储）
  static tokenBlacklist = new Set();
  
  /**
   * 生成JWT Token
   */
  static generateToken(payload, options = {}) {
    try {
      // 添加安全字段
      const enhancedPayload = {
        ...payload,
        jti: `jwt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // JWT ID，用于令牌撤销
        iat: Math.floor(Date.now() / 1000), // 签发时间
        nbf: Math.floor(Date.now() / 1000), // 生效时间
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // 会话ID
      };
      
      const tokenOptions = {
        expiresIn: options.expiresIn || JWT_EXPIRES_IN,
        issuer: 'yunsf-system',
        audience: 'yunsf-users',
        algorithm: 'HS256'
      };
      
      const token = jwt.sign(enhancedPayload, JWT_SECRET, tokenOptions);
      
      Logger.info('JWT令牌生成成功', {
        userId: payload.userId,
        jti: enhancedPayload.jti,
        expiresIn: tokenOptions.expiresIn
      }, 'JWTUtils.generateToken');
      
      return token;
    } catch (error) {
      Logger.error('JWT生成失败', error, 'JWTUtils.generateToken');
      throw new AppError(
        'Token生成失败',
        ERROR_CODES.INTERNAL_ERROR,
        500
      );
    }
  }
  
  /**
   * 生成刷新令牌
   */
  static generateRefreshToken(payload) {
    return this.generateToken(payload, {
      expiresIn: JWT_REFRESH_EXPIRES_IN
    });
  }
  
  /**
   * 验证JWT Token
   */
  static verifyToken(token, options = {}) {
    try {
      // 检查令牌是否在黑名单中
      if (this.tokenBlacklist.has(token)) {
        throw new AppError(
          'Token已被撤销',
          ERROR_CODES.INVALID_TOKEN,
          401
        );
      }
      
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'yunsf-system',
        audience: 'yunsf-users',
        algorithms: ['HS256'],
        ...options
      });
      
      // 验证令牌完整性
      if (!decoded.jti || !decoded.sessionId) {
        throw new AppError(
          'Token格式无效',
          ERROR_CODES.INVALID_TOKEN,
          401
        );
      }
      
      return decoded;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      if (error.name === 'TokenExpiredError') {
        Logger.warn('Token已过期', { token: token.substring(0, 20) + '...' }, 'JWTUtils.verifyToken');
        throw new AppError(
          'Token已过期',
          ERROR_CODES.TOKEN_EXPIRED,
          401
        );
      } else if (error.name === 'JsonWebTokenError') {
        Logger.warn('Token格式无效', { error: error.message }, 'JWTUtils.verifyToken');
        throw new AppError(
          'Token无效',
          ERROR_CODES.INVALID_TOKEN,
          401
        );
      } else if (error.name === 'NotBeforeError') {
        throw new AppError(
          'Token尚未生效',
          ERROR_CODES.INVALID_TOKEN,
          401
        );
      } else {
        Logger.error('JWT验证失败', error, 'JWTUtils.verifyToken');
        throw new AppError(
          'Token验证失败',
          ERROR_CODES.INTERNAL_ERROR,
          500
        );
      }
    }
  }
  
  /**
   * 刷新Token
   */
  static refreshToken(refreshToken) {
    try {
      // 验证刷新令牌（允许过期）
      const decoded = jwt.verify(refreshToken, JWT_SECRET, {
        ignoreExpiration: true,
        issuer: 'yunsf-system',
        audience: 'yunsf-users'
      });
      
      // 检查刷新令牌是否在黑名单中
      if (this.tokenBlacklist.has(refreshToken)) {
        throw new AppError(
          '刷新令牌已被撤销',
          ERROR_CODES.INVALID_TOKEN,
          401
        );
      }
      
      // 检查令牌是否过期太久（超过刷新期限）
      const now = Math.floor(Date.now() / 1000);
      const maxRefreshTime = decoded.iat + (30 * 24 * 60 * 60); // 30天
      
      if (now > maxRefreshTime) {
        throw new AppError(
          '刷新令牌已过期，请重新登录',
          ERROR_CODES.TOKEN_EXPIRED,
          401
        );
      }
      
      // 移除JWT标准字段和旧的安全字段
      const { iat, exp, iss, aud, jti, nbf, sessionId, ...payload } = decoded;
      
      // 生成新的访问令牌和刷新令牌
      const newAccessToken = this.generateToken(payload);
      const newRefreshToken = this.generateRefreshToken(payload);
      
      // 将旧的刷新令牌加入黑名单
      this.revokeToken(refreshToken);
      
      Logger.info('Token刷新成功', {
        userId: payload.userId,
        oldJti: jti
      }, 'JWTUtils.refreshToken');
      
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      Logger.error('Token刷新失败', error, 'JWTUtils.refreshToken');
      throw new AppError(
        'Token刷新失败',
        ERROR_CODES.INVALID_TOKEN,
        401
      );
    }
  }
  
  /**
   * 撤销Token（加入黑名单）
   */
  static revokeToken(token) {
    try {
      this.tokenBlacklist.add(token);
      
      // 定期清理过期的黑名单令牌（简单实现）
      if (this.tokenBlacklist.size > 10000) {
        this.cleanupBlacklist();
      }
      
      Logger.info('Token已撤销', { token: token.substring(0, 20) + '...' }, 'JWTUtils.revokeToken');
    } catch (error) {
      Logger.error('Token撤销失败', error, 'JWTUtils.revokeToken');
    }
  }
  
  /**
   * 清理过期的黑名单令牌
   */
  static cleanupBlacklist() {
    const now = Math.floor(Date.now() / 1000);
    const tokensToRemove = [];
    
    for (const token of this.tokenBlacklist) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp && decoded.exp < now) {
          tokensToRemove.push(token);
        }
      } catch (error) {
        // 无法解码的令牌也移除
        tokensToRemove.push(token);
      }
    }
    
    tokensToRemove.forEach(token => this.tokenBlacklist.delete(token));
    
    Logger.info(`清理了 ${tokensToRemove.length} 个过期的黑名单令牌`, null, 'JWTUtils.cleanupBlacklist');
  }
  
  /**
   * 解码Token（不验证）
   */
  static decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      Logger.error('Token解码失败', error, 'JWTUtils.decodeToken');
      return null;
    }
  }
}

/**
 * 密码工具类
 */
class PasswordUtils {
  /**
   * 生成盐值
   */
  static generateSalt() {
    // 使用时间戳和随机数生成盐值，避免crypto.randomBytes可能导致的进程退出
    const timestamp = Date.now().toString(36);
    const random1 = Math.random().toString(36).substr(2, 15);
    const random2 = Math.random().toString(36).substr(2, 15);
    return `${timestamp}${random1}${random2}`.padEnd(64, '0').substr(0, 64);
  }
  
  /**
   * 哈希密码 - 使用更安全的参数
   */
  static hashPassword(password, salt) {
    // 使用更高的迭代次数提高安全性
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }
  
  /**
   * 验证密码
   */
  static verifyPassword(password, hash, salt) {
    try {
      const hashToVerify = this.hashPassword(password, salt);
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashToVerify, 'hex'));
    } catch (error) {
      Logger.error('密码验证失败', error, 'PasswordUtils.verifyPassword');
      return false;
    }
  }
  
  /**
   * 验证密码强度
   */
  static validatePasswordStrength(password) {
    const errors = [];
    
    if (!password || password.length < 8) {
      errors.push('密码长度至少8位');
    }
    
    if (password.length > 128) {
      errors.push('密码长度不能超过128位');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }
    
    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }
    
    // 检查常见弱密码
    const commonPasswords = ['password', '123456', 'admin', 'root', 'user'];
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      errors.push('密码不能包含常见弱密码');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 生成随机密码
   */
  static generateRandomPassword(length = 12) {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    // 确保密码包含各种字符类型
    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // 填充剩余长度
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // 打乱密码字符顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  /**
   * 检查密码是否已泄露（简单实现）
   */
  static checkPasswordBreach(password) {
    // 这里可以集成HaveIBeenPwned等服务
    // 目前只做基本检查
    const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
    
    // 简单的本地黑名单检查
    const commonHashes = [
      '5E884898DA28047151D0E56F8DC6292773603D0D6AABBDD62A11EF721D1542D8', // 'password'
      'E10ADC3949BA59ABBE56E057F20F883E', // '123456'
      'C7AD44CBAD762A5DA0A452F9E854FDC1E0E7A52A38015F23F3EAB1D80B931DD472634DFAC71CD34EBC35D16AB7FB8A90C81F975113D6C7538DC69DD8DE9077EC' // 'admin'
    ];
    
    return {
      isBreached: commonHashes.includes(hash),
      message: commonHashes.includes(hash) ? '密码已在数据泄露中发现，请使用其他密码' : '密码安全'
    };
  }
}

/**
 * 数据库工具类
 */
class DatabaseUtils {
  /**
   * 构建分页查询
   */
  static buildPaginationQuery(collection, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    return collection.skip(skip).limit(limit);
  }
  
  /**
   * 构建日期范围查询
   */
  static buildDateRangeQuery(field, startDate, endDate) {
    const query = {};
    
    if (startDate && endDate) {
      query[field] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query[field] = { $gte: new Date(startDate) };
    } else if (endDate) {
      query[field] = { $lte: new Date(endDate) };
    }
    
    return query;
  }
  
  /**
   * 安全的文档添加
   */
  static async safeAdd(collection, data, options = {}) {
    try {
      // 添加创建时间戳
      const finalData = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await collection.add({
        data: finalData,
        ...options
      });
      
      Logger.info('文档添加成功', { docId: result._id, data: finalData }, 'DatabaseUtils.safeAdd');
      return result;
    } catch (error) {
      Logger.error('文档添加失败', error, 'DatabaseUtils.safeAdd');
      throw new AppError(
        '数据添加失败',
        ERROR_CODES.DATABASE_ERROR,
        500,
        { error: error.message }
      );
    }
  }
  
  /**
   * 安全的文档更新
   */
  static async safeUpdate(collection, docId, updateData, options = {}) {
    try {
      // 添加更新时间戳
      const finalUpdateData = {
        ...updateData,
        updatedAt: new Date()
      };
      
      const result = await collection.doc(docId).update({
        data: finalUpdateData,
        ...options
      });
      
      Logger.info('文档更新成功', { docId, updateData: finalUpdateData }, 'DatabaseUtils.safeUpdate');
      return result;
    } catch (error) {
      Logger.error('文档更新失败', error, 'DatabaseUtils.safeUpdate');
      throw new AppError(
        '数据更新失败',
        ERROR_CODES.DATABASE_ERROR,
        500,
        { docId, error: error.message }
      );
    }
  }
  
  /**
   * 安全的文档删除
   */
  static async safeDelete(collection, docId) {
    try {
      const result = await collection.doc(docId).remove();
      Logger.info('文档删除成功', { docId }, 'DatabaseUtils.safeDelete');
      return result;
    } catch (error) {
      Logger.error('文档删除失败', error, 'DatabaseUtils.safeDelete');
      throw new AppError(
        '数据删除失败',
        ERROR_CODES.DATABASE_ERROR,
        500,
        { docId, error: error.message }
      );
    }
  }
}

/**
 * 响应工具类
 */
class ResponseUtils {
  /**
   * 成功响应
   */
  static success(data = null, message = '操作成功') {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 错误响应
   */
  static error(message, code = ERROR_CODES.INTERNAL_ERROR, statusCode = 500, details = null) {
    return {
      success: false,
      error: message,
      code,
      statusCode,
      details,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * 分页响应
   */
  static paginated(data, total, page, limit, hasMore = null) {
    const response = {
      success: true,
      data: {
        list: data,
        pagination: {
          total,
          page,
          limit,
          hasMore: hasMore !== null ? hasMore : (page * limit < total)
        }
      },
      timestamp: new Date().toISOString()
    };
    
    return response;
  }
}

/**
 * 统一错误处理函数
 */
function handleError(error, context = '') {
  if (error instanceof AppError) {
    Logger.error(`业务错误 [${context}]`, error, context);
    return error.toJSON();
  }
  
  // 处理数据库错误
  if (error.message && error.message.includes('database')) {
    Logger.error(`数据库错误 [${context}]`, error, context);
    return ResponseUtils.error(
      '数据库操作失败',
      ERROR_CODES.DATABASE_ERROR,
      500,
      { originalError: error.message }
    );
  }
  
  // 处理网络错误
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    Logger.error(`网络错误 [${context}]`, error, context);
    return ResponseUtils.error(
      '网络连接失败',
      ERROR_CODES.NETWORK_ERROR,
      503,
      { originalError: error.message }
    );
  }
  
  // 未知错误
  Logger.error(`未知错误 [${context}]`, error, context);
  return ResponseUtils.error(
    '系统内部错误',
    ERROR_CODES.INTERNAL_ERROR,
    500,
    { originalError: error.message }
  );
}

/**
 * Token验证中间件
 */
async function validateToken(token) {
  if (!token) {
    throw new AppError(
      'Token不能为空',
      ERROR_CODES.UNAUTHORIZED,
      401
    );
  }
  
  try {
    const decoded = JWTUtils.verifyToken(token);
    Logger.debug('Token验证成功', { userId: decoded.userId }, 'validateToken');
    
    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(
      'Token验证失败',
      ERROR_CODES.INVALID_TOKEN,
      401
    );
  }
}

/**
 * 权限检查函数
 */
async function checkPermission(userInfo, requiredPermission, resource = null) {
  // 超级管理员拥有所有权限
  if (userInfo.role === 'super_admin') {
    return true;
  }
  
  // 检查用户权限
  const userPermissions = userInfo.permissions || [];
  
  // 简单权限检查
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }
  
  // 资源级权限检查
  if (resource && userPermissions.includes(`${requiredPermission}:${resource}`)) {
    return true;
  }
  
  throw new AppError(
    '权限不足',
    ERROR_CODES.FORBIDDEN,
    403,
    { requiredPermission, resource }
  );
}

module.exports = {
  AppError,
  ERROR_CODES,
  Logger,
  Validator,
  JWTUtils,
  PasswordUtils,
  DatabaseUtils,
  ResponseUtils,
  handleError,
  validateToken,
  checkPermission
};