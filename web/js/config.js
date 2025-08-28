// Web端配置文件 - 修复版 v2.1 (强制刷新缓存)
const CONFIG = {
    // API配置 - 使用相对路径通过Nginx代理
    API_BASE_URL: (() => {
        const hostname = window.location.hostname;
        
        console.log('[CONFIG] 检测到的hostname:', hostname);
        console.log('[CONFIG] window.location:', window.location.href);
        
        // 如果是本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            console.log('[CONFIG] 检测为开发环境，使用localhost:3000');
            return 'http://localhost:3000';
        }
        
        // 生产环境使用同域API路径
        if (hostname === 'aiyunsf.com') {
            console.log('[CONFIG] 检测为生产环境(aiyunsf.com)，使用同域API');
            return `${window.location.protocol}//${hostname}`;
        }
        
        // 其他生产环境使用相对路径
        console.log('[CONFIG] 检测为生产环境，使用相对路径');
        return '';  // 强制空字符串表示使用相对路径
    })(),
    
    // API备用地址（用于降级）
    API_FALLBACK_URL: 'http://175.178.33.180:3000',
    
    // 应用配置
    APP_NAME: '云收发',
    APP_VERSION: '1.0.0',
    
    // 存储键名
    STORAGE_KEYS: {
        TOKEN: 'token',
        ORG_ID: 'orgId',
        ORG_CODE: 'orgCode',
        ORG_NAME: 'orgName',
        USERNAME: 'username',
        USER_NAME: 'userName',
        REAL_NAME: 'realName',
        USER_ROLE: 'userRole',
        IS_SUPER_ADMIN: 'isSuperAdmin'
    },
    
    // 请求配置
    REQUEST: {
        TIMEOUT: 30000, // 30秒超时
        RETRY_COUNT: 3, // 重试次数
        RETRY_DELAY: 1000 // 重试延迟(ms)
    },
    
    // 分页配置
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 20,
        MAX_PAGE_SIZE: 100
    },
    
    // 消息提示配置
    TOAST: {
        DURATION: 3000, // 3秒
        SUCCESS_DURATION: 2000, // 2秒
        ERROR_DURATION: 4000 // 4秒
    },
    
    // 自动刷新配置
    AUTO_REFRESH: {
        INTERVAL: 30000, // 30秒
        ENABLED: false // 默认关闭
    },
    
    // 文件上传配置
    UPLOAD: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/vnd.ms-excel']
    },
    
    // 主题配置
    THEME: {
        PRIMARY_COLOR: '#667eea',
        SECONDARY_COLOR: '#764ba2',
        SUCCESS_COLOR: '#34c759',
        WARNING_COLOR: '#ff9500',
        ERROR_COLOR: '#ff3b30',
        INFO_COLOR: '#007aff'
    },
    
    // 动画配置
    ANIMATION: {
        DURATION: 300, // 默认动画时长(ms)
        EASING: 'ease-out'
    },
    
    // 调试配置
    DEBUG: {
        ENABLED: true, // 开发环境开启调试
        LOG_LEVEL: 'info' // debug, info, warn, error
    }
};

// 环境检测
CONFIG.IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
CONFIG.IS_PRODUCTION = !CONFIG.IS_DEVELOPMENT;

// 根据环境调整配置
if (CONFIG.IS_DEVELOPMENT) {
    CONFIG.DEBUG.ENABLED = true;
    CONFIG.DEBUG.LOG_LEVEL = 'debug';
} else {
    CONFIG.DEBUG.ENABLED = false;
    CONFIG.DEBUG.LOG_LEVEL = 'error';
}

// 导出配置
window.CONFIG = CONFIG;

// 添加保护机制，防止配置被意外修改
console.log('[CONFIG] 最终的API_BASE_URL:', CONFIG.API_BASE_URL);

// 强制检查并修正API_BASE_URL
if (CONFIG.API_BASE_URL && CONFIG.API_BASE_URL.includes(':3000') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('[CONFIG] 检测到生产环境中错误的API_BASE_URL，强制修正为空字符串');
    CONFIG.API_BASE_URL = '';
}

// 冻结配置对象，防止被修改
Object.freeze(CONFIG); 