// 基础管理页面功能
class BaseManage {
    constructor() {
        this.currentTab = 'products';
        this.data = {
            products: [],
            factories: [],
            colors: [],
            sizes: [],
            processes: []
        };
        
        this.init();
    }
    
    init() {
        console.log('初始化基础管理页面');
        this.loadTabData();
    }
    
    async loadTabData() {
        try {
            // 根据当前标签页加载对应的数据
            switch (this.currentTab) {
                case 'products':
                    await this.loadProducts();
                    break;
                case 'factories':
                    await this.loadFactories();
                    break;
                case 'colors':
                    await this.loadColors();
                    break;
                case 'sizes':
                    await this.loadSizes();
                    break;
                case 'processes':
                    await this.loadProcesses();
                    break;
            }
        } catch (error) {
            console.error('加载基础数据失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('加载数据失败: ' + error.message);
            }
        }
    }
    
    async loadProducts() {
        if (!window.API) return;
        
        try {
            const response = await API.base.products.list();
            if (response.success) {
                this.data.products = response.data || [];
                console.log('货品数据加载成功:', this.data.products.length, '条');
            }
        } catch (error) {
            console.error('加载货品数据失败:', error);
        }
    }
    
    async loadFactories() {
        if (!window.API) return;
        
        try {
            const response = await API.base.factories.list();
            if (response.success) {
                this.data.factories = response.data || [];
                console.log('工厂数据加载成功:', this.data.factories.length, '条');
            }
        } catch (error) {
            console.error('加载工厂数据失败:', error);
        }
    }
    
    async loadColors() {
        if (!window.API) return;
        
        try {
            const response = await API.base.colors.list();
            if (response.success) {
                this.data.colors = response.data || [];
                console.log('颜色数据加载成功:', this.data.colors.length, '条');
            }
        } catch (error) {
            console.error('加载颜色数据失败:', error);
        }
    }
    
    async loadSizes() {
        if (!window.API) return;
        
        try {
            const response = await API.base.sizes.list();
            if (response.success) {
                this.data.sizes = response.data || [];
                console.log('尺码数据加载成功:', this.data.sizes.length, '条');
            }
        } catch (error) {
            console.error('加载尺码数据失败:', error);
        }
    }
    
    async loadProcesses() {
        if (!window.API) return;
        
        try {
            const response = await API.base.processes.list();
            if (response.success) {
                this.data.processes = response.data || [];
                console.log('工序数据加载成功:', this.data.processes.length, '条');
            }
        } catch (error) {
            console.error('加载工序数据失败:', error);
        }
    }
    
    switchTab(tabName) {
        this.currentTab = tabName;
        this.loadTabData();
    }
}

// 导出模块
window.BaseManage = BaseManage; 