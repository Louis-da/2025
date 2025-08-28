// Dashboard页面脚本
const Dashboard = {
    init() {
        console.log('Dashboard页面初始化');
        this.loadTodayStats();
    },
    
    async loadTodayStats() {
        try {
            // 加载今日统计数据
            const today = new Date().toISOString().split('T')[0];
            
            // 模拟数据加载
            document.getElementById('todaySendWeight').textContent = '0.00kg';
            document.getElementById('todaySendCount').textContent = '0单';
            document.getElementById('todayReceiveWeight').textContent = '0.00kg';
            document.getElementById('todayReceiveCount').textContent = '0单';
            
        } catch (error) {
            console.error('加载今日统计数据失败:', error);
            Utils.toast.error('加载数据失败');
        }
    }
};

// 导航函数
function navigateToAI() {
    if (window.app) {
        window.app.navigateToPage('ai-reports');
    }
}

function navigateToSendOrder() {
    if (window.app) {
        window.app.navigateToPage('send-order-form');
    }
}

function navigateToReceiveOrder() {
    if (window.app) {
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