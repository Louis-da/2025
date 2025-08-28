// AI报表页面功能
class AIReports {
    constructor() {
        this.isLoading = false;
        this.reportData = null;
        this.currentDateRange = {
            startDate: '',
            endDate: ''
        };
        
        this.init();
    }
    
    init() {
        console.log('初始化AI报表页面');
        this.initDateRange();
        this.loadReportData();
    }
    
    initDateRange() {
        // 默认显示本月数据
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        this.currentDateRange = {
            startDate: firstDay.toISOString().split('T')[0],
            endDate: lastDay.toISOString().split('T')[0]
        };
        
        console.log('初始化日期范围:', this.currentDateRange);
    }
    
    async loadReportData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            console.log('开始加载AI报表数据...');
            
            if (!window.API) {
                throw new Error('API模块未加载');
            }
            
            // 调用AI报表接口
            const response = await API.stats.aiAnalysis();
            
            if (response.success) {
                this.reportData = response.data;
                console.log('AI报表数据加载成功:', this.reportData);
                this.renderReportData();
            } else {
                throw new Error(response.message || '加载AI报表失败');
            }
            
        } catch (error) {
            console.error('加载AI报表数据失败:', error);
            this.handleLoadError(error);
        } finally {
            this.isLoading = false;
        }
    }
    
    renderReportData() {
        console.log('渲染AI报表数据');
        
        if (!this.reportData) {
            console.log('无报表数据可渲染');
            return;
        }
        
        // 这里可以添加具体的数据渲染逻辑
        // 例如更新图表、表格等UI元素
    }
    
    handleLoadError(error) {
        console.error('AI报表加载错误:', error.message);
        
        if (window.Utils && Utils.toast) {
            Utils.toast.error('加载AI报表失败: ' + error.message);
        } else if (window.Common) {
            window.Common.showMessage('加载AI报表失败: ' + error.message, 'error');
        }
    }
    
    // 刷新报表数据
    refresh() {
        console.log('刷新AI报表数据');
        this.loadReportData();
    }
    
    // 设置日期范围
    setDateRange(startDate, endDate) {
        this.currentDateRange = { startDate, endDate };
        console.log('设置日期范围:', this.currentDateRange);
        this.loadReportData();
    }
    
    // 导出报表
    async exportReport() {
        try {
            console.log('开始导出AI报表');
            
            if (window.Utils && Utils.toast) {
                Utils.toast.info('报表导出功能开发中...');
            }
            
        } catch (error) {
            console.error('导出报表失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('导出失败: ' + error.message);
            }
        }
    }
}

// 全局初始化函数
function initAIReportsPage() {
    // 检查AI报告页面容器是否存在，如果不存在则创建
    const container = document.getElementById('ai-reportsPageContent');
    if (!container) {
        console.error('找不到ai-reportsPageContent容器');
        return;
    }
    
    // 如果还没有HTML内容，先渲染基础结构
    if (!container.innerHTML.trim()) {
        container.innerHTML = `
            <div class="ai-reports-container">
                <div class="page-header">
                    <div class="page-title">
                        <span class="page-icon">🤖</span>
                        <div>
                            <h2>AI智能报告</h2>
                            <div class="page-subtitle">智能分析收发流水，发现异常和趋势</div>
                        </div>
                    </div>
                    <div class="header-actions">
                        <button class="action-btn secondary" onclick="aiReports?.refresh()">
                            <span>🔄</span>
                            刷新
                        </button>
                        <button class="action-btn primary" onclick="aiReports?.exportReport()">
                            <span>📤</span>
                            导出
                        </button>
                    </div>
                </div>
                
                <div class="ai-reports-content">
                    <div class="reports-placeholder">
                        <div class="placeholder-icon">🤖</div>
                        <div class="placeholder-title">AI智能分析</div>
                        <div class="placeholder-subtitle">正在分析您的收发数据...</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // 初始化AI报告管理器
    if (!window.aiReports) {
        window.aiReports = new AIReports();
        console.log('已初始化AI报告页面');
    }
}

// 导出模块
window.AIReports = AIReports;
window.initAIReportsPage = initAIReportsPage; 