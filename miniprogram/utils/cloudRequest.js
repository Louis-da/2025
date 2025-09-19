/**
 * 云函数请求工具
 * 提供统一的云函数调用、错误处理和数据格式化
 * 
 * @author 云收发技术团队
 * @version 1.2.0
 * @since 2024-12-19
 */

// 错误类型常量定义
const ERROR_TYPES = {
  CLOUD_FUNCTION_ERROR: 'CLOUD_FUNCTION_ERROR',     // 云函数错误
  NETWORK_ERROR: 'NETWORK_ERROR',                   // 网络错误
  AUTH_ERROR: 'AUTH_ERROR',                         // 认证错误
  PERMISSION_ERROR: 'PERMISSION_ERROR',             // 权限错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',             // 数据验证错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',                   // 未知错误
  NOT_SUPPORTED: 'NOT_SUPPORTED'                    // 未覆盖的端点/动作（用于HTTP回退）
};

/**
 * 云函数错误处理类
 */
class CloudFunctionError extends Error {
  constructor(type, message, originalError = null) {
    super(message);
    this.name = 'CloudFunctionError';
    this.type = type;
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
      case ERROR_TYPES.PERMISSION_ERROR:
        return '权限不足，请联系管理员';
      case ERROR_TYPES.VALIDATION_ERROR:
        return this.message || '请求参数有误，请检查后重试';
      case ERROR_TYPES.CLOUD_FUNCTION_ERROR:
        return '服务暂时无法响应，请稍后重试';
      case ERROR_TYPES.NOT_SUPPORTED:
        return '当前功能暂未迁移至云函数，将回退到HTTP接口';
      default:
        return '操作失败，请重试';
    }
  }
}

/**
 * 调用云函数
 * @param {string} functionName 云函数名称
 * @param {Object} data 请求数据
 * @param {Object} options 选项配置
 * @returns {Promise} 返回Promise对象
 */
function callCloudFunction(functionName, data = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const app = getApp();
    
    // 检查app实例和云开发是否初始化
    if (!app || !app.globalData || !app.globalData.cloud) {
      reject(new CloudFunctionError(
        ERROR_TYPES.CLOUD_FUNCTION_ERROR,
        '云开发未初始化'
      ));
      return;
    }

    // 添加组织ID到请求数据
    const orgId = wx.getStorageSync('orgId');
    if (orgId && !data.orgId) {
      data.orgId = orgId;
    }

    // 添加用户token到请求数据（便于云端进行鉴权或代理时注入）
    const token = wx.getStorageSync('token');
    console.log(`[云函数调用前] ${functionName} Token检查:`, {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : '无',
      dataHasToken: !!data.token
    });
    
    if (token && !data.token) {
      data.token = token;
    }

    console.log(`[云函数调用] ${functionName}:`, {
      ...data,
      token: data.token ? data.token.substring(0, 20) + '...' : '无'
    });

    // 调用云函数
    app.globalData.cloud.callFunction({
      name: functionName,
      data: data,
      success: (res) => {
        console.log(`[云函数响应] ${functionName}:`, res);
        
        if (res.result) {
          // 云函数正常执行，直接返回结果（包括业务错误）
          resolve(res.result);
        } else {
          reject(new CloudFunctionError(
            ERROR_TYPES.CLOUD_FUNCTION_ERROR,
            '云函数返回数据格式错误'
          ));
        }
      },
      fail: (err) => {
        console.error(`[云函数错误] ${functionName}:`, err);
        
        let errorType = ERROR_TYPES.CLOUD_FUNCTION_ERROR;
        let errorMessage = '云函数调用失败';
        
        // 根据错误码判断错误类型
        if (err.errCode) {
          switch (err.errCode) {
            case -1:
              errorType = ERROR_TYPES.NETWORK_ERROR;
              errorMessage = '网络连接失败';
              break;
            case -501004:
              errorType = ERROR_TYPES.AUTH_ERROR;
              errorMessage = '云函数权限不足';
              break;
            default:
              errorMessage = err.errMsg || errorMessage;
          }
        }
        
        reject(new CloudFunctionError(errorType, errorMessage, err));
      }
    });
  });
}

/**
 * API调用封装 - 直接调用云函数接口
 * 策略：
 * - 将API路径映射为云函数的action
 * - 统一使用云函数处理所有业务逻辑
 * @param {string} endpoint API端点（如 /api/auth/verify-token）
 * @param {Object} data 请求数据
 * @param {string} method 请求方法
 * @returns {Promise} 返回Promise对象
 */
function apiCall(endpoint, data = {}, method = 'POST') {
  if (!endpoint || typeof endpoint !== 'string') {
    return Promise.reject(new CloudFunctionError(ERROR_TYPES.VALIDATION_ERROR, '无效的API端点'));
  }

  // 规范化端点：补全前导斜杠并移除/api前缀
  let normalized = endpoint.trim();
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // 特殊处理：如果是auth端点，直接调用auth云函数
  if (normalized === '/auth' || normalized === 'auth') {
    return callCloudFunction('auth', {
      action: data.action || 'login',
      data: data
    });
  }
  
  // 移除/api前缀，直接映射为action
  let action = normalized;
  if (action.startsWith('/api/')) {
    action = action.substring(5); // 移除'/api/'
  } else if (action.startsWith('/')) {
    action = action.substring(1); // 移除前导'/'
  }

  // 直接调用云函数，使用action参数
  return callCloudFunction('api', {
    action: action,
    params: data || {},
    method: method
  });
}

/**
 * 便捷方法：GET请求
 */
function get(endpoint, data = {}) {
  return apiCall(endpoint, data, 'GET');
}

/**
 * 便捷方法：POST请求
 */
function post(endpoint, data = {}) {
  return apiCall(endpoint, data, 'POST');
}

/**
 * 便捷方法：PUT请求
 */
function put(endpoint, data = {}) {
  return apiCall(endpoint, data, 'PUT');
}

/**
 * 便捷方法：DELETE请求
 */
function deleteRequest(endpoint, data = {}) {
  return apiCall(endpoint, data, 'DELETE');
}

/**
 * 便捷方法：PATCH请求
 */
function patch(endpoint, data = {}) {
  return apiCall(endpoint, data, 'PATCH');
}

// 导出模块
/**
 * 认证相关的云函数调用方法
 */

// 登录
function login(orgCode, username, password) {
  return callCloudFunction('api', {
    action: 'login',
    orgCode,
    username,
    password
  });
}

// 验证token
function verifyToken(token) {
  return callCloudFunction('api', {
    action: 'verifyToken',
    token: token || wx.getStorageSync('token')
  });
}

// 会话心跳
function sessionHeartbeat(token) {
  return callCloudFunction('api', {
    action: 'sessionHeartbeat',
    token: token || wx.getStorageSync('token')
  });
}

// 登出
function logout(token) {
  return callCloudFunction('api', {
    action: 'logout',
    token: token || wx.getStorageSync('token')
  });
}

const cloudRequestModule = {
  callCloudFunction,
  apiCall,
  get,
  post,
  put,
  delete: deleteRequest,
  patch,
  // 认证相关方法
  login,
  verifyToken,
  sessionHeartbeat,
  logout,
  ERROR_TYPES,
  CloudFunctionError
};

module.exports = cloudRequestModule;