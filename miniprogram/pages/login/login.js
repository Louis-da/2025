Page({
  data: {
    orgCode: '',
    username: '',
    password: '',
    currentYear: new Date().getFullYear(),
    loading: false,
    agreeToTerms: false  // 是否同意服务协议和隐私政策
  },
  
  onLoad() {
    // 检查是否有已登录的 token，验证有效性后自动跳转首页
    this.checkTokenAndRedirect();
  },

  /**
   * 检查token有效性并跳转
   */
  async checkTokenAndRedirect() {
    const token = wx.getStorageSync('token');
    if (!token) {
      // 没有token，开始系统检查
      this.checkSystemStatus();
      return;
    }

    try {
      // 验证token有效性
       const request = require('../../utils/request');
       const res = await request.post('auth', {
         action: 'verify-token',
         data: {
           token: token
         }
       }, {
         showLoading: false,
         showError: false
       });

      if (res.success) {
        // token有效，直接跳转首页
        wx.reLaunch({ url: '/pages/index/index' });
        return;
      } else {
        // token无效，清除存储并显示登录页面
        console.log('[Login] Token无效，清除本地存储');
        wx.clearStorageSync();
        this.checkSystemStatus();
      }
    } catch (error) {
      // token验证失败，清除存储并显示登录页面
      console.log('[Login] Token验证失败，清除本地存储:', error);
      wx.clearStorageSync();
      this.checkSystemStatus();
    }
  },

  /**
   * 检查系统状态
   */
  async checkSystemStatus() {
    try {
      const app = getApp();
      
      // 等待云开发初始化
      await this.waitForCloudInit();
      
      // 加载保存的登录信息
      this.loadSavedLoginInfo();
      
    } catch (error) {
      console.error('[Login] 系统初始化失败:', error);
      
      // 即使初始化失败也加载登录信息
      this.loadSavedLoginInfo();
    }
  },

  /**
   * 等待云开发初始化
   */
  waitForCloudInit() {
    return new Promise((resolve, reject) => {
      const app = getApp();
      let attempts = 0;
      const maxAttempts = 10;
      
      const checkCloud = () => {
        if (app.globalData.cloud) {
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkCloud, 500);
        } else {
          reject(new Error('云开发初始化超时'));
        }
      };
      
      checkCloud();
    });
  },

  /**
   * 加载保存的登录信息
   */
  loadSavedLoginInfo() {
    const savedOrgCode = wx.getStorageSync('orgCode');
    const savedUsername = wx.getStorageSync('username');
    if (savedOrgCode && savedUsername) {
      this.setData({
        orgCode: savedOrgCode,
        username: savedUsername
      });
    }
  },

  inputOrgCode(e) {
    this.setData({ orgCode: e.detail.value });
  },
  
  inputUsername(e) {
    this.setData({ username: e.detail.value });
  },
  
  inputPassword(e) {
    this.setData({ password: e.detail.value });
  },
  
  login() {
    const { orgCode, username, password, agreeToTerms } = this.data;
    if (!orgCode) {
      wx.showToast({ title: '请输入组织编码', icon: 'none' });
      return;
    }
    if (!username) {
      wx.showToast({ title: '请输入工号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    if (!agreeToTerms) {
      wx.showToast({ title: '请先阅读并同意服务协议和隐私政策', icon: 'none', duration: 3000 });
      return;
    }
    this.setData({ loading: true });
    wx.showLoading({ title: '登录中' });
    this.verifyPasswordAndLogin(username, password, orgCode);
  },
  
  async verifyPasswordAndLogin(username, password, orgCode) {
    const app = getApp();
    const request = require('../../utils/request');
    
    try {
      // 使用新的请求工具进行登录
      const res = await request.post('auth', {
        action: 'login',
        orgId: orgCode,
        username,
        password
      }, {
        showLoading: false, // 已经在login方法中显示了loading
        validateParams: true,
        paramRules: {
          orgId: { required: true, message: '组织编码不能为空' },
          username: { required: true, message: '用户名不能为空' },
          password: { required: true, message: '密码不能为空' }
        }
      });
      
      if (res.success && res.data && res.data.accessToken) {
        // 保存登录信息到本地存储（增强健壮性，防止字段缺失）
        const userData = res.data;
        const storageData = {
          token: userData.accessToken,
          userId: userData.userId || userData.userid || userData.id || '',
          username: userData.username || username,
          orgId: userData.orgId || userData.org_id || userData.orgCode || orgCode,
          orgName: userData.orgName || '',
          realName: userData.realName || userData.username || username,
          companyName: userData.orgName || '',
          employeeName: userData.realName || userData.username || username,
          employeeId: userData.username || username,
          userRole: userData.roleName || '',
          isSuperAdmin: !!(userData.isSuperAdmin),
          roleId: userData.roleId || ''
        };
        
        // 批量保存到本地存储
        Object.keys(storageData).forEach(key => {
          if (storageData[key] !== '') {
            wx.setStorageSync(key, storageData[key]);
          }
        });
        
        // 验证token是否正确保存
        const savedToken = wx.getStorageSync('token');
        console.log('[Login] 登录成功，用户信息已保存:', {
          userId: storageData.userId,
          username: storageData.username,
          orgId: storageData.orgId,
          orgName: storageData.orgName,
          tokenSaved: !!savedToken,
          tokenLength: savedToken ? savedToken.length : 0,
          tokenPreview: savedToken ? savedToken.substring(0, 20) + '...' : '无'
        });
        
        // 启动会话管理
        try {
          if (app.sessionManager) {
            console.log('[Login] 启动会话管理');
            app.sessionManager.startHeartbeat();
          }
        } catch (sessionError) {
          console.warn('[Login] 启动会话管理失败:', sessionError);
          // 不影响登录流程
        }
        
        // 跳转到首页
        wx.reLaunch({
          url: '/pages/index/index',
          success: () => {
            wx.hideLoading();
            this.setData({ loading: false });
            wx.showToast({
              title: '登录成功',
              icon: 'success',
              duration: 1500
            });
            
            // 启动单点登录检查机制
            if (app && app.initSingleSignOnCheck) {
              app.initSingleSignOnCheck();
            }
          },
          fail: (err) => {
            wx.hideLoading();
            this.setData({ loading: false });
            wx.showToast({ title: '跳转失败', icon: 'none' });
          }
        });
      } else {
        wx.hideLoading();
        this.setData({ loading: false });
        // 检查是否是数据库未初始化的错误
        this.handleLoginError(res);
      }
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false });
      console.error('[Login] 登录请求失败:', err);
      // 检查是否是数据库未初始化的错误
      this.handleLoginError(err);
    }
  },

  // 处理登录错误
  handleLoginError(error) {
    console.log('[Login] 登录错误:', error);
    
    const errorMessage = error.message || error.errMsg || '';
    const errorType = error.type || 'unknown';
    
    // 根据错误类型进行不同处理
    switch (errorType) {
      case 'AUTH_ERROR':
        wx.showToast({
          title: errorMessage || '认证失败，请检查登录信息',
          icon: 'none',
          duration: 3000
        });
        break;
        
      case 'VALIDATION_ERROR':
        wx.showToast({
          title: errorMessage || '参数验证失败',
          icon: 'none',
          duration: 3000
        });
        break;
        
      case 'NETWORK_ERROR':
        wx.showModal({
          title: '网络连接失败',
          content: '请检查网络连接后重试，或联系管理员。',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
        
      case 'SERVER_ERROR':
        // 检查是否是数据库相关错误
        const isDbError = errorMessage.includes('数据库') || 
                         errorMessage.includes('database') || 
                         errorMessage.includes('collection') ||
                         errorMessage.includes('用户不存在') ||
                         (error.errCode && (error.errCode === -502002 || error.errCode === -502001));
        
        if (isDbError) {
          // 数据库错误，显示错误信息
          wx.showModal({
            title: '数据库错误',
            content: '数据库连接异常，请联系管理员处理。',
            showCancel: false
          });
        } else {
          wx.showModal({
            title: '服务器错误',
            content: errorMessage || '服务器暂时无法响应，请稍后重试。',
            showCancel: false,
            confirmText: '知道了'
          });
        }
        break;
        
      case 'TIMEOUT_ERROR':
        wx.showModal({
          title: '请求超时',
          content: '登录请求超时，请检查网络连接后重试。',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
        
      default:
        // 未知错误或普通登录错误
        const defaultMessage = errorMessage || '组织编码、工号或密码错误';
        wx.showToast({
          title: defaultMessage,
          icon: 'none',
          duration: 3000
        });
        break;
    }
  },
  
  // 清除缓存功能
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有本地缓存数据吗？这将删除已保存的登录信息。',
      confirmText: '确定清除',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try {
            // 清除所有本地存储
            wx.clearStorageSync();
            
            // 重置页面数据
            this.setData({
              orgCode: '',
              username: '',
              password: ''
            });
            
            wx.showToast({
              title: '缓存已清除',
              icon: 'success',
              duration: 2000
            });
          } catch (error) {
            wx.showToast({
              title: '清除失败',
              icon: 'error',
              duration: 2000
            });
          }
        }
      }
    });
  },

  // 忘记密码和帮助功能
  forgotPassword() {
    wx.showModal({
      title: '帮助忘记密码?',
      content: '如果您忘记了密码或遇到登录问题，请联系管理员协助您。',
      showCancel: false
    });
  },

  logout() {
    wx.removeStorageSync('token');
    wx.switchTab({ url: '/pages/login/login' });
  },

  // 切换协议同意状态
  toggleAgreement() {
    this.setData({
      agreeToTerms: !this.data.agreeToTerms
    });
  },

  // 显示服务协议
  showServiceAgreement(e) {
    // 阻止事件冒泡，避免触发toggleAgreement
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    wx.navigateTo({
      url: '/pages/service-agreement/service-agreement'
    });
  },

  // 显示隐私政策
  showPrivacyPolicy(e) {
    // 阻止事件冒泡，避免触发toggleAgreement
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    wx.navigateTo({
      url: '/pages/privacy-policy/privacy-policy'
    });
  }
});