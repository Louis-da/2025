// 云开发环境配置文件
// 支持从 window.CLOUD_ENV_ID 或 process.env.CLOUD_ENV_ID 读取，默认回退到历史值
const RESOLVED_ENV_ID = (typeof window !== 'undefined' && window.CLOUD_ENV_ID)
  || (typeof process !== 'undefined' && process.env && process.env.CLOUD_ENV_ID)
  || 'cloud1-3gwlq66232d160ab';

const CLOUD_CONFIG = {
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
        UPLOAD: 'upload',
        
        // 订单管理
        ORDERS: 'orders',
        
        // 流水记录
        FLOW_RECORDS: 'flow-records',
        
        // 报表统计
        STATEMENTS: 'statements',
        
        // AI分析
        AI_ANALYSIS: 'ai-analysis',
        AI_REPORTS: 'ai-reports'
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
    
    // 云存储配置
    STORAGE: {
        BUCKET: 'cloud-storage', // 云存储桶名称
        getFileUrl: function(fileId) {
            return `https://${CLOUD_CONFIG.ENV_ID}.tcb.qcloud.la/${fileId}`;
        }
    },
    
    // 请求配置
    REQUEST: {
        TIMEOUT: 30000,
        RETRY_COUNT: 3,
        RETRY_DELAY: 1000
    },
    
    // 认证配置
    AUTH: {
        TOKEN_KEY: 'cloud_token',
        USER_INFO_KEY: 'cloud_user_info',
        ORG_INFO_KEY: 'cloud_org_info'
    }
};

// 环境检测和配置
if (typeof window !== 'undefined') {
    // 浏览器环境
    window.CLOUD_CONFIG = CLOUD_CONFIG;
    
    // 开发环境检测
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('[CLOUD_CONFIG] 开发环境，使用测试云开发环境');
        // 可以在这里设置测试环境的ENV_ID
    }
    
    console.log('[CLOUD_CONFIG] 云开发配置已加载:', CLOUD_CONFIG.ENV_ID);
}

// 导出配置（支持模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CLOUD_CONFIG;
}

// 冻结配置对象
Object.freeze(CLOUD_CONFIG);