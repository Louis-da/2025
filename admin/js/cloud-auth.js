// Admin端云开发认证适配器
class AdminCloudAuth {
    constructor(config) {
        this.config = config || window.ADMIN_CLOUD_CONFIG;
        this.tokenKey = this.config.AUTH.TOKEN_KEY;
        this.userInfoKey = this.config.AUTH.USER_INFO_KEY;
        this.orgInfoKey = this.config.AUTH.ORG_INFO_KEY;
    }

    // 管理员登录方法
    async login(credentials) {
        try {
            const { orgCode, username, password } = credentials;
            
            console.log('[AdminCloudAuth] 开始管理员登录流程:', { orgCode, username });
            
            // 构建管理员登录请求
            const loginUrl = this.config.getLoginUrl();
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    orgCode,
                    username,
                    password,
                    loginType: 'admin' // 标识为管理员登录
                })
            });

            if (!response.ok) {
                throw new Error(`管理员登录请求失败: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                // 保存管理员认证信息
                this.saveAuthInfo(result.data);
                console.log('[AdminCloudAuth] 管理员登录成功');
                return result;
            } else {
                throw new Error(result.message || '管理员登录失败');
            }
        } catch (error) {
            console.error('[AdminCloudAuth] 管理员登录失败:', error);
            throw error;
        }
    }

    // 保存管理员认证信息
    saveAuthInfo(authData) {
        const { token, user, organization } = authData;
        
        if (token) {
            localStorage.setItem(this.tokenKey, token);
        }
        
        if (user) {
            localStorage.setItem(this.userInfoKey, JSON.stringify(user));
            // 兼容原有的存储键名
            localStorage.setItem('adminUsername', user.username);
            localStorage.setItem('adminRealName', user.realName || user.username);
            localStorage.setItem('adminRole', user.role || 'admin');
            localStorage.setItem('isSuperAdmin', user.isSuperAdmin || false);
        }
        
        if (organization) {
            localStorage.setItem(this.orgInfoKey, JSON.stringify(organization));
            // 兼容原有的存储键名
            localStorage.setItem('adminOrgId', organization.id);
            localStorage.setItem('adminOrgCode', organization.code);
            localStorage.setItem('adminOrgName', organization.name);
        }
    }

    // 获取管理员认证令牌
    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    // 获取管理员用户信息
    getUserInfo() {
        const userInfo = localStorage.getItem(this.userInfoKey);
        if (userInfo) {
            return JSON.parse(userInfo);
        }
        
        // 兼容原有格式
        return {
            username: localStorage.getItem('adminUsername'),
            realName: localStorage.getItem('adminRealName'),
            role: localStorage.getItem('adminRole'),
            isSuperAdmin: localStorage.getItem('isSuperAdmin') === 'true'
        };
    }

    // 获取管理员组织信息
    getOrgInfo() {
        const orgInfo = localStorage.getItem(this.orgInfoKey);
        if (orgInfo) {
            return JSON.parse(orgInfo);
        }
        
        // 兼容原有格式
        return {
            id: localStorage.getItem('adminOrgId'),
            code: localStorage.getItem('adminOrgCode'),
            name: localStorage.getItem('adminOrgName')
        };
    }

    // 检查管理员登录状态
    isLoggedIn() {
        const token = this.getToken();
        const userInfo = this.getUserInfo();
        return !!(token && userInfo && userInfo.username);
    }

    // 验证管理员权限
    async validateAdminToken() {
        try {
            const token = this.getToken();
            if (!token) {
                return false;
            }

            const validateUrl = this.config.getAuthUrl('validate');
            const response = await fetch(validateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Authorization': `Bearer ${token}` // 使用自定义头避免被 CloudBase 网关拦截
                },
                body: JSON.stringify({
                    validateType: 'admin'
                })
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return result.success && result.data.isAdmin;
        } catch (error) {
            console.error('[AdminCloudAuth] 管理员令牌验证失败:', error);
            return false;
        }
    }

    // 检查超级管理员权限
    isSuperAdmin() {
        const userInfo = this.getUserInfo();
        return userInfo && userInfo.isSuperAdmin === true;
    }

    // 管理员退出登录
    logout() {
        // 清除云开发管理员认证信息
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userInfoKey);
        localStorage.removeItem(this.orgInfoKey);
        
        // 清除兼容的管理员认证信息
        const keysToRemove = [
            'adminUsername', 'adminRealName', 'adminRole', 
            'isSuperAdmin', 'adminOrgId', 'adminOrgCode', 'adminOrgName'
        ];
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        console.log('[AdminCloudAuth] 管理员已退出登录');
    }

    // 创建管理员认证请求头
    getAuthHeaders() {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['X-App-Authorization'] = `Bearer ${token}`; // 使用自定义头避免被 CloudBase 网关拦截
            headers['X-Admin-Request'] = 'true'; // 标识为管理员请求
        }
        
        return headers;
    }

    // 发送管理员认证请求
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
            
            // 处理管理员认证失败
            if (response.status === 401) {
                console.warn('[AdminCloudAuth] 管理员认证失败，清除本地认证信息');
                this.logout();
                throw new Error('管理员认证失败，请重新登录');
            }
            
            if (response.status === 403) {
                throw new Error('权限不足，需要管理员权限');
            }
            
            return response;
        } catch (error) {
            console.error('[AdminCloudAuth] 管理员请求失败:', error);
            throw error;
        }
    }

    // 获取用户列表
    async getUsers(params = {}) {
        const url = this.config.getUsersUrl();
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        const response = await this.request(fullUrl, {
            method: 'GET'
        });
        
        return await response.json();
    }

    // 获取组织列表
    async getOrganizations(params = {}) {
        const url = this.config.getOrgsUrl();
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        
        const response = await this.request(fullUrl, {
            method: 'GET'
        });
        
        return await response.json();
    }

    // 获取系统设置
    async getSettings() {
        const url = this.config.getSettingsUrl();
        
        const response = await this.request(url, {
            method: 'GET'
        });
        
        return await response.json();
    }
}

// 创建全局实例
if (typeof window !== 'undefined') {
    window.AdminCloudAuth = AdminCloudAuth;
    
    // 创建默认实例
    if (window.ADMIN_CLOUD_CONFIG) {
        window.adminCloudAuth = new AdminCloudAuth(window.ADMIN_CLOUD_CONFIG);
    }
}

// 模块导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminCloudAuth;
}