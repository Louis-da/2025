// 云开发认证适配器
class CloudAuth {
    constructor(config) {
        this.config = config || window.CLOUD_CONFIG;
        this.tokenKey = this.config.AUTH.TOKEN_KEY;
        this.userInfoKey = this.config.AUTH.USER_INFO_KEY;
        this.orgInfoKey = this.config.AUTH.ORG_INFO_KEY;
    }

    // 登录方法
    async login(credentials) {
        try {
            const { orgCode, username, password } = credentials;
            
            console.log('[CloudAuth] 开始登录流程:', { orgCode, username });
            
            // 构建登录请求
            const loginUrl = this.config.getApiUrl('login');
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orgCode,
                    username,
                    password
                })
            });

            if (!response.ok) {
                throw new Error(`登录请求失败: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // 保存认证信息
                this.saveAuthInfo(result.data);
                console.log('[CloudAuth] 登录成功');
                return result;
            } else {
                throw new Error(result.message || '登录失败');
            }
        } catch (error) {
            console.error('[CloudAuth] 登录失败:', error);
            throw error;
        }
    }

    // 保存认证信息
    saveAuthInfo(authData) {
        const { token, user, organization } = authData;
        
        if (token) {
            localStorage.setItem(this.tokenKey, token);
        }
        
        if (user) {
            localStorage.setItem(this.userInfoKey, JSON.stringify(user));
            // 兼容原有的存储键名
            localStorage.setItem('username', user.username);
            localStorage.setItem('userName', user.username);
            localStorage.setItem('realName', user.realName || user.username);
            localStorage.setItem('userRole', user.role || 'user');
            localStorage.setItem('isSuperAdmin', user.isSuperAdmin || false);
        }
        
        if (organization) {
            localStorage.setItem(this.orgInfoKey, JSON.stringify(organization));
            // 兼容原有的存储键名
            localStorage.setItem('orgId', organization.id);
            localStorage.setItem('orgCode', organization.code);
            localStorage.setItem('orgName', organization.name);
        }
    }

    // 获取认证令牌
    getToken() {
        return localStorage.getItem(this.tokenKey) || localStorage.getItem('token');
    }

    // 获取用户信息
    getUserInfo() {
        const userInfo = localStorage.getItem(this.userInfoKey);
        if (userInfo) {
            return JSON.parse(userInfo);
        }
        
        // 兼容原有格式
        return {
            username: localStorage.getItem('username'),
            realName: localStorage.getItem('realName'),
            role: localStorage.getItem('userRole'),
            isSuperAdmin: localStorage.getItem('isSuperAdmin') === 'true'
        };
    }

    // 获取组织信息
    getOrgInfo() {
        const orgInfo = localStorage.getItem(this.orgInfoKey);
        if (orgInfo) {
            return JSON.parse(orgInfo);
        }
        
        // 兼容原有格式
        return {
            id: localStorage.getItem('orgId'),
            code: localStorage.getItem('orgCode'),
            name: localStorage.getItem('orgName')
        };
    }

    // 检查登录状态
    isLoggedIn() {
        const token = this.getToken();
        const userInfo = this.getUserInfo();
        return !!(token && userInfo && userInfo.username);
    }

    // 验证令牌
    async validateToken() {
        try {
            const token = this.getToken();
            if (!token) {
                return false;
            }

            const validateUrl = this.config.getApiUrl('auth', 'validate');
            const response = await fetch(validateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Authorization': `Bearer ${token}` // 使用自定义头避免被 CloudBase 网关拦截
                }
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('[CloudAuth] 令牌验证失败:', error);
            return false;
        }
    }

    // 退出登录
    logout() {
        // 清除云开发认证信息
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userInfoKey);
        localStorage.removeItem(this.orgInfoKey);
        
        // 清除兼容的认证信息
        const keysToRemove = [
            'token', 'username', 'userName', 'realName', 
            'userRole', 'isSuperAdmin', 'orgId', 'orgCode', 'orgName'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log('[CloudAuth] 已退出登录');
    }

    // 创建认证请求头
    getAuthHeaders() {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['X-App-Authorization'] = `Bearer ${token}`; // 使用自定义头避免被 CloudBase 网关拦截
        }
        
        return headers;
    }

    // 发送认证请求
    async request(url, options = {}) {
        const defaultOptions = {
            headers: this.getAuthHeaders()
        };
        
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, mergedOptions);
            
            // 处理认证失败
            if (response.status === 401) {
                console.warn('[CloudAuth] 认证失败，清除本地认证信息');
                this.logout();
                throw new Error('认证失败，请重新登录');
            }
            
            return response;
        } catch (error) {
            console.error('[CloudAuth] 请求失败:', error);
            throw error;
        }
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.CloudAuth = CloudAuth;
    
    // 创建默认实例
    if (window.CLOUD_CONFIG) {
        window.cloudAuth = new CloudAuth(window.CLOUD_CONFIG);
    }
}

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CloudAuth;
}