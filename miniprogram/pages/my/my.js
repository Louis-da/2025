const app = getApp();
const { throttle } = require('../../utils/throttle');

Page({
  data: {
    username: '',
    orgId: '',
    orgName: '',
    avatarUrl: '',
    companyName: '',
    employeeName: '',
    employeeId: '',
    role: '',
    roleId: null,
    membershipType: '',
    remainingDays: 0,
    remainingHours: 0,
    expiryDate: '',
    creationDate: '',
    authorizationDate: '',
    nickname: '',
    account: '',
    usageDays: 0,
    // 权限控制
    isBoss: false,
    canEdit: true,
    // 编辑弹窗相关
    showEditModal: false,
    editData: {
      avatarUrl: '',
      companyName: '',
      employeeName: '',
      employeeId: '',
      nickname: '',
      account: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    },
    showPasswordSection: false,
    submitting: false,
    // 用户管理相关（老板角色）
    showUserManageModal: false,
    orgUsers: [],
    loadingUsers: false,
    // 用户编辑弹窗相关
    showUserEditModal: false,
    editingUser: null,
    userEditData: {
      username: '',
      real_name: '',
      roleId: null,
      roleIndex: 0,
      roleName: ''
    },
    userSubmitting: false,
    // 角色选择选项（仅员工和专员）
    roleOptions: [
      { id: 3, name: '员工' },
      { id: 4, name: '专员' }
    ]
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    // 每次显示页面时刷新数据，确保数据最新
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo: throttle(function() {
    // 获取基本存储信息，注意处理可能的字段名不一致问题
    const username = wx.getStorageSync('username') || '未知用户';
    const orgId = wx.getStorageSync('orgId');
    const orgName = wx.getStorageSync('orgName') || '未知组织名称';
    const realName = wx.getStorageSync('realName') || '';
    const avatarUrl = wx.getStorageSync('avatarUrl') || '';
    
    // 公司名称：优先使用orgName（权威数据源），然后是companyName
    const companyName = wx.getStorageSync('orgName') || wx.getStorageSync('companyName') || '未设置公司名称';
    
    // 员工姓名：优先使用realName（权威数据源），然后是employeeName
    const employeeName = wx.getStorageSync('realName') || wx.getStorageSync('employeeName') || '';
    
    const employeeId = wx.getStorageSync('employeeId') || wx.getStorageSync('username') || '';
    const roleId = wx.getStorageSync('roleId') || wx.getStorageSync('role_id') || 3; // 默认员工角色
    // 使用getRoleName函数确保角色称呼统一，而不是硬编码默认值
    const role = this.getRoleName(parseInt(roleId));
    const nickname = wx.getStorageSync('nickname') || realName || username;
    const account = wx.getStorageSync('account') || '';
    
    // 数据完整性检查和自动修复
    let needsUpdate = false;
    
    // 确保companyName与orgName同步
    const storedOrgName = wx.getStorageSync('orgName');
    if (storedOrgName && wx.getStorageSync('companyName') !== storedOrgName) {
      wx.setStorageSync('companyName', storedOrgName);
      needsUpdate = true;
    }
    
    // 确保employeeName与realName同步
    const storedRealName = wx.getStorageSync('realName');
    if (storedRealName && wx.getStorageSync('employeeName') !== storedRealName) {
      wx.setStorageSync('employeeName', storedRealName);
      needsUpdate = true;
    }
    
    // 确保employeeId与username同步
    const storedUsername = wx.getStorageSync('username');
    if (storedUsername && wx.getStorageSync('employeeId') !== storedUsername) {
      wx.setStorageSync('employeeId', storedUsername);
      needsUpdate = true;
    }
    
    // 角色权限判断
    const isBoss = parseInt(roleId) === 2; // 老板角色
    const isEmployee = parseInt(roleId) === 3; // 员工角色
    const isSpecialist = parseInt(roleId) === 4; // 专员角色
    const canEdit = isBoss; // 只有老板可以编辑公司名称和姓名，员工和专员都不能编辑
    
    // 获取会员相关信息
    const membershipType = wx.getStorageSync('membershipType') || '标准版';
    const creationDate = wx.getStorageSync('orgCreationDate') || '';
    const authorizationDate = wx.getStorageSync('orgAuthDate') || '';
    
    // 计算会员到期时间和剩余时间
    this.calculateMembershipTime(authorizationDate);
    
    // 计算使用天数
    this.calculateUsageDays(creationDate);
    
    // 使用最终的数据（包括可能的修复数据）
    const finalCompanyName = wx.getStorageSync('companyName') || companyName;
    const finalEmployeeName = wx.getStorageSync('employeeName') || employeeName;
    const finalEmployeeId = wx.getStorageSync('employeeId') || employeeId;
    
    this.setData({ 
      username, 
      orgId, 
      orgName,
      realName,
      avatarUrl,
      companyName: finalCompanyName,
      employeeName: finalEmployeeName,
      employeeId: finalEmployeeId,
      role,
      roleId: parseInt(roleId),
      isBoss,
      isEmployee,
      isSpecialist,
      canEdit,
      membershipType,
      nickname,
      account,
      creationDate: this.formatDateTime(creationDate),
      authorizationDate: this.formatDateTime(authorizationDate)
    });
  }, 1000),
  
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
      return '格式错误';
    }
  },
  
  // 选择头像 - 此函数保留但直接调用showEditProfile
  chooseAvatar() {
    this.showEditProfile();
  },
  
  // 显示编辑个人资料弹窗
  showEditProfile() {
    // 根据角色权限控制可编辑字段
    // 专员和员工都不能编辑基本信息，只有老板可以编辑公司名称
    const canEditBasicInfo = false; // 工号和姓名任何角色都不能在个人资料中编辑
    const canEditCompany = this.data.isBoss; // 只有老板可以编辑公司名称
    
    this.setData({
      showEditModal: true,
      'editData.avatarUrl': this.data.avatarUrl,
      'editData.companyName': canEditCompany ? this.data.companyName : '', 
      'editData.employeeName': canEditBasicInfo ? this.data.employeeName : '',
      'editData.employeeId': canEditBasicInfo ? (this.data.employeeId || wx.getStorageSync('username') || '') : '',
      'editData.oldPassword': '',
      'editData.newPassword': '',
      'editData.confirmPassword': '',
      showPasswordSection: false
    });
  },
  
  // 防止触摸移动
  preventTouchMove() {
    return false;
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
  async saveProfile() {
    const { editData, showPasswordSection, canEdit, isBoss, isEmployee, isSpecialist } = this.data;
    
    // 老板角色特殊处理：可以修改头像、公司名称和密码
    if (isBoss) {
      // 检查是否有修改头像或公司名称
      const avatarChanged = editData.avatarUrl !== this.data.avatarUrl;
      const companyChanged = editData.companyName.trim() !== this.data.companyName;
      
      // 验证公司名称
      if (companyChanged && !editData.companyName.trim()) {
        return wx.showToast({ title: '请输入公司名称', icon: 'none' });
      }
      
      // 检查是否要修改密码
      if (showPasswordSection) {
        // 密码验证
        if (!editData.oldPassword) {
          return wx.showToast({ title: '请输入原密码', icon: 'none' });
        }
        
        if (!editData.newPassword) {
          return wx.showToast({ title: '请输入新密码', icon: 'none' });
        }
        
        if (editData.newPassword !== editData.confirmPassword) {
          return wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
        }
        
        // 防止重复提交
        if (this.data.submitting) return;
        
        this.setData({ submitting: true });
        wx.showLoading({ title: '保存中' });
        
        // 异步处理所有更新操作
        try {
          // 保存头像（如果有修改）
          if (avatarChanged) {
            wx.setStorageSync('avatarUrl', editData.avatarUrl);
          }
          
          // 保存公司名称到后端（如果有修改）
          if (companyChanged) {
            const app = getApp();
            const request = app.getRequest();
            
            console.log('开始更新公司名称:', editData.companyName.trim());
            
            // 调用组织列表API获取当前用户的组织信息
            const orgResponse = await request.get('/api/organizations');
            console.log('组织API响应:', orgResponse);
            
            if (!orgResponse.success || !orgResponse.data || orgResponse.data.length === 0) {
              throw new Error('无法获取组织信息');
            }
            
            // 获取第一个组织（非超级管理员只能看到自己的组织）
            const currentOrg = orgResponse.data[0];
            console.log('当前组织信息:', currentOrg);
            
            if (!currentOrg.id) {
              throw new Error('组织数据无效');
            }
            
            // 调用后端API更新组织名称
            const updateResponse = await request.put(`/api/organizations/${currentOrg.id}`, {
              name: editData.companyName.trim()
            });
            
            if (!updateResponse.success) {
              throw new Error(updateResponse.message || '更新组织名称失败');
            }
            
            console.log('组织名称更新成功');
            
            // 后端更新成功后，同步更新本地存储
            wx.setStorageSync('companyName', editData.companyName.trim());
            wx.setStorageSync('orgName', editData.companyName.trim());
          }
          
          // 🔧 修复密码修改逻辑：调用后端API进行真实的密码验证和修改
          const app = getApp();
          const request = app.getRequest();
          
          console.log('开始调用后端API修改密码');
          
          // 调用后端密码修改API
          const passwordResponse = await request.post('/api/auth/change-password', {
            oldPassword: editData.oldPassword,
            newPassword: editData.newPassword
          });
          
          if (!passwordResponse.success) {
            throw new Error(passwordResponse.error || passwordResponse.message || '密码修改失败');
          }
          
          console.log('密码修改成功，后端API响应:', passwordResponse);
          
          // 刷新页面数据
          this.loadUserInfo();
          
          wx.hideLoading();
          
          // 显示成功信息
          const changedItems = [];
          if (avatarChanged) changedItems.push('头像');
          if (companyChanged) changedItems.push('公司名称');
          changedItems.push('密码');
          
          wx.showToast({ 
            title: `${changedItems.join('、')}修改成功`, 
            icon: 'success' 
          });
          
          this.setData({
            submitting: false,
            showEditModal: false
          });
          
        } catch (error) {
          wx.hideLoading();
          this.setData({ submitting: false });
          console.error('保存失败:', error);
          wx.showToast({ 
            title: error.message || '保存失败，请重试', 
            icon: 'none',
            duration: 3000
          });
        }
        
      } else {
        // 只修改头像和/或公司名称
        if (avatarChanged || companyChanged) {
          // 防止重复提交
          if (this.data.submitting) return;
          
          this.setData({ submitting: true });
          wx.showLoading({ title: '保存中' });
          
          // 异步处理更新操作
          try {
            if (avatarChanged) {
              wx.setStorageSync('avatarUrl', editData.avatarUrl);
            }
            
            if (companyChanged) {
              const app = getApp();
              const request = app.getRequest();
              
              console.log('开始更新公司名称:', editData.companyName.trim());
              
              // 调用组织列表API获取当前用户的组织信息
              const orgResponse = await request.get('/api/organizations');
              console.log('组织API响应:', orgResponse);
              
              if (!orgResponse.success || !orgResponse.data || orgResponse.data.length === 0) {
                throw new Error('无法获取组织信息');
              }
              
              // 获取第一个组织（非超级管理员只能看到自己的组织）
              const currentOrg = orgResponse.data[0];
              console.log('当前组织信息:', currentOrg);
              
              if (!currentOrg.id) {
                throw new Error('组织数据无效');
              }
              
              // 调用后端API更新组织名称
              const updateResponse = await request.put(`/api/organizations/${currentOrg.id}`, {
                name: editData.companyName.trim()
              });
              
              if (!updateResponse.success) {
                throw new Error(updateResponse.message || '更新组织名称失败');
              }
              
              console.log('组织名称更新成功');
              
              // 后端更新成功后，同步更新本地存储
              wx.setStorageSync('companyName', editData.companyName.trim());
              wx.setStorageSync('orgName', editData.companyName.trim());
            }
              
              // 🔧 修复密码修改逻辑：调用后端API进行真实的密码验证和修改
              const app = getApp();
              const request = app.getRequest();
              
              console.log('开始调用后端API修改密码');
              
              // 调用后端密码修改API
              const passwordResponse = await request.post('/api/auth/change-password', {
                oldPassword: editData.oldPassword,
                newPassword: editData.newPassword
              });
              
              if (!passwordResponse.success) {
                throw new Error(passwordResponse.error || passwordResponse.message || '密码修改失败');
              }
              
              console.log('密码修改成功，后端API响应:', passwordResponse);
            
            this.loadUserInfo();
            wx.hideLoading();
            
            const changedItems = [];
            if (avatarChanged) changedItems.push('头像');
            if (companyChanged) changedItems.push('公司名称');
            
            wx.showToast({ 
              title: `${changedItems.join('、')}更新成功`, 
              icon: 'success' 
            });
            
            this.setData({ 
              submitting: false,
              showEditModal: false 
            });
            
          } catch (error) {
            wx.hideLoading();
            this.setData({ submitting: false });
            console.error('保存失败:', error);
            wx.showToast({ 
              title: error.message || '保存失败，请重试', 
              icon: 'none',
              duration: 3000
            });
          }
        } else {
          wx.showToast({ title: '未做任何修改', icon: 'none' });
        }
      }
      return;
    }
    
    // 专员角色只能修改密码
    if (isSpecialist) {
      // 检查是否要修改密码
      if (showPasswordSection) {
        // 密码验证
        if (!editData.oldPassword) {
          return wx.showToast({ title: '请输入原密码', icon: 'none' });
        }
        
        if (!editData.newPassword) {
          return wx.showToast({ title: '请输入新密码', icon: 'none' });
        }
        
        if (editData.newPassword !== editData.confirmPassword) {
          return wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
        }
        
        // 防止重复提交
        if (this.data.submitting) return;
        
        this.setData({ submitting: true });
        wx.showLoading({ title: '保存中' });
        
        // 专员角色密码修改逻辑：直接调用后端API
        (async () => {
          try {
            const app = getApp();
            const request = app.getRequest();
            
            console.log('专员角色开始调用后端API修改密码');
            
            // 调用后端密码修改API
            const passwordResponse = await request.post('/api/auth/change-password', {
              oldPassword: editData.oldPassword,
              newPassword: editData.newPassword
            });
            
            if (!passwordResponse.success) {
              wx.hideLoading();
              this.setData({ submitting: false });
              return wx.showToast({ 
                title: passwordResponse.error || passwordResponse.message || '密码修改失败', 
                icon: 'none' 
              });
            }
            
            console.log('专员角色密码修改成功，后端API响应:', passwordResponse);
            
            // 刷新页面数据
            this.loadUserInfo();
            
            wx.hideLoading();
            wx.showToast({ title: '密码修改成功', icon: 'success' });
            
            this.setData({
              submitting: false,
              showEditModal: false
            });
          } catch (error) {
            wx.hideLoading();
            this.setData({ submitting: false });
            console.error('专员角色密码修改失败:', error);
            wx.showToast({ 
              title: error.message || '密码修改失败，请重试', 
              icon: 'none' 
            });
          }
        })();
      } else {
        wx.showToast({ title: '专员角色只能修改密码', icon: 'none' });
      }
      return;
    }
    
    // 员工角色可以修改头像和密码
    if (isEmployee) {
      // 检查是否有修改头像
      const avatarChanged = editData.avatarUrl !== this.data.avatarUrl;
      
      // 检查是否要修改密码
      if (showPasswordSection) {
        // 密码验证
        if (!editData.oldPassword) {
          return wx.showToast({ title: '请输入原密码', icon: 'none' });
        }
        
        if (!editData.newPassword) {
          return wx.showToast({ title: '请输入新密码', icon: 'none' });
        }
        
        if (editData.newPassword !== editData.confirmPassword) {
          return wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
        }
        
        // 防止重复提交
        if (this.data.submitting) return;
        
        this.setData({ submitting: true });
        wx.showLoading({ title: '保存中' });
        
        // 🔧 修复员工角色密码修改逻辑：直接调用后端API
        (async () => {
          try {
          // 保存头像（如果有修改）
          if (avatarChanged) {
            wx.setStorageSync('avatarUrl', editData.avatarUrl);
          }
          
            const app = getApp();
            const request = app.getRequest();
            
            console.log('员工角色开始调用后端API修改密码');
            
            // 调用后端密码修改API
            const passwordResponse = await request.post('/api/auth/change-password', {
              oldPassword: editData.oldPassword,
              newPassword: editData.newPassword
            });
            
            if (!passwordResponse.success) {
            wx.hideLoading();
            this.setData({ submitting: false });
              return wx.showToast({ 
                title: passwordResponse.error || passwordResponse.message || '密码修改失败', 
                icon: 'none' 
              });
          }
          
            console.log('员工角色密码修改成功，后端API响应:', passwordResponse);
          
          // 刷新页面数据
          this.loadUserInfo();
          
          wx.hideLoading();
          wx.showToast({ title: '密码修改成功', icon: 'success' });
          
          this.setData({
            submitting: false,
            showEditModal: false
          });
          } catch (error) {
            wx.hideLoading();
            this.setData({ submitting: false });
            console.error('员工角色密码修改失败:', error);
            wx.showToast({ 
              title: error.message || '密码修改失败，请重试', 
              icon: 'none' 
            });
          }
        })();
        
      } else {
        // 只修改头像
        if (avatarChanged) {
          wx.setStorageSync('avatarUrl', editData.avatarUrl);
          this.loadUserInfo();
          wx.showToast({ title: '头像更新成功', icon: 'success' });
          this.setData({ showEditModal: false });
        } else {
          wx.showToast({ title: '未做任何修改', icon: 'none' });
        }
      }
      return;
    }
    
    // 老板角色可以修改所有信息
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
    
    // 🔧 直接执行异步操作，无需setTimeout
    (async () => {
      try {
      // 保存头像
      if (editData.avatarUrl !== this.data.avatarUrl) {
        wx.setStorageSync('avatarUrl', editData.avatarUrl);
      }
      
      // 保存其他信息
      // 注意：公司名称应该与组织名称保持一致，不允许用户随意修改
      // 如果用户修改了公司名称，以组织名称为准
      const currentOrgName = wx.getStorageSync('orgName') || '';
      wx.setStorageSync('companyName', currentOrgName);
      wx.setStorageSync('employeeName', editData.employeeName);
      wx.setStorageSync('employeeId', editData.employeeId);
      
      // 同步更新realName，确保制单人信息统一
      wx.setStorageSync('realName', editData.employeeName);
      
        // 🔧 修复密码修改逻辑：调用后端API进行真实的密码验证和修改
      if (showPasswordSection) {
          const app = getApp();
          const request = app.getRequest();
          
          console.log('开始调用后端API修改密码');
          
          // 调用后端密码修改API
          const passwordResponse = await request.post('/api/auth/change-password', {
            oldPassword: editData.oldPassword,
            newPassword: editData.newPassword
          });
          
          if (!passwordResponse.success) {
          wx.hideLoading();
          this.setData({ submitting: false });
            return wx.showToast({ 
              title: passwordResponse.error || passwordResponse.message || '密码修改失败', 
              icon: 'none' 
            });
        }
        
          console.log('密码修改成功，后端API响应:', passwordResponse);
      }
      
      // 刷新页面数据
      this.loadUserInfo();
      
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      
      this.setData({
        submitting: false,
        showEditModal: false
      });
      } catch (error) {
        wx.hideLoading();
        this.setData({ submitting: false });
        console.error('保存失败:', error);
        wx.showToast({ 
          title: error.message || '保存失败，请重试', 
          icon: 'none' 
        });
      }
    })();
  },
  
  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 停止单点登录检查
          const app = getApp();
          if (app && app.stopTokenValidationTimer) {
            app.stopTokenValidationTimer();
          }

          // 新增：清理会话记录
          try {
            if (app && app.sessionManager) {
              console.log('[My] 清理会话记录');
              app.sessionManager.clearSession();
            }
          } catch (sessionError) {
            console.warn('[My] 清理会话记录失败:', sessionError);
            // 不影响登出流程
          }
          
          wx.clearStorageSync();
          wx.showToast({ title: '已退出', icon: 'none' });
          setTimeout(() => {
            wx.reLaunch({ url: '/pages/login/login' });
          }, 500);
        }
      }
    });
  },

  // 显示用户管理弹窗（老板角色专用）
  showUserManage() {
    if (!this.data.isBoss) {
      wx.showToast({ title: '权限不足', icon: 'none' });
      return;
    }
    
    this.setData({ showUserManageModal: true });
    this.loadOrgUsers();
  },

  // 角色ID映射为角色名称
  getRoleName(roleId) {
    const roleMap = {
      1: '超级管理员',
      2: '老板', 
      3: '员工',
      4: '专员'  // 🔧 新增专员角色
    };
    return roleMap[roleId] || '员工';
  },

  // 加载组织用户列表
  async loadOrgUsers() {
    if (!this.data.isBoss) return;
    
    this.setData({ loadingUsers: true });
    
    try {
      // 调用真实API获取组织用户
      const app = getApp();
      const request = app.getRequest();
      
      const token = wx.getStorageSync('token');
      const orgId = this.data.orgId;
      
      if (!token) {
        throw new Error('未登录');
      }
      
      console.log('加载组织用户，orgId:', orgId);
      
      // 调用用户列表API，只获取同组织的用户
      const response = await request.get('/api/users', {
        orgId: orgId,
        limit: 50 // 获取足够多的用户
      });
      
      if (response.success && response.data) {
        const users = response.data.map(user => {
          // 获取roleId，支持多种可能的字段名
          const roleId = user.role_id || user.roleId || user.role || 3;
          
          return {
            id: user.id,
            username: user.username,
            real_name: user.real_name || user.realName || user.username,
            // 强制使用getRoleName函数确保角色称呼统一
            role: this.getRoleName(parseInt(roleId)),
            roleId: parseInt(roleId),
            status: user.status || 1,
            orgId: user.orgId
          };
        });
        
        this.setData({
          orgUsers: users,
          loadingUsers: false
        });
        
        console.log('加载到组织用户:', users.length, '人');
        console.log('用户角色信息:', users.map(u => ({ username: u.username, role: u.role, roleId: u.roleId })));
      } else {
        throw new Error(response.message || '获取用户列表失败');
      }
      
    } catch (error) {
      console.error('加载用户列表失败:', error);
      
      // 如果API调用失败，显示错误信息
      wx.showToast({ 
        title: error.message || '加载失败', 
        icon: 'none' 
      });
      
      this.setData({ 
        loadingUsers: false,
        orgUsers: []
      });
    }
  },

  // 关闭用户管理弹窗
  closeUserManageModal() {
    this.setData({ showUserManageModal: false });
  },

  // 编辑组织用户
  editOrgUser(e) {
    const { user } = e.currentTarget.dataset;
    
    // 🔧 权限验证：只有老板角色可以编辑用户
    if (!this.data.isBoss) {
      return wx.showToast({
        title: '无权限编辑用户信息',
        icon: 'none'
      });
    }
    
    // 🔧 角色限制：只能编辑员工和专员角色
    if (user.roleId !== 3 && user.roleId !== 4) {
      return wx.showToast({
        title: '只能编辑员工和专员角色',
        icon: 'none'
      });
    }
    
    // 初始化角色选择数据
    const currentRoleId = user.roleId || 3;
    const roleIndex = this.data.roleOptions.findIndex(role => role.id === currentRoleId);
    const roleName = this.data.roleOptions[roleIndex >= 0 ? roleIndex : 0].name;
    
    // 显示编辑弹窗，包含工号、姓名和角色
    this.setData({
      showUserEditModal: true,
      editingUser: user,
      'userEditData.username': user.username || '',
      'userEditData.real_name': user.real_name || '',
      'userEditData.roleId': currentRoleId,
      'userEditData.roleIndex': roleIndex >= 0 ? roleIndex : 0,
      'userEditData.roleName': roleName,
      userSubmitting: false
    });
  },

  // 关闭用户编辑弹窗
  closeUserEditModal() {
    this.setData({
      showUserEditModal: false,
      editingUser: null,
      'userEditData.username': '',
      'userEditData.real_name': '',
      'userEditData.roleId': null,
      'userEditData.roleIndex': 0,
      'userEditData.roleName': '',
      userSubmitting: false
    });
  },

  // 用户编辑输入框变化事件
  onUserEditInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`userEditData.${field}`]: value
    });
  },

  // 角色选择变化事件
  onRoleChange(e) {
    const roleIndex = parseInt(e.detail.value);
    const selectedRole = this.data.roleOptions[roleIndex];
    
    this.setData({
      'userEditData.roleIndex': roleIndex,
      'userEditData.roleId': selectedRole.id,
      'userEditData.roleName': selectedRole.name
    });
  },

  // 保存用户编辑
  saveUserEdit() {
    const { editingUser, userEditData } = this.data;
    
    if (!editingUser) return;
    
    // 验证输入
    const newUsername = userEditData.username.trim();
    const newRealName = userEditData.real_name.trim();
    const newRoleId = userEditData.roleId;
    
    if (!newUsername) {
      return wx.showToast({
        title: '请输入工号',
        icon: 'none'
      });
    }
    
    if (!newRealName) {
      return wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
    }
    
    // 验证工号格式
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
      return wx.showToast({
        title: '工号格式不正确，请输入3-20位字母数字下划线',
        icon: 'none',
        duration: 3000
      });
    }
    
    // 检查是否有修改
    if (newUsername === editingUser.username && 
        newRealName === editingUser.real_name && 
        newRoleId === editingUser.roleId) {
      return wx.showToast({
        title: '未做任何修改',
        icon: 'none'
      });
    }
    
    // 防止重复提交
    if (this.data.userSubmitting) return;
    
    this.setData({ userSubmitting: true });
    
    // 准备更新数据
    const updateData = {};
    if (newUsername !== editingUser.username) {
      updateData.username = newUsername;
    }
    if (newRealName !== editingUser.real_name) {
      updateData.real_name = newRealName;
    }
    if (newRoleId !== editingUser.roleId) {
      updateData.role_id = newRoleId;
    }
    
    // 更新用户信息
    this.updateUserInfoAndClose(editingUser.id, updateData);
  },

  // 更新用户信息并关闭弹窗
  async updateUserInfoAndClose(userId, updateData) {
    wx.showLoading({ title: '更新中...' });
    
    try {
      const app = getApp();
      const request = app.getRequest();
      
      // 在更新前，先检查是否是当前用户（使用userId比较更可靠）
      const currentUserId = wx.getStorageSync('userId');
      const isCurrentUser = currentUserId && (currentUserId == userId);
      
      // 如果没有存储userId，使用username比较（兜底逻辑）
      let isCurrentUserByUsername = false;
      if (!isCurrentUser) {
        const currentUsername = wx.getStorageSync('username');
        const editedUser = this.data.orgUsers.find(u => u.id === userId);
        isCurrentUserByUsername = editedUser && currentUsername === editedUser.username;
      }
      
      const isSelf = isCurrentUser || isCurrentUserByUsername;
      
      const response = await request.put(`/api/users/${userId}`, updateData);
      
      if (response.success) {
        // 更新本地数据
        const orgUsers = this.data.orgUsers.map(user => {
          if (user.id === userId) {
            const updatedUser = { ...user, ...updateData };
            // 如果更新了角色，需要同步更新roleId和role字段
            if (updateData.role_id) {
              updatedUser.roleId = updateData.role_id;
              updatedUser.role = this.getRoleName(updateData.role_id);
            } else {
            // 确保角色信息正确显示，统一使用getRoleName
            updatedUser.role = this.getRoleName(updatedUser.roleId);
            }
            return updatedUser;
          }
          return user;
        });
        
        // 如果修改的是当前用户，立即同步更新本地存储并刷新显示
        if (isSelf) {
          console.log('检测到修改的是当前用户，立即同步更新本地存储');
          
          // 直接更新本地存储，使用最新的数据
          if (updateData.username) {
            wx.setStorageSync('username', updateData.username);
            wx.setStorageSync('employeeId', updateData.username);
          }
          
          if (updateData.real_name) {
            wx.setStorageSync('employeeName', updateData.real_name);
            wx.setStorageSync('realName', updateData.real_name);
          }
          
          // 立即刷新页面显示
          this.loadUserInfo();
          
          console.log('本地存储已更新，页面已刷新');
        }
        
        this.setData({ 
          orgUsers,
          userSubmitting: false
        });
        
        wx.hideLoading();
        
        // 显示成功提示
        const updatedFields = [];
        if (updateData.username) updatedFields.push(`工号：${updateData.username}`);
        if (updateData.real_name) updatedFields.push(`姓名：${updateData.real_name}`);
        if (updateData.role_id) {
          const roleName = this.getRoleName(updateData.role_id);
          updatedFields.push(`角色：${roleName}`);
        }
        
        wx.showToast({ 
          title: `更新成功：${updatedFields.join('，')}`, 
          icon: 'success',
          duration: 2000
        });
        
        // 关闭弹窗
        this.closeUserEditModal();
      } else {
        throw new Error(response.message || '更新失败');
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('更新用户信息失败:', error);
      
      // 针对不同错误显示不同提示
      let errorMessage = '更新失败';
      if (error.message.includes('工号') || error.message.includes('username')) {
        errorMessage = '工号更新失败：' + (error.message || '可能是工号已存在');
      } else if (error.message.includes('姓名') || error.message.includes('real_name')) {
        errorMessage = '姓名更新失败：' + error.message;
      } else {
        errorMessage = error.message || '更新失败';
      }
      
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      });
      
      this.setData({ userSubmitting: false });
    }
  },

  // 编辑用户字段的通用方法（保留，用于其他可能的扩展）
  editUserField(user, fieldName, title, placeholder) {
    const currentValue = fieldName === 'username' ? user.username : user.real_name;
    
    wx.showModal({
      title: title,
      editable: true,
      placeholderText: placeholder,
      content: currentValue || '',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const newValue = res.content.trim();
          
          // 验证工号格式（如果是修改工号）
          if (fieldName === 'username') {
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(newValue)) {
              wx.showToast({
                title: '工号格式不正确，请输入3-20位字母数字下划线',
                icon: 'none',
                duration: 3000
              });
              return;
            }
          }
          
          // 检查是否与当前值相同
          if (newValue === currentValue) {
            wx.showToast({
              title: '内容未修改',
              icon: 'none'
            });
            return;
          }
          
          // 更新用户信息
          const updateData = {};
          updateData[fieldName] = newValue;
          this.updateUserInfo(user.id, updateData);
        }
      }
    });
  },

  // 重置用户密码
  resetUserPassword(e) {
    const { user } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '重置密码',
      content: `确定要重置用户 ${user.real_name}(${user.username}) 的密码吗？\n重置后密码将变为: 123456`,
      success: (res) => {
        if (res.confirm) {
          this.performPasswordReset(user.id);
        }
      }
    });
  },

  // 执行密码重置
  async performPasswordReset(userId) {
    wx.showLoading({ title: '重置中...' });
    
    try {
      const app = getApp();
      const request = app.getRequest();
      
      const response = await request.post(`/api/users/${userId}/reset-password`, {});
      
      if (response.success) {
        wx.hideLoading();
        wx.showModal({
          title: '密码重置成功',
          content: `新密码已重置为: ${response.data.defaultPassword || '123456'}\n用户下次登录时需要修改密码`,
          showCancel: false
        });
      } else {
        throw new Error(response.message || '重置失败');
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('重置密码失败:', error);
      wx.showToast({ 
        title: error.message || '重置失败', 
        icon: 'none' 
      });
    }
  },

  // 更新用户信息
  async updateUserInfo(userId, updateData) {
    wx.showLoading({ title: '更新中...' });
    
    try {
      const app = getApp();
      const request = app.getRequest();
      
      // 在更新前，先检查是否是当前用户（使用userId比较更可靠）
      const currentUserId = wx.getStorageSync('userId');
      const isCurrentUser = currentUserId && (currentUserId == userId);
      
      // 如果没有存储userId，使用username比较（兜底逻辑）
      let isCurrentUserByUsername = false;
      if (!isCurrentUser) {
        const currentUsername = wx.getStorageSync('username');
        const editedUser = this.data.orgUsers.find(u => u.id === userId);
        isCurrentUserByUsername = editedUser && currentUsername === editedUser.username;
      }
      
      const isSelf = isCurrentUser || isCurrentUserByUsername;
      
      const response = await request.put(`/api/users/${userId}`, updateData);
      
      if (response.success) {
        // 更新本地数据
        const orgUsers = this.data.orgUsers.map(user => {
          if (user.id === userId) {
            const updatedUser = { ...user, ...updateData };
            // 确保角色信息正确显示，统一使用getRoleName
            updatedUser.role = this.getRoleName(updatedUser.roleId);
            return updatedUser;
          }
          return user;
        });
        
        this.setData({ orgUsers });
        wx.hideLoading();
        
        // 如果修改的是当前用户，立即同步更新本地存储并刷新显示
        if (isSelf) {
          console.log('检测到修改的是当前用户，立即同步更新本地存储');
          
          // 直接更新本地存储，使用最新的数据
          if (updateData.username) {
            wx.setStorageSync('username', updateData.username);
            wx.setStorageSync('employeeId', updateData.username);
          }
          
          if (updateData.real_name) {
            wx.setStorageSync('employeeName', updateData.real_name);
            wx.setStorageSync('realName', updateData.real_name);
          }
          
          // 立即刷新页面显示
          this.loadUserInfo();
          
          console.log('本地存储已更新，页面已刷新');
        }
        
        // 根据更新的字段显示不同的成功提示
        let successMessage = '更新成功';
        if (updateData.username) {
          successMessage = `工号已更新为：${updateData.username}`;
        } else if (updateData.real_name) {
          successMessage = `姓名已更新为：${updateData.real_name}`;
        }
        
        wx.showToast({ 
          title: successMessage, 
          icon: 'success',
          duration: 2000
        });
      } else {
        throw new Error(response.message || '更新失败');
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('更新用户信息失败:', error);
      
      // 针对不同错误显示不同提示
      let errorMessage = '更新失败';
      if (error.message.includes('工号') || error.message.includes('username')) {
        errorMessage = '工号更新失败：' + (error.message || '可能是工号已存在');
      } else if (error.message.includes('姓名') || error.message.includes('real_name')) {
        errorMessage = '姓名更新失败：' + error.message;
      } else {
        errorMessage = error.message || '更新失败';
      }
      
      wx.showToast({ 
        title: errorMessage, 
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 重新获取当前用户信息（从后端获取权威数据）
  async refreshCurrentUserInfo() {
    try {
      const app = getApp();
      const request = app.getRequest();
      const token = wx.getStorageSync('token');
      const currentUsername = wx.getStorageSync('username');
      const currentOrgId = wx.getStorageSync('orgId');
      
      if (!token || !currentUsername || !currentOrgId) {
        console.warn('用户登录信息不完整，无法刷新用户信息');
        this.loadUserInfo(); // 使用本地存储的数据刷新显示
        return;
      }
      
      console.log('正在从后端重新获取用户信息...');
      
      // 通过用户列表接口获取当前用户的最新信息
      const response = await request.get('/api/users', {
        keyword: currentUsername,
        limit: 10
      });
      
      if (response.success && response.data && response.data.length > 0) {
        // 查找当前用户的数据
        const userData = response.data.find(user => 
          user.username === currentUsername && user.orgId === currentOrgId
        );
        
        if (userData) {
          console.log('从后端获取到的最新用户信息:', userData);
          
          // 更新本地存储的用户信息
          if (userData.username) {
            wx.setStorageSync('username', userData.username);
            // 同时更新employeeId，确保工号同步
            wx.setStorageSync('employeeId', userData.username);
          }
          
          if (userData.real_name) {
            wx.setStorageSync('employeeName', userData.real_name);
            wx.setStorageSync('realName', userData.real_name);
          }
          
          if (userData.orgId) wx.setStorageSync('orgId', userData.orgId);
          if (userData.orgName) {
            wx.setStorageSync('orgName', userData.orgName);
            // 公司名称等于后端的组织名称
            wx.setStorageSync('companyName', userData.orgName);
          }
          if (userData.roleId) wx.setStorageSync('roleId', userData.roleId);
          if (userData.roleName) wx.setStorageSync('userRole', userData.roleName);
          
          // 注意：现在companyName字段已经与orgName同步
          
          console.log('用户信息已从后端同步更新');
          console.log('更新后的关键字段:', {
            username: userData.username,
            employeeId: userData.username,
            realName: userData.real_name,
            orgId: userData.orgId,
            orgName: userData.orgName,
            companyName: userData.orgName
          });
          
        } else {
          console.warn('在用户列表中未找到当前用户信息');
        }
        
      } else {
        console.error('获取用户信息失败:', response.message || '未知错误');
      }
      
      // 无论是否成功获取到后端数据，都刷新页面显示
      this.loadUserInfo();
      
    } catch (error) {
      console.error('刷新用户信息时发生错误:', error);
      // 发生错误时，仍然刷新页面显示（使用本地存储的数据）
      this.loadUserInfo();
    }
  },

  // 个性化配置
  personalizeSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    });
  }
});
// 节流提示
const originalLoadUserInfo = Page.prototype.loadUserInfo;
Page.prototype.loadUserInfo = function(...args) {
  if (this._lastLoadUserInfoTime && Date.now() - this._lastLoadUserInfoTime < 1000) {
    wx.showToast({ title: '操作频繁，福生无量，稍后再试', icon: 'none' });
    return;
  }
  this._lastLoadUserInfoTime = Date.now();
  return originalLoadUserInfo.apply(this, args);
};
