/**
 * 认证和组织验证工具
 * 确保数据安全和组织隔离
 */

/**
 * 检查用户登录状态和组织信息
 * @returns {Object} { isValid: boolean, token: string, orgId: string, error: string }
 */
function checkAuthStatus() {
  const token = wx.getStorageSync('token');
  const orgId = wx.getStorageSync('orgId');
  
  if (!token) {
    return {
      isValid: false,
      token: '',
      orgId: '',
      error: '登录已过期，请重新登录'
    };
  }
  
  if (!orgId) {
    return {
      isValid: false,
      token: token,
      orgId: '',
      error: '组织信息缺失，请重新登录'
    };
  }
  
  return {
    isValid: true,
    token: token,
    orgId: orgId,
    error: ''
  };
}

/**
 * 强制用户重新登录
 * @param {string} message 提示信息
 */
function forceRelogin(message = '请重新登录') {
  wx.showModal({
    title: '登录提示',
    content: message,
    showCancel: false,
    success: () => {
      wx.clearStorageSync();
      wx.reLaunch({ url: '/pages/login/login' });
    }
  });
}

/**
 * 验证并获取组织ID，如果无效则强制重新登录
 * @returns {string|null} 返回有效的orgId或null
 */
function validateAndGetOrgId() {
  const authStatus = checkAuthStatus();
  
  if (!authStatus.isValid) {
    forceRelogin(authStatus.error);
    return null;
  }
  
  return authStatus.orgId;
}

/**
 * 验证API请求参数，确保包含必要的组织信息
 * @param {Object} data API请求参数
 * @returns {Object} 验证后的参数对象
 */
function validateApiParams(data = {}) {
  const authStatus = checkAuthStatus();
  
  if (!authStatus.isValid) {
    throw new Error(authStatus.error);
  }
  
  // 确保请求参数包含组织ID
  return {
    ...data,
    orgId: authStatus.orgId
  };
}

/**
 * 页面级别的认证检查装饰器
 * 在页面onLoad时调用，确保用户已登录且有有效组织信息
 */
function requireAuth() {
  const authStatus = checkAuthStatus();
  
  if (!authStatus.isValid) {
    forceRelogin(authStatus.error);
    return false;
  }
  
  return true;
}

/**
 * 检查token是否即将过期（可选功能）
 * @returns {boolean} 是否需要刷新token
 */
function shouldRefreshToken() {
  // 这里可以添加token过期时间检查逻辑
  // 目前返回false，表示不需要刷新
  return false;
}

module.exports = {
  checkAuthStatus,
  forceRelogin,
  validateAndGetOrgId,
  validateApiParams,
  requireAuth,
  shouldRefreshToken
}; 