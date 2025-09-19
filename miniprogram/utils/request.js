/**
 * 云收发小程序网络请求工具
 * 提供统一的API调用、错误处理、组织数据隔离和单点登录支持
 * 仅支持云函数调用模式
 * 
 * @author 云收发技术团队
 * @version 3.3.0
 * @since 2024-12-19
 */

// 引入云函数请求工具
const cloudRequest = require('./cloudRequest');

// 错误类型常量定义
const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',           // 网络错误
  AUTH_ERROR: 'AUTH_ERROR',                 // 认证错误  
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',           // Token过期（单点登录）
  PERMISSION_ERROR: 'PERMISSION_ERROR',     // 权限错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',     // 数据验证错误
  SERVER_ERROR: 'SERVER_ERROR',             // 服务器错误
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',     // 频率限制错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',           // 未知错误
  // 新增错误类型
  INVALID_TOKEN: 'INVALID_TOKEN',           // 无效Token
  FORBIDDEN: 'FORBIDDEN',                   // 禁止访问
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND', // 资源未找到
  INVALID_PARAMS: 'INVALID_PARAMS',         // 无效参数
  DATABASE_ERROR: 'DATABASE_ERROR',         // 数据库错误
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'            // 超时错误
};

// HTTP状态码映射
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
};

// 需要重试的错误类型
const RETRYABLE_ERRORS = [
  ERROR_TYPES.NETWORK_ERROR,
  ERROR_TYPES.SERVER_ERROR
];

// 保存 base64 到临时文件
function saveBase64ToTempFile(base64, fileName, contentType) {
  return new Promise((resolve, reject) => {
    try {
      const fs = wx.getFileSystemManager();
      const ext = inferExtensionFromContentType(contentType);
      const safeName = (fileName || `download-${Date.now()}${ext}`).replace(/[^\w\-\.\u4e00-\u9fa5]/g, '_');
      const filePath = `${wx.env.USER_DATA_PATH}/${safeName}`;
      fs.writeFile({
        filePath,
        data: base64,
        encoding: 'base64',
        success: () => resolve({ filePath, fileName: safeName, contentType }),
        fail: (err) => reject(err)
      });
    } catch (e) {
      reject(e);
    }
  });
}

// 从 Content-Disposition 解析文件名
function parseFilenameFromContentDisposition(cd) {
  if (!cd) return '';
  try {
    // 先处理 filename*=UTF-8'' 形式
    const starMatch = /filename\*=([^;]+)/i.exec(cd);
    if (starMatch && starMatch[1]) {
      const v = starMatch[1].trim();
      const parts = v.split("''");
      if (parts.length === 2) {
        return decodeURIComponent(parts[1].replace(/\"/g, ''));
      }
    }
    // 回退到 filename="..."
    const fnMatch = /filename\s*=\s*"?([^";]+)"?/i.exec(cd);
    if (fnMatch && fnMatch[1]) {
      return fnMatch[1].trim();
    }
  } catch (_) {}
  return '';
}

// 从 Content-Type 推断扩展名
function inferExtensionFromContentType(ct) {
  const map = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'application/pdf': '.pdf',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'text/plain': '.txt',
    'application/zip': '.zip'
  };
  if (!ct) return '.bin';
  const lower = String(ct).toLowerCase().split(';')[0].trim();
  return map[lower] || '.bin';
}

// 工具函数集合
const utils = {
  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  },
  
  // 生成唯一ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
  
  // 生成请求ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },
  
  // 深拷贝
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepClone(item));
    if (typeof obj === 'object') {
      const clonedObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj;
    }
  },
  
  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  // 参数验证
  validateParams(params, rules) {
    const errors = [];
    
    for (const [key, rule] of Object.entries(rules)) {
      const value = params[key];
      
      // 必填验证
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} 是必填字段`);
        continue;
      }
      
      // 如果值为空且非必填，跳过其他验证
      if (value === undefined || value === null || value === '') {
        continue;
      }
      
      // 类型验证
      if (rule.type && typeof value !== rule.type) {
        errors.push(`${key} 类型错误，期望 ${rule.type}，实际 ${typeof value}`);
      }
      
      // 长度验证
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${key} 长度不能少于 ${rule.minLength}`);
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${key} 长度不能超过 ${rule.maxLength}`);
      }
      
      // 数值范围验证
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${key} 不能小于 ${rule.min}`);
      }
      
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${key} 不能大于 ${rule.max}`);
      }
      
      // 正则验证
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${key} 格式不正确`);
      }
    }
    
    return errors;
  },
  
  // 安全的JSON解析
  safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      console.warn('JSON解析失败:', error);
      return defaultValue;
    }
  },
  
  // 安全的JSON字符串化
  safeJsonStringify(obj, defaultValue = '{}') {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.warn('JSON字符串化失败:', error);
      return defaultValue;
    }
  }
};

/**
 * 统一错误处理类
 * 提供错误分类、错误信息格式化和用户友好提示
 */
class RequestError extends Error {
  constructor(type, message, statusCode = null, originalError = null) {
    super(message);
    this.name = 'RequestError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  /**
   * 获取用户友好的错误提示
   * @returns {string} 用户友好的错误信息
   */
  getUserMessage() {
    switch (this.type) {
      case ERROR_TYPES.NETWORK_ERROR:
        return '网络连接异常，请检查网络后重试';
      case ERROR_TYPES.AUTH_ERROR:
        return '登录已过期，请重新登录';
      case ERROR_TYPES.TOKEN_EXPIRED:
        return '您的账号在其他地方登录，当前登录已失效';
      case ERROR_TYPES.PERMISSION_ERROR:
        return '权限不足，请联系管理员';
      case ERROR_TYPES.VALIDATION_ERROR:
        return this.message || '请求参数有误，请检查后重试';
      case ERROR_TYPES.RATE_LIMIT_ERROR:
        return '操作过于频繁，请稍后再试';
      case ERROR_TYPES.SERVER_ERROR:
        return '服务器暂时无法响应，请稍后重试';
      default:
        return '操作失败，请重试';
    }
  }

  /**
   * 判断错误是否可以重试
   * @returns {boolean} 是否可以重试
   */
  isRetryable() {
    // 网络错误、超时错误、服务器错误可以重试
    const retryableTypes = [
      ERROR_TYPES.NETWORK_ERROR,
      ERROR_TYPES.TIMEOUT_ERROR,
      ERROR_TYPES.SERVER_ERROR
    ];
    
    // 5xx状态码可以重试
    const retryableStatusCodes = this.statusCode >= 500 && this.statusCode < 600;
    
    return retryableTypes.includes(this.type) || retryableStatusCodes;
  }
}

/**
 * 处理token过期（单点登录）
 * 当检测到账号在其他地方登录时，执行自动下线处理
 * @param {string} message 提示消息
 */
function handleTokenExpired(message) {
  // 清除所有本地存储的用户数据
  wx.clearStorageSync();
  
  // 显示单点登录提示
  wx.showModal({
    title: '账号下线',
    content: message,
    showCancel: false,
    confirmText: '重新登录',
    success: () => {
      // 跳转到登录页面
      wx.reLaunch({
        url: '/pages/login/login'
      });
    }
  });
}

/**
 * 验证当前token是否有效（单点登录检测）
 * @returns {Promise} 验证结果
 */
function verifyToken() {
  const token = wx.getStorageSync('token');
  if (!token) {
    return Promise.reject(new RequestError(ERROR_TYPES.AUTH_ERROR, '未登录'));
  }

  // 优先使用云函数进行token验证
  return cloudRequest.verifyToken().catch((error) => {
    if (error && error.type === ERROR_TYPES.TOKEN_EXPIRED) {
      // token已在其他地方登录，不需要额外处理，handleTokenExpired已经被调用
      throw error;
    }
    // 其他错误也抛出
    throw error;
  });
}

/**
 * 核心请求方法
 * @param {Object} options 请求配置
 * @returns {Promise} 请求结果
 */
const request = async (options = {}) => {
  const requestId = utils.generateRequestId();
  
  const config = {
    timeout: 10000,
    retryCount: 3,
    retryDelay: 1000,
    showLoading: true,
    loadingText: '请求中...',
    validateParams: true,
    ...options,
    requestId
  };

  const { url, method = 'GET', data = {} } = config;

  // 参数验证
  if (config.validateParams && config.paramRules) {
    const validationErrors = utils.validateParams(data, config.paramRules);
    if (validationErrors.length > 0) {
      throw new RequestError(
        ERROR_TYPES.VALIDATION_ERROR,
        `参数验证失败: ${validationErrors.join(', ')}`,
        HTTP_STATUS.BAD_REQUEST,
        { validationErrors, requestId }
      );
    }
  }

  // 显示加载提示
  if (config.showLoading) {
    wx.showLoading({
      title: config.loadingText,
      mask: true
    });
  }

  let lastError = null;
  const startTime = Date.now();
  
  console.log(`[${requestId}] 开始请求:`, {
    url,
    method,
    data,
    timestamp: new Date().toISOString()
  });
  
  // 重试机制
  for (let attempt = 0; attempt <= config.retryCount; attempt++) {
    try {
      const attemptStartTime = Date.now();
      
      if (attempt > 0) {
        console.log(`[${requestId}] 第${attempt}次重试`);
      }
      
      // 只使用云函数调用，不再回退到HTTP
      console.log('[请求模式] 使用云函数调用:', url);
      const result = await cloudRequest.apiCall(url, data, method);
      
      const duration = Date.now() - startTime;
      
      console.log(`[${requestId}] 请求成功:`, {
        duration: `${duration}ms`,
        attempt: attempt + 1
      });
      
      // 隐藏加载提示
      if (config.showLoading) {
        wx.hideLoading();
      }
      
      // 对云函数结果进行统一处理
      const responseData = result;

      // 二进制/下载响应：由云函数代理以 { data: { __binary, base64, contentType, contentDisposition }, headers } 返回
      if (responseData && responseData.data && responseData.data.__binary === true) {
        try {
          const fileName = parseFilenameFromContentDisposition((responseData.headers && responseData.headers['content-disposition']) || (responseData.data && responseData.data.contentDisposition));
          const contentType = (responseData.data && responseData.data.contentType) || (responseData.headers && responseData.headers['content-type']);
          const saved = await saveBase64ToTempFile(responseData.data.base64, fileName, contentType);
          return { success: true, filePath: saved.filePath, fileName: saved.fileName, contentType: saved.contentType, headers: responseData.headers };
        } catch (e) {
          throw new RequestError(ERROR_TYPES.UNKNOWN_ERROR, '保存文件失败', 500, e);
        }
      }

      // 显式失败
      const isExplicitFail = responseData && (responseData.success === false || responseData.code === -1 || responseData.error);

      if (isExplicitFail) {
        // 识别token/会话过期
        const message = (responseData && (responseData.message || responseData.error)) || '请求失败';
        const isTokenExpired = (
          (responseData && (responseData.error === 'token_expired')) ||
          /过期|重新登录|token/i.test(message)
        );

        if (isTokenExpired) {
          handleTokenExpired('您的账号已在其他设备登录，当前登录已失效');
          throw new RequestError(ERROR_TYPES.TOKEN_EXPIRED, message, 401, responseData);
        }

        // 未登录/无权限
        if (/未登录|未提供|无权限|权限不足/i.test(message)) {
          throw new RequestError(ERROR_TYPES.AUTH_ERROR, message, 401, responseData);
        }

        // 其他视为服务器错误或校验错误
        const type = /参数|校验|验证/i.test(message) ? ERROR_TYPES.VALIDATION_ERROR : ERROR_TYPES.SERVER_ERROR;
        throw new RequestError(type, message, 500, responseData);
      }

      // 显式成功或默认成功：尽量保持一致的返回结构
      // 如果是数组，包装为 { success: true, data: [...] }
      if (Array.isArray(responseData)) {
        return { success: true, data: responseData };
      }

      // 如果对象不含success字段，补充success=true
      if (responseData && typeof responseData === 'object' && responseData.success === undefined) {
        return { success: true, ...responseData };
      }

      return responseData;
      
    } catch (error) {
      lastError = error;
      
      const duration = Date.now() - startTime;
      
      console.warn(`[${requestId}] 请求失败 (尝试${attempt + 1}/${config.retryCount + 1}):`, {
        error: error.message,
        duration: `${duration}ms`,
        type: error.type || 'unknown'
      });
      
      // 判断是否应该重试
      const shouldRetry = attempt < config.retryCount && 
        error instanceof RequestError && 
        error.isRetryable();
      
      if (shouldRetry) {
        const retryDelay = config.retryDelay * (attempt + 1);
        console.log(`[${requestId}] ${retryDelay}ms后重试`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // 不重试的情况直接跳出循环
      break;
    }
  }
  
  // 隐藏加载提示
  if (config.showLoading) {
    wx.hideLoading();
  }
  
  const totalDuration = Date.now() - startTime;
  
  console.error(`[${requestId}] 请求最终失败:`, {
    error: lastError.message,
    totalDuration: `${totalDuration}ms`,
    totalAttempts: config.retryCount + 1
  });
  
  // 所有重试都失败，抛出最后一个错误
  throw lastError;
};

// 导出request方法和便捷的get、post方法
const requestModule = {
  request: request,
  get: (url, data = {}, options = {}) => {
    return request({ url, method: 'GET', data, ...options });
  },
  post: (url, data = {}, options = {}) => {
    return request({ url, method: 'POST', data, ...options });
  },
  put: (url, data = {}, options = {}) => {
    return request({ url, method: 'PUT', data, ...options });
  },
  delete: (url, data = {}, options = {}) => {
    return request({ url, method: 'DELETE', data, ...options });
  },
  patch: (url, data = {}, options = {}) => {
    return request({ url, method: 'PATCH', data, ...options });
  },
  verifyToken: verifyToken,
  ERROR_TYPES: ERROR_TYPES,
  HTTP_STATUS: HTTP_STATUS,
  utils: utils,
  RequestError: RequestError
};

module.exports = requestModule;