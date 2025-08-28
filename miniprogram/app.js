// app.js
// 直接在顶部导入request模块，避免requestTool为null的情况
const requestTool = require('./utils/request');

// Force reload comment

App({
  onLaunch: function () {
    // 初始化全局请求工具
    const requestTool = require('./utils/request');
    this.globalData.request = requestTool;

    // 展示本地存储能力
    var logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 检查并修复orgId
    this.checkAndFixOrgId();

    // 初始化单点登录验证机制
    this.initSingleSignOnCheck();

    // 新增：初始化会话管理
    this.initSessionManagement();

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
  },
  
  // 检查并修复orgId，确保是有效的值
  checkAndFixOrgId: function() {
    const orgId = wx.getStorageSync('orgId');
    // 组织ID将在登录时自动设置
  },
  
  // 初始化单点登录检查机制
  initSingleSignOnCheck: function() {
    // 只在用户已登录时启动检查
    const token = wx.getStorageSync('token');
    if (!token) {
      return;
    }

    // 启动定期检查
    this.startTokenValidationTimer();

    // 监听页面显示事件，在页面显示时检查token
    this.bindPageShowEvent();
  },

  // 启动token验证定时器
  startTokenValidationTimer: function() {
    // 清除之前的定时器
    if (this.tokenCheckTimer) {
      clearInterval(this.tokenCheckTimer);
    }

    // 每5分钟检查一次token有效性
    this.tokenCheckTimer = setInterval(() => {
      this.checkTokenValidity();
    }, 5 * 60 * 1000); // 5分钟
  },

  // 停止token验证定时器
  stopTokenValidationTimer: function() {
    if (this.tokenCheckTimer) {
      clearInterval(this.tokenCheckTimer);
      this.tokenCheckTimer = null;
    }
  },

  // 检查token有效性
  checkTokenValidity: function() {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.stopTokenValidationTimer();
      return;
    }

    // 静默检查，不显示加载状态
    requestTool.verifyToken().catch((error) => {
      if (error && error.type === requestTool.ERROR_TYPES.TOKEN_EXPIRED) {
        console.log('定期检查发现token已失效：账号在其他地方登录');
        this.stopTokenValidationTimer();
      } else if (error && error.type === requestTool.ERROR_TYPES.AUTH_ERROR) {
        console.log('定期检查发现用户未登录');
        this.stopTokenValidationTimer();
      } else {
        // 服务器错误或其他错误，减少检查频率
        console.warn('Token验证出现错误，可能是服务器问题:', error);
        // 将检查间隔增加到15分钟，减少服务器压力
        if (this.tokenCheckTimer) {
          clearInterval(this.tokenCheckTimer);
          this.tokenCheckTimer = setInterval(() => {
            this.checkTokenValidity();
          }, 15 * 60 * 1000); // 15分钟
        }
      }
    });
  },

  // 绑定页面显示事件
  bindPageShowEvent: function() {
    // 保存原始的onShow方法
    const originalOnShow = Page.prototype.onShow;
    
    Page.prototype.onShow = function() {
      // 在非登录页面检查token
      if (this.route && this.route !== 'pages/login/login') {
        getApp().checkTokenOnPageShow();
      }
      
      // 调用原始的onShow方法
      if (originalOnShow) {
        originalOnShow.call(this);
      }
    };
  },

  // 页面显示时检查token
  checkTokenOnPageShow: function() {
    const token = wx.getStorageSync('token');
    if (!token) {
      return;
    }

    // 避免过于频繁的检查，最多每分钟检查一次
    const now = Date.now();
    if (this.lastPageShowCheck && (now - this.lastPageShowCheck) < 60000) {
      return;
    }
    this.lastPageShowCheck = now;

    // 静默检查，防止频繁提示
    requestTool.verifyToken().catch((error) => {
      if (error && error.type === requestTool.ERROR_TYPES.TOKEN_EXPIRED) {
        console.log('页面显示时发现token已失效：账号在其他地方登录');
      }
      // 其他错误不处理，避免影响用户体验
    });
  },
  
  // 新增：初始化会话管理
  initSessionManagement: function() {
    try {
      const sessionManager = require('./utils/session');
      this.sessionManager = sessionManager;
      
      // 如果用户已登录，启动会话管理
      const token = wx.getStorageSync('token');
      if (token) {
        console.log('[App] 用户已登录，启动会话管理');
        sessionManager.startHeartbeat();
      }
    } catch (error) {
      console.warn('[App] 会话管理初始化失败:', error);
      // 不影响应用正常运行
    }
  },

  // 新增：小程序显示时的会话处理
  onShow: function() {
    console.log('[App] 小程序显示');
    if (this.sessionManager) {
      this.sessionManager.onAppShow();
    }
  },

  // 新增：小程序隐藏时的会话处理
  onHide: function() {
    console.log('[App] 小程序隐藏');
    if (this.sessionManager) {
      this.sessionManager.onAppHide();
    }
  },
  
  // 获取API地址，根据API端点和开发模式自动处理 - 修改为始终使用真实API
  getAPIUrl: function(endpoint) {
    // 如果处于开发模式且有模拟数据，则使用本地数据
    // if (this.globalData.isDev && this.globalData.mockDataMap[endpoint]) {
    //   console.log('使用模拟数据:', endpoint);
    //   return null; // 返回null表示使用模拟数据
    // }
    
    // 确保endpoint以/开头但不重复/api
    let finalEndpoint = endpoint;
    if (endpoint.startsWith('/api/')) {
      finalEndpoint = endpoint.substring(4); // 去掉/api前缀
    } else if (!endpoint.startsWith('/')) {
      finalEndpoint = '/' + endpoint;
    }
    
    return `${this.globalData.apiBaseUrl}${finalEndpoint}`;
  },
  
  globalData: {
    userInfo: null,
    version: '3.0.0', // 更新版本号
    
    // 环境配置管理 - 支持多环境自动检测和手动切换
    environment: (() => {
      // 自动检测环境：通过小程序账号信息判断
      try {
        const accountInfo = wx.getAccountInfoSync();
        const envVersion = accountInfo.miniProgram.envVersion;
        
        // envVersion: 'develop' | 'trial' | 'release'
        switch (envVersion) {
          case 'develop':
            return 'development';
          case 'trial':
            return 'staging';
          case 'release':
            return 'production';
          default:
            return 'development';
        }
      } catch (error) {
        console.warn('无法获取小程序环境信息，默认使用开发环境:', error);
        return 'development';
      }
    })(),
    
    // 根据环境动态配置API地址
    get isDev() {
      return this.environment === 'development';
    },
    
    get isStaging() {
      return this.environment === 'staging';
    },
    
    get isProduction() {
      return this.environment === 'production';
    },
    
    // API配置 - 根据环境自动选择
    get apiBaseUrl() {
      const configs = {
        development: 'https://aiyunsf.com/api',  // 开发环境
        staging: 'https://aiyunsf.com/api',      // 测试环境
        production: 'https://aiyunsf.com/api'    // 生产环境
      };
      return configs[this.environment] || configs.development;
    },
    
    // API服务器URL（兼容旧代码）
    get baseUrl() {
      return this.apiBaseUrl;
    },
    
    // 调试配置
    get debugEnabled() {
      return this.environment !== 'production';
    },
    
    // 日志级别配置
    get logLevel() {
      const levels = {
        development: 'debug',
        staging: 'info', 
        production: 'error'
      };
      return levels[this.environment] || 'debug';
    }
  },

  // 新增获取request工具的方法 - 确保始终返回requestTool
  getRequest: function() {
    return requestTool;
  }
}) 