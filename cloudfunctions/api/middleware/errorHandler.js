// 统一错误处理和日志记录中间件
const cloud = require('wx-server-sdk')

// 错误类型定义
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR', 
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  DATABASE: 'DATABASE_ERROR',
  SYSTEM: 'SYSTEM_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  BUSINESS: 'BUSINESS_ERROR'
}

// 错误码映射
const ErrorCodes = {
  [ErrorTypes.VALIDATION]: 400,
  [ErrorTypes.AUTHENTICATION]: 401,
  [ErrorTypes.AUTHORIZATION]: 403,
  [ErrorTypes.NOT_FOUND]: 404,
  [ErrorTypes.RATE_LIMIT]: 429,
  [ErrorTypes.DATABASE]: 500,
  [ErrorTypes.SYSTEM]: 500,
  [ErrorTypes.BUSINESS]: 422
}

// 日志级别
const LogLevels = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
}

/**
 * 创建标准化错误响应
 * @param {string} type 错误类型
 * @param {string} message 错误消息
 * @param {*} details 错误详情
 * @param {string} requestId 请求ID
 * @returns {Object} 标准化错误响应
 */
function createErrorResponse(type, message, details = null, requestId = null) {
  const errorCode = ErrorCodes[type] || 500
  const timestamp = new Date().toISOString()
  
  const errorResponse = {
    success: false,
    error: {
      type,
      code: errorCode,
      message,
      timestamp,
      requestId
    }
  }
  
  // 只在开发环境或调试模式下包含详细错误信息
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true') {
    if (details) {
      errorResponse.error.details = details
    }
  }
  
  return errorResponse
}

/**
 * 创建标准化成功响应
 * @param {*} data 响应数据
 * @param {string} message 成功消息
 * @param {string} requestId 请求ID
 * @returns {Object} 标准化成功响应
 */
function createSuccessResponse(data = null, message = '操作成功', requestId = null) {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    requestId
  }
  
  if (data !== null) {
    response.data = data
  }
  
  return response
}

/**
 * 日志记录器
 */
class Logger {
  constructor() {
    this.db = cloud.database()
  }
  
  /**
   * 记录日志到数据库
   * @param {string} level 日志级别
   * @param {string} message 日志消息
   * @param {Object} context 上下文信息
   */
  async log(level, message, context = {}) {
    try {
      const logEntry = {
        level,
        message,
        context,
        timestamp: new Date(),
        environment: process.env.NODE_ENV || 'development'
      }
      
      // 控制台输出
      console.log(`[${level.toUpperCase()}] ${message}`, context)
      
      // 异步写入数据库（不阻塞主流程）
      setImmediate(async () => {
        try {
          await this.db.collection('system_logs').add({
            data: logEntry
          })
        } catch (dbError) {
          console.error('写入日志到数据库失败:', dbError)
        }
      })
      
    } catch (error) {
      console.error('日志记录失败:', error)
    }
  }
  
  error(message, context = {}) {
    return this.log(LogLevels.ERROR, message, context)
  }
  
  warn(message, context = {}) {
    return this.log(LogLevels.WARN, message, context)
  }
  
  info(message, context = {}) {
    return this.log(LogLevels.INFO, message, context)
  }
  
  debug(message, context = {}) {
    return this.log(LogLevels.DEBUG, message, context)
  }
}

const logger = new Logger()

/**
 * 全局错误处理中间件
 * @param {Function} handler 处理函数
 * @returns {Function} 包装后的处理函数
 */
function errorHandler(handler) {
  return async (event, context) => {
    const requestId = context.requestId || generateRequestId()
    const startTime = Date.now()
    
    try {
      // 记录请求开始
      await logger.info('请求开始', {
        requestId,
        path: event.path,
        method: event.httpMethod,
        userAgent: event.headers['user-agent'],
        ip: getClientIP(event)
      })
      
      // 执行处理函数
      const result = await handler(event, context)
      
      // 记录请求成功
      const duration = Date.now() - startTime
      await logger.info('请求完成', {
        requestId,
        duration,
        success: true
      })
      
      // 确保返回标准格式
      if (result && typeof result === 'object') {
        if (!result.hasOwnProperty('success')) {
          return createSuccessResponse(result, '操作成功', requestId)
        }
        // 添加requestId到现有响应
        if (!result.requestId) {
          result.requestId = requestId
        }
        return result
      }
      
      return createSuccessResponse(result, '操作成功', requestId)
      
    } catch (error) {
      // 记录错误
      const duration = Date.now() - startTime
      await logger.error('请求失败', {
        requestId,
        duration,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        path: event.path,
        method: event.httpMethod
      })
      
      // 根据错误类型返回相应的错误响应
      if (error.type && ErrorTypes[error.type]) {
        return createErrorResponse(error.type, error.message, error.details, requestId)
      }
      
      // 未知错误
      return createErrorResponse(
        ErrorTypes.SYSTEM, 
        '系统内部错误，请稍后重试', 
        process.env.NODE_ENV === 'development' ? error.message : null,
        requestId
      )
    }
  }
}

/**
 * 生成请求ID
 * @returns {string} 请求ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 获取客户端IP
 * @param {Object} event 事件对象
 * @returns {string} 客户端IP
 */
function getClientIP(event) {
  return event.headers['x-forwarded-for'] || 
         event.headers['x-real-ip'] || 
         event.requestContext?.identity?.sourceIp || 
         'unknown'
}

/**
 * 创建业务错误
 * @param {string} message 错误消息
 * @param {*} details 错误详情
 * @returns {Error} 业务错误对象
 */
function createBusinessError(message, details = null) {
  const error = new Error(message)
  error.type = ErrorTypes.BUSINESS
  error.details = details
  return error
}

/**
 * 创建验证错误
 * @param {string} message 错误消息
 * @param {*} details 错误详情
 * @returns {Error} 验证错误对象
 */
function createValidationError(message, details = null) {
  const error = new Error(message)
  error.type = ErrorTypes.VALIDATION
  error.details = details
  return error
}

/**
 * 创建认证错误
 * @param {string} message 错误消息
 * @param {*} details 错误详情
 * @returns {Error} 认证错误对象
 */
function createAuthenticationError(message, details = null) {
  const error = new Error(message)
  error.type = ErrorTypes.AUTHENTICATION
  error.details = details
  return error
}

module.exports = {
  ErrorTypes,
  ErrorCodes,
  LogLevels,
  createErrorResponse,
  createSuccessResponse,
  errorHandler,
  logger,
  createBusinessError,
  createValidationError,
  createAuthenticationError,
  generateRequestId,
  getClientIP
}