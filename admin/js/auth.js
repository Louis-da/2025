// 检查用户是否已登录
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!user.userId || !user.token) {
    // 未登录，重定向到登录页
    window.location.href = 'index.html';
    return null;
  }
  
  // 检查是否是超级管理员
  if (!user.isSuperAdmin) {
    alert('您不是超级管理员，无法访问此系统');
    localStorage.clear();
    window.location.href = 'index.html';
    return null;
  }
  
  return { user };
}

// 检查用户是否已登录，不进行重定向
function isAuthenticated() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.userId && user.token && user.isSuperAdmin === true;
}

// 退出登录
function logout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

// 设置欢迎信息
function setWelcomeMessage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const welcomeEl = document.getElementById('welcomeUser');
  
  if (welcomeEl && user.username) {
    welcomeEl.textContent = `欢迎，${user.username}`;
  }
}

// 添加退出登录事件监听
function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

// API请求函数
async function apiRequest(url, method = 'GET', data = null, showErrors = true) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!user.userId || !user.token) {
    if (showErrors) {
      console.warn('用户未登录');
    }
    window.location.href = 'index.html';
    return null;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'X-App-Authorization': `Bearer ${user.token}` // 使用自定义头避免被 CloudBase 网关拦截
  };
  
  // 处理GET请求的参数
  let requestUrl = url;
  let requestBody = undefined;
  
  if (method === 'GET' && data) {
    // GET请求将参数转换为查询字符串
    const params = new URLSearchParams();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        params.append(key, data[key]);
      }
    });
    requestUrl = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
  } else if (data) {
    // 非GET请求使用body
    requestBody = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(requestUrl, {
      method,
      headers,
      body: requestBody
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      if (response.status === 401) {
        console.warn('认证失败，需要重新登录');
        localStorage.clear();
        window.location.href = 'index.html';
        return null;
      }
      
      throw new Error(result.error || '请求失败');
    }
    
    return result;
  } catch (error) {
    console.error('API请求错误:', error);
    
    if (showErrors) {
      throw error;
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 页面加载时执行
document.addEventListener('DOMContentLoaded', function() {
  const auth = checkAuth();
  
  if (auth) {
    setWelcomeMessage();
    setupLogout();
  }
});