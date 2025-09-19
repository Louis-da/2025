/**
 * JWT 安全配置和管理
 * 企业级JWT token管理机制
 */

const crypto = require('crypto')
const jwt = require('jsonwebtoken')

// JWT配置
const JWT_CONFIG = {
  // 使用更强的密钥，优先从环境变量获取
  SECRET: process.env.JWT_SECRET || generateSecureSecret(),
  // Token过期时间配置
  ACCESS_TOKEN_EXPIRES: process.env.ACCESS_TOKEN_EXPIRES || '2h', // 访问token 2小时
  REFRESH_TOKEN_EXPIRES: process.env.REFRESH_TOKEN_EXPIRES || '7d', // 刷新token 7天
  // 发行者
  ISSUER: process.env.JWT_ISSUER || 'yunsf-system',
  // 受众
  AUDIENCE: process.env.JWT_AUDIENCE || 'yunsf-users'
}

/**
 * 生成安全的JWT密钥
 */
function generateSecureSecret() {
  // 生成256位随机密钥
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 生成访问token
 * @param {Object} payload 用户信息
 * @returns {string} JWT token
 */
function generateAccessToken(payload) {
  const tokenPayload = {
    ...payload,
    type: 'access',
    iat: Math.floor(Date.now() / 1000)
  }
  
  return jwt.sign(tokenPayload, JWT_CONFIG.SECRET, {
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRES,
    issuer: JWT_CONFIG.ISSUER,
    audience: JWT_CONFIG.AUDIENCE,
    algorithm: 'HS256'
  })
}

/**
 * 生成刷新token
 * @param {Object} payload 用户信息
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(payload) {
  const tokenPayload = {
    userId: payload.userId,
    orgId: payload.orgId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    // 添加随机值防止token重放
    nonce: crypto.randomBytes(16).toString('hex')
  }
  
  return jwt.sign(tokenPayload, JWT_CONFIG.SECRET, {
    expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRES,
    issuer: JWT_CONFIG.ISSUER,
    audience: JWT_CONFIG.AUDIENCE,
    algorithm: 'HS256'
  })
}

/**
 * 验证token
 * @param {string} token JWT token
 * @param {string} expectedType token类型 ('access' | 'refresh')
 * @returns {Object} 验证结果
 */
function verifyToken(token, expectedType = 'access') {
  try {
    if (!token) {
      throw new Error('Token不能为空')
    }

    // 移除Bearer前缀
    if (token.startsWith('Bearer ')) {
      token = token.substring(7)
    }

    // 验证JWT
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET, {
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
      algorithms: ['HS256']
    })

    // 验证token类型
    if (decoded.type !== expectedType) {
      throw new Error(`Token类型不匹配，期望: ${expectedType}, 实际: ${decoded.type}`)
    }

    // 检查token是否即将过期（提前5分钟提醒刷新）
    const now = Math.floor(Date.now() / 1000)
    const timeToExpiry = decoded.exp - now
    const shouldRefresh = timeToExpiry < 300 // 5分钟

    return {
      success: true,
      decoded,
      shouldRefresh,
      expiresIn: timeToExpiry
    }
  } catch (error) {
    let errorType = 'INVALID_TOKEN'
    let message = 'Token无效'

    if (error.name === 'TokenExpiredError') {
      errorType = 'TOKEN_EXPIRED'
      message = 'Token已过期'
    } else if (error.name === 'JsonWebTokenError') {
      errorType = 'MALFORMED_TOKEN'
      message = 'Token格式错误'
    } else if (error.name === 'NotBeforeError') {
      errorType = 'TOKEN_NOT_ACTIVE'
      message = 'Token尚未生效'
    }

    return {
      success: false,
      error: errorType,
      message,
      details: error.message
    }
  }
}

/**
 * 刷新访问token
 * @param {string} refreshToken 刷新token
 * @returns {Object} 新的token对
 */
function refreshAccessToken(refreshToken) {
  const verifyResult = verifyToken(refreshToken, 'refresh')
  
  if (!verifyResult.success) {
    return {
      success: false,
      error: 'INVALID_REFRESH_TOKEN',
      message: '刷新token无效或已过期'
    }
  }

  const { decoded } = verifyResult
  
  // 生成新的访问token
  const newAccessToken = generateAccessToken({
    userId: decoded.userId,
    orgId: decoded.orgId,
    username: decoded.username,
    roleId: decoded.roleId,
    isSuperAdmin: decoded.isSuperAdmin
  })

  return {
    success: true,
    accessToken: newAccessToken,
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRES
  }
}

/**
 * 生成完整的token对
 * @param {Object} userInfo 用户信息
 * @returns {Object} token对象
 */
function generateTokenPair(userInfo) {
  const payload = {
    userId: userInfo.userId,
    username: userInfo.username,
    orgId: userInfo.orgId,
    orgCode: userInfo.orgCode,
    roleId: userInfo.roleId,
    isSuperAdmin: userInfo.isSuperAdmin || false
  }

  const accessToken = generateAccessToken(payload)
  const refreshToken = generateRefreshToken(payload)

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRES,
    refreshExpiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRES
  }
}

/**
 * 解码token（不验证签名，用于获取过期token信息）
 * @param {string} token JWT token
 * @returns {Object} 解码结果
 */
function decodeToken(token) {
  try {
    if (token.startsWith('Bearer ')) {
      token = token.substring(7)
    }
    return jwt.decode(token)
  } catch (error) {
    return null
  }
}

module.exports = {
  JWT_CONFIG,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  refreshAccessToken,
  generateTokenPair,
  decodeToken
}