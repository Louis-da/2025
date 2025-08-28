// 用户管理页面的JavaScript - v2.0.1 (修复real_name字段)
console.log('Users.js 已加载 - v2.0.1');

// 全局变量
let users = [];
let organizations = [];
let roles = [];

// 🔧 添加定时器管理变量
let refreshTimer = null;
let visibilityListener = null;

// 🔧 分页相关变量已移除，现在所有用户按组织分组在一页显示
// 保留变量定义以防未来需要恢复分页功能
let currentPage = 1; // 保留但不再使用
let pageSize = 1000; // 设置为大值，加载所有用户
let totalPages = 1; // 保留但不再使用
let searchTerm = ''; // 搜索功能继续保留

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
  if (typeof isAuthenticated !== 'function') {
    console.warn('Auth functions not loaded yet, retrying in 100ms...');
    setTimeout(initPage, 100);
    return false;
  }
  return true;
}

// 初始化页面
function initPage() {
  if (!checkAuthLoaded()) return;
  
  // 验证用户是否已登录
  if (!isAuthenticated()) {
    window.location.href = 'index.html';
    return;
  }
  
  // 初始化移动端侧边栏
  initMobileSidebar();
  
  // 设置欢迎信息和绑定事件
  setupPageEvents();
  
  // 加载数据
  loadData();
  
  // 🔧 清理旧的定时器和事件监听器，避免重复设置
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  
  if (visibilityListener) {
    document.removeEventListener('visibilitychange', visibilityListener);
    visibilityListener = null;
  }
  
  // 设置定时自动刷新（每30秒刷新一次）
  refreshTimer = setInterval(() => {
    console.log('[用户管理] 自动刷新用户列表...');
    loadUsers();
  }, 30000); // 30秒
  
  // 添加页面可见性检测，当用户切换回页面时刷新数据
  visibilityListener = () => {
    if (!document.hidden) {
      console.log('[用户管理] 页面重新可见，刷新用户列表...');
      loadUsers();
    }
  };
  document.addEventListener('visibilitychange', visibilityListener);
}

// 设置页面事件
function setupPageEvents() {
  // 设置欢迎信息
  setWelcomeMessage();
  
  // 绑定退出按钮事件
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
  
  // 绑定添加用户按钮事件
  const addUserBtn = document.getElementById('addUserBtn');
  if (addUserBtn) {
    addUserBtn.addEventListener('click', () => openUserModal());
  }
  
  // 绑定刷新按钮事件
  const refreshUsersBtn = document.getElementById('refreshUsersBtn');
  if (refreshUsersBtn) {
    refreshUsersBtn.addEventListener('click', refreshUsersList);
  }
  
  // 绑定关闭模态框按钮事件
  const closeModal = document.getElementById('closeModal');
  if (closeModal) {
    closeModal.addEventListener('click', closeUserModal);
  }
  
  // 绑定取消按钮事件
  const cancelUserBtn = document.getElementById('cancelUserBtn');
  if (cancelUserBtn) {
    cancelUserBtn.addEventListener('click', closeUserModal);
  }
  
  // 绑定表单提交事件
  const userForm = document.getElementById('userForm');
  if (userForm) {
    userForm.addEventListener('submit', saveUser);
  }
  
  // 绑定搜索框事件
  const searchInput = document.getElementById('searchUser');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      loadUsers(); // 🔧 移除currentPage重置，直接重新加载
    });
  }
}

// 加载所有数据
async function loadData() {
  // 加载组织和角色数据
  await Promise.all([loadOrganizations(), loadRoles()]);
  
  // 加载用户列表
  loadUsers();
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', initPage);

// 加载组织列表
async function loadOrganizations() {
  try {
    // 不显示错误弹窗
    const result = await apiRequest('/api/organizations', 'GET', null, false);
    if (result && result.success) {
      organizations = Array.isArray(result.data) ? result.data : [];
      populateOrgSelect();
    } else {
      // 使用默认组织数据
      organizations = [
        { id: 1, name: '系统管理组织', org_code: 'SYS001' }
      ];
      populateOrgSelect();
    }
  } catch (error) {
    console.error('加载组织失败:', error);
    // 使用默认组织数据
    organizations = [
      { id: 1, name: '系统管理组织', org_code: 'SYS001' }
    ];
    populateOrgSelect();
  }
}

// 加载角色列表
async function loadRoles() {
  try {
    // 尝试获取角色数据 - 不显示错误弹窗
    const result = await apiRequest('/api/roles', 'GET', null, false);
    
    if (result && result.success) {
      roles = Array.isArray(result.data) ? result.data : [];
    } else {
      // 当API不存在时，使用预定义的角色数据
      console.warn('角色API不可用，使用默认角色数据');
      roles = [
        { id: 1, name: '超级管理员' },
        { id: 2, name: '老板' },
        { id: 3, name: '员工' },
        { id: 4, name: '专员' }
      ];
    }
    
    populateRoleSelect();
  } catch (error) {
    console.error('加载角色失败:', error);
    
    // 出错时使用默认角色数据，包含专员角色
    roles = [
      { id: 1, name: '超级管理员' },
      { id: 2, name: '老板' },
      { id: 3, name: '员工' },
      { id: 4, name: '专员' }
    ];
    
    populateRoleSelect();
  }
}

// 填充组织下拉框
function populateOrgSelect() {
  const orgSelect = document.getElementById('orgId');
  if (!orgSelect) return;
  
  orgSelect.innerHTML = '<option value="">请选择组织</option>';
  
  organizations.forEach(org => {
    orgSelect.innerHTML += `<option value="${org.id}">${org.name}</option>`;
  });
}

// 填充角色下拉框
function populateRoleSelect() {
  const roleSelect = document.getElementById('roleId');
  if (!roleSelect) return;
  
  roleSelect.innerHTML = '<option value="">请选择角色</option>';
  
  roles.forEach(role => {
    roleSelect.innerHTML += `<option value="${role.id}">${role.name}</option>`;
  });
}

// 加载用户列表
async function loadUsers() {
  try {
    const searchTerm = document.getElementById('searchUser')?.value || '';
    
    // 显示加载状态
    const usersTable = document.getElementById('usersTable');
    if (usersTable) {
      usersTable.innerHTML = `
        <tr>
          <td colspan="9" class="text-center loading">
            <div class="loading-spinner"></div>
            <span>加载中...</span>
          </td>
        </tr>
      `;
    }
    
    // 🔧 修改：取消分页，加载所有用户数据，按组织分组显示
    const params = {
      page: 1,
      limit: 1000, // 设置足够大的限制，加载所有用户
      keyword: searchTerm
    };
    
    // 只有超级管理员才能按组织筛选
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
    const isSuperAdmin = userInfo.isSuperAdmin === true;
    if (isSuperAdmin) {
      // 如果组织下拉框有选中的值，添加到参数中
      const orgSelect = document.getElementById('orgIdSelectFilter');
      if (orgSelect && orgSelect.value) {
        params.orgId = orgSelect.value;
      }
    }

    // 调用API获取用户列表
    const result = await apiRequest('/api/users', 'GET', params);
    
    if (result && result.success) {
      users = Array.isArray(result.data) ? result.data : [];
      
      // 🔧 新增：按组织分组并排序
      // 首先按组织编码、组织名称、工号排序
      users.sort((a, b) => {
        const orgIdA = a.orgId || '';
        const orgIdB = b.orgId || '';
        if (orgIdA !== orgIdB) {
          return orgIdA.localeCompare(orgIdB);
        }
        
        const orgNameA = a.orgName || '';
        const orgNameB = b.orgName || '';
        if (orgNameA !== orgNameB) {
          return orgNameA.localeCompare(orgNameB);
        }
        
        const usernameA = a.username || '';
        const usernameB = b.username || '';
        return usernameA.localeCompare(usernameB);
      });

      // 🔧 统计信息显示
      const totalUsers = users.length;
      const orgGroups = [...new Set(users.map(u => u.orgId))].length;
      console.log(`[用户管理] 加载完成：共 ${totalUsers} 个用户，分布在 ${orgGroups} 个组织`);

      renderUsersTable();
      
      // 🔧 修改：隐藏分页控件，因为所有用户都在一页显示
      const pagination = document.getElementById('usersPagination');
      if (pagination) {
        pagination.style.display = 'none';
      }
      
    } else {
      // 当API返回错误时，使用模拟数据
      console.warn('用户API返回错误，使用默认用户数据');
      
      users = [
        {
          id: 1,
          username: 'admin',
          real_name: '超级管理员',
          email: 'admin@example.com',
          phone: '13800138000',
          orgId: 'SYS001',
          orgName: '系统管理组织',
          roleId: 1,
          roleName: '超级管理员',
          status: 1,
          miniprogram_authorized: 1,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ];
      
      renderUsersTable();
      
      // 隐藏分页控件
      const pagination = document.getElementById('usersPagination');
      if (pagination) {
        pagination.style.display = 'none';
      }
    }
    
  } catch (error) {
    console.error('加载用户列表失败:', error);
    
    // 出错时显示错误信息
    const usersTable = document.getElementById('usersTable');
    if (usersTable) {
      let errorMessage = '加载用户数据失败';
      
      // 根据错误类型提供更具体的提示
      if (error.message) {
        if (error.message.includes('网络')) {
          errorMessage = '网络连接失败，请检查网络后重试';
        } else if (error.message.includes('权限')) {
          errorMessage = '权限不足，请联系管理员';
        } else if (error.message.includes('超时')) {
          errorMessage = '请求超时，请稍后重试';
        } else {
          errorMessage = `加载失败：${error.message}`;
        }
      }
      
      usersTable.innerHTML = `
        <tr>
          <td colspan="9" class="text-center">
            <div style="padding: 20px; color: #ff6b6b;">
              <div style="font-size: 18px; margin-bottom: 8px;">⚠️</div>
              <div>${errorMessage}</div>
              <button onclick="loadUsers()" style="margin-top: 10px; padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                重新加载
              </button>
            </div>
          </td>
        </tr>
      `;
    }
    
    // 隐藏分页控件
    const pagination = document.getElementById('usersPagination');
    if (pagination) {
      pagination.style.display = 'none';
    }
  }
}

// 渲染用户表格
function renderUsersTable() {
  const usersTable = document.getElementById('usersTable');
  
  if (!usersTable) return;
  
  if (users.length === 0) {
    usersTable.innerHTML = '<tr><td colspan="9" class="text-center">没有找到用户</td></tr>';
    return;
  }
  
  let html = '';
  let currentOrgId = null;
  
  users.forEach(user => {
    // 如果是新的组织，添加组织标题行
    if (currentOrgId !== user.orgId) {
      currentOrgId = user.orgId;
      html += `
        <tr class="org-header">
          <td colspan="9" style="background-color: #f5f5f7; font-weight: bold; padding: 12px 16px;">
            ${user.orgName || '未分配组织'}
          </td>
        </tr>
      `;
    }
    
    html += `
      <tr>
        <td>${user.id || '-'}</td>
        <td>${user.orgId || '-'}</td>
        <td>${user.orgName || '-'}</td>
        <td>${user.username || '-'}</td>
        <td>${user.real_name || '-'}</td>
        <td>${user.roleName || '-'}</td>
        <td>
          <div class="toggle-container small">
            <input type="checkbox" id="auth_${user.id}" class="toggle-input" ${user.miniprogram_authorized ? 'checked' : ''}>
            <label for="auth_${user.id}" class="toggle-label" onclick="toggleMiniprogramAuth(${user.id}, ${!user.miniprogram_authorized})"></label>
          </div>
        </td>
        <td>
          <span class="status ${user.status === 1 ? 'active' : 'disabled'}">
            ${user.status === 1 ? '已启用' : '已禁用'}
          </span>
        </td>
        <td>
          <button class="btn-icon" title="编辑用户" onclick="editUser(${user.id})">
            <span class="icon">✏️</span>
          </button>
          <button class="btn-icon" title="重置密码" onclick="resetPassword(${user.id})">
            <span class="icon">🔑</span>
          </button>
          <button class="btn-icon" title="${user.status === 1 ? '禁用' : '启用'}" onclick="toggleStatus(${user.id})">
            <span class="icon">${user.status === 1 ? '🔴' : '🟢'}</span>
          </button>
        </td>
      </tr>
    `;
  });
  
  usersTable.innerHTML = html;
}

// 🔧 分页功能已移除，现在所有用户按组织分组在一页显示
// 以下函数保留以防未来需要恢复分页功能

// 渲染分页控件（已停用）
function renderPagination() {
  // 不再使用分页，所有用户按组织分组显示
  const pagination = document.getElementById('usersPagination');
  if (pagination) {
    pagination.style.display = 'none';
  }
}

// 切换页码（已停用）
function changePage(page) {
  // 功能已停用，所有用户在一页显示
  console.log('[用户管理] 分页功能已停用，所有用户按组织分组显示');
}

// 打开用户模态框
function openUserModal(user = null) {
  const modal = document.getElementById('userModal');
  const modalTitle = document.getElementById('modalTitle');
  const userForm = document.getElementById('userForm');
  const userIdInput = document.getElementById('userId');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const passwordGroup = passwordInput.closest('.form-group');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const orgIdSelect = document.getElementById('orgId');
  const roleIdSelect = document.getElementById('roleId');
  const miniprogramAuthInput = document.getElementById('miniprogramAuth');
  const statusSelect = document.getElementById('status');
  const orgCodeGroup = document.getElementById('orgCodeGroup');
  const orgCodeInput = document.getElementById('orgCode');
  const realNameInput = document.getElementById('real_name');
  
  // 设置模态框标题
  modalTitle.textContent = user ? '编辑用户' : '新增用户';
  
  // 重置表单
  userForm.reset();
  
  // 判断是否超级管理员
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userInfo.isSuperAdmin === true;
  
  if (isSuperAdmin) {
    orgCodeGroup.style.display = '';
    // 编辑时赋值
    if (user) {
      orgCodeInput.value = user.orgId || '';
      realNameInput.value = user.real_name || '';
    } else {
      orgCodeInput.value = '';
      realNameInput.value = '';
    }
  } else {
    orgCodeGroup.style.display = 'none';
    orgCodeInput.value = '';
    realNameInput.value = '';
  }
  
  if (user) {
    // 编辑用户模式
    userIdInput.value = user.id;
    usernameInput.value = user.username || '';
    
    // 判断是否超级管理员，如果是超级管理员则允许修改工号
    if (isSuperAdmin) {
      usernameInput.readOnly = false; // 超级管理员可以修改工号
      // 添加工号修改提示
      const usernameGroup = usernameInput.closest('.form-group');
      let tipElement = usernameGroup.querySelector('.form-tip');
      if (!tipElement) {
        tipElement = document.createElement('div');
        tipElement.className = 'form-tip';
        usernameGroup.appendChild(tipElement);
      }
      tipElement.textContent = '超级管理员可以修改工号，请谨慎操作';
      tipElement.style.color = '#ff9500';
    } else {
      usernameInput.readOnly = true; // 非超级管理员禁止修改工号
    }
    
    if (user.real_name !== undefined && user.real_name !== null) {
      realNameInput.value = user.real_name;
    } else {
      realNameInput.value = realNameInput.value || '';
    }
    emailInput.value = user.email || '';
    phoneInput.value = user.phone || '';
    if (orgIdSelect) orgIdSelect.value = user.orgId || '';
    if (roleIdSelect) roleIdSelect.value = user.roleId || '';
    if (miniprogramAuthInput) {
      miniprogramAuthInput.checked = user.miniprogram_authorized === 1;
    }
    statusSelect.value = user.status;
    // 编辑时隐藏密码字段
    passwordGroup.style.display = 'none';
  } else {
    // 新增用户模式
    userIdInput.value = '';
    usernameInput.readOnly = false;
    usernameInput.value = '';
    realNameInput.value = '';
    // 设置默认密码为000000
    passwordInput.value = '000000';
    // 显示密码字段
    passwordGroup.style.display = 'block';
    // 其他字段默认值
    emailInput.value = '';
    phoneInput.value = '';
    if (miniprogramAuthInput) {
      miniprogramAuthInput.checked = true; // 默认启用小程序授权
    }
    statusSelect.value = '1'; // 默认启用状态
    
    // 清除工号提示
    const usernameGroup = usernameInput.closest('.form-group');
    const tipElement = usernameGroup.querySelector('.form-tip');
    if (tipElement) {
      tipElement.remove();
    }
  }
  
  // 显示模态框
  modal.style.display = 'block';
}

// 关闭用户模态框
function closeUserModal() {
  const modal = document.getElementById('userModal');
  modal.style.display = 'none';
}

// 编辑用户
async function editUser(id) {
  const user = users.find(u => u.id === id);
  
  if (!user) {
    console.error('未找到用户:', id);
    return;
  }
  
  openUserModal(user);
}

// 保存用户
async function saveUser(e) {
  e.preventDefault();
  console.log('开始保存用户...');
  
  const userIdInput = document.getElementById('userId');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const emailInput = document.getElementById('email');
  const phoneInput = document.getElementById('phone');
  const orgIdSelect = document.getElementById('orgId');
  const roleIdSelect = document.getElementById('roleId');
  const miniprogramAuthInput = document.getElementById('miniprogramAuth');
  const statusSelect = document.getElementById('status');
  const orgCodeInput = document.getElementById('orgCode');
  const realNameInput = document.getElementById('real_name');
  
  // 添加调试日志
  console.log('=== 开始组装用户数据 ===');
  console.log('realNameInput元素:', realNameInput);
  console.log('realNameInput值:', realNameInput ? realNameInput.value : 'null');
  console.log('所有表单元素检查:');
  console.log('- usernameInput:', usernameInput ? usernameInput.value : 'null');
  console.log('- emailInput:', emailInput ? emailInput.value : 'null');
  console.log('- phoneInput:', phoneInput ? phoneInput.value : 'null');
  
  // 获取 real_name 的值，确保不为空
  const realNameValue = realNameInput ? realNameInput.value.trim() : '';
  console.log('提取的 realNameValue:', realNameValue);
  
  // 表单验证
  if (!usernameInput.value.trim()) {
    alert('请输入用户名');
    return;
  }
  
  // 必须先选择组织
  if (!orgIdSelect.value) {
    alert('请先选择所属组织');
    orgIdSelect.focus();
    return;
  }
  
  if (!roleIdSelect.value) {
    alert('请选择角色');
    return;
  }
  
  const userId = userIdInput.value;
  let orgIdValue = '';
  
  // 判断是否超级管理员
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = userInfo.isSuperAdmin === true;
  
  if (orgCodeInput && orgCodeInput.style.display !== 'none') {
    // 如果组织编码字段显示（即超级管理员模式）
    orgIdValue = orgCodeInput.value.trim();
    if (!orgIdValue && !userId) {
      // 只在新增用户时要求必填组织编码
      alert('请填写组织编码');
      orgCodeInput.focus();
      return;
    }
    // 编辑用户时，如果组织编码为空，则保持原有组织不变
    if (!orgIdValue && userId) {
      // 获取当前选中的组织ID作为默认值
      orgIdValue = orgIdSelect.value;
    }
  } else {
    orgIdValue = orgIdSelect.value;
  }
  
  const userData = {
    username: usernameInput.value.trim(),
    real_name: realNameValue,
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim(),
    orgId: orgIdValue,
    roleId: parseInt(roleIdSelect.value),
    miniprogram_authorized: miniprogramAuthInput.checked ? 1 : 0,
    status: parseInt(statusSelect.value)
  };
  
  if (orgCodeInput) {
    userData.orgCode = orgIdValue; // 兼容后端参数
  }
  
  // 最终检查 real_name 字段
  console.log('最终 userData 检查:');
  console.log('- userData.real_name:', userData.real_name);
  console.log('- 字段是否存在:', userData.hasOwnProperty('real_name'));
  console.log('- 完整 userData:', JSON.stringify(userData, null, 2));
  
  console.log('准备提交的用户数据:', userData);
  
  if (!userId) {
    // 新增用户时需要密码
    // 如果用户没有修改，则使用默认的000000
    if (!passwordInput.value.trim()) {
      alert('请输入密码');
      return;
    }
    userData.password = passwordInput.value;
  }
  
  try {
    let result;
    
    if (userId) {
      // 更新用户
      console.log('更新用户:', userId);
      result = await apiRequest(`/api/users/${userId}`, 'PUT', userData);
    } else {
      // 创建用户
      console.log('创建新用户');
      result = await apiRequest('/api/users', 'POST', userData);
    }
    
    console.log('API响应结果:', result);
    
    if (result && result.success) {
      // 关闭模态框
      closeUserModal();
      
      // 重新加载用户列表
      loadUsers();
      
      // 显示成功消息
      alert(userId ? '用户更新成功' : '用户创建成功');
    } else {
      alert(result?.error || '操作失败');
    }
  } catch (error) {
    console.error('保存用户失败:', error);
    alert('操作失败: ' + (error.message || '请稍后再试'));
  }
}

// 重置用户密码
async function resetPassword(id) {
  const user = users.find(u => u.id === id);
  
  if (!user) {
    console.error('未找到用户:', id);
    return;
  }
  
  const newPassword = prompt(`请输入用户 ${user.username} 的新密码:`);
  
  if (!newPassword) return;
  
  if (newPassword.length < 6) {
    alert('密码长度必须至少为6个字符');
    return;
  }
  
  try {
    const result = await apiRequest(`/api/users/${id}/reset-password`, 'POST', { newPassword: newPassword });
    
    if (result && result.success) {
      alert('密码重置成功');
    } else {
      alert(result.error || '密码重置失败');
    }
  } catch (error) {
    console.error('重置密码失败:', error);
    alert('操作失败，请稍后再试');
  }
}

// 切换用户状态
async function toggleStatus(id) {
  const user = users.find(u => u.id === id);
  
  if (!user) {
    console.error('未找到用户:', id);
    return;
  }
  
  const newStatus = user.status === 1 ? 0 : 1;
  const statusText = newStatus === 1 ? '启用' : '禁用';
  
  if (!confirm(`确定要${statusText}用户 ${user.username} 吗？`)) {
    return;
  }
  
  try {
    const result = await apiRequest(`/api/users/${id}`, 'PUT', { status: newStatus });
    
    if (result && result.success) {
      // 更新本地用户数据
      user.status = newStatus;
      
      // 重新渲染表格
      renderUsersTable();
      
      alert(`用户${statusText}成功`);
    } else {
      alert(result.error || `用户${statusText}失败`);
    }
  } catch (error) {
    console.error(`${statusText}用户失败:`, error);
    alert('操作失败，请稍后再试');
  }
}

// 切换小程序授权状态
async function toggleMiniprogramAuth(id, authorized) {
  try {
    const result = await apiRequest(`/api/users/miniprogram-auth/${id}`, 'POST', { authorized });
    
    if (result && result.success) {
      // 更新本地用户数据
      const user = users.find(u => u.id === id);
      if (user) {
        user.miniprogram_authorized = authorized ? 1 : 0;
      }
      
      alert(`用户小程序授权${authorized ? '开启' : '关闭'}成功`);
    } else {
      alert(result.error || '操作失败');
      
      // 恢复复选框状态
      const checkbox = document.getElementById(`auth_${id}`);
      if (checkbox) {
        checkbox.checked = !authorized;
      }
    }
  } catch (error) {
    console.error('切换小程序授权状态失败:', error);
    alert('操作失败，请稍后再试');
    
    // 恢复复选框状态
    const checkbox = document.getElementById(`auth_${id}`);
    if (checkbox) {
      checkbox.checked = !authorized;
    }
  }
}

// 设置欢迎信息
function setWelcomeMessage() {
  const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
  const welcomeElement = document.getElementById('welcomeUser');
  if (welcomeElement && userInfo.username) {
    welcomeElement.textContent = `欢迎，${userInfo.username}`;
  }
}

// 手动刷新用户列表
async function refreshUsersList() {
  const refreshBtn = document.getElementById('refreshUsersBtn');
  
  try {
    // 显示加载状态
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = '<span class="icon">⏳</span> 刷新中...';
    }
    
    console.log('[用户管理] 手动刷新用户列表...');
    
    // 重新加载用户数据
    await loadUsers();
    
    // 显示成功提示
    console.log('[用户管理] 用户列表刷新完成');
    
    // 可选：显示toast提示
    if (typeof showToast === 'function') {
      showToast('用户列表已刷新', 'success');
    }
    
  } catch (error) {
    console.error('[用户管理] 刷新用户列表失败:', error);
    
    // 显示错误提示
    if (typeof showToast === 'function') {
      showToast('刷新失败，请稍后重试', 'error');
    } else {
      alert('刷新失败，请稍后重试');
    }
  } finally {
    // 恢复按钮状态
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<span class="icon">🔄</span> 刷新数据';
    }
  }
}

// 🔧 页面卸载时清理资源
function cleanupResources() {
  console.log('[用户管理] 清理页面资源...');
  
  // 清理定时器
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  
  // 清理事件监听器
  if (visibilityListener) {
    document.removeEventListener('visibilitychange', visibilityListener);
    visibilityListener = null;
  }
}

// 监听页面卸载事件
window.addEventListener('beforeunload', cleanupResources);
window.addEventListener('unload', cleanupResources);

// 监听页面隐藏事件（移动端）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    console.log('[用户管理] 页面隐藏，暂停自动刷新');
  }
}); 