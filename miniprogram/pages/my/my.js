const app = getApp();

Page({
  data: {
    username: '',
    orgId: '',
    avatarUrl: '',
    companyName: '',
    role: '',
    membershipType: '',
    remainingDays: 0,
    remainingHours: 0,
    expiryDate: '',
    creationDate: '',
    authorizationDate: '',
    nickname: '',
    account: '',
    usageDays: 0,
    // 编辑弹窗相关
    showEditModal: false,
    editData: {
      avatarUrl: '',
      companyName: '',
      nickname: '',
      account: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    showPasswordSection: false,
    submitting: false
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时刷新数据，确保数据最新
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    // 获取基本存储信息
    const username = wx.getStorageSync('username') || '未知用户';
    const orgId = wx.getStorageSync('orgId') || '未知组织';
    const avatarUrl = wx.getStorageSync('avatarUrl') || '';
    const companyName = wx.getStorageSync('companyName') || '未设置公司名称';
    const role = wx.getStorageSync('userRole') || '普通用户';
    const nickname = wx.getStorageSync('nickname') || username;
    const account = wx.getStorageSync('account') || '';
    
    // 获取会员相关信息
    const membershipType = wx.getStorageSync('membershipType') || '标准版';
    const creationDate = wx.getStorageSync('orgCreationDate') || '';
    const authorizationDate = wx.getStorageSync('orgAuthDate') || '';
    
    // 计算会员到期时间和剩余时间
    this.calculateMembershipTime(authorizationDate);
    
    // 计算使用天数
    this.calculateUsageDays(creationDate);
    
    this.setData({ 
      username, 
      orgId, 
      avatarUrl,
      companyName,
      role,
      membershipType,
      nickname,
      account,
      creationDate: this.formatDateTime(creationDate),
      authorizationDate: this.formatDateTime(authorizationDate)
    });
  },
  
  // 计算会员到期时间和剩余时间
  calculateMembershipTime(authDate) {
    if (!authDate) {
      this.setData({
        remainingDays: 0,
        remainingHours: 0,
        expiryDate: '未授权'
      });
      return;
    }
    
    try {
      // 解析授权时间
      const authTime = new Date(authDate);
      
      // 获取会员有效期（默认1年）
      const validityPeriod = wx.getStorageSync('membershipPeriod') || 365; // 天数
      
      // 计算到期时间
      const expiryTime = new Date(authTime);
      expiryTime.setDate(expiryTime.getDate() + validityPeriod);
      
      // 计算剩余时间
      const now = new Date();
      const timeDiff = expiryTime - now;
      
      if (timeDiff <= 0) {
        // 已过期
        this.setData({
          remainingDays: 0,
          remainingHours: 0,
          expiryDate: this.formatDateTime(expiryTime) + ' (已过期)'
        });
      } else {
        // 未过期，计算剩余天数和小时数
        const remainingDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        this.setData({
          remainingDays,
          remainingHours,
          expiryDate: this.formatDateTime(expiryTime)
        });
      }
    } catch (error) {
      console.error('计算会员时间出错', error);
      this.setData({
        remainingDays: 0,
        remainingHours: 0,
        expiryDate: '计算错误'
      });
    }
  },
  
  // 计算使用天数
  calculateUsageDays(creationDate) {
    if (!creationDate) {
      this.setData({ usageDays: 0 });
      return;
    }
    
    try {
      const createTime = new Date(creationDate);
      const now = new Date();
      const timeDiff = now - createTime;
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      
      this.setData({ usageDays: days });
    } catch (error) {
      console.error('计算使用天数出错', error);
      this.setData({ usageDays: 0 });
    }
  },
  
  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return '暂无数据';
    
    try {
      const date = new Date(dateStr);
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) return '日期无效';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('日期格式化错误', error);
      return '格式错误';
    }
  },
  
  // 选择头像 - 此函数保留但直接调用showEditProfile
  chooseAvatar() {
    this.showEditProfile();
  },
  
  // 显示编辑个人资料弹窗
  showEditProfile() {
    console.log('打开编辑弹窗');
    this.setData({
      showEditModal: true,
      'editData.avatarUrl': this.data.avatarUrl,
      'editData.companyName': this.data.companyName,
      'editData.oldPassword': '',
      'editData.newPassword': '',
      'editData.confirmPassword': '',
      showPasswordSection: false
    });
  },
  
  // 关闭编辑弹窗
  closeEditModal() {
    this.setData({
      showEditModal: false
    });
  },
  
  // 选择新头像
  chooseNewAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'editData.avatarUrl': tempFilePath
        });
      }
    });
  },
  
  // 输入框变化事件
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`editData.${field}`]: value
    });
  },
  
  // 显示/隐藏密码修改区域
  togglePasswordSection() {
    this.setData({
      showPasswordSection: !this.data.showPasswordSection,
      'editData.oldPassword': '',
      'editData.newPassword': '',
      'editData.confirmPassword': ''
    });
  },
  
  // 保存个人资料
  saveProfile() {
    const { editData, showPasswordSection } = this.data;
    
    // 简单验证
    if (!editData.companyName.trim()) {
      return wx.showToast({ title: '请输入公司名称', icon: 'none' });
    }
    
    // 密码验证
    if (showPasswordSection) {
      if (!editData.oldPassword) {
        return wx.showToast({ title: '请输入原密码', icon: 'none' });
      }
      
      if (!editData.newPassword) {
        return wx.showToast({ title: '请输入新密码', icon: 'none' });
      }
      
      if (editData.newPassword !== editData.confirmPassword) {
        return wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      }
    }
    
    // 防止重复提交
    if (this.data.submitting) return;
    
    this.setData({ submitting: true });
    
    // 模拟API调用
    wx.showLoading({ title: '保存中' });
    
    setTimeout(() => {
      // 保存头像
      if (editData.avatarUrl !== this.data.avatarUrl) {
        wx.setStorageSync('avatarUrl', editData.avatarUrl);
      }
      
      // 保存其他信息
      wx.setStorageSync('companyName', editData.companyName);
      
      // 密码修改在实际应用中应通过API处理
      if (showPasswordSection) {
        // 模拟密码验证和修改
        const storedPassword = wx.getStorageSync('password') || '123456';
        
        if (editData.oldPassword !== storedPassword) {
          wx.hideLoading();
          this.setData({ submitting: false });
          return wx.showToast({ title: '原密码不正确', icon: 'none' });
        }
        
        // 保存新密码
        wx.setStorageSync('password', editData.newPassword);
      }
      
      // 刷新页面数据
      this.loadUserInfo();
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      this.setData({
        submitting: false,
        showEditModal: false
      });
    }, 1500);
  },
  
  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除用户数据但保留组织授权数据
          wx.removeStorageSync('username');
          wx.removeStorageSync('avatarUrl');
          wx.removeStorageSync('userRole');
          
          wx.redirectTo({ url: '/pages/login/login' });
        }
      }
    });
  }
});