/**
 * API访问频率限制中间件
 * 防止暴力攻击、DDoS攻击和API滥用
 */

const cloud = require('wx-server-sdk')
const crypto = require('crypto')

const db = cloud.database()
const _ = db.command

// 频率限制配置
const RATE_LIMIT_CONFIG = {
  // 默认限制规则
  DEFAULT: {
    windowMs: 15 * 60 * 1000, // 15分钟窗口
    maxRequests: 100, // 最大请求数
    message: '请求过于频繁，请稍后再试'
  },
  
  // 登录接口限制
  LOGIN: {
    windowMs: 15 * 60 * 1000, // 15分钟窗口
    maxRequests: 5, // 最大5次登录尝试
    blockDuration: 30 * 60 * 1000, // 封禁30分钟
    message: '登录尝试过于频繁，账户已被临时锁定'
  },
  
  // 敏感操作限制
  SENSITIVE: {
    windowMs: 5 * 60 * 1000, // 5分钟窗口
    maxRequests: 10, // 最大10次请求
    message: '敏感操作过于频繁，请稍后再试'
  },
  
  // 数据查询限制
  QUERY: {
    windowMs: 1 * 60 * 1000, // 1分钟窗口
    maxRequests: 60, // 最大60次请求
    message: '查询请求过于频繁，请稍后再试'
  },
  
  // 文件上传限制
  UPLOAD: {
    windowMs: 10 * 60 * 1000, // 10分钟窗口
    maxRequests: 20, // 最大20次上传
    message: '文件上传过于频繁，请稍后再试'
  }
}

// IP黑名单缓存（内存缓存，重启后清空）
const ipBlacklist = new Map()
const suspiciousIPs = new Map()

/**
 * 获取客户端标识
 * @param {Object} event 请求事件
 * @returns {string} 客户端标识
 */
function getClientIdentifier(event) {
  try {
    const headers = event?.headers || {}
    const ip = String(event?.clientIP || headers['x-forwarded-for'] || headers['X-Forwarded-For'] || 'unknown')
    const userAgent = String(headers['user-agent'] || headers['User-Agent'] || 'unknown')
    
    // 使用IP和User-Agent的组合作为标识
    return crypto.createHash('md5').update(`${ip}:${userAgent}`).digest('hex')
  } catch (error) {
    console.error('获取客户端标识失败:', error)
    return crypto.createHash('md5').update('fallback:unknown').digest('hex')
  }
}

/**
 * 获取用户标识
 * @param {string} userId 用户ID
 * @param {Object} event 请求事件
 * @returns {string} 用户标识
 */
function getUserIdentifier(userId, event) {
  if (userId) {
    return `user:${userId}`
  }
  return `client:${getClientIdentifier(event)}`
}

/**
 * 检查IP是否在黑名单中
 * @param {string} ip IP地址
 * @returns {boolean} 是否被封禁
 */
function isIPBlocked(ip) {
  const blockInfo = ipBlacklist.get(ip)
  if (!blockInfo) return false
  
  // 检查封禁是否过期
  if (Date.now() > blockInfo.expiresAt) {
    ipBlacklist.delete(ip)
    return false
  }
  
  return true
}

/**
 * 添加IP到黑名单
 * @param {string} ip IP地址
 * @param {number} duration 封禁时长（毫秒）
 * @param {string} reason 封禁原因
 */
function blockIP(ip, duration, reason = 'rate_limit_exceeded') {
  const expiresAt = Date.now() + duration
  ipBlacklist.set(ip, {
    blockedAt: Date.now(),
    expiresAt,
    reason
  })
  
  console.log(`IP ${ip} 已被封禁，原因: ${reason}, 到期时间: ${new Date(expiresAt)}`)
}

/**
 * 记录可疑IP
 * @param {string} ip IP地址
 * @param {string} reason 可疑原因
 */
function markSuspiciousIP(ip, reason) {
  const current = suspiciousIPs.get(ip) || { count: 0, reasons: [] }
  current.count++
  current.reasons.push({ reason, timestamp: Date.now() })
  current.lastSeen = Date.now()
  
  suspiciousIPs.set(ip, current)
  
  // 如果可疑行为超过阈值，自动封禁
  if (current.count >= 10) {
    blockIP(ip, 60 * 60 * 1000, 'suspicious_activity') // 封禁1小时
  }
}

/**
 * 获取或创建限制记录
 * @param {string} identifier 标识符
 * @param {Object} config 限制配置
 * @returns {Object} 限制记录
 */
async function getRateLimitRecord(identifier, config) {
  try {
    const now = Date.now()
    const windowStart = now - config.windowMs
    
    // 查询现有记录
    const result = await db.collection('rate_limits')
      .where({
        identifier,
        createdAt: _.gte(new Date(windowStart))
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    
    if (result.data.length > 0) {
      const record = result.data[0]
      
      // 如果记录在当前窗口内，返回现有记录
      if (record.createdAt.getTime() >= windowStart) {
        return {
          exists: true,
          record,
          isNewWindow: false
        }
      }
    }
    
    // 创建新记录
    const newRecord = {
      identifier,
      requests: [],
      createdAt: new Date(now),
      windowStart: new Date(windowStart),
      windowEnd: new Date(now + config.windowMs)
    }
    
    const addResult = await db.collection('rate_limits').add({
      data: newRecord
    })
    
    return {
      exists: false,
      record: { ...newRecord, _id: addResult._id },
      isNewWindow: true
    }
  } catch (error) {
    console.error('获取限制记录失败:', error)
    throw error
  }
}

/**
 * 更新限制记录
 * @param {string} recordId 记录ID
 * @param {Array} requests 请求列表
 */
async function updateRateLimitRecord(recordId, requests) {
  try {
    await db.collection('rate_limits')
      .doc(recordId)
      .update({
        data: {
          requests,
          updatedAt: new Date()
        }
      })
  } catch (error) {
    console.error('更新限制记录失败:', error)
  }
}

/**
 * 清理过期的限制记录
 */
async function cleanupExpiredRecords() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时前
    
    await db.collection('rate_limits')
      .where({
        createdAt: _.lt(cutoff)
      })
      .remove()
  } catch (error) {
    console.error('清理过期记录失败:', error)
  }
}

/**
 * 检查频率限制
 * @param {string} identifier 标识符
 * @param {Object} config 限制配置
 * @param {Object} requestInfo 请求信息
 * @returns {Object} 检查结果
 */
async function checkRateLimit(identifier, config, requestInfo = {}) {
  try {
    const now = Date.now()
    
    // 获取限制记录
    const { record, isNewWindow } = await getRateLimitRecord(identifier, config)
    
    // 过滤当前窗口内的请求
    const windowStart = now - config.windowMs
    const currentRequests = record.requests.filter(req => 
      req.timestamp >= windowStart
    )
    
    // 检查是否超过限制
    if (currentRequests.length >= config.maxRequests) {
      // 记录违规行为
      const violationInfo = {
        identifier,
        requestCount: currentRequests.length,
        limit: config.maxRequests,
        windowMs: config.windowMs,
        timestamp: now,
        requestInfo
      }
      
      // 如果是IP标识符，标记为可疑
      if (identifier.startsWith('client:')) {
        const ip = requestInfo.ip || 'unknown'
        markSuspiciousIP(ip, 'rate_limit_exceeded')
      }
      
      // 记录违规日志
      await db.collection('rate_limit_violations').add({
        data: violationInfo
      })
      
      return {
        allowed: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: config.message,
        retryAfter: Math.ceil((windowStart + config.windowMs - now) / 1000),
        requestCount: currentRequests.length,
        limit: config.maxRequests
      }
    }
    
    // 添加当前请求
    const newRequest = {
      timestamp: now,
      ...requestInfo
    }
    
    currentRequests.push(newRequest)
    
    // 更新记录
    await updateRateLimitRecord(record._id, currentRequests)
    
    return {
      allowed: true,
      requestCount: currentRequests.length,
      limit: config.maxRequests,
      remaining: config.maxRequests - currentRequests.length,
      resetTime: windowStart + config.windowMs
    }
  } catch (error) {
    console.error('频率限制检查失败:', error)
    // 发生错误时允许请求通过，但记录错误
    return {
      allowed: true,
      error: 'RATE_LIMIT_CHECK_FAILED'
    }
  }
}

/**
 * 创建频率限制中间件
 * @param {string} limitType 限制类型
 * @param {Object} customConfig 自定义配置
 * @returns {Function} 中间件函数
 */
function createRateLimitMiddleware(limitType = 'DEFAULT', customConfig = {}) {
  const config = { ...RATE_LIMIT_CONFIG[limitType], ...customConfig }
  
  return async function rateLimitMiddleware(event, userId = null) {
    try {
      const headers = event?.headers || {}
      const ip = String(event?.clientIP || headers['x-forwarded-for'] || headers['X-Forwarded-For'] || 'unknown')
      
      // 检查IP黑名单
      if (isIPBlocked(ip)) {
        return {
          allowed: false,
          error: 'IP_BLOCKED',
          message: 'IP地址已被封禁，请联系管理员'
        }
      }
      
      // 获取标识符
      const identifier = getUserIdentifier(userId, event)
      
      // 准备请求信息
      const requestInfo = {
        ip,
        userAgent: String(headers['user-agent'] || headers['User-Agent'] || 'unknown'),
        path: String(event?.path || 'unknown'),
        method: String(event?.httpMethod || 'unknown'),
        userId
      }
      
      // 检查频率限制
      const result = await checkRateLimit(identifier, config, requestInfo)
      
      return result
    } catch (error) {
      console.error('频率限制检查失败:', error)
      return {
        allowed: true,
        message: '频率限制检查失败，允许通过'
      }
    }
  }
}

/**
 * 预定义的频率限制中间件
 */
const rateLimiters = {
  // 默认限制
  default: createRateLimitMiddleware('DEFAULT'),
  
  // 登录限制
  login: createRateLimitMiddleware('LOGIN'),
  
  // 敏感操作限制
  sensitive: createRateLimitMiddleware('SENSITIVE'),
  
  // 查询限制
  query: createRateLimitMiddleware('QUERY'),
  
  // 上传限制
  upload: createRateLimitMiddleware('UPLOAD')
}

/**
 * 获取IP统计信息
 * @param {string} ip IP地址
 * @returns {Object} IP统计
 */
function getIPStats(ip) {
  return {
    isBlocked: isIPBlocked(ip),
    blockInfo: ipBlacklist.get(ip),
    suspiciousInfo: suspiciousIPs.get(ip)
  }
}

/**
 * 手动封禁IP
 * @param {string} ip IP地址
 * @param {number} duration 封禁时长（毫秒）
 * @param {string} reason 封禁原因
 */
function manualBlockIP(ip, duration, reason = 'manual_block') {
  blockIP(ip, duration, reason)
}

/**
 * 解除IP封禁
 * @param {string} ip IP地址
 */
function unblockIP(ip) {
  ipBlacklist.delete(ip)
  suspiciousIPs.delete(ip)
  console.log(`IP ${ip} 已解除封禁`)
}

// 定期清理过期记录（每小时执行一次）
setInterval(cleanupExpiredRecords, 60 * 60 * 1000)

module.exports = {
  RATE_LIMIT_CONFIG,
  createRateLimitMiddleware,
  rateLimiters,
  checkRateLimit,
  getIPStats,
  manualBlockIP,
  unblockIP,
  isIPBlocked,
  cleanupExpiredRecords
}