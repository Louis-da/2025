// 云函数通用工具模块

// 性能监控工具
const performanceMonitor = {
  start: (action) => {
    return {
      action,
      startTime: Date.now(),
      end: function() {
        const duration = Date.now() - this.startTime
        console.log(`[性能监控] ${this.action} 执行时间: ${duration}ms`)
        if (duration > 2000) {
          console.warn(`[性能警告] ${this.action} 执行时间过长: ${duration}ms`)
        }
        return duration
      }
    }
  }
}

// 错误类型定义
const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR', 
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  NETWORK: 'NETWORK_ERROR',
  SYSTEM: 'SYSTEM_ERROR'
}

// 创建标准化错误响应
const createErrorResponse = (type, message, details = null) => {
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  console.error(`[错误] ${errorId} - ${type}: ${message}`, details)
  
  return {
    success: false,
    error: message,
    errorType: type,
    errorId,
    timestamp: new Date().toISOString()
  }
}

// 创建成功响应
const createSuccessResponse = (data = null, message = null) => {
  return {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  }
}

// 参数验证工具
const validateParams = (params, requiredFields) => {
  const missing = []
  
  for (const field of requiredFields) {
    if (!params[field]) {
      missing.push(field)
    }
  }
  
  if (missing.length > 0) {
    return {
      valid: false,
      error: `缺少必需参数: ${missing.join(', ')}`
    }
  }
  
  return { valid: true }
}

// 数据库操作包装器
const dbWrapper = {
  async safeGet(collection, query) {
    try {
      const result = await collection.where(query).get()
      return { success: true, data: result.data }
    } catch (error) {
      console.error('[数据库错误] 查询失败:', error)
      return { success: false, error: error.message }
    }
  },
  
  async safeAdd(collection, data) {
    try {
      const result = await collection.add({ data })
      return { success: true, data: result }
    } catch (error) {
      console.error('[数据库错误] 添加失败:', error)
      return { success: false, error: error.message }
    }
  },
  
  async safeUpdate(collection, query, data) {
    try {
      const result = await collection.where(query).update({ data })
      return { success: true, data: result }
    } catch (error) {
      console.error('[数据库错误] 更新失败:', error)
      return { success: false, error: error.message }
    }
  },
  
  async safeRemove(collection, query) {
    try {
      const result = await collection.where(query).remove()
      return { success: true, data: result }
    } catch (error) {
      console.error('[数据库错误] 删除失败:', error)
      return { success: false, error: error.message }
    }
  }
}

// 缓存工具（简单内存缓存）
const cache = {
  data: new Map(),
  
  set(key, value, ttl = 300000) { // 默认5分钟过期
    this.data.set(key, {
      value,
      expires: Date.now() + ttl
    })
  },
  
  get(key) {
    const item = this.data.get(key)
    if (!item) return null
    
    if (Date.now() > item.expires) {
      this.data.delete(key)
      return null
    }
    
    return item.value
  },
  
  delete(key) {
    this.data.delete(key)
  },
  
  clear() {
    this.data.clear()
  }
}

// 限流工具
const rateLimiter = {
  requests: new Map(),
  
  isAllowed(key, maxRequests = 100, windowMs = 60000) {
    const now = Date.now()
    const windowStart = now - windowMs
    
    if (!this.requests.has(key)) {
      this.requests.set(key, [])
    }
    
    const requests = this.requests.get(key)
    
    // 清理过期请求
    const validRequests = requests.filter(time => time > windowStart)
    this.requests.set(key, validRequests)
    
    if (validRequests.length >= maxRequests) {
      return false
    }
    
    validRequests.push(now)
    return true
  }
}

module.exports = {
  performanceMonitor,
  ErrorTypes,
  createErrorResponse,
  createSuccessResponse,
  validateParams,
  dbWrapper,
  cache,
  rateLimiter
}