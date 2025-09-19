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

// 加载统计数据
async function loadStats() {
  try {
    // 尝试获取统计数据 - 不显示错误弹窗
    // 注意：修改为使用存在的API端点
    const statsData = await apiRequest('/api/users', 'GET', null, false);
    
    // 如果API请求成功，处理返回的数据
    if (statsData && statsData.success) {
      // 计算简单统计数据
      const users = statsData.data || [];
      const activeUsers = users.filter(user => user.status === 1);
      
      // 更新统计卡片
      document.getElementById('userCount').textContent = users.length || 0;
      document.getElementById('activeUsers').textContent = activeUsers.length || 0;
    } else {
      // 失败时显示默认值
      document.getElementById('userCount').textContent = '-';
      document.getElementById('activeUsers').textContent = '-';
    }
    
    // 尝试获取组织数据 - 不显示错误弹窗
    const orgsData = await apiRequest('/api/organizations', 'GET', null, false);
    
    if (orgsData && orgsData.success) {
      const orgs = Array.isArray(orgsData.data) ? orgsData.data : [];
      document.getElementById('orgCount').textContent = orgs.length || 0;
    } else {
      document.getElementById('orgCount').textContent = '-';
    }
    
    // 修复：获取累计登录统计而不是在线用户数
    try {
      const loginStatsData = await apiRequest('/api/stats/login-stats', 'GET', { range: 'month' }, false);
      
      if (loginStatsData && loginStatsData.success) {
        document.getElementById('loginCount').textContent = loginStatsData.data.loginCount || 0;
      } else {
        // 备选方案：尝试获取在线用户数
        const onlineData = await apiRequest('/api/stats/online-users', 'GET', null, false);
        
        if (onlineData && onlineData.success) {
          document.getElementById('loginCount').textContent = onlineData.data.onlineCount || 0;
        } else {
          document.getElementById('loginCount').textContent = '-';
        }
      }
    } catch (loginError) {
      console.warn('获取登录统计失败:', loginError);
      document.getElementById('loginCount').textContent = '-';
    }
    
  } catch (error) {
    console.error('获取统计数据失败:', error);
    
    // 出错时显示默认值
    document.getElementById('orgCount').textContent = '-';
    document.getElementById('userCount').textContent = '-';
    document.getElementById('activeUsers').textContent = '-';
    document.getElementById('loginCount').textContent = '-';
  }
}

// 加载操作日志
async function loadLogs() {
  try {
    // 由于日志API不存在，我们直接显示一条消息
    const logsTable = document.getElementById('logsTable');
    logsTable.innerHTML = '<tr><td colspan="6" class="text-center">日志功能尚未实现</td></tr>';
    
    /* 
    // 保留原始代码以供将来实现 - 不显示错误弹窗
    const logsData = await apiRequest('/api/logs', 'GET', null, false);
    
    if (logsData && logsData.success) {
      const logs = logsData.data || [];
      
      if (logs.length === 0) {
        logsTable.innerHTML = '<tr><td colspan="6" class="text-center">暂无日志记录</td></tr>';
        return;
      }
      
      let html = '';
      logs.forEach(log => {
        html += `
          <tr>
            <td>${formatDate(log.created_at)}</td>
            <td>${log.username}</td>
            <td>${log.organization || '-'}</td>
            <td>${log.action}</td>
            <td>${log.details}</td>
            <td><span class="status active">正常</span></td>
          </tr>
        `;
      });
      
      logsTable.innerHTML = html;
    }
    */
  } catch (error) {
    console.error('获取日志数据失败:', error);
    
    const logsTable = document.getElementById('logsTable');
    logsTable.innerHTML = '<tr><td colspan="6" class="text-center">加载日志数据失败</td></tr>';
  }
}

// 格式化日期
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return dateStr || '-';
  }
}

// 初始化页面
function initPage() {
  // 检查登录状态
  const auth = checkAuth();
  
  if (auth) {
    // 初始化移动端侧边栏
    initMobileSidebar();
    
    // 加载数据
    loadStats();
    loadLogs();
  }
}

// 页面加载时执行
// 确保所有脚本都加载完成后再初始化
window.addEventListener('load', function() {
  // 添加一个小延迟确保所有脚本都已执行
  setTimeout(initPage, 50);
});