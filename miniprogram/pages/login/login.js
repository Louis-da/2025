Page({
  data: {
    orgId: '',
    username: '',
    password: '',
    currentYear: new Date().getFullYear()
  },
  
  onLoad() {
    // 检查是否有存储的组织ID
    const savedOrgId = wx.getStorageSync('orgId');
    const savedUsername = wx.getStorageSync('username');
    
    if (savedOrgId && savedUsername) {
      this.setData({
        orgId: savedOrgId,
        username: savedUsername
      });
    }
  },
  
  inputOrgId(e) {
    this.setData({ orgId: e.detail.value });
  },
  
  inputUsername(e) {
    this.setData({ username: e.detail.value });
  },
  
  inputPassword(e) {
    this.setData({ password: e.detail.value });
  },
  
  login() {
    const { orgId, username, password } = this.data;
    
    // 验证输入
    if (!orgId) {
      wx.showToast({ title: '请输入组织ID', icon: 'none' });
      return;
    }
    
    // 验证orgId格式，确保是org1而不是orj1等错误输入
    if (orgId !== 'org1') {
      wx.showToast({ title: '无效的组织ID，请使用org1', icon: 'none' });
      return;
    }
    
    if (!username) {
      wx.showToast({ title: '请输入用户名', icon: 'none' });
      return;
    }
    
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '登录中' });
    
    // 存储用户信息
    wx.setStorageSync('orgId', 'org1'); // 强制使用正确的orgId
    wx.setStorageSync('username', username);
    
    // 跳转到首页index页面
    wx.switchTab({
      url: '/pages/index/index',
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '登录成功' });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '跳转失败', icon: 'none' });
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
  }
});