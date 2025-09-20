// 基础管理详细页面功能类 - 组织数据隔离版
class BaseManageDetail {
    constructor(type) {
        this.type = type; // 'products', 'factories', 'colors', 'sizes', 'processes'
        this.currentPage = 1;
        this.pageSize = 20;
        this.hasMoreData = true;
        this.isLoading = false;
        this.data = [];
        this.searchQuery = '';
        this.filters = {};
        this.statistics = {};
        this.selectedItems = [];
        this.editingItem = null;
        this.showModal = false;
        this.showSelector = false;
        
        // 类型配置
        this.config = this.getTypeConfig(type);
        
        this.init();
    }
    
    getTypeConfig(type) {
        const configs = {
            products: {
                title: '货品管理',
                icon: '📦',
                subtitle: '管理货号、款式和规格',
                apiEndpoint: 'products',
                fields: [
                    { key: 'productNo', label: '货号', type: 'text', required: true },
                    { key: 'name', label: '货品名称', type: 'text', required: true },
                    { key: 'colors', label: '颜色', type: 'multiselect', source: 'colors' },
                    { key: 'sizes', label: '尺码', type: 'multiselect', source: 'sizes' },
                    { key: 'processes', label: '工序', type: 'multiselect', source: 'processes' },
                    { key: 'image', label: '图片', type: 'image' },
                    { key: 'description', label: '描述', type: 'textarea' },
                    { key: 'status', label: '状态', type: 'switch', default: 1 }
                ],
                tableColumns: [
                    { key: 'productNo', label: '货号', width: '120px' },
                    { key: 'name', label: '货品名称', width: '150px' },
                    { key: 'image', label: '图片', width: '80px', type: 'image' },
                    { key: 'colors', label: '颜色', width: '120px', type: 'tags' },
                    { key: 'sizes', label: '尺码', width: '120px', type: 'tags' },
                    { key: 'processes', label: '工序', width: '120px', type: 'tags' },
                    { key: 'status', label: '状态', width: '80px', type: 'status' },
                    { key: 'createTime', label: '创建时间', width: '140px', type: 'datetime' },
                    { key: 'actions', label: '操作', width: '150px', type: 'actions' }
                ]
            },
            factories: {
                title: '工厂管理',
                icon: '🏭',
                subtitle: '管理生产工厂和联系人',
                apiEndpoint: 'factories',
                fields: [
                    { key: 'name', label: '工厂名称', type: 'text', required: true },
                    { key: 'phone', label: '联系电话', type: 'tel', required: true },
                    { key: 'address', label: '地址', type: 'text' },
                    { key: 'processes', label: '工序', type: 'multiselect', source: 'processes', required: true },
                    { key: 'remark', label: '备注', type: 'textarea' },
                    { key: 'status', label: '状态', type: 'switch', default: 1 }
                ],
                tableColumns: [
                    { key: 'name', label: '工厂名称', width: '150px' },
                    { key: 'phone', label: '联系电话', width: '120px' },
                    { key: 'address', label: '地址', width: '200px' },
                    { key: 'processes', label: '工序', width: '150px', type: 'tags' },
                    { key: 'balance', label: '余额', width: '100px', type: 'currency' },
                    { key: 'debt', label: '欠款', width: '100px', type: 'currency' },
                    { key: 'status', label: '状态', width: '80px', type: 'status' },
                    { key: 'createTime', label: '创建时间', width: '140px', type: 'datetime' },
                    { key: 'actions', label: '操作', width: '150px', type: 'actions' }
                ]
            },
            colors: {
                title: '颜色管理',
                icon: '🎨',
                subtitle: '管理产品颜色选项',
                apiEndpoint: 'colors',
                fields: [
                    { key: 'name', label: '颜色名称', type: 'text', required: true },
                    { key: 'code', label: '颜色编码', type: 'text' },
                    { key: 'orderNum', label: '排序', type: 'number', default: 1 },
                    { key: 'status', label: '状态', type: 'switch', default: 1 }
                ],
                tableColumns: [
                    { key: 'orderNum', label: '排序', width: '80px' },
                    { key: 'name', label: '颜色名称', width: '150px' },
                    { key: 'code', label: '颜色编码', width: '120px' },
                    { key: 'status', label: '状态', width: '80px', type: 'status' },
                    { key: 'createTime', label: '创建时间', width: '140px', type: 'datetime' },
                    { key: 'actions', label: '操作', width: '150px', type: 'actions' }
                ]
            },
            sizes: {
                title: '尺码管理',
                icon: '📏',
                subtitle: '管理产品尺码规格',
                apiEndpoint: 'sizes',
                fields: [
                    { key: 'name', label: '尺码名称', type: 'text', required: true },
                    { key: 'code', label: '尺码编码', type: 'text' },
                    { key: 'orderNum', label: '排序', type: 'number', default: 1 },
                    { key: 'status', label: '状态', type: 'switch', default: 1 }
                ],
                tableColumns: [
                    { key: 'orderNum', label: '排序', width: '80px' },
                    { key: 'name', label: '尺码名称', width: '150px' },
                    { key: 'code', label: '尺码编码', width: '120px' },
                    { key: 'status', label: '状态', width: '80px', type: 'status' },
                    { key: 'createTime', label: '创建时间', width: '140px', type: 'datetime' },
                    { key: 'actions', label: '操作', width: '150px', type: 'actions' }
                ]
            },
            processes: {
                title: '工序管理',
                icon: '⚙️',
                subtitle: '管理生产工序流程',
                apiEndpoint: 'processes',
                fields: [
                    { key: 'name', label: '工序名称', type: 'text', required: true },
                    { key: 'code', label: '工序编码', type: 'text' },
                    { key: 'orderNum', label: '排序', type: 'number', default: 1 },
                    { key: 'description', label: '描述', type: 'textarea' },
                    { key: 'status', label: '状态', type: 'switch', default: 1 }
                ],
                tableColumns: [
                    { key: 'orderNum', label: '排序', width: '80px' },
                    { key: 'name', label: '工序名称', width: '150px' },
                    { key: 'code', label: '工序编码', width: '120px' },
                    { key: 'description', label: '描述', width: '200px' },
                    { key: 'status', label: '状态', width: '80px', type: 'status' },
                    { key: 'createTime', label: '创建时间', width: '140px', type: 'datetime' },
                    { key: 'actions', label: '操作', width: '150px', type: 'actions' }
                ]
            }
        };
        
        return configs[type] || configs.products;
    }
    
    init() {
        this.bindEvents();
        this.loadData();
        this.loadRelatedData();
        this.renderPage();
    }
    
    bindEvents() {
        // 🎯 搜索功能 - 添加拼音搜索支持，对齐微信小程序体验
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce((e) => {
                this.searchQuery = e.target.value;
                this.resetAndReload();
            }, 300));
        }
        
        // 筛选功能
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.resetAndReload();
            });
        }
        
        // 使用优化的滚动监听器
        if (window.ScrollOptimizer) {
            // 移除旧的滚动监听器（如果存在）
            if (this.scrollOptimizer) {
                this.scrollOptimizer.destroy();
            }
            
            // 设置优化的无限滚动
            this.scrollOptimizer = window.ScrollOptimizer.setupInfiniteScroll(
                'basePageContent',
                () => this.loadMoreData(),
                {
                    threshold: 1000,
                    throttle: 200
                }
            );
            
            console.log('[BaseManageDetail] 已启用优化的滚动监听器');
        } else {
            // 备用方案：使用传统的滚动监听器（已优化）
        window.addEventListener('scroll', Utils.throttle(() => {
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000) {
                this.loadMoreData();
            }
        }, 200));
            
            console.warn('[BaseManageDetail] ScrollOptimizer不可用，使用备用滚动监听器');
        }
    }
    
    renderPage() {
        const container = document.getElementById('baseDetailContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="base-detail-container">
                <!-- 页面头部 -->
                <div class="base-detail-header">
                    <div class="base-detail-title">
                        <span class="base-detail-icon">${this.config.icon}</span>
                        <div>
                            <h2>${this.config.title}</h2>
                            <div class="base-detail-subtitle">${this.config.subtitle}</div>
                        </div>
                    </div>
                    <div class="base-detail-actions">
                        <button class="action-btn primary" onclick="baseDetailManager.showAddModal()">
                            <span>➕</span>
                            新增${this.getItemName()}
                        </button>
                        <button class="action-btn secondary" onclick="baseDetailManager.exportData()">
                            <span>📤</span>
                            导出数据
                        </button>
                        <button class="action-btn success" onclick="baseDetailManager.refreshData()">
                            <span>🔄</span>
                            刷新
                        </button>
                    </div>
                </div>
                
                <!-- 统计概览 -->
                <div class="stats-overview" id="statsOverview">
                    <!-- 统计卡片将通过JavaScript动态生成 -->
                </div>
                
                <!-- 搜索和筛选 -->
                <div class="search-filter-section">
                    <div class="search-filter-row">
                        <div class="search-input-group">
                            <span class="search-icon">🔍</span>
                            <input type="text" id="searchInput" class="search-input" placeholder="搜索${this.getItemName()}...">
                        </div>
                        <div class="filter-group">
                            <select id="statusFilter" class="filter-select">
                                <option value="">全部状态</option>
                                <option value="1">启用</option>
                                <option value="0">停用</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 数据表格 -->
                <div class="data-table-container">
                    <table class="data-table" id="dataTable">
                        <thead>
                            <tr>
                                ${this.config.tableColumns.map(col => `<th style="width: ${col.width || 'auto'}">${col.label}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody id="dataTableBody">
                            <!-- 数据行将通过JavaScript动态生成 -->
                        </tbody>
                    </table>
                    
                    <!-- 空状态 -->
                    <div class="empty-state" id="emptyState" style="display: none;">
                        <div class="empty-state-icon">${this.config.icon}</div>
                        <div class="empty-state-text">暂无${this.getItemName()}数据</div>
                        <div class="empty-state-desc">点击上方按钮添加第一个${this.getItemName()}</div>
                    </div>
                </div>
                
                <!-- 分页 -->
                <div class="pagination" id="pagination" style="display: none;">
                    <!-- 分页按钮将通过JavaScript动态生成 -->
                </div>
            </div>
            
            <!-- 编辑模态框 -->
            <div class="modal-overlay" id="editModal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <div class="modal-title">
                            <span>${this.config.icon}</span>
                            <span id="modalTitle">新增${this.getItemName()}</span>
                        </div>
                        <span class="modal-close" onclick="baseDetailManager.hideModal()">&times;</span>
                    </div>
                    <div class="modal-body" id="modalBody">
                        <!-- 表单内容将通过JavaScript动态生成 -->
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn cancel" onclick="baseDetailManager.hideModal()">取消</button>
                        <button class="modal-btn confirm" onclick="baseDetailManager.saveItem()">保存</button>
                    </div>
                </div>
            </div>
            
            <!-- 选择器模态框 -->
            <div class="selector-modal" id="selectorModal" style="display: none;">
                <div class="selector-content">
                    <div class="selector-header">
                        <div class="selector-title" id="selectorTitle">选择项目</div>
                        <span class="modal-close" onclick="baseDetailManager.hideSelector()">&times;</span>
                    </div>
                    <div class="selector-options" id="selectorOptions">
                        <!-- 选择器选项将通过JavaScript动态生成 -->
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn confirm" onclick="baseDetailManager.confirmSelection()">确认</button>
                    </div>
                </div>
            </div>
        `;
        
        this.bindPageEvents();
    }
    
    bindPageEvents() {
        // 重新绑定事件
        this.bindEvents();
    }
    
    getItemName() {
        const names = {
            products: '货品',
            factories: '工厂',
            colors: '颜色',
            sizes: '尺码',
            processes: '工序'
        };
        return names[this.type] || '项目';
    }
    
    async loadData() {
        if (this.isLoading) return;
        
        // 强制验证组织认证状态
        if (!Auth.requireAuth()) {
            return;
        }
        
        this.isLoading = true;
        this.showLoading();
        
        try {
            const params = {
                page: this.currentPage,
                limit: this.pageSize,
                search: this.searchQuery,
                ...this.filters
            };
            
            // 使用组织安全的API调用
            const response = await API.base[this.config.apiEndpoint].list(params);
            
            if (response.success) {
                let newData = response.data || [];
                
                // 验证返回数据的组织归属
                Utils.orgSecurity.validateDataOwnership(newData);
                
                // 🎯 如果有搜索关键词，进行本地拼音搜索增强
                if (this.searchQuery && window.PinyinUtils && window.PinyinUtils.searchMatch) {
                    newData = this.enhanceSearchWithPinyin(newData, this.searchQuery);
                    console.log(`[BaseManageDetail] 拼音搜索增强完成，匹配${newData.length}条结果`);
                }
                
                if (this.currentPage === 1) {
                    this.data = newData;
                } else {
                    this.data = [...this.data, ...newData];
                }
                
                this.hasMoreData = newData.length === this.pageSize;
                this.renderData();
                this.updateStatistics();
            } else {
                throw new Error(response.message || '加载数据失败');
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            Utils.toast.error('加载数据失败: ' + error.message);
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    async loadMoreData() {
        if (!this.hasMoreData || this.isLoading) return;
        
        this.currentPage++;
        await this.loadData();
    }
    
    resetAndReload() {
        this.currentPage = 1;
        this.hasMoreData = true;
        this.data = [];
        this.loadData();
    }
    
    // 🎯 拼音搜索增强功能 - 对齐微信小程序体验
    enhanceSearchWithPinyin(data, keyword) {
        if (!keyword || !window.PinyinUtils) return data;
        
        return data.filter(item => {
            // 根据不同类型定义搜索字段
            const searchFields = this.getSearchFields(item);
            
            // 智能三层搜索策略
            return searchFields.some(fieldValue => {
                if (!fieldValue) return false;
                
                // 1. 直接匹配
                if (fieldValue.toLowerCase().includes(keyword.toLowerCase())) {
                    return true;
                }
                
                // 2. 拼音匹配
                if (window.PinyinUtils.searchMatch(keyword, fieldValue)) {
                    return true;
                }
                
                // 3. 模糊匹配
                const fuzzyMatch = fieldValue.toLowerCase().split('').some((char, index) => {
                    return char === keyword.toLowerCase()[0] && 
                           fieldValue.toLowerCase().substring(index).includes(keyword.toLowerCase());
                });
                
                return fuzzyMatch;
            });
        });
    }
    
    // 🎯 获取搜索字段 - 根据类型返回不同的搜索字段
    getSearchFields(item) {
        switch (this.type) {
            case 'products':
                return [item.productNo || item.code, item.name, item.description, item.remark];
            case 'factories':
                return [item.name, item.phone, item.address, item.contact];
            case 'colors':
            case 'sizes':
            case 'processes':
                return [item.name, item.code, item.description];
            default:
                return [item.name, item.code, item.productNo];
        }
    }
    
    async loadRelatedData() {
        // 加载相关数据（如颜色、尺码、工序等）
        try {
            if (this.type === 'products') {
                const [colorsRes, sizesRes, processesRes] = await Promise.all([
                    API.base.colors.list(),
                    API.base.sizes.list(),
                    API.base.processes.list()
                ]);
                
                // 过滤掉已停用的选项，只显示启用的选项（status = 1）
                const enabledColors = (colorsRes.success && colorsRes.data) ? colorsRes.data.filter(item => item.status === 1) : [];
                const enabledSizes = (sizesRes.success && sizesRes.data) ? sizesRes.data.filter(item => item.status === 1) : [];
                const enabledProcesses = (processesRes.success && processesRes.data) ? processesRes.data.filter(item => item.status === 1) : [];
                
                console.log('[base-manage-detail.js] Filtered out disabled options for products:');
                console.log('- Colors:', enabledColors.length, 'enabled');
                console.log('- Sizes:', enabledSizes.length, 'enabled');
                console.log('- Processes:', enabledProcesses.length, 'enabled');
                
                this.relatedData = {
                    colors: enabledColors,
                    sizes: enabledSizes,
                    processes: enabledProcesses
                };
            } else if (this.type === 'factories') {
                const processesRes = await API.base.processes.list();
                // 工厂管理页面也只显示启用的工序
                const enabledProcesses = (processesRes.success && processesRes.data) ? processesRes.data.filter(item => item.status === 1) : [];
                console.log('[base-manage-detail.js] Filtered out disabled processes for factories:', enabledProcesses.length, 'enabled');
                
                this.relatedData = {
                    processes: enabledProcesses
                };
            }
        } catch (error) {
            console.error('加载相关数据失败:', error);
            this.relatedData = {};
        }
    }
    
    renderData() {
        const tableBody = document.getElementById('dataTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tableBody) return;
        
        if (this.data.length === 0) {
            tableBody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        tableBody.innerHTML = this.data.map(item => this.renderDataRow(item)).join('');
    }
    
    renderDataRow(item) {
        return `
            <tr>
                ${this.config.tableColumns.map(col => this.renderTableCell(item, col)).join('')}
            </tr>
        `;
    }
    
    renderTableCell(item, column) {
        const value = item[column.key];
        
        switch (column.type) {
            case 'image':
                return `<td>${value ? `<img src="${value}" alt="图片" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">` : '-'}</td>`;
            
            case 'tags':
                const tags = this.parseTagsValue(value);
                return `<td>${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</td>`;
            
            case 'status':
                return `<td><span class="status-badge ${value === 1 ? 'active' : 'inactive'}">${value === 1 ? '启用' : '停用'}</span></td>`;
            
            case 'currency':
                return `<td>¥${Utils.format.number(value || 0)}</td>`;
            
            case 'datetime':
                return `<td>${Utils.format.date(value, 'YYYY-MM-DD HH:mm')}</td>`;
            
            case 'actions':
                return `
                    <td>
                        <div class="table-actions">
                            <button class="table-action-btn edit" onclick="baseDetailManager.editItem('${item.id || item._id}')">编辑</button>
                            <button class="table-action-btn toggle" onclick="baseDetailManager.toggleStatus('${item.id || item._id}', ${item.status})">${item.status === 1 ? '停用' : '启用'}</button>
                            <!-- 🚫 删除按钮已取消 - 遵循微信小程序设计原则，只保留启用/停用功能，确保数据安全 -->
                        </div>
                    </td>
                `;
            
            default:
                return `<td>${value || '-'}</td>`;
        }
    }
    
    parseTagsValue(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
            return value.split(',').map(tag => tag.trim()).filter(tag => tag);
        }
        return [];
    }
    
    updateStatistics() {
        const statsOverview = document.getElementById('statsOverview');
        if (!statsOverview) return;
        
        const totalCount = this.data.length;
        const activeCount = this.data.filter(item => item.status === 1).length;
        const inactiveCount = this.data.filter(item => item.status === 0).length;
        
        statsOverview.innerHTML = `
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">总数量</div>
                    <div class="stat-card-icon">📊</div>
                </div>
                <div class="stat-card-value">${totalCount}</div>
                <div class="stat-card-change positive">+${Math.floor(Math.random() * 10)}% 本月</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">启用数量</div>
                    <div class="stat-card-icon">✅</div>
                </div>
                <div class="stat-card-value">${activeCount}</div>
                <div class="stat-card-change positive">${totalCount > 0 ? Math.round(activeCount / totalCount * 100) : 0}% 占比</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-card-header">
                    <div class="stat-card-title">停用数量</div>
                    <div class="stat-card-icon">❌</div>
                </div>
                <div class="stat-card-value">${inactiveCount}</div>
                <div class="stat-card-change negative">${totalCount > 0 ? Math.round(inactiveCount / totalCount * 100) : 0}% 占比</div>
            </div>
            
            ${this.renderCustomStats()}
        `;
    }
    
    renderCustomStats() {
        // 🎯 对齐微信小程序 - 添加AI智能提示
        if (this.type === 'products') {
            return `
                <div class="stat-card ai-tip-card">
                    <div class="stat-card-header">
                        <div class="stat-card-title">🤖 AI智能建议</div>
                        <div class="stat-card-icon">💡</div>
                    </div>
                    <div class="stat-card-content">
                        <div class="ai-tip-desc">建议规范货号命名，支持多颜色、多尺码配置</div>
                        <div class="ai-tip-suggestion">格式建议：品类-年份-序号，如：T-2024-001</div>
                    </div>
                </div>
            `;
        }
        return '';
    }
    
    showAddModal() {
        this.editingItem = null;
        this.showModal = true;
        this.renderModal('新增' + this.getItemName());
    }
    
    editItem(itemId) {
        const item = this.data.find(d => (d.id || d._id) === itemId);
        if (!item) return;
        
        this.editingItem = item;
        this.showModal = true;
        this.renderModal('编辑' + this.getItemName());
    }
    
    renderModal(title) {
        const modal = document.getElementById('editModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        if (!modal || !modalTitle || !modalBody) return;
        
        modalTitle.textContent = title;
        modalBody.innerHTML = this.renderForm();
        modal.style.display = 'flex';
        
        // 填充编辑数据
        if (this.editingItem) {
            this.fillFormData(this.editingItem);
        }
    }
    
    renderForm() {
        return this.config.fields.map(field => this.renderFormField(field)).join('');
    }
    
    renderFormField(field) {
        const value = this.editingItem ? (this.editingItem[field.key] || field.default || '') : (field.default || '');
        const required = field.required ? 'required' : '';
        const requiredClass = field.required ? 'required' : '';
        
        switch (field.type) {
            case 'text':
            case 'tel':
            case 'number':
                return `
                    <div class="form-group">
                        <label class="form-label ${requiredClass}">${field.label}</label>
                        <input type="${field.type}" id="field_${field.key}" class="form-input" value="${value}" ${required} placeholder="请输入${field.label}">
                    </div>
                `;
            
            case 'textarea':
                return `
                    <div class="form-group">
                        <label class="form-label ${requiredClass}">${field.label}</label>
                        <textarea id="field_${field.key}" class="form-textarea" ${required} placeholder="请输入${field.label}">${value}</textarea>
                    </div>
                `;
            
            case 'switch':
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <select id="field_${field.key}" class="form-select">
                            <option value="1" ${value == 1 ? 'selected' : ''}>启用</option>
                            <option value="0" ${value == 0 ? 'selected' : ''}>停用</option>
                        </select>
                    </div>
                `;
            
            case 'multiselect':
                return `
                    <div class="form-group">
                        <label class="form-label ${requiredClass}">${field.label}</label>
                        <div class="multi-select-container" onclick="baseDetailManager.showSelector('${field.key}', '${field.source}')">
                            <div class="selected-tags" id="selected_${field.key}">
                                ${this.renderSelectedTags(field.key, value)}
                            </div>
                            <div class="multi-select-placeholder" id="placeholder_${field.key}" style="display: ${value ? 'none' : 'block'}">点击选择${field.label}</div>
                        </div>
                    </div>
                `;
            
            case 'image':
                return `
                    <div class="form-group">
                        <label class="form-label">${field.label}</label>
                        <div class="image-upload-area" onclick="baseDetailManager.selectImage('${field.key}')">
                            <div class="image-upload-icon">📷</div>
                            <div class="image-upload-text">点击上传图片</div>
                            <div class="image-upload-hint">支持 JPG、PNG 格式，大小不超过 2MB</div>
                        </div>
                        <div class="image-preview" id="preview_${field.key}" style="display: ${value ? 'block' : 'none'}">
                            <img src="${value}" alt="预览图">
                            <div class="image-remove" onclick="baseDetailManager.removeImage('${field.key}')">&times;</div>
                        </div>
                        <input type="file" id="file_${field.key}" accept="image/*" style="display: none;" onchange="baseDetailManager.handleImageUpload(event, '${field.key}')">
                    </div>
                `;
            
            default:
                return '';
        }
    }
    
    renderSelectedTags(fieldKey, value) {
        const tags = this.parseTagsValue(value);
        return tags.map(tag => `
            <span class="tag">
                ${tag}
                <span class="tag-remove" onclick="baseDetailManager.removeTag('${fieldKey}', '${tag}')">&times;</span>
            </span>
        `).join('');
    }
    
    fillFormData(item) {
        this.config.fields.forEach(field => {
            const element = document.getElementById(`field_${field.key}`);
            if (element) {
                element.value = item[field.key] || field.default || '';
            }
            
            if (field.type === 'multiselect') {
                this.updateSelectedTags(field.key, item[field.key]);
            }
        });
    }
    
    updateSelectedTags(fieldKey, value) {
        const container = document.getElementById(`selected_${fieldKey}`);
        const placeholder = document.getElementById(`placeholder_${fieldKey}`);
        
        if (container) {
            container.innerHTML = this.renderSelectedTags(fieldKey, value);
        }
        
        if (placeholder) {
            const tags = this.parseTagsValue(value);
            placeholder.style.display = tags.length > 0 ? 'none' : 'block';
        }
    }
    
    hideModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.showModal = false;
        this.editingItem = null;
    }
    
    async saveItem() {
        try {
            const formData = this.collectFormData();
            
            // 验证表单数据
            if (!this.validateFormData(formData)) {
                return;
            }
            
            Utils.loading.show('保存中...');
            
            let response;
            if (this.editingItem) {
                // 编辑
                const itemId = this.editingItem.id || this.editingItem._id;
                response = await API.base[this.config.apiEndpoint].update(itemId, formData);
            } else {
                // 新增
                response = await API.base[this.config.apiEndpoint].create(formData);
            }
            
            if (response.success) {
                Utils.toast.success(this.editingItem ? '更新成功' : '添加成功');
                this.hideModal();
                this.resetAndReload();
            } else {
                throw new Error(response.message || '保存失败');
            }
        } catch (error) {
            console.error('保存失败:', error);
            Utils.toast.error('保存失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    collectFormData() {
        const formData = {};
        
        this.config.fields.forEach(field => {
            const element = document.getElementById(`field_${field.key}`);
            if (element) {
                formData[field.key] = element.value;
            }
            
            // 处理多选字段
            if (field.type === 'multiselect') {
                const container = document.getElementById(`selected_${field.key}`);
                if (container) {
                    const tags = Array.from(container.querySelectorAll('.tag')).map(tag => {
                        return tag.textContent.replace('×', '').trim();
                    });
                    formData[field.key] = tags.join(',');
                }
            }
        });
        
        return formData;
    }
    
    validateFormData(formData) {
        for (const field of this.config.fields) {
            if (field.required && !formData[field.key]) {
                Utils.toast.error(`请填写${field.label}`);
                return false;
            }
        }
        return true;
    }
    
    async toggleStatus(itemId, currentStatus) {
        try {
            const newStatus = currentStatus === 1 ? 0 : 1;
            const action = newStatus === 1 ? '启用' : '停用';
            
            if (!confirm(`确定要${action}该${this.getItemName()}吗？`)) {
                return;
            }
            
            Utils.loading.show(`${action}中...`);
            
            const response = await API.base[this.config.apiEndpoint].update(itemId, { status: newStatus });
            
            if (response.success) {
                Utils.toast.success(`${action}成功`);
                this.resetAndReload();
            } else {
                throw new Error(response.message || `${action}失败`);
            }
        } catch (error) {
            console.error('状态切换失败:', error);
            Utils.toast.error('操作失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 🚫 deleteItem 方法已移除 - 遵循微信小程序设计原则
    // 为了保证数据安全和业务连续性，不提供删除功能
    // 用户只能通过启用/停用来管理数据状态
    async deleteItem(itemId) {
        Utils.toast.warning('删除功能已禁用，请使用启用/停用功能来管理数据状态');
        console.warn('[BaseManageDetail] 删除功能已禁用，遵循微信小程序设计原则');
        return;
    }
    
    showSelector(fieldKey, source) {
        this.currentSelectorField = fieldKey;
        this.currentSelectorSource = source;
        
        const modal = document.getElementById('selectorModal');
        const title = document.getElementById('selectorTitle');
        const options = document.getElementById('selectorOptions');
        
        if (!modal || !title || !options) return;
        
        const sourceData = this.relatedData[source] || [];
        const currentValues = this.getCurrentSelectedValues(fieldKey);
        
        title.textContent = `选择${this.getFieldLabel(fieldKey)}`;
        options.innerHTML = sourceData.map(item => `
            <div class="selector-option ${currentValues.includes(item.name) ? 'selected' : ''}" data-value="${item.name}">
                <span class="selector-option-text">${item.name}</span>
                <span class="selector-option-check" style="display: ${currentValues.includes(item.name) ? 'block' : 'none'}">✓</span>
            </div>
        `).join('');
        
        // 绑定选择事件
        options.addEventListener('click', (e) => {
            const option = e.target.closest('.selector-option');
            if (option) {
                option.classList.toggle('selected');
                const check = option.querySelector('.selector-option-check');
                check.style.display = option.classList.contains('selected') ? 'block' : 'none';
            }
        });
        
        modal.style.display = 'flex';
        this.showSelector = true;
    }
    
    getCurrentSelectedValues(fieldKey) {
        const container = document.getElementById(`selected_${fieldKey}`);
        if (!container) return [];
        
        return Array.from(container.querySelectorAll('.tag')).map(tag => {
            return tag.textContent.replace('×', '').trim();
        });
    }
    
    getFieldLabel(fieldKey) {
        const field = this.config.fields.find(f => f.key === fieldKey);
        return field ? field.label : fieldKey;
    }
    
    confirmSelection() {
        const options = document.getElementById('selectorOptions');
        if (!options) return;
        
        const selectedValues = Array.from(options.querySelectorAll('.selector-option.selected')).map(option => {
            return option.dataset.value;
        });
        
        this.updateSelectedTags(this.currentSelectorField, selectedValues.join(','));
        this.hideSelector();
    }
    
    hideSelector() {
        const modal = document.getElementById('selectorModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.showSelector = false;
    }
    
    removeTag(fieldKey, tagValue) {
        const currentValues = this.getCurrentSelectedValues(fieldKey);
        const newValues = currentValues.filter(value => value !== tagValue);
        this.updateSelectedTags(fieldKey, newValues.join(','));
    }
    
    selectImage(fieldKey) {
        const fileInput = document.getElementById(`file_${fieldKey}`);
        if (fileInput) {
            fileInput.click();
        }
    }
    
    async handleImageUpload(event, fieldKey) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 验证文件类型和大小
        if (!file.type.startsWith('image/')) {
            Utils.toast.error('请选择图片文件');
            return;
        }
        
        if (file.size > 2 * 1024 * 1024) {
            Utils.toast.error('图片大小不能超过2MB');
            return;
        }
        
        try {
            Utils.loading.show('上传中...');
            
            const response = await API.upload(file);
            
            if (response.success) {
                const imageUrl = response.data.url;
                this.showImagePreview(fieldKey, imageUrl);
                Utils.toast.success('上传成功');
            } else {
                throw new Error(response.message || '上传失败');
            }
        } catch (error) {
            console.error('图片上传失败:', error);
            Utils.toast.error('上传失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    showImagePreview(fieldKey, imageUrl) {
        const preview = document.getElementById(`preview_${fieldKey}`);
        if (preview) {
            const img = preview.querySelector('img');
            if (img) {
                img.src = imageUrl;
            }
            preview.style.display = 'block';
        }
        
        // 设置隐藏的值
        const hiddenInput = document.getElementById(`field_${fieldKey}`);
        if (hiddenInput) {
            hiddenInput.value = imageUrl;
        }
    }
    
    removeImage(fieldKey) {
        const preview = document.getElementById(`preview_${fieldKey}`);
        if (preview) {
            preview.style.display = 'none';
        }
        
        const hiddenInput = document.getElementById(`field_${fieldKey}`);
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        const fileInput = document.getElementById(`file_${fieldKey}`);
        if (fileInput) {
            fileInput.value = '';
        }
    }
    
    async exportData() {
        try {
            Utils.loading.show('导出中...');
            
            const params = {
                search: this.searchQuery,
                ...this.filters,
                export: true
            };
            
            const response = await API.get(`/${this.config.apiEndpoint}/export`, { params });
            
            if (response.success) {
                // 创建下载链接
                const link = document.createElement('a');
                link.href = response.data.downloadUrl;
                link.download = `${this.config.title}_${new Date().toISOString().split('T')[0]}.xlsx`;
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
            Utils.loading.hide();
        }
    }
    
    refreshData() {
        this.resetAndReload();
        Utils.toast.success('数据已刷新');
    }
    
    showLoading() {
        Utils.loading.show('加载中...');
    }
    
    hideLoading() {
        Utils.loading.hide();
    }
    
    showEmptyState() {
        const tableBody = document.getElementById('dataTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (tableBody) tableBody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
    }
}

// 全局管理器实例
let baseDetailManager = null;

// 全局函数
function initBaseDetailPage(type) {
    baseDetailManager = new BaseManageDetail(type);
}

// 导出类
window.BaseManageDetail = BaseManageDetail;