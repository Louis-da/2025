// Web端通用工具类 - 组织数据隔离加固版

const Utils = {
    // 日志工具
    log: {
        debug: (message, data = null) => {
            if (CONFIG.DEBUG_MODE) {
                console.log(`[DEBUG] ${message}`, data);
            }
        },
        
        info: (message, data = null) => {
            console.log(`[INFO] ${message}`, data);
        },
        
        warn: (message, data = null) => {
            console.warn(`[WARN] ${message}`, data);
        },
        
        error: (message, data = null) => {
            console.error(`[ERROR] ${message}`, data);
        }
    },
    
    // 本地存储工具 - 组织隔离版
    storage: {
        /**
         * 获取存储值
         */
        get: (key, defaultValue = null) => {
            try {
                const value = localStorage.getItem(key);
                if (value === null) {
                    return defaultValue;
                }
                
                // 尝试解析JSON
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            } catch (error) {
                Utils.log.error('获取存储值失败:', { key, error });
                return defaultValue;
            }
        },
        
        /**
         * 设置存储值
         */
        set: (key, value) => {
            try {
                const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
                localStorage.setItem(key, stringValue);
                return true;
            } catch (error) {
                Utils.log.error('设置存储值失败:', { key, value, error });
                return false;
            }
        },
        
        /**
         * 删除存储值
         */
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                Utils.log.error('删除存储值失败:', { key, error });
                return false;
            }
        },
        
        /**
         * 清除所有存储
         */
        clear: () => {
            try {
                localStorage.clear();
                Utils.log.info('已清除所有本地存储');
                return true;
            } catch (error) {
                Utils.log.error('清除存储失败:', error);
                return false;
            }
        },
        
        /**
         * 获取组织隔离的存储键
         */
        getOrgKey: (key) => {
            const orgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
            if (!orgId) {
                throw new Error('组织ID缺失，无法生成组织隔离存储键');
            }
            return `${orgId}_${key}`;
        },
        
        /**
         * 获取组织隔离的存储值
         */
        getOrgData: (key, defaultValue = null) => {
            try {
                const orgKey = Utils.storage.getOrgKey(key);
                return Utils.storage.get(orgKey, defaultValue);
            } catch (error) {
                Utils.log.error('获取组织存储值失败:', { key, error });
                return defaultValue;
            }
        },
        
        /**
         * 设置组织隔离的存储值
         */
        setOrgData: (key, value) => {
            try {
                const orgKey = Utils.storage.getOrgKey(key);
                return Utils.storage.set(orgKey, value);
            } catch (error) {
                Utils.log.error('设置组织存储值失败:', { key, value, error });
                return false;
            }
        },
        
        /**
         * 删除组织隔离的存储值
         */
        removeOrgData: (key) => {
            try {
                const orgKey = Utils.storage.getOrgKey(key);
                return Utils.storage.remove(orgKey);
            } catch (error) {
                Utils.log.error('删除组织存储值失败:', { key, error });
                return false;
            }
        }
    },
    
    // 消息提示工具
    toast: {
        show: (message, type = 'info', duration = 3000) => {
            const toast = document.getElementById('messageToast');
            if (!toast) {
                Utils.log.warn('消息提示元素不存在');
                console.log('[Toast] 尝试创建动态消息提示');
                // 如果元素不存在，尝试显示原生alert作为降级
                alert(`${type.toUpperCase()}: ${message}`);
                return;
            }
            
            const toastContent = toast.querySelector('.toast-content');
            const toastIcon = toast.querySelector('.toast-icon');
            const toastText = toast.querySelector('.toast-text');
            
            if (!toastContent) {
                Utils.log.warn('消息提示子元素不存在 - toast-content');
                // 如果子元素不存在，直接在toast元素中显示文本
                toast.innerHTML = `<div class="toast-content"><span class="toast-icon"></span><span class="toast-text">${message}</span></div>`;
                const newToastIcon = toast.querySelector('.toast-icon');
                const newToastText = toast.querySelector('.toast-text');
                
                // 设置图标和样式
                const icons = {
                    success: '✅',
                    error: '❌',
                    warning: '⚠️',
                    info: 'ℹ️'
                };
                
                if (newToastIcon) newToastIcon.textContent = icons[type] || icons.info;
                if (newToastText) newToastText.textContent = message;
            } else {
                if (!toastIcon || !toastText) {
                    Utils.log.warn('消息提示子元素不存在 - icon或text');
                    // 如果缺少某些子元素，重新创建内容
                    toastContent.innerHTML = `<span class="toast-icon"></span><span class="toast-text">${message}</span>`;
                    const newToastIcon = toast.querySelector('.toast-icon');
                    const newToastText = toast.querySelector('.toast-text');
                    
                    // 设置图标和样式
                    const icons = {
                        success: '✅',
                        error: '❌',
                        warning: '⚠️',
                        info: 'ℹ️'
                    };
                    
                    if (newToastIcon) newToastIcon.textContent = icons[type] || icons.info;
                    if (newToastText) newToastText.textContent = message;
                } else {
                    // 正常情况下设置内容
                    const icons = {
                        success: '✅',
                        error: '❌',
                        warning: '⚠️',
                        info: 'ℹ️'
                    };
                    
                    toastIcon.textContent = icons[type] || icons.info;
                    toastText.textContent = message;
                }
            }
            
            // 设置样式类
            toast.className = `apple-toast ${type}`;
            toast.style.display = 'block';
            
            // 添加show类用于动画
            setTimeout(() => {
                toast.classList.add('show');
            }, 10);
            
            // 自动隐藏
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.style.display = 'none';
                }, 300); // 等待动画完成
            }, duration);
        },
        
        success: (message, duration = 3000) => {
            Utils.toast.show(message, 'success', duration);
        },
        
        error: (message, duration = 5000) => {
            Utils.toast.show(message, 'error', duration);
        },
        
        warning: (message, duration = 4000) => {
            Utils.toast.show(message, 'warning', duration);
        },
        
        info: (message, duration = 3000) => {
            Utils.toast.show(message, 'info', duration);
        }
    },
    
    // 加载提示工具
    loading: {
        show: (message = '加载中...') => {
            const overlay = document.getElementById('loadingOverlay');
            if (!overlay) {
                Utils.log.warn('加载提示元素不存在');
                return;
            }
            
            const loadingText = overlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            
            overlay.style.display = 'flex';
        },
        
        hide: () => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    },
    
    // 组织数据验证工具
    orgSecurity: {
        /**
         * 验证数据是否属于当前组织
         */
        validateDataOwnership: (data, throwError = true) => {
            const currentOrgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
            
            if (!currentOrgId) {
                const error = '当前组织ID缺失';
                if (throwError) {
                    throw new Error(error);
                }
                return { valid: false, error };
            }
            
            // 检查单个数据对象
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                if (data.orgId && data.orgId !== currentOrgId) {
                    const error = `数据组织ID不匹配: 期望 ${currentOrgId}, 实际 ${data.orgId}`;
                    Utils.log.error('组织数据隔离违规:', { currentOrgId, dataOrgId: data.orgId });
                    if (throwError) {
                        throw new Error(error);
                    }
                    return { valid: false, error };
                }
            }
            
            // 检查数组数据
            if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    const item = data[i];
                    if (item && item.orgId && item.orgId !== currentOrgId) {
                        const error = `数组项 ${i} 组织ID不匹配: 期望 ${currentOrgId}, 实际 ${item.orgId}`;
                        Utils.log.error('组织数据隔离违规:', { currentOrgId, itemOrgId: item.orgId, index: i });
                        if (throwError) {
                            throw new Error(error);
                        }
                        return { valid: false, error };
                    }
                }
            }
            
            return { valid: true, error: null };
        },
        
        /**
         * 为数据添加组织ID
         */
        addOrgId: (data) => {
            const currentOrgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
            
            if (!currentOrgId) {
                throw new Error('当前组织ID缺失，无法添加组织标识');
            }
            
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                return {
                    ...data,
                    orgId: currentOrgId
                };
            }
            
            if (Array.isArray(data)) {
                return data.map(item => ({
                    ...item,
                    orgId: currentOrgId
                }));
            }
            
            return data;
        },
        
        /**
         * 过滤掉不属于当前组织的数据
         */
        filterOrgData: (data) => {
            const currentOrgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
            
            if (!currentOrgId) {
                Utils.log.warn('当前组织ID缺失，无法过滤数据');
                return data;
            }
            
            if (Array.isArray(data)) {
                return data.filter(item => {
                    if (!item || typeof item !== 'object') {
                        return true; // 保留非对象数据
                    }
                    
                    if (!item.orgId) {
                        return true; // 保留没有组织ID的数据
                    }
                    
                    return item.orgId === currentOrgId;
                });
            }
            
            return data;
        }
    },
    
    // 格式化工具
    format: {
        /**
         * 格式化日期
         */
        date: (date, format = 'YYYY-MM-DD') => {
            if (!date) return '-';
            
            try {
                const d = new Date(date);
                if (isNaN(d.getTime())) return '-';
                
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                
                return format
                    .replace('YYYY', year)
                    .replace('MM', month)
                    .replace('DD', day)
                    .replace('HH', hours)
                    .replace('mm', minutes)
                    .replace('ss', seconds);
            } catch (error) {
                Utils.log.error('日期格式化失败:', { date, format, error });
                return '-';
            }
        },
        
        /**
         * 格式化数字
         */
        number: (num, decimals = 2) => {
            if (num === null || num === undefined || isNaN(num)) return '0';
            
            try {
                return Number(num).toFixed(decimals);
            } catch (error) {
                Utils.log.error('数字格式化失败:', { num, decimals, error });
                return '0';
            }
        },
        
        /**
         * 格式化文件大小
         */
        fileSize: (bytes) => {
            if (!bytes || bytes === 0) return '0 B';
            
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            
            return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
        }
    },
    
    // DOM操作工具
    dom: {
        /**
         * 显示元素
         */
        show: (elementOrId) => {
            try {
                const element = typeof elementOrId === 'string' 
                    ? document.getElementById(elementOrId) 
                    : elementOrId;
                
                if (element) {
                    // 为特定元素设置合适的display值
                    if (typeof elementOrId === 'string' && elementOrId === 'loginPage') {
                        element.style.display = 'flex';
                    } else if (typeof elementOrId === 'string' && elementOrId === 'mainApp') {
                        element.style.display = 'block';
                    } else {
                        // 对其他元素使用空字符串恢复CSS默认值
                        element.style.display = '';
                    }
                    return true;
                } else {
                    Utils.log.warn('要显示的元素不存在:', elementOrId);
                    return false;
                }
            } catch (error) {
                Utils.log.error('显示元素失败:', { elementOrId, error });
                return false;
            }
        },
        
        /**
         * 隐藏元素
         */
        hide: (elementOrId) => {
            try {
                const element = typeof elementOrId === 'string' 
                    ? document.getElementById(elementOrId) 
                    : elementOrId;
                
                if (element) {
                    element.style.display = 'none';
                    return true;
                } else {
                    Utils.log.warn('要隐藏的元素不存在:', elementOrId);
                    return false;
                }
            } catch (error) {
                Utils.log.error('隐藏元素失败:', { elementOrId, error });
                return false;
            }
        },
        
        /**
         * 切换元素显示状态
         */
        toggle: (elementOrId) => {
            try {
                const element = typeof elementOrId === 'string' 
                    ? document.getElementById(elementOrId) 
                    : elementOrId;
                
                if (element) {
                    if (element.style.display === 'none') {
                        return Utils.dom.show(element);
                    } else {
                        return Utils.dom.hide(element);
                    }
                } else {
                    Utils.log.warn('要切换的元素不存在:', elementOrId);
                    return false;
                }
            } catch (error) {
                Utils.log.error('切换元素显示状态失败:', { elementOrId, error });
                return false;
            }
        },
        
        /**
         * 添加CSS类
         */
        addClass: (elementOrId, className) => {
            try {
                const element = typeof elementOrId === 'string' 
                    ? document.getElementById(elementOrId) 
                    : elementOrId;
                
                if (element && className) {
                    element.classList.add(className);
                    return true;
                } else {
                    Utils.log.warn('添加CSS类失败，元素或类名无效:', { elementOrId, className });
                    return false;
                }
            } catch (error) {
                Utils.log.error('添加CSS类失败:', { elementOrId, className, error });
                return false;
            }
        },
        
        /**
         * 移除CSS类
         */
        removeClass: (elementOrId, className) => {
            try {
                const element = typeof elementOrId === 'string' 
                    ? document.getElementById(elementOrId) 
                    : elementOrId;
                
                if (element && className) {
                    element.classList.remove(className);
                    return true;
                } else {
                    Utils.log.warn('移除CSS类失败，元素或类名无效:', { elementOrId, className });
                    return false;
                }
            } catch (error) {
                Utils.log.error('移除CSS类失败:', { elementOrId, className, error });
                return false;
            }
        }
    },
    
    // 防抖和节流工具
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle: (func, limit) => {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // URL工具
    url: {
        /**
         * 获取URL参数
         */
        getParam: (name) => {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get(name);
        },
        
        /**
         * 设置URL参数
         */
        setParam: (name, value) => {
            const url = new URL(window.location);
            url.searchParams.set(name, value);
            window.history.replaceState({}, '', url);
        },
        
        /**
         * 删除URL参数
         */
        removeParam: (name) => {
            const url = new URL(window.location);
            url.searchParams.delete(name);
            window.history.replaceState({}, '', url);
        }
    },
    
    // 验证工具
    validate: {
        /**
         * 验证邮箱
         */
        email: (email) => {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },
        
        /**
         * 验证手机号
         */
        phone: (phone) => {
            const re = /^1[3-9]\d{9}$/;
            return re.test(phone);
        },
        
        /**
         * 验证组织编码
         */
        orgCode: (code) => {
            if (!code || typeof code !== 'string') return false;
            
            // 组织编码只能包含字母、数字、下划线和连字符
            const re = /^[a-zA-Z0-9_-]+$/;
            return re.test(code) && code.length >= 3 && code.length <= 50;
        }
    }
};

// 兼容性方法
const Common = {
    showMessage: Utils.toast.show,
    showLoading: Utils.loading.show,
    hideLoading: Utils.loading.hide,
    formatDate: Utils.format.date,
    formatNumber: Utils.format.number,
    debounce: Utils.debounce,
    throttle: Utils.throttle
};

// 导出工具对象
window.Utils = Utils;
window.Common = Common; 