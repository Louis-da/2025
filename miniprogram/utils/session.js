/**
 * 小程序会话管理模块
 * 用于维护用户会话活跃状态，支持在线用户统计
 * 
 * @author 云收发开发团队
 * @version 3.0.0
 * @since 2024-12-19
 */

// 心跳间隔时间（5分钟）
const HEARTBEAT_INTERVAL = 5 * 60 * 1000;

// 心跳定时器
let heartbeatTimer = null;

/**
 * 安全获取请求工具
 * 增加多重检查，确保获取到有效的请求工具
 */
function getRequestTool() {
  try {
    // 首先尝试直接导入request模块
    const requestTool = require('./request');
    if (requestTool && typeof requestTool.post === 'function') {
      return requestTool;
    }
  } catch (error) {
    console.warn('[Session] 直接导入request模块失败:', error);
  }
  
  try {
    // 尝试通过app获取request工具
    const app = getApp();
    if (app && typeof app.getRequest === 'function') {
      const request = app.getRequest();
      if (request && typeof request.post === 'function') {
        return request;
      }
    }
  } catch (error) {
    console.warn('[Session] 通过app获取request失败:', error);
  }
  
  try {
    // 尝试从app全局数据获取
    const app = getApp();
    if (app && app.globalData && app.globalData.request) {
      const request = app.globalData.request;
      if (request && typeof request.post === 'function') {
        return request;
      }
    }
  } catch (error) {
    console.warn('[Session] 从globalData获取request失败:', error);
  }
  
  console.error('[Session] 无法获取有效的请求工具');
  return null;
}

/**
 * 更新会话活跃时间
 * 静默执行，不影响用户体验
 */
function updateSessionActivity() {
  const token = wx.getStorageSync('token');
  if (!token) {
    console.log('[Session] 用户未登录，跳过心跳');
    return;
  }

  const request = getRequestTool();
  if (!request) {
    console.warn('[Session] 请求工具不可用，跳过心跳');
    return;
  }
  
  // 静默更新活跃时间，不显示loading
  request.post('/auth/session/heartbeat', {}, { 
    silent: true,
    showLoading: false 
  })
    .then(res => {
      if (res && res.success) {
        console.log('[Session] 会话心跳更新成功');
      }
    })
    .catch(error => {
      console.warn('[Session] 会话心跳更新失败:', error);
      // 不影响用户正常使用，仅记录日志
    });
}

/**
 * 启动会话心跳
 */
function startHeartbeat() {
  // 清除之前的定时器
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  // 检查用户是否已登录
  const token = wx.getStorageSync('token');
  if (!token) {
    console.log('[Session] 用户未登录，不启动心跳');
    return;
  }

  console.log('[Session] 启动会话心跳，间隔:', HEARTBEAT_INTERVAL / 60000, '分钟');
  
  // 立即执行一次心跳
  updateSessionActivity();
  
  // 设置定时心跳
  heartbeatTimer = setInterval(() => {
    updateSessionActivity();
  }, HEARTBEAT_INTERVAL);
}

/**
 * 停止会话心跳
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('[Session] 会话心跳已停止');
  }
}

/**
 * 用户登出时清理会话
 */
function clearSession() {
  const token = wx.getStorageSync('token');
  if (!token) {
    return;
  }

  const request = getRequestTool();
  if (!request) {
    console.warn('[Session] 请求工具不可用，跳过登出请求');
    stopHeartbeat();
    return;
  }
  
  // 通知服务器用户登出
  request.post('/auth/logout', {}, { 
    silent: true,
    showLoading: false 
  })
    .then(res => {
      console.log('[Session] 会话清理成功');
    })
    .catch(error => {
      console.warn('[Session] 会话清理失败:', error);
    });

  // 停止心跳
  stopHeartbeat();
}

/**
 * 小程序显示时重启心跳
 */
function onAppShow() {
  const token = wx.getStorageSync('token');
  if (token) {
    console.log('[Session] 小程序显示，重启会话心跳');
    startHeartbeat();
  }
}

/**
 * 小程序隐藏时停止心跳
 */
function onAppHide() {
  console.log('[Session] 小程序隐藏，停止会话心跳');
  stopHeartbeat();
}

// 导出会话管理方法
module.exports = {
  startHeartbeat,
  stopHeartbeat,
  clearSession,
  updateSessionActivity,
  onAppShow,
  onAppHide
}; 