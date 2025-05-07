// app.js
App({
  onLaunch: function () {
    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查并修复orgId
    this.checkAndFixOrgId();

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
    
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: res => {
              // 可以将 res 发送给后台解码出 unionId
              this.globalData.userInfo = res.userInfo

              // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
              // 所以此处加入 callback 以防止这种情况
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(res)
              }
            }
          })
        }
      }
    })
    
    // 输出当前环境信息
    console.log('当前应用环境:', this.globalData.isDev ? '开发模式' : '生产模式');
    console.log('API基础URL:', this.globalData.apiBaseUrl);
    console.log('API服务器URL:', this.globalData.baseUrl);
  },
  
  // 检查并修复orgId，确保是正确的值
  checkAndFixOrgId: function() {
    const orgId = wx.getStorageSync('orgId');
    if (orgId && orgId !== 'org1') {
      console.warn(`检测到无效的orgId: ${orgId}，已自动修正为org1`);
      wx.setStorageSync('orgId', 'org1');
    }
  },
  
  // 获取API地址，根据API端点和开发模式自动处理
  getAPIUrl: function(endpoint) {
    // 如果处于开发模式且有模拟数据，则使用本地数据
    if (this.globalData.isDev && this.globalData.mockDataMap[endpoint]) {
      console.log('使用模拟数据:', endpoint);
      return null; // 返回null表示使用模拟数据
    }
    
    // 否则使用真实API
    return `${this.globalData.apiBaseUrl}${endpoint}`;
  },
  
  globalData: {
    userInfo: null,
    version: '1.0.0',
    
    // 开发模式开关 - 设置为false禁用模拟数据，使用真实API
    isDev: false,
    
    // 全局配置API基础URL
    apiBaseUrl: 'https://aiyunsf.com/api',
    
    // 新增API服务器URL
    baseUrl: 'https://aiyunsf.com/api',
  }
}) 