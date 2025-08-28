// Web端主应用逻辑
class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.isLoggedIn = false;
        this.userInfo = {};
        
        this.init();
    }
    
    init() {
        console.log('初始化Web应用');
        
        // 初始化API模块
        if (window.API && typeof window.API.init === 'function') {
            window.API.init();
        }
        
        this.checkLoginStatus();
        this.bindEvents();
        this.initCurrentYear();
        
        if (this.isLoggedIn) {
            this.showMainApp();
            this.loadUserInfo();
            this.loadDashboardData();
        } else {
            this.showLoginPage();
            // 确保未登录时不加载任何需要认证的数据
            console.log('用户未登录，跳过数据加载');
        }
    }
    
    checkLoginStatus() {
        // 🛡️ 使用安全的存储方式，避免直接调用localStorage
        const token = Utils.storage.get(CONFIG.STORAGE_KEYS.TOKEN);
        const orgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
        
        this.isLoggedIn = !!(token && orgId);
        
        if (this.isLoggedIn && window.API) {
            window.API.setAuthToken(token);
        }
    }
    
    bindEvents() {
        // 登录表单事件
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        // 导航事件
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.apple-nav-item');
            if (navItem) {
                e.preventDefault();
                const page = navItem.dataset.page;
                if (page) {
                    this.navigateToPage(page);
                }
            }
        });
        
        // 用户菜单事件
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                this.hideUserMenu();
            }
        });
    }
    
    initCurrentYear() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }
    
    async handleLogin() {
        const orgCode = document.getElementById('orgCode').value.trim();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const agreeToTerms = document.getElementById('agreeToTerms').checked;
        
        if (!orgCode || !username || !password) {
            if (window.Common) {
                window.Common.showMessage('请填写完整的登录信息', 'error');
            }
            return;
        }
        
        // 验证服务协议和隐私政策同意
        if (!agreeToTerms) {
            if (window.Common) {
                window.Common.showMessage('请先阅读并同意服务协议和隐私政策', 'error');
            } else {
                alert('请先阅读并同意服务协议和隐私政策');
            }
            return;
        }
        
        const loginBtn = document.getElementById('loginBtn');
        const btnText = loginBtn.querySelector('.btn-text');
        const spinner = loginBtn.querySelector('.loading-spinner');
        
        // 显示加载状态
        btnText.style.display = 'none';
        spinner.style.display = 'inline-block';
        loginBtn.disabled = true;
        
        try {
            const response = await window.Auth.login(orgCode, username, password);
            
            if (response.success) {
                // 🛡️ 使用安全的存储方式保存登录信息
                Utils.storage.set(CONFIG.STORAGE_KEYS.TOKEN, response.data.token);
                Utils.storage.set(CONFIG.STORAGE_KEYS.ORG_ID, response.data.orgId);
                Utils.storage.set(CONFIG.STORAGE_KEYS.ORG_NAME, response.data.orgName);
                Utils.storage.set(CONFIG.STORAGE_KEYS.USERNAME, response.data.username);
                Utils.storage.set(CONFIG.STORAGE_KEYS.USER_ROLE, response.data.role);
                
                // 设置API认证头
                if (window.API) {
                    window.API.setAuthToken(response.data.token);
                }
                
                this.isLoggedIn = true;
                this.userInfo = response.data;
                
                if (window.Common) {
                    window.Common.showMessage('登录成功', 'success');
                }
                
                // 延迟显示主应用
                setTimeout(() => {
                    this.showMainApp();
                    this.loadUserInfo();
                    this.loadDashboardData();
                }, 1000);
                
            } else {
                throw new Error(response.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            if (window.Common) {
                window.Common.showMessage('登录失败: ' + error.message, 'error');
            }
        } finally {
            // 恢复按钮状态
            btnText.style.display = 'inline';
            spinner.style.display = 'none';
            loginBtn.disabled = false;
        }
    }
    
    showLoginPage() {
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');
        
        if (loginPage) loginPage.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }
    
    showMainApp() {
        const loginPage = document.getElementById('loginPage');
        const mainApp = document.getElementById('mainApp');
        
        if (loginPage) loginPage.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        // 默认显示首页
        this.navigateToPage('dashboard');
    }
    
    navigateToPage(pageName) {
        // 隐藏所有页面
        document.querySelectorAll('.page-content').forEach(page => {
            page.classList.remove('active');
        });
        
        // 显示目标页面
        const targetPage = document.getElementById(pageName + 'Page');
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // 更新导航状态
        document.querySelectorAll('.apple-nav-item').forEach(nav => {
            nav.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-page="${pageName}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
        
        this.currentPage = pageName;
        
        // 页面特定的初始化
        this.initPageSpecificFeatures(pageName);
    }
    
    initPageSpecificFeatures(pageName) {
        // 未登录时不初始化任何需要认证的功能
        if (!this.isLoggedIn) {
            console.log('用户未登录，跳过页面特定功能初始化');
            return;
        }
        
        switch (pageName) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'base':
                this.loadBaseManageData();
                break;
            case 'send-receive':
                // 收发管理页面初始化
                this.initSendReceivePage();
                break;
            case 'send-order-form':
                // 发出单表单页面初始化
                this.initSendOrderFormPage();
                break;
            case 'receive-order-form':
                // 收回单表单页面初始化
                this.initReceiveOrderFormPage();
                break;
            case 'ai-reports':
                // AI报告页面初始化
                this.initAIReportsPage();
                break;
            case 'flow-table':
                // 流水表页面初始化
                this.initFlowTablePage();
                break;
            case 'statement':
                // 对账单页面初始化
                this.initStatementPage();
                break;
            case 'baseDetail':
                // 基础管理详情页面初始化（由具体导航函数处理）
                break;
            case 'factoryManage':
                // 🎯 工厂管理页面初始化 - 对标微信小程序功能
                this.initFactoryManagePage();
                break;
            default:
                console.log('页面切换到:', pageName);
        }
    }
    
    initSendReceivePage() {
        // 初始化收发管理页面
        setTimeout(() => {
            if (!window.sendReceiveManager) {
                window.sendReceiveManager = new SendReceiveManager();
                console.log('已初始化SendReceiveManager');
            }
        }, 50);
    }

    initSendOrderFormPage() {
        // 初始化发出单表单页面
        setTimeout(() => {
            if (typeof initSendOrderForm === 'function') {
                window.sendOrderForm = initSendOrderForm('create');
                console.log('已初始化发出单表单');
            }
        }, 50);
    }

    initReceiveOrderFormPage() {
        // 初始化收回单表单页面
        setTimeout(() => {
            if (typeof initReceiveOrderForm === 'function') {
                window.receiveOrderForm = initReceiveOrderForm('create');
                console.log('已初始化收回单表单');
            }
        }, 50);
    }
    
    initAIReportsPage() {
        // 初始化AI报告页面
        setTimeout(() => {
            if (typeof initAIReportsPage === 'function') {
                initAIReportsPage();
            }
        }, 50);
    }
    
    initFlowTablePage() {
        // 初始化流水表页面
        setTimeout(() => {
            if (typeof initFlowTablePage === 'function') {
                initFlowTablePage();
            }
        }, 50);
    }
    
    initStatementPage() {
        // 初始化对账单页面
        setTimeout(() => {
            if (typeof initStatementPage === 'function') {
                initStatementPage();
            }
        }, 50);
    }
    
    initFactoryManagePage() {
        // 🎯 初始化工厂管理页面 - 对标微信小程序功能
        setTimeout(() => {
            if (typeof initFactoryManagePage === 'function') {
                window.factoryManage = initFactoryManagePage();
                console.log('已初始化工厂管理页面');
            }
        }, 50);
    }
    
    async loadUserInfo() {
        const userName = document.getElementById('userName');
        const orgName = document.getElementById('orgName');
        const avatarText = document.getElementById('avatarText');
        
        // 🛡️ 使用安全的存储方式获取用户信息
        const username = Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME) || '用户';
        const orgNameStr = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_NAME) || '组织';
        
        if (userName) userName.textContent = username;
        if (orgName) orgName.textContent = orgNameStr;
        if (avatarText) avatarText.textContent = username.charAt(0).toUpperCase();
    }
    
    async loadDashboardData() {
        if (this.currentPage !== 'dashboard') return;
        
        // 强制验证组织认证状态
        if (!Auth.requireAuth()) {
            return;
        }
        
        try {
            // 使用组织安全的API调用
            const response = await API.stats.today();
            
            if (response.success) {
                const data = response.data;
                
                // 验证返回数据的组织归属
                Utils.orgSecurity.validateDataOwnership(data, false);
                
                // 更新今日数据显示
                const todaySendWeight = document.getElementById('todaySendWeight');
                const todaySendCount = document.getElementById('todaySendCount');
                const todayReceiveWeight = document.getElementById('todayReceiveWeight');
                const todayReceiveCount = document.getElementById('todayReceiveCount');
                
                if (todaySendWeight) {
                    todaySendWeight.textContent = Utils.format.number(data.sendWeight || 0) + 'kg';
                }
                if (todaySendCount) {
                    todaySendCount.textContent = (data.sendCount || 0) + '单';
                }
                if (todayReceiveWeight) {
                    todayReceiveWeight.textContent = Utils.format.number(data.receiveWeight || 0) + 'kg';
                }
                if (todayReceiveCount) {
                    todayReceiveCount.textContent = (data.receiveCount || 0) + '单';
                }
            }
        } catch (error) {
            console.error('加载首页数据失败:', error);
            Utils.toast.error('加载首页数据失败');
        }
    }
    
    async loadBaseManageData() {
        if (this.currentPage !== 'base') return;
        
        // 强制验证组织认证状态
        if (!Auth.requireAuth()) {
            return;
        }
        
        try {
            // 并行加载各种统计数据 - 使用组织安全的API调用
            const [productRes, factoryRes, colorRes, sizeRes, processRes] = await Promise.all([
                API.base.products.count(),
                API.base.factories.count(),
                API.base.colors.count(),
                API.base.sizes.count(),
                API.base.processes.count()
            ]);
            
            // 更新统计数字
            if (productRes.success) {
                Utils.orgSecurity.validateDataOwnership(productRes.data, false);
                const productCount = document.getElementById('productCount');
                if (productCount) productCount.textContent = productRes.data.count || 0;
            }
            
            if (factoryRes.success) {
                Utils.orgSecurity.validateDataOwnership(factoryRes.data, false);
                const factoryCount = document.getElementById('factoryCount');
                if (factoryCount) factoryCount.textContent = factoryRes.data.count || 0;
            }
            
            if (colorRes.success) {
                Utils.orgSecurity.validateDataOwnership(colorRes.data, false);
                const colorCount = document.getElementById('colorCount');
                if (colorCount) colorCount.textContent = colorRes.data.count || 0;
            }
            
            if (sizeRes.success) {
                Utils.orgSecurity.validateDataOwnership(sizeRes.data, false);
                const sizeCount = document.getElementById('sizeCount');
                if (sizeCount) sizeCount.textContent = sizeRes.data.count || 0;
            }
            
            if (processRes.success) {
                Utils.orgSecurity.validateDataOwnership(processRes.data, false);
                const processCount = document.getElementById('processCount');
                if (processCount) processCount.textContent = processRes.data.count || 0;
            }
        } catch (error) {
            console.error('加载基础管理数据失败:', error);
            Utils.toast.error('加载基础管理数据失败');
        }
    }
    
    toggleUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    }
    
    hideUserMenu() {
        const dropdown = document.getElementById('userDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    showProfile() {
        this.hideUserMenu();
        this.navigateToPage('profile');
    }
    
    logout() {
        if (confirm('确定要退出登录吗？')) {
            // 🛡️ 使用安全的存储清除方式
            Utils.storage.clear();
            
            // 重置状态
            this.isLoggedIn = false;
            this.userInfo = {};
            
            // 清除API认证头
            if (window.API) {
                window.API.setAuthToken(null);
            }
            
            // 显示登录页面
            this.showLoginPage();
            
            if (window.Common) {
                window.Common.showMessage('已退出登录', 'info');
            }
        }
    }
}

// 全局导航函数
function navigateToAI() {
    if (window.app) {
        window.app.navigateToPage('ai-reports');
    }
}

function navigateToSendOrder() {
    if (window.app) {
        // 导航到发出单新增页面
        window.app.navigateToPage('send-order-form');
    }
}

function navigateToReceiveOrder() {
    if (window.app) {
        // 导航到收回单新增页面
        window.app.navigateToPage('receive-order-form');
    }
}

function navigateToFlowTable() {
    if (window.app) {
        window.app.navigateToPage('flow-table');
    }
}

function navigateToStatement() {
    if (window.app) {
        window.app.navigateToPage('statement');
    }
}

function navigateToProductManage() {
    if (window.app) {
        window.app.navigateToPage('baseDetail');
        // 初始化货品管理页面
        setTimeout(() => {
            window.baseDetailManager = new BaseManageDetail('products');
        }, 100);
    }
}

function navigateToFactoryManage() {
    if (window.app) {
        // 🎯 导航到专用的工厂管理页面，对标微信小程序功能
        window.app.navigateToPage('factoryManage');
    }
}

function navigateToColorManage() {
    if (window.app) {
        window.app.navigateToPage('baseDetail');
        // 初始化颜色管理页面
        setTimeout(() => {
            window.baseDetailManager = new BaseManageDetail('colors');
        }, 100);
    }
}

function navigateToSizeManage() {
    if (window.app) {
        window.app.navigateToPage('baseDetail');
        // 初始化尺码管理页面
        setTimeout(() => {
            window.baseDetailManager = new BaseManageDetail('sizes');
        }, 100);
    }
}

function navigateToProcessManage() {
    if (window.app) {
        window.app.navigateToPage('baseDetail');
        // 初始化工序管理页面
        setTimeout(() => {
            window.baseDetailManager = new BaseManageDetail('processes');
        }, 100);
    }
}

function toggleUserMenu() {
    if (window.app) {
        window.app.toggleUserMenu();
    }
}

function showProfile() {
    if (window.app) {
        window.app.showProfile();
    }
}

function logout() {
    if (window.app) {
        window.app.logout();
    }
}

function showHelp() {
    if (window.Common) {
        window.Common.showMessage('如需帮助，请联系超级管理员', 'info');
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', function() {
    window.app = new App();
}); 