// Admin后台云开发环境配置文件
// 支持从 window.CLOUD_ENV_ID 或 process.env.CLOUD_ENV_ID 读取，默认回退到历史值
const RESOLVED_ENV_ID = (typeof window !== 'undefined' && window.CLOUD_ENV_ID)
  || (typeof process !== 'undefined' && process.env && process.env.CLOUD_ENV_ID)
  || 'cloud1-3gwlq66232d160ab';

const ADMIN_CLOUD_CONFIG = {
    // 云开发环境ID
    ENV_ID: RESOLVED_ENV_ID, // 实际的云开发环境ID
    
    // 云函数API配置
    CLOUD_FUNCTIONS: {
        // 认证相关
        LOGIN: 'login',
        AUTH: 'auth',
        
        // 业务API
        API: 'api',
        
        // 文件上传
        UPLOAD: 'upload'
    },
    
    // API基础URL构建函数
    getApiUrl: function(functionName, action = '') {
        const baseUrl = `https://${this.ENV_ID}.service.tcloudbase.com/web`;
        if (action) {
            return `${baseUrl}/${functionName}/${action}`;
        }
        return `${baseUrl}/${functionName}`;
    },
    
    // 获取云函数调用URL
    getCloudFunctionUrl: function(functionName) {
        return `https://${this.ENV_ID}.service.tcloudbase.com/web/${functionName}`;
    },
    
    // 管理员登录API
    getLoginUrl: function() {
        return this.getApiUrl('login', 'admin');
    },
    
    // 管理员认证API
    getAuthUrl: function(action = '') {
        if (action) {
            return this.getApiUrl('auth', `admin/${action}`);
        }
        return this.getApiUrl('auth', 'admin');
    },
    
    // 用户管理API
    getUsersUrl: function(action = '') {
        if (action) {
            return this.getApiUrl('api', `admin/users/${action}`);
        }
        return this.getApiUrl('api', 'admin/users');
    },
    
    // 组织管理API
    getOrgsUrl: function(action = '') {
        if (action) {
            return this.getApiUrl('api', `admin/organizations/${action}`);
        }
        return this.getApiUrl('api', 'admin/organizations');
    },
    
    // 系统设置API
    getSettingsUrl: function(action = '') {
        if (action) {
            return this.getApiUrl('api', `admin/settings/${action}`);
        }
        return this.getApiUrl('api', 'admin/settings');
    },
    
    // 请求配置
    REQUEST: {
        TIMEOUT: 30000,
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000
    },
    
    // 认证配置
    AUTH: {
        TOKEN_KEY: 'admin_cloud_token',
        USER_INFO_KEY: 'admin_cloud_user_info',
        ORG_INFO_KEY: 'admin_cloud_org_info'
    }
};

// 环境检测和配置
if (typeof window !== 'undefined') {
    // 浏览器环境
    window.ADMIN_CLOUD_CONFIG = ADMIN_CLOUD_CONFIG;
    
    // 开发环境检测
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('[ADMIN_CLOUD_CONFIG] 开发环境，使用测试云开发环境');
        // 可以在这里设置测试环境的ENV_ID
    }
    
    console.log('[ADMIN_CLOUD_CONFIG] Admin云开发配置已加载:', ADMIN_CLOUD_CONFIG.ENV_ID);
}

// 导出配置（支持模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ADMIN_CLOUD_CONFIG;
}

// 冻结配置对象
Object.freeze(ADMIN_CLOUD_CONFIG);