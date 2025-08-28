// 系统设置页面的JavaScript
let currentUser = null;

// 移动端侧边栏切换功能
function initMobileSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const topBar = document.querySelector('.top-bar');
  const mainContent = document.querySelector('.main-content');
  
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease-out;
  `;
  document.body.appendChild(overlay);
  
  // 添加菜单按钮点击事件
  if (topBar) {
    topBar.addEventListener('click', function(e) {
      // 检查是否点击了菜单按钮区域
      if (e.target === topBar || e.target.closest('.page-title')) {
        const rect = topBar.getBoundingClientRect();
        if (e.clientX <= 60) { // 点击左侧60px区域
          toggleSidebar();
        }
      }
    });
  }
  
  // 遮罩层点击关闭
  overlay.addEventListener('click', closeSidebar);
  
  // ESC键关闭
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && sidebar && sidebar.classList.contains('show')) {
      closeSidebar();
    }
  });
  
  function toggleSidebar() {
    if (window.innerWidth <= 600) {
      if (sidebar.classList.contains('show')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    }
  }
  
  function openSidebar() {
    sidebar.classList.add('show');
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    document.body.style.overflow = 'hidden';
  }
  
  function closeSidebar() {
    sidebar.classList.remove('show');
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    document.body.style.overflow = '';
  }
  
  // 窗口大小改变时处理
  window.addEventListener('resize', function() {
    if (window.innerWidth > 600) {
      closeSidebar();
    }
  });
}

// 确保 auth.js 已加载
function checkAuthLoaded() {
  if (typeof isAuthenticated !== 'function' || typeof apiRequest !== 'function') {
    console.warn('必要的依赖未加载，100ms后重试...');
    setTimeout(initPage, 100);
    return false;
  }
  return true;
}

// 初始化页面
async function initPage() {
  if (!checkAuthLoaded()) return;
  
  try {
    // 验证用户是否已登录
    if (!isAuthenticated()) {
      window.location.href = 'index.html';
      return;
    }
    
    // 初始化移动端侧边栏
    initMobileSidebar();
    
    // 设置欢迎信息
    setWelcomeMessage();
    
    // 加载用户信息
    await loadUserInfo();
    
    // 加载系统设置
    await loadSystemSettings();
    
    // 绑定事件
    setupEventListeners();
  } catch (error) {
    console.error('初始化页面失败:', error);
    alert('加载页面失败，请刷新重试');
  }
}

// 加载用户信息
async function loadUserInfo() {
  try {
    const userId = localStorage.getItem('userId');
    if (!userId) {
      throw new Error('未找到用户ID');
    }
    
    const result = await apiRequest(`/api/users/${userId}`, 'GET');
    
    if (result && result.success) {
      currentUser = result.data;
      
      // 更新页面显示
      updateUserInfoDisplay(currentUser);
    } else {
      throw new Error(result?.error || '加载用户信息失败');
    }
  } catch (error) {
    console.error('加载用户信息失败:', error);
    // 显示错误状态
    showErrorState();
  }
}

// 更新用户信息显示
function updateUserInfoDisplay(user) {
  const elements = {
    currentUsername: user.username,
    currentRole: user.roleName,
    currentOrg: user.orgName,
    lastLoginTime: user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '未知'
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value || '-';
    }
  });
}

// 显示错误状态
function showErrorState() {
  const elements = ['currentUsername', 'currentRole', 'currentOrg', 'lastLoginTime'];
  elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = '加载失败';
      element.style.color = '#dc3545';
    }
  });
}

// 加载系统设置
async function loadSystemSettings() {
  try {
    const result = await apiRequest('/api/settings', 'GET');
    if (result && result.success) {
      const { loginProtection, operationLog } = result.data;
      
      // 更新开关状态
      const loginProtectionSwitch = document.getElementById('loginProtection');
      const operationLogSwitch = document.getElementById('operationLog');
      
      if (loginProtectionSwitch) loginProtectionSwitch.checked = loginProtection;
      if (operationLogSwitch) operationLogSwitch.checked = operationLog;
    }
  } catch (error) {
    console.error('加载系统设置失败:', error);
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 退出登录按钮
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // 密码修改表单
  const passwordForm = document.getElementById('passwordForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', handlePasswordChange);
    
    // 添加密码输入验证
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
      newPasswordInput.addEventListener('input', validatePasswordStrength);
    }
  }
  
  // 安全设置开关
  const loginProtection = document.getElementById('loginProtection');
  if (loginProtection) {
    loginProtection.addEventListener('change', debounce(handleLoginProtectionChange, 300));
  }
  
  const operationLog = document.getElementById('operationLog');
  if (operationLog) {
    operationLog.addEventListener('change', debounce(handleOperationLogChange, 300));
  }
}

// 处理退出登录
async function handleLogout() {
  try {
    const result = await apiRequest('/api/auth/logout', 'POST');
    if (result && result.success) {
      // 清除本地存储
      localStorage.clear();
      // 跳转到登录页
      window.location.href = 'index.html';
    } else {
      throw new Error(result?.error || '退出失败');
    }
  } catch (error) {
    console.error('退出失败:', error);
    alert('退出失败，请重试');
  }
}

// 验证密码强度
function validatePasswordStrength(e) {
  const password = e.target.value;
  const strengthIndicator = document.getElementById('passwordStrength');
  
  if (!strengthIndicator) return;
  
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);
  const isLongEnough = password.length >= 6;
  
  let strength = 0;
  if (hasLetter) strength++;
  if (hasNumber) strength++;
  if (hasSpecial) strength++;
  if (isLongEnough) strength++;
  
  const strengthText = ['弱', '中等', '强', '非常强'];
  const strengthClass = ['weak', 'medium', 'strong', 'very-strong'];
  
  strengthIndicator.textContent = strengthText[strength - 1] || '太短';
  strengthIndicator.className = `password-strength ${strengthClass[strength - 1] || 'weak'}`;
}

// 处理密码修改
async function handlePasswordChange(e) {
  e.preventDefault();
  
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  try {
    // 表单验证
    if (!oldPassword || !newPassword || !confirmPassword) {
      throw new Error('请填写所有密码字段');
    }
    
    if (newPassword !== confirmPassword) {
      throw new Error('两次输入的新密码不一致');
    }
    
    if (newPassword.length < 6) {
      throw new Error('新密码长度至少6位');
    }
    
    // 检查密码复杂度
    if (!/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(newPassword)) {
      throw new Error('新密码必须包含字母和数字');
    }
    
    const result = await apiRequest('/api/users/change-password', 'POST', {
      oldPassword,
      newPassword
    });
    
    if (result && result.success) {
      alert('密码修改成功，请重新登录');
      handleLogout();
    } else {
      throw new Error(result?.error || '密码修改失败');
    }
  } catch (error) {
    console.error('修改密码失败:', error);
    alert(error.message || '操作失败，请稍后再试');
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 处理登录保护设置变更
async function handleLoginProtectionChange(e) {
  const enabled = e.target.checked;
  try {
    const result = await apiRequest('/api/settings/login-protection', 'POST', {
      enabled
    });
    
    if (!result || !result.success) {
      throw new Error(result?.error || '设置更新失败');
    }
  } catch (error) {
    console.error('更新登录保护设置失败:', error);
    // 恢复开关状态
    e.target.checked = !enabled;
    alert(error.message || '操作失败，请稍后再试');
  }
}

// 处理操作日志设置变更
async function handleOperationLogChange(e) {
  const enabled = e.target.checked;
  try {
    const result = await apiRequest('/api/settings/operation-log', 'POST', {
      enabled
    });
    
    if (!result || !result.success) {
      throw new Error(result?.error || '设置更新失败');
    }
  } catch (error) {
    console.error('更新操作日志设置失败:', error);
    // 恢复开关状态
    e.target.checked = !enabled;
    alert(error.message || '操作失败，请稍后再试');
  }
}

// 设置欢迎信息
function setWelcomeMessage() {
  const welcomeElement = document.getElementById('welcomeUser');
  const username = localStorage.getItem('username');
  
  if (welcomeElement && username) {
    welcomeElement.textContent = `欢迎，${username}`;
  }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', initPage); 