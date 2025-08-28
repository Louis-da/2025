// 发出单表单页面功能类 - 组织数据隔离版
class SendOrderForm {
    constructor(mode = 'create', orderId = null) {
        this.mode = mode; // 'create', 'edit', 'view'
        this.orderId = orderId;
        this.isLoading = false;
        this.isSaving = false;
        
        // 表单数据
        this.formData = {
            orderNo: '',
            factoryId: '',
            factoryName: '',
            processId: '',
            processName: '',
            staff: '',
            date: '',
            remark: '',
            remarkPhotos: [], // 备注图片数组
            totalQuantity: 0,
            totalWeight: 0,
            products: []
        };
        
        // 基础数据
        this.factories = [];
        this.processes = [];
        this.products = [];
        this.colors = [];
        this.sizes = [];
        // 🎯 新增：所有可用的颜色和尺码数据（对应小程序的allAvailableColors和allAvailableSizes）
        this.allAvailableColors = [];
        this.allAvailableSizes = [];
        
        // 模态框状态
        this.selectedProduct = null;
        this.tempProductConfig = {
            color: '',
            size: '',
            quantity: '',
            weight: ''
        };
        
        // 搜索状态
        this.productSearchKeyword = '';
        this.filteredProducts = [];
        this.factorySearchKeyword = '';
        this.filteredFactories = [];
        this.hideDropdownTimer = null;
        
        this.init();
    }
    
    init() {
        this.renderPage();
        this.bindEvents();
        this.loadBasicData();
        
        if (this.mode === 'edit' && this.orderId) {
            this.loadOrderData();
        } else {
            this.initNewOrder();
        }
        
        // 🔧 保险机制：页面完全加载后再次确保工厂下拉列表正确显示
        setTimeout(() => {
            if (this.factories && this.factories.length > 0) {
                console.log('[SendOrderForm] 保险机制：重新渲染工厂下拉列表');
                this.updateFactoryOptions();
            }
        }, 500);
    }
    
    renderPage() {
        const container = document.getElementById('send-order-formPageContent');
        if (!container) return;
        
        const title = this.mode === 'create' ? '新增发出单' : 
                     this.mode === 'edit' ? '编辑发出单' : '查看发出单';
        const icon = '📤';
        
        container.innerHTML = `
            <div class="send-order-form-container">
                <!-- 页面头部 -->
                <div class="send-order-form-header">
                    <div class="send-order-form-title">
                        <span class="send-order-form-icon">${icon}</span>
                        <div>
                            <h2>${title}</h2>
                            <div class="send-order-form-subtitle">
                                ${this.mode === 'create' ? '创建新的发出单记录' : 
                                  this.mode === 'edit' ? '修改发出单信息' : '查看发出单详情'}
                            </div>
                        </div>
                    </div>
                    <div class="base-detail-actions">
                        <button class="action-btn secondary" onclick="sendOrderForm.goBack()">
                            <span>←</span>
                            返回
                        </button>
                    </div>
                </div>
                
                <!-- 基础信息卡片 -->
                <div class="form-card">
                    <div class="form-card-title">
                        <span class="form-card-icon">ℹ️</span>
                        基础信息
                    </div>
                    
                    <div class="form-row">
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label">订单号</label>
                                <input type="text" id="orderNo" class="form-input" placeholder="系统自动生成" readonly>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label required">制单日期</label>
                                <input type="date" id="orderDate" class="form-input" ${this.mode === 'view' ? 'readonly' : ''}>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label required">工厂</label>
                                <div class="factory-search-container">
                                    <input type="text" id="factorySearch" class="form-input factory-search-input" 
                                           placeholder="输入工厂名称或首字母" autocomplete="off"
                                           ${this.mode === 'view' ? 'readonly' : ''}
                                           onfocus="sendOrderForm.showFactoryDropdown()"
                                           oninput="sendOrderForm.onFactorySearch(event)"
                                           onblur="sendOrderForm.hideFactoryDropdownWithDelay()">
                                    <div class="factory-search-dropdown" id="factoryDropdown" style="display: none;">
                                        <div class="factory-dropdown-scroll">
                                            <div class="factory-dropdown-empty" id="factoryDropdownEmpty" style="display: none;">
                                                <div class="empty-icon">🏭</div>
                                                <div class="empty-text">未找到相关工厂</div>
                                            </div>
                                            <div class="factory-dropdown-list" id="factoryDropdownList">
                                                <!-- 工厂列表将动态生成 -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <input type="hidden" id="factoryId" value="">
                                <div class="selected-factory-display" id="selectedFactoryDisplay" style="display: none;">
                                    已选择：<span id="selectedFactoryName"></span>
                                </div>
                                <div class="factory-info" id="factoryInfo" style="display: none;">
                                    <div class="factory-info-row">
                                        <span class="factory-info-label">联系人:</span>
                                        <span class="factory-info-value" id="factoryContact">-</span>
                                    </div>
                                    <div class="factory-info-row">
                                        <span class="factory-info-label">电话:</span>
                                        <span class="factory-info-value" id="factoryPhone">-</span>
                                    </div>
                                    <div class="factory-info-row" id="factoryAddressRow" style="display: none;">
                                        <span class="factory-info-label">地址:</span>
                                        <span class="factory-info-value" id="factoryAddress">-</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label required">工序</label>
                                <select id="processSelect" class="form-select" ${this.mode === 'view' ? 'disabled' : ''} onchange="sendOrderForm.onProcessChange(this.value)">
                                    <option value="">请先选择工厂</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label">制单人</label>
                                <div class="creator-info">
                                    <span class="creator-info-text" id="staffDisplay">制单人：-</span>
                                    <span class="creator-info-text" id="dateTimeDisplay" style="margin-left: auto;">制单时间：-</span>
                                </div>
                                <input type="hidden" id="staff">
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 备注及图片卡片 -->
                <div class="form-card">
                    <div class="form-card-title">
                        <span class="form-card-icon">💬</span>
                        备注及图片
                    </div>
                    
                    <div class="form-row">
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label">备注</label>
                                <textarea id="remarkInput" class="form-textarea" placeholder="请输入备注信息" 
                                          ${this.mode === 'view' ? 'readonly' : ''}></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label">备注图片</label>
                                <div class="remark-photos-container">
                                    <div class="remark-photos-grid" id="photoGrid">
                                        <!-- 图片将通过JavaScript动态生成 -->
                                    </div>
                                    <div class="photo-limit-text">最多上传3张图片</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 货品信息卡片 -->
                <div class="form-card">
                    <div class="form-card-title">
                        <span class="form-card-icon">📦</span>
                        货品信息
                    </div>
                    
                    <div class="products-section">
                        ${this.mode !== 'view' ? `
                            <div class="product-action-bar product-action-bar-centered">
                                <button class="add-product-btn apple-btn" onclick="sendOrderForm.showProductModal()">
                                    添加货品
                                </button>
                            </div>
                        ` : ''}
                        
                        <div class="product-list" id="productList">
                            <div class="no-products" id="noProductsMessage" style="display: none;">
                                <span>暂无货品，请添加</span>
                            </div>
                            <div class="product-items-container" id="productItemsContainer">
                                <!-- 货品列表将通过JavaScript动态生成 -->
                            </div>
                        </div>
                        
                        <!-- 统计信息 -->
                        <div class="product-summary">
                            <div class="summary-item">
                                <span class="summary-label">总数量:</span>
                                <span class="summary-value" id="totalQuantity">0</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">总重量:</span>
                                <span class="summary-value" id="totalWeight">0.00 kg</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 备注信息卡片 -->
                <div class="form-card">
                    <div class="form-card-title">
                        <span class="form-card-icon">📝</span>
                        备注信息
                    </div>
                    <div class="form-row">
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label">备注说明</label>
                                <textarea id="remark" class="form-textarea" placeholder="请输入备注信息（可选）" 
                                         ${this.mode === 'view' ? 'readonly' : ''}></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 备注图片 -->
                    ${this.mode !== 'view' ? `
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">备注图片</label>
                                    <div class="photo-upload-section">
                                        <div class="photo-grid" id="photoGrid">
                                            <!-- 图片将动态生成 -->
                                        </div>
                                        <button type="button" class="photo-upload-btn" onclick="sendOrderForm.chooseRemarkPhoto()">
                                            <span class="photo-upload-icon">📷</span>
                                            <span>添加图片</span>
                                        </button>
                                        <div class="photo-upload-hint">最多可上传3张图片</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : `
                        <div class="form-row" id="remarkPhotosDisplay" style="display: none;">
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">备注图片</label>
                                    <div class="photo-display-section">
                                        <div class="photo-grid" id="photoGrid">
                                            <!-- 图片将动态生成 -->
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `}
                </div>
                
                <!-- 操作按钮 -->
                ${this.mode !== 'view' ? `
                    <div class="form-actions">
                        <button type="button" class="action-btn secondary" onclick="sendOrderForm.goBack()">
                            取消
                        </button>
                        <button type="button" class="action-btn primary" id="saveBtn" onclick="sendOrderForm.saveOrder()">
                            <span id="saveBtnSpinner" class="btn-spinner" style="display: none;"></span>
                            <span id="saveBtnText">${this.mode === 'create' ? '保存发出单' : '更新发出单'}</span>
                        </button>
                    </div>
                ` : `
                    <div class="form-actions">
                        <button type="button" class="action-btn secondary" onclick="sendOrderForm.goBack()">
                            返回
                        </button>
                        <button type="button" class="action-btn danger" onclick="sendOrderForm.cancelOrder()">
                            作废订单
                        </button>
                    </div>
                `}
            </div>
            
            <!-- 货品选择弹窗 -->
            <div class="product-modal" id="productModal" style="display: none;">
                <div class="modal-mask"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>选择货品</h3>
                        <button class="modal-close" onclick="sendOrderForm.hideProductModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="product-search-section">
                            <input type="text" id="productSearchInput" class="form-input" 
                                   placeholder="搜索货品名称或货号..." 
                                   oninput="sendOrderForm.searchProducts(this.value)">
                        </div>
                        <div class="product-select-list" id="productSelectList">
                            <!-- 货品列表将动态生成 -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 🎯 货品配置弹窗 - 对应小程序的货品确认弹窗 -->
            <div class="product-config-modal" id="productConfirmModal" style="display: none;">
                <div class="product-config-content">
                    <div class="modal-header">
                        <h3>配置货品信息</h3>
                        <button class="modal-close" onclick="sendOrderForm.hideProductConfigModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- 选中货品显示 -->
                        <div class="selected-product-display" id="selectedProductDisplay">
                            <!-- 动态生成 -->
                        </div>
                        
                        <!-- 配置选项 -->
                        <div class="config-section">
                            <div class="form-row">
                                <div class="form-col">
                                    <div class="form-item">
                                        <label class="form-label">颜色</label>
                                        <div class="picker-wrapper">
                                            <select id="tempColorSelect" class="form-select edit-form-value">
                                                <option value="">请选择颜色</option>
                                            </select>
                                            <div class="picker-arrow"></div>
                                        </div>
                                    </div>
                                </div>
                                <div class="form-col">
                                    <div class="form-item">
                                        <label class="form-label">尺码</label>
                                        <div class="picker-wrapper">
                                            <select id="tempSizeSelect" class="form-select edit-form-value">
                                                <option value="">请选择尺码</option>
                                            </select>
                                            <div class="picker-arrow"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-row">
                                <div class="form-col">
                                    <div class="form-item">
                                        <label class="form-label required" id="quantityLabel">数量</label>
                                        <input type="number" id="tempQuantityInput" class="form-input" 
                                               placeholder="请输入数量" min="0" step="1"
                                               oninput="sendOrderForm.onTempQuantityInput(this)">
                                    </div>
                                </div>
                                <div class="form-col">
                                    <div class="form-item">
                                        <label class="form-label required">重量 (kg)</label>
                                        <input type="number" id="tempWeightInput" class="form-input" 
                                               placeholder="请输入重量" min="0" step="0.01"
                                               oninput="sendOrderForm.onTempWeightInput(this)">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="product-config-footer">
                        <button type="button" class="config-btn cancel" onclick="sendOrderForm.hideProductConfigModal()">
                            取消
                        </button>
                        <button type="button" class="config-btn continue" onclick="sendOrderForm.addProductAndContinue()">
                            添加并继续
                        </button>
                        <button type="button" class="config-btn add" onclick="sendOrderForm.addProduct()">
                            确认添加
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 图片预览弹窗 -->
            <div class="modal" id="photoPreviewModal" style="display: none;">
                <div class="modal-content modal-image">
                    <div class="modal-header">
                        <button class="modal-close" onclick="sendOrderForm.hidePhotoPreview()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <img id="previewImage" src="" alt="图片预览" style="max-width: 100%; max-height: 80vh;">
                    </div>
                </div>
            </div>
        `;
        
        this.renderRemarkPhotos();
    }
    
    bindEvents() {
        this.bindPageEvents();
        this.renderRemarkPhotos();
    }
    
    bindPageEvents() {
        // 工厂搜索和选择事件（现在通过HTML内联绑定）
        
        // 工序选择事件
        const processSelect = document.getElementById('processSelect');
        if (processSelect) {
            processSelect.addEventListener('change', (e) => {
                this.onProcessChange(e.target.value);
            });
        }
        
        // 制单日期变化事件
        const orderDate = document.getElementById('orderDate');
        if (orderDate) {
            orderDate.addEventListener('change', (e) => {
                this.formData.date = e.target.value;
            });
        }
        
        // 备注输入事件
        const remarkInput = document.getElementById('remarkInput');
        if (remarkInput) {
            remarkInput.addEventListener('input', (e) => {
                this.formData.remark = e.target.value;
            });
        }
        
        // 保存按钮事件
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveOrder();
            });
        }
        
        // 阻止表单默认提交
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveOrder();
            });
        });
        
        // 处理模态框背景点击关闭
        const productModal = document.getElementById('productModal');
        if (productModal) {
            productModal.addEventListener('click', (e) => {
                if (e.target === productModal) {
                    this.hideProductModal();
                }
            });
        }
        
        const productConfirmModal = document.getElementById('productConfirmModal');
        if (productConfirmModal) {
            productConfirmModal.addEventListener('click', (e) => {
                if (e.target === productConfirmModal) {
                    this.hideProductConfigModal();
                }
            });
        }
        
        const photoPreviewModal = document.getElementById('photoPreviewModal');
        if (photoPreviewModal) {
            photoPreviewModal.addEventListener('click', (e) => {
                if (e.target === photoPreviewModal) {
                    this.hidePhotoPreview();
                }
            });
        }
    }
    
    async loadBasicData() {
        this.isLoading = true;
        this.showSaveLoading();
        
        try {
            // 并行加载基础数据，确保组织隔离
            const [factoriesRes, processesRes, productsRes, colorsRes, sizesRes] = await Promise.all([
                API.get('/factories').catch(() => ({ success: false, data: [] })),
                API.get('/processes').catch(() => ({ success: false, data: [] })),
                API.get('/products').catch(() => ({ success: false, data: [] })),
                API.get('/colors').catch(() => ({ success: false, data: [] })),
                API.get('/sizes').catch(() => ({ success: false, data: [] }))
            ]);
            
            // 工厂数据（自动组织隔离）
            if (factoriesRes.success) {
                this.factories = factoriesRes.data || [];
                console.log('[SendOrderForm] 已加载工厂数据:', this.factories.length);
            }
            
            // 工序数据（自动组织隔离）
            if (processesRes.success) {
                this.processes = processesRes.data || [];
                console.log('[SendOrderForm] 已加载工序数据:', this.processes.length);
            }
            
            // 货品数据（自动组织隔离）
            if (productsRes.success) {
                // 只显示启用的货品
                this.products = (productsRes.data || []).filter(p => p.status === 1);
                this.filteredProducts = [...this.products];
                console.log('[SendOrderForm] 已加载货品数据:', this.products.length);
            }
            
            // 🎯 颜色数据（对应小程序的allAvailableColors）
            if (colorsRes.success) {
                this.colors = colorsRes.data || [];
                this.allAvailableColors = (colorsRes.data || []).filter(c => c.status === 1); // 只显示启用的颜色
                console.log('[SendOrderForm] 已加载颜色数据:', this.allAvailableColors.length);
            }
            
            // 🎯 尺码数据（对应小程序的allAvailableSizes）
            if (sizesRes.success) {
                this.sizes = sizesRes.data || [];
                this.allAvailableSizes = (sizesRes.data || []).filter(s => s.status === 1); // 只显示启用的尺码
                console.log('[SendOrderForm] 已加载尺码数据:', this.allAvailableSizes.length);
            }
            
            // 更新表单选项
            this.updateFactoryOptions();
            this.updateProcessOptions();
            
        } catch (error) {
            console.error('[SendOrderForm] 加载基础数据失败:', error);
            Utils.toast.error('加载基础数据失败，请刷新页面重试');
        } finally {
            this.isLoading = false;
            this.hideSaveLoading();
        }
    }
    
    updateFactoryOptions() {
        // 初始化过滤的工厂列表为所有工厂
        this.filteredFactories = this.factories;
        console.log('[SendOrderForm] 工厂选项已准备，共', this.factories.length, '个工厂');
        
        // 🔧 修复：确保DOM元素准备好后再渲染工厂下拉列表
        setTimeout(() => {
            this.renderFactoryDropdown();
            console.log('[SendOrderForm] 工厂下拉列表渲染完成');
        }, 100);
    }

    // 🔧 HTML转义防止XSS攻击
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 🔧 渲染工厂下拉列表
    renderFactoryDropdown() {
        const dropdownList = document.getElementById('factoryDropdownList');
        const dropdownEmpty = document.getElementById('factoryDropdownEmpty');
        
        // 🚨 增强错误处理：如果DOM元素未找到，等待后重试
        if (!dropdownList || !dropdownEmpty) {
            console.warn('[renderFactoryDropdown] DOM元素未准备好，100ms后重试');
            setTimeout(() => {
                this.renderFactoryDropdown();
            }, 100);
            return;
        }
        
        console.log('[renderFactoryDropdown] 开始渲染工厂列表，工厂数量:', this.filteredFactories.length);
        
        if (this.filteredFactories.length === 0) {
            dropdownList.style.display = 'none';
            dropdownEmpty.style.display = 'block';
            console.log('[renderFactoryDropdown] 显示空状态');
            return;
        }
        
        dropdownEmpty.style.display = 'none';
        dropdownList.style.display = 'block';
        dropdownList.innerHTML = this.filteredFactories.map((factory, index) => `
            <div class="factory-dropdown-item ${this.formData.factoryId === factory.id ? 'selected' : ''}" 
                 data-factory-id="${factory.id}" 
                 onclick="sendOrderForm.selectFactoryFromDropdown('${factory.id}')">
                <div class="factory-info">
                    <div class="factory-name">${this.escapeHtml(factory.name || '')}</div>
                    <div class="factory-details">
                        ${factory.phone ? `<span class="factory-phone">📞 ${this.escapeHtml(factory.phone)}</span>` : ''}
                        ${factory.address ? `<span class="factory-address">📍 ${this.escapeHtml(factory.address)}</span>` : ''}
                    </div>
                </div>
                <div class="check-mark" ${this.formData.factoryId === factory.id ? '' : 'style="display: none;"'}>✓</div>
            </div>
        `).join('');
        
        console.log('[renderFactoryDropdown] 工厂列表渲染完成，已渲染', this.filteredFactories.length, '个工厂');
    }

    // 🔧 显示工厂下拉列表
    showFactoryDropdown() {
        if (this.hideDropdownTimer) {
            clearTimeout(this.hideDropdownTimer);
            this.hideDropdownTimer = null;
        }
        
        // 🔧 确保工厂数据已加载
        if (!this.factories || this.factories.length === 0) {
            console.warn('[showFactoryDropdown] 工厂数据未加载，等待后重试');
            setTimeout(() => {
                this.showFactoryDropdown();
            }, 200);
            return;
        }
        
        // 如果没有搜索关键词，显示所有工厂
        const factorySearch = document.getElementById('factorySearch');
        const keyword = factorySearch ? factorySearch.value.trim() : '';
        
        if (!keyword) {
            this.filteredFactories = this.factories;
        }
        
        console.log('[showFactoryDropdown] 准备显示工厂列表，共', this.filteredFactories.length, '个工厂');
        this.renderFactoryDropdown();
        
        const factoryDropdown = document.getElementById('factoryDropdown');
        if (factoryDropdown) {
            factoryDropdown.style.display = 'block';
            console.log('[showFactoryDropdown] 工厂下拉列表已显示');
        }
    }

    // 🔧 隐藏工厂下拉列表（带延时）
    hideFactoryDropdownWithDelay() {
        this.hideDropdownTimer = setTimeout(() => {
            this.hideFactoryDropdown();
        }, 200);
    }

    // 🔧 立即隐藏工厂下拉列表
    hideFactoryDropdown() {
        if (this.hideDropdownTimer) {
            clearTimeout(this.hideDropdownTimer);
            this.hideDropdownTimer = null;
        }
        
        const factoryDropdown = document.getElementById('factoryDropdown');
        if (factoryDropdown) {
            factoryDropdown.style.display = 'none';
        }
    }

    // 🔧 工厂搜索输入事件
    onFactorySearch(event) {
        const keyword = event.target.value.trim();
        this.filterFactories(keyword);
        this.showFactoryDropdown();
    }

    // 🔧 过滤工厂列表 - 支持拼音搜索
    filterFactories(keyword) {
        if (!keyword) {
            this.filteredFactories = this.factories;
        } else {
            // 🎯 使用拼音搜索工具，对齐微信小程序的搜索体验
            this.filteredFactories = this.factories.filter(factory => {
                // 检查工厂名称
                const nameMatch = window.PinyinUtils && window.PinyinUtils.searchMatch ? 
                    window.PinyinUtils.searchMatch(keyword, factory.name) :
                    factory.name.toLowerCase().includes(keyword.toLowerCase());
                
                // 检查联系人和电话（使用普通搜索）
                const contactMatch = factory.contact && factory.contact.toLowerCase().includes(keyword.toLowerCase());
                const phoneMatch = factory.phone && factory.phone.includes(keyword);
                
                return nameMatch || contactMatch || phoneMatch;
            });
        }
        
        this.renderFactoryDropdown();
        console.log('[filterFactories] 筛选结果:', this.filteredFactories.length, '（使用', window.PinyinUtils ? '拼音搜索' : '普通搜索', '）');
    }

    // 🔧 从下拉列表选择工厂
    selectFactoryFromDropdown(factoryId) {
        console.log('[selectFactoryFromDropdown] 选择工厂, factoryId:', factoryId);
        
        const factory = this.factories.find(f => f.id == factoryId);
        if (!factory) {
            console.error('[selectFactoryFromDropdown] 未找到工厂:', factoryId);
            return;
        }
        
        console.log('[selectFactoryFromDropdown] 找到工厂:', factory);
        
        const factorySearch = document.getElementById('factorySearch');
        const factoryIdInput = document.getElementById('factoryId');
        const selectedFactoryDisplay = document.getElementById('selectedFactoryDisplay');
        const selectedFactoryName = document.getElementById('selectedFactoryName');
        
        if (factorySearch) factorySearch.value = factory.name;
        if (factoryIdInput) factoryIdInput.value = factoryId;
        
        this.formData.factoryId = factoryId;
        this.formData.factoryName = factory.name;
        
        // 显示已选择的工厂
        if (selectedFactoryDisplay && selectedFactoryName) {
            selectedFactoryName.textContent = factory.name;
            selectedFactoryDisplay.style.display = 'block';
        }
        
        // 显示工厂详细信息
        this.showFactoryInfo(factory);
        
        console.log('[selectFactoryFromDropdown] 开始加载工厂工序...');
        
        // 加载工厂的工序并自动选择第一个
        this.loadFactoryProcesses(factoryId);
        
        // 隐藏下拉列表
        this.hideFactoryDropdown();
        
        console.log('[selectFactoryFromDropdown] 工厂选择完成:', factory.name);
    }
    
    
    
    // 🔧 加载工厂的工序列表
    async loadFactoryProcesses(factoryId) {
        const processSelect = document.getElementById('processSelect');
        if (!processSelect) return;
        
        try {
            // 重置工序选择
            processSelect.innerHTML = '<option value="">加载中...</option>';
            
            console.log('[loadFactoryProcesses] 开始加载工厂工序, factoryId:', factoryId);
            
            // 参考微信小程序，同时获取工厂详情和组织工序列表
            const [factoryResponse, processesResponse] = await Promise.all([
                API.get(`/factories/${factoryId}`),
                API.get('/processes')
            ]);
            
            if (factoryResponse.success && factoryResponse.data) {
                const factoryData = factoryResponse.data;
                const allProcesses = processesResponse.data || [];
                
                console.log('获取到的工厂详情:', factoryData);
                console.log('获取到的组织工序:', allProcesses);
                
                // 解析工厂工序名称列表
                let factoryProcessNames = [];
                if (factoryData.processes && Array.isArray(factoryData.processes)) {
                    factoryProcessNames = factoryData.processes;
                } else if (factoryData.processes && typeof factoryData.processes === 'string') {
                    try {
                        const parsed = JSON.parse(factoryData.processes);
                        factoryProcessNames = Array.isArray(parsed) ? parsed : [factoryData.processes];
                    } catch (e) {
                        factoryProcessNames = factoryData.processes.split(',').map(p => p.trim()).filter(p => p);
                    }
                }
                
                // 根据工序名称匹配工序ID，只显示启用的工序
                const processesList = factoryProcessNames
                    .map(processName => {
                        const matchedProcess = allProcesses.find(p => p.name === processName && p.status === 1);
                        return matchedProcess ? { id: matchedProcess.id, name: matchedProcess.name } : { id: 0, name: processName };
                    })
                    .filter(p => p.name && p.name.replace(/[【】\[\]\s]/g, '').length > 0);
                
                console.log('处理后的工序列表:', processesList);
                
                if (processesList.length > 0) {
                    const processOptions = processesList.map(process => 
                        `<option value="${process.id}">${process.name}</option>`
                    ).join('');
                    processSelect.innerHTML = '<option value="">请选择工序</option>' + processOptions;
                    
                    // 🔧 自动选择第一个工序（新增模式或没有预选工序时）
                    if (this.mode === 'create' || !this.formData.processId) {
                        const firstProcess = processesList[0];
                        if (firstProcess && firstProcess.id) {
                            console.log('[loadFactoryProcesses] 自动选择第一个工序:', firstProcess);
                            
                            processSelect.value = firstProcess.id;
                            this.formData.processId = firstProcess.id;
                            this.formData.processName = firstProcess.name;
                            
                            // 触发工序变化事件
                            this.onProcessChange(firstProcess.id);
                            
                            console.log('[loadFactoryProcesses] 已自动选择工序:', firstProcess.name);
                        }
                    }
                } else {
                    processSelect.innerHTML = '<option value="">该工厂暂无可用工序</option>';
                    console.log('[loadFactoryProcesses] 该工厂没有可用工序');
                }
            } else {
                processSelect.innerHTML = '<option value="">加载工序失败</option>';
                console.error('[loadFactoryProcesses] 获取工厂详情失败:', factoryResponse);
            }
        } catch (error) {
            console.error('[loadFactoryProcesses] 加载工厂工序失败:', error);
            processSelect.innerHTML = '<option value="">加载工序失败</option>';
        }
    }
    
    updateProcessOptions() {
        const processSelect = document.getElementById('processSelect');
        if (processSelect && this.processes.length > 0) {
            const options = this.processes.map(process => 
                `<option value="${process.id}">${process.name}</option>`
            ).join('');
            processSelect.innerHTML = '<option value="">请选择工序</option>' + options;
        }
    }
    
    onFactoryChange(factoryId) {
        const factory = this.factories.find(f => f.id == factoryId);
        if (factory) {
            this.formData.factoryId = factoryId;
            this.formData.factoryName = factory.name;
            
            // 显示工厂信息
            this.showFactoryInfo(factory);
            
            // 加载工厂的工序
            this.loadFactoryProcesses(factoryId);
        } else {
            this.formData.factoryId = '';
            this.formData.factoryName = '';
            this.hideFactoryInfo();
            
            // 重置工序选择
            const processSelect = document.getElementById('processSelect');
            if (processSelect) {
                processSelect.innerHTML = '<option value="">请先选择工厂</option>';
            }
        }
    }
    
    showFactoryInfo(factory) {
        const factoryInfo = document.getElementById('factoryInfo');
        const factoryContact = document.getElementById('factoryContact');
        const factoryPhone = document.getElementById('factoryPhone');
        const factoryAddress = document.getElementById('factoryAddress');
        const factoryAddressRow = document.getElementById('factoryAddressRow');
        
        if (factoryInfo) {
            factoryInfo.style.display = 'block';
            
            if (factoryContact) factoryContact.textContent = factory.contact || '-';
            if (factoryPhone) factoryPhone.textContent = factory.phone || '-';
            
            // 显示地址信息（如果有的话）
            if (factoryAddress && factoryAddressRow) {
                if (factory.address) {
                    factoryAddress.textContent = factory.address;
                    factoryAddressRow.style.display = 'block';
                } else {
                    factoryAddressRow.style.display = 'none';
                }
            }
        }
    }
    
    hideFactoryInfo() {
        const factoryInfo = document.getElementById('factoryInfo');
        if (factoryInfo) {
            factoryInfo.style.display = 'none';
        }
    }
    
    onProcessChange(processId) {
        console.log('[onProcessChange] 工序变化, processId:', processId);
        
        if (processId) {
            // 从当前工厂的工序列表中查找
            const processSelect = document.getElementById('processSelect');
            if (processSelect) {
                const selectedOption = processSelect.querySelector(`option[value="${processId}"]`);
                if (selectedOption) {
                    this.formData.processId = processId;
                    this.formData.processName = selectedOption.textContent;
                    console.log('[onProcessChange] 已选择工序:', this.formData.processName, '(ID:', processId, ')');
                } else {
                    console.warn('[onProcessChange] 未找到对应的工序选项:', processId);
                }
            } else {
                console.warn('[onProcessChange] 未找到工序选择框');
            }
        } else {
            this.formData.processId = '';
            this.formData.processName = '';
            console.log('[onProcessChange] 清空工序选择');
        }
    }
    
    initNewOrder() {
        // 🎯 精确复制微信小程序的初始化逻辑
        const now = new Date();
        
        // Set current date for date pickers (YYYY-MM-DD)
        const currentDateForPicker = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        
        // Set creation/order date and time (YYYY-MM-DD HH:mm) for display - 对应小程序的formatDateTimeToMinute
        const currentDateTimeForDisplay = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // 🎯 获取制单人：优先使用个人姓名，如果没有则使用登录工号（与小程序逻辑一致）
        // 🛡️ 使用安全的存储方式获取用户信息
        const realName = Utils.storage.get(CONFIG.STORAGE_KEYS.REAL_NAME) || '';
        const employeeName = Utils.storage.get(CONFIG.STORAGE_KEYS.EMPLOYEE_NAME) || '';
        const username = Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME) || '';
        // 优先级：realName > employeeName > username
        const staffName = realName || employeeName || username || '员工';
        
        // 🎯 生成订单号：对齐小程序的generateGlobalOrderNumber逻辑
        const orderNo = this.generateOrderNumber();
        
        this.formData.orderNo = orderNo;
        this.formData.date = currentDateTimeForDisplay; // For display: YYYY-MM-DD HH:mm
        this.formData.currentDate = currentDateForPicker; // For date picker default: YYYY-MM-DD
        this.formData.staff = staffName;
        
        console.log('[initNewOrder] 新订单初始化完成 - 订单号:', orderNo, '制单人:', staffName, '制单时间:', currentDateTimeForDisplay);
        
        // 更新表单显示
        const staffDisplay = document.getElementById('staffDisplay');
        const dateTimeDisplay = document.getElementById('dateTimeDisplay');
        const staffInput = document.getElementById('staff');
        
        if (staffDisplay) staffDisplay.textContent = `制单人：${staffName}`;
        if (dateTimeDisplay) dateTimeDisplay.textContent = `制单时间：${currentDateTimeForDisplay}`;
        if (staffInput) staffInput.value = staffName;
    }
    
    // 🎯 精确复制微信小程序的订单号生成逻辑
    generateOrderNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().substr(2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        const prefix = 'F'; // F代表发出单
        const datePart = `${year}${month}${day}`;
        
        // 🛡️ 使用组织隔离的存储方式管理订单序号
        const seqKey = `orderSeq_${datePart}_${prefix}`;
        const lastOrderSeq = Utils.storage.getOrgData(seqKey, 0);
        const currentSeq = parseInt(lastOrderSeq) + 1;
        
        // 保存更新后的流水号
        Utils.storage.setOrgData(seqKey, currentSeq);
        
        // 生成完整订单号: F + 年月日 + 3位流水号
        const orderNo = `${prefix}${datePart}${currentSeq.toString().padStart(3, '0')}`;
        console.log('[generateOrderNumber] 生成订单号:', orderNo);
        return orderNo;
    }
    
    async loadOrderData() {
        if (!this.orderId) return;
        
        try {
            Utils.loading.show('加载订单数据...');
            
            const response = await API.sendOrders.detail(this.orderId);
            
            if (response.success) {
                const order = response.data;
                
                // 验证数据归属
                Utils.orgSecurity.validateDataOwnership(order);
                
                this.formData = {
                    orderNo: order.orderNo || '',
                    factoryId: order.factoryId || '',
                    factoryName: order.factoryName || '',
                    processId: order.processId || '',
                    processName: order.processName || order.process || '',
                    staff: order.staff || '',
                    date: order.date ? order.date.split('T')[0] : '',
                    remark: order.remark || '',
                    remarkPhotos: order.remarkPhotos || order.remarkImages || [],
                    totalQuantity: parseFloat(order.totalQuantity || 0),
                    totalWeight: parseFloat(order.totalWeight || 0),
                    products: order.items || order.products || []
                };
                
                this.updateFormDisplay();
                
            } else {
                throw new Error(response.message || '加载订单失败');
            }
        } catch (error) {
            console.error('加载订单数据失败:', error);
            Utils.toast.error('加载订单数据失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    updateFormDisplay() {
        // 更新基础信息
        const orderNo = document.getElementById('orderNo');
        const orderDate = document.getElementById('orderDate');
        const factorySearch = document.getElementById('factorySearch');
        const factoryIdInput = document.getElementById('factoryId');
        const processSelect = document.getElementById('processSelect');
        const staff = document.getElementById('staff');
        const staffDisplay = document.getElementById('staffDisplay');
        const dateTimeDisplay = document.getElementById('dateTimeDisplay');
        const remarkInput = document.getElementById('remarkInput');
        
        if (orderNo) orderNo.value = this.formData.orderNo;
        if (orderDate) orderDate.value = this.formData.currentDate;
        if (factorySearch) factorySearch.value = this.formData.factoryName;
        if (factoryIdInput) factoryIdInput.value = this.formData.factoryId;
        if (staff) staff.value = this.formData.staff;
        if (staffDisplay) staffDisplay.textContent = `制单人：${this.formData.staff}`;
        if (dateTimeDisplay) dateTimeDisplay.textContent = `制单时间：${this.formData.date}`;
        if (remarkInput) remarkInput.value = this.formData.remark;
        
        // 触发工厂选择事件以显示工厂信息和加载工序
        if (this.formData.factoryId) {
            this.onFactoryChange(this.formData.factoryId);
            
            // 等待工序加载完成后设置选中的工序
            setTimeout(() => {
                if (processSelect && this.formData.processId) {
                    processSelect.value = this.formData.processId;
                }
            }, 500);
        }
        
        // 更新货品列表和总计
        this.renderProductsList();
        this.updateTotals();
        this.renderRemarkPhotos();
    }
    
    renderProductsList() {
        const productItemsContainer = document.getElementById('productItemsContainer');
        const noProductsMessage = document.getElementById('noProductsMessage');
        if (!productItemsContainer || !noProductsMessage) return;
        
        if (this.formData.products.length === 0) {
            noProductsMessage.style.display = 'block';
            productItemsContainer.innerHTML = '';
            return;
        }
        
        noProductsMessage.style.display = 'none';
        productItemsContainer.innerHTML = this.formData.products.map((product, index) => 
            this.renderProductItem(product, index)
        ).join('');
    }
    
    renderProductItem(product, index) {
        return `
            <div class="product-item">
                <div class="product-info">
                    <img class="product-image" src="${product.image || '/images/default-product.png'}" 
                         alt="${product.name}" onerror="sendOrderForm.onImageError(this, ${index})"
                         data-index="${index}">
                    <div class="product-details">
                        <div class="product-code">货号: ${product.productNo || product.code || '-'}</div>
                        <div class="product-name">${product.name || '-'}</div>
                        <div class="product-tags">
                            ${product.color ? `
                                <div class="product-tag">
                                    <span class="tag-name">颜色:</span>
                                    <span class="tag-value">${product.color}</span>
                                </div>
                            ` : ''}
                            ${product.size ? `
                                <div class="product-tag">
                                    <span class="tag-name">尺码:</span>
                                    <span class="tag-value">${product.size}</span>
                                </div>
                            ` : ''}
                            ${this.mode !== 'view' ? `
                                <div class="product-actions-inline">
                                    <button class="btn-same-product apple-btn" onclick="sendOrderForm.duplicateProduct(${index})">+</button>
                                    <button class="btn-small btn-danger apple-btn" onclick="sendOrderForm.removeProduct(${index})">-</button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="product-controls">
                    <div class="quantity-weight">
                        <div class="control-item">
                            <span class="control-label required">数量:</span>
                            ${this.mode !== 'view' ? `
                                <input class="control-input apple-input" type="number" value="${product.quantity || 0}" 
                                       onchange="sendOrderForm.updateProductQuantity(${index}, this.value)" min="1" step="1">
                            ` : `
                                <div class="control-value">${product.quantity || 0}</div>
                            `}
                        </div>
                        <div class="control-item">
                            <span class="control-label">重量:</span>
                            ${this.mode !== 'view' ? `
                                <input class="control-input apple-input" type="number" value="${product.weight || 0}" 
                                       onchange="sendOrderForm.updateProductWeight(${index}, this.value)" min="0" step="0.1">
                            ` : `
                                <div class="control-value">${product.weight || 0}</div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    updateProductQuantity(index, value) {
        if (this.formData.products[index]) {
            this.formData.products[index].quantity = parseFloat(value) || 0;
            this.updateTotals();
            this.renderProductsList(); // 刷新显示
        }
    }
    
    updateProductWeight(index, value) {
        if (this.formData.products[index]) {
            this.formData.products[index].weight = parseFloat(value) || 0;
            this.updateTotals();
            this.renderProductsList(); // 刷新显示
        }
    }
    
    duplicateProduct(index) {
        const product = this.formData.products[index];
        if (product) {
            const duplicatedProduct = { ...product };
            this.formData.products.push(duplicatedProduct);
            this.renderProductsList();
            this.updateTotals();
            Utils.toast.success('货品已复制');
        }
    }
    
    removeProduct(index) {
        if (confirm('确定要删除这个货品吗？')) {
            this.formData.products.splice(index, 1);
            this.renderProductsList();
            this.updateTotals();
            Utils.toast.success('货品已删除');
        }
    }
    
    // 🔧 更新产品小计（为了保持与收回单一致性）
    updateProductSubtotal() {
        // 用于临时产品配置的小计计算
        const quantityInput = document.getElementById('tempQuantityInput');
        const subtotalDiv = document.getElementById('productSubtotal');
        
        if (quantityInput && subtotalDiv) {
            const quantity = parseFloat(quantityInput.value) || 0;
            subtotalDiv.textContent = `数量: ${quantity}`;
        }
    }

    // 🎯 精确复制微信小程序的总计计算逻辑
    updateTotals() {
        let totalQuantity = 0;
        let totalWeight = 0;
        
        if (this.formData.products && this.formData.products.length > 0) {
            this.formData.products.forEach(product => {
                totalQuantity += parseFloat(product.quantity) || 0;
                totalWeight += parseFloat(product.weight) || 0;
            });
        }
        
        this.formData.totalQuantity = totalQuantity;
        this.formData.totalWeight = totalWeight.toFixed(2);
        
        // 更新界面显示
        const totalQuantityDisplay = document.getElementById('totalQuantity');
        const totalWeightDisplay = document.getElementById('totalWeight');
        
        if (totalQuantityDisplay) totalQuantityDisplay.textContent = totalQuantity || 0;
        if (totalWeightDisplay) totalWeightDisplay.textContent = this.formData.totalWeight || 0;
    }
    
    showProductModal() {
        console.log('[showProductModal] 显示货品选择弹窗');
        console.log('[showProductModal] 可选货品数量:', this.products.length);
        
        const modal = document.getElementById('productModal');
        if (modal) {
            // 初始化过滤的货品列表
            this.filteredProducts = [...this.products];
            
            // 显示弹窗
            modal.style.display = 'block';
            
            // 添加show类来触发动画
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            // 清空搜索框
            const searchInput = document.getElementById('productSearchInput');
            if (searchInput) {
                searchInput.value = '';
                this.productSearchKeyword = '';
                searchInput.focus();
            }
            
            // 渲染货品列表
            this.renderProductSelectList();
            
            console.log('[showProductModal] 货品弹窗已显示');
        } else {
            console.error('[showProductModal] 未找到货品弹窗元素');
        }
    }
    
    hideProductModal() {
        console.log('[hideProductModal] 隐藏货品选择弹窗');
        
        const modal = document.getElementById('productModal');
        const confirmModal = document.getElementById('productConfirmModal');
        
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        
        if (confirmModal) {
            confirmModal.classList.remove('show');
            setTimeout(() => {
                confirmModal.style.display = 'none';
            }, 300);
        }
        
        this.selectedProduct = null;
        this.resetProductConfig();
    }
    
    renderProductSelectList() {
        const productSelectList = document.getElementById('productSelectList');
        if (!productSelectList) return;
        
        if (this.filteredProducts.length === 0) {
            productSelectList.innerHTML = `
                <div class="empty-search">
                    <div class="empty-text">未找到相关货品</div>
                </div>
            `;
            return;
        }
        
        const productsHTML = this.filteredProducts.map(product => `
            <div class="product-select-item card list-item-override" onclick="sendOrderForm.selectProduct('${product.id}')">
                <div class="list-item-content">
                    <img class="list-item-image" src="${product.image || '/images/default-product.png'}" alt="${product.name}" onerror="this.src='/images/default-product.png'">
                    <div class="list-item-details">
                        <div class="list-item-code">${product.productNo || product.code || '-'}</div>
                        <div class="list-item-name">${product.name || '-'}</div>
                    </div>
                </div>
            </div>
        `).join('');
        
        productSelectList.innerHTML = productsHTML;
    }
    
    searchProducts(keyword) {
        this.productSearchKeyword = keyword.toLowerCase();
        
        if (!keyword) {
            this.filteredProducts = [...this.products];
        } else {
            // 🎯 使用拼音搜索工具，对齐微信小程序的搜索体验
            this.filteredProducts = this.products.filter(product => {
                // 货号搜索（不使用拼音，因为货号通常是英文数字）
                const productNo = (product.productNo || product.code || '').toLowerCase();
                const codeMatch = productNo.includes(keyword.toLowerCase());
                
                // 货品名称搜索（使用拼音搜索）
                const productName = product.name || '';
                const nameMatch = window.PinyinUtils && window.PinyinUtils.searchMatch ? 
                    window.PinyinUtils.searchMatch(keyword, productName) :
                    productName.toLowerCase().includes(keyword.toLowerCase());
                
                return codeMatch || nameMatch;
            });
        }
        
        console.log('[searchProducts] 过滤后货品数量:', this.filteredProducts.length, '（使用', window.PinyinUtils ? '拼音搜索' : '普通搜索', '）');
        this.renderProductSelectList();
    }
    
    // 🎯 精确复制微信小程序的selectProduct逻辑
    selectProduct(productId) {
        console.log('[selectProduct] 选择货品, productId:', productId);
        
        const product = this.products.find(p => p.id == productId);
        if (product) {
            // 🔧 精确复制微信小程序算法：使用扩展运算符创建副本
            this.selectedProduct = { ...product };
            
            console.log('[selectProduct] 选择的产品 (处理前):', this.selectedProduct);
            
            // 隐藏货品选择弹窗
            const productModal = document.getElementById('productModal');
            if (productModal) {
                productModal.classList.remove('show');
                setTimeout(() => {
                    productModal.style.display = 'none';
                }, 300);
            }
            
            // 🔧 精确复制微信小程序：初始化临时变量为空字符串，让选择器显示占位符
            this.tempProductConfig = {
                color: '',
                size: '',
                quantity: '', // 清空临时数量
                weight: ''    // 清空临时重量
            };
            
            // 显示货品配置弹窗
            this.showProductConfigModal();
        } else {
            console.error('[selectProduct] 未找到货品:', productId);
            Utils.toast.error('货品不存在');
        }
    }
    
    // 🎯 精确复制微信小程序的颜色尺码选项处理逻辑
    processProductOptions() {
        if (!this.selectedProduct) return;
        
        // 🔧 精确复制微信小程序算法：确保 colorOptions 和 sizeOptions 是数组，并根据货品自身的 colors 和 sizes 字段生成
        // 添加更严格的检查和日志
        const rawColors = this.selectedProduct.colors;
        const rawSizes = this.selectedProduct.sizes;
        console.log(`[processProductOptions] 原始 colors: "${rawColors}", 原始 sizes: "${rawSizes}"`);

        let colorOptions = [];
        if (rawColors && typeof rawColors === 'string') {
            colorOptions = rawColors.split(',').map(item => item.trim()).filter(item => item !== '');
        }

        let sizeOptions = [];
        if (rawSizes && typeof rawSizes === 'string') {
            sizeOptions = rawSizes.split(',').map(item => item.trim()).filter(item => item !== '');
        }

        this.selectedProduct.colorOptions = colorOptions;
        this.selectedProduct.sizeOptions = sizeOptions;

        console.log('[processProductOptions] 选择的产品 (处理后):', this.selectedProduct);
        console.log('[processProductOptions] 生成的 colorOptions:', this.selectedProduct.colorOptions);
        console.log('[processProductOptions] 生成的 sizeOptions:', this.selectedProduct.sizeOptions);
    }
    
    // 🎯 参考微信小程序：数量输入变化处理 - 动态调整必填项标识
    onTempQuantityInput(input) {
        this.tempProductConfig.quantity = input.value;
        this.updateDynamicRequired();
        console.log('[onTempQuantityInput] 数量变化:', input.value);
    }
    
    // 🎯 参考微信小程序：重量输入变化处理 - 动态调整必填项标识  
    onTempWeightInput(input) {
        this.tempProductConfig.weight = input.value;
        this.updateDynamicRequired();
        console.log('[onTempWeightInput] 重量变化:', input.value);
    }
    
    // 🎯 参考微信小程序：动态更新必填项标识 - 当重量>0时，数量可以不必填
    updateDynamicRequired() {
        const quantityLabel = document.getElementById('quantityLabel');
        const tempWeight = this.tempProductConfig.weight || '';
        const weightValue = parseFloat(tempWeight) || 0;
        
        if (quantityLabel) {
            if (weightValue > 0) {
                // 重量大于0时，数量不是必填项
                quantityLabel.classList.remove('required');
                quantityLabel.textContent = '数量';
                console.log('[updateDynamicRequired] 重量>0，数量不必填');
            } else {
                // 重量为0时，数量是必填项
                quantityLabel.classList.add('required');
                quantityLabel.textContent = '数量';
                console.log('[updateDynamicRequired] 重量≤0，数量必填');
            }
        }
    }
    
    showProductConfigModal() {
        console.log('[showProductConfigModal] 显示货品配置弹窗');
        console.log('[showProductConfigModal] 选中的货品:', this.selectedProduct);
        
        const modal = document.getElementById('productConfirmModal');
        if (modal && this.selectedProduct) {
            // 处理货品的颜色和尺码选项
            this.processProductOptions();
            
            // 🔧 修复显示逻辑：首先显示弹窗
            modal.style.display = 'block';
            
            // 立即添加show类来触发动画
            setTimeout(() => {
                modal.classList.add('show');
            }, 10);
            
            // 渲染选中的货品信息
            this.renderSelectedProductDisplay();
            this.updateProductColorOptions();
            this.updateProductSizeOptions();
            this.resetProductConfig();
            
            // 绑定颜色和尺码选择器事件
            this.bindProductConfigEvents();
            
            // 初始化动态必填项状态
            this.updateDynamicRequired();
            
            // 聚焦到数量输入框
            setTimeout(() => {
                const quantityInput = document.getElementById('tempQuantityInput');
                if (quantityInput) {
                    quantityInput.focus();
                    quantityInput.select();
                }
            }, 300);
            
            console.log('[showProductConfigModal] 货品配置弹窗已显示');
        } else {
            console.error('[showProductConfigModal] 弹窗元素或选中货品不存在');
        }
    }
    
    hideProductConfigModal() {
        const modal = document.getElementById('productConfirmModal');
        if (modal) {
            // 🔧 修复隐藏逻辑：先移除show类，然后隐藏
            modal.classList.remove('show');
            
            // 等待动画完成后隐藏
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
            
            this.selectedProduct = null;
            this.resetProductConfig();
        }
    }
    
    // 🎯 参考微信小程序：绑定货品配置弹窗的事件监听器
    bindProductConfigEvents() {
        const colorSelect = document.getElementById('tempColorSelect');
        const sizeSelect = document.getElementById('tempSizeSelect');
        
        if (colorSelect) {
            colorSelect.addEventListener('change', (e) => {
                this.tempProductConfig.color = e.target.value;
                console.log('[bindProductConfigEvents] 颜色选择变化:', e.target.value);
            });
        }
        
        if (sizeSelect) {
            sizeSelect.addEventListener('change', (e) => {
                this.tempProductConfig.size = e.target.value;
                console.log('[bindProductConfigEvents] 尺码选择变化:', e.target.value);
            });
        }
        
        console.log('[bindProductConfigEvents] 货品配置事件已绑定');
    }
    
    renderSelectedProductDisplay() {
        const display = document.getElementById('selectedProductDisplay');
        if (display && this.selectedProduct) {
            display.innerHTML = `
                <img class="product-image" src="${this.selectedProduct.image || '/images/default-product.png'}" 
                     alt="${this.selectedProduct.name}" onerror="this.src='/images/default-product.png'">
                <div class="product-details">
                    <div class="product-code">货号: ${this.selectedProduct.productNo || this.selectedProduct.code || '-'}</div>
                    <div class="product-name">${this.selectedProduct.name || '-'}</div>
                </div>
            `;
        }
    }
    
    updateProductColorOptions() {
        const colorSelect = document.getElementById('tempColorSelect');
        if (colorSelect && this.selectedProduct) {
            // 🎯 优先使用货品自有的颜色选项，如果没有则使用全局颜色选项
            let availableColors = [];
            
            if (this.selectedProduct.colorOptions && this.selectedProduct.colorOptions.length > 0) {
                // 使用货品特定的颜色选项（字符串格式）
                availableColors = this.selectedProduct.colorOptions.map(color => ({
                    name: color,
                    code: color
                }));
            } else if (this.allAvailableColors && this.allAvailableColors.length > 0) {
                // 使用全局可用颜色（对象格式，对应小程序的allAvailableColors）
                availableColors = this.allAvailableColors;
            }
            
            if (availableColors.length === 0) {
                colorSelect.innerHTML = '<option value="">无颜色选项</option>';
                colorSelect.disabled = true;
            } else {
                const options = availableColors.map(color => 
                    `<option value="${color.code || color.name}" data-id="${color.id || ''}">${color.name}</option>`
                ).join('');
                colorSelect.innerHTML = '<option value="">请选择颜色</option>' + options;
                colorSelect.disabled = false;
            }
            
            console.log('[updateProductColorOptions] 颜色选项已更新:', availableColors.length, '（来源:', this.selectedProduct.colorOptions ? '货品特定' : '全局可用', '）');
        }
    }
    
    updateProductSizeOptions() {
        const sizeSelect = document.getElementById('tempSizeSelect');
        if (sizeSelect && this.selectedProduct) {
            // 🎯 优先使用货品自有的尺码选项，如果没有则使用全局尺码选项
            let availableSizes = [];
            
            if (this.selectedProduct.sizeOptions && this.selectedProduct.sizeOptions.length > 0) {
                // 使用货品特定的尺码选项（字符串格式）
                availableSizes = this.selectedProduct.sizeOptions.map(size => ({
                    name: size,
                    code: size
                }));
            } else if (this.allAvailableSizes && this.allAvailableSizes.length > 0) {
                // 使用全局可用尺码（对象格式，对应小程序的allAvailableSizes）
                availableSizes = this.allAvailableSizes;
            }
            
            if (availableSizes.length === 0) {
                sizeSelect.innerHTML = '<option value="">无尺码选项</option>';
                sizeSelect.disabled = true;
            } else {
                const options = availableSizes.map(size => 
                    `<option value="${size.code || size.name}" data-id="${size.id || ''}">${size.name}</option>`
                ).join('');
                sizeSelect.innerHTML = '<option value="">请选择尺码</option>' + options;
                sizeSelect.disabled = false;
            }
            
            console.log('[updateProductSizeOptions] 尺码选项已更新:', availableSizes.length, '（来源:', this.selectedProduct.sizeOptions ? '货品特定' : '全局可用', '）');
        }
    }
    
    resetProductConfig() {
        this.tempProductConfig = {
            color: '',
            size: '',
            quantity: '',
            weight: ''
        };
        
        const colorSelect = document.getElementById('tempColorSelect');
        const sizeSelect = document.getElementById('tempSizeSelect');
        const quantityInput = document.getElementById('tempQuantityInput');
        const weightInput = document.getElementById('tempWeightInput');
        
        if (colorSelect) colorSelect.value = '';
        if (sizeSelect) sizeSelect.value = '';
        if (quantityInput) quantityInput.value = '';
        if (weightInput) weightInput.value = '';
    }
    
    // 🎯 精确复制微信小程序的添加货品逻辑
    addProduct() {
        if (!this.validateProductConfig()) return;
        
        // 🔧 精确复制微信小程序的货品创建逻辑
        const newProduct = this.createProductFromConfig();
        
        // 添加到货品列表
        const selectedProducts = [...this.formData.products, newProduct];
        
        this.formData.products = selectedProducts;
        
        // 重新计算总计
        this.updateTotals();
        this.renderProductsList();
        
        // 隐藏弹窗
        this.hideProductConfigModal();
        
        // 显示添加成功提示
        Utils.toast.success('添加成功');
    }
    
    // 🎯 精确复制微信小程序的添加并继续逻辑
    addProductAndContinue() {
        if (!this.validateProductConfig()) return;
        
        // 🔧 精确复制微信小程序的货品创建逻辑
        const newProduct = this.createProductFromConfig();
        
        // 添加到货品列表
        const selectedProducts = [...this.formData.products, newProduct];
        
        this.formData.products = selectedProducts;
        
        // 重新计算总计
        this.updateTotals();
        this.renderProductsList();
        
        // 重置输入框但保持弹窗开启，用于继续添加
        this.resetProductConfig();
        
        // 显示添加成功提示
        Utils.toast.success('添加成功');
    }
    
    validateProductConfig() {
        const colorSelect = document.getElementById('tempColorSelect');
        const sizeSelect = document.getElementById('tempSizeSelect');
        const quantityInput = document.getElementById('tempQuantityInput');
        const weightInput = document.getElementById('tempWeightInput');
        
        const color = colorSelect?.value || '';
        const size = sizeSelect?.value || '';
        const quantity = quantityInput?.value || '';
        const weight = weightInput?.value || '';
        
        // 🎯 精确复制微信小程序验证逻辑：当重量不为0时，允许颜色、尺码、数量为空
        const weightValue = parseFloat(weight) || 0;
        if (weightValue <= 0) {
            // 如果重量为0，则检查必填项
            if (!color && this.selectedProduct.colorOptions && this.selectedProduct.colorOptions.length > 0) {
                Utils.toast.error('请选择颜色');
                return false;
            }
            
            if (!size && this.selectedProduct.sizeOptions && this.selectedProduct.sizeOptions.length > 0) {
                Utils.toast.error('请选择尺码');
                return false;
            }
            
            if (!quantity) {
                Utils.toast.error('请输入数量');
                return false;
            }
        }
        
        console.log('[validateProductConfig] 验证通过 - 重量:', weightValue, '数量:', quantity);
        return true;
    }
    
    // 🎯 精确复制微信小程序的货品创建逻辑
    createProductFromConfig() {
        const colorSelect = document.getElementById('tempColorSelect');
        const sizeSelect = document.getElementById('tempSizeSelect');
        const quantityInput = document.getElementById('tempQuantityInput');
        const weightInput = document.getElementById('tempWeightInput');
        
        const color = colorSelect?.value || '';
        const size = sizeSelect?.value || '';
        const quantity = quantityInput?.value || '';
        const weight = weightInput?.value || '';
        
        // 🔧 精确复制微信小程序创建货品对象的逻辑
        const newProduct = {
            ...this.selectedProduct,
            color: color,
            size: size,
            quantity: quantity || '0',
            weight: weight || '0'
        };
        
        console.log('[createProductFromConfig] 创建新货品对象:', newProduct);
        return newProduct;
    }
    
    async saveOrder() {
        if (this.isSaving) return;
        
        if (!this.validateForm()) return;
        
        console.log('[saveOrder] 开始提交发出单...');
        this.isSaving = true;
        this.showSaveLoading();
        
        try {
            // 🎯 精确复制微信小程序的提交逻辑
            const orderData = this.collectFormData();
            
            let response;
            if (this.mode === 'create') {
                // 🔧 修正API调用：对齐小程序的api.addSendOrder
                response = await API.post('/send-orders', orderData);
            } else if (this.mode === 'edit') {
                response = await API.put(`/send-orders/${this.orderId}`, orderData);
            }
            
            if (response.success && response.id) {
                // 🎯 对齐小程序：保存成功后设置刷新标志
                // 🛡️ 使用组织隔离的存储方式标记新订单
            Utils.storage.setOrgData('hasNewOrder', 'true');
                Utils.toast.success(this.mode === 'create' ? '保存成功' : '更新成功');
                setTimeout(() => {
                    this.goBack();
                }, 1500);
            } else {
                throw new Error(response.message || '保存失败');
            }
            
        } catch (error) {
            console.error('[saveOrder] 发出单提交失败:', error);
            Utils.toast.error(error.message || '保存失败');
        } finally {
            this.isSaving = false;
            this.hideSaveLoading();
        }
    }
    
    validateForm() {
        // 验证基础信息
        if (!this.formData.factoryId) {
            Utils.toast.error('请选择工厂');
            return false;
        }
        
        if (!this.formData.processId) {
            Utils.toast.error('请选择工序');
            return false;
        }
        
        if (this.formData.products.length === 0) {
            Utils.toast.error('请添加货品');
            return false;
        }
        
        // 🎯 精确复制微信小程序的货品验证逻辑：检查货品信息是否完整
        for (let i = 0; i < this.formData.products.length; i++) {
            const product = this.formData.products[i];
            const weight = parseFloat(product.weight) || 0;
            
            // 🎯 当重量为0时，才检查颜色、尺码、数量
            if (weight <= 0) {
                if (!product.color && product.colorOptions && product.colorOptions.length > 0) {
                    Utils.toast.error(`请选择第${i+1}个货品的颜色`);
                    return false;
                }
                if (!product.size && product.sizeOptions && product.sizeOptions.length > 0) {
                    Utils.toast.error(`请选择第${i+1}个货品的尺码`);
                    return false;
                }
                if (product.quantity <= 0) {
                    Utils.toast.error(`请输入第${i+1}个货品的数量`);
                    return false;
                }
            }
        }
        
        return true;
    }
    
    collectFormData() {
        // 🎯 精确复制微信小程序的数据提交格式
        const factoryIdInput = document.getElementById('factoryId');
        const processSelect = document.getElementById('processSelect');
        const staff = document.getElementById('staff');
        const remarkInput = document.getElementById('remarkInput');
        
        // 1. 组装明细字段，全部下划线风格，确保 product_id、product_no 来源准确
        const orderItems = this.formData.products.map(p => ({
            product_id: p.id || p.product_id || '', // 优先用 id
            product_no: p.code || p.productNo || p.product_no || '', // 优先用 code
            color_id: p.colorId || p.color_id || null,
            color_code: p.color || p.color_code || '',
            size_id: p.sizeId || p.size_id || null,
            size_code: p.size || p.size_code || '',
            weight: parseFloat(p.weight) || 0,
            quantity: parseInt(p.quantity) || 0,
            fee: parseFloat(p.price) || parseFloat(p.fee) || 0 // price优先
        }));

        // 2. 组装主表数据
        const orgId = Auth.getUserInfo().orgId;
        if (!orgId) {
            throw new Error('组织信息缺失，请重新登录');
        }
        
        // 获取工序名称
        const selectedProcessId = processSelect ? processSelect.value : this.formData.processId;
        const selectedProcess = this.processes.find(p => p.id == selectedProcessId);
        
        const orderMain = {
            orgId: orgId,
            factoryId: factoryIdInput ? factoryIdInput.value : this.formData.factoryId,
            // 从selectedProcess对象中获取processId
            processId: selectedProcessId ? parseInt(selectedProcessId) : 0,
            // 传递工序名称，确保后端能正确显示
            process: selectedProcess ? selectedProcess.name : '',
            totalWeight: this.formData.totalWeight,
            totalQuantity: this.formData.totalQuantity,
            totalFee: orderItems.reduce((sum, item) => sum + (item.fee || 0), 0), // 自动合计
            remark: remarkInput ? remarkInput.value : this.formData.remark,
            remarkImages: this.formData.remarkPhotos || [], // 添加备注照片
            status: 1,
            items: orderItems
        };
        
        console.log('[collectFormData] 即将提交的发出单数据 (主表+明细):', JSON.stringify(orderMain, null, 2));
        return orderMain;
    }
    
    showSaveLoading() {
        const saveBtn = document.getElementById('saveBtn');
        const saveBtnText = document.getElementById('saveBtnText');
        const saveBtnSpinner = document.getElementById('saveBtnSpinner');
        
        if (saveBtn) saveBtn.disabled = true;
        if (saveBtnText) saveBtnText.style.display = 'none';
        if (saveBtnSpinner) saveBtnSpinner.style.display = 'inline-block';
    }
    
    hideSaveLoading() {
        const saveBtn = document.getElementById('saveBtn');
        const saveBtnText = document.getElementById('saveBtnText');
        const saveBtnSpinner = document.getElementById('saveBtnSpinner');
        
        if (saveBtn) saveBtn.disabled = false;
        if (saveBtnText) saveBtnText.style.display = 'inline';
        if (saveBtnSpinner) saveBtnSpinner.style.display = 'none';
    }
    
    async cancelOrder() {
        if (!this.orderId) {
            Utils.toast.error('订单ID不存在');
            return;
        }
        
        // 🎯 精确复制小程序的确认弹窗逻辑
        if (!confirm('确定要作废此订单吗？此操作不可撤销。')) {
            return;
        }
        
        try {
            Utils.loading.show('作废中...');
            
            // 🔧 修正API调用：对齐小程序的DELETE请求
            const response = await API.delete(`/send-orders/${this.orderId}`);
            
            if (response.success) {
                Utils.toast.success('订单已作废');
                
                // 🎯 对齐小程序：设置首页数据刷新标志
                // 🛡️ 使用组织隔离的存储方式标记数据刷新
            Utils.storage.setOrgData('refreshHomeData', 'true');
                
                // 延迟返回
                setTimeout(() => {
                    this.goBack();
                }, 1500);
            } else {
                Utils.toast.error(response.message || '作废失败');
            }
        } catch (error) {
            console.error('[cancelOrder] 作废订单API调用失败:', error);
            Utils.toast.error('作废失败，请重试');
        } finally {
            Utils.loading.hide();
        }
    }
    
    goBack() {
        if (window.app) {
            window.app.navigateToPage('send-receive');
        }
    }
    
    // 🎯 备注图片相关方法 - 对齐小程序逻辑
    renderRemarkPhotos() {
        const photoGrid = document.getElementById('photoGrid');
        if (!photoGrid) {
            console.warn('[renderRemarkPhotos] photoGrid元素未找到');
            return;
        }
        
        const photos = this.formData.remarkPhotos || [];
        let html = '';
        
        // 渲染现有图片
        photos.forEach((photo, index) => {
            html += `
                <div class="remark-photo-item">
                    <img src="${photo}" alt="备注图片${index + 1}" class="remark-photo-image" onclick="sendOrderForm.previewPhoto('${photo}')">
                    ${this.mode !== 'view' ? `
                        <button class="remark-photo-delete" onclick="sendOrderForm.deleteRemarkPhoto(${index})">×</button>
                    ` : ''}
                </div>
            `;
        });
        
        // 添加上传按钮（非查看模式且图片数量少于3张）
        if (this.mode !== 'view' && photos.length < 3) {
            html += `
                <div class="add-photo-btn" onclick="sendOrderForm.chooseRemarkPhoto()">
                    <div class="add-photo-icon">+</div>
                    <div class="add-photo-text">照片</div>
                </div>
            `;
        }
        
        photoGrid.innerHTML = html;
    }
    
    chooseRemarkPhoto() {
        // 🎯 精确复制小程序的图片数量限制逻辑
        if (this.formData.remarkPhotos.length >= 3) {
            Utils.toast.error('最多上传3张照片');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // 显示上传中提示
                Utils.loading.show('上传中...');
                this.uploadRemarkPhoto(file);
            }
        };
        input.click();
    }
    
    async uploadRemarkPhoto(file) {
        try {
            // 检查文件大小（限制为5MB）
            if (file.size > 5 * 1024 * 1024) {
                Utils.toast.error('图片大小不能超过5MB');
                return;
            }
            
            // 检查文件类型
            if (!file.type.startsWith('image/')) {
                Utils.toast.error('请选择图片文件');
                return;
            }
            
            Utils.loading.show('上传中...');
            
            // 上传图片
            const response = await API.uploadFile('/upload/images', file);
            
            if (response.success && response.data && response.data.filePath) {
                // 添加到图片列表
                this.formData.remarkPhotos.push(response.data.filePath);
                this.renderRemarkPhotos();
                Utils.toast.success('图片上传成功');
            } else {
                throw new Error(response.message || '上传失败');
            }
        } catch (error) {
            console.error('上传图片失败:', error);
            Utils.toast.error('上传失败: ' + error.message);
        } finally {
            Utils.loading.hide();
        }
    }
    
    deleteRemarkPhoto(index) {
        if (confirm('确定要删除这张图片吗？')) {
            this.formData.remarkPhotos.splice(index, 1);
            this.renderRemarkPhotos();
            Utils.toast.success('图片已删除');
        }
    }
    
    previewPhoto(photoUrl) {
        const modal = document.getElementById('photoPreviewModal');
        const image = document.getElementById('previewImage');
        
        if (modal && image) {
            image.src = photoUrl;
            modal.style.display = 'block';
        }
    }
    
    hidePhotoPreview() {
        const modal = document.getElementById('photoPreviewModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 🎯 精确复制小程序的图片加载错误处理
    onImageError(imgElement, index) {
        console.log(`[onImageError] 图片加载失败，索引: ${index}`);
        
        if (imgElement && index !== undefined && this.formData.products[index]) {
            imgElement.src = '/images/default-product.png';
            // 同时更新数据中的图片路径
            this.formData.products[index].image = '/images/default-product.png';
            console.log(`[onImageError] 已将索引${index}的图片替换为默认图片`);
        }
    }
}

// 全局管理器实例
let sendOrderForm = null;

// 全局函数
function initSendOrderForm(mode = 'create', orderId = null) {
    sendOrderForm = new SendOrderForm(mode, orderId);
}

// 导出类
window.SendOrderForm = SendOrderForm; 