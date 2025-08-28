/**
 * 云收发小程序网络请求工具
 * 提供统一的API调用、错误处理、重试机制、组织数据隔离和单点登录支持
 * 
 * @author 云收发技术团队
 * @version 3.1.0
 * @since 2024-12-19
 */

// 错误类型常量定义
const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',           // 网络错误
  AUTH_ERROR: 'AUTH_ERROR',                 // 认证错误  
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',           // Token过期（单点登录）
  PERMISSION_ERROR: 'PERMISSION_ERROR',     // 权限错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',     // 数据验证错误
  SERVER_ERROR: 'SERVER_ERROR',             // 服务器错误
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',     // 频率限制错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'            // 未知错误
};

// HTTP状态码映射
const HTTP_STATUS_MAP = {
  400: ERROR_TYPES.VALIDATION_ERROR,
  401: ERROR_TYPES.AUTH_ERROR,
  403: ERROR_TYPES.PERMISSION_ERROR,
  429: ERROR_TYPES.RATE_LIMIT_ERROR,
  500: ERROR_TYPES.SERVER_ERROR,
  502: ERROR_TYPES.SERVER_ERROR,
  503: ERROR_TYPES.SERVER_ERROR,
  504: ERROR_TYPES.SERVER_ERROR
};

// 需要重试的错误类型
const RETRYABLE_ERRORS = [
  ERROR_TYPES.NETWORK_ERROR,
  ERROR_TYPES.SERVER_ERROR
];

// 需要重试的HTTP状态码
const RETRYABLE_STATUS_CODES = [500, 502, 503, 504];

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
    return RETRYABLE_ERRORS.includes(this.type) || 
           (this.statusCode && RETRYABLE_STATUS_CODES.includes(this.statusCode));
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

  return request({
    url: '/api/auth/verify-token',
    method: 'GET'
  }).catch((error) => {
    if (error && error.type === ERROR_TYPES.TOKEN_EXPIRED) {
      // token已在其他地方登录，不需要额外处理，handleTokenExpired已经被调用
      throw error;
    }
    // 其他错误也抛出
    throw error;
  });
}

const request = (options) => {
  const { url, method = 'GET', data = {}, header = {}, retryCount = 0, maxRetries = 2 } = options
  
  // 获取app实例，如果失败则使用默认API基础URL
  let apiBaseUrl = 'https://aiyunsf.com/api';
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.apiBaseUrl) {
      apiBaseUrl = app.globalData.apiBaseUrl;
    }
  } catch (e) {
    console.error('获取app实例失败，使用默认API基础URL:', e);
  }

  // 修复URL重复问题
  let finalUrl = '';
  if (url.startsWith('/api/')) {
    // 如果url已经以/api/开头，则去掉apiBaseUrl中的/api部分
    finalUrl = `${apiBaseUrl.replace(/\/api$/, '')}${url}`;
  } else if (url.startsWith('/')) {
    // 如果url以/开头但不是/api/，则直接拼接
    finalUrl = `${apiBaseUrl}${url}`;
  } else {
    // 如果url不以/开头，则添加/再拼接
    finalUrl = `${apiBaseUrl}/${url}`;
  }
  
  // 处理请求数据，添加组织ID
  let requestData = { ...data };
  
  // 获取存储的组织ID
  const storedOrgId = wx.getStorageSync('orgId');
  
  // 如果请求没有携带组织ID，且本地有存储的组织ID，则添加到请求中
  // 注意数据库中可能同时有org_id和orgId两个字段
  if (!requestData.orgId && !requestData.org_id && storedOrgId) {
    // 默认使用orgId，这是后端API期望的格式
    requestData.orgId = storedOrgId;
  }
  
  return new Promise((resolve, reject) => {
    // 添加请求取消标记，用于防止重复请求
    let isCancelled = false;
    
    // 实际发送请求的函数
    const makeRequest = () => {
      if (isCancelled) return;
      
      // 修正：请求header日志应在header对象定义后、wx.request调用前
      const token = wx.getStorageSync('token');
      const requestHeader = {
        'content-type': 'application/json',
        'token': token,
        'Authorization': 'Bearer ' + token,
        'x-from-miniprogram': 'true',
        ...header
      };
      wx.request({
        url: finalUrl,
        method,
        data: requestData,
        header: requestHeader,
        success(res) {
          if (res.statusCode === 429) {
            wx.showToast({
              title: '操作频繁，福生无量，稍后再试',
              icon: 'none'
            });
            return; // 阻止后续处理，防止报错
          }
          if (res.statusCode === 200) {
            // 修改判断条件，允许各种格式的成功响应
            const data = res.data;
            
            // 检查是否有明确的成功/失败标志
            const isExplicitSuccess = 
              data && (
                data.success === true || 
                data.code === 0 || 
                data.code === 200
              );
              
            // 检查是否为数据数组或对象，且没有明确的失败标志
            const isImplicitSuccess = 
              data && (
                Array.isArray(data) || 
                (typeof data === 'object' && 
                 data.success !== false && 
                 data.code !== -1 && 
                 !data.error)
              );
              
            if (isExplicitSuccess || isImplicitSuccess) {
              // 处理可能的数据格式差异
              let resultData = data;
              
              // 如果数据在data字段中，提取出来
              if (!Array.isArray(data) && data.data) {
                // 确保resultData包含success和message字段
                resultData = {
                  success: data.success !== undefined ? data.success : true,
                  ...data
                };
              } 
              // 如果是简单数组，包装一下
              else if (Array.isArray(data)) {
                resultData = {
                  success: true,
                  data: data
                };
              }
              // 其他对象格式，确保包含success字段
              else if (typeof data === 'object' && data.success === undefined) {
                resultData = {
                  success: true,
                  ...data
                };
              }
              
              resolve(resultData);
            } else {
              // 业务错误处理
              
              // 检查是否为单点登录相关错误
              if (data && (data.error === 'token_expired' || data.error === 'token_invalid')) {
                console.log('检测到单点登录：账号在其他地方登录');
                handleTokenExpired(data.message || '您的账号在其他地方登录，当前登录已失效');
                reject(new RequestError(ERROR_TYPES.TOKEN_EXPIRED, data.message || '账号在其他地方登录'));
                return;
              }
              
              // 判断是否需要重试
              if (retryCount < maxRetries) {
                setTimeout(() => {
                  options.retryCount = retryCount + 1;
                  makeRequest();
                }, 1000); // 1秒后重试
                return;
              }
              
              reject(res.data);
            }
          } else if (res.statusCode === 401) {
            // 未授权，可能是token过期或单点登录
            
            // 检查是否为单点登录错误
            const data = res.data || {};
            if (data.error === 'token_expired' || data.error === 'token_invalid') {
              console.log('检测到单点登录：账号在其他地方登录');
              handleTokenExpired(data.message || '您的账号在其他地方登录，当前登录已失效');
              reject(new RequestError(ERROR_TYPES.TOKEN_EXPIRED, data.message || '账号在其他地方登录', 401));
            } else {
              // 普通的认证错误，清除token并跳转登录页
              wx.removeStorageSync('token');
              
              // 如果已经在登录页，避免循环跳转
              const pages = getCurrentPages();
              const currentPage = pages[pages.length - 1];
              if (currentPage && currentPage.route !== 'pages/login/login') {
                wx.navigateTo({
                  url: '/pages/login/login'
                });
              }
              
              reject(new RequestError(ERROR_TYPES.AUTH_ERROR, '登录已过期，请重新登录', 401));
            }
          } else {
            // 其他http错误
            
            // 检查是否为服务器错误
            if (res.statusCode >= 500) {
              console.warn(`服务器错误 ${res.statusCode}:`, finalUrl);
              // 对于token验证接口的服务器错误，特殊处理
              if (finalUrl.includes('/auth/verify-token')) {
                console.warn('Token验证接口服务器错误，可能是数据库未迁移');
                reject(new RequestError(ERROR_TYPES.SERVER_ERROR, '服务器错误：Token验证暂时不可用', res.statusCode));
                return;
              }
            }
            
            // 判断是否需要重试
            if (retryCount < maxRetries && [500, 502, 503, 504].includes(res.statusCode)) {
              setTimeout(() => {
                options.retryCount = retryCount + 1;
                makeRequest();
              }, 1000); // 1秒后重试
              return;
            }
            
            reject(new RequestError(ERROR_TYPES.SERVER_ERROR, (res.data && res.data.error) || (res.data && res.data.message) || `请求失败(${res.statusCode})`, res.statusCode));
          }
        },
        fail(err) {
          console.error(`请求失败: ${method} ${finalUrl}`, err);
          
          // 判断是否需要重试
          if (retryCount < maxRetries) {
            setTimeout(() => {
              options.retryCount = retryCount + 1;
              makeRequest();
            }, 1000); // 1秒后重试
            return;
          }
          
          reject({
            error: '网络异常，请检查网络连接',
            detail: err
          });
        }
      });
    };
    
    // 执行请求
    makeRequest();
    
    // 返回取消请求的方法
    return () => {
      isCancelled = true;
    };
  });
}

// 导出request方法和便捷的get、post方法
const requestModule = {
  request: request,
  get: (url, data = {}, header = {}) => {
    return request({ url, method: 'GET', data, header });
  },
  post: (url, data = {}, header = {}) => {
    return request({ url, method: 'POST', data, header });
  },
  put: (url, data = {}, header = {}) => {
    return request({ url, method: 'PUT', data, header });
  },
  delete: (url, data = {}, header = {}) => {
    return request({ url, method: 'DELETE', data, header });
  },
  patch: (url, data = {}, header = {}) => {
    return request({ url, method: 'PATCH', data, header });
  },
  // 单点登录token验证
  verifyToken: verifyToken,
  // 错误类型常量
  ERROR_TYPES: ERROR_TYPES
};

module.exports = requestModule; 