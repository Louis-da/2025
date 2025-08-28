// 组织管理页面脚本
let organizations = [];
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;
let searchTerm = '';

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

// 初始化页面
document.addEventListener('DOMContentLoaded', function() {
  // 检查登录状态
  const auth = checkAuth();
  
  if (auth) {
    // 初始化移动端侧边栏
    initMobileSidebar();
    
    // 初始化事件监听
    initEventListeners();
    
    // 加载组织列表
    loadOrganizations();
  }
});

// 初始化事件监听
function initEventListeners() {
  // 新增组织按钮
  const addOrgBtn = document.getElementById('addOrgBtn');
  if (addOrgBtn) {
    addOrgBtn.addEventListener('click', function() {
      openOrgModal();
    });
  }
  
  // 搜索框
  const searchOrg = document.getElementById('searchOrg');
  const searchBtn = document.querySelector('.search-btn');
  
  if (searchOrg && searchBtn) {
    // 搜索按钮点击
    searchBtn.addEventListener('click', function() {
      searchTerm = searchOrg.value.trim();
      currentPage = 1;
      loadOrganizations();
    });
    
    // 回车搜索
    searchOrg.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        searchTerm = searchOrg.value.trim();
        currentPage = 1;
        loadOrganizations();
      }
    });
  }
  
  // 组织表单提交
  const orgForm = document.getElementById('orgForm');
  if (orgForm) {
    orgForm.addEventListener('submit', function(e) {
      e.preventDefault();
      saveOrganization();
    });
  }
  
  // 关闭模态框
  const closeModal = document.getElementById('closeModal');
  const cancelOrgBtn = document.getElementById('cancelOrgBtn');
  
  if (closeModal && cancelOrgBtn) {
    closeModal.addEventListener('click', function() {
      closeOrgModal();
    });
    
    cancelOrgBtn.addEventListener('click', function() {
      closeOrgModal();
    });
  }
}

// 加载组织列表
async function loadOrganizations() {
  // 构建API请求URL
  let url = `/api/organizations?page=${currentPage}&limit=${pageSize}`;
  
  if (searchTerm) {
    url += `&search=${encodeURIComponent(searchTerm)}`;
  }
  
  const result = await apiRequest(url);
  
  if (result && result.success) {
    // 修复数据结构问题
    organizations = Array.isArray(result.data) ? result.data : (result.data.organizations || []);
    totalPages = result.data.totalPages || 1;
    
    renderOrganizationsTable();
    renderPagination();
  }
}

// 渲染组织表格
function renderOrganizationsTable() {
  const orgsTable = document.getElementById('orgsTable');
  
  if (!orgsTable) return;
  
  if (organizations.length === 0) {
    orgsTable.innerHTML = '<tr><td colspan="8" class="text-center">没有找到组织</td></tr>';
    return;
  }
  
  let html = '';
  
  organizations.forEach(org => {
    html += `
      <tr>
        <td>${org.id}</td>
        <td>${org.orgId || '-'}</td>
        <td>${org.name}</td>
        <td>${org.contact || '-'}</td>
        <td>${org.phone || '-'}</td>
        <td>${formatDate(org.created_at)}</td>
        <td>
          <span class="status ${org.status === 1 ? 'active' : 'disabled'}">
            ${org.status === 1 ? '已启用' : '已禁用'}
          </span>
        </td>
        <td>
          <button class="btn-icon" title="查看详情" onclick="viewOrganization(${org.id})">👁️</button>
          <button class="btn-icon" title="编辑" onclick="editOrganization(${org.id})">✏️</button>
          <button class="btn-icon ${org.status === 1 ? 'danger' : ''}" title="${org.status === 1 ? '禁用' : '启用'}" 
                  onclick="toggleOrganizationStatus(${org.id}, ${org.status === 1 ? 0 : 1})">
            ${org.status === 1 ? '🚫' : '✅'}
          </button>
        </td>
      </tr>
    `;
  });
  
  orgsTable.innerHTML = html;
}

// 渲染分页控件
function renderPagination() {
  const pagination = document.getElementById('orgsPagination');
  
  if (!pagination) return;
  
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }
  
  let html = `
    <button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">上一页</button>
    <div class="page-numbers">
  `;
  
  // 计算需要显示的页码范围
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }
  
  html += `
    </div>
    <button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">下一页</button>
  `;
  
  pagination.innerHTML = html;
}

// 切换页码
function changePage(page) {
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  loadOrganizations();
}

// 打开组织模态框
function openOrgModal(org = null) {
  const modal = document.getElementById('orgModal');
  const modalTitle = document.getElementById('modalTitle');
  const orgIdInput = document.getElementById('orgId');
  const orgCodeInput = document.getElementById('orgCode');
  const orgNameInput = document.getElementById('orgName');
  const orgAddressInput = document.getElementById('orgAddress');
  const contactPersonInput = document.getElementById('contactPerson');
  const contactPhoneInput = document.getElementById('contactPhone');
  const orgStatusSelect = document.getElementById('orgStatus');
  
  // 设置模态框标题
  modalTitle.textContent = org ? '编辑组织' : '新增组织';
  
  // 填充表单
  if (org) {
    orgIdInput.value = org.id;
    orgCodeInput.value = org.orgId || '';
    orgNameInput.value = org.name || '';
    orgAddressInput.value = org.address || '';
    contactPersonInput.value = org.contact || '';
    contactPhoneInput.value = org.phone || '';
    orgStatusSelect.value = org.status;
    
    // 编辑时组织编码不可修改（只读）
    orgCodeInput.readOnly = true;
    orgCodeInput.style.backgroundColor = '#f5f5f5';
    orgCodeInput.style.cursor = 'not-allowed';
    
    // 添加组织编码不可修改的提示
    const orgCodeGroup = orgCodeInput.closest('.form-group');
    let tipElement = orgCodeGroup.querySelector('.form-tip');
    if (!tipElement) {
      tipElement = document.createElement('div');
      tipElement.className = 'form-tip';
      orgCodeGroup.appendChild(tipElement);
    }
    tipElement.textContent = '编辑时组织编码不可修改';
    tipElement.style.color = '#666';
  } else {
    // 新增时重置表单
    orgIdInput.value = '';
    orgCodeInput.value = '';
    orgNameInput.value = '';
    orgAddressInput.value = '';
    contactPersonInput.value = '';
    contactPhoneInput.value = '';
    orgStatusSelect.value = '1';
    
    // 新增时组织编码可编辑
    orgCodeInput.readOnly = false;
    orgCodeInput.style.backgroundColor = '';
    orgCodeInput.style.cursor = '';
    
    // 清除提示
    const orgCodeGroup = orgCodeInput.closest('.form-group');
    const tipElement = orgCodeGroup.querySelector('.form-tip');
    if (tipElement) {
      tipElement.remove();
    }
  }
  
  // 显示模态框
  modal.classList.add('show');
}

// 关闭组织模态框
function closeOrgModal() {
  const modal = document.getElementById('orgModal');
  modal.classList.remove('show');
}

// 保存组织信息
async function saveOrganization() {
  const orgId = document.getElementById('orgId').value;
  const orgCode = document.getElementById('orgCode').value;
  const name = document.getElementById('orgName').value;
  const address = document.getElementById('orgAddress').value;
  const contactPerson = document.getElementById('contactPerson').value;
  const contactPhone = document.getElementById('contactPhone').value;
  const status = document.getElementById('orgStatus').value;
  
  // 验证必填字段
  if (!name) {
    alert('组织名称不能为空');
    return;
  }
  
  let orgData;
  
  if (orgId) {
    // 编辑组织时，不包含orgId字段（组织编码不可修改）
    orgData = {
      name,
      address,
      contact: contactPerson,
      phone: contactPhone,
      status: parseInt(status)
    };
  } else {
    // 新增组织时，需要验证并包含组织编码
    if (!orgCode) {
      alert('组织编码不能为空');
      return;
    }
    
    orgData = {
      orgId: orgCode,
      name,
      address,
      contact: contactPerson,
      phone: contactPhone,
      status: parseInt(status)
    };
  }
  
  let result;
  
  if (orgId) {
    // 更新组织
    result = await apiRequest(`/api/organizations/${orgId}`, 'PUT', orgData);
  } else {
    // 创建新组织
    result = await apiRequest('/api/organizations', 'POST', orgData);
  }
  
  if (result && result.success) {
    alert(orgId ? '组织更新成功' : '组织创建成功');
    closeOrgModal();
    loadOrganizations();
  }
}

// 查看组织详情
async function viewOrganization(id) {
  const org = organizations.find(o => o.id === id);
  
  if (org) {
    alert(`
      组织ID: ${org.id}
      组织编码: ${org.orgId || '-'}
      组织名称: ${org.name}
      地址: ${org.address || '-'}
      联系人: ${org.contact || '-'}
      联系电话: ${org.phone || '-'}
      状态: ${org.status === 1 ? '已启用' : '已禁用'}
      创建时间: ${formatDate(org.created_at)}
    `);
  }
}

// 编辑组织
async function editOrganization(id) {
  const org = organizations.find(o => o.id === id);
  
  if (org) {
    openOrgModal(org);
  }
}

// 切换组织状态
async function toggleOrganizationStatus(id, newStatus) {
  const org = organizations.find(o => o.id === id);
  
  if (!org) return;
  
  const action = newStatus === 1 ? '启用' : '禁用';
  const confirm = window.confirm(`确定要${action}组织 "${org.name}" 吗？`);
  
  if (!confirm) return;
  
  const result = await apiRequest(`/api/organizations/${id}/status`, 'PUT', { status: newStatus });
  
  if (result && result.success) {
    alert(`组织已${action}`);
    loadOrganizations();
  }
}

// 格式化日期
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 为模态框添加额外的样式
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 100;
      align-items: center;
      justify-content: center;
    }
    
    .modal.show {
      display: flex;
    }
    
    .modal-content {
      background-color: white;
      border-radius: var(--border-radius);
      width: 90%;
      max-width: 500px;
      box-shadow: var(--shadow);
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .modal-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-body {
      padding: 20px;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }
    
    .btn-cancel {
      background-color: #f5f5f7;
      color: var(--text-color);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 10px 16px;
      cursor: pointer;
    }
    
    .search-box {
      display: flex;
      margin-left: auto;
    }
    
    .search-box input {
      border-radius: var(--border-radius) 0 0 var(--border-radius);
      border-right: none;
    }
    
    .search-btn {
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 0 var(--border-radius) var(--border-radius) 0;
      padding: 0 16px;
      cursor: pointer;
    }
    
    .page-actions {
      display: flex;
      margin-bottom: 20px;
      align-items: center;
    }
    
    select {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: 16px;
      outline: none;
      background-color: white;
    }
  </style>
`); 