// 收发管理页面功能
class SendReceiveManager {
    constructor() {
        this.activeTab = 'send';
        this.currentPage = 1;
        this.pageSize = 20;
        this.hasMoreData = true;
        this.isLoading = false;
        this.orders = [];
        this.searchQuery = '';
        this.filters = {
            startDate: '',
            endDate: '',
            factoryId: '',
            processId: '',
            status: 'all',
            productCode: ''
        };
        this.statistics = {
            totalSendQuantity: 0,
            totalSendWeight: 0,
            totalReceiveQuantity: 0,
            totalReceiveWeight: 0
        };
        
        this.init();
    }
    
    init() {
        this.renderPage();
        this.bindEvents();
        this.setDefaultFilters();
        this.loadOrderData();
        this.loadFactories();
        this.loadProcesses();
    }
    
    renderPage() {
        const container = document.getElementById('send-receivePageContent');
        if (!container) {
            console.error('找不到send-receivePageContent容器');
            return;
        }
        
        container.innerHTML = `
            <div class="send-receive-container">
                <!-- 导航选项卡 -->
                <div class="card tabs-card">
                    <div class="tabs">
                        <div class="tab active" data-tab="send" onclick="switchOrderTab(this)">发出单</div>
                        <div class="tab" data-tab="receive" onclick="switchOrderTab(this)">收回单</div>
                    </div>
                </div>

                <!-- 报表入口 -->
                <div class="card report-card">
                    <div class="report-entry">
                        <div class="report-item" onclick="navigateToFlowTable()">
                            <div class="report-icon">📋</div>
                            <div class="report-text">收发流水表</div>
                        </div>
                        <div class="report-item" onclick="navigateToStatement()">
                            <div class="report-icon">📊</div>
                            <div class="report-text">对账单</div>
                        </div>
                    </div>
                </div>

                <!-- 搜索栏 -->
                <div class="card search-card">
                    <div class="search-container">
                        <div class="search-box">
                            <div class="search-icon">🔍</div>
                            <input class="search-input" placeholder="搜索单号、工厂" id="orderSearchInput" />
                            <div class="search-clear" onclick="clearSearch()" style="display: none;" id="searchClear">✕</div>
                        </div>
                        <div class="filter-btn" onclick="openFilter()">
                            <div class="filter-icon">🔽</div>
                        </div>
                    </div>
                </div>
                
                <!-- 订单列表 -->
                <div class="card order-list-card">
                    <div class="order-list" id="orderList">
                        <!-- 空状态 -->
                        <div class="empty-list" id="orderEmptyState" style="display: none;">
                            <div class="empty-icon">📋</div>
                            <div class="empty-text">暂无数据</div>
                        </div>
                        <!-- 订单项容器 -->
                        <div class="order-items-container" id="orderItemsContainer">
                            <!-- 订单项将通过JavaScript动态生成 -->
                        </div>
                    </div>
                </div>

                <!-- 新增按钮 -->
                <div class="add-button" onclick="navigateToAdd()">
                    <div class="add-icon">+</div>
                </div>
                
                <!-- 底部统计信息 -->
                <div class="bottom-statistics" id="bottomStatistics">
                    <!-- 发出单统计 -->
                    <div class="statistics-content send-statistics" id="sendStatistics" style="display: block;">
                        <div class="stat-item">
                            <span class="stat-label">共</span>
                            <span class="stat-value" id="totalSendCount">0</span>
                            <span class="stat-unit">单</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">数量</span>
                            <span class="stat-value" id="totalSendQuantity">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">重量</span>
                            <span class="stat-value" id="totalSendWeight">0</span>
                            <span class="stat-unit">kg</span>
                        </div>
                    </div>
                    
                    <!-- 收回单统计 -->
                    <div class="statistics-content receive-statistics" id="receiveStatistics" style="display: none;">
                        <div class="stat-item">
                            <span class="stat-label">共</span>
                            <span class="stat-value" id="totalReceiveCount">0</span>
                            <span class="stat-unit">单</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">数量</span>
                            <span class="stat-value" id="totalReceiveQuantity">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">重量</span>
                            <span class="stat-value" id="totalReceiveWeight">0</span>
                            <span class="stat-unit">kg</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">金额</span>
                            <span class="stat-value" id="totalAmount">¥0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">支付</span>
                            <span class="stat-value" id="totalPayment">¥0</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 筛选弹窗 -->
            <div class="filter-modal" id="filterModal">
                <div class="filter-overlay" onclick="closeFilter()"></div>
                <div class="filter-content">
                    <div class="filter-header">
                        <div class="filter-title">筛选条件</div>
                        <div class="filter-close" onclick="closeFilter()">✕</div>
                    </div>
                    <div class="filter-body">
                        <!-- 日期范围 -->
                        <div class="filter-section">
                            <div class="filter-label">日期范围</div>
                            <div class="date-range">
                                <input type="date" class="date-picker" id="filterStartDate" />
                                <div class="date-separator">至</div>
                                <input type="date" class="date-picker" id="filterEndDate" />
                            </div>
                        </div>
                        
                        <!-- 工厂选择 -->
                        <div class="filter-section">
                            <div class="filter-label">工厂</div>
                            <select class="filter-picker" id="filterFactory">
                                <option value="">选择工厂</option>
                            </select>
                        </div>
                        
                        <!-- 工序选择 -->
                        <div class="filter-section">
                            <div class="filter-label">工序</div>
                            <select class="filter-picker" id="filterProcess">
                                <option value="">选择工序</option>
                            </select>
                        </div>
                        
                        <!-- 货号输入 -->
                        <div class="filter-section">
                            <div class="filter-label">货号</div>
                            <input type="text" class="filter-input" placeholder="输入货号" id="filterProductCode" />
                        </div>
                        
                        <!-- 状态选择 -->
                        <div class="filter-section">
                            <div class="filter-label">状态</div>
                            <select class="filter-picker" id="filterStatus">
                                <option value="all">全部</option>
                                <option value="normal">正常</option>
                                <option value="canceled">已作废</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="filter-footer">
                        <button class="filter-reset" onclick="resetFilter()">重置</button>
                        <button class="filter-apply" onclick="applyFilter()">确定</button>
                    </div>
                </div>
            </div>
        `;
        
        console.log('收发管理页面HTML结构已渲染（小程序风格）');
    }
    
    bindEvents() {
        // 搜索功能
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.inputSearch(e.target.value);
            }, 300));
        }
        
        // 移除了滚动监听器，因为小程序风格不需要无限滚动
        console.log('[SendReceive] 事件绑定完成（小程序风格）');
    }
    
    setDefaultFilters() {
        const today = new Date();
        const todayStr = this.formatDate(today);
        this.filters.startDate = todayStr;
        this.filters.endDate = todayStr;
    }
    
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    async loadOrderData() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            // 构建查询参数
            const params = {
                page: this.currentPage,
                limit: this.pageSize,
                ...this.filters
            };
            
            if (this.searchQuery) {
                params.search = this.searchQuery;
            }
            
            console.log(`[SendReceive] 开始加载订单数据，activeTab: ${this.activeTab}, page: ${this.currentPage}`);
            
            let sendOrders = [];
            let receiveOrders = [];
            let counts = { send: 0, receive: 0 };
            
            if (this.activeTab === 'all' || this.activeTab === 'send') {
                try {
                    const sendResponse = await API.sendOrders.list(params);
                    console.log('[SendReceive] 发出单API响应:', sendResponse);
                    
                    if (sendResponse.success) {
                        // 修复：验证返回数据格式，支持多种API返回格式
                        const sendData = sendResponse.data;
                        if (Array.isArray(sendData)) {
                            // 直接数组格式
                            sendOrders = sendData.map(order => ({
                                ...order,
                                type: 'send'
                            }));
                        } else if (sendData && Array.isArray(sendData.records)) {
                            // 分页格式：{records: [], total: 61, page: 1, pageSize: 20}
                            sendOrders = sendData.records.map(order => ({
                                ...order,
                                type: 'send'
                            }));
                            // 更新分页信息（仅当是发出单标签页时）
                            if (this.activeTab === 'send') {
                                this.hasMoreData = sendData.records.length === this.pageSize;
                            }
                        } else if (sendData && Array.isArray(sendData.orders)) {
                            // 另一种分页格式：{orders: [], total: 61}
                            sendOrders = sendData.orders.map(order => ({
                                ...order,
                                type: 'send'
                            }));
                        } else {
                            console.warn('[SendReceive] 发出单返回数据格式异常:', sendData);
                            sendOrders = [];
                        }
                        counts.send = sendOrders.length;
                    } else {
                        console.error('[SendReceive] 发出单API调用失败:', sendResponse.message);
                    }
                } catch (error) {
                    console.error('加载发出单失败:', error);
                    Utils.toast.error('加载发出单失败: ' + (error.message || '网络错误'));
                }
            }
            
            if (this.activeTab === 'all' || this.activeTab === 'receive') {
                try {
                    const receiveResponse = await API.receiveOrders.list(params);
                    console.log('[SendReceive] 收回单API响应:', receiveResponse);
                    
                    if (receiveResponse.success) {
                        // 修复：验证返回数据格式，支持多种API返回格式
                        const receiveData = receiveResponse.data;
                        if (Array.isArray(receiveData)) {
                            // 直接数组格式
                            receiveOrders = receiveData.map(order => ({
                                ...order,
                                type: 'receive'
                            }));
                        } else if (receiveData && Array.isArray(receiveData.records)) {
                            // 分页格式：{records: [], total: 86, page: 1, pageSize: 20}
                            receiveOrders = receiveData.records.map(order => ({
                                ...order,
                                type: 'receive'
                            }));
                            // 更新分页信息（仅当是收回单标签页时）
                            if (this.activeTab === 'receive') {
                                this.hasMoreData = receiveData.records.length === this.pageSize;
                            }
                        } else if (receiveData && Array.isArray(receiveData.orders)) {
                            // 另一种分页格式：{orders: [], total: 86}
                            receiveOrders = receiveData.orders.map(order => ({
                                ...order,
                                type: 'receive'
                            }));
                        } else {
                            console.warn('[SendReceive] 收回单返回数据格式异常:', receiveData);
                            receiveOrders = [];
                        }
                        counts.receive = receiveOrders.length;
                    } else {
                        console.error('[SendReceive] 收回单API调用失败:', receiveResponse.message);
                    }
                } catch (error) {
                    console.error('加载收回单失败:', error);
                    Utils.toast.error('加载收回单失败: ' + (error.message || '网络错误'));
                }
            }
            
            // 合并订单数据
            let newOrders = [];
            if (this.activeTab === 'send') {
                newOrders = sendOrders;
                // 如果没有通过records格式设置分页信息，则使用数据长度判断
                if (this.hasMoreData === undefined || this.hasMoreData === true) {
                    this.hasMoreData = newOrders.length === this.pageSize;
                }
            } else if (this.activeTab === 'receive') {
                newOrders = receiveOrders;
                // 如果没有通过records格式设置分页信息，则使用数据长度判断
                if (this.hasMoreData === undefined || this.hasMoreData === true) {
                    this.hasMoreData = newOrders.length === this.pageSize;
                }
            } else {
                // 合并所有订单，按时间排序
                newOrders = [...sendOrders, ...receiveOrders].sort((a, b) => {
                    const dateA = new Date(a.created_at || a.date || 0);
                    const dateB = new Date(b.created_at || b.date || 0);
                    return dateB - dateA; // 降序排列，最新的在前
                });
                // 在合并模式下，重新计算分页信息
                this.hasMoreData = newOrders.length === this.pageSize;
            }
            
            console.log(`[SendReceive] 加载完成，共获取${newOrders.length}条订单`);
            
            // 验证返回数据的组织归属
            if (newOrders.length > 0) {
                Utils.orgSecurity.validateDataOwnership(newOrders);
            }
            
            if (this.currentPage === 1) {
                this.orders = newOrders;
            } else {
                this.orders = [...this.orders, ...newOrders];
            }
            
            // 分页信息在各个标签页数据处理时已经设置，这里不需要重复设置
            this.updateOrderCounts(counts);
            this.renderOrders();
            this.calculateStatistics();
            
        } catch (error) {
            console.error('加载订单失败:', error);
            Utils.toast.error('加载订单失败: ' + (error.message || '网络错误'));
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    async loadMoreOrders() {
        if (!this.hasMoreData || this.isLoading) return;
        
        this.currentPage++;
        await this.loadOrderData();
    }
    
    resetAndReload() {
        this.currentPage = 1;
        this.hasMoreData = true;
        this.orders = [];
        this.loadOrderData();
    }
    
    switchTab(tabElement) {
        // 移除所有活动状态
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 设置当前标签为活动状态
        tabElement.classList.add('active');
        this.activeTab = tabElement.dataset.tab;
        
        // 切换统计显示
        this.switchStatisticsDisplay();
        
        // 重置并重新加载数据
        this.resetAndReload();
    }
    
    switchStatisticsDisplay() {
        const sendStats = document.getElementById('sendStatistics');
        const receiveStats = document.getElementById('receiveStatistics');
        
        if (this.activeTab === 'send') {
            if (sendStats) sendStats.style.display = 'block';
            if (receiveStats) receiveStats.style.display = 'none';
        } else {
            if (sendStats) sendStats.style.display = 'none';
            if (receiveStats) receiveStats.style.display = 'block';
        }
    }
    
    // 搜索相关方法
    inputSearch(value) {
        this.searchQuery = value;
        this.showSearchClear(value);
        this.resetAndReload();
    }
    
    showSearchClear(value) {
        const searchClear = document.getElementById('searchClear');
        if (searchClear) {
            searchClear.style.display = value ? 'block' : 'none';
        }
    }
    
    clearSearch() {
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        this.searchQuery = '';
        this.showSearchClear('');
        this.resetAndReload();
    }
    
    // 筛选相关方法
    openFilter() {
        const filterModal = document.getElementById('filterModal');
        if (filterModal) {
            filterModal.classList.add('filter-show');
        }
        this.loadFilterOptions();
    }
    
    closeFilter() {
        const filterModal = document.getElementById('filterModal');
        if (filterModal) {
            filterModal.classList.remove('filter-show');
        }
    }
    
    loadFilterOptions() {
        // 加载工厂选项
        const factorySelect = document.getElementById('filterFactory');
        if (factorySelect && this.factories) {
            factorySelect.innerHTML = '<option value="">选择工厂</option>' +
                this.factories.map(factory => `<option value="${factory.id}">${factory.name}</option>`).join('');
        }
        
        // 加载工序选项
        const processSelect = document.getElementById('filterProcess');
        if (processSelect && this.processes) {
            processSelect.innerHTML = '<option value="">选择工序</option>' +
                this.processes.map(process => `<option value="${process.id}">${process.name}</option>`).join('');
        }
        
        // 设置当前筛选值
        this.setCurrentFilterValues();
    }
    
    setCurrentFilterValues() {
        const elements = {
            filterStartDate: document.getElementById('filterStartDate'),
            filterEndDate: document.getElementById('filterEndDate'),
            filterFactory: document.getElementById('filterFactory'),
            filterProcess: document.getElementById('filterProcess'),
            filterProductCode: document.getElementById('filterProductCode'),
            filterStatus: document.getElementById('filterStatus')
        };
        
        if (elements.filterStartDate) elements.filterStartDate.value = this.filters.startDate;
        if (elements.filterEndDate) elements.filterEndDate.value = this.filters.endDate;
        if (elements.filterFactory) elements.filterFactory.value = this.filters.factoryId;
        if (elements.filterProcess) elements.filterProcess.value = this.filters.processId;
        if (elements.filterProductCode) elements.filterProductCode.value = this.filters.productCode;
        if (elements.filterStatus) elements.filterStatus.value = this.filters.status;
    }
    
    resetFilter() {
        const today = new Date();
        const todayStr = this.formatDate(today);
        
        this.filters = {
            startDate: todayStr,
            endDate: todayStr,
            factoryId: '',
            processId: '',
            status: 'all',
            productCode: ''
        };
        
        this.setCurrentFilterValues();
    }
    
    applyFilter() {
        const elements = {
            filterStartDate: document.getElementById('filterStartDate'),
            filterEndDate: document.getElementById('filterEndDate'),
            filterFactory: document.getElementById('filterFactory'),
            filterProcess: document.getElementById('filterProcess'),
            filterProductCode: document.getElementById('filterProductCode'),
            filterStatus: document.getElementById('filterStatus')
        };
        
        this.filters = {
            startDate: elements.filterStartDate ? elements.filterStartDate.value : this.filters.startDate,
            endDate: elements.filterEndDate ? elements.filterEndDate.value : this.filters.endDate,
            factoryId: elements.filterFactory ? elements.filterFactory.value : this.filters.factoryId,
            processId: elements.filterProcess ? elements.filterProcess.value : this.filters.processId,
            productCode: elements.filterProductCode ? elements.filterProductCode.value : this.filters.productCode,
            status: elements.filterStatus ? elements.filterStatus.value : this.filters.status
        };
        
        this.closeFilter();
        this.resetAndReload();
    }
    
    // 新增导航方法
    navigateToAdd() {
        console.log('[SendReceive] navigateToAdd 被调用，当前activeTab:', this.activeTab);
        
        if (this.activeTab === 'send') {
            console.log('[SendReceive] 尝试导航到发出单表单');
            // 直接调用全局导航函数，确保在window作用域中
            if (window.navigateToSendOrder) {
                console.log('[SendReceive] 找到window.navigateToSendOrder，准备调用');
                window.navigateToSendOrder();
            } else if (window.app) {
                console.log('[SendReceive] 未找到window.navigateToSendOrder，使用备用方案');
                // 备用方案：直接调用app的导航方法
                window.app.navigateToPage('send-order-form');
            } else {
                console.error('[SendReceive] 无法找到导航方法');
            }
        } else {
            console.log('[SendReceive] 尝试导航到收回单表单');
            // 直接调用全局导航函数，确保在window作用域中
            if (window.navigateToReceiveOrder) {
                console.log('[SendReceive] 找到window.navigateToReceiveOrder，准备调用');
                window.navigateToReceiveOrder();
            } else if (window.app) {
                console.log('[SendReceive] 未找到window.navigateToReceiveOrder，使用备用方案');
                // 备用方案：直接调用app的导航方法
                window.app.navigateToPage('receive-order-form');
            } else {
                console.error('[SendReceive] 无法找到导航方法');
            }
        }
    }
    
    // 分享功能
    handleShare(orderId, orderType) {
        console.log('分享订单:', orderId, orderType);
        if (window.Common) {
            window.Common.showMessage('分享功能开发中...', 'info');
        }
    }
    
    // 统计计算
    calculateStatistics() {
        const stats = {
            // 发出单统计
            totalSendCount: 0,
            totalSendQuantity: 0,
            totalSendWeight: 0,
            // 收回单统计
            totalReceiveCount: 0,
            totalReceiveQuantity: 0,
            totalReceiveWeight: 0,
            totalAmount: 0,
            totalPayment: 0
        };
        
        this.orders.forEach(order => {
            if (order.status === 'canceled' || order.status === 0) return;
            
            const quantity = parseInt(order.totalQuantity || order.quantity) || 0;
            const weight = parseFloat(order.totalWeight || order.weight) || 0;
            const fee = parseFloat(order.fee) || 0;
            
            if (order.type === 'send' || this.activeTab === 'send') {
                stats.totalSendCount++;
                stats.totalSendQuantity += quantity;
                stats.totalSendWeight += weight;
            }
            
            if (order.type === 'receive' || this.activeTab === 'receive') {
                stats.totalReceiveCount++;
                stats.totalReceiveQuantity += quantity;
                stats.totalReceiveWeight += weight;
                stats.totalAmount += fee;
                // 支付金额需要单独计算，这里暂时等于总金额
                stats.totalPayment += fee;
            }
        });
        
        this.statistics = stats;
        this.updateStatisticsDisplay();
    }
    
    renderOrders() {
        const orderItemsContainer = document.getElementById('orderItemsContainer');
        const emptyState = document.getElementById('orderEmptyState');
        
        if (!orderItemsContainer) return;
        
        if (this.orders.length === 0) {
            orderItemsContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        orderItemsContainer.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        
        orderItemsContainer.innerHTML = this.orders.map(order => this.renderOrderItem(order)).join('');
        
        // 更新统计显示
        this.updateStatisticsDisplay();
    }
    
    renderOrderItem(order) {
        const statusClass = order.status === 'canceled' || order.status === 0 ? 'canceled' : '';
        const statusText = order.status === 'canceled' || order.status === 0 ? '已作废' : '';
        
        // 格式化数值显示
        const totalWeight = parseFloat(order.totalWeight || order.weight || 0).toFixed(1);
        const totalQuantity = parseInt(order.totalQuantity || order.quantity || 0);
        const fee = order.fee ? parseFloat(order.fee).toFixed(2) : null;
        
        // 处理工厂和工序显示
        const factoryName = order.factory || order.factoryName || '未知工厂';
        const processName = order.process ? ` - ${order.process}` : '';
        const factoryDisplay = `${factoryName}${processName}`;
        
        // 处理订单号显示
        const orderNo = order.orderNo || order.id || '无单号';
        
        // 处理制单人和日期
        const staff = order.staff || order.creator || '未知';
        const orderDate = this.formatOrderDate(order.date || order.createTime);
        
        return `
            <div class="order-item-wrapper">
                <div class="order-item ${statusClass}" onclick="viewOrderDetail('${order.id}', '${order.type}')">
                    <div class="order-header">
                        <div class="order-no-small-gray">${orderNo}</div>
                        ${statusText ? `<div class="order-status">${statusText}</div>` : ''}
                        ${order.status !== 'canceled' && order.status !== 0 ? `
                        <div class="share-icon share-icon-purple" onclick="event.stopPropagation(); handleShare('${order.id}', '${order.type}')" title="分享订单">
                            <span>📤</span>
                        </div>` : ''}
                    </div>
                    <div class="order-factory">${factoryDisplay}</div>
                    <div class="order-details">
                        <div class="detail-item">
                            <div class="detail-label">重量</div>
                            <div class="detail-value">${totalWeight}kg</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">数量</div>
                            <div class="detail-value">${totalQuantity}</div>
                        </div>
                        ${fee && this.activeTab === 'receive' ? `
                        <div class="detail-item">
                            <div class="detail-label">工费</div>
                            <div class="detail-value">¥${fee}</div>
                        </div>` : ''}
                    </div>
                    <div class="order-footer">
                        <div class="order-staff">制单：${staff}</div>
                        <div class="order-date">${orderDate}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    formatOrderDate(dateStr) {
        if (!dateStr) return '无日期';
        
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            return dateStr;
        }
    }
    
    updateOrderCounts(counts) {
        const sendCountEl = document.getElementById('sendOrderCount');
        const receiveCountEl = document.getElementById('receiveOrderCount');
        
        if (sendCountEl && counts) {
            sendCountEl.textContent = counts.send || 0;
        }
        if (receiveCountEl && counts) {
            receiveCountEl.textContent = counts.receive || 0;
        }
    }
    
    updateLoadMoreButton() {
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!loadMoreContainer) return;
        
        if (this.hasMoreData) {
            loadMoreContainer.style.display = 'block';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
    
    updateStatisticsDisplay() {
        // 参考微信小程序的统计信息显示算法
        const elements = {
            // 发出单统计元素
            totalSendCount: document.getElementById('totalSendCount'),
            totalSendQuantity: document.getElementById('totalSendQuantity'),
            totalSendWeight: document.getElementById('totalSendWeight'),
            
            // 收回单统计元素
            totalReceiveCount: document.getElementById('totalReceiveCount'),
            totalReceiveQuantity: document.getElementById('totalReceiveQuantity'),
            totalReceiveWeight: document.getElementById('totalReceiveWeight'),
            totalAmount: document.getElementById('totalAmount'),
            totalPayment: document.getElementById('totalPayment')
        };
        
        // 更新发出单统计数据
        if (elements.totalSendCount) {
            const countValue = this.statistics.totalSendCount || 0;
            elements.totalSendCount.textContent = countValue;
            this.applyNumberLengthClass(elements.totalSendCount, countValue.toString());
        }
        
        if (elements.totalSendQuantity) {
            const quantityValue = this.statistics.totalSendQuantity || 0;
            elements.totalSendQuantity.textContent = quantityValue;
            this.applyNumberLengthClass(elements.totalSendQuantity, quantityValue.toString());
        }
        
        if (elements.totalSendWeight) {
            const weightValue = this.statistics.totalSendWeight || 0;
            const weightText = weightValue.toFixed(2);
            elements.totalSendWeight.textContent = weightText;
            this.applyNumberLengthClass(elements.totalSendWeight, weightText);
        }
        
        // 更新收回单统计数据
        if (elements.totalReceiveCount) {
            const countValue = this.statistics.totalReceiveCount || 0;
            elements.totalReceiveCount.textContent = countValue;
            this.applyNumberLengthClass(elements.totalReceiveCount, countValue.toString());
        }
        
        if (elements.totalReceiveQuantity) {
            const quantityValue = this.statistics.totalReceiveQuantity || 0;
            elements.totalReceiveQuantity.textContent = quantityValue;
            this.applyNumberLengthClass(elements.totalReceiveQuantity, quantityValue.toString());
        }
        
        if (elements.totalReceiveWeight) {
            const weightValue = this.statistics.totalReceiveWeight || 0;
            const weightText = weightValue.toFixed(2);
            elements.totalReceiveWeight.textContent = weightText;
            this.applyNumberLengthClass(elements.totalReceiveWeight, weightText);
        }
        
        if (elements.totalAmount) {
            const amountValue = this.statistics.totalAmount || 0;
            const amountText = amountValue.toFixed(2);
            elements.totalAmount.textContent = '¥' + amountText;
            this.applyNumberLengthClass(elements.totalAmount, amountText);
        }
        
        if (elements.totalPayment) {
            const paymentValue = this.statistics.totalPayment || 0;
            const paymentText = paymentValue.toFixed(2);
            elements.totalPayment.textContent = '¥' + paymentText;
            this.applyNumberLengthClass(elements.totalPayment, paymentText);
        }
    }
    
    // 根据数字长度应用相应的CSS类 - 参考微信小程序算法
    applyNumberLengthClass(element, numberStr) {
        if (!element || !numberStr) return;
        
        // 移除之前的长度类
        element.classList.remove('long-number', 'very-long-number');
        
        // 根据数字长度添加相应的类
        const length = numberStr.length;
        if (length > 8) {
            element.classList.add('very-long-number');
        } else if (length > 5) {
            element.classList.add('long-number');
        }
        
        console.log(`[统计] 数字 "${numberStr}" 长度: ${length}, 应用类: ${element.className}`);
    }
    
    async loadFactories() {
        try {
            const response = await API.request('/factories', 'GET');
            if (response.success) {
                this.factories = response.data || [];
            }
        } catch (error) {
            console.error('加载工厂列表失败:', error);
        }
    }
    
    async loadProcesses() {
        try {
            const response = await API.request('/processes', 'GET');
            if (response.success) {
                this.processes = response.data || [];
            }
        } catch (error) {
            console.error('加载工序列表失败:', error);
        }
    }
    
    showLoading() {
        Common.showLoading('加载中...');
    }
    
    hideLoading() {
        Common.hideLoading();
    }
    
    showEmptyState() {
        const orderList = document.getElementById('orderList');
        const emptyState = document.getElementById('orderEmptyState');
        
        if (orderList) orderList.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
    }
    
    // 搜索订单
    searchOrders() {
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) {
            this.searchQuery = searchInput.value;
            this.resetAndReload();
        }
    }
    
    // 显示筛选模态框
    showFilterModal() {
        // 实现筛选模态框显示逻辑
        console.log('显示筛选模态框');
    }
    
    // 导出订单
    async exportOrders() {
        try {
            this.showLoading();
            
            const params = {
                type: this.activeTab,
                search: this.searchQuery,
                ...this.filters,
                export: true
            };
            
            const response = await API.request('/orders/export', 'GET', params);
            
            if (response.success) {
                // 创建下载链接
                const link = document.createElement('a');
                link.href = response.data.downloadUrl;
                link.download = `${this.activeTab === 'send' ? '发出单' : '收回单'}_${new Date().toISOString().split('T')[0]}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Common.showMessage('导出成功', 'success');
            } else {
                throw new Error(response.message || '导出失败');
            }
        } catch (error) {
            console.error('导出失败:', error);
            Common.showMessage('导出失败: ' + error.message, 'error');
        } finally {
            this.hideLoading();
        }
    }
    
    // 显示新增订单模态框
    showAddOrderModal() {
        // 实现新增订单模态框显示逻辑
        console.log('显示新增订单模态框');
    }
}

// 全局函数 - 小程序风格
function switchOrderTab(tabElement) {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.switchTab(tabElement);
    }
}

function inputSearch() {
    const searchInput = document.getElementById('orderSearchInput');
    if (window.sendReceiveManager && searchInput) {
        window.sendReceiveManager.inputSearch(searchInput.value);
    }
}

function clearSearch() {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.clearSearch();
    }
}

function openFilter() {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.openFilter();
    }
}

function closeFilter() {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.closeFilter();
    }
}

function resetFilter() {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.resetFilter();
    }
}

function applyFilter() {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.applyFilter();
    }
}

function navigateToAdd() {
    console.log('[SendReceive Global] navigateToAdd 被调用');
    console.log('[SendReceive Global] window.sendReceiveManager 存在:', !!window.sendReceiveManager);
    
    if (window.sendReceiveManager) {
        console.log('[SendReceive Global] 调用 sendReceiveManager.navigateToAdd()');
        window.sendReceiveManager.navigateToAdd();
    } else {
        console.error('[SendReceive Global] window.sendReceiveManager 不存在');
    }
}

function handleShare(orderId, orderType) {
    if (window.sendReceiveManager) {
        window.sendReceiveManager.handleShare(orderId, orderType);
    }
}

function viewOrderDetail(orderId, orderType) {
    // 跳转到订单详情页面
    console.log('查看订单详情:', orderId, orderType);
    // 这里可以实现页面跳转或模态框显示订单详情
    if (window.Common) {
        window.Common.showMessage('订单详情功能开发中...', 'info');
    }
} 