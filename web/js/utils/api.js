// Web端API请求模块 - 组织数据隔离加固版

const API = {
    // 当前使用的API地址
    currentBaseUrl: CONFIG.API_BASE_URL,
    
    // 初始化时添加调试信息
    init: () => {
        console.log('[API] 初始化 - 基础URL:', API.currentBaseUrl);
        console.log('[API] 当前hostname:', window.location.hostname);
        console.log('[API] 当前协议:', window.location.protocol);
        console.log('[API] 完整地址:', window.location.href);
        
        // 强制清除任何可能缓存的错误API地址
        if (typeof localStorage !== 'undefined') {
            // 清除可能的缓存项
            localStorage.removeItem('api_base_url');
            localStorage.removeItem('apiBaseUrl');
            localStorage.removeItem('API_BASE_URL');
            localStorage.removeItem('baseUrl');
            localStorage.removeItem('serverUrl');
            
            // 如果发现任何包含3000端口的缓存项，清除它们
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                if (value && typeof value === 'string' && value.includes(':3000')) {
                    console.warn('[API] 清除包含3000端口的缓存项:', key, value);
                    localStorage.removeItem(key);
                    i--; // 因为删除了一项，索引需要回退
                }
            }
        }
        
        // 强制重新设置currentBaseUrl
        API.currentBaseUrl = CONFIG.API_BASE_URL;
        console.log('[API] 重新设置后的基础URL:', API.currentBaseUrl);
    },
    
    /**
     * 基础请求方法 - 强制组织数据隔离
     */
    request: async (url, method = 'GET', data = null, options = {}) => {
        try {
            Utils.log.debug('API请求:', { url, method, data, options });
            
            // 对于登录请求，跳过认证检查
            const isLoginRequest = url.includes('/auth/login');
            
            // 检查是否在登录页面，如果在登录页面且不是登录请求，则跳过认证检查
            const loginPage = document.getElementById('loginPage');
            const isOnLoginPage = loginPage && loginPage.style.display !== 'none';
            
            if (!isLoginRequest && !isOnLoginPage) {
                // 强制验证组织认证状态
                const authStatus = Auth.checkAuthStatus();
                if (!authStatus.isValid) {
                    Auth.forceRelogin(authStatus.error);
                    throw new Error('认证失败: ' + authStatus.error);
                }
            }
            
            // 如果在登录页面且不是登录请求，直接拒绝请求
            if (!isLoginRequest && isOnLoginPage) {
                throw new Error('在登录页面不能发起非登录API请求');
            }
            
            // 构建完整URL
            let fullUrl;
            if (url.startsWith('http')) {
                fullUrl = url;
            } else {
                if (API.currentBaseUrl === '') {
                    fullUrl = `/api${url.startsWith('/') ? url : '/' + url}`;
                } else {
                    fullUrl = `${API.currentBaseUrl}/api${url.startsWith('/') ? url : '/' + url}`;
                }
            }
            
            Utils.log.debug('构建的URL:', fullUrl);
            
            // 构建请求配置
            const config = {
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...options.headers
                },
                ...options
            };
            
            // 对于非登录请求，添加认证头和组织ID
            if (!isLoginRequest) {
                const authStatus = Auth.checkAuthStatus();
                config.headers['X-App-Authorization'] = `Bearer ${authStatus.token}`; // 使用自定义头避免被 CloudBase 网关拦截
                config.headers['token'] = authStatus.token;
                config.headers['X-Org-Id'] = authStatus.orgId; // 强制添加组织ID头
            }
            
            // 处理请求数据
            let requestData = data;
            if (!isLoginRequest && data && typeof data === 'object') {
                // 确保所有非登录请求都包含组织ID
                const authStatus = Auth.checkAuthStatus();
                requestData = {
                    ...data,
                    orgId: authStatus.orgId
                };
                
                // 验证关键操作的组织ID一致性
                if (data.orgId && data.orgId !== authStatus.orgId) {
                    throw new Error('组织ID不匹配，拒绝请求');
                }
            }
            
            // 添加请求体
            if (requestData && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
                config.body = JSON.stringify(requestData);
            }
            
            // 对于GET请求（非登录），将组织ID添加到查询参数
            if (!isLoginRequest && config.method === 'GET' && !url.includes('orgId=')) {
                const authStatus = Auth.checkAuthStatus();
                const separator = fullUrl.includes('?') ? '&' : '?';
                fullUrl += `${separator}orgId=${encodeURIComponent(authStatus.orgId)}`;
            }
            
            // 发送请求
            const response = await fetch(fullUrl, config);
            
            Utils.log.debug('API响应状态:', response.status);
            
            // 处理认证失败
            if (response.status === 401) {
                Utils.log.warn('认证失败，清除登录状态');
                Auth.logout();
                throw new Error('认证失败，请重新登录');
            }
            
            // 处理权限不足
            if (response.status === 403) {
                Utils.log.warn('权限不足或组织数据隔离违规');
                throw new Error('权限不足或数据访问违规');
            }
            
            // 处理其他HTTP错误
            if (!response.ok) {
                const errorText = await response.text();
                Utils.log.error('HTTP错误:', { status: response.status, text: errorText });
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            // 解析响应
            const result = await response.json();
            Utils.log.debug('API响应数据:', result);
            
            // 验证响应数据的组织归属（如果包含组织信息且非登录请求）
            if (!isLoginRequest && result.data && Array.isArray(result.data)) {
                const authStatus = Auth.checkAuthStatus();
                result.data.forEach(item => {
                    if (item.orgId && item.orgId !== authStatus.orgId) {
                        Utils.log.error('数据隔离违规:', { itemOrgId: item.orgId, userOrgId: authStatus.orgId });
                        throw new Error('数据隔离违规，检测到跨组织数据');
                    }
                });
            } else if (!isLoginRequest && result.data && result.data.orgId) {
                const authStatus = Auth.checkAuthStatus();
                if (result.data.orgId !== authStatus.orgId) {
                    Utils.log.error('数据隔离违规:', { dataOrgId: result.data.orgId, userOrgId: authStatus.orgId });
                    throw new Error('数据隔离违规，检测到跨组织数据');
                }
            }
            
            return result;
            
        } catch (error) {
            Utils.log.error('API请求失败:', error);
            
            // 网络错误处理
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查网络设置或服务器状态');
            }
            
            throw error;
        }
    },
    
    /**
     * GET请求 - 组织隔离版
     */
    get: (url, options = {}) => {
        return API.request(url, 'GET', null, options);
    },
    
    /**
     * POST请求 - 组织隔离版
     */
    post: (url, data, options = {}) => {
        // 添加调试日志 - 专门针对登录请求
        if (url.includes('/auth/login')) {
            console.log('=== 前端登录请求调试（组织隔离版API） ===');
            console.log('URL:', url);
            console.log('发送的data:', data);
            console.log('data类型:', typeof data);
            console.log('data序列化:', JSON.stringify(data));
            console.log('=== 前端登录请求调试结束 ===');
        }
        return API.request(url, 'POST', data, options);
    },
    
    /**
     * PUT请求 - 组织隔离版
     */
    put: (url, data, options = {}) => {
        return API.request(url, 'PUT', data, options);
    },
    
    /**
     * DELETE请求 - 组织隔离版
     */
    delete: (url, options = {}) => {
        return API.request(url, 'DELETE', null, options);
    },
    
    /**
     * 文件上传 - 组织隔离版
     */
    upload: async (url, file, options = {}) => {
        try {
            // 强制验证组织认证状态
            const authStatus = Auth.checkAuthStatus();
            if (!authStatus.isValid) {
                Auth.forceRelogin(authStatus.error);
                throw new Error('认证失败: ' + authStatus.error);
            }
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('orgId', authStatus.orgId); // 强制添加组织ID
            
            // 构建完整URL
            let fullUrl;
            if (url.startsWith('http')) {
                fullUrl = url;
            } else {
                if (API.currentBaseUrl === '') {
                    fullUrl = `/api${url.startsWith('/') ? url : '/' + url}`;
                } else {
                    fullUrl = `${API.currentBaseUrl}/api${url.startsWith('/') ? url : '/' + url}`;
                }
            }
            
            const config = {
                method: 'POST',
                body: formData,
                headers: {
                    'X-App-Authorization': `Bearer ${authStatus.token}`, // 使用自定义头避免被 CloudBase 网关拦截
                    'token': authStatus.token,
                    'X-Org-Id': authStatus.orgId,
                    ...options.headers
                }
            };
            
            const response = await fetch(fullUrl, config);
            
            if (!response.ok) {
                throw new Error(`上传失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            // 验证上传结果的组织归属
            if (result.data && result.data.orgId && result.data.orgId !== authStatus.orgId) {
                throw new Error('文件上传组织隔离违规');
            }
            
            return result;
            
        } catch (error) {
            Utils.log.error('文件上传失败:', error);
            throw error;
        }
    },
    
    /**
     * 设置认证token
     */
    setAuthToken: (token) => {
        // 这个方法保持兼容性，但实际认证状态由Auth模块管理
        Utils.log.debug('设置认证token');
    },
    
    // 组织安全的API端点
    auth: {
        /**
         * 用户登录
         */
        login: (credentials) => {
            // 登录请求不需要组织验证，但需要包含组织信息
            // 构建URL - 与其他API请求保持一致的逻辑
            let loginUrl;
            if (API.currentBaseUrl === '') {
                loginUrl = `/api/auth/login`;
            } else {
                loginUrl = `${API.currentBaseUrl}/api/auth/login`;
            }
            
            return fetch(loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(credentials)
            }).then(response => {
                if (!response.ok) {
                    throw new Error(`登录失败: ${response.status}`);
                }
                return response.json();
            });
        },
        
        /**
         * 用户登出
         */
        logout: () => {
            const authStatus = Auth.checkAuthStatus();
            if (!authStatus.isValid) {
                return Promise.resolve({ success: true });
            }
            
            return API.post('/auth/logout');
        }
    },
    
    // 组织相关API
    organizations: {
        /**
         * 获取组织列表（仅限当前用户组织）
         */
        list: () => {
            return API.get('/organizations');
        },
        
        /**
         * 获取当前组织详情
         */
        current: () => {
            const authStatus = Auth.checkAuthStatus();
            if (!authStatus.isValid) {
                throw new Error('认证失败');
            }
            return API.get(`/organizations/${authStatus.orgId}`);
        }
    },
    
    // 订单相关API - 强制组织隔离
    orders: {
        /**
         * 获取订单列表
         */
        list: (params = {}) => {
            return API.get('/orders', { params });
        },
        
        /**
         * 获取订单详情
         */
        detail: (orderId) => {
            return API.get(`/orders/${orderId}`);
        },
        
        /**
         * 创建订单
         */
        create: (orderData) => {
            return API.post('/orders', orderData);
        },
        
        /**
         * 更新订单
         */
        update: (orderId, orderData) => {
            return API.put(`/orders/${orderId}`, orderData);
        },
        
        /**
         * 作废订单
         */
        cancel: (orderId, data = {}) => {
            return API.post(`/orders/${orderId}/cancel`, data);
        },
        
        /**
         * 删除订单
         */
        delete: (orderId) => {
            return API.delete(`/orders/${orderId}`);
        },
        
        /**
         * 导出订单
         */
        export: (params = {}) => {
            return API.get('/orders/export', { params });
        }
    },
    
    // 发出单相关API - 强制组织隔离
    sendOrders: {
        /**
         * 获取发出单列表
         */
        list: (params = {}) => {
            return API.get('/send-orders', { params });
        },
        
        /**
         * 获取发出单详情
         */
        detail: (orderId) => {
            return API.get(`/send-orders/${orderId}`);
        },
        
        /**
         * 创建发出单
         */
        create: (orderData) => {
            return API.post('/send-orders', orderData);
        },
        
        /**
         * 更新发出单
         */
        update: (orderId, orderData) => {
            return API.put(`/send-orders/${orderId}`, orderData);
        },
        
        /**
         * 作废发出单
         */
        cancel: (orderId) => {
            return API.delete(`/send-orders/${orderId}`);
        }
    },
    
    // 收回单相关API - 强制组织隔离
    receiveOrders: {
        /**
         * 获取收回单列表
         */
        list: (params = {}) => {
            return API.get('/receive-orders', { params });
        },
        
        /**
         * 获取收回单详情
         */
        detail: (orderId) => {
            return API.get(`/receive-orders/${orderId}`);
        },
        
        /**
         * 创建收回单
         */
        create: (orderData) => {
            return API.post('/receive-orders', orderData);
        },
        
        /**
         * 更新收回单
         */
        update: (orderId, orderData) => {
            return API.put(`/receive-orders/${orderId}`, orderData);
        },
        
        /**
         * 作废收回单
         */
        cancel: (orderId) => {
            return API.delete(`/receive-orders/${orderId}`);
        }
    },
    
    // 统计数据API - 强制组织隔离
    stats: {
        /**
         * 获取今日统计
         */
        today: () => {
            return API.get('/stats/today');
        },
        
        /**
         * 获取AI分析数据
         */
        aiAnalysis: () => {
            return API.get('/stats/ai-analysis');
        }
    },
    
    // 基础数据API - 强制组织隔离
    base: {
        /**
         * 货品管理
         */
        products: {
            list: () => API.get('/products'),
            create: (data) => API.post('/products', data),
            update: (id, data) => API.put(`/products/${id}`, data),
            delete: (id) => API.delete(`/products/${id}`),
            count: async () => {
                try {
                    // 尝试使用stats端点
                    const response = await API.get('/products/stats');
                    if (response.success && response.data) {
                        return {
                            success: true,
                            data: { count: response.data.totalCount || 0 }
                        };
                    }
                } catch (error) {
                    console.warn('产品stats端点不可用，从列表计算数量');
                }
                
                // 备选方案：从列表数据计算
                try {
                    const response = await API.get('/products');
                    if (response.success && Array.isArray(response.data)) {
                        return {
                            success: true,
                            data: { count: response.data.length }
                        };
                    }
                } catch (error) {
                    console.error('获取产品数量失败:', error);
                }
                
                return { success: false, data: { count: 0 } };
            }
        },
        
        /**
         * 工厂管理
         */
        factories: {
            list: () => API.get('/factories'),
            create: (data) => API.post('/factories', data),
            update: (id, data) => API.put(`/factories/${id}`, data),
            delete: (id) => API.delete(`/factories/${id}`),
            count: async () => {
                try {
                    // 尝试使用stats端点
                    const response = await API.get('/factories/stats');
                    if (response.success && response.data) {
                        return {
                            success: true,
                            data: { count: response.data.totalCount || 0 }
                        };
                    }
                } catch (error) {
                    console.warn('工厂stats端点不可用，从列表计算数量');
                }
                
                // 备选方案：从列表数据计算
                try {
                    const response = await API.get('/factories');
                    if (response.success && Array.isArray(response.data)) {
                        return {
                            success: true,
                            data: { count: response.data.length }
                        };
                    }
                } catch (error) {
                    console.error('获取工厂数量失败:', error);
                }
                
                return { success: false, data: { count: 0 } };
            }
        },
        
        /**
         * 颜色管理
         */
        colors: {
            list: () => API.get('/colors'),
            create: (data) => API.post('/colors', data),
            update: (id, data) => API.put(`/colors/${id}`, data),
            delete: (id) => API.delete(`/colors/${id}`),
            count: async () => {
                // 从列表数据计算数量
                try {
                    const response = await API.get('/colors');
                    if (response.success && Array.isArray(response.data)) {
                        return {
                            success: true,
                            data: { count: response.data.length }
                        };
                    }
                } catch (error) {
                    console.error('获取颜色数量失败:', error);
                }
                
                return { success: false, data: { count: 0 } };
            }
        },
        
        /**
         * 尺码管理
         */
        sizes: {
            list: () => API.get('/sizes'),
            create: (data) => API.post('/sizes', data),
            update: (id, data) => API.put(`/sizes/${id}`, data),
            delete: (id) => API.delete(`/sizes/${id}`),
            count: async () => {
                // 从列表数据计算数量
                try {
                    const response = await API.get('/sizes');
                    if (response.success && Array.isArray(response.data)) {
                        return {
                            success: true,
                            data: { count: response.data.length }
                        };
                    }
                } catch (error) {
                    console.error('获取尺码数量失败:', error);
                }
                
                return { success: false, data: { count: 0 } };
            }
        },
        
        /**
         * 工序管理
         */
        processes: {
            list: () => API.get('/processes'),
            create: (data) => API.post('/processes', data),
            update: (id, data) => API.put(`/processes/${id}`, data),
            delete: (id) => API.delete(`/processes/${id}`),
            count: async () => {
                // 从列表数据计算数量
                try {
                    const response = await API.get('/processes');
                    if (response.success && Array.isArray(response.data)) {
                        return {
                            success: true,
                            data: { count: response.data.length }
                        };
                    }
                } catch (error) {
                    console.error('获取工序数量失败:', error);
                }
                
                return { success: false, data: { count: 0 } };
            }
        }
    }
};

// 导出API对象
window.API = API;