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
    // 检查是否有已登录的 token，自动跳转首页
    const token = wx.getStorageSync('token');
    if (token) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }
    // 检查是否有存储的组织编码
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
  
  verifyPasswordAndLogin(username, password, orgCode) {
    const app = getApp();
    const request = app.getRequest();
    request.post('/auth/login', {
      orgCode: orgCode,
      org_code: orgCode,
      username: username,
      password: password
    })
    .then(res => {
      if (res.success && res.data && res.data.token) {
        // 保存登录信息到本地存储（增强健壮性，防止字段缺失）
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('userId', res.data.userId || res.data.userid || res.data.id || '');
        wx.setStorageSync('username', res.data.username || '');
        wx.setStorageSync('orgId', res.data.orgId || res.data.org_id || res.data.orgCode || '');
        wx.setStorageSync('orgName', res.data.orgName || '');
        wx.setStorageSync('realName', res.data.realName || res.data.username || '');
        wx.setStorageSync('companyName', res.data.orgName || '');
        wx.setStorageSync('employeeName', res.data.realName || res.data.username || '');
        wx.setStorageSync('employeeId', res.data.username || '');
        if (res.data.roleName) wx.setStorageSync('userRole', res.data.roleName);
        wx.setStorageSync('isSuperAdmin', !!(res.data && res.data.isSuperAdmin));
        if (res.data.roleId) wx.setStorageSync('roleId', res.data.roleId);
        // 兼容性：强制刷新token和orgId，防止旧值残留
        wx.setStorageSync('token', res.data.token);
        wx.setStorageSync('orgId', res.data.orgId || res.data.org_id || res.data.orgCode || '');
        
        // 新增：登录成功后启动会话管理
        try {
          if (app.sessionManager) {
            console.log('[Login] 启动会话管理');
            app.sessionManager.startHeartbeat();
          }
        } catch (sessionError) {
          console.warn('[Login] 启动会话管理失败:', sessionError);
          // 不影响登录流程
        }
        
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
        wx.showToast({
          title: '组织编码、工号或密码错误',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: '组织编码、工号或密码错误',
        icon: 'none',
        duration: 2000
      });
    });
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