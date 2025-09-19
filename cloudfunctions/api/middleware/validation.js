/**
 * 统一输入验证中间件
 * 防止SQL注入、XSS攻击和参数验证
 */

const validator = require('validator')

// 危险字符模式
const DANGEROUS_PATTERNS = [
  // SQL注入模式
  /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
  /(union|select|insert|delete|update|drop|create|alter|exec|execute)/i,
  // XSS模式
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi
]

// 字段验证规则
const VALIDATION_RULES = {
  // 用户相关
  username: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
    message: '用户名只能包含字母、数字、下划线和中文，长度2-50字符'
  },
  password: {
    required: true,
    type: 'string',
    minLength: 6,
    maxLength: 128,
    message: '密码长度必须在6-128字符之间'
  },
  email: {
    required: false,
    type: 'email',
    message: '邮箱格式不正确'
  },
  phone: {
    required: false,
    type: 'string',
    pattern: /^1[3-9]\d{9}$/,
    message: '手机号格式不正确'
  },
  realName: {
    required: false,
    type: 'string',
    maxLength: 50,
    pattern: /^[\u4e00-\u9fa5a-zA-Z\s]+$/,
    message: '真实姓名只能包含中文、英文和空格，最长50字符'
  },
  
  // 组织相关
  orgCode: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: '组织编码只能包含字母、数字、下划线和连字符，长度2-20字符'
  },
  orgName: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
    message: '组织名称长度必须在2-100字符之间'
  },
  
  // 通用字段
  id: {
    required: true,
    type: 'string',
    pattern: /^[a-zA-Z0-9_-]+$/,
    message: 'ID格式不正确'
  },
  status: {
    required: false,
    type: 'string',
    enum: ['active', 'inactive', 'pending', 'disabled'],
    message: '状态值不正确'
  },
  pageSize: {
    required: false,
    type: 'number',
    min: 1,
    max: 100,
    message: '每页数量必须在1-100之间'
  },
  pageNum: {
    required: false,
    type: 'number',
    min: 1,
    message: '页码必须大于0'
  }
}

/**
 * 检测危险字符
 * @param {string} input 输入字符串
 * @returns {boolean} 是否包含危险字符
 */
function containsDangerousPattern(input) {
  if (typeof input !== 'string') {
    try {
      input = input?.toString() || ''
    } catch (error) {
      return false
    }
  }
  
  if (!input) return false
  
  try {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(input))
  } catch (error) {
    console.warn('危险字符检测失败:', error)
    return false
  }
}

/**
 * 清理输入字符串
 * @param {string} input 输入字符串
 * @returns {string} 清理后的字符串
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    try {
      input = input?.toString() || ''
    } catch (error) {
      return input
    }
  }
  
  if (!input) return input
  
  try {
    // 移除危险字符
    let cleaned = input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
    
    // HTML实体编码
    cleaned = cleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
    
    return cleaned.trim()
  } catch (error) {
    console.warn('输入清理失败:', error)
    return input
  }
}

/**
 * 验证单个字段
 * @param {string} fieldName 字段名
 * @param {any} value 字段值
 * @param {Object} rule 验证规则
 * @returns {Object} 验证结果
 */
function validateField(fieldName, value, rule) {
  const result = {
    valid: true,
    message: '',
    sanitizedValue: value
  }
  
  // 检查必填
  if (rule.required && (value === undefined || value === null || value === '')) {
    result.valid = false
    result.message = `${fieldName}不能为空`
    return result
  }
  
  // 如果不是必填且值为空，跳过后续验证
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return result
  }
  
  // 类型验证
  if (rule.type) {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          result.valid = false
          result.message = `${fieldName}必须是字符串类型`
          return result
        }
        // 检测危险字符
        if (containsDangerousPattern(value)) {
          result.valid = false
          result.message = `${fieldName}包含非法字符`
          return result
        }
        // 清理输入
        result.sanitizedValue = sanitizeInput(value)
        break
        
      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          result.valid = false
          result.message = `${fieldName}必须是数字类型`
          return result
        }
        result.sanitizedValue = num
        break
        
      case 'email':
        try {
          if (!validator.isEmail(value.toString())) {
            result.valid = false
            result.message = rule.message || `${fieldName}邮箱格式不正确`
            return result
          }
          result.sanitizedValue = validator.normalizeEmail(value.toString())
        } catch (emailError) {
          result.valid = false
          result.message = rule.message || `${fieldName}邮箱格式不正确`
          return result
        }
        break
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          result.valid = false
          result.message = `${fieldName}必须是布尔类型`
          return result
        }
        break
    }
  }
  
  // 长度验证
  if (rule.minLength && result.sanitizedValue.length < rule.minLength) {
    result.valid = false
    result.message = rule.message || `${fieldName}长度不能少于${rule.minLength}字符`
    return result
  }
  
  if (rule.maxLength && result.sanitizedValue.length > rule.maxLength) {
    result.valid = false
    result.message = rule.message || `${fieldName}长度不能超过${rule.maxLength}字符`
    return result
  }
  
  // 数值范围验证
  if (rule.min !== undefined && result.sanitizedValue < rule.min) {
    result.valid = false
    result.message = rule.message || `${fieldName}不能小于${rule.min}`
    return result
  }
  
  if (rule.max !== undefined && result.sanitizedValue > rule.max) {
    result.valid = false
    result.message = rule.message || `${fieldName}不能大于${rule.max}`
    return result
  }
  
  // 正则验证
  if (rule.pattern && !rule.pattern.test(result.sanitizedValue)) {
    result.valid = false
    result.message = rule.message || `${fieldName}格式不正确`
    return result
  }
  
  // 枚举验证
  if (rule.enum && !rule.enum.includes(result.sanitizedValue)) {
    result.valid = false
    result.message = rule.message || `${fieldName}值不在允许范围内`
    return result
  }
  
  return result
}

/**
 * 验证参数对象
 * @param {Object} params 参数对象
 * @param {Array} requiredFields 必需字段列表
 * @param {Object} customRules 自定义验证规则
 * @returns {Object} 验证结果
 */
function validateParams(params, requiredFields = [], customRules = {}) {
  const result = {
    valid: true,
    errors: [],
    sanitizedParams: {}
  }
  
  // 合并验证规则
  const rules = { ...VALIDATION_RULES, ...customRules }
  
  // 验证必需字段
  for (const field of requiredFields) {
    if (params[field] === undefined || params[field] === null || params[field] === '') {
      result.valid = false
      result.errors.push(`${field}不能为空`)
    }
  }
  
  // 验证所有字段
  for (const [fieldName, value] of Object.entries(params)) {
    const rule = rules[fieldName]
    if (rule) {
      const fieldResult = validateField(fieldName, value, rule)
      if (!fieldResult.valid) {
        result.valid = false
        result.errors.push(fieldResult.message)
      } else {
        result.sanitizedParams[fieldName] = fieldResult.sanitizedValue
      }
    } else {
      // 对于没有规则的字段，进行基本的安全检查
      if (typeof value === 'string') {
        if (containsDangerousPattern(value)) {
          result.valid = false
          result.errors.push(`${fieldName}包含非法字符`)
        } else {
          result.sanitizedParams[fieldName] = sanitizeInput(value)
        }
      } else {
        result.sanitizedParams[fieldName] = value
      }
    }
  }
  
  return result
}

/**
 * 创建验证中间件
 * @param {Array} requiredFields 必需字段
 * @param {Object} customRules 自定义规则
 * @returns {Function} 中间件函数
 */
function createValidationMiddleware(requiredFields = [], customRules = {}) {
  return function validate(params) {
    const validation = validateParams(params, requiredFields, customRules)
    
    if (!validation.valid) {
      throw new Error(`参数验证失败: ${validation.errors.join(', ')}`)
    }
    
    return validation.sanitizedParams
  }
}

/**
 * 预定义的验证中间件
 */
const validators = {
  // 登录验证
  login: createValidationMiddleware(['orgCode', 'username', 'password']),
  
  // 用户创建验证
  createUser: createValidationMiddleware(['username', 'password', 'orgId'], {
    confirmPassword: {
      required: true,
      type: 'string',
      message: '确认密码不能为空'
    }
  }),
  
  // 用户更新验证
  updateUser: createValidationMiddleware(['id']),
  
  // 组织创建验证
  createOrg: createValidationMiddleware(['orgCode', 'orgName']),
  
  // 分页验证
  pagination: createValidationMiddleware([], {
    pageSize: VALIDATION_RULES.pageSize,
    pageNum: VALIDATION_RULES.pageNum
  })
}

module.exports = {
  validateParams,
  validateField,
  createValidationMiddleware,
  sanitizeInput,
  containsDangerousPattern,
  validators,
  VALIDATION_RULES
}