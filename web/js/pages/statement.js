// 对账单页面功能
class Statement {
    constructor() {
        this.isLoading = false;
        this.statementData = [];
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalCount = 0;
        this.filters = {
            startDate: '',
            endDate: '',
            factoryId: '',
            factoryName: '',
            productId: '',
            productNo: '',
            status: ''
        };
        
        // 🎯 搜索数据缓存
        this.factories = [];
        this.products = [];
        this.filteredFactories = [];
        this.filteredProducts = [];
        
        this.init();
    }
    
    init() {
        console.log('[对账单] 初始化对账单页面');
        this.initDateRange();
        this.loadBasicData();
        // 暂时不自动加载对账单数据，等用户选择工厂后再加载
        console.log('[对账单] 初始化完成，等待用户筛选');
    }
    
    // 🎯 加载基础数据（工厂和货品列表）
    async loadBasicData() {
        try {
            console.log('[对账单] 开始加载基础数据');
            
            // 并行加载工厂和货品数据
            const promises = [];
            
            if (API.factories && typeof API.factories.getList === 'function') {
                promises.push(API.factories.getList());
            } else if (API.get) {
                promises.push(API.get('/factories'));
            }
            
            if (API.products && typeof API.products.getList === 'function') {
                promises.push(API.products.getList());
            } else if (API.get) {
                promises.push(API.get('/products'));
            }
            
            const results = await Promise.allSettled(promises);
            
            // 处理工厂数据
            if (results[0]?.status === 'fulfilled') {
                const factoriesData = results[0].value?.data || results[0].value || [];
                this.factories = factoriesData.filter(f => f.status === 'active' || f.status === 1);
                this.filteredFactories = [...this.factories];
                this.updateFactoryDropdown();
                console.log('[对账单] 加载工厂数据成功:', this.factories.length);
            }
            
            // 处理货品数据
            if (results[1]?.status === 'fulfilled') {
                const productsData = results[1].value?.data || results[1].value || [];
                this.products = productsData.filter(p => p.status === 1);
                this.filteredProducts = [...this.products];
                this.updateProductDropdown();
                console.log('[对账单] 加载货品数据成功:', this.products.length);
            }
            
        } catch (error) {
            console.error('[对账单] 加载基础数据失败:', error);
        }
    }
    
    initDateRange() {
        // 默认显示本月数据
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        this.filters.startDate = firstDay.toISOString().split('T')[0];
        this.filters.endDate = lastDay.toISOString().split('T')[0];
        
        console.log('初始化日期范围:', this.filters);
    }
    
    async loadStatementData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            console.log('开始加载对账单数据...');
            
            if (!window.API) {
                throw new Error('API模块未加载');
            }
            
            // 构建查询参数
            const params = {
                page: this.currentPage,
                pageSize: this.pageSize,
                ...this.filters
            };
            
            // 尝试调用对账单接口
            let response;
            try {
                // 直接调用API请求，因为还没有专门的statement API方法
                response = await API.get('/statement', { params });
            } catch (error) {
                console.log('对账单接口调用失败:', error);
                // 作为备用，显示空数据
                this.statementData = [];
                this.totalCount = 0;
                this.renderStatementData();
                return;
            }
            
            if (response && response.success) {
                this.statementData = response.data?.records || response.data || [];
                this.totalCount = response.data?.total || this.statementData.length;
                console.log('对账单数据加载成功:', this.statementData.length, '条记录');
                this.renderStatementData();
            } else {
                throw new Error(response?.message || '加载对账单失败');
            }
            
        } catch (error) {
            console.error('加载对账单数据失败:', error);
            this.handleLoadError(error);
        } finally {
            this.isLoading = false;
        }
    }
    
    renderStatementData() {
        console.log('[对账单] 开始渲染对账单数据，记录数:', this.statementData.length);
        
        try {
            const statementContent = document.getElementById('statementContent');
            if (!statementContent) {
                console.error('[对账单] 未找到对账单内容容器');
                return;
            }
            
            // 🔄 清空现有内容
            statementContent.innerHTML = '';
            
            if (!Array.isArray(this.statementData) || this.statementData.length === 0) {
                console.log('[对账单] 无有效的对账单数据，显示空状态');
                this.renderEmptyState(statementContent);
                return;
            }
            
            // 🎯 处理对账单数据
            const statement = this.processStatementData(this.statementData);
            
            // 🎨 渲染对账单内容
            this.renderStatementContent(statementContent, statement);
            
            console.log('[对账单] 对账单渲染完成');
            
        } catch (error) {
            console.error('[对账单] 渲染对账单数据时出错:', error);
            this.handleRenderError(error);
        }
    }
    
    // 🎯 处理对账单数据 - 计算统计信息
    processStatementData(data) {
        try {
            console.log('[对账单] 开始处理对账单数据');
            
            // 分离发出单和收回单
            const sendOrders = data.filter(item => item.type === 'send' || item.order_type === 'send');
            const receiveOrders = data.filter(item => item.type === 'receive' || item.order_type === 'receive');
            
            // 计算统计数据
            const stats = this.calculateStatements(sendOrders, receiveOrders);
            
            // 处理货品汇总
            const productSummary = this.calculateProductSummary(data);
            
            // 处理付款记录（如果有）
            const paymentRecords = data.filter(item => item.payment_amount && item.payment_amount > 0);
            
            const statement = {
                sendOrders,
                receiveOrders,
                productSummary,
                paymentRecords,
                stats,
                // 财务数据
                totalAmount: stats.totalAmount,
                totalPayment: stats.totalPayment,
                finalBalance: stats.finalBalance,
                initialBalance: stats.initialBalance || 0
            };
            
            console.log('[对账单] 数据处理完成:', statement);
            return statement;
            
        } catch (error) {
            console.error('[对账单] 处理对账单数据时出错:', error);
            return {
                sendOrders: [],
                receiveOrders: [],
                productSummary: [],
                paymentRecords: [],
                stats: this.getEmptyStats()
            };
        }
    }
    
    // 🔢 计算对账统计数据
    calculateStatements(sendOrders, receiveOrders) {
        try {
            // 发出数据统计
            const sendStats = {
                count: sendOrders.length,
                totalWeight: sendOrders.reduce((sum, order) => sum + parseFloat(order.weight || 0), 0),
                totalQuantity: sendOrders.reduce((sum, order) => sum + parseInt(order.quantity || 0), 0),
                totalAmount: sendOrders.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0)
            };
            
            // 收回数据统计
            const receiveStats = {
                count: receiveOrders.length,
                totalWeight: receiveOrders.reduce((sum, order) => sum + parseFloat(order.weight || 0), 0),
                totalQuantity: receiveOrders.reduce((sum, order) => sum + parseInt(order.quantity || 0), 0),
                totalAmount: receiveOrders.reduce((sum, order) => sum + parseFloat(order.amount || 0), 0)
            };
            
            // 损耗计算
            const lossWeight = sendStats.totalWeight - receiveStats.totalWeight;
            const lossRate = sendStats.totalWeight > 0 ? (lossWeight / sendStats.totalWeight * 100) : 0;
            
            // 财务计算
            const totalAmount = sendStats.totalAmount;
            const totalPayment = receiveStats.totalAmount; // 假设收回单代表付款
            const finalBalance = totalAmount - totalPayment;
            
            return {
                send: sendStats,
                receive: receiveStats,
                lossWeight: Math.max(0, lossWeight),
                lossRate: Math.max(0, lossRate),
                totalAmount,
                totalPayment,
                finalBalance,
                initialBalance: 0
            };
            
        } catch (error) {
            console.error('[对账单] 计算统计数据时出错:', error);
            return this.getEmptyStats();
        }
    }
    
    // 📊 计算货品汇总
    calculateProductSummary(data) {
        try {
            const productMap = new Map();
            
            data.forEach(item => {
                const productKey = item.product_no || item.productNo || '未知货品';
                
                if (!productMap.has(productKey)) {
                    productMap.set(productKey, {
                        productNo: productKey,
                        productName: item.product_name || item.productName || '',
                        sendWeight: 0,
                        receiveWeight: 0,
                        sendQuantity: 0,
                        receiveQuantity: 0,
                        sendCount: 0,
                        receiveCount: 0
                    });
                }
                
                const product = productMap.get(productKey);
                
                if (item.type === 'send' || item.order_type === 'send') {
                    product.sendWeight += parseFloat(item.weight || 0);
                    product.sendQuantity += parseInt(item.quantity || 0);
                    product.sendCount += 1;
                } else if (item.type === 'receive' || item.order_type === 'receive') {
                    product.receiveWeight += parseFloat(item.weight || 0);
                    product.receiveQuantity += parseInt(item.quantity || 0);
                    product.receiveCount += 1;
                }
            });
            
            return Array.from(productMap.values()).map(product => ({
                ...product,
                lossWeight: Math.max(0, product.sendWeight - product.receiveWeight),
                lossRate: product.sendWeight > 0 ? 
                    ((product.sendWeight - product.receiveWeight) / product.sendWeight * 100) : 0
            }));
            
        } catch (error) {
            console.error('[对账单] 计算货品汇总时出错:', error);
            return [];
        }
    }
    
    // 🎨 渲染对账单内容
    renderStatementContent(container, statement) {
        try {
            const html = `
                <!-- 对账单头部信息 -->
                <div class="statement-header-card">
                    <div class="statement-title">
                        <h3>📊 工厂对账单</h3>
                        <div class="statement-period">
                            <span>统计期间: ${this.formatDateRange()}</span>
                        </div>
                    </div>
                    <div class="balance-info">
                        <div class="balance-item">
                            <span class="balance-label">期初欠款:</span>
                            <span class="balance-value">¥${statement.initialBalance.toFixed(2)}</span>
                        </div>
                        <div class="balance-item">
                            <span class="balance-label">期末欠款:</span>
                            <span class="balance-value ${statement.finalBalance > 0 ? 'debt' : 'credit'}">
                                ¥${statement.finalBalance.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- 统计汇总 -->
                <div class="statement-summary-grid">
                    <div class="summary-section send-section">
                        <h4>📤 发出汇总</h4>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">订单数量</span>
                                <span class="stat-value">${statement.stats.send.count}单</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总数量</span>
                                <span class="stat-value">${statement.stats.send.totalQuantity}打</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总重量</span>
                                <span class="stat-value">${statement.stats.send.totalWeight.toFixed(2)}kg</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-section receive-section">
                        <h4>📥 收回汇总</h4>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">订单数量</span>
                                <span class="stat-value">${statement.stats.receive.count}单</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总数量</span>
                                <span class="stat-value">${statement.stats.receive.totalQuantity}打</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">总重量</span>
                                <span class="stat-value">${statement.stats.receive.totalWeight.toFixed(2)}kg</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-section loss-section">
                        <h4>📊 损耗分析</h4>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <span class="stat-label">损耗重量</span>
                                <span class="stat-value loss-weight">${statement.stats.lossWeight.toFixed(2)}kg</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">损耗率</span>
                                <span class="stat-value ${this.getLossRateClass(statement.stats.lossRate)}">
                                    ${statement.stats.lossRate.toFixed(2)}%
                                </span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">货品种类</span>
                                <span class="stat-value">${statement.productSummary.length}种</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 财务汇总 -->
                <div class="financial-summary-card">
                    <h4>💰 财务汇总</h4>
                    <div class="financial-stats">
                        <div class="financial-item">
                            <span class="financial-label">应付金额:</span>
                            <span class="financial-value">¥${statement.stats.totalAmount.toFixed(2)}</span>
                        </div>
                        <div class="financial-item">
                            <span class="financial-label">已付金额:</span>
                            <span class="financial-value paid">¥${statement.stats.totalPayment.toFixed(2)}</span>
                        </div>
                        <div class="financial-item">
                            <span class="financial-label">余额:</span>
                            <span class="financial-value ${statement.stats.finalBalance > 0 ? 'debt' : 'credit'}">
                                ¥${statement.stats.finalBalance.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <!-- 货品明细 -->
                ${this.renderProductSummary(statement.productSummary)}
                
                <!-- 订单明细 -->
                ${this.renderOrderDetails(statement)}
                
                <!-- 付款记录 -->
                ${statement.paymentRecords.length > 0 ? this.renderPaymentRecords(statement.paymentRecords) : ''}
            `;
            
            container.innerHTML = html;
            
        } catch (error) {
            console.error('[对账单] 渲染对账单内容时出错:', error);
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">渲染对账单时出错</div>
                    <div class="error-detail">${error.message}</div>
                </div>
            `;
        }
    }
    
    handleLoadError(error) {
        console.error('对账单加载错误:', error.message);
        
        if (window.Utils && Utils.toast) {
            Utils.toast.error('加载对账单失败: ' + error.message);
        } else if (window.Common) {
            window.Common.showMessage('加载对账单失败: ' + error.message, 'error');
        }
    }
    
    // 刷新对账单数据
    refresh() {
        console.log('刷新对账单数据');
        this.currentPage = 1;
        this.loadStatementData();
    }
    
    // 设置过滤条件
    setFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        console.log('设置过滤条件:', this.filters);
        this.currentPage = 1;
        this.loadStatementData();
    }
    
    // 翻页
    goToPage(pageNum) {
        if (pageNum < 1 || pageNum > Math.ceil(this.totalCount / this.pageSize)) {
            return;
        }
        
        this.currentPage = pageNum;
        console.log('翻页到第', pageNum, '页');
        this.loadStatementData();
    }
    
    // 生成对账单
    async generateStatement(factoryId, dateRange) {
        try {
            console.log('开始生成对账单', { factoryId, dateRange });
            
            if (!factoryId) {
                throw new Error('请选择工厂');
            }
            
            if (window.Utils && Utils.loading) {
                Utils.loading.show('正在生成对账单...');
            }
            
            const response = await API.post('/statement/generate', {
                factoryId,
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
            
            if (response.success) {
                console.log('对账单生成成功');
                if (window.Utils && Utils.toast) {
                    Utils.toast.success('对账单生成成功');
                }
                this.refresh();
            } else {
                throw new Error(response.message || '生成对账单失败');
            }
            
        } catch (error) {
            console.error('生成对账单失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('生成失败: ' + error.message);
            }
        } finally {
            if (window.Utils && Utils.loading) {
                Utils.loading.hide();
            }
        }
    }
    
    // 导出对账单
    async exportStatement(statementId) {
        try {
            console.log('开始导出对账单', statementId);
            
            if (window.Utils && Utils.toast) {
                Utils.toast.info('对账单导出功能开发中...');
            }
            
        } catch (error) {
            console.error('导出对账单失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('导出失败: ' + error.message);
            }
        }
    }
    
    // 确认对账单
    async confirmStatement(statementId) {
        try {
            console.log('确认对账单', statementId);
            
            const response = await API.post(`/statement/${statementId}/confirm`);
            
            if (response.success) {
                if (window.Utils && Utils.toast) {
                    Utils.toast.success('对账单确认成功');
                }
                this.refresh();
            } else {
                throw new Error(response.message || '确认对账单失败');
            }
            
        } catch (error) {
            console.error('确认对账单失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('确认失败: ' + error.message);
            }
        }
    }
    
    // 🎯 渲染货品汇总
    renderProductSummary(productSummary) {
        if (!productSummary || productSummary.length === 0) {
            return '<div class="no-products">暂无货品数据</div>';
        }
        
        const productRows = productSummary.map(product => `
            <tr class="product-row">
                <td class="product-no">${product.productNo}</td>
                <td class="product-name">${product.productName || '-'}</td>
                <td class="number-cell">${product.sendCount}</td>
                <td class="number-cell">${product.receiveCount}</td>
                <td class="number-cell">${product.sendWeight.toFixed(2)}kg</td>
                <td class="number-cell">${product.receiveWeight.toFixed(2)}kg</td>
                <td class="number-cell ${this.getLossRateClass(product.lossRate)}">
                    ${product.lossRate.toFixed(2)}%
                </td>
            </tr>
        `).join('');
        
        return `
            <div class="product-summary-card">
                <h4>📦 货品明细汇总</h4>
                <div class="product-table-container">
                    <table class="product-summary-table">
                        <thead>
                            <tr>
                                <th>货号</th>
                                <th>名称</th>
                                <th>发出单数</th>
                                <th>收回单数</th>
                                <th>发出重量</th>
                                <th>收回重量</th>
                                <th>损耗率</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // 🎯 渲染订单明细
    renderOrderDetails(statement) {
        const hasOrders = statement.sendOrders.length > 0 || statement.receiveOrders.length > 0;
        
        if (!hasOrders) {
            return `
                <div class="no-orders-card">
                    <div class="no-orders-icon">📋</div>
                    <div class="no-orders-text">暂无订单数据</div>
                    <div class="no-orders-desc">请调整筛选条件或检查数据</div>
                </div>
            `;
        }
        
        return `
            <div class="order-details-card">
                <h4>📋 订单明细</h4>
                <div class="order-tabs">
                    <button class="order-tab active" onclick="window.statement.switchOrderTab('send')" data-tab="send">
                        📤 发出单 (${statement.sendOrders.length})
                    </button>
                    <button class="order-tab" onclick="window.statement.switchOrderTab('receive')" data-tab="receive">
                        📥 收回单 (${statement.receiveOrders.length})
                    </button>
                </div>
                <div class="order-content">
                    <div id="sendOrderTab" class="order-tab-content active">
                        ${this.renderOrderTable(statement.sendOrders, 'send')}
                    </div>
                    <div id="receiveOrderTab" class="order-tab-content">
                        ${this.renderOrderTable(statement.receiveOrders, 'receive')}
                    </div>
                </div>
            </div>
        `;
    }
    
    // 🎯 渲染订单表格
    renderOrderTable(orders, type) {
        if (!orders || orders.length === 0) {
            return `
                <div class="empty-orders">
                    <div class="empty-icon">${type === 'send' ? '📤' : '📥'}</div>
                    <div class="empty-text">暂无${type === 'send' ? '发出' : '收回'}单</div>
                </div>
            `;
        }
        
        const orderRows = orders.map(order => `
            <tr class="order-row ${type}-order">
                <td>${order.order_no || order.orderNo || '-'}</td>
                <td>${order.product_no || order.productNo || '-'}</td>
                <td>${order.product_name || order.productName || '-'}</td>
                <td class="number-cell">${parseInt(order.quantity || 0)}打</td>
                <td class="number-cell">${parseFloat(order.weight || 0).toFixed(2)}kg</td>
                <td>${this.formatDate(order.date || order.created_at)}</td>
                <td>
                    <span class="order-status ${this.getOrderStatusClass(order.status)}">
                        ${this.getOrderStatusText(order.status)}
                    </span>
                </td>
            </tr>
        `).join('');
        
        return `
            <div class="order-table-container">
                <table class="order-table">
                    <thead>
                        <tr>
                            <th>订单号</th>
                            <th>货号</th>
                            <th>货品名称</th>
                            <th>数量</th>
                            <th>重量</th>
                            <th>日期</th>
                            <th>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    // 🎯 渲染付款记录
    renderPaymentRecords(paymentRecords) {
        const paymentRows = paymentRecords.map(payment => `
            <tr class="payment-row">
                <td>${this.formatDate(payment.payment_date || payment.date)}</td>
                <td class="number-cell">¥${parseFloat(payment.payment_amount || 0).toFixed(2)}</td>
                <td>${payment.payment_method || '现金'}</td>
                <td>${payment.remark || '-'}</td>
                <td>
                    <span class="payment-status confirmed">已确认</span>
                </td>
            </tr>
        `).join('');
        
        return `
            <div class="payment-records-card">
                <h4>💳 付款记录明细</h4>
                <div class="payment-table-container">
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th>付款日期</th>
                                <th>付款金额</th>
                                <th>付款方式</th>
                                <th>备注</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paymentRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // 🎯 渲染空状态
    renderEmptyState(container) {
        container.innerHTML = `
            <div class="empty-statement">
                <div class="empty-icon">📊</div>
                <div class="empty-title">暂无对账单数据</div>
                <div class="empty-description">请选择工厂和日期范围来生成对账单</div>
                <button class="empty-action-btn" onclick="window.statement.showFilterOptions()">
                    设置筛选条件
                </button>
            </div>
        `;
    }
    
    // 🛠️ 工具方法
    formatDate(dateStr) {
        if (!dateStr) return '-';
        
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '-';
            
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch (error) {
            return '-';
        }
    }
    
    formatDateRange() {
        const start = this.filters.startDate || '未设置';
        const end = this.filters.endDate || '未设置';
        return `${start} 至 ${end}`;
    }
    
    getLossRateClass(lossRate) {
        const rate = parseFloat(lossRate || 0);
        if (rate <= 2) return 'loss-low';
        if (rate <= 5) return 'loss-medium';
        return 'loss-high';
    }
    
    getOrderStatusClass(status) {
        switch (status?.toLowerCase()) {
            case 'completed': return 'status-completed';
            case 'processing': return 'status-processing';
            case 'pending': return 'status-pending';
            default: return 'status-unknown';
        }
    }
    
    getOrderStatusText(status) {
        switch (status?.toLowerCase()) {
            case 'completed': return '已完成';
            case 'processing': return '进行中';
            case 'pending': return '待处理';
            default: return '未知';
        }
    }
    
    getEmptyStats() {
        return {
            send: { count: 0, totalWeight: 0, totalQuantity: 0, totalAmount: 0 },
            receive: { count: 0, totalWeight: 0, totalQuantity: 0, totalAmount: 0 },
            lossWeight: 0,
            lossRate: 0,
            totalAmount: 0,
            totalPayment: 0,
            finalBalance: 0,
            initialBalance: 0
        };
    }
    
    // 🎯 切换订单选项卡
    switchOrderTab(tabType) {
        try {
            // 更新选项卡样式
            document.querySelectorAll('.order-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelector(`[data-tab="${tabType}"]`).classList.add('active');
            
            // 更新内容显示
            document.querySelectorAll('.order-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabType}OrderTab`).classList.add('active');
            
        } catch (error) {
            console.error('[对账单] 切换选项卡失败:', error);
        }
    }
    
    // 🎯 处理渲染错误
    handleRenderError(error) {
        const statementContent = document.getElementById('statementContent');
        if (statementContent) {
            statementContent.innerHTML = `
                <div class="render-error">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">渲染失败</div>
                    <div class="error-message">${error.message}</div>
                    <button class="retry-btn" onclick="window.statement.refresh()">重试</button>
                </div>
            `;
        }
        
        if (window.Utils && Utils.toast) {
            Utils.toast.error('渲染对账单失败');
        }
    }
    
    // 🎯 显示筛选选项
    showFilterOptions() {
        // 滚动到筛选区域
        const filterSection = document.querySelector('.apple-grid.apple-grid-4');
        if (filterSection) {
            filterSection.scrollIntoView({ behavior: 'smooth' });
            
                         // 高亮筛选区域
            filterSection.style.animation = 'highlight 2s ease-in-out';
            setTimeout(() => {
                filterSection.style.animation = '';
            }, 2000);
        }
    }
    
    // 🎯 工厂搜索功能 - 支持拼音搜索
    onFactorySearch(event) {
        const keyword = event.target.value.trim();
        console.log('[对账单] 工厂搜索:', keyword);
        
        try {
            if (!keyword) {
                this.filteredFactories = [...this.factories];
            } else {
                this.filteredFactories = this.filterFactoriesWithPinyin(keyword);
            }
            
            this.updateFactoryDropdown();
            this.showFactoryDropdown();
            
        } catch (error) {
            console.error('[对账单] 工厂搜索失败:', error);
        }
    }
    
    // 🎯 货品搜索功能 - 支持拼音搜索
    onProductSearch(event) {
        const keyword = event.target.value.trim();
        console.log('[对账单] 货品搜索:', keyword);
        
        try {
            if (!keyword) {
                this.filteredProducts = [...this.products];
            } else {
                this.filteredProducts = this.filterProductsWithPinyin(keyword);
            }
            
            this.updateProductDropdown();
            this.showProductDropdown();
            
        } catch (error) {
            console.error('[对账单] 货品搜索失败:', error);
        }
    }
    
    // 🔍 工厂拼音搜索过滤
    filterFactoriesWithPinyin(keyword) {
        try {
            return this.factories.filter(factory => {
                const searchFields = [
                    factory.name || '',
                    factory.contact || '',
                    factory.phone || ''
                ];
                
                // 🎯 使用拼音搜索工具（如果可用）
                if (window.PinyinUtils && window.PinyinUtils.searchMatch) {
                    return searchFields.some(field => 
                        window.PinyinUtils.searchMatch(field, keyword)
                    );
                }
                
                // 🔄 备用方案：直接字符串匹配
                const lowerKeyword = keyword.toLowerCase();
                return searchFields.some(field => 
                    field.toLowerCase().includes(lowerKeyword)
                );
            });
        } catch (error) {
            console.error('[对账单] 工厂拼音搜索失败:', error);
            return this.factories;
        }
    }
    
    // 🔍 货品拼音搜索过滤
    filterProductsWithPinyin(keyword) {
        try {
            return this.products.filter(product => {
                const searchFields = [
                    product.productNo || product.code || '',
                    product.name || '',
                    product.description || ''
                ];
                
                // 🎯 使用拼音搜索工具（如果可用）
                if (window.PinyinUtils && window.PinyinUtils.searchMatch) {
                    return searchFields.some(field => 
                        window.PinyinUtils.searchMatch(field, keyword)
                    );
                }
                
                // 🔄 备用方案：直接字符串匹配
                const lowerKeyword = keyword.toLowerCase();
                return searchFields.some(field => 
                    field.toLowerCase().includes(lowerKeyword)
                );
            });
        } catch (error) {
            console.error('[对账单] 货品拼音搜索失败:', error);
            return this.products;
        }
    }
    
    // 🎯 更新工厂下拉框
    updateFactoryDropdown() {
        try {
            const dropdown = document.getElementById('statementFactoryDropdown');
            if (!dropdown) return;
            
            const content = dropdown.querySelector('.dropdown-content');
            if (!content) return;
            
            // 清空现有选项
            content.innerHTML = `
                <div class="dropdown-item" data-factory-id="" onclick="window.statement.selectFactory('')">
                    <span>请选择工厂</span>
                </div>
            `;
            
            // 添加工厂选项
            this.filteredFactories.forEach(factory => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.dataset.factoryId = factory.id;
                item.onclick = () => this.selectFactory(factory);
                
                item.innerHTML = `
                    <div class="factory-info">
                        <span class="factory-name">${factory.name}</span>
                        <span class="factory-details">${factory.contact || ''} ${factory.phone || ''}</span>
                    </div>
                `;
                
                content.appendChild(item);
            });
            
        } catch (error) {
            console.error('[对账单] 更新工厂下拉框失败:', error);
        }
    }
    
    // 🎯 更新货品下拉框
    updateProductDropdown() {
        try {
            const dropdown = document.getElementById('statementProductDropdown');
            if (!dropdown) return;
            
            const content = dropdown.querySelector('.dropdown-content');
            if (!content) return;
            
            // 清空现有选项
            content.innerHTML = `
                <div class="dropdown-item active" data-product-id="" onclick="window.statement.selectProduct('')">
                    <span>全部货品</span>
                    <span class="check-mark">✓</span>
                </div>
            `;
            
            // 添加货品选项
            this.filteredProducts.forEach(product => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.dataset.productId = product.id;
                item.onclick = () => this.selectProduct(product);
                
                item.innerHTML = `
                    <div class="product-info">
                        <span class="product-no">${product.productNo || product.code}</span>
                        <span class="product-name">${product.name || ''}</span>
                    </div>
                `;
                
                content.appendChild(item);
            });
            
        } catch (error) {
            console.error('[对账单] 更新货品下拉框失败:', error);
        }
    }
    
    // 🎯 选择工厂
    selectFactory(factory) {
        try {
            const input = document.getElementById('statementFactorySearch');
            if (!input) return;
            
            if (!factory) {
                input.value = '';
                this.filters.factoryId = '';
                this.filters.factoryName = '';
            } else {
                input.value = factory.name;
                this.filters.factoryId = factory.id;
                this.filters.factoryName = factory.name;
            }
            
            this.hideFactoryDropdown();
            console.log('[对账单] 选择工厂:', factory?.name || '无');
            
        } catch (error) {
            console.error('[对账单] 选择工厂失败:', error);
        }
    }
    
    // 🎯 选择货品
    selectProduct(product) {
        try {
            const input = document.getElementById('statementProductSearch');
            if (!input) return;
            
            if (!product) {
                input.value = '全部货品';
                this.filters.productId = '';
                this.filters.productNo = '';
            } else {
                input.value = product.productNo || product.code;
                this.filters.productId = product.id;
                this.filters.productNo = product.productNo || product.code;
            }
            
            this.hideProductDropdown();
            console.log('[对账单] 选择货品:', product?.productNo || '全部');
            
        } catch (error) {
            console.error('[对账单] 选择货品失败:', error);
        }
    }
    
    // 🎯 显示/隐藏下拉框
    showFactoryDropdown() {
        const dropdown = document.getElementById('statementFactoryDropdown');
        if (dropdown) dropdown.style.display = 'block';
    }
    
    hideFactoryDropdown() {
        setTimeout(() => {
            const dropdown = document.getElementById('statementFactoryDropdown');
            if (dropdown) dropdown.style.display = 'none';
        }, 200);
    }
    
    showProductDropdown() {
        const dropdown = document.getElementById('statementProductDropdown');
        if (dropdown) dropdown.style.display = 'block';
    }
    
    hideProductDropdown() {
        setTimeout(() => {
            const dropdown = document.getElementById('statementProductDropdown');
            if (dropdown) dropdown.style.display = 'none';
        }, 200);
    }
    
    // 🎯 应用筛选条件
    applyFilters() {
        try {
            // 获取日期筛选
            const startDateInput = document.getElementById('statementStartDate');
            const endDateInput = document.getElementById('statementEndDate');
            
            if (startDateInput?.value) {
                this.filters.startDate = startDateInput.value;
            }
            if (endDateInput?.value) {
                this.filters.endDate = endDateInput.value;
            }
            
            console.log('[对账单] 应用筛选条件:', this.filters);
            
            // 验证必填字段
            if (!this.filters.factoryId) {
                if (window.Utils && Utils.toast) {
                    Utils.toast.error('请先选择工厂');
                } else {
                    alert('请先选择工厂');
                }
                return;
            }
            
            // 重新加载对账单数据
            this.currentPage = 1;
            this.loadStatementData();
            
        } catch (error) {
            console.error('[对账单] 应用筛选失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('应用筛选失败');
            }
        }
    }
    
    // 🧹 清空筛选条件
    clearFilters() {
        try {
            // 重置筛选条件
            this.filters = {
                startDate: '',
                endDate: '',
                factoryId: '',
                factoryName: '',
                productId: '',
                productNo: '',
                status: ''
            };
            
            // 重置UI
            const factoryInput = document.getElementById('statementFactorySearch');
            const productInput = document.getElementById('statementProductSearch');
            const startDateInput = document.getElementById('statementStartDate');
            const endDateInput = document.getElementById('statementEndDate');
            
            if (factoryInput) factoryInput.value = '';
            if (productInput) productInput.value = '全部货品';
            if (startDateInput) startDateInput.value = '';
            if (endDateInput) endDateInput.value = '';
            
            // 重新初始化日期范围
            this.initDateRange();
            
            // 清空对账单内容
            const statementContent = document.getElementById('statementContent');
            if (statementContent) {
                this.renderEmptyState(statementContent);
            }
            
            console.log('[对账单] 筛选条件已清空');
            
            if (window.Utils && Utils.toast) {
                Utils.toast.success('筛选条件已重置');
            }
            
        } catch (error) {
            console.error('[对账单] 清空筛选失败:', error);
        }
    }
}

// 🎯 全局初始化函数 - 增强健壮性
function initStatementPage() {
    try {
        // 对账单页面已在主HTML中有完整结构，直接初始化管理器
        if (!window.statement) {
            window.statement = new Statement();
            console.log('[对账单] 已初始化对账单页面');
        } else {
            console.log('[对账单] 对账单页面已存在，重新初始化');
            window.statement.refresh();
        }
    } catch (error) {
        console.error('[对账单] 初始化对账单页面失败:', error);
    }
}

// 🎯 全局函数：生成对账单
function generateStatement() {
    if (window.statement && typeof window.statement.generateStatement === 'function') {
        const factorySelect = document.getElementById('statementFactory');
        const startDateInput = document.getElementById('statementStartDate');
        const endDateInput = document.getElementById('statementEndDate');
        
        const factoryId = factorySelect?.value;
        const dateRange = {
            startDate: startDateInput?.value,
            endDate: endDateInput?.value
        };
        
        window.statement.generateStatement(factoryId, dateRange);
    } else {
        console.error('[对账单] 对账单管理器未初始化');
        if (window.Utils && Utils.toast) {
            Utils.toast.error('对账单功能未初始化');
        }
    }
}

// 🎯 全局函数：导出对账单
function exportStatement() {
    if (window.statement && typeof window.statement.exportStatement === 'function') {
        window.statement.exportStatement();
    } else {
        console.error('[对账单] 对账单管理器未初始化');
        if (window.Utils && Utils.toast) {
            Utils.toast.error('对账单功能未初始化');
        }
    }
}

// 导出模块
window.Statement = Statement;
window.initStatementPage = initStatementPage;
window.generateStatement = generateStatement;
window.exportStatement = exportStatement; 