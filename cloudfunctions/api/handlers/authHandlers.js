// 认证相关处理函数
const cloud = require('wx-server-sdk')
const { 
  performanceMonitor, 
  ErrorTypes, 
  createErrorResponse, 
  createSuccessResponse,
  validateParams,
  dbWrapper,
  rateLimiter
} = require('../utils/common')
const { ApiResponse, BusinessErrorCodes } = require('../config/apiStandards')

// 导入新的安全中间件
const { generateTokenPair, verifyToken: verifyJWT, refreshAccessToken } = require('../config/jwt')
const { validators } = require('../middleware/validation')
const { rateLimiters } = require('../middleware/rateLimit')
const { 
  createSession, 
  validateSession, 
  terminateSession, 
  checkConcurrentSessions,
  detectSuspiciousActivity,
  getClientInfo
} = require('../middleware/session')
const { hashPassword, verifyPassword, encryptSensitiveFields } = require('../utils/encryption')

const db = cloud.database()
const _ = db.command

/**
 * 用户登录
 * @param {Object} params 登录参数
 * @param {Object} event 请求事件对象
 */
async function login(params, event) {
  const monitor = performanceMonitor.start('用户登录')
  
  try {
    // 频率限制检查 - 临时禁用以排查问题
    try {
      const rateLimitResult = await rateLimiters.login(event)
      if (!rateLimitResult.allowed) {
        return createErrorResponse(BusinessErrorCodes.INVALID_PARAMETER, rateLimitResult.message)
      }
    } catch (rateLimitError) {
      console.warn('频率限制检查失败，跳过:', rateLimitError)
      // 继续执行，不阻止登录
    }
    
    // 参数验证和清理
    const sanitizedParams = validators.login(params)
    const { orgCode, username, password } = sanitizedParams
    
    // 获取客户端信息
    let clientInfo
    try {
      clientInfo = getClientInfo(event)
    } catch (clientInfoError) {
      console.warn('获取客户端信息失败，使用默认值:', clientInfoError)
      clientInfo = {
        ip: 'unknown',
        userAgent: 'unknown',
        platform: 'unknown'
      }
    }
    
    // 异常行为检测
    const suspiciousResult = await detectSuspiciousActivity(null, clientInfo)
    if (suspiciousResult.suspicious) {
      console.warn('检测到可疑登录行为:', suspiciousResult)
    }
    
    // 查找组织
    const orgResult = await dbWrapper.safeGet(
      db.collection('organizations'),
      { code: orgCode, status: 'active' }
    )
    
    if (!orgResult.success) {
      return createErrorResponse(BusinessErrorCodes.DATABASE_ERROR, '查询组织信息失败', orgResult.error)
    }
    
    if (orgResult.data.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.AUTHENTICATION_ERROR, '组织不存在或已停用')
    }
    
    const organization = orgResult.data[0]
    
    // 查找用户
    const userResult = await dbWrapper.safeGet(
      db.collection('users'),
      {
        username: username,
        org_id: organization._id,
        status: 'active'
      }
    )
    
    if (!userResult.success) {
      return createErrorResponse(BusinessErrorCodes.DATABASE_ERROR, '查询用户信息失败', userResult.error)
    }
    
    if (userResult.data.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.AUTHENTICATION_ERROR, '用户不存在或已停用')
    }
    
    const user = userResult.data[0]
    
    // 验证密码
    const passwordValid = await verifyPassword(password, user.password)
    if (!passwordValid) {
      return ApiResponse.error(BusinessErrorCodes.AUTHENTICATION_ERROR, '密码错误')
    }
    
    // 检查并发会话限制
    const concurrentCheck = await checkConcurrentSessions(user._id, clientInfo)
    if (!concurrentCheck.success) {
      return createErrorResponse(BusinessErrorCodes.UNAUTHORIZED, concurrentCheck.error || '会话检查失败')
    }
    
    // 生成JWT token对
    const tokenPayload = {
      userId: user._id,
      username: user.username,
      orgId: organization._id,
      orgCode: organization.code,
      roleId: user.role_id,
      isSuperAdmin: user.is_super_admin || false
    }
    
    const tokens = generateTokenPair(tokenPayload)
    
    // 创建会话
    const sessionResult = await createSession(user._id, clientInfo, tokens.accessToken)
    if (!sessionResult.success) {
      console.warn('创建会话失败:', sessionResult.error)
    }
    
    // 更新最后登录时间和会话信息
    const updateResult = await dbWrapper.safeUpdate(
      db.collection('users'),
      { _id: user._id },
      {
        last_login: new Date(),
        last_login_ip: clientInfo.ip,
        updated_at: new Date()
      }
    )
    
    if (!updateResult.success) {
      console.warn('更新用户登录时间失败:', updateResult.error)
    }
    
    return ApiResponse.success({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      sessionId: sessionResult.sessionId,
      user: {
        id: user._id,
        username: user.username,
        real_name: user.real_name,
        email: user.email,
        phone: user.phone,
        role_id: user.role_id,
        is_super_admin: user.is_super_admin || false,
        org_id: organization._id,
        org_name: organization.name,
        org_code: organization.code
      }
    }, '登录成功')
    
  } catch (error) {
    console.error('登录异常:', error)
    return createErrorResponse(ErrorTypes.SYSTEM, '登录失败，请稍后重试', error.message)
  } finally {
    monitor.end()
  }
}

/**
 * 验证token
 * @param {Object} params 验证参数
 * @param {Object} event 请求事件对象
 */
async function verifyToken(params, event) {
  try {
    const { token, sessionId } = params
    
    if (!token) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '未提供认证token')
    }
    
    // 验证JWT
    const jwtResult = verifyJWT(token)
    if (!jwtResult.valid) {
      return {
        success: false,
        error: jwtResult.error || 'token无效'
      }
    }
    
    const decoded = jwtResult.payload
    
    // 验证会话
    if (sessionId) {
      const sessionResult = await validateSession(sessionId, decoded.userId)
      if (!sessionResult.valid) {
        return {
          success: false,
          error: sessionResult.error || '会话无效'
        }
      }
    }
    
    // 查询用户是否仍然有效
    const userResult = await db.collection('users')
      .doc(decoded.userId)
      .get()
    
    if (!userResult.data || userResult.data.status !== 'active') {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, 'token无效或用户已停用')
    }
    
    return ApiResponse.success({
        valid: true,
        user: decoded,
        sessionValid: !!sessionId
      }, '操作成功')
  } catch (error) {
    console.error('验证token错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, 'token验证失败')
  }
}

/**
 * 会话心跳
 * @param {Object} params 心跳参数
 */
async function sessionHeartbeat(params) {
  try {
    const { token } = params
    
    if (!token) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '未提供认证token')
    }
    
    // 验证token
    const verifyResult = await verifyToken({ token })
    if (!verifyResult.success) {
      return verifyResult
    }
    
    // 更新用户最后活跃时间
    await db.collection('users')
      .doc(verifyResult.data.user.userId)
      .update({
        data: {
          last_active: new Date(),
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success({
        message: '心跳成功'
      }, '操作成功')
  } catch (error) {
    console.error('会话心跳错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '会话心跳失败')
  }
}

/**
 * 用户登出
 * @param {Object} params 登出参数
 * @param {Object} event 请求事件对象
 */
async function logout(params, event) {
  try {
    const { token, sessionId, logoutAll = false } = params
    
    if (!token) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '未提供认证token')
    }
    
    // 验证token
    const verifyResult = await verifyToken({ token, sessionId }, event)
    if (!verifyResult.success) {
      return verifyResult
    }
    
    const userId = verifyResult.data.user.userId
    
    // 终止会话
    if (sessionId) {
      await terminateSession(sessionId, userId)
    }
    
    // 如果是全部登出，终止用户所有会话
    if (logoutAll) {
      await terminateSession(null, userId) // null sessionId 表示终止所有会话
    }
    
    // 更新用户登出时间
    await db.collection('users')
      .doc(userId)
      .update({
        data: {
          last_logout: new Date(),
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success({
        message: '登出成功'
      }, '操作成功')
  } catch (error) {
    console.error('登出错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '登出失败')
  }
}

/**
 * 修改密码
 * @param {Object} userInfo 用户信息
 * @param {Object} params 修改密码参数
 */
async function changePassword(userInfo, params) {
  try {
    // 参数验证和清理
    const sanitizedParams = validators.changePassword(params)
    const { currentPassword, newPassword } = sanitizedParams
    
    // 获取用户信息
    const userResult = await db.collection('users')
      .doc(userInfo.userId)
      .get()
    
    if (!userResult.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '用户不存在')
    }
    
    const user = userResult.data
    
    // 验证当前密码
    const passwordValid = await verifyPassword(currentPassword, user.password)
    if (!passwordValid) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '当前密码错误')
    }
    
    // 生成新密码hash
    const newHashedPassword = await hashPassword(newPassword)
    
    // 更新密码
    await db.collection('users')
      .doc(userInfo.userId)
      .update({
        data: {
          password: newHashedPassword,
          updated_at: new Date()
        }
      })
    
    // 密码修改后，终止用户所有会话（强制重新登录）
    await terminateSession(null, userInfo.userId)
    
    return ApiResponse.success({
        message: '密码修改成功，请重新登录'
      }, '操作成功')
  } catch (error) {
    console.error('修改密码错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '修改密码失败')
  }
}

module.exports = {
  login,
  verifyToken,
  sessionHeartbeat,
  logout,
  changePassword
}