/**
 * 会话管理中间件
 * 防止并发登录、异常会话检测和会话安全管理
 */

const cloud = require('wx-server-sdk')
const crypto = require('crypto')

const db = cloud.database()
const _ = db.command

// 会话配置
const SESSION_CONFIG = {
  // 最大并发会话数
  MAX_CONCURRENT_SESSIONS: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 3,
  // 会话超时时间（毫秒）
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT) || 2 * 60 * 60 * 1000, // 2小时
  // 会话清理间隔（毫秒）
  CLEANUP_INTERVAL: parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 30 * 60 * 1000, // 30分钟
  // 异常检测阈值
  SUSPICIOUS_LOGIN_THRESHOLD: 5, // 5次异常登录
  SUSPICIOUS_TIME_WINDOW: 15 * 60 * 1000 // 15分钟内
}

/**
 * 生成会话ID
 * @returns {string} 会话ID
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 获取客户端信息
 * @param {Object} event 请求事件
 * @returns {Object} 客户端信息
 */
function getClientInfo(event) {
  const headers = event.headers || {}
  return {
    userAgent: headers['user-agent'] || headers['User-Agent'] || 'unknown',
    ip: event.clientIP || headers['x-forwarded-for'] || headers['X-Forwarded-For'] || 'unknown',
    platform: headers['x-wx-platform'] || 'unknown',
    version: headers['x-wx-version'] || 'unknown'
  }
}

/**
 * 创建新会话
 * @param {string} userId 用户ID
 * @param {string} orgId 组织ID
 * @param {Object} clientInfo 客户端信息
 * @returns {Object} 会话信息
 */
async function createSession(userId, clientInfo, accessToken = null) {
  try {
    const sessionId = generateSessionId()
    const now = new Date()
    
    const sessionData = {
      sessionId,
      userId,
      clientInfo,
      accessToken,
      createdAt: now,
      lastActiveAt: now,
      expiresAt: new Date(now.getTime() + SESSION_CONFIG.SESSION_TIMEOUT),
      status: 'active',
      loginCount: 1
    }
    
    // 插入会话记录
    await db.collection('user_sessions').add({
      data: sessionData
    })
    
    return {
      success: true,
      sessionId,
      expiresAt: sessionData.expiresAt
    }
  } catch (error) {
    console.error('创建会话失败:', error)
    return {
      success: false,
      error: '会话创建失败'
    }
  }
}

/**
 * 检查并清理过期会话
 * @param {string} userId 用户ID
 */
async function cleanupExpiredSessions(userId) {
  try {
    const now = new Date()
    
    // 删除过期会话
    await db.collection('user_sessions')
      .where({
        userId,
        expiresAt: _.lt(now)
      })
      .remove()
      
    // 标记超时会话为过期
    await db.collection('user_sessions')
      .where({
        userId,
        status: 'active',
        lastActiveAt: _.lt(new Date(now.getTime() - SESSION_CONFIG.SESSION_TIMEOUT))
      })
      .update({
        data: {
          status: 'expired',
          updatedAt: now
        }
      })
  } catch (error) {
    console.error('清理过期会话失败:', error)
  }
}

/**
 * 检查并发会话限制
 * @param {string} userId 用户ID
 * @param {Object} clientInfo 客户端信息
 * @returns {Object} 检查结果
 */
async function checkConcurrentSessions(userId, clientInfo) {
  try {
    // 先清理过期会话
    await cleanupExpiredSessions(userId)
    
    // 查询当前活跃会话
    const activeSessionsResult = await db.collection('user_sessions')
      .where({
        userId,
        status: 'active',
        expiresAt: _.gte(new Date())
      })
      .orderBy('lastActiveAt', 'desc')
      .get()
    
    const activeSessions = activeSessionsResult.data
    
    // 检查是否超过并发限制
    if (activeSessions.length >= SESSION_CONFIG.MAX_CONCURRENT_SESSIONS) {
      // 检查是否是相同设备
      const sameDeviceSession = activeSessions.find(session => 
        session.clientInfo.userAgent === clientInfo.userAgent &&
        session.clientInfo.ip === clientInfo.ip
      )
      
      if (sameDeviceSession) {
        // 相同设备，更新现有会话
        await db.collection('user_sessions')
          .doc(sameDeviceSession._id)
          .update({
            data: {
              lastActiveAt: new Date(),
              expiresAt: new Date(Date.now() + SESSION_CONFIG.SESSION_TIMEOUT),
              loginCount: _.inc(1)
            }
          })
        
        return {
          success: true,
          action: 'updated',
          sessionId: sameDeviceSession.sessionId
        }
      } else {
        // 不同设备，踢出最旧的会话
        const oldestSession = activeSessions[activeSessions.length - 1]
        await db.collection('user_sessions')
          .doc(oldestSession._id)
          .update({
            data: {
              status: 'kicked_out',
              updatedAt: new Date(),
              reason: 'concurrent_limit_exceeded'
            }
          })
        
        return {
          success: true,
          action: 'kicked_out_oldest',
          kickedSessionId: oldestSession.sessionId
        }
      }
    }
    
    return {
      success: true,
      action: 'allowed'
    }
  } catch (error) {
    console.error('检查并发会话失败:', error)
    return {
      success: false,
      error: '会话检查失败'
    }
  }
}

/**
 * 检测异常登录行为
 * @param {string} userId 用户ID
 * @param {Object} clientInfo 客户端信息
 * @returns {Object} 检测结果
 */
async function detectSuspiciousActivity(userId, clientInfo) {
  try {
    const timeWindow = new Date(Date.now() - SESSION_CONFIG.SUSPICIOUS_TIME_WINDOW)
    
    // 查询时间窗口内的登录记录
    const recentLoginsResult = await db.collection('user_sessions')
      .where({
        userId,
        createdAt: _.gte(timeWindow)
      })
      .get()
    
    const recentLogins = recentLoginsResult.data
    
    // 检查登录频率
    if (recentLogins.length >= SESSION_CONFIG.SUSPICIOUS_LOGIN_THRESHOLD) {
      return {
        suspicious: true,
        reason: 'high_frequency_login',
        count: recentLogins.length,
        timeWindow: SESSION_CONFIG.SUSPICIOUS_TIME_WINDOW / 60000 // 转换为分钟
      }
    }
    
    // 检查IP地址变化
    const uniqueIPs = new Set(recentLogins.map(login => login.clientInfo.ip))
    if (uniqueIPs.size > 3) {
      return {
        suspicious: true,
        reason: 'multiple_ip_addresses',
        ipCount: uniqueIPs.size,
        ips: Array.from(uniqueIPs)
      }
    }
    
    // 检查设备变化
    const uniqueDevices = new Set(recentLogins.map(login => login.clientInfo.userAgent))
    if (uniqueDevices.size > 2) {
      return {
        suspicious: true,
        reason: 'multiple_devices',
        deviceCount: uniqueDevices.size
      }
    }
    
    return {
      suspicious: false
    }
  } catch (error) {
    console.error('异常行为检测失败:', error)
    return {
      suspicious: false,
      error: '检测失败'
    }
  }
}

/**
 * 验证会话
 * @param {string} sessionId 会话ID
 * @param {string} userId 用户ID
 * @returns {Object} 验证结果
 */
async function validateSession(sessionId, userId) {
  try {
    if (!sessionId || !userId) {
      return {
        valid: false,
        error: '会话参数缺失'
      }
    }
    
    // 查询会话
    const sessionResult = await db.collection('user_sessions')
      .where({
        sessionId,
        userId,
        status: 'active'
      })
      .get()
    
    if (sessionResult.data.length === 0) {
      return {
        valid: false,
        error: '会话不存在或已失效'
      }
    }
    
    const session = sessionResult.data[0]
    const now = new Date()
    
    // 检查会话是否过期
    if (session.expiresAt < now) {
      // 标记会话为过期
      await db.collection('user_sessions')
        .doc(session._id)
        .update({
          data: {
            status: 'expired',
            updatedAt: now
          }
        })
      
      return {
        valid: false,
        error: '会话已过期'
      }
    }
    
    // 更新最后活跃时间
    await db.collection('user_sessions')
      .doc(session._id)
      .update({
        data: {
          lastActiveAt: now,
          expiresAt: new Date(now.getTime() + SESSION_CONFIG.SESSION_TIMEOUT)
        }
      })
    
    return {
      valid: true,
      session: {
        sessionId: session.sessionId,
        userId: session.userId,
        orgId: session.orgId,
        createdAt: session.createdAt,
        lastActiveAt: now
      }
    }
  } catch (error) {
    console.error('会话验证失败:', error)
    return {
      valid: false,
      error: '会话验证失败'
    }
  }
}

/**
 * 终止会话
 * @param {string} sessionId 会话ID
 * @param {string} userId 用户ID
 * @param {string} reason 终止原因
 */
async function terminateSession(sessionId, userId, reason = 'user_logout') {
  try {
    await db.collection('user_sessions')
      .where({
        sessionId,
        userId
      })
      .update({
        data: {
          status: 'terminated',
          updatedAt: new Date(),
          reason
        }
      })
    
    return {
      success: true
    }
  } catch (error) {
    console.error('终止会话失败:', error)
    return {
      success: false,
      error: '终止会话失败'
    }
  }
}

/**
 * 终止用户所有会话
 * @param {string} userId 用户ID
 * @param {string} reason 终止原因
 */
async function terminateAllUserSessions(userId, reason = 'admin_action') {
  try {
    await db.collection('user_sessions')
      .where({
        userId,
        status: 'active'
      })
      .update({
        data: {
          status: 'terminated',
          updatedAt: new Date(),
          reason
        }
      })
    
    return {
      success: true
    }
  } catch (error) {
    console.error('终止所有会话失败:', error)
    return {
      success: false,
      error: '终止所有会话失败'
    }
  }
}

/**
 * 获取用户活跃会话列表
 * @param {string} userId 用户ID
 * @returns {Object} 会话列表
 */
async function getUserActiveSessions(userId) {
  try {
    const result = await db.collection('user_sessions')
      .where({
        userId,
        status: 'active',
        expiresAt: _.gte(new Date())
      })
      .orderBy('lastActiveAt', 'desc')
      .get()
    
    const sessions = result.data.map(session => ({
      sessionId: session.sessionId,
      clientInfo: session.clientInfo,
      createdAt: session.createdAt,
      lastActiveAt: session.lastActiveAt,
      expiresAt: session.expiresAt
    }))
    
    return {
      success: true,
      sessions
    }
  } catch (error) {
    console.error('获取用户会话失败:', error)
    return {
      success: false,
      error: '获取会话列表失败'
    }
  }
}

module.exports = {
  SESSION_CONFIG,
  createSession,
  validateSession,
  terminateSession,
  terminateAllUserSessions,
  checkConcurrentSessions,
  detectSuspiciousActivity,
  getUserActiveSessions,
  cleanupExpiredSessions,
  getClientInfo
}