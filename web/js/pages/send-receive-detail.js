// 收发管理详细页面功能类 - 组织数据隔离版
class SendReceiveDetail {
    constructor() {
        this.activeTab = 'send'; // 'send' 或 'receive'
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
            status: '',
            productCode: ''
        };
        this.statistics = {};
        this.showFilterModal = false;
        
        // 基础数据
        this.factories = [];
        this.processes = [];
        this.products = [];
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadBasicData();
        this.loadOrders();
        this.renderPage();
    }
    
    bindEvents() {
        // 标签页切换
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tab')) {
                const tab = e.target.closest('.tab');
                const tabType = tab.dataset.tab;
                if (tabType && tabType !== this.activeTab) {
                    this.switchTab(tabType);
                }
            }
        });
        
        // 搜索功能
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value;
                this.updateSearchClear();
                this.resetAndReload();
            }, 300));
        }
        
        // 使用优化的滚动监听器替代原有的滚动事件
        if (window.ScrollOptimizer) {
            // 移除旧的滚动监听器（如果存在）
            if (this.scrollOptimizer) {
                this.scrollOptimizer.destroy();
            }
            
            // 设置优化的无限滚动
            this.scrollOptimizer = window.ScrollOptimizer.setupInfiniteScroll(
                'send-receivePageContent',
                () => this.loadMoreOrders(),
                {
                    threshold: 1000,
                    throttle: 200
                }
            );
            
            console.log('[SendReceiveDetail] 已启用优化的滚动监听器');
        } else {
            // 备用方案：使用传统的滚动监听器（已优化）
            window.addEventListener('scroll', Utils.throttle(() => {
                if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
                    this.loadMoreOrders();
                }
            }, 200));
            
            console.warn('[SendReceiveDetail] ScrollOptimizer不可用，使用备用滚动监听器');
        }
    }
    
    updateSearchClear() {
        const searchClear = document.querySelector('.search-clear');
        if (searchClear) {
            searchClear.style.display = this.searchQuery ? 'block' : 'none';
        }
    }
    
    clearSearch() {
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
            this.updateSearchClear();
            this.resetAndReload();
        }
    }
    
    renderPage() {
        const container = document.getElementById('send-receivePageContent');
        if (!container) return;
        
        container.innerHTML = `
            <div class="send-receive-page">
                <!-- 标签页导航 -->
                <div class="tabs-card">
                    <div class="tabs">
                        <div class="tab ${this.activeTab === 'send' ? 'active' : ''}" data-tab="send">
                            <span class="tab-icon">📤</span>
                            <span class="tab-text">发出单</span>
                        </div>
                        <div class="tab ${this.activeTab === 'receive' ? 'active' : ''}" data-tab="receive">
                            <span class="tab-icon">📥</span>
                            <span class="tab-text">收回单</span>
                        </div>
                    </div>
                </div>
                
                <!-- 报表入口 -->
                <div class="report-card">
                    <div class="report-entry">
                        <div class="report-item" onclick="sendReceiveDetailManager.navigateToFlowTable()">
                            <span class="report-icon">📋</span>
                            <span class="report-text">收发流水表</span>
                        </div>
                        <div class="report-item" onclick="sendReceiveDetailManager.navigateToStatement()">
                            <span class="report-icon">📊</span>
                            <span class="report-text">对账单</span>
                        </div>
                    </div>
                </div>
                
                <!-- 搜索栏 -->
                <div class="search-card">
                    <div class="search-container">
                        <div class="search-box">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="orderSearchInput" class="search-input" placeholder="搜索单号、工厂" />
                            <span class="search-clear" onclick="sendReceiveDetailManager.clearSearch()" style="display: none;">✕</span>
                        </div>
                        <button class="filter-btn" onclick="sendReceiveDetailManager.showFilterModal()">
                            <span class="filter-icon">🎯</span>
                        </button>
                    </div>
                </div>
                
                <!-- 订单列表 -->
                <div class="order-list-card">
                    <div class="order-list" id="orderList">
                        <!-- 订单项将通过JavaScript动态生成 -->
                    </div>
                    
                    <!-- 空状态 -->
                    <div class="empty-list" id="emptyState" style="display: none;">
                        <div class="empty-icon">📦</div>
                        <div class="empty-text">暂无数据</div>
                        <div class="empty-desc">点击右下角按钮创建新订单</div>
                    </div>
                    
                    <!-- 加载更多 -->
                    <div class="load-more" id="loadMore" style="display: none;">
                        <button class="load-more-btn" onclick="sendReceiveDetailManager.loadMoreOrders()">
                            加载更多
                        </button>
                    </div>
                </div>
                
                <!-- 新增按钮 -->
                <button class="add-button" onclick="sendReceiveDetailManager.navigateToAdd()">
                    <span class="add-icon">+</span>
                </button>
                
                <!-- 底部统计信息 -->
                <div class="bottom-statistics">
                    <div class="statistics-content" id="statisticsContent">
                        <!-- 统计项将通过JavaScript动态生成 -->
                    </div>
                </div>
            </div>
            
            <!-- 筛选弹窗 -->
            <div class="filter-modal" id="filterModal">
                <div class="filter-overlay" onclick="sendReceiveDetailManager.hideFilterModal()"></div>
                <div class="filter-content">
                    <div class="filter-header">
                        <div class="filter-title">筛选条件</div>
                        <div class="filter-close" onclick="sendReceiveDetailManager.hideFilterModal()">✕</div>
                    </div>
                    <div class="filter-body">
                        <!-- 日期范围 -->
                        <div class="filter-section">
                            <div class="filter-label">日期范围</div>
                            <div class="date-range">
                                <input type="date" id="filterStartDate" class="date-picker" />
                                <span class="date-separator">至</span>
                                <input type="date" id="filterEndDate" class="date-picker" />
                            </div>
                        </div>
                        
                        <!-- 工厂选择 -->
                        <div class="filter-section">
                            <div class="filter-label">工厂</div>
                            <select id="filterFactory" class="filter-picker">
                                <option value="">选择工厂</option>
                            </select>
                        </div>
                        
                        <!-- 工序选择 -->
                        <div class="filter-section">
                            <div class="filter-label">工序</div>
                            <select id="filterProcess" class="filter-picker">
                                <option value="">选择工序</option>
                            </select>
                        </div>
                        
                        <!-- 货号输入 -->
                        <div class="filter-section">
                            <div class="filter-label">货号</div>
                            <input type="text" id="filterProductCode" class="filter-input" placeholder="输入货号" />
                        </div>
                        
                        <!-- 状态选择 -->
                        <div class="filter-section">
                            <div class="filter-label">状态</div>
                            <select id="filterStatus" class="filter-picker">
                                <option value="">全部</option>
                                <option value="normal">正常</option>
                                <option value="canceled">已作废</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="filter-footer">
                        <button class="filter-reset" onclick="sendReceiveDetailManager.resetFilters()">重置</button>
                        <button class="filter-apply" onclick="sendReceiveDetailManager.applyFilters()">确定</button>
                    </div>
                </div>
            </div>
        `;
        
        this.bindPageEvents();
    }
    
    bindPageEvents() {
        // 标签页切换
        document.addEventListener('click', (e) => {
            if (e.target.closest('.tab')) {
                const tab = e.target.closest('.tab');
                const tabType = tab.dataset.tab;
                if (tabType && tabType !== this.activeTab) {
                    this.switchTab(tabType);
                }
            }
        });
        
        // 搜索功能
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value;
                this.updateSearchClear();
                this.resetAndReload();
            }, 300));
        }
        
        // 使用优化的滚动监听器替代原有的滚动事件
        if (window.ScrollOptimizer) {
            // 移除旧的滚动监听器（如果存在）
            if (this.scrollOptimizer) {
                this.scrollOptimizer.destroy();
            }
            
            // 设置优化的无限滚动
            this.scrollOptimizer = window.ScrollOptimizer.setupInfiniteScroll(
                'send-receivePageContent',
                () => this.loadMoreOrders(),
                {
                    threshold: 1000,
                    throttle: 200
                }
            );
            
            console.log('[SendReceiveDetail] 已启用优化的滚动监听器');
        } else {
            // 备用方案：使用传统的滚动监听器（已优化）
            window.addEventListener('scroll', Utils.throttle(() => {
                if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
                    this.loadMoreOrders();
                }
            }, 200));
            
            console.warn('[SendReceiveDetail] ScrollOptimizer不可用，使用备用滚动监听器');
        }
    }
    
    async loadBasicData() {
        try {
            // 并行加载基础数据
            const [factoriesRes, processesRes, productsRes] = await Promise.all([
                API.base.factories.list(),
                API.base.processes.list(),
                API.base.products.list()
            ]);
            
            if (factoriesRes.success) {
                this.factories = factoriesRes.data || [];
                this.updateFactoryOptions();
            }
            
            if (processesRes.success) {
                this.processes = processesRes.data || [];
                this.updateProcessOptions();
            }
            
            if (productsRes.success) {
                // 过滤掉已停用的货品（status = 0），只显示启用的货品（status = 1）
                const enabledProducts = (productsRes.data || []).filter(p => p.status === 1);
                console.log('[send-receive-detail.js] Filtered out disabled products, showing', enabledProducts.length, 'enabled products');
                
                this.products = enabledProducts;
            }
        } catch (error) {
            console.error('加载基础数据失败:', error);
        }
    }
    
    updateFactoryOptions() {
        const factorySelect = document.getElementById('filterFactory');
        if (factorySelect && this.factories.length > 0) {
            const options = this.factories.map(factory => 
                `<option value="${factory.id}">${factory.name}</option>`
            ).join('');
            factorySelect.innerHTML = '<option value="">全部工厂</option>' + options;
        }
    }
    
    updateProcessOptions() {
        const processSelect = document.getElementById('filterProcess');
        if (processSelect && this.processes.length > 0) {
            const options = this.processes.map(process => 
                `<option value="${process.id}">${process.name}</option>`
            ).join('');
            processSelect.innerHTML = '<option value="">全部工序</option>' + options;
        }
    }
    
    async loadOrders() {
        if (this.isLoading) return;
        
        // 强制验证组织认证状态
        if (!Auth.requireAuth()) {
            return;
        }
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            const params = {
                type: this.activeTab,
                page: this.currentPage,
                limit: this.pageSize,
                search: this.searchQuery,
                ...this.filters
            };
            
            // 根据activeTab使用正确的API端点
            let response;
            if (this.activeTab === 'send') {
                response = await API.sendOrders.list(params);
            } else if (this.activeTab === 'receive') {
                response = await API.receiveOrders.list(params);
            } else {
                throw new Error('未知的订单类型: ' + this.activeTab);
            }
            
            if (response.success) {
                const responseData = response.data;
                let newOrders = [];
                
                // 处理不同的响应格式
                if (responseData && responseData.records) {
                    // 分页格式：{records: [], total: 0, page: 1, pageSize: 20}
                    newOrders = responseData.records || [];
                } else if (Array.isArray(responseData)) {
                    // 数组格式：[...]
                    newOrders = responseData;
                } else {
                    newOrders = [];
                }
                
                // 验证返回数据的组织归属
                Utils.orgSecurity.validateDataOwnership(newOrders);
                
                if (this.currentPage === 1) {
                    this.orders = newOrders;
                } else {
                    this.orders = [...this.orders, ...newOrders];
                }
                
                this.hasMoreData = newOrders.length === this.pageSize;
                this.renderOrders();
                this.updateStatistics();
                this.updateTabCounts();
            } else {
                throw new Error(response.message || '加载订单失败');
            }
        } catch (error) {
            console.error('加载订单失败:', error);
            Utils.toast.error('加载订单失败: ' + error.message);
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    async loadMoreOrders() {
        if (!this.hasMoreData || this.isLoading) return;
        
        this.currentPage++;
        await this.loadOrders();
    }
    
    resetAndReload() {
        this.currentPage = 1;
        this.hasMoreData = true;
        this.orders = [];
        this.loadOrders();
    }
    
    switchTab(tab) {
        if (this.activeTab === tab) return;
        
        this.activeTab = tab;
        
        // 更新标签页样式
        document.querySelectorAll('.tab').forEach(tabEl => {
            tabEl.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // 重新加载数据
        this.resetAndReload();
    }
    
    renderOrders() {
        const orderList = document.getElementById('orderList');
        const emptyState = document.getElementById('emptyState');
        const loadMore = document.getElementById('loadMore');
        
        if (!orderList) return;
        
        if (this.orders.length === 0) {
            orderList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            if (loadMore) loadMore.style.display = 'none';
            return;
        }
        
        orderList.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';
        
        orderList.innerHTML = this.orders.map(order => this.renderOrderItem(order)).join('');
        
        // 更新加载更多按钮
        if (loadMore) {
            loadMore.style.display = this.hasMoreData ? 'block' : 'none';
        }
    }
    
    renderOrderItem(order) {
        const statusClass = order.status === 'canceled' ? 'canceled' : '';
        const statusText = order.status === 'canceled' ? '已作废' : '';
        
        return `
            <div class="order-item-wrapper">
                <div class="order-item ${statusClass}" onclick="sendReceiveDetailManager.viewOrderDetail('${order.id}')">
                    <div class="order-header">
                        <div class="order-no-small-gray">${order.orderNo || '无单号'}</div>
                        ${statusText ? `<div class="order-status">${statusText}</div>` : ''}
                    </div>
                    <div class="order-factory">${order.factoryName || '未知工厂'}${order.processName ? ' - ' + order.processName : ''}</div>
                    <div class="order-details">
                        <div class="detail-item">
                            <div class="detail-label">重量</div>
                            <div class="detail-value">${order.totalWeight || order.weight || 0}kg</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">数量</div>
                            <div class="detail-value">${order.totalQuantity || order.quantity || 0}</div>
                        </div>
                        ${this.activeTab === 'receive' && order.fee ? `
                        <div class="detail-item">
                            <div class="detail-label">工费</div>
                            <div class="detail-value">¥${order.fee}</div>
                        </div>
                        ` : ''}
                    </div>
                    <div class="order-footer">
                        <div class="order-staff">制单：${order.staff || order.createBy || '未知'}</div>
                        <div class="order-date">${this.formatOrderDate(order.createdAt || order.date)}</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    formatOrderDate(dateStr) {
        if (!dateStr) return '无日期';
        
        try {
            const date = new Date(dateStr);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${month}-${day} ${hours}:${minutes}`;
        } catch (error) {
            return dateStr;
        }
    }
    
    updateStatistics() {
        const statisticsContent = document.getElementById('statisticsContent');
        if (!statisticsContent) return;
        
        // 只统计有效单据（非作废状态）
        const validOrders = this.orders.filter(order => order.status !== 'cancelled' && order.status !== 0);
        
        const totalCount = validOrders.length;
        const totalQuantity = validOrders.reduce((sum, order) => sum + (parseFloat(order.totalQuantity || order.quantity || 0)), 0);
        const totalWeight = validOrders.reduce((sum, order) => sum + (parseFloat(order.totalWeight || order.weight || 0)), 0);
        
        let statisticsHTML = `
            <div class="statistic-item">
                <div class="statistic-value">${totalCount}</div>
                <div class="statistic-label">订单数量</div>
            </div>
            <div class="statistic-item">
                <div class="statistic-value">${Utils.format.number(totalQuantity)}</div>
                <div class="statistic-label">总数量</div>
            </div>
            <div class="statistic-item">
                <div class="statistic-value">${Utils.format.number(totalWeight)}</div>
                <div class="statistic-label">总重量(kg)</div>
            </div>
        `;
        
        if (this.activeTab === 'receive') {
            const totalAmount = validOrders.reduce((sum, order) => sum + (parseFloat(order.fee || order.totalAmount || 0)), 0);
            const totalPayment = validOrders.reduce((sum, order) => sum + (parseFloat(order.paymentAmount || order.paidAmount || 0)), 0);
            
            statisticsHTML += `
                <div class="statistic-item">
                    <div class="statistic-value">¥${Utils.format.number(totalAmount)}</div>
                    <div class="statistic-label">总金额</div>
                </div>
                <div class="statistic-item">
                    <div class="statistic-value">¥${Utils.format.number(totalPayment)}</div>
                    <div class="statistic-label">已支付</div>
                </div>
            `;
        }
        
        statisticsContent.innerHTML = statisticsHTML;
    }
    
    updateTabCounts() {
        // 这里可以加载各标签页的总数量
        const sendCountEl = document.getElementById('sendOrderCount');
        const receiveCountEl = document.getElementById('receiveOrderCount');
        
        if (this.activeTab === 'send' && sendCountEl) {
            sendCountEl.textContent = this.orders.length;
        } else if (this.activeTab === 'receive' && receiveCountEl) {
            receiveCountEl.textContent = this.orders.length;
        }
    }
    
    showFilterModal() {
        const modal = document.getElementById('filterModal');
        if (modal) {
            modal.classList.add('show');
            this.fillFilterForm();
        }
    }
    
    hideFilterModal() {
        const modal = document.getElementById('filterModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    fillFilterForm() {
        // 填充日期
        const startDateInput = document.getElementById('filterStartDate');
        const endDateInput = document.getElementById('filterEndDate');
        if (startDateInput) startDateInput.value = this.filters.startDate;
        if (endDateInput) endDateInput.value = this.filters.endDate;
        
        // 填充工厂
        const factorySelect = document.getElementById('filterFactory');
        if (factorySelect) {
            factorySelect.value = this.filters.factoryId;
        }
        
        // 填充工序
        const processSelect = document.getElementById('filterProcess');
        if (processSelect) {
            processSelect.value = this.filters.processId;
        }
        
        // 填充货号
        const productCodeInput = document.getElementById('filterProductCode');
        if (productCodeInput) {
            productCodeInput.value = this.filters.productCode;
        }
        
        // 填充状态
        const statusSelect = document.getElementById('filterStatus');
        if (statusSelect) {
            statusSelect.value = this.filters.status;
        }
    }
    
    applyFilters() {
        // 获取筛选条件
        const startDate = document.getElementById('filterStartDate')?.value || '';
        const endDate = document.getElementById('filterEndDate')?.value || '';
        const factoryId = document.getElementById('filterFactory')?.value || '';
        const processId = document.getElementById('filterProcess')?.value || '';
        const productCode = document.getElementById('filterProductCode')?.value || '';
        const status = document.getElementById('filterStatus')?.value || '';
        
        // 更新筛选条件
        this.filters = {
            startDate,
            endDate,
            factoryId,
            processId,
            productCode,
            status
        };
        
        // 关闭弹窗
        this.hideFilterModal();
        
        // 重新加载数据
        this.resetAndReload();
    }
    
    resetFilters() {
        // 重置为默认筛选条件
        const today = this.formatDate(new Date());
        this.filters = {
            startDate: today,
            endDate: today,
            factoryId: '',
            processId: '',
            productCode: '',
            status: ''
        };
        
        // 重新填充表单
        this.fillFilterForm();
        
        // 重新加载数据
        this.resetAndReload();
        
        // 关闭弹窗
        this.hideFilterModal();
    }
    
    showAddOrderModal() {
        // 显示新增订单选择模态框
        const orderType = this.activeTab;
        const title = orderType === 'send' ? '新增发出单' : '新增收回单';
        
        Utils.modal.confirm(
            title,
            `确定要创建新的${orderType === 'send' ? '发出单' : '收回单'}吗？`,
            () => {
                this.navigateToAddOrder(orderType);
            }
        );
    }
    
    navigateToAddOrder(type) {
        if (type === 'receive') {
            // 导航到收回单表单页面
            window.initReceiveOrderForm('create');
        } else if (type === 'send') {
            // 导航到发出单表单页面
            window.initSendOrderForm('create');
        } else {
            Utils.toast.error('未知的订单类型');
        }
    }
    
    viewOrderDetail(orderId) {
        // 导航到订单详情页
        if (this.activeTab === 'send') {
            window.navigateToSendOrderDetail?.(orderId);
        } else {
            window.navigateToReceiveOrderDetail?.(orderId);
        }
    }
    
    editOrder(orderId) {
        if (this.activeTab === 'receive') {
            // 🔒 禁用收回单编辑功能以保证数据一致性
            Utils.modal.alert(
                '功能提示',
                '为保证数据一致性，收回单不允许编辑。如需修改，请先作废当前单据，然后重新创建。'
            );
        } else if (this.activeTab === 'send') {
            // 编辑发出单
            window.initSendOrderForm('edit', orderId);
        } else {
            Utils.toast.error('未知的订单类型');
        }
    }
    
    async shareOrder(orderId) {
        try {
            Utils.loading.show('生成分享内容...');
            
            // 根据activeTab使用正确的API端点获取订单详情
            let response;
            if (this.activeTab === 'send') {
                response = await API.sendOrders.detail(orderId);
            } else if (this.activeTab === 'receive') {
                response = await API.receiveOrders.detail(orderId);
            } else {
                throw new Error('未知的订单类型: ' + this.activeTab);
            }
            
            if (response.success) {
                const order = response.data;
                
                // 生成分享内容
                const shareContent = this.generateShareContent(order);
                
                // 复制到剪贴板
                await navigator.clipboard.writeText(shareContent);
                
                Utils.toast.success('分享内容已复制到剪贴板');
            } else {
                throw new Error(response.message || '获取订单详情失败');
            }
        } catch (error) {
            console.error('分享订单失败:', error);
            Utils.toast.error('分享失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    generateShareContent(order) {
        const orderType = this.activeTab === 'send' ? '发出单' : '收回单';
        const icon = this.activeTab === 'send' ? '📤' : '📥';
        
        return `${icon} ${orderType}分享
        
订单号: ${order.orderNo || '无'}
工厂: ${order.factoryName || '未知'}
工序: ${order.process || '-'}
数量: ${order.totalQuantity || order.quantity || 0}
重量: ${Utils.format.number(order.totalWeight || order.weight || 0)}kg
${this.activeTab === 'receive' ? `金额: ¥${Utils.format.number(order.fee || order.totalAmount || 0)}` : ''}
制单: ${order.staff || '未知'}
日期: ${Utils.format.date(order.date || order.createdAt, 'YYYY-MM-DD HH:mm')}

--- 云收发管理系统 ---`;
    }
    
    async cancelOrder(orderId) {
        try {
            const confirmed = await Utils.modal.confirm(
                '确认作废',
                '确定要作废此订单吗？作废后无法恢复。',
                '确定作废',
                '取消'
            );
            
            if (!confirmed) return;
            
            Utils.loading.show('作废中...');
            
            // 根据activeTab使用正确的API端点
            let response;
            if (this.activeTab === 'send') {
                response = await API.sendOrders.cancel(orderId);
            } else if (this.activeTab === 'receive') {
                response = await API.receiveOrders.cancel(orderId);
            } else {
                throw new Error('未知的订单类型: ' + this.activeTab);
            }
            
            if (response.success) {
                Utils.toast.success('订单已作废');
                this.resetAndReload();
            } else {
                throw new Error(response.message || '作废失败');
            }
        } catch (error) {
            console.error('作废订单失败:', error);
            Utils.toast.error('作废失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    async exportOrders() {
        try {
            this.showLoading();
            
            const params = {
                type: this.activeTab,
                ...this.filters,
                export: true
            };
            
            // 注意：导出功能可能需要后端提供统一的导出接口，或者分别调用
            // 这里暂时保持原有逻辑，可能需要后续根据实际API调整
            let response;
            if (this.activeTab === 'send') {
                // 如果后端有专门的发出单导出接口，使用它
                response = await API.get('/send-orders/export', { params });
            } else if (this.activeTab === 'receive') {
                // 如果后端有专门的收回单导出接口，使用它
                response = await API.get('/receive-orders/export', { params });
            } else {
                throw new Error('未知的订单类型: ' + this.activeTab);
            }
            
            if (response.success) {
                // 创建下载链接
                const link = document.createElement('a');
                link.href = response.data.downloadUrl;
                link.download = `${this.activeTab === 'send' ? '发出单' : '收回单'}_${new Date().getTime()}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Utils.toast.success('导出成功');
            } else {
                throw new Error(response.message || '导出失败');
            }
        } catch (error) {
            console.error('导出失败:', error);
            Utils.toast.error('导出失败: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    refreshOrders() {
        this.resetAndReload();
        Utils.toast.success('数据已刷新');
    }
    
    navigateToFlowTable() {
        // 导航到流水表页面
        window.navigateToFlowTable?.();
    }
    
    navigateToStatement() {
        // 导航到对账单页面
        window.navigateToStatement?.();
    }
    
    showLoading() {
        Utils.loading.show();
    }
    
    hideLoading() {
        Utils.loading.hide();
    }
    
    showEmptyState() {
        const orderList = document.getElementById('orderList');
        const emptyState = document.getElementById('emptyState');
        
        if (orderList) orderList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
    }
}

// 全局实例和初始化函数
let sendReceiveDetailManager = null;

function initSendReceiveDetailPage() {
    // 检查用户登录状态和页面状态
    const loginPage = document.getElementById('loginPage');
    const isOnLoginPage = loginPage && loginPage.style.display !== 'none';
            // 🛡️ 使用安全的存储方式获取认证信息
        const token = Utils.storage.get(CONFIG.STORAGE_KEYS.TOKEN);
        const orgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
    
    if (isOnLoginPage || !token || !orgId) {
        console.log('用户未登录或在登录页面，跳过SendReceiveDetail初始化');
        return null;
    }
    
    if (!sendReceiveDetailManager) {
        sendReceiveDetailManager = new SendReceiveDetail();
    }
    return sendReceiveDetailManager;
}

// 页面加载完成后自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // 延迟初始化，确保其他脚本加载完成
        setTimeout(initSendReceiveDetailPage, 100);
    });
} else {
    // 如果文档已经加载完成，直接初始化
    setTimeout(initSendReceiveDetailPage, 100);
}

// 导出到全局
window.SendReceiveDetail = SendReceiveDetail;
window.initSendReceiveDetailPage = initSendReceiveDetailPage; 