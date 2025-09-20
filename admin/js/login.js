document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');
  
  // API基础URL配置 - 云开发环境适配
  const API_BASE_URL = (() => {
    // 检查是否有云开发配置
    if (window.ADMIN_CLOUD_CONFIG && window.ADMIN_CLOUD_CONFIG.ENV_ID) {
      console.log('[LOGIN] 使用云开发环境API');
      return window.ADMIN_CLOUD_CONFIG.getLoginUrl();
    }
    
    // 开发环境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // 纯云开发环境，API通过云函数调用，无需外部服务器
    return '';
  })();
  
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const orgCode = document.getElementById('orgCode').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    // 调试输出，便于排查参数问题
    console.log('登录请求:', { orgCode, username, hasPassword: !!password });
    
    // 清除之前的消息
    loginMessage.textContent = '';
    loginMessage.className = 'form-message';
    
    // 验证输入
    if (!orgCode || !username || !password) {
      showMessage('请输入组织编号、用户名和密码', 'error');
      return;
    }
    
    // 显示加载状态
    showMessage('登录中...', 'info');
    
    try {
      // 发送登录请求
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',  // 添加这行以支持跨域Cookie
        body: JSON.stringify({ orgCode: orgCode, username, password })
      });
      
      // 429限流友好提示
      if (response.status === 429) {
        showMessage('操作频繁，福生无量，稍后再试', 'error');
        return;
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '登录失败');
      }
      
      if (data.success && data.data) {
        // 登录成功，保存用户信息
        const user = {
          userId: data.data.userId,
          username: data.data.username,
          orgId: data.data.orgId,
          orgName: data.data.orgName,
          roleId: data.data.roleId,
          roleName: data.data.roleName,
          isSuperAdmin: data.data.isSuperAdmin,
          token: data.data.token
        };
        
        localStorage.setItem('user', JSON.stringify(user));
        showMessage('登录成功，正在跳转...', 'success');
        
        // 强制修改密码逻辑
        if (data.data.password_reset_required === 1) {
          showMessage('首次登录或密码已重置，请修改密码', 'info');
          setTimeout(() => {
            window.location.href = 'reset-password.html';
          }, 1500);
          return;
        }
        
        // 检查是否是超级管理员
        if (user.isSuperAdmin) {
          // 显示金色毛笔书法字样动画
          showBlessingAnimation(() => {
            window.location.href = 'dashboard.html';
          });
        } else {
          showMessage('您不是超级管理员，无法访问此系统', 'error');
          localStorage.removeItem('user');
        }
      } else {
        throw new Error(data.error || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      showMessage(error.message || '登录失败，请稍后重试', 'error');
      // 清除可能存在的用户信息
      localStorage.removeItem('user');
    }
  });
  
  // 显示消息函数
  function showMessage(message, type) {
    loginMessage.textContent = message;
    loginMessage.className = 'form-message ' + type;
  }
  
  // 显示金色毛笔书法字样动画
  function showBlessingAnimation(callback) {
    // 创建动画容器
    const blessingDiv = document.createElement('div');
    blessingDiv.className = 'blessing-animation';
    
    // 创建粒子效果
    const particlesDiv = document.createElement('div');
    particlesDiv.className = 'blessing-particles';
    for (let i = 0; i < 9; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particlesDiv.appendChild(particle);
    }
    
    // 创建祝福文字
    const firstLine = document.createElement('div');
    firstLine.className = 'blessing-text';
    firstLine.textContent = '紫气东来';
    
    const secondLine = document.createElement('div');
    secondLine.className = 'blessing-text second-line';
    secondLine.textContent = '福生无量';
    
    const subtitle = document.createElement('div');
    subtitle.className = 'blessing-subtitle';
    subtitle.textContent = '超级管理员登录成功';
    
    // 组装动画元素
    blessingDiv.appendChild(particlesDiv);
    blessingDiv.appendChild(firstLine);
    blessingDiv.appendChild(secondLine);
    blessingDiv.appendChild(subtitle);
    
    // 添加到页面
    document.body.appendChild(blessingDiv);
    
    // 触发动画
    setTimeout(() => {
      blessingDiv.classList.add('show');
    }, 100);
    
    // 动画结束后跳转
    setTimeout(() => {
      blessingDiv.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(blessingDiv);
        if (callback) callback();
      }, 500);
    }, 4000); // 4秒后开始淡出
  }
});