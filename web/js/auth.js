// Web端认证模块

const Auth = {
    /**
     * 检查用户登录状态
     */
    checkAuthStatus: () => {
        const token = Utils.storage.get(CONFIG.STORAGE_KEYS.TOKEN);
        const orgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
        
        if (!token) {
            return {
                isValid: false,
                token: '',
                orgId: '',
                error: '登录已过期，请重新登录'
            };
        }
        
        if (!orgId) {
            return {
                isValid: false,
                token: token,
                orgId: '',
                error: '组织信息缺失，请重新登录'
            };
        }
        
        return {
            isValid: true,
            token: token,
            orgId: orgId,
            error: ''
        };
    },

    /**
     * 用户登录
     */
    login: async (orgCode, username, password) => {
        try {
            Utils.log.info('开始登录:', { orgCode, username });
            
            // 验证输入
            if (!orgCode || !username || !password) {
                throw new Error('组织编码、工号和密码不能为空');
            }
            
            // 发送登录请求
            const response = await API.auth.login({
                orgCode: orgCode,
                orgId: orgCode,
                username: username,
                password: password
            });
            
            if (response.success && response.data && response.data.token) {
                // 保存登录信息
                const userData = response.data;
                
                Utils.storage.set(CONFIG.STORAGE_KEYS.TOKEN, userData.token);
                Utils.storage.set(CONFIG.STORAGE_KEYS.ORG_CODE, userData.orgCode || orgCode);
                Utils.storage.set(CONFIG.STORAGE_KEYS.ORG_ID, userData.orgId || userData.org_id || userData.orgCode || orgCode);
                Utils.storage.set(CONFIG.STORAGE_KEYS.USERNAME, username);
                
                if (userData.realName) {
                    Utils.storage.set(CONFIG.STORAGE_KEYS.REAL_NAME, userData.realName);
                }
                if (userData.orgName) {
                    Utils.storage.set(CONFIG.STORAGE_KEYS.ORG_NAME, userData.orgName);
                }
                if (userData.roleName) {
                    Utils.storage.set(CONFIG.STORAGE_KEYS.USER_ROLE, userData.roleName);
                }
                
                Utils.storage.set(CONFIG.STORAGE_KEYS.IS_SUPER_ADMIN, !!(userData.isSuperAdmin));
                
                Utils.log.info('登录成功:', {
                    username,
                    orgId: userData.orgId || userData.org_id,
                    orgName: userData.orgName,
                    roleName: userData.roleName
                });
                
                return {
                    success: true,
                    data: userData
                };
            } else {
                throw new Error(response.message || '组织编码、工号或密码错误');
            }
            
        } catch (error) {
            Utils.log.error('登录失败:', error);
            throw error;
        }
    },

    /**
     * 用户登出
     */
    logout: async (showMessage = true) => {
        try {
            // 尝试调用后端登出接口
            try {
                await API.auth.logout();
            } catch (error) {
                Utils.log.warn('后端登出失败:', error);
            }
            
            // 清除本地存储
            Utils.storage.clear();
            
            // 显示登录页面
            Auth.showLoginPage();
            
            if (showMessage) {
                Utils.toast.info('已退出登录');
            }
            
            Utils.log.info('用户已登出');
            
        } catch (error) {
            Utils.log.error('登出失败:', error);
            // 即使登出失败，也要清除本地状态
            Utils.storage.clear();
            Auth.showLoginPage();
        }
    },

    /**
     * 强制重新登录
     */
    forceRelogin: (message = '请重新登录') => {
        // 检查当前是否已经在登录页面，如果是则不显示提示
        const loginPage = document.getElementById('loginPage');
        const isOnLoginPage = loginPage && loginPage.style.display !== 'none';
        
        // 如果已经在登录页面，则静默处理，不显示错误提示
        if (isOnLoginPage) {
            Utils.log.info('用户已在登录页面，跳过登录过期提示');
            Auth.showLoginPage();
            return;
        }
        
        // 只有在主应用页面时才显示登录过期提示
        Utils.toast.error(message);
        setTimeout(() => {
            Auth.logout(false);
        }, 1000);
    },

    /**
     * 验证并获取组织ID
     */
    validateAndGetOrgId: () => {
        const authStatus = Auth.checkAuthStatus();
        
        if (!authStatus.isValid) {
            Auth.forceRelogin(authStatus.error);
            return null;
        }
        
        return authStatus.orgId;
    },

    /**
     * 验证API请求参数
     */
    validateApiParams: (data = {}) => {
        const authStatus = Auth.checkAuthStatus();
        
        if (!authStatus.isValid) {
            throw new Error(authStatus.error);
        }
        
        // 确保请求参数包含组织ID
        return {
            ...data,
            orgId: authStatus.orgId
        };
    },

    /**
     * 页面级别的认证检查
     */
    requireAuth: () => {
        const authStatus = Auth.checkAuthStatus();
        
        if (!authStatus.isValid) {
            Auth.forceRelogin(authStatus.error);
            return false;
        }
        
        return true;
    },

    /**
     * 获取用户信息
     */
    getUserInfo: () => {
        return {
            token: Utils.storage.get(CONFIG.STORAGE_KEYS.TOKEN),
            orgId: Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID),
            orgCode: Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_CODE),
            orgName: Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_NAME),
            username: Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME),
            realName: Utils.storage.get(CONFIG.STORAGE_KEYS.REAL_NAME),
            userRole: Utils.storage.get(CONFIG.STORAGE_KEYS.USER_ROLE),
            isSuperAdmin: Utils.storage.get(CONFIG.STORAGE_KEYS.IS_SUPER_ADMIN, false)
        };
    },

    /**
     * 🎯 更新用户信息显示 - 优化显示逻辑和用户体验
     */
    updateUserDisplay: () => {
        const userInfo = Auth.getUserInfo();
        
        console.log('[Auth] 更新用户信息显示:', userInfo);
        
        // 🎯 更新主导航栏的用户名显示
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            const displayName = userInfo.realName || userInfo.username || '用户';
            userNameEl.textContent = displayName;
            userNameEl.title = `${displayName} (${userInfo.username})`;
        }
        
        // 🎯 更新主导航栏的组织名显示
        const orgNameEl = document.getElementById('orgName');
        if (orgNameEl) {
            const displayOrgName = userInfo.orgName || userInfo.orgCode || '组织';
            orgNameEl.textContent = displayOrgName;
            orgNameEl.title = `组织编码: ${userInfo.orgCode}`;
        }
        
        // 🎯 更新用户角色显示
        const userRoleEl = document.getElementById('userRole');
        if (userRoleEl && userInfo.userRole) {
            userRoleEl.textContent = userInfo.userRole;
            userRoleEl.style.display = 'block';
        } else if (userRoleEl) {
            userRoleEl.style.display = 'none';
        }
        
        // 🎯 更新头像文字
        const avatarTextEl = document.getElementById('avatarText');
        if (avatarTextEl) {
            const name = userInfo.realName || userInfo.username || '用';
            const avatarText = name.charAt(0).toUpperCase();
            avatarTextEl.textContent = avatarText;
            avatarTextEl.title = `${name}的头像`;
        }
        
        // 🎯 更新下拉菜单中的用户信息（如果存在）
        const dropdownUserNameEl = document.getElementById('dropdownUserName');
        if (dropdownUserNameEl) {
            dropdownUserNameEl.textContent = userInfo.realName || userInfo.username || '用户';
        }
        
        const dropdownOrgNameEl = document.getElementById('dropdownOrgName');
        if (dropdownOrgNameEl) {
            dropdownOrgNameEl.textContent = userInfo.orgName || userInfo.orgCode || '组织';
        }
        
        // 🎯 如果是超级管理员，添加标识
        if (userInfo.isSuperAdmin) {
            const userRoleEl = document.getElementById('userRole');
            if (userRoleEl) {
                userRoleEl.textContent = '🔰 ' + (userInfo.userRole || '超级管理员');
                userRoleEl.style.display = 'block';
                userRoleEl.style.color = '#10b981';
            }
        }
    },

    /**
     * 显示登录页面
     */
    showLoginPage: () => {
        Utils.dom.hide('mainApp');
        Utils.dom.show('loginPage');
        
        // 清除表单
        const form = document.getElementById('loginForm');
        if (form) {
            form.reset();
        }
        
        // 恢复保存的登录信息
        const savedOrgCode = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_CODE);
        const savedUsername = Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME);
        
        if (savedOrgCode) {
            const orgCodeInput = document.getElementById('orgCode');
            if (orgCodeInput) {
                orgCodeInput.value = savedOrgCode;
            }
        }
        
        if (savedUsername) {
            const usernameInput = document.getElementById('username');
            if (usernameInput) {
                usernameInput.value = savedUsername;
            }
        }
    },

    /**
     * 显示主应用页面
     */
    showMainApp: () => {
        Utils.dom.hide('loginPage');
        Utils.dom.show('mainApp');
        
        // 更新用户信息显示
        Auth.updateUserDisplay();
    },

    /**
     * 初始化认证状态
     */
    init: () => {
        Utils.log.info('初始化认证状态');
        
        // 检查登录状态
        const authStatus = Auth.checkAuthStatus();
        
        if (authStatus.isValid) {
            Utils.log.info('用户已登录，显示主应用');
            Auth.showMainApp();
        } else {
            Utils.log.info('用户未登录，显示登录页面');
            Auth.showLoginPage();
        }
        
        // 设置当前年份
        const currentYearEl = document.getElementById('currentYear');
        if (currentYearEl) {
            currentYearEl.textContent = new Date().getFullYear();
        }
    },

    /**
     * 刷新Token（如果需要）
     */
    refreshToken: async () => {
        try {
            const response = await API.auth.refreshToken();
            
            if (response.success && response.data && response.data.token) {
                Utils.storage.set(CONFIG.STORAGE_KEYS.TOKEN, response.data.token);
                Utils.log.info('Token刷新成功');
                return true;
            }
            
            return false;
            
        } catch (error) {
            Utils.log.error('Token刷新失败:', error);
            return false;
        }
    }
};

// 导出认证模块
window.Auth = Auth; 