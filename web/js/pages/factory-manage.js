// Web端工厂管理页面 - 对标微信小程序完整功能
class FactoryManage {
    constructor() {
        this.factories = [];
        this.allFactories = [];
        this.filteredFactories = [];
        this.searchKeyword = '';
        this.isSearchMode = false;
        this.isLoading = false;
        this.page = 1;
        this.pageSize = 20;
        this.hasMore = true;
        this.totalCount = 0;
        
        // 工厂统计信息
        this.factoryStats = {
            totalCount: 0,
            activeCount: 0,
            inactiveCount: 0
        };
        
        // 编辑状态
        this.showEditModal = false;
        this.isAdding = false;
        this.editingFactory = {
            name: '',
            phone: '',
            address: '',
            processes: [],
            remark: '',
            status: 'active'
        };
        
        // 账户管理
        this.showAccountDetail = false;
        this.currentFactoryId = '';
        this.currentFactoryName = '';
        this.accountRecords = [];
        this.isLoadingRecords = false;
        
        // 付款功能
        this.showPayDebtModal = false;
        this.payingFactory = {
            _id: '',
            name: '',
            debt: 0
        };
        this.payAmount = '';
        this.selectedPaymentMethod = 'cash';
        this.paymentRemark = '';
        this.paymentMethods = [
            { value: 'cash', label: '现金' },
            { value: 'bank', label: '银行' },
            { value: 'wechat', label: '微信' },
            { value: 'alipay', label: '支付宝' }
        ];
        
        // 付款历史
        this.showPaymentHistoryModal = false;
        this.paymentHistoryRecords = [];
        this.isLoadingHistory = false;
        this.currentHistoryPage = 1;
        this.historyPageSize = 20;
        this.hasMoreHistory = true;
        
        // 图片备注
        this.remarkImages = [];
        this.isUploadingImage = false;
        this.showImagePreviewModal = false;
        this.previewImageUrls = [];
        this.currentImageIndex = 0;
        
        // 工序数据
        this.allProcesses = [];
        this.showProcessSelector = false;
        this.isLoadingProcesses = false;
        
        this.init();
    }
    
    init() {
        this.renderPage();
        this.bindEvents();
        this.loadFactories();
        this.loadProcesses();
        this.loadFactoryStats();
    }
    
    renderPage() {
        const container = document.getElementById('factoryManagePageContent');
        if (!container) return;
        
        container.innerHTML = `
            <div class="factory-manage-container">
                <!-- 页面头部 -->
                <div class="factory-manage-header">
                    <div class="header-content">
                        <div class="header-left">
                            <div class="page-title">
                                <span class="page-icon">🏭</span>
                                <div>
                                    <h2>工厂管理</h2>
                                    <div class="page-subtitle">
                                        合计<span id="totalFactoryCount">0</span>家，启用<span id="activeFactoryCount">0</span> 停用<span id="inactiveFactoryCount">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="header-right">
                            <button class="add-btn apple-btn" onclick="factoryManage.showAddModal()">
                                <span class="add-icon">+</span>
                                <span class="add-text">新增</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 搜索筛选区域 -->
                <div class="factory-search-section">
                    <div class="search-container">
                        <div class="search-box">
                            <input 
                                class="search-input"
                                id="factorySearchInput"
                                placeholder="输入工厂名称、电话、地址或首字母筛选"
                                autocomplete="off"
                            />
                            <div class="search-icon">🔍</div>
                            <div class="clear-icon" id="clearSearchIcon" style="display: none;">×</div>
                            <button class="search-btn apple-btn" onclick="factoryManage.onSearchButtonClick()">查询</button>
                        </div>
                        <div class="search-results-info" id="searchResultsInfo" style="display: none;">
                            <span class="results-text">找到 <span id="searchResultCount">0</span> 家相关工厂</span>
                        </div>
                    </div>
                </div>
                
                <!-- AI智能提示卡片 -->
                <div class="ai-tip-card">
                    <span class="ai-tip-icon">🤖</span>
                    <div class="ai-tip-content">
                        <div class="ai-tip-title">AI智能建议</div>
                        <div class="ai-tip-desc">建议定期核对工厂账户，及时处理欠款和余额</div>
                    </div>
                </div>
                
                <!-- 加载状态 -->
                <div class="loading-wrapper" id="loadingWrapper" style="display: none;">
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <div class="loading-text">数据加载中...</div>
                    </div>
                </div>
                
                <!-- 空状态 -->
                <div class="empty-wrapper" id="emptyWrapper" style="display: none;">
                    <div class="empty-content">
                        <div class="empty-icon">🏭</div>
                        <div class="empty-title" id="emptyTitle">暂无工厂数据</div>
                        <div class="empty-desc" id="emptyDesc">点击右上角"新增"按钮添加第一家工厂</div>
                        <div class="empty-action">
                            <button class="empty-btn apple-btn" onclick="factoryManage.showAddModal()">
                                立即添加
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- 工厂网格布局 -->
                <div class="factory-grid" id="factoryGrid">
                    <!-- 工厂卡片将动态生成 -->
                </div>
                
                <!-- 加载更多 -->
                <div class="load-more-section" id="loadMoreSection" style="display: none;">
                    <div class="loading-more" id="loadingMore" style="display: none;">
                        <div class="loading-spinner-small"></div>
                        <div class="loading-more-text">加载中...</div>
                    </div>
                    <button class="load-more-btn apple-btn" id="loadMoreBtn" onclick="factoryManage.loadMoreFactories()">
                        点击加载更多
                    </button>
                    <div class="list-end" id="listEnd" style="display: none;">
                        <div class="list-end-text">已显示全部 <span id="totalDisplayCount">0</span> 条数据</div>
                    </div>
                </div>
            </div>
            
            <!-- 编辑工厂弹窗 -->
            <div class="modal-overlay" id="editModalOverlay" style="display: none;" onclick="factoryManage.closeEditModal()">
                <div class="modal-container" onclick="event.stopPropagation()">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title" id="editModalTitle">🏭 新增工厂</div>
                            <button class="modal-close" onclick="factoryManage.closeEditModal()">×</button>
                        </div>
                        <div class="modal-body">
                            <!-- AI建议区域 -->
                            <div class="ai-suggestion" id="aiSuggestion" style="display: none;">
                                <span class="suggestion-icon">💡</span>
                                <div class="suggestion-content">
                                    <div class="suggestion-title">智能建议</div>
                                    <div class="suggestion-desc">建议完善工厂联系方式和主营工序，便于后续管理</div>
                                </div>
                            </div>
                            
                            <!-- 编辑警告区域 -->
                            <div class="edit-warning" id="editWarning" style="display: none;">
                                <span class="warning-icon">⚠️</span>
                                <div class="warning-content">
                                    <div class="warning-title">编辑限制</div>
                                    <div class="warning-desc">该工厂有余额或欠款，部分信息不能修改</div>
                                </div>
                            </div>
                            
                            <form class="factory-form" id="factoryForm">
                                <div class="form-item">
                                    <label class="form-label required">工厂名称</label>
                                    <input type="text" class="form-input" id="factoryName" placeholder="请输入工厂名称" required>
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label">联系电话</label>
                                    <input type="tel" class="form-input" id="factoryPhone" placeholder="请输入联系电话">
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label">地址</label>
                                    <input type="text" class="form-input" id="factoryAddress" placeholder="请输入工厂地址">
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label required">工序</label>
                                    <div class="process-selector">
                                        <div class="selected-processes" id="selectedProcesses">
                                            <div class="placeholder-text">请选择工序</div>
                                        </div>
                                        <button type="button" class="select-btn apple-btn" onclick="factoryManage.showProcessSelector()">
                                            选择工序
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label">备注</label>
                                    <textarea class="form-textarea" id="factoryRemark" placeholder="请输入备注信息" rows="3"></textarea>
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label">状态</label>
                                    <div class="status-switch">
                                        <label class="switch">
                                            <input type="checkbox" id="factoryStatus" checked>
                                            <span class="slider"></span>
                                        </label>
                                        <span class="status-text">启用</span>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary apple-btn" onclick="factoryManage.closeEditModal()">取消</button>
                            <button class="btn-primary apple-btn" onclick="factoryManage.saveFactory()">
                                <span class="btn-text" id="saveBtnText">保存</span>
                                <div class="btn-spinner" id="saveBtnSpinner" style="display: none;"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        // 搜索输入事件
        const searchInput = document.getElementById('factorySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.onFactorySearch(e);
            });
            
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.onSearchButtonClick();
                }
            });
        }
        
        // 清除搜索按钮
        const clearIcon = document.getElementById('clearSearchIcon');
        if (clearIcon) {
            clearIcon.addEventListener('click', () => {
                this.clearFactorySearch();
            });
        }
        
        // 状态切换事件
        const statusSwitch = document.getElementById('factoryStatus');
        if (statusSwitch) {
            statusSwitch.addEventListener('change', (e) => {
                const statusText = document.querySelector('.status-text');
                if (statusText) {
                    statusText.textContent = e.target.checked ? '启用' : '停用';
                }
            });
        }
    }
    
    // 🛡️ 使用组织隔离的API加载工厂数据
    async loadFactories(reset = true) {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoading();
            
            if (reset) {
                this.page = 1;
                this.factories = [];
                this.hasMore = true;
            }
            
            const params = {
                page: this.page,
                pageSize: this.pageSize
            };
            
            if (this.searchKeyword) {
                params.keyword = this.searchKeyword;
            }
            
            const response = await API.get('/factories', { params });
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                const newFactories = response.data.list || response.data || [];
                
                if (reset) {
                    this.factories = newFactories;
                    this.allFactories = [...newFactories];
                } else {
                    this.factories = [...this.factories, ...newFactories];
                    // 更新allFactories以包含所有加载的数据
                    this.allFactories = [...this.factories];
                }
                
                this.totalCount = response.data.total || this.factories.length;
                this.hasMore = newFactories.length === this.pageSize;
                
                if (!reset) {
                    this.page++;
                }
                
                // 🎯 更新统计信息
                this.calculateFactoryStatsFromData();
                
                this.renderFactoryGrid();
                this.updateLoadMoreSection();
                
            } else {
                throw new Error(response.message || '加载工厂数据失败');
            }
            
        } catch (error) {
            console.error('加载工厂数据失败:', error);
            Utils.toast.error('加载工厂数据失败: ' + error.message);
            this.showEmptyState();
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    // 🎯 拼音搜索功能 - 对标微信小程序
    onFactorySearch(e) {
        const keyword = e.target.value.trim();
        this.searchKeyword = keyword;
        
        // 显示/隐藏清除按钮
        const clearIcon = document.getElementById('clearSearchIcon');
        if (clearIcon) {
            clearIcon.style.display = keyword ? 'block' : 'none';
        }
        
        // 实时搜索过滤
        if (keyword) {
            this.isSearchMode = true;
            this.filterFactories(keyword);
        } else {
            this.isSearchMode = false;
            this.filteredFactories = [...this.allFactories];
            this.renderFactoryGrid();
        }
        
        this.updateSearchResultsInfo();
    }
    
    // 🔍 智能搜索过滤 - 支持拼音搜索，对标微信小程序
    filterFactories(keyword) {
        if (!keyword) {
            this.filteredFactories = [...this.allFactories];
            return;
        }
        
        this.filteredFactories = this.allFactories.filter(factory => {
            // 🎯 使用拼音搜索工具进行智能匹配
            if (window.PinyinUtils) {
                // 工厂名称匹配
                if (PinyinUtils.searchMatch(factory.name, keyword)) return true;
                
                // 地址匹配
                if (factory.address && PinyinUtils.searchMatch(factory.address, keyword)) return true;
                
                // 工序匹配
                if (factory.processes) {
                    const processesText = Array.isArray(factory.processes) ? 
                        factory.processes.join(' ') : factory.processes;
                    if (PinyinUtils.searchMatch(processesText, keyword)) return true;
                }
            } else {
                // 🔄 备用搜索：普通字符串匹配
                if (factory.name && factory.name.includes(keyword)) return true;
                if (factory.address && factory.address.includes(keyword)) return true;
                if (factory.processes) {
                    const processesText = Array.isArray(factory.processes) ? 
                        factory.processes.join(' ') : factory.processes;
                    if (processesText.includes(keyword)) return true;
                }
            }
            
            // 电话号码匹配（数字直接匹配）
            if (factory.phone && factory.phone.includes(keyword)) return true;
            
            return false;
        });
        
        console.log('[filterFactories] 筛选结果:', this.filteredFactories.length, '家工厂');
        this.renderFactoryGrid();
    }
    
    onSearchButtonClick() {
        if (this.searchKeyword) {
            this.loadFactories(true);
        }
    }
    
    clearFactorySearch() {
        this.searchKeyword = '';
        this.isSearchMode = false;
        
        const searchInput = document.getElementById('factorySearchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        const clearIcon = document.getElementById('clearSearchIcon');
        if (clearIcon) {
            clearIcon.style.display = 'none';
        }
        
        this.filteredFactories = [...this.allFactories];
        this.renderFactoryGrid();
        this.updateSearchResultsInfo();
    }
    
    updateSearchResultsInfo() {
        const searchResultsInfo = document.getElementById('searchResultsInfo');
        const searchResultCount = document.getElementById('searchResultCount');
        
        if (searchResultsInfo && searchResultCount) {
            if (this.isSearchMode) {
                searchResultsInfo.style.display = 'block';
                searchResultCount.textContent = this.filteredFactories.length;
            } else {
                searchResultsInfo.style.display = 'none';
            }
        }
    }
    
    // 🎯 工厂网格渲染 - 对标微信小程序卡片式布局
    renderFactoryGrid() {
        const factoryGrid = document.getElementById('factoryGrid');
        const emptyWrapper = document.getElementById('emptyWrapper');
        
        if (!factoryGrid) return;
        
        const factoriesToRender = this.isSearchMode ? this.filteredFactories : this.factories;
        
        if (factoriesToRender.length === 0) {
            factoryGrid.style.display = 'none';
            this.showEmptyState();
            return;
        }
        
        if (emptyWrapper) {
            emptyWrapper.style.display = 'none';
        }
        factoryGrid.style.display = 'grid';
        
        factoryGrid.innerHTML = factoriesToRender.map(factory => this.renderFactoryCard(factory)).join('');
    }
    
    renderFactoryCard(factory) {
        const isDisabled = factory.status === 'inactive' || factory.status === 0;
        const balanceDisplay = this.getBalanceDisplay(factory);
        const processesText = Array.isArray(factory.processes) ? factory.processes.join('、') : (factory.processes || '');
        const createTime = factory.createTime ? this.formatDateTime(factory.createTime) : '';
        
        return `
            <div class="factory-card ${isDisabled ? 'disabled' : ''}" onclick="factoryManage.editFactory('${factory._id || factory.id}')">
                <!-- 卡片内容 -->
                <div class="card-content">
                    <!-- 工厂基本信息 -->
                    <div class="factory-header">
                        <div class="factory-name">${this.escapeHtml(factory.name)}</div>
                    </div>
                    
                    <!-- 工序和联系信息 -->
                    <div class="factory-details">
                        ${processesText ? `
                            <div class="detail-row">
                                <span class="detail-icon">⚙️</span>
                                <span class="detail-content">${this.escapeHtml(processesText)}</span>
                            </div>
                        ` : ''}
                        ${factory.phone ? `
                            <div class="detail-row">
                                <span class="detail-icon">📞</span>
                                <span class="detail-content">${this.escapeHtml(factory.phone)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- 账户状态 -->
                    <div class="account-status">
                        <div class="account-label">账户状态</div>
                        <div class="account-value">
                            ${balanceDisplay}
                        </div>
                    </div>
                </div>
                
                <!-- 卡片操作 -->
                <div class="card-actions" onclick="event.stopPropagation()">
                    <button class="action-btn account-btn" onclick="factoryManage.viewAccountDetail('${factory._id || factory.id}', '${this.escapeHtml(factory.name)}')">
                        <span class="btn-icon">📊</span>
                        <span class="btn-text">账户</span>
                    </button>
                    <button class="action-btn pay-btn" onclick="factoryManage.openPayDebtModal('${factory._id || factory.id}', '${this.escapeHtml(factory.name)}', ${factory.debt || 0})">
                        <span class="btn-icon">💰</span>
                        <span class="btn-text">付款</span>
                    </button>
                </div>
                
                <!-- 创建日期 -->
                ${createTime ? `
                    <div class="factory-create-time">
                        <span class="time-value">${createTime}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    getBalanceDisplay(factory) {
        const balance = parseFloat(factory.balance || 0);
        const debt = parseFloat(factory.debt || 0);
        
        if (balance > 0) {
            return `<span class="balance-positive">余款 ¥${balance.toFixed(2)}</span>`;
        } else if (debt > 0) {
            return `<span class="balance-negative">欠款 ¥${debt.toFixed(2)}</span>`;
        } else {
            return `<span class="balance-zero">¥0.00</span>`;
        }
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDateTime(dateTime) {
        if (!dateTime) return '';
        const date = new Date(dateTime);
        return date.toLocaleDateString('zh-CN');
    }
    
    showLoading() {
        const loadingWrapper = document.getElementById('loadingWrapper');
        if (loadingWrapper) {
            loadingWrapper.style.display = 'block';
        }
    }
    
    hideLoading() {
        const loadingWrapper = document.getElementById('loadingWrapper');
        if (loadingWrapper) {
            loadingWrapper.style.display = 'none';
        }
    }
    
    showEmptyState() {
        const emptyWrapper = document.getElementById('emptyWrapper');
        const emptyTitle = document.getElementById('emptyTitle');
        const emptyDesc = document.getElementById('emptyDesc');
        
        if (emptyWrapper) {
            emptyWrapper.style.display = 'block';
            
            if (this.isSearchMode) {
                if (emptyTitle) emptyTitle.textContent = '未找到相关工厂';
                if (emptyDesc) emptyDesc.textContent = '请尝试其他关键词或添加新工厂';
            } else {
                if (emptyTitle) emptyTitle.textContent = '暂无工厂数据';
                if (emptyDesc) emptyDesc.textContent = '点击右上角"新增"按钮添加第一家工厂';
            }
        }
    }
    
    // 🎯 显示新增工厂模态框
    showAddModal() {
        this.isAdding = true;
        this.editingFactory = {
            name: '',
            phone: '',
            address: '',
            processes: [],
            remark: '',
            status: 'active'
        };
        
        this.showEditModal = true;
        this.renderEditModal();
        this.showModalOverlay();
    }
    
    // 🎯 编辑工厂功能 - 对标微信小程序
    async editFactory(factoryId) {
        if (!factoryId) {
            Utils.toast.error('工厂ID不能为空');
            return;
        }
        
        try {
            // 显示加载状态
            Utils.loading.show('加载工厂信息...');
            
            // 🛡️ 使用组织隔离的API获取工厂详情
            const response = await API.get(`/factories/${factoryId}`);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                this.isAdding = false;
                this.editingFactory = {
                    _id: response.data._id || response.data.id,
                    name: response.data.name || '',
                    phone: response.data.phone || '',
                    address: response.data.address || '',
                    processes: response.data.processes || [],
                    remark: response.data.remark || '',
                    status: response.data.status || 'active',
                    balance: response.data.balance || 0,
                    debt: response.data.debt || 0
                };
                
                this.showEditModal = true;
                this.renderEditModal();
                this.showModalOverlay();
                
            } else {
                throw new Error(response.message || '获取工厂信息失败');
            }
            
        } catch (error) {
            console.error('编辑工厂失败:', error);
            Utils.toast.error('获取工厂信息失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 🎯 渲染编辑模态框
    renderEditModal() {
        const modalTitle = document.getElementById('editModalTitle');
        const aiSuggestion = document.getElementById('aiSuggestion');
        const editWarning = document.getElementById('editWarning');
        
        if (modalTitle) {
            modalTitle.textContent = this.isAdding ? '🏭 新增工厂' : '✏️ 编辑工厂';
        }
        
        // 显示AI建议（新增时）
        if (aiSuggestion) {
            aiSuggestion.style.display = this.isAdding ? 'flex' : 'none';
        }
        
        // 显示编辑警告（编辑且有余额/欠款时）
        if (editWarning) {
            const hasBalanceOrDebt = !this.isAdding && 
                (parseFloat(this.editingFactory.balance || 0) > 0 || 
                 parseFloat(this.editingFactory.debt || 0) > 0);
            editWarning.style.display = hasBalanceOrDebt ? 'flex' : 'none';
        }
        
        // 填充表单数据
        this.fillFormData();
    }
    
    // 🎯 填充表单数据
    fillFormData() {
        const factoryName = document.getElementById('factoryName');
        const factoryPhone = document.getElementById('factoryPhone');
        const factoryAddress = document.getElementById('factoryAddress');
        const factoryRemark = document.getElementById('factoryRemark');
        const factoryStatus = document.getElementById('factoryStatus');
        const statusText = document.querySelector('.status-text');
        
        if (factoryName) {
            factoryName.value = this.editingFactory.name;
            // 有余额或欠款时不允许修改名称
            const hasBalanceOrDebt = !this.isAdding && 
                (parseFloat(this.editingFactory.balance || 0) > 0 || 
                 parseFloat(this.editingFactory.debt || 0) > 0);
            factoryName.disabled = hasBalanceOrDebt;
        }
        
        if (factoryPhone) {
            factoryPhone.value = this.editingFactory.phone;
            // 有余额或欠款时不允许修改电话
            const hasBalanceOrDebt = !this.isAdding && 
                (parseFloat(this.editingFactory.balance || 0) > 0 || 
                 parseFloat(this.editingFactory.debt || 0) > 0);
            factoryPhone.disabled = hasBalanceOrDebt;
        }
        
        if (factoryAddress) {
            factoryAddress.value = this.editingFactory.address;
        }
        
        if (factoryRemark) {
            factoryRemark.value = this.editingFactory.remark;
        }
        
        if (factoryStatus) {
            const isActive = this.editingFactory.status === 'active' || this.editingFactory.status === 1;
            factoryStatus.checked = isActive;
            if (statusText) {
                statusText.textContent = isActive ? '启用' : '停用';
            }
        }
        
        // 渲染已选择的工序
        this.renderSelectedProcesses();
    }
    
    // 🎯 渲染已选择的工序
    renderSelectedProcesses() {
        const selectedProcesses = document.getElementById('selectedProcesses');
        if (!selectedProcesses) return;
        
        const processes = this.editingFactory.processes || [];
        
        if (processes.length === 0) {
            selectedProcesses.innerHTML = '<div class="placeholder-text">请选择工序</div>';
            return;
        }
        
        // 将工序数组转换为标签显示
        const processArray = Array.isArray(processes) ? processes : [processes];
        const processNames = processArray.map(process => {
            if (typeof process === 'string') {
                return process;
            } else if (process && process.name) {
                return process.name;
            }
            return '';
        }).filter(name => name);
        
        selectedProcesses.innerHTML = processNames.map(name => 
            `<span class="process-tag">
                ${this.escapeHtml(name)}
                <button type="button" class="remove-tag-btn" onclick="factoryManage.removeProcessTag('${this.escapeHtml(name)}')">×</button>
            </span>`
        ).join('');
    }
    
    // 🎯 显示模态框遮罩
    showModalOverlay() {
        const overlay = document.getElementById('editModalOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            // 防止页面滚动
            document.body.style.overflow = 'hidden';
        }
    }
    
    // 🎯 关闭编辑模态框
    closeEditModal() {
        const overlay = document.getElementById('editModalOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            // 恢复页面滚动
            document.body.style.overflow = '';
        }
        
        this.showEditModal = false;
        this.editingFactory = {
            name: '',
            phone: '',
            address: '',
            processes: [],
            remark: '',
            status: 'active'
        };
    }
    
    // 🎯 保存工厂信息 - 完整的验证和保存逻辑
    async saveFactory() {
        try {
            // 🛡️ 表单验证
            const validationResult = this.validateFactoryForm();
            if (!validationResult.isValid) {
                Utils.toast.error(validationResult.message);
                return;
            }
            
            // 显示保存状态
            this.showSaveLoading(true);
            
            // 🛡️ 收集表单数据
            const formData = this.collectFactoryFormData();
            
            let response;
            if (this.isAdding) {
                // 新增工厂
                response = await API.post('/factories', formData);
            } else {
                // 更新工厂
                response = await API.put(`/factories/${this.editingFactory._id}`, formData);
            }
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                Utils.toast.success(this.isAdding ? '工厂添加成功' : '工厂更新成功');
                
                // 关闭模态框
                this.closeEditModal();
                
                // 重新加载数据
                await this.loadFactories(true);
                
            } else {
                throw new Error(response.message || '保存工厂信息失败');
            }
            
        } catch (error) {
            console.error('保存工厂失败:', error);
            Utils.toast.error('保存失败: ' + error.message);
        } finally {
            this.showSaveLoading(false);
        }
    }
    
    // 🛡️ 工厂表单验证
    validateFactoryForm() {
        const factoryName = document.getElementById('factoryName')?.value?.trim();
        const factoryPhone = document.getElementById('factoryPhone')?.value?.trim();
        
        // 工厂名称必填
        if (!factoryName) {
            return { isValid: false, message: '请输入工厂名称' };
        }
        
        if (factoryName.length < 2) {
            return { isValid: false, message: '工厂名称至少需要2个字符' };
        }
        
        if (factoryName.length > 50) {
            return { isValid: false, message: '工厂名称不能超过50个字符' };
        }
        
        // 电话号码验证（可选）
        if (factoryPhone && factoryPhone.length > 0) {
            const phoneRegex = /^[0-9\-\+\(\)\s]{7,20}$/;
            if (!phoneRegex.test(factoryPhone)) {
                return { isValid: false, message: '请输入有效的电话号码' };
            }
        }
        
        // 工序必须选择至少一个
        if (!this.editingFactory.processes || this.editingFactory.processes.length === 0) {
            return { isValid: false, message: '请至少选择一个工序' };
        }
        
        return { isValid: true, message: '' };
    }
    
    // 🛡️ 收集工厂表单数据
    collectFactoryFormData() {
        const factoryName = document.getElementById('factoryName')?.value?.trim();
        const factoryPhone = document.getElementById('factoryPhone')?.value?.trim();
        const factoryAddress = document.getElementById('factoryAddress')?.value?.trim();
        const factoryRemark = document.getElementById('factoryRemark')?.value?.trim();
        const factoryStatus = document.getElementById('factoryStatus')?.checked;
        
        return {
            name: factoryName,
            phone: factoryPhone,
            address: factoryAddress,
            processes: this.editingFactory.processes,
            remark: factoryRemark,
            status: factoryStatus ? 'active' : 'inactive'
        };
    }
    
    // 🎯 显示保存加载状态
    showSaveLoading(isLoading) {
        const saveBtnText = document.getElementById('saveBtnText');
        const saveBtnSpinner = document.getElementById('saveBtnSpinner');
        const saveBtn = saveBtnText?.closest('button');
        
        if (saveBtnText) {
            saveBtnText.style.display = isLoading ? 'none' : 'inline';
        }
        if (saveBtnSpinner) {
            saveBtnSpinner.style.display = isLoading ? 'inline-block' : 'none';
        }
        if (saveBtn) {
            saveBtn.disabled = isLoading;
        }
    }
    
    // 🎯 显示工序选择器
    showProcessSelector() {
        if (!this.allProcesses || this.allProcesses.length === 0) {
            Utils.toast.error('暂无可用工序，请先添加工序');
            return;
        }
        
        // 创建工序选择模态框
        this.renderProcessSelectorModal();
    }
    
    // 🎯 渲染工序选择模态框
    renderProcessSelectorModal() {
        // 创建模态框HTML
        const modalHtml = `
            <div class="modal-overlay" id="processSelectorOverlay" onclick="factoryManage.closeProcessSelector()">
                <div class="modal-container" onclick="event.stopPropagation()" style="max-width: 400px;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title">⚙️ 选择工序</div>
                            <button class="modal-close" onclick="factoryManage.closeProcessSelector()">×</button>
                        </div>
                        <div class="modal-body">
                            <div class="process-list">
                                ${this.allProcesses.map(process => {
                                    const isSelected = this.isProcessSelected(process);
                                    return `
                                        <label class="process-item ${isSelected ? 'selected' : ''}">
                                            <input type="checkbox" 
                                                   class="process-checkbox" 
                                                   value="${this.escapeHtml(process.name || process)}"
                                                   ${isSelected ? 'checked' : ''}
                                                   onchange="factoryManage.toggleProcess(this)">
                                            <span class="process-name">${this.escapeHtml(process.name || process)}</span>
                                            <span class="checkmark">✓</span>
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary apple-btn" onclick="factoryManage.closeProcessSelector()">取消</button>
                            <button class="btn-primary apple-btn" onclick="factoryManage.confirmProcessSelection()">确定</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 防止页面滚动
        document.body.style.overflow = 'hidden';
    }
    
    // 🎯 检查工序是否已选择
    isProcessSelected(process) {
        const processName = process.name || process;
        const selectedProcesses = this.editingFactory.processes || [];
        
        return selectedProcesses.some(selected => {
            const selectedName = selected.name || selected;
            return selectedName === processName;
        });
    }
    
    // 🎯 切换工序选择状态
    toggleProcess(checkbox) {
        const processName = checkbox.value;
        const processItem = checkbox.closest('.process-item');
        
        if (checkbox.checked) {
            processItem.classList.add('selected');
        } else {
            processItem.classList.remove('selected');
        }
    }
    
    // 🎯 确认工序选择
    confirmProcessSelection() {
        const checkboxes = document.querySelectorAll('.process-checkbox:checked');
        const selectedProcesses = Array.from(checkboxes).map(cb => cb.value);
        
        this.editingFactory.processes = selectedProcesses;
        this.renderSelectedProcesses();
        this.closeProcessSelector();
    }
    
    // 🎯 关闭工序选择器
    closeProcessSelector() {
        const overlay = document.getElementById('processSelectorOverlay');
        if (overlay) {
            overlay.remove();
            // 恢复页面滚动
            document.body.style.overflow = '';
        }
    }
    
    // 🎯 移除工序标签
    removeProcessTag(processName) {
        if (!this.editingFactory.processes) return;
        
        this.editingFactory.processes = this.editingFactory.processes.filter(process => {
            const name = process.name || process;
            return name !== processName;
        });
        
        this.renderSelectedProcesses();
    }
    
    // 🎯 查看账户详情 - 对标微信小程序
    async viewAccountDetail(factoryId, factoryName) {
        if (!factoryId) {
            Utils.toast.error('工厂ID不能为空');
            return;
        }
        
        try {
            this.currentFactoryId = factoryId;
            this.currentFactoryName = factoryName;
            this.showAccountDetail = true;
            
            // 渲染账户详情模态框
            this.renderAccountDetailModal();
            
            // 加载账户记录
            await this.loadAccountRecords();
            
        } catch (error) {
            console.error('查看账户详情失败:', error);
            Utils.toast.error('查看账户详情失败: ' + error.message);
        }
    }
    
    // 🎯 渲染账户详情模态框
    renderAccountDetailModal() {
        const modalHtml = `
            <div class="modal-overlay" id="accountDetailOverlay" onclick="factoryManage.closeAccountDetail()">
                <div class="modal-container" onclick="event.stopPropagation()" style="max-width: 800px; max-height: 80vh;">
                    <div class="modal-content" style="height: 100%;">
                        <div class="modal-header">
                            <div class="modal-title">📊 ${this.escapeHtml(this.currentFactoryName)} - 账户详情</div>
                            <button class="modal-close" onclick="factoryManage.closeAccountDetail()">×</button>
                        </div>
                        <div class="modal-body" style="flex: 1; overflow-y: auto;">
                            <!-- 账户概览 -->
                            <div class="account-overview">
                                <div class="overview-card balance-card">
                                    <div class="overview-label">账户余额</div>
                                    <div class="overview-value balance-value" id="accountBalance">¥0.00</div>
                                </div>
                                <div class="overview-card debt-card">
                                    <div class="overview-label">欠款金额</div>
                                    <div class="overview-value debt-value" id="accountDebt">¥0.00</div>
                                </div>
                                <div class="overview-card total-card">
                                    <div class="overview-label">净余额</div>
                                    <div class="overview-value total-value" id="accountTotal">¥0.00</div>
                                </div>
                            </div>
                            
                            <!-- 操作按钮 -->
                            <div class="account-actions">
                                <button class="apple-btn apple-btn-primary" onclick="factoryManage.openPayDebtModal('${this.currentFactoryId}', '${this.escapeHtml(this.currentFactoryName)}', 0)">
                                    💰 付款
                                </button>
                                <button class="apple-btn apple-btn-secondary" onclick="factoryManage.openPaymentHistory('${this.currentFactoryId}')">
                                    📋 付款历史
                                </button>
                                <button class="apple-btn apple-btn-secondary" onclick="factoryManage.exportAccountDetail('${this.currentFactoryId}')">
                                    📤 导出明细
                                </button>
                            </div>
                            
                            <!-- 账户记录列表 -->
                            <div class="account-records-section">
                                <div class="section-title">
                                    <span>📈 账户流水</span>
                                    <button class="refresh-btn apple-btn" onclick="factoryManage.refreshAccountRecords()">
                                        🔄 刷新
                                    </button>
                                </div>
                                
                                <div class="records-loading" id="recordsLoading" style="display: none;">
                                    <div class="loading-spinner"></div>
                                    <div class="loading-text">加载中...</div>
                                </div>
                                
                                <div class="records-list" id="accountRecordsList">
                                    <!-- 记录将动态生成 -->
                                </div>
                                
                                <div class="records-empty" id="recordsEmpty" style="display: none;">
                                    <div class="empty-icon">📊</div>
                                    <div class="empty-text">暂无账户记录</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';
    }
    
    // 🛡️ 加载账户记录
    async loadAccountRecords() {
        if (this.isLoadingRecords) return;
        
        try {
            this.isLoadingRecords = true;
            this.showRecordsLoading(true);
            
            // 🛡️ 使用组织隔离的API获取账户记录
            const response = await API.get(`/factories/${this.currentFactoryId}/account-records`);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                this.accountRecords = response.data.records || [];
                const accountInfo = response.data.accountInfo || {};
                
                // 更新账户概览
                this.updateAccountOverview(accountInfo);
                
                // 渲染账户记录
                this.renderAccountRecords();
                
            } else {
                throw new Error(response.message || '加载账户记录失败');
            }
            
        } catch (error) {
            console.error('加载账户记录失败:', error);
            Utils.toast.error('加载账户记录失败: ' + error.message);
            this.showRecordsEmpty();
        } finally {
            this.isLoadingRecords = false;
            this.showRecordsLoading(false);
        }
    }
    
    // 🎯 更新账户概览
    updateAccountOverview(accountInfo) {
        const balanceElement = document.getElementById('accountBalance');
        const debtElement = document.getElementById('accountDebt');
        const totalElement = document.getElementById('accountTotal');
        
        const balance = parseFloat(accountInfo.balance || 0);
        const debt = parseFloat(accountInfo.debt || 0);
        const total = balance - debt;
        
        if (balanceElement) {
            balanceElement.textContent = `¥${balance.toFixed(2)}`;
            balanceElement.className = `overview-value balance-value ${balance > 0 ? 'positive' : ''}`;
        }
        
        if (debtElement) {
            debtElement.textContent = `¥${debt.toFixed(2)}`;
            debtElement.className = `overview-value debt-value ${debt > 0 ? 'negative' : ''}`;
        }
        
        if (totalElement) {
            totalElement.textContent = `¥${total.toFixed(2)}`;
            totalElement.className = `overview-value total-value ${total > 0 ? 'positive' : total < 0 ? 'negative' : ''}`;
        }
    }
    
    // 🎯 渲染账户记录
    renderAccountRecords() {
        const recordsList = document.getElementById('accountRecordsList');
        const recordsEmpty = document.getElementById('recordsEmpty');
        
        if (!recordsList) return;
        
        if (this.accountRecords.length === 0) {
            recordsList.style.display = 'none';
            if (recordsEmpty) recordsEmpty.style.display = 'block';
            return;
        }
        
        if (recordsEmpty) recordsEmpty.style.display = 'none';
        recordsList.style.display = 'block';
        
        recordsList.innerHTML = this.accountRecords.map(record => this.renderAccountRecord(record)).join('');
    }
    
    // 🎯 渲染单个账户记录
    renderAccountRecord(record) {
        const amount = parseFloat(record.amount || 0);
        const type = record.type || 'payment';
        const date = record.createTime ? new Date(record.createTime).toLocaleDateString('zh-CN') : '';
        const time = record.createTime ? new Date(record.createTime).toLocaleTimeString('zh-CN') : '';
        
        const typeIcon = {
            'payment': '💰',
            'order': '📦',
            'adjustment': '⚖️',
            'refund': '↩️'
        }[type] || '📊';
        
        const typeText = {
            'payment': '付款',
            'order': '订单',
            'adjustment': '调整',
            'refund': '退款'
        }[type] || '记录';
        
        return `
            <div class="record-item">
                <div class="record-icon">${typeIcon}</div>
                <div class="record-content">
                    <div class="record-header">
                        <div class="record-type">${typeText}</div>
                        <div class="record-amount ${amount > 0 ? 'positive' : amount < 0 ? 'negative' : ''}">
                            ${amount > 0 ? '+' : ''}¥${Math.abs(amount).toFixed(2)}
                        </div>
                    </div>
                    <div class="record-details">
                        <div class="record-desc">${this.escapeHtml(record.description || record.remark || '-')}</div>
                        <div class="record-time">${date} ${time}</div>
                    </div>
                    ${record.orderNo ? `<div class="record-order">订单号: ${this.escapeHtml(record.orderNo)}</div>` : ''}
                </div>
                ${record.imageUrls && record.imageUrls.length > 0 ? `
                    <div class="record-images">
                        ${record.imageUrls.slice(0, 3).map(url => 
                            `<img src="${this.escapeHtml(url)}" class="record-image" onclick="factoryManage.previewRecordImages('${record._id}')" />`
                        ).join('')}
                        ${record.imageUrls.length > 3 ? `<div class="more-images">+${record.imageUrls.length - 3}</div>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // 🎯 显示记录加载状态
    showRecordsLoading(isLoading) {
        const loading = document.getElementById('recordsLoading');
        if (loading) {
            loading.style.display = isLoading ? 'block' : 'none';
        }
    }
    
    // 🎯 显示记录空状态
    showRecordsEmpty() {
        const recordsList = document.getElementById('accountRecordsList');
        const recordsEmpty = document.getElementById('recordsEmpty');
        
        if (recordsList) recordsList.style.display = 'none';
        if (recordsEmpty) recordsEmpty.style.display = 'block';
    }
    
    // 🎯 关闭账户详情
    closeAccountDetail() {
        const overlay = document.getElementById('accountDetailOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
        
        this.showAccountDetail = false;
        this.currentFactoryId = '';
        this.currentFactoryName = '';
        this.accountRecords = [];
    }
    
    // 🎯 刷新账户记录
    async refreshAccountRecords() {
        if (this.currentFactoryId) {
            await this.loadAccountRecords();
        }
    }
    
    // 🎯 打开付款模态框 - 对标微信小程序
    async openPayDebtModal(factoryId, factoryName, debt) {
        if (!factoryId) {
            Utils.toast.error('工厂ID不能为空');
            return;
        }
        
        try {
            // 获取最新的工厂信息
            const response = await API.get(`/factories/${factoryId}`);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                this.payingFactory = {
                    _id: factoryId,
                    name: factoryName,
                    debt: parseFloat(response.data.debt || 0),
                    balance: parseFloat(response.data.balance || 0)
                };
                
                this.payAmount = '';
                this.selectedPaymentMethod = 'cash';
                this.paymentRemark = '';
                this.remarkImages = [];
                
                this.renderPaymentModal();
                
            } else {
                throw new Error(response.message || '获取工厂信息失败');
            }
            
        } catch (error) {
            console.error('打开付款模态框失败:', error);
            Utils.toast.error('获取工厂信息失败: ' + error.message);
        }
    }
    
    // 🎯 渲染付款模态框
    renderPaymentModal() {
        const modalHtml = `
            <div class="modal-overlay" id="paymentModalOverlay" onclick="factoryManage.closePayDebtModal()">
                <div class="modal-container" onclick="event.stopPropagation()" style="max-width: 500px;">
                    <div class="modal-content">
                        <div class="modal-header">
                            <div class="modal-title">💰 付款给 ${this.escapeHtml(this.payingFactory.name)}</div>
                            <button class="modal-close" onclick="factoryManage.closePayDebtModal()">×</button>
                        </div>
                        <div class="modal-body">
                            <!-- 账户状态 -->
                            <div class="payment-account-info">
                                <div class="account-info-item">
                                    <span class="info-label">当前欠款:</span>
                                    <span class="info-value debt-amount">¥${this.payingFactory.debt.toFixed(2)}</span>
                                </div>
                                <div class="account-info-item">
                                    <span class="info-label">账户余额:</span>
                                    <span class="info-value balance-amount">¥${this.payingFactory.balance.toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <!-- 付款表单 -->
                            <form class="payment-form" id="paymentForm">
                                <div class="form-item">
                                    <label class="form-label required">付款金额</label>
                                    <div class="amount-input-wrapper">
                                        <span class="currency-symbol">¥</span>
                                        <input type="number" 
                                               class="form-input amount-input" 
                                               id="paymentAmount" 
                                               placeholder="0.00" 
                                               step="0.01" 
                                               min="0.01"
                                               oninput="factoryManage.validatePaymentAmount(this)"
                                               required>
                                    </div>
                                    <div class="quick-amount-btns">
                                        ${this.payingFactory.debt > 0 ? `
                                            <button type="button" class="quick-btn apple-btn" onclick="factoryManage.setQuickAmount(${this.payingFactory.debt})">
                                                清欠 ¥${this.payingFactory.debt.toFixed(2)}
                                            </button>
                                        ` : ''}
                                        <button type="button" class="quick-btn apple-btn" onclick="factoryManage.setQuickAmount(100)">¥100</button>
                                        <button type="button" class="quick-btn apple-btn" onclick="factoryManage.setQuickAmount(500)">¥500</button>
                                        <button type="button" class="quick-btn apple-btn" onclick="factoryManage.setQuickAmount(1000)">¥1000</button>
                                    </div>
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label required">付款方式</label>
                                    <div class="payment-methods">
                                        ${this.paymentMethods.map(method => `
                                            <label class="payment-method-item ${this.selectedPaymentMethod === method.value ? 'selected' : ''}">
                                                <input type="radio" 
                                                       name="paymentMethod" 
                                                       value="${method.value}"
                                                       ${this.selectedPaymentMethod === method.value ? 'checked' : ''}
                                                       onchange="factoryManage.selectPaymentMethod('${method.value}')">
                                                <span class="method-icon">${this.getPaymentMethodIcon(method.value)}</span>
                                                <span class="method-label">${method.label}</span>
                                            </label>
                                        `).join('')}
                                    </div>
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label">备注</label>
                                    <textarea class="form-textarea" 
                                              id="paymentRemark" 
                                              placeholder="请输入付款备注"
                                              rows="3"
                                              oninput="factoryManage.updatePaymentRemark(this.value)"></textarea>
                                </div>
                                
                                <div class="form-item">
                                    <label class="form-label">上传凭证</label>
                                    <div class="image-upload-section">
                                        <div class="uploaded-images" id="uploadedImages">
                                            <!-- 上传的图片将显示在这里 -->
                                        </div>
                                        <button type="button" class="upload-btn apple-btn" onclick="factoryManage.selectPaymentImages()">
                                            📷 上传凭证
                                        </button>
                                        <input type="file" 
                                               id="paymentImageInput" 
                                               accept="image/*" 
                                               multiple 
                                               style="display: none"
                                               onchange="factoryManage.handlePaymentImageUpload(this)">
                                    </div>
                                </div>
                            </form>
                            
                            <!-- 付款预览 -->
                            <div class="payment-preview" id="paymentPreview" style="display: none;">
                                <div class="preview-title">付款预览</div>
                                <div class="preview-details">
                                    <div class="preview-item">
                                        <span>付款金额:</span>
                                        <span class="preview-amount">¥0.00</span>
                                    </div>
                                    <div class="preview-item">
                                        <span>付款后余额:</span>
                                        <span class="preview-balance">¥0.00</span>
                                    </div>
                                    <div class="preview-item">
                                        <span>付款后欠款:</span>
                                        <span class="preview-debt">¥0.00</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary apple-btn" onclick="factoryManage.closePayDebtModal()">取消</button>
                            <button class="btn-primary apple-btn" onclick="factoryManage.confirmPayment()" id="confirmPaymentBtn" disabled>
                                <span class="btn-text">确认付款</span>
                                <div class="btn-spinner" style="display: none;"></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';
    }
    
    // 🎯 获取付款方式图标
    getPaymentMethodIcon(method) {
        const icons = {
            'cash': '💵',
            'bank': '🏦',
            'wechat': '💚',
            'alipay': '🔵'
        };
        return icons[method] || '💰';
    }
    
    // 🎯 验证付款金额
    validatePaymentAmount(input) {
        const amount = parseFloat(input.value);
        this.payAmount = input.value;
        
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        const preview = document.getElementById('paymentPreview');
        
        if (amount > 0) {
            confirmBtn.disabled = false;
            if (preview) {
                this.updatePaymentPreview(amount);
                preview.style.display = 'block';
            }
        } else {
            confirmBtn.disabled = true;
            if (preview) {
                preview.style.display = 'none';
            }
        }
    }
    
    // 🎯 更新付款预览
    updatePaymentPreview(amount) {
        const previewAmount = document.querySelector('.preview-amount');
        const previewBalance = document.querySelector('.preview-balance');
        const previewDebt = document.querySelector('.preview-debt');
        
        const newBalance = this.payingFactory.balance + amount;
        const newDebt = Math.max(0, this.payingFactory.debt - amount);
        
        if (previewAmount) previewAmount.textContent = `¥${amount.toFixed(2)}`;
        if (previewBalance) previewBalance.textContent = `¥${newBalance.toFixed(2)}`;
        if (previewDebt) previewDebt.textContent = `¥${newDebt.toFixed(2)}`;
    }
    
    // 🎯 设置快速金额
    setQuickAmount(amount) {
        const amountInput = document.getElementById('paymentAmount');
        if (amountInput) {
            amountInput.value = amount.toFixed(2);
            this.validatePaymentAmount(amountInput);
        }
    }
    
    // 🎯 选择付款方式
    selectPaymentMethod(method) {
        this.selectedPaymentMethod = method;
        
        // 更新UI选中状态
        document.querySelectorAll('.payment-method-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        const selectedItem = document.querySelector(`input[value="${method}"]`)?.closest('.payment-method-item');
        if (selectedItem) {
            selectedItem.classList.add('selected');
        }
    }
    
    // 🎯 更新付款备注
    updatePaymentRemark(remark) {
        this.paymentRemark = remark;
    }
    
    // 🎯 选择付款凭证图片
    selectPaymentImages() {
        const input = document.getElementById('paymentImageInput');
        if (input) {
            input.click();
        }
    }
    
    // 🎯 处理付款凭证图片上传
    async handlePaymentImageUpload(input) {
        const files = Array.from(input.files);
        if (files.length === 0) return;
        
        try {
            this.isUploadingImage = true;
            Utils.loading.show('上传图片中...');
            
            for (const file of files) {
                // 验证文件类型和大小
                if (!file.type.startsWith('image/')) {
                    Utils.toast.error('请选择图片文件');
                    continue;
                }
                
                if (file.size > 5 * 1024 * 1024) { // 5MB限制
                    Utils.toast.error('图片大小不能超过5MB');
                    continue;
                }
                
                // 🛡️ 上传图片到服务器
                const formData = new FormData();
                formData.append('image', file);
                formData.append('type', 'payment');
                
                const response = await API.post('/upload/image', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                
                if (response.success) {
                    Utils.orgSecurity.validateDataOwnership(response.data);
                    this.remarkImages.push(response.data.url);
                } else {
                    throw new Error(response.message || '图片上传失败');
                }
            }
            
            // 更新已上传图片显示
            this.renderUploadedImages();
            
            // 清空文件输入
            input.value = '';
            
        } catch (error) {
            console.error('上传图片失败:', error);
            Utils.toast.error('上传图片失败: ' + error.message);
        } finally {
            this.isUploadingImage = false;
            Utils.loading.hide();
        }
    }
    
    // 🎯 渲染已上传的图片
    renderUploadedImages() {
        const container = document.getElementById('uploadedImages');
        if (!container) return;
        
        container.innerHTML = this.remarkImages.map((url, index) => `
            <div class="uploaded-image-item">
                <img src="${this.escapeHtml(url)}" class="uploaded-image" onclick="factoryManage.previewPaymentImage(${index})">
                <button class="remove-image-btn" onclick="factoryManage.removePaymentImage(${index})">×</button>
            </div>
        `).join('');
    }
    
    // 🎯 移除付款凭证图片
    removePaymentImage(index) {
        this.remarkImages.splice(index, 1);
        this.renderUploadedImages();
    }
    
    // 🎯 关闭付款模态框
    closePayDebtModal() {
        const overlay = document.getElementById('paymentModalOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
        
        this.payingFactory = { _id: '', name: '', debt: 0 };
        this.payAmount = '';
        this.selectedPaymentMethod = 'cash';
        this.paymentRemark = '';
        this.remarkImages = [];
    }
    
    // 🎯 确认付款 - 完整的付款逻辑
    async confirmPayment() {
        try {
            const amount = parseFloat(this.payAmount);
            
            if (!amount || amount <= 0) {
                Utils.toast.error('请输入有效的付款金额');
                return;
            }
            
            // 显示确认对话框
            const confirmed = await Utils.modal.confirm(
                '确认付款',
                `确定要向 ${this.payingFactory.name} 付款 ¥${amount.toFixed(2)} 吗？`
            );
            
            if (!confirmed) return;
            
            // 显示付款状态
            this.showPaymentLoading(true);
            
            // 🛡️ 提交付款请求
            const paymentData = {
                factoryId: this.payingFactory._id,
                amount: amount,
                paymentMethod: this.selectedPaymentMethod,
                remark: this.paymentRemark,
                imageUrls: this.remarkImages
            };
            
            const response = await API.post('/factories/payment', paymentData);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                Utils.toast.success('付款成功');
                
                // 关闭付款模态框
                this.closePayDebtModal();
                
                // 如果账户详情页面打开，刷新数据
                if (this.showAccountDetail && this.currentFactoryId === this.payingFactory._id) {
                    await this.refreshAccountRecords();
                }
                
                // 刷新工厂列表
                await this.loadFactories(true);
                
            } else {
                throw new Error(response.message || '付款失败');
            }
            
        } catch (error) {
            console.error('付款失败:', error);
            Utils.toast.error('付款失败: ' + error.message);
        } finally {
            this.showPaymentLoading(false);
        }
    }
    
    // 🎯 显示付款加载状态
    showPaymentLoading(isLoading) {
        const confirmBtn = document.getElementById('confirmPaymentBtn');
        const btnText = confirmBtn?.querySelector('.btn-text');
        const btnSpinner = confirmBtn?.querySelector('.btn-spinner');
        
        if (btnText) btnText.style.display = isLoading ? 'none' : 'inline';
        if (btnSpinner) btnSpinner.style.display = isLoading ? 'inline-block' : 'none';
        if (confirmBtn) confirmBtn.disabled = isLoading;
    }
    
    // 🛡️ 使用组织隔离的API加载工厂统计信息
    async loadFactoryStats() {
        try {
            const response = await API.get('/factories/stats');
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                this.factoryStats = {
                    totalCount: response.data.totalCount || 0,
                    activeCount: response.data.activeCount || 0,
                    inactiveCount: response.data.inactiveCount || 0
                };
                
                this.updateFactoryStatsDisplay();
                
            } else {
                // 🔄 备用方案：从现有数据计算统计
                this.calculateFactoryStatsFromData();
            }
            
        } catch (error) {
            console.error('加载工厂统计失败:', error);
            // 🔄 备用方案：从现有数据计算统计
            this.calculateFactoryStatsFromData();
        }
    }
    
    // 📊 从现有数据计算工厂统计信息
    calculateFactoryStatsFromData() {
        const totalCount = this.allFactories.length;
        const activeCount = this.allFactories.filter(f => f.status === 'active' || f.status === 1).length;
        const inactiveCount = totalCount - activeCount;
        
        this.factoryStats = {
            totalCount,
            activeCount,
            inactiveCount
        };
        
        this.updateFactoryStatsDisplay();
    }
    
    // 🎯 更新工厂统计显示
    updateFactoryStatsDisplay() {
        const totalFactoryCount = document.getElementById('totalFactoryCount');
        const activeFactoryCount = document.getElementById('activeFactoryCount');
        const inactiveFactoryCount = document.getElementById('inactiveFactoryCount');
        
        if (totalFactoryCount) {
            totalFactoryCount.textContent = this.factoryStats.totalCount;
        }
        if (activeFactoryCount) {
            activeFactoryCount.textContent = this.factoryStats.activeCount;
        }
        if (inactiveFactoryCount) {
            inactiveFactoryCount.textContent = this.factoryStats.inactiveCount;
        }
    }
    
    // 🛡️ 使用组织隔离的API加载工序数据
    async loadProcesses() {
        if (this.isLoadingProcesses) return;
        
        try {
            this.isLoadingProcesses = true;
            
            const response = await API.get('/processes');
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                this.allProcesses = response.data.list || response.data || [];
                console.log('[loadProcesses] 工序数据加载成功:', this.allProcesses.length, '个工序');
                
            } else {
                throw new Error(response.message || '加载工序数据失败');
            }
            
        } catch (error) {
            console.error('加载工序数据失败:', error);
            Utils.toast.error('加载工序数据失败: ' + error.message);
            this.allProcesses = [];
        } finally {
            this.isLoadingProcesses = false;
        }
    }
    
    loadMoreFactories() {
        if (!this.isLoading && this.hasMore) {
            this.page++;
            this.loadFactories(false);
        }
    }
    
    updateLoadMoreSection() {
        const loadMoreSection = document.getElementById('loadMoreSection');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        const listEnd = document.getElementById('listEnd');
        const totalDisplayCount = document.getElementById('totalDisplayCount');
        
        if (this.factories.length > 0) {
            if (loadMoreSection) loadMoreSection.style.display = 'block';
            
            if (this.hasMore) {
                if (loadMoreBtn) loadMoreBtn.style.display = 'block';
                if (listEnd) listEnd.style.display = 'none';
            } else {
                if (loadMoreBtn) loadMoreBtn.style.display = 'none';
                if (listEnd) listEnd.style.display = 'block';
                if (totalDisplayCount) totalDisplayCount.textContent = this.totalCount;
            }
        } else {
            if (loadMoreSection) loadMoreSection.style.display = 'none';
        }
    }
    
    // 🎯 打开付款历史模态框
    async openPaymentHistory(factoryId) {
        if (!factoryId) {
            Utils.toast.error('工厂ID不能为空');
            return;
        }
        
        try {
            this.currentFactoryId = factoryId;
            this.showPaymentHistoryModal = true;
            this.paymentHistoryRecords = [];
            this.currentHistoryPage = 1;
            this.hasMoreHistory = true;
            
            // 渲染付款历史模态框
            this.renderPaymentHistoryModal();
            
            // 加载付款历史
            await this.loadPaymentHistory();
            
        } catch (error) {
            console.error('打开付款历史失败:', error);
            Utils.toast.error('打开付款历史失败: ' + error.message);
        }
    }
    
    // 🎯 渲染付款历史模态框
    renderPaymentHistoryModal() {
        const factory = this.allFactories.find(f => f._id === this.currentFactoryId || f.id === this.currentFactoryId);
        const factoryName = factory ? factory.name : '工厂';
        
        const modalHtml = `
            <div class="modal-overlay" id="paymentHistoryOverlay" onclick="factoryManage.closePaymentHistory()">
                <div class="modal-container" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 80vh;">
                    <div class="modal-content" style="height: 100%;">
                        <div class="modal-header">
                            <div class="modal-title">📋 ${this.escapeHtml(factoryName)} - 付款历史</div>
                            <button class="modal-close" onclick="factoryManage.closePaymentHistory()">×</button>
                        </div>
                        <div class="modal-body" style="flex: 1; overflow-y: auto;">
                            <div class="payment-history-loading" id="historyLoading" style="display: none;">
                                <div class="loading-spinner"></div>
                                <div class="loading-text">加载中...</div>
                            </div>
                            
                            <div class="payment-history-list" id="paymentHistoryList">
                                <!-- 付款历史记录将动态生成 -->
                            </div>
                            
                            <div class="payment-history-empty" id="historyEmpty" style="display: none;">
                                <div class="empty-icon">💰</div>
                                <div class="empty-text">暂无付款记录</div>
                            </div>
                            
                            <div class="load-more-history" id="loadMoreHistory" style="display: none;">
                                <button class="load-more-btn apple-btn" onclick="factoryManage.loadMorePaymentHistory()">
                                    加载更多
                                </button>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-secondary apple-btn" onclick="factoryManage.exportPaymentHistory()">
                                📤 导出历史
                            </button>
                            <button class="btn-primary apple-btn" onclick="factoryManage.closePaymentHistory()">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';
    }
    
    // 🛡️ 加载付款历史
    async loadPaymentHistory(loadMore = false, forceRefresh = false) {
        if (this.isLoadingHistory && !forceRefresh) return;
        
        try {
            this.isLoadingHistory = true;
            
            if (!loadMore) {
                this.showHistoryLoading(true);
            }
            
            const params = {
                page: loadMore ? this.currentHistoryPage : 1,
                pageSize: this.historyPageSize
            };
            
            // 🛡️ 使用组织隔离的API获取付款历史
            const response = await API.get(`/factories/${this.currentFactoryId}/payment-history`, { params });
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                const newRecords = response.data.records || [];
                
                if (loadMore) {
                    this.paymentHistoryRecords = [...this.paymentHistoryRecords, ...newRecords];
                    this.currentHistoryPage++;
                } else {
                    this.paymentHistoryRecords = newRecords;
                    this.currentHistoryPage = 2;
                }
                
                this.hasMoreHistory = newRecords.length === this.historyPageSize;
                
                this.renderPaymentHistory();
                this.updateHistoryLoadMore();
                
            } else {
                throw new Error(response.message || '加载付款历史失败');
            }
            
        } catch (error) {
            console.error('加载付款历史失败:', error);
            Utils.toast.error('加载付款历史失败: ' + error.message);
            this.showHistoryEmpty();
        } finally {
            this.isLoadingHistory = false;
            this.showHistoryLoading(false);
        }
    }
    
    // 🎯 渲染付款历史
    renderPaymentHistory() {
        const historyList = document.getElementById('paymentHistoryList');
        const historyEmpty = document.getElementById('historyEmpty');
        
        if (!historyList) return;
        
        if (this.paymentHistoryRecords.length === 0) {
            historyList.style.display = 'none';
            if (historyEmpty) historyEmpty.style.display = 'block';
            return;
        }
        
        if (historyEmpty) historyEmpty.style.display = 'none';
        historyList.style.display = 'block';
        
        historyList.innerHTML = this.paymentHistoryRecords.map(record => this.renderPaymentHistoryRecord(record)).join('');
    }
    
    // 🎯 渲染单个付款历史记录
    renderPaymentHistoryRecord(record) {
        const amount = parseFloat(record.amount || 0);
        const date = record.createTime ? new Date(record.createTime).toLocaleDateString('zh-CN') : '';
        const time = record.createTime ? new Date(record.createTime).toLocaleTimeString('zh-CN') : '';
        const methodText = this.getPaymentMethodText(record.paymentMethod);
        
        return `
            <div class="payment-history-item">
                <div class="history-header">
                    <div class="history-amount">¥${amount.toFixed(2)}</div>
                    <div class="history-date">${date}</div>
                </div>
                <div class="history-details">
                    <div class="history-method">
                        <span class="method-icon">${this.getPaymentMethodIcon(record.paymentMethod)}</span>
                        <span class="method-text">${methodText}</span>
                    </div>
                    <div class="history-time">${time}</div>
                </div>
                ${record.remark ? `<div class="history-remark">${this.escapeHtml(record.remark)}</div>` : ''}
                ${record.imageUrls && record.imageUrls.length > 0 ? `
                    <div class="history-images">
                        ${record.imageUrls.slice(0, 3).map(url => 
                            `<img src="${this.escapeHtml(url)}" class="history-image" onclick="factoryManage.previewPaymentImages('${record._id || record.id}')" />`
                        ).join('')}
                        ${record.imageUrls.length > 3 ? `<div class="more-images">+${record.imageUrls.length - 3}</div>` : ''}
                    </div>
                ` : ''}
                <div class="history-actions">
                    <button class="action-btn apple-btn" onclick="factoryManage.voidPaymentRecord('${record._id || record.id}')">
                        ❌ 作废
                    </button>
                </div>
            </div>
        `;
    }
    
    // 🎯 获取付款方式文本
    getPaymentMethodText(method) {
        const methods = {
            'cash': '现金',
            'bank': '银行转账',
            'wechat': '微信',
            'alipay': '支付宝'
        };
        return methods[method] || '其他';
    }
    
    // 🎯 关闭付款历史
    closePaymentHistory() {
        const overlay = document.getElementById('paymentHistoryOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
        
        this.showPaymentHistoryModal = false;
        this.paymentHistoryRecords = [];
        this.currentHistoryPage = 1;
        this.hasMoreHistory = true;
    }
    
    // 🎯 批量操作功能
    
    // 批量启用工厂
    async batchEnableFactories() {
        const selectedFactories = this.getSelectedFactories();
        if (selectedFactories.length === 0) {
            Utils.toast.error('请选择要启用的工厂');
            return;
        }
        
        const confirmed = await Utils.modal.confirm(
            '批量启用',
            `确定要启用所选的 ${selectedFactories.length} 家工厂吗？`
        );
        
        if (!confirmed) return;
        
        try {
            Utils.loading.show('批量启用中...');
            
            // 🛡️ 批量启用API
            const response = await API.put('/factories/batch-enable', {
                factoryIds: selectedFactories.map(f => f._id || f.id)
            });
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                Utils.toast.success(`成功启用 ${selectedFactories.length} 家工厂`);
                
                // 刷新数据
                await this.loadFactories(true);
                this.clearFactorySelection();
                
            } else {
                throw new Error(response.message || '批量启用失败');
            }
            
        } catch (error) {
            console.error('批量启用失败:', error);
            Utils.toast.error('批量启用失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 批量停用工厂
    async batchDisableFactories() {
        const selectedFactories = this.getSelectedFactories();
        if (selectedFactories.length === 0) {
            Utils.toast.error('请选择要停用的工厂');
            return;
        }
        
        const confirmed = await Utils.modal.confirm(
            '批量停用',
            `确定要停用所选的 ${selectedFactories.length} 家工厂吗？\n注意：停用后这些工厂将无法接收新订单。`
        );
        
        if (!confirmed) return;
        
        try {
            Utils.loading.show('批量停用中...');
            
            // 🛡️ 批量停用API
            const response = await API.put('/factories/batch-disable', {
                factoryIds: selectedFactories.map(f => f._id || f.id)
            });
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                Utils.toast.success(`成功停用 ${selectedFactories.length} 家工厂`);
                
                // 刷新数据
                await this.loadFactories(true);
                this.clearFactorySelection();
                
            } else {
                throw new Error(response.message || '批量停用失败');
            }
            
        } catch (error) {
            console.error('批量停用失败:', error);
            Utils.toast.error('批量停用失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 批量导出工厂数据
    async batchExportFactories() {
        const selectedFactories = this.getSelectedFactories();
        let exportData = [];
        
        if (selectedFactories.length > 0) {
            exportData = selectedFactories;
        } else {
            // 如果没有选择，导出所有数据
            exportData = this.allFactories;
        }
        
        if (exportData.length === 0) {
            Utils.toast.error('没有可导出的数据');
            return;
        }
        
        try {
            Utils.loading.show('准备导出数据...');
            
            // 🛡️ 导出API
            const response = await API.post('/factories/export', {
                factoryIds: exportData.map(f => f._id || f.id)
            });
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                // 下载文件
                const downloadUrl = response.data.downloadUrl;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `工厂数据_${new Date().toLocaleDateString('zh-CN')}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Utils.toast.success(`成功导出 ${exportData.length} 家工厂的数据`);
                
            } else {
                throw new Error(response.message || '导出失败');
            }
            
        } catch (error) {
            console.error('批量导出失败:', error);
            Utils.toast.error('导出失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 获取选中的工厂
    getSelectedFactories() {
        return this.selectedItems || [];
    }
    
    // 清除工厂选择
    clearFactorySelection() {
        this.selectedItems = [];
        // 更新UI选择状态
        document.querySelectorAll('.factory-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        // 隐藏批量操作栏
        this.updateBatchActionBar();
    }
    
    // 更新批量操作栏
    updateBatchActionBar() {
        let batchActionBar = document.getElementById('batchActionBar');
        
        if (this.selectedItems.length > 0) {
            if (!batchActionBar) {
                // 创建批量操作栏
                const batchHtml = `
                    <div class="batch-action-bar" id="batchActionBar">
                        <div class="batch-info">
                            已选择 <span id="selectedCount">${this.selectedItems.length}</span> 家工厂
                        </div>
                        <div class="batch-actions">
                            <button class="batch-btn apple-btn" onclick="factoryManage.batchEnableFactories()">
                                ✅ 批量启用
                            </button>
                            <button class="batch-btn apple-btn" onclick="factoryManage.batchDisableFactories()">
                                ❌ 批量停用
                            </button>
                            <button class="batch-btn apple-btn" onclick="factoryManage.batchExportFactories()">
                                📤 批量导出
                            </button>
                            <button class="batch-btn apple-btn" onclick="factoryManage.clearFactorySelection()">
                                🧹 取消选择
                            </button>
                        </div>
                    </div>
                `;
                
                const container = document.querySelector('.factory-manage-container');
                if (container) {
                    container.insertAdjacentHTML('afterbegin', batchHtml);
                }
            } else {
                // 更新选择数量
                const selectedCount = document.getElementById('selectedCount');
                if (selectedCount) {
                    selectedCount.textContent = this.selectedItems.length;
                }
            }
        } else {
            if (batchActionBar) {
                batchActionBar.remove();
            }
        }
    }
    
    // 辅助方法
    showHistoryLoading(isLoading) {
        const loading = document.getElementById('historyLoading');
        if (loading) {
            loading.style.display = isLoading ? 'block' : 'none';
        }
    }
    
    showHistoryEmpty() {
        const historyList = document.getElementById('paymentHistoryList');
        const historyEmpty = document.getElementById('historyEmpty');
        
        if (historyList) historyList.style.display = 'none';
        if (historyEmpty) historyEmpty.style.display = 'block';
    }
    
    updateHistoryLoadMore() {
        const loadMoreBtn = document.getElementById('loadMoreHistory');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.hasMoreHistory ? 'block' : 'none';
        }
    }
    
    loadMorePaymentHistory() {
        if (!this.isLoadingHistory && this.hasMoreHistory) {
            this.loadPaymentHistory(true);
        }
    }
    
    // 🎯 预览付款凭证图片
    previewPaymentImages(recordId) {
        const record = this.paymentHistoryRecords.find(r => r._id === recordId || r.id === recordId);
        if (!record || !record.imageUrls || record.imageUrls.length === 0) {
            Utils.toast.error('无图片可预览');
            return;
        }
        
        this.showImagePreview(record.imageUrls, 0);
    }
    
    // 🎯 预览记录图片
    previewRecordImages(recordId) {
        const record = this.accountRecords.find(r => r._id === recordId || r.id === recordId);
        if (!record || !record.imageUrls || record.imageUrls.length === 0) {
            Utils.toast.error('无图片可预览');
            return;
        }
        
        this.showImagePreview(record.imageUrls, 0);
    }
    
    // 🎯 预览付款图片
    previewPaymentImage(index) {
        if (!this.remarkImages || this.remarkImages.length === 0) {
            Utils.toast.error('无图片可预览');
            return;
        }
        
        this.showImagePreview(this.remarkImages, index);
    }
    
    // 🎯 通用图片预览功能
    showImagePreview(imageUrls, startIndex = 0) {
        this.previewImageUrls = imageUrls;
        this.currentImageIndex = startIndex;
        this.showImagePreviewModal = true;
        
        const modalHtml = `
            <div class="modal-overlay" id="imagePreviewOverlay" onclick="factoryManage.closeImagePreview()">
                <div class="image-preview-container" onclick="event.stopPropagation()">
                    <div class="image-preview-header">
                        <div class="image-counter">
                            <span id="currentImageIndex">${startIndex + 1}</span> / ${imageUrls.length}
                        </div>
                        <button class="preview-close-btn" onclick="factoryManage.closeImagePreview()">×</button>
                    </div>
                    
                    <div class="image-preview-content">
                        ${imageUrls.length > 1 ? `
                            <button class="nav-btn prev-btn" onclick="factoryManage.previousImage()">‹</button>
                        ` : ''}
                        
                        <div class="preview-image-wrapper">
                            <img id="previewImage" 
                                 src="${this.escapeHtml(imageUrls[startIndex])}" 
                                 alt="预览图片"
                                 class="preview-image">
                        </div>
                        
                        ${imageUrls.length > 1 ? `
                            <button class="nav-btn next-btn" onclick="factoryManage.nextImage()">›</button>
                        ` : ''}
                    </div>
                    
                    ${imageUrls.length > 1 ? `
                        <div class="image-thumbnails">
                            ${imageUrls.map((url, index) => `
                                <img src="${this.escapeHtml(url)}" 
                                     class="thumbnail ${index === startIndex ? 'active' : ''}" 
                                     onclick="factoryManage.switchToImage(${index})">
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.body.style.overflow = 'hidden';
    }
    
    // 🎯 关闭图片预览
    closeImagePreview() {
        const overlay = document.getElementById('imagePreviewOverlay');
        if (overlay) {
            overlay.remove();
            document.body.style.overflow = '';
        }
        
        this.showImagePreviewModal = false;
        this.previewImageUrls = [];
        this.currentImageIndex = 0;
    }
    
    // 🎯 切换到指定图片
    switchToImage(index) {
        if (index < 0 || index >= this.previewImageUrls.length) return;
        
        this.currentImageIndex = index;
        this.updatePreviewImage();
    }
    
    // 🎯 上一张图片
    previousImage() {
        const newIndex = this.currentImageIndex - 1;
        if (newIndex < 0) {
            this.currentImageIndex = this.previewImageUrls.length - 1;
        } else {
            this.currentImageIndex = newIndex;
        }
        this.updatePreviewImage();
    }
    
    // 🎯 下一张图片
    nextImage() {
        const newIndex = this.currentImageIndex + 1;
        if (newIndex >= this.previewImageUrls.length) {
            this.currentImageIndex = 0;
        } else {
            this.currentImageIndex = newIndex;
        }
        this.updatePreviewImage();
    }
    
    // 🎯 更新预览图片
    updatePreviewImage() {
        const previewImage = document.getElementById('previewImage');
        const currentIndexSpan = document.getElementById('currentImageIndex');
        
        if (previewImage) {
            previewImage.src = this.previewImageUrls[this.currentImageIndex];
        }
        
        if (currentIndexSpan) {
            currentIndexSpan.textContent = this.currentImageIndex + 1;
        }
        
        // 更新缩略图选中状态
        document.querySelectorAll('.thumbnail').forEach((thumb, index) => {
            if (index === this.currentImageIndex) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
    }
    
    // 🎯 作废付款记录
    async voidPaymentRecord(recordId) {
        if (!recordId) {
            Utils.toast.error('记录ID不能为空');
            return;
        }
        
        const confirmed = await Utils.modal.confirm(
            '作废付款记录',
            '确定要作废这条付款记录吗？此操作不可撤销。'
        );
        
        if (!confirmed) return;
        
        try {
            Utils.loading.show('正在作废记录...');
            
            // 🛡️ 作废付款记录API
            const response = await API.delete(`/factories/payment-records/${recordId}`);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                Utils.toast.success('付款记录已作废');
                
                // 刷新付款历史
                if (this.showPaymentHistoryModal) {
                    await this.loadPaymentHistory();
                }
                
                // 刷新账户详情
                if (this.showAccountDetail) {
                    await this.refreshAccountRecords();
                }
                
                // 刷新工厂列表
                await this.loadFactories(true);
                
            } else {
                throw new Error(response.message || '作废失败');
            }
            
        } catch (error) {
            console.error('作废付款记录失败:', error);
            Utils.toast.error('作废失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 🎯 导出付款历史
    async exportPaymentHistory() {
        if (!this.currentFactoryId) {
            Utils.toast.error('工厂ID不能为空');
            return;
        }
        
        try {
            Utils.loading.show('正在导出付款历史...');
            
            // 🛡️ 导出付款历史API
            const response = await API.post(`/factories/${this.currentFactoryId}/export-payment-history`);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                // 下载文件
                const downloadUrl = response.data.downloadUrl;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `${this.currentFactoryName}_付款历史_${new Date().toLocaleDateString('zh-CN')}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Utils.toast.success('付款历史导出成功');
                
            } else {
                throw new Error(response.message || '导出失败');
            }
            
        } catch (error) {
            console.error('导出付款历史失败:', error);
            Utils.toast.error('导出失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 🎯 导出账户详情
    async exportAccountDetail(factoryId) {
        if (!factoryId) {
            Utils.toast.error('工厂ID不能为空');
            return;
        }
        
        try {
            Utils.loading.show('正在导出账户详情...');
            
            // 🛡️ 导出账户详情API
            const response = await API.post(`/factories/${factoryId}/export-account-detail`);
            
            if (response.success) {
                Utils.orgSecurity.validateDataOwnership(response.data);
                
                // 下载文件
                const downloadUrl = response.data.downloadUrl;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `${this.currentFactoryName}_账户详情_${new Date().toLocaleDateString('zh-CN')}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                Utils.toast.success('账户详情导出成功');
                
            } else {
                throw new Error(response.message || '导出失败');
            }
            
        } catch (error) {
            console.error('导出账户详情失败:', error);
            Utils.toast.error('导出失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    // 🎯 切换工厂卡片选择状态
    toggleFactorySelection(factoryId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        const factory = this.allFactories.find(f => f._id === factoryId || f.id === factoryId);
        if (!factory) return;
        
        const index = this.selectedItems.findIndex(item => 
            (item._id || item.id) === factoryId
        );
        
        if (index > -1) {
            // 取消选择
            this.selectedItems.splice(index, 1);
        } else {
            // 添加选择
            this.selectedItems.push(factory);
        }
        
        // 更新UI状态
        this.updateFactoryCardSelection(factoryId);
        this.updateBatchActionBar();
    }
    
    // 🎯 更新工厂卡片选择状态
    updateFactoryCardSelection(factoryId) {
        const card = document.querySelector(`[data-factory-id="${factoryId}"]`);
        if (!card) return;
        
        const isSelected = this.selectedItems.some(item => 
            (item._id || item.id) === factoryId
        );
        
        if (isSelected) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }
    
    // 🎯 获取工厂余额颜色类
    getBalanceColorClass(balance, debt) {
        const netBalance = parseFloat(balance || 0) - parseFloat(debt || 0);
        if (netBalance > 0) return 'positive';
        if (netBalance < 0) return 'negative';
        return 'zero';
    }
    
    // 🛡️ 数据安全验证辅助方法
    validateFactoryData(factory) {
        if (!factory) return false;
        
        try {
            Utils.orgSecurity.validateDataOwnership(factory);
            return true;
        } catch (error) {
            console.error('工厂数据验证失败:', error);
            return false;
        }
    }
}

// 全局工厂管理实例
let factoryManage = null;

// 初始化工厂管理页面
function initFactoryManagePage() {
    if (!factoryManage) {
        factoryManage = new FactoryManage();
    }
    return factoryManage;
} 