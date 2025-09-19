/**
 * 数据加密工具
 * 用于敏感数据的加密存储和解密
 */

const crypto = require('crypto')
const bcrypt = require('bcryptjs')

// 加密配置
const ENCRYPTION_CONFIG = {
  // AES加密算法
  ALGORITHM: 'aes-256-gcm',
  // 密钥长度
  KEY_LENGTH: 32,
  // IV长度
  IV_LENGTH: 16,
  // 标签长度
  TAG_LENGTH: 16,
  // 盐长度
  SALT_LENGTH: 16,
  // bcrypt轮数
  BCRYPT_ROUNDS: 12
}

// 主加密密钥（应从环境变量获取）
const MASTER_KEY = process.env.ENCRYPTION_KEY || generateMasterKey()

/**
 * 生成主密钥
 * @returns {string} 主密钥
 */
function generateMasterKey() {
  console.warn('警告: 使用默认生成的加密密钥，生产环境请设置 ENCRYPTION_KEY 环境变量')
  return crypto.randomBytes(ENCRYPTION_CONFIG.KEY_LENGTH).toString('hex')
}

/**
 * 从主密钥派生加密密钥
 * @param {string} salt 盐值
 * @returns {Buffer} 派生密钥
 */
function deriveKey(salt) {
  return crypto.pbkdf2Sync(
    MASTER_KEY,
    salt,
    100000, // 迭代次数
    ENCRYPTION_CONFIG.KEY_LENGTH,
    'sha256'
  )
}

/**
 * 生成随机盐值
 * @returns {Buffer} 盐值
 */
function generateSalt() {
  return crypto.randomBytes(ENCRYPTION_CONFIG.SALT_LENGTH)
}

/**
 * 生成随机IV
 * @returns {Buffer} IV
 */
function generateIV() {
  return crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH)
}

/**
 * AES-GCM加密
 * @param {string} plaintext 明文
 * @param {string} additionalData 附加数据（可选）
 * @returns {Object} 加密结果
 */
function encryptAES(plaintext, additionalData = '') {
  try {
    if (!plaintext) {
      throw new Error('明文不能为空')
    }

    const salt = generateSalt()
    const iv = generateIV()
    const key = deriveKey(salt)
    
    const cipher = crypto.createCipher(ENCRYPTION_CONFIG.ALGORITHM, key)
    cipher.setAAD(Buffer.from(additionalData, 'utf8'))
    
    let encrypted = cipher.update(plaintext, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    const tag = cipher.getAuthTag()
    
    // 组合所有组件
    const result = Buffer.concat([
      salt,
      iv,
      tag,
      encrypted
    ])
    
    return {
      success: true,
      encrypted: result.toString('base64'),
      algorithm: ENCRYPTION_CONFIG.ALGORITHM
    }
  } catch (error) {
    console.error('AES加密失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * AES-GCM解密
 * @param {string} encryptedData 加密数据（base64）
 * @param {string} additionalData 附加数据（可选）
 * @returns {Object} 解密结果
 */
function decryptAES(encryptedData, additionalData = '') {
  try {
    if (!encryptedData) {
      throw new Error('加密数据不能为空')
    }

    const data = Buffer.from(encryptedData, 'base64')
    
    // 提取组件
    const salt = data.slice(0, ENCRYPTION_CONFIG.SALT_LENGTH)
    const iv = data.slice(
      ENCRYPTION_CONFIG.SALT_LENGTH,
      ENCRYPTION_CONFIG.SALT_LENGTH + ENCRYPTION_CONFIG.IV_LENGTH
    )
    const tag = data.slice(
      ENCRYPTION_CONFIG.SALT_LENGTH + ENCRYPTION_CONFIG.IV_LENGTH,
      ENCRYPTION_CONFIG.SALT_LENGTH + ENCRYPTION_CONFIG.IV_LENGTH + ENCRYPTION_CONFIG.TAG_LENGTH
    )
    const encrypted = data.slice(
      ENCRYPTION_CONFIG.SALT_LENGTH + ENCRYPTION_CONFIG.IV_LENGTH + ENCRYPTION_CONFIG.TAG_LENGTH
    )
    
    const key = deriveKey(salt)
    
    const decipher = crypto.createDecipher(ENCRYPTION_CONFIG.ALGORITHM, key)
    decipher.setAuthTag(tag)
    decipher.setAAD(Buffer.from(additionalData, 'utf8'))
    
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return {
      success: true,
      decrypted: decrypted.toString('utf8')
    }
  } catch (error) {
    console.error('AES解密失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 密码哈希（使用bcrypt）
 * @param {string} password 明文密码
 * @returns {Promise<Object>} 哈希结果
 */
async function hashPassword(password) {
  try {
    if (!password) {
      throw new Error('密码不能为空')
    }

    if (password.length < 6) {
      throw new Error('密码长度不能少于6位')
    }

    const hash = await bcrypt.hash(password, ENCRYPTION_CONFIG.BCRYPT_ROUNDS)
    
    return {
      success: true,
      hash
    }
  } catch (error) {
    console.error('密码哈希失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 验证密码
 * @param {string} password 明文密码
 * @param {string} hash 哈希值
 * @returns {Promise<Object>} 验证结果
 */
async function verifyPassword(password, hash) {
  try {
    if (!password || !hash) {
      throw new Error('密码和哈希值不能为空')
    }

    const isValid = await bcrypt.compare(password, hash)
    
    return {
      success: true,
      isValid
    }
  } catch (error) {
    console.error('密码验证失败:', error)
    return {
      success: false,
      error: error.message,
      isValid: false
    }
  }
}

/**
 * 生成安全的随机密码
 * @param {number} length 密码长度
 * @param {Object} options 选项
 * @returns {string} 随机密码
 */
function generateSecurePassword(length = 12, options = {}) {
  const {
    includeUppercase = true,
    includeLowercase = true,
    includeNumbers = true,
    includeSymbols = true,
    excludeSimilar = true
  } = options
  
  let charset = ''
  
  if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz'
  if (includeNumbers) charset += '0123456789'
  if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  // 排除相似字符
  if (excludeSimilar) {
    charset = charset.replace(/[0O1lI]/g, '')
  }
  
  if (!charset) {
    throw new Error('字符集不能为空')
  }
  
  let password = ''
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length)
    password += charset[randomIndex]
  }
  
  return password
}

/**
 * 加密敏感字段
 * @param {Object} data 数据对象
 * @param {Array} sensitiveFields 敏感字段列表
 * @returns {Object} 加密后的数据
 */
function encryptSensitiveFields(data, sensitiveFields = []) {
  const result = { ...data }
  
  for (const field of sensitiveFields) {
    if (result[field] && typeof result[field] === 'string') {
      const encrypted = encryptAES(result[field], field)
      if (encrypted.success) {
        result[field] = encrypted.encrypted
        result[`${field}_encrypted`] = true
      }
    }
  }
  
  return result
}

/**
 * 解密敏感字段
 * @param {Object} data 数据对象
 * @param {Array} sensitiveFields 敏感字段列表
 * @returns {Object} 解密后的数据
 */
function decryptSensitiveFields(data, sensitiveFields = []) {
  const result = { ...data }
  
  for (const field of sensitiveFields) {
    if (result[field] && result[`${field}_encrypted`]) {
      const decrypted = decryptAES(result[field], field)
      if (decrypted.success) {
        result[field] = decrypted.decrypted
        delete result[`${field}_encrypted`]
      }
    }
  }
  
  return result
}

/**
 * 生成数据指纹（用于完整性验证）
 * @param {Object} data 数据对象
 * @returns {string} 数据指纹
 */
function generateDataFingerprint(data) {
  const dataString = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('sha256').update(dataString).digest('hex')
}

/**
 * 验证数据指纹
 * @param {Object} data 数据对象
 * @param {string} expectedFingerprint 期望的指纹
 * @returns {boolean} 是否匹配
 */
function verifyDataFingerprint(data, expectedFingerprint) {
  const actualFingerprint = generateDataFingerprint(data)
  return actualFingerprint === expectedFingerprint
}

/**
 * 安全地比较两个字符串（防止时序攻击）
 * @param {string} a 字符串A
 * @param {string} b 字符串B
 * @returns {boolean} 是否相等
 */
function secureCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }
  
  if (a.length !== b.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  
  return result === 0
}

/**
 * 生成HMAC签名
 * @param {string} data 数据
 * @param {string} secret 密钥
 * @returns {string} HMAC签名
 */
function generateHMAC(data, secret = MASTER_KEY) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

/**
 * 验证HMAC签名
 * @param {string} data 数据
 * @param {string} signature 签名
 * @param {string} secret 密钥
 * @returns {boolean} 是否有效
 */
function verifyHMAC(data, signature, secret = MASTER_KEY) {
  const expectedSignature = generateHMAC(data, secret)
  return secureCompare(signature, expectedSignature)
}

module.exports = {
  // AES加密/解密
  encryptAES,
  decryptAES,
  
  // 密码处理
  hashPassword,
  verifyPassword,
  generateSecurePassword,
  
  // 敏感字段处理
  encryptSensitiveFields,
  decryptSensitiveFields,
  
  // 数据完整性
  generateDataFingerprint,
  verifyDataFingerprint,
  
  // 安全工具
  secureCompare,
  generateHMAC,
  verifyHMAC,
  
  // 配置
  ENCRYPTION_CONFIG
}