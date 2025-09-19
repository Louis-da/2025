// API接口规范化配置

/**
 * 标准HTTP状态码
 */
const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
}

/**
 * 业务错误码定义
 */
const BusinessErrorCodes = {
  // 通用错误 (1000-1999)
  INVALID_PARAMETER: 1001,
  MISSING_PARAMETER: 1002,
  PARAMETER_FORMAT_ERROR: 1003,
  OPERATION_NOT_ALLOWED: 1004,
  RESOURCE_NOT_FOUND: 1005,
  DUPLICATE_RESOURCE: 1006,
  
  // 认证相关错误 (2000-2999)
  INVALID_TOKEN: 2001,
  TOKEN_EXPIRED: 2002,
  INVALID_CREDENTIALS: 2003,
  ACCOUNT_LOCKED: 2004,
  ACCOUNT_DISABLED: 2005,
  INSUFFICIENT_PERMISSIONS: 2006,
  SESSION_EXPIRED: 2007,
  CONCURRENT_LOGIN_LIMIT: 2008,
  SUSPICIOUS_ACTIVITY: 2009,
  
  // 用户相关错误 (3000-3999)
  USER_NOT_FOUND: 3001,
  USERNAME_EXISTS: 3002,
  INVALID_PASSWORD: 3003,
  PASSWORD_TOO_WEAK: 3004,
  USER_ALREADY_ACTIVE: 3005,
  USER_ALREADY_INACTIVE: 3006,
  
  // 组织相关错误 (4000-4999)
  ORGANIZATION_NOT_FOUND: 4001,
  ORGANIZATION_CODE_EXISTS: 4002,
  ORGANIZATION_INACTIVE: 4003,
  ORGANIZATION_LIMIT_EXCEEDED: 4004,
  
  // 角色权限相关错误 (5000-5999)
  ROLE_NOT_FOUND: 5001,
  ROLE_NAME_EXISTS: 5002,
  PERMISSION_DENIED: 5003,
  ROLE_IN_USE: 5004,
  
  // 数据库相关错误 (6000-6999)
  DATABASE_CONNECTION_ERROR: 6001,
  DATABASE_QUERY_ERROR: 6002,
  DATABASE_CONSTRAINT_VIOLATION: 6003,
  DATABASE_TIMEOUT: 6004,
  
  // 系统相关错误 (7000-7999)
  SYSTEM_MAINTENANCE: 7001,
  SERVICE_UNAVAILABLE: 7002,
  RATE_LIMIT_EXCEEDED: 7003,
  FILE_UPLOAD_ERROR: 7004,
  EXTERNAL_SERVICE_ERROR: 7005
}

/**
 * 错误码对应的消息
 */
const ErrorMessages = {
  [BusinessErrorCodes.INVALID_PARAMETER]: '参数无效',
  [BusinessErrorCodes.MISSING_PARAMETER]: '缺少必需参数',
  [BusinessErrorCodes.PARAMETER_FORMAT_ERROR]: '参数格式错误',
  [BusinessErrorCodes.OPERATION_NOT_ALLOWED]: '操作不被允许',
  [BusinessErrorCodes.RESOURCE_NOT_FOUND]: '资源不存在',
  [BusinessErrorCodes.DUPLICATE_RESOURCE]: '资源已存在',
  
  [BusinessErrorCodes.INVALID_TOKEN]: '无效的访问令牌',
  [BusinessErrorCodes.TOKEN_EXPIRED]: '访问令牌已过期',
  [BusinessErrorCodes.INVALID_CREDENTIALS]: '用户名或密码错误',
  [BusinessErrorCodes.ACCOUNT_LOCKED]: '账户已被锁定',
  [BusinessErrorCodes.ACCOUNT_DISABLED]: '账户已被禁用',
  [BusinessErrorCodes.INSUFFICIENT_PERMISSIONS]: '权限不足',
  [BusinessErrorCodes.SESSION_EXPIRED]: '会话已过期',
  [BusinessErrorCodes.CONCURRENT_LOGIN_LIMIT]: '超出并发登录限制',
  [BusinessErrorCodes.SUSPICIOUS_ACTIVITY]: '检测到可疑活动',
  
  [BusinessErrorCodes.USER_NOT_FOUND]: '用户不存在',
  [BusinessErrorCodes.USERNAME_EXISTS]: '用户名已存在',
  [BusinessErrorCodes.INVALID_PASSWORD]: '密码错误',
  [BusinessErrorCodes.PASSWORD_TOO_WEAK]: '密码强度不足',
  [BusinessErrorCodes.USER_ALREADY_ACTIVE]: '用户已激活',
  [BusinessErrorCodes.USER_ALREADY_INACTIVE]: '用户已停用',
  
  [BusinessErrorCodes.ORGANIZATION_NOT_FOUND]: '组织不存在',
  [BusinessErrorCodes.ORGANIZATION_CODE_EXISTS]: '组织代码已存在',
  [BusinessErrorCodes.ORGANIZATION_INACTIVE]: '组织已停用',
  [BusinessErrorCodes.ORGANIZATION_LIMIT_EXCEEDED]: '超出组织数量限制',
  
  [BusinessErrorCodes.ROLE_NOT_FOUND]: '角色不存在',
  [BusinessErrorCodes.ROLE_NAME_EXISTS]: '角色名称已存在',
  [BusinessErrorCodes.PERMISSION_DENIED]: '权限被拒绝',
  [BusinessErrorCodes.ROLE_IN_USE]: '角色正在使用中',
  
  [BusinessErrorCodes.DATABASE_CONNECTION_ERROR]: '数据库连接错误',
  [BusinessErrorCodes.DATABASE_QUERY_ERROR]: '数据库查询错误',
  [BusinessErrorCodes.DATABASE_CONSTRAINT_VIOLATION]: '数据约束违反',
  [BusinessErrorCodes.DATABASE_TIMEOUT]: '数据库操作超时',
  
  [BusinessErrorCodes.SYSTEM_MAINTENANCE]: '系统维护中',
  [BusinessErrorCodes.SERVICE_UNAVAILABLE]: '服务不可用',
  [BusinessErrorCodes.RATE_LIMIT_EXCEEDED]: '请求频率超限',
  [BusinessErrorCodes.FILE_UPLOAD_ERROR]: '文件上传失败',
  [BusinessErrorCodes.EXTERNAL_SERVICE_ERROR]: '外部服务错误'
}

/**
 * API响应格式规范
 */
class ApiResponse {
  /**
   * 创建成功响应
   * @param {*} data 响应数据
   * @param {string} message 成功消息
   * @param {Object} meta 元数据（分页信息等）
   * @param {string} requestId 请求ID
   * @returns {Object} 标准成功响应
   */
  static success(data = null, message = '操作成功', meta = null, requestId = null) {
    const response = {
      success: true,
      code: 0, // 0表示成功
      message,
      timestamp: new Date().toISOString(),
      requestId
    }
    
    if (data !== null) {
      response.data = data
    }
    
    if (meta !== null) {
      response.meta = meta
    }
    
    return response
  }
  
  /**
   * 创建错误响应
   * @param {number} code 业务错误码
   * @param {string} message 错误消息
   * @param {*} details 错误详情
   * @param {string} requestId 请求ID
   * @returns {Object} 标准错误响应
   */
  static error(code, message = null, details = null, requestId = null) {
    const response = {
      success: false,
      code,
      message: message || ErrorMessages[code] || '未知错误',
      timestamp: new Date().toISOString(),
      requestId
    }
    
    // 只在开发环境显示详细错误信息
    if (details && (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODE === 'true')) {
      response.details = details
    }
    
    return response
  }
  
  /**
   * 创建分页响应
   * @param {Array} items 数据项
   * @param {number} total 总数
   * @param {number} page 当前页
   * @param {number} pageSize 页大小
   * @param {string} message 消息
   * @param {string} requestId 请求ID
   * @returns {Object} 分页响应
   */
  static paginated(items, total, page, pageSize, message = '查询成功', requestId = null) {
    const totalPages = Math.ceil(total / pageSize)
    
    return this.success(
      items,
      message,
      {
        pagination: {
          total,
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      },
      requestId
    )
  }
  
  /**
   * 创建列表响应
   * @param {Array} items 数据项
   * @param {string} message 消息
   * @param {string} requestId 请求ID
   * @returns {Object} 列表响应
   */
  static list(items, message = '查询成功', requestId = null) {
    return this.success(
      items,
      message,
      {
        count: items.length
      },
      requestId
    )
  }
}

/**
 * 参数验证规则
 */
const ValidationRules = {
  // 通用规则
  required: (value) => value !== undefined && value !== null && value !== '',
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && !isNaN(value),
  integer: (value) => Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value),
  object: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  
  // 长度规则
  minLength: (min) => (value) => typeof value === 'string' && value.length >= min,
  maxLength: (max) => (value) => typeof value === 'string' && value.length <= max,
  length: (len) => (value) => typeof value === 'string' && value.length === len,
  
  // 数值规则
  min: (min) => (value) => typeof value === 'number' && value >= min,
  max: (max) => (value) => typeof value === 'number' && value <= max,
  range: (min, max) => (value) => typeof value === 'number' && value >= min && value <= max,
  
  // 格式规则
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  phone: (value) => /^1[3-9]\d{9}$/.test(value),
  idCard: (value) => /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(value),
  url: (value) => /^https?:\/\/.+/.test(value),
  
  // 业务规则
  username: (value) => /^[a-zA-Z0-9_]{3,20}$/.test(value),
  password: (value) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(value),
  orgCode: (value) => /^[A-Z0-9]{2,10}$/.test(value)
}

/**
 * 分页参数标准化
 * @param {Object} params 请求参数
 * @returns {Object} 标准化的分页参数
 */
function standardizePagination(params) {
  const page = Math.max(1, parseInt(params.page) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize) || 10))
  const skip = (page - 1) * pageSize
  
  return {
    page,
    pageSize,
    skip,
    limit: pageSize
  }
}

/**
 * 排序参数标准化
 * @param {string} sortBy 排序字段
 * @param {string} sortOrder 排序方向
 * @param {Array} allowedFields 允许的排序字段
 * @returns {Object} 标准化的排序参数
 */
function standardizeSort(sortBy, sortOrder = 'desc', allowedFields = []) {
  // 验证排序字段
  if (sortBy && allowedFields.length > 0 && !allowedFields.includes(sortBy)) {
    sortBy = allowedFields[0] // 使用默认字段
  }
  
  // 标准化排序方向
  const order = ['asc', 'desc'].includes(sortOrder?.toLowerCase()) ? sortOrder.toLowerCase() : 'desc'
  
  return {
    sortBy: sortBy || 'created_at',
    sortOrder: order,
    mongoSort: { [sortBy || 'created_at']: order === 'asc' ? 1 : -1 }
  }
}

module.exports = {
  HttpStatus,
  BusinessErrorCodes,
  ErrorMessages,
  ApiResponse,
  ValidationRules,
  standardizePagination,
  standardizeSort
}