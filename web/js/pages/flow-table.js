// 流水表页面功能
class FlowTable {
    constructor() {
        this.isLoading = false;
        this.tableData = [];
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalCount = 0;
        this.filters = {
            startDate: '',
            endDate: '',
            factoryId: '',
            processId: ''
        };
        
        this.init();
    }
    
    init() {
        console.log('初始化流水表页面');
        this.initDateRange();
        this.loadTableData();
    }
    
    initDateRange() {
        // 默认显示最近7天的数据
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        this.filters.startDate = weekAgo.toISOString().split('T')[0];
        this.filters.endDate = now.toISOString().split('T')[0];
        
        console.log('初始化日期范围:', this.filters);
    }
    
    async loadTableData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            console.log('开始加载流水表数据...');
            
            if (!window.API) {
                throw new Error('API模块未加载');
            }
            
            // 构建查询参数
            const params = {
                page: this.currentPage,
                pageSize: this.pageSize,
                ...this.filters
            };
            
            // 🔧 修复API接口调用 - 使用正确的流水记录接口
            let response;
            try {
                // 🎯 使用正确的流水记录接口
                if (API.flowRecords && typeof API.flowRecords.getList === 'function') {
                    response = await API.flowRecords.getList(params);
                } else if (API.get && typeof API.get === 'function') {
                    // 备用方案：直接使用通用API
                    response = await API.get('/flow-records', params);
                } else {
                    throw new Error('流水记录接口不可用');
                }
            } catch (error) {
                console.error('[流水表] 流水记录接口调用失败:', error);
                // 🔄 尝试备用接口
                try {
                    if (API.stats && typeof API.stats.flowAnalysis === 'function') {
                        console.log('[流水表] 尝试使用流水分析接口...');
                        response = await API.stats.flowAnalysis(params);
                    } else {
                        throw new Error('备用接口也不可用');
                    }
                } catch (backupError) {
                    console.error('[流水表] 备用接口也失败:', backupError);
                    throw error; // 抛出原始错误
                }
            }
            
            if (response && response.success) {
                this.tableData = response.data?.records || response.data || [];
                this.totalCount = response.data?.total || this.tableData.length;
                console.log('流水表数据加载成功:', this.tableData.length, '条记录');
                this.renderTableData();
            } else {
                throw new Error(response?.message || '加载流水表失败');
            }
            
        } catch (error) {
            console.error('加载流水表数据失败:', error);
            this.handleLoadError(error);
        } finally {
            this.isLoading = false;
        }
    }
    
    renderTableData() {
        console.log('[流水表] 开始渲染流水表数据，记录数:', this.tableData.length);
        
        try {
            const tableBody = document.getElementById('flowTableBody');
            const emptyState = document.getElementById('flowEmptyState');
            
            if (!tableBody) {
                console.error('[流水表] 未找到表格body元素');
                return;
            }
            
            // 🔄 清空现有数据
            tableBody.innerHTML = '';
            
            if (!Array.isArray(this.tableData) || this.tableData.length === 0) {
                console.log('[流水表] 无有效的表格数据，显示空状态');
                if (emptyState) {
                    emptyState.style.display = 'block';
                }
                this.updateStatistics({ totalSend: 0, totalReceive: 0, avgLoss: 0 });
                return;
            }
            
            // 🎯 隐藏空状态，显示数据
            if (emptyState) {
                emptyState.style.display = 'none';
            }
            
            // 📊 计算统计数据
            let totalSendWeight = 0;
            let totalReceiveWeight = 0;
            let recordsWithBothWeights = 0;
            
            // 🎨 渲染表格行
            this.tableData.forEach((record, index) => {
                const row = this.createTableRow(record, index);
                tableBody.appendChild(row);
                
                // 计算统计数据
                const sendWeight = parseFloat(record.send_weight || record.weight || 0);
                const receiveWeight = parseFloat(record.receive_weight || record.return_weight || 0);
                
                totalSendWeight += sendWeight;
                totalReceiveWeight += receiveWeight;
                
                if (sendWeight > 0 && receiveWeight > 0) {
                    recordsWithBothWeights++;
                }
            });
            
            // 🔢 计算并更新统计数据
            const avgLossRate = recordsWithBothWeights > 0 
                ? ((totalSendWeight - totalReceiveWeight) / totalSendWeight * 100)
                : 0;
                
            this.updateStatistics({
                totalSend: totalSendWeight,
                totalReceive: totalReceiveWeight,
                avgLoss: Math.max(0, avgLossRate)
            });
            
            console.log('[流水表] 表格渲染完成，统计数据已更新');
            
        } catch (error) {
            console.error('[流水表] 渲染表格数据时出错:', error);
            this.handleRenderError(error);
        }
    }
    
    // 🎯 创建表格行
    createTableRow(record, index) {
        const row = document.createElement('tr');
        row.className = index % 2 === 0 ? 'table-row-even' : 'table-row-odd';
        
        // 计算损耗率
        const sendWeight = parseFloat(record.send_weight || record.weight || 0);
        const receiveWeight = parseFloat(record.receive_weight || record.return_weight || 0);
        const lossRate = sendWeight > 0 ? ((sendWeight - receiveWeight) / sendWeight * 100) : 0;
        const lossClass = lossRate > 10 ? 'high-loss' : lossRate > 5 ? 'medium-loss' : 'low-loss';
        
        row.innerHTML = `
            <td title="${record.product_no || '-'}">${record.product_no || '-'}</td>
            <td title="${record.factory_name || '-'}">${record.factory_name || '-'}</td>
            <td title="${record.process_name || '-'}">${record.process_name || '-'}</td>
            <td class="number-cell">${sendWeight.toFixed(2)}kg</td>
            <td class="number-cell">${receiveWeight.toFixed(2)}kg</td>
            <td class="number-cell ${lossClass}">${lossRate.toFixed(1)}%</td>
            <td>${this.formatDate(record.send_date || record.date)}</td>
            <td>${this.formatDate(record.receive_date || record.return_date)}</td>
            <td>
                <span class="status-badge ${this.getStatusClass(record)}">
                    ${this.getStatusText(record)}
                </span>
            </td>
        `;
        
        return row;
    }
    
    // 🎯 更新统计数据显示
    updateStatistics(stats) {
        try {
            const elements = {
                totalSend: document.getElementById('flowTotalSendWeight'),
                totalReceive: document.getElementById('flowTotalReceiveWeight'),
                avgLoss: document.getElementById('flowAvgLossRate')
            };
            
            if (elements.totalSend) {
                elements.totalSend.textContent = `${stats.totalSend.toFixed(2)}kg`;
            }
            
            if (elements.totalReceive) {
                elements.totalReceive.textContent = `${stats.totalReceive.toFixed(2)}kg`;
            }
            
            if (elements.avgLoss) {
                elements.avgLoss.textContent = `${stats.avgLoss.toFixed(2)}%`;
                
                // 根据损耗率设置颜色
                if (stats.avgLoss > 10) {
                    elements.avgLoss.style.color = 'var(--apple-red)';
                } else if (stats.avgLoss > 5) {
                    elements.avgLoss.style.color = 'var(--apple-orange)';
                } else {
                    elements.avgLoss.style.color = 'var(--apple-green)';
                }
            }
            
        } catch (error) {
            console.error('[流水表] 更新统计数据时出错:', error);
        }
    }
    
    // 🎯 格式化日期
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
    
    // 🎯 获取状态样式类
    getStatusClass(record) {
        const sendWeight = parseFloat(record.send_weight || record.weight || 0);
        const receiveWeight = parseFloat(record.receive_weight || record.return_weight || 0);
        
        if (sendWeight > 0 && receiveWeight > 0) return 'status-completed';
        if (sendWeight > 0 && receiveWeight === 0) return 'status-processing';
        return 'status-pending';
    }
    
    // 🎯 获取状态文本
    getStatusText(record) {
        const sendWeight = parseFloat(record.send_weight || record.weight || 0);
        const receiveWeight = parseFloat(record.receive_weight || record.return_weight || 0);
        
        if (sendWeight > 0 && receiveWeight > 0) return '已完成';
        if (sendWeight > 0 && receiveWeight === 0) return '进行中';
        return '待发出';
    }
    
    // 🛡️ 处理渲染错误
    handleRenderError(error) {
        console.error('[流水表] 渲染错误:', error);
        
        const tableBody = document.getElementById('flowTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 32px; color: var(--apple-red);">
                        渲染数据时出错: ${error.message}
                    </td>
                </tr>
            `;
        }
        
        if (window.Utils && Utils.toast) {
            Utils.toast.error('渲染流水表数据失败');
        }
    }
    
    handleLoadError(error) {
        console.error('流水表加载错误:', error.message);
        
        if (window.Utils && Utils.toast) {
            Utils.toast.error('加载流水表失败: ' + error.message);
        } else if (window.Common) {
            window.Common.showMessage('加载流水表失败: ' + error.message, 'error');
        }
    }
    
    // 刷新表格数据
    refresh() {
        console.log('刷新流水表数据');
        this.currentPage = 1;
        this.loadTableData();
    }
    
    // 设置过滤条件
    setFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        console.log('设置过滤条件:', this.filters);
        this.currentPage = 1;
        this.loadTableData();
    }
    
    // 翻页
    goToPage(pageNum) {
        if (pageNum < 1 || pageNum > Math.ceil(this.totalCount / this.pageSize)) {
            return;
        }
        
        this.currentPage = pageNum;
        console.log('翻页到第', pageNum, '页');
        this.loadTableData();
    }
    
    // 🎯 显示筛选模态框 - 对齐微信小程序筛选功能
    showFilterModal() {
        try {
            console.log('[流水表] 显示筛选模态框');
            
            // 🎨 创建筛选模态框
            const modal = this.createFilterModal();
            document.body.appendChild(modal);
            
            // 🎯 初始化筛选数据
            this.loadFilterData();
            
            // ✨ 显示模态框
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
        } catch (error) {
            console.error('[流水表] 显示筛选模态框失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('显示筛选失败');
            }
        }
    }
    
    // 🎨 创建筛选模态框
    createFilterModal() {
        const modal = document.createElement('div');
        modal.className = 'flow-filter-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.flowTable.hideFilterModal()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔍 筛选流水记录</h3>
                    <button class="modal-close-btn" onclick="window.flowTable.hideFilterModal()">×</button>
                </div>
                <div class="modal-body">
                    <!-- 货品选择 -->
                    <div class="filter-group">
                        <label class="filter-label">货品选择</label>
                        <div class="product-search-container">
                            <input 
                                type="text" 
                                id="filterProductSearch" 
                                class="filter-input" 
                                placeholder="搜索货品..." 
                                oninput="window.flowTable.onProductFilterSearch(event)"
                                onfocus="window.flowTable.showProductFilterDropdown()"
                                onblur="window.flowTable.hideProductFilterDropdown()"
                            />
                            <div class="product-filter-dropdown" id="productFilterDropdown" style="display: none;">
                                <div class="dropdown-content">
                                    <div class="dropdown-item active" data-product="">
                                        <span>全部货品</span>
                                        <span class="check-mark">✓</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 工厂选择 -->
                    <div class="filter-group">
                        <label class="filter-label">工厂选择</label>
                        <div class="factory-search-container">
                            <input 
                                type="text" 
                                id="filterFactorySearch" 
                                class="filter-input" 
                                placeholder="搜索工厂..." 
                                oninput="window.flowTable.onFactoryFilterSearch(event)"
                                onfocus="window.flowTable.showFactoryFilterDropdown()"
                                onblur="window.flowTable.hideFactoryFilterDropdown()"
                            />
                            <div class="factory-filter-dropdown" id="factoryFilterDropdown" style="display: none;">
                                <div class="dropdown-content">
                                    <div class="dropdown-item active" data-factory="">
                                        <span>全部工厂</span>
                                        <span class="check-mark">✓</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 日期范围 -->
                    <div class="filter-group">
                        <label class="filter-label">日期范围</label>
                        <div class="date-range-container">
                            <input type="date" id="filterStartDate" class="filter-input" value="${this.filters.startDate}">
                            <span class="date-separator">至</span>
                            <input type="date" id="filterEndDate" class="filter-input" value="${this.filters.endDate}">
                        </div>
                    </div>
                    
                    <!-- 工序选择 -->
                    <div class="filter-group">
                        <label class="filter-label">工序选择</label>
                        <select id="filterProcess" class="filter-input">
                            <option value="">全部工序</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="window.flowTable.clearFilterModal()">重置</button>
                    <button class="btn-primary" onclick="window.flowTable.applyFilters()">确定</button>
                </div>
            </div>
        `;
        
        return modal;
    }
    
    // 🎯 加载筛选数据
    async loadFilterData() {
        try {
            // 并行加载货品和工厂数据
            const promises = [];
            
            if (API.products && typeof API.products.getList === 'function') {
                promises.push(API.products.getList());
            }
            
            if (API.factories && typeof API.factories.getList === 'function') {
                promises.push(API.factories.getList());
            }
            
            if (API.processes && typeof API.processes.getList === 'function') {
                promises.push(API.processes.getList());
            }
            
            const results = await Promise.allSettled(promises);
            
            // 处理货品数据
            if (results[0]?.status === 'fulfilled') {
                this.updateProductFilterDropdown(results[0].value?.data || []);
            }
            
            // 处理工厂数据
            if (results[1]?.status === 'fulfilled') {
                this.updateFactoryFilterDropdown(results[1].value?.data || []);
            }
            
            // 处理工序数据
            if (results[2]?.status === 'fulfilled') {
                this.updateProcessFilterOptions(results[2].value?.data || []);
            }
            
        } catch (error) {
            console.error('[流水表] 加载筛选数据失败:', error);
        }
    }
    
    // 🔄 隐藏筛选模态框
    hideFilterModal() {
        const modal = document.querySelector('.flow-filter-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(modal);
            }, 300);
        }
    }
    
    // 🎯 应用筛选条件
    applyFilters() {
        try {
            // 获取筛选条件
            const productInput = document.getElementById('filterProductSearch');
            const factoryInput = document.getElementById('filterFactorySearch');
            const startDateInput = document.getElementById('filterStartDate');
            const endDateInput = document.getElementById('filterEndDate');
            const processSelect = document.getElementById('filterProcess');
            
            const newFilters = {
                productNo: productInput?.dataset.productNo || '',
                factoryId: factoryInput?.dataset.factoryId || '',
                startDate: startDateInput?.value || '',
                endDate: endDateInput?.value || '',
                processId: processSelect?.value || ''
            };
            
            console.log('[流水表] 应用筛选条件:', newFilters);
            
            // 更新筛选条件并重新加载数据
            this.setFilters(newFilters);
            
            // 隐藏模态框
            this.hideFilterModal();
            
            // 显示成功提示
            if (window.Utils && Utils.toast) {
                Utils.toast.success('筛选条件已应用');
            }
            
        } catch (error) {
            console.error('[流水表] 应用筛选失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('应用筛选失败');
            }
        }
    }
    
    // 🧹 清空筛选模态框
    clearFilterModal() {
        try {
            const inputs = document.querySelectorAll('.flow-filter-modal .filter-input');
            inputs.forEach(input => {
                input.value = '';
                input.removeAttribute('data-product-no');
                input.removeAttribute('data-factory-id');
            });
            
            const selects = document.querySelectorAll('.flow-filter-modal select');
            selects.forEach(select => {
                select.selectedIndex = 0;
            });
            
            console.log('[流水表] 筛选条件已清空');
            
        } catch (error) {
            console.error('[流水表] 清空筛选失败:', error);
        }
    }
    
    // 🎯 快速筛选功能 - 对齐微信小程序
    applyTodayFilter() {
        const today = new Date().toISOString().split('T')[0];
        this.setFilters({
            ...this.filters,
            startDate: today,
            endDate: today
        });
    }
    
    applyWeekFilter() {
        const now = new Date();
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        this.setFilters({
            ...this.filters,
            startDate: weekStart.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0]
        });
    }
    
    applyMonthFilter() {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        this.setFilters({
            ...this.filters,
            startDate: monthStart.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0]
        });
    }
    
    applyHighLossFilter() {
        // 高损耗筛选逻辑需要在渲染后进行客户端过滤
        console.log('[流水表] 应用高损耗筛选');
        this.filterHighLoss = true;
        this.renderTableData();
    }
    
    // 导出流水表
    async exportTable() {
        try {
            console.log('[流水表] 开始导出流水表');
            
            if (window.Utils && Utils.toast) {
                Utils.toast.info('流水表导出功能开发中...');
            }
            
        } catch (error) {
            console.error('[流水表] 导出流水表失败:', error);
            if (window.Utils && Utils.toast) {
                Utils.toast.error('导出失败: ' + error.message);
            }
        }
    }
    
    // 🎯 货品筛选搜索 - 支持拼音搜索
    onProductFilterSearch(event) {
        const keyword = event.target.value.trim();
        console.log('[流水表] 货品筛选搜索:', keyword);
        
        try {
            if (this.allProducts && Array.isArray(this.allProducts)) {
                const filtered = this.filterProductsWithPinyin(this.allProducts, keyword);
                this.updateProductFilterDropdown(filtered);
            }
        } catch (error) {
            console.error('[流水表] 货品筛选搜索失败:', error);
        }
    }
    
    // 🎯 工厂筛选搜索 - 支持拼音搜索
    onFactoryFilterSearch(event) {
        const keyword = event.target.value.trim();
        console.log('[流水表] 工厂筛选搜索:', keyword);
        
        try {
            if (this.allFactories && Array.isArray(this.allFactories)) {
                const filtered = this.filterFactoriesWithPinyin(this.allFactories, keyword);
                this.updateFactoryFilterDropdown(filtered);
            }
        } catch (error) {
            console.error('[流水表] 工厂筛选搜索失败:', error);
        }
    }
    
    // 🔍 货品拼音搜索过滤
    filterProductsWithPinyin(products, keyword) {
        if (!keyword) return products;
        
        try {
            return products.filter(product => {
                // 检查多个字段
                const searchFields = [
                    product.productNo || '',
                    product.name || '',
                    product.code || ''
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
            console.error('[流水表] 货品拼音搜索失败:', error);
            return products;
        }
    }
    
    // 🔍 工厂拼音搜索过滤
    filterFactoriesWithPinyin(factories, keyword) {
        if (!keyword) return factories;
        
        try {
            return factories.filter(factory => {
                // 检查多个字段
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
            console.error('[流水表] 工厂拼音搜索失败:', error);
            return factories;
        }
    }
    
    // 🎯 更新货品筛选下拉框
    updateProductFilterDropdown(products) {
        try {
            this.allProducts = products; // 保存完整列表
            
            const dropdown = document.getElementById('productFilterDropdown');
            if (!dropdown) return;
            
            const content = dropdown.querySelector('.dropdown-content');
            if (!content) return;
            
            // 清空现有选项（保留"全部货品"）
            content.innerHTML = `
                <div class="dropdown-item active" data-product="" onclick="window.flowTable.selectProductFilter('')">
                    <span>全部货品</span>
                    <span class="check-mark">✓</span>
                </div>
            `;
            
            // 添加货品选项
            products.forEach(product => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.dataset.product = product.productNo || product.code;
                item.onclick = () => window.flowTable.selectProductFilter(product);
                
                item.innerHTML = `
                    <span>${product.productNo || product.code}</span>
                    <span class="product-name">${product.name || ''}</span>
                `;
                
                content.appendChild(item);
            });
            
        } catch (error) {
            console.error('[流水表] 更新货品筛选下拉框失败:', error);
        }
    }
    
    // 🎯 更新工厂筛选下拉框
    updateFactoryFilterDropdown(factories) {
        try {
            this.allFactories = factories; // 保存完整列表
            
            const dropdown = document.getElementById('factoryFilterDropdown');
            if (!dropdown) return;
            
            const content = dropdown.querySelector('.dropdown-content');
            if (!content) return;
            
            // 清空现有选项（保留"全部工厂"）
            content.innerHTML = `
                <div class="dropdown-item active" data-factory="" onclick="window.flowTable.selectFactoryFilter('')">
                    <span>全部工厂</span>
                    <span class="check-mark">✓</span>
                </div>
            `;
            
            // 添加工厂选项
            factories.forEach(factory => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.dataset.factory = factory.id;
                item.onclick = () => window.flowTable.selectFactoryFilter(factory);
                
                item.innerHTML = `
                    <span>${factory.name}</span>
                    <span class="factory-contact">${factory.contact || ''}</span>
                `;
                
                content.appendChild(item);
            });
            
        } catch (error) {
            console.error('[流水表] 更新工厂筛选下拉框失败:', error);
        }
    }
    
    // 🎯 选择货品筛选
    selectProductFilter(product) {
        try {
            const input = document.getElementById('filterProductSearch');
            if (!input) return;
            
            if (!product) {
                input.value = '全部货品';
                input.dataset.productNo = '';
            } else {
                input.value = product.productNo || product.code;
                input.dataset.productNo = product.productNo || product.code;
            }
            
            this.hideProductFilterDropdown();
            
        } catch (error) {
            console.error('[流水表] 选择货品筛选失败:', error);
        }
    }
    
    // 🎯 选择工厂筛选
    selectFactoryFilter(factory) {
        try {
            const input = document.getElementById('filterFactorySearch');
            if (!input) return;
            
            if (!factory) {
                input.value = '全部工厂';
                input.dataset.factoryId = '';
            } else {
                input.value = factory.name;
                input.dataset.factoryId = factory.id;
            }
            
            this.hideFactoryFilterDropdown();
            
        } catch (error) {
            console.error('[流水表] 选择工厂筛选失败:', error);
        }
    }
    
    // 🎯 显示/隐藏下拉框
    showProductFilterDropdown() {
        const dropdown = document.getElementById('productFilterDropdown');
        if (dropdown) dropdown.style.display = 'block';
    }
    
    hideProductFilterDropdown() {
        setTimeout(() => {
            const dropdown = document.getElementById('productFilterDropdown');
            if (dropdown) dropdown.style.display = 'none';
        }, 200);
    }
    
    showFactoryFilterDropdown() {
        const dropdown = document.getElementById('factoryFilterDropdown');
        if (dropdown) dropdown.style.display = 'block';
    }
    
    hideFactoryFilterDropdown() {
        setTimeout(() => {
            const dropdown = document.getElementById('factoryFilterDropdown');
            if (dropdown) dropdown.style.display = 'none';
        }, 200);
    }
    
    // 🎯 更新工序筛选选项
    updateProcessFilterOptions(processes) {
        try {
            const select = document.getElementById('filterProcess');
            if (!select) return;
            
            // 清空现有选项（保留"全部工序"）
            select.innerHTML = '<option value="">全部工序</option>';
            
            // 添加工序选项
            processes.forEach(process => {
                const option = document.createElement('option');
                option.value = process.id;
                option.textContent = process.name;
                select.appendChild(option);
            });
            
        } catch (error) {
            console.error('[流水表] 更新工序筛选选项失败:', error);
        }
    }
}

// 🎯 全局初始化函数 - 增强健壮性
function initFlowTablePage() {
    try {
        // 流水表页面已在主HTML中有完整结构，直接初始化管理器
        if (!window.flowTable) {
            window.flowTable = new FlowTable();
            console.log('[流水表] 已初始化流水表页面');
        } else {
            console.log('[流水表] 流水表页面已存在，重新初始化');
            window.flowTable.refresh();
        }
    } catch (error) {
        console.error('[流水表] 初始化流水表页面失败:', error);
    }
}

// 🎯 全局函数：显示筛选模态框
function showFlowFilterModal() {
    if (window.flowTable && typeof window.flowTable.showFilterModal === 'function') {
        window.flowTable.showFilterModal();
    } else {
        console.error('[流水表] 流水表管理器未初始化');
        if (window.Utils && Utils.toast) {
            Utils.toast.error('流水表功能未初始化');
        }
    }
}

// 导出模块
window.FlowTable = FlowTable;
window.initFlowTablePage = initFlowTablePage;
window.showFlowFilterModal = showFlowFilterModal; 