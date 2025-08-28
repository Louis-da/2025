// 收回单表单页面功能类 - 组织数据隔离版
class ReceiveOrderForm {
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
            paymentMethod: '现金', // 默认现金支付
            paymentAmount: '',
            totalQuantity: 0,
            totalWeight: 0,
            totalAmount: 0,
            orderPayableAmount: 0, // 当前订单应付金额
            remainBalance: 0, // 结余
            products: []
        };
        
        // 基础数据
        this.factories = [];
        this.processes = [];
        this.products = [];
        this.colors = [];
        this.sizes = [];
        this.allAvailableColors = []; // 所有可用颜色
        this.allAvailableSizes = []; // 所有可用尺码
        
        // 支付方式列表（对齐小程序端）
        this.paymentMethods = ['现金', '微信', '支付宝', '银行', '未付'];
        
        // 模态框状态
        this.showProductModal = false;
        this.showProductConfigModal = false;
        this.selectedProduct = null;
        this.tempProductConfig = {
            color: '',
            size: '',
            quantity: '',
            weight: '',
            price: ''
        };
        
        // 搜索状态
        this.productSearchKeyword = '';
        this.filteredProducts = [];
        this.filteredFactories = [];
        this.hideDropdownTimer = null;
        
        this.init();
    }
    
    init() {
        this.renderPage();
        this.bindEvents();
        this.setupPageShowListener(); // 设置页面显示监听 - 对齐小程序端onShow
        this.loadBasicData();
        
        if (this.mode === 'edit' && this.orderId) {
            this.loadOrderData();
        } else {
            this.initNewOrder();
        }
    }
    
    // 设置页面显示监听 - 对齐小程序端onShow功能
    setupPageShowListener() {
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.onPageShow();
            }
        });
        
        // 监听浏览器回退/前进
        window.addEventListener('pageshow', () => {
            this.onPageShow();
        });
    }
    
    // 页面显示时的逻辑 - 对齐小程序端onShow
    onPageShow() {
        console.log('[receive-order-form.js onPageShow] Page shown. Current mode:', this.mode);
        
        // 页面显示时更新制单人信息，确保使用最新的姓名 - 对齐小程序端
        if (this.mode === 'create') {
            // 🛡️ 使用安全的存储方式获取用户信息
            const realName = Utils.storage.get(CONFIG.STORAGE_KEYS.REAL_NAME) || '';
            const employeeName = Utils.storage.get(CONFIG.STORAGE_KEYS.EMPLOYEE_NAME) || '';
            const username = Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME) || '';
            const staffName = realName || employeeName || username || '员工';
            
            // 只有当制单人信息发生变化时才更新
            if (this.formData.staff !== staffName) {
                this.formData.staff = staffName;
                const staffDisplay = document.getElementById('staffDisplay');
                if (staffDisplay) {
                    staffDisplay.textContent = `制单人：${staffName}`;
                }
            }
        }
    }
    
    renderPage() {
        const container = document.getElementById('receive-order-formPageContent');
        if (!container) return;
        
        const title = this.mode === 'create' ? '新增收回单' : 
                     this.mode === 'edit' ? '编辑收回单' : '查看收回单';
        const icon = '📥';
        
        container.innerHTML = `
            <div class="receive-order-form-container">
                <!-- 页面头部 -->
                <div class="receive-order-form-header">
                    <div class="receive-order-form-title">
                        <span class="receive-order-form-icon">${icon}</span>
                        <div>
                            <h2>${title}</h2>
                            <div class="receive-order-form-subtitle">
                                ${this.mode === 'create' ? '创建新的收回单记录' : 
                                  this.mode === 'edit' ? '修改收回单信息' : '查看收回单详情'}
                            </div>
                        </div>
                    </div>
                    <div class="base-detail-actions">
                        <button class="action-btn secondary" onclick="receiveOrderForm.goBack()">
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
                                           placeholder="请搜索或选择工厂" autocomplete="off"
                                           ${this.mode === 'view' ? 'readonly' : ''}
                                           onfocus="receiveOrderForm.showFactoryDropdown()"
                                           oninput="receiveOrderForm.onFactorySearch(event)"
                                           onblur="receiveOrderForm.hideFactoryDropdownWithDelay()">
                                    <div class="factory-search-dropdown" id="factoryDropdown" style="display: none;">
                                        <!-- 工厂列表将动态生成 -->
                                    </div>
                                </div>
                                <input type="hidden" id="factoryId" value="">
                                <div class="factory-info" id="factoryInfo" style="display: none;">
                                    <div class="factory-info-row">
                                        <span class="factory-info-label">联系人:</span>
                                        <span class="factory-info-value" id="factoryContact">-</span>
                                    </div>
                                    <div class="factory-info-row">
                                        <span class="factory-info-label">电话:</span>
                                        <span class="factory-info-value" id="factoryPhone">-</span>
                                    </div>
                                    <div class="factory-info-row">
                                        <span class="factory-info-label">当前余额:</span>
                                        <span class="factory-info-value factory-balance" id="factoryBalance">¥0.00</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-col">
                            <div class="form-item">
                                <label class="form-label required">工序</label>
                                <select id="processSelect" class="form-select" ${this.mode === 'view' ? 'disabled' : ''}>
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
                
                <!-- 货品信息卡片 -->
                <div class="form-card">
                    <div class="form-card-title">
                        <span class="form-card-icon">📦</span>
                        货品信息
                    </div>
                    
                    <div class="products-section">
                            ${this.mode !== 'view' ? `
                            <div class="product-action-bar product-action-bar-centered">
                                <button class="add-product-btn apple-btn" onclick="receiveOrderForm.showProductModal()">
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
                        
                        <div class="product-totals" id="productTotals">
                                <div class="total-item">
                                    <span class="total-label">总数量:</span>
                                    <span class="total-value" id="totalQuantityDisplay">0</span>
                                </div>
                                <div class="total-item">
                                    <span class="total-label">总重量:</span>
                                    <span class="total-value" id="totalWeightDisplay">0.00kg</span>
                                </div>
                                <div class="total-item">
                                    <span class="total-label">总金额:</span>
                                    <span class="total-value total-amount" id="totalAmountDisplay">¥0.00</span>
                                </div>
                        </div>
                    </div>
                </div>
                
                <!-- 支付信息卡片 -->
                <div class="form-card">
                    <div class="form-card-title">
                        <span class="form-card-icon">💰</span>
                        支付信息
                    </div>
                    
                    <div class="payment-section">
                        <div class="form-item">
                            <label class="form-label required">支付方式</label>
                            <div class="payment-methods" id="paymentMethods">
                                ${this.paymentMethods.map(method => `
                                    <div class="payment-method-item ${method === this.formData.paymentMethod ? 'active' : ''}" 
                                         onclick="receiveOrderForm.selectPaymentMethod('${method}')">
                                        <div class="checkbox-container">
                                            <div class="checkbox-inner ${method === this.formData.paymentMethod ? 'checked' : ''}"></div>
                                        </div>
                                        <span>${method}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">支付金额</label>
                                    <input type="number" id="paymentAmount" class="form-input" 
                                           placeholder="请输入支付金额" 
                                           oninput="receiveOrderForm.onPaymentAmountInput(event)"
                                           ${this.mode === 'view' ? 'readonly' : ''}>
                                </div>
                            </div>
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">本单结余</label>
                                    <div class="balance-display">
                                        <span class="balance-amount" id="remainBalanceDisplay">¥0.00</span>
                                        <span class="balance-hint">(支付金额 - 应付金额)</span>
                                    </div>
                                </div>
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
                    
                    <div class="form-item">
                        <label class="form-label">备注</label>
                        <textarea id="remark" class="form-textarea" rows="3" 
                                  placeholder="请输入备注信息" 
                                  ${this.mode === 'view' ? 'readonly' : ''}></textarea>
                    </div>
                    
                    <div class="form-item">
                        <label class="form-label">备注图片 (最多3张)</label>
                        <div class="photo-list" id="photoList">
                            <!-- 图片列表将通过JavaScript动态生成 -->
                        </div>
                    </div>
                </div>
                
                <!-- 操作按钮 -->
                ${this.mode !== 'view' ? `
                    <div class="form-actions">
                        <button class="form-btn secondary" onclick="receiveOrderForm.goBack()">
                            取消
                        </button>
                        <button class="form-btn primary" id="saveBtn" onclick="receiveOrderForm.saveOrder()">
                            <span class="btn-spinner" id="saveBtnSpinner" style="display: none;"></span>
                            <span id="saveBtnText">${this.mode === 'create' ? '创建收回单' : '保存修改'}</span>
                        </button>
                    </div>
                ` : `
                    <div class="form-actions">
                        <button class="form-btn secondary" onclick="receiveOrderForm.goBack()">
                            返回
                        </button>
                        ${this.orderId ? `
                            <button class="form-btn danger" onclick="receiveOrderForm.cancelOrder()">
                                作废订单
                            </button>
                        ` : ''}
                    </div>
                `}
            </div>
            
            <!-- 货品选择弹窗 -->
            <div class="modal-overlay" id="productModalOverlay" style="display: none;" onclick="receiveOrderForm.hideProductModal()">
                <div class="modal-container" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>选择货品</h3>
                        <button class="modal-close" onclick="receiveOrderForm.hideProductModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-container">
                            <input type="text" id="productSearchInput" class="search-input" 
                                   placeholder="搜索货品名称或货号"
                                   oninput="receiveOrderForm.searchProducts(this.value)">
                        </div>
                        <div class="product-select-list" id="productSelectList">
                            <!-- 货品选择列表将通过JavaScript动态生成 -->
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 货品配置弹窗 -->
            <div class="modal-overlay" id="productConfigModalOverlay" style="display: none;" onclick="receiveOrderForm.hideProductConfigModal()">
                <div class="modal-container" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>配置货品信息</h3>
                        <button class="modal-close" onclick="receiveOrderForm.hideProductConfigModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="selectedProductDisplay">
                            <!-- 选中的货品信息将通过JavaScript动态生成 -->
                        </div>
                        
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">颜色</label>
                                    <select id="productColor" class="form-select">
                                        <option value="">请选择颜色</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">尺码</label>
                                    <select id="productSize" class="form-select">
                                        <option value="">请选择尺码</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label dynamic-required" id="quantityLabel">数量</label>
                                    <input type="number" id="productQuantity" class="form-input" 
                                           placeholder="请输入数量" step="0.01" min="0">
                                </div>
                            </div>
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label">重量(kg)</label>
                                    <input type="number" id="productWeight" class="form-input" 
                                           placeholder="请输入重量" step="0.01" min="0"
                                           oninput="receiveOrderForm.updateDynamicRequired()">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-col">
                                <div class="form-item">
                                    <label class="form-label dynamic-required" id="priceLabel">工价(元/打)</label>
                                    <input type="number" id="productPrice" class="form-input" 
                                           placeholder="请输入工价" step="0.01" min="0">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="form-btn secondary" onclick="receiveOrderForm.hideProductConfigModal()">
                            取消
                        </button>
                        <button class="form-btn secondary" onclick="receiveOrderForm.addProductAndContinue()">
                            添加并继续
                        </button>
                        <button class="form-btn primary" onclick="receiveOrderForm.addProduct()">
                            确认添加
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- 图片预览弹窗 -->
            <div class="modal-overlay" id="photoPreviewModal" style="display: none;" onclick="receiveOrderForm.hidePhotoPreview()">
                <div class="photo-preview-container" onclick="event.stopPropagation()">
                    <button class="photo-preview-close" onclick="receiveOrderForm.hidePhotoPreview()">×</button>
                    <img id="previewImage" src="" alt="预览图片">
                </div>
            </div>
        `;
    }
    
    // 生成收回单订单号 - 对齐小程序端逻辑  
    generateOrderNumber() {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const dateStr = year + month + day;
        
        // 🛡️ 使用组织隔离的存储方式获取今日序号
        const today = now.toDateString();
        const storageKey = `receiveOrderSequence_${today}`;
        let sequence = parseInt(Utils.storage.getOrgData(storageKey, 0)) + 1;
        
        // 序号超过999后重置为1
        if (sequence > 999) {
            sequence = 1;
        }
        
        const orderNumber = `S${dateStr}${sequence.toString().padStart(3, '0')}`;
        
        // 保存新的序号
        Utils.storage.setOrgData(storageKey, sequence.toString());
        
        return orderNumber;
    }
    
    // 动态更新必填字段标识
    updateDynamicRequired() {
        const weightInput = document.getElementById('productWeight');
        const quantityLabel = document.getElementById('quantityLabel');
        const priceLabel = document.getElementById('priceLabel');
        
        if (weightInput && quantityLabel && priceLabel) {
            const weight = parseFloat(weightInput.value) || 0;
            const hasWeight = weight > 0;
            
            if (hasWeight) {
                // 重量>0时，数量和工价不是必填
                quantityLabel.classList.remove('required');
                priceLabel.classList.remove('required');
            } else {
                // 重量为0时，数量和工价是必填
                quantityLabel.classList.add('required');
                priceLabel.classList.add('required');
            }
        }
    }
    
    bindEvents() {
        this.bindPageEvents();
        this.renderRemarkPhotos();
    }
    
    bindPageEvents() {
        // 处理工序选择
        const processSelect = document.getElementById('processSelect');
        if (processSelect) {
            processSelect.addEventListener('change', (e) => {
                this.onProcessChange(e.target.value);
            });
        }
        
        // 处理支付方式选择
        const paymentMethod = document.getElementById('paymentMethod');
        if (paymentMethod) {
            paymentMethod.addEventListener('change', (e) => {
                this.formData.paymentMethod = e.target.value;
                this.updateBalance();
            });
        }
        
        // 处理支付金额输入
        const paymentAmount = document.getElementById('paymentAmount');
        if (paymentAmount) {
            paymentAmount.addEventListener('input', (e) => {
                this.formData.paymentAmount = parseFloat(e.target.value) || 0;
                this.updateBalance();
            });
        }
        
        // 处理备注输入
        const remarkInput = document.getElementById('remark');
        if (remarkInput) {
            remarkInput.addEventListener('input', (e) => {
                this.formData.remark = e.target.value;
            });
        }
        
        // 处理制单日期
        const orderDate = document.getElementById('orderDate');
        if (orderDate) {
            orderDate.addEventListener('change', (e) => {
                this.formData.date = e.target.value;
            });
        }
        
        // 处理模态框背景点击关闭
        const productModal = document.getElementById('productModalOverlay');
        if (productModal) {
            productModal.addEventListener('click', (e) => {
                if (e.target === productModal) {
                    this.hideProductModal();
                }
            });
        }
        
        const productConfigModal = document.getElementById('productConfigModalOverlay');
        if (productConfigModal) {
            productConfigModal.addEventListener('click', (e) => {
                if (e.target === productConfigModal) {
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
                console.log('[ReceiveOrderForm] 已加载工厂数据:', this.factories.length);
            }
            
            // 工序数据（自动组织隔离）
            if (processesRes.success) {
                this.processes = processesRes.data || [];
                console.log('[ReceiveOrderForm] 已加载工序数据:', this.processes.length);
            }
            
            // 货品数据（自动组织隔离）
            if (productsRes.success) {
                // 只显示启用的货品
                this.products = (productsRes.data || []).filter(p => p.status === 1);
                this.filteredProducts = [...this.products];
                console.log('[ReceiveOrderForm] 已加载货品数据:', this.products.length);
            }
            
            // 🎯 颜色数据（对应小程序的allAvailableColors）
            if (colorsRes.success) {
                this.colors = colorsRes.data || [];
                this.allAvailableColors = (colorsRes.data || []).filter(c => c.status === 1); // 只显示启用的颜色
                console.log('[ReceiveOrderForm] 已加载颜色数据:', this.allAvailableColors.length);
            }
            
            // 🎯 尺码数据（对应小程序的allAvailableSizes）
            if (sizesRes.success) {
                this.sizes = sizesRes.data || [];
                this.allAvailableSizes = (sizesRes.data || []).filter(s => s.status === 1); // 只显示启用的尺码
                console.log('[ReceiveOrderForm] 已加载尺码数据:', this.allAvailableSizes.length);
            }
            
            // 更新表单选项
            this.updateFactoryOptions();
            this.updateProcessOptions();
            
        } catch (error) {
            console.error('[ReceiveOrderForm] 加载基础数据失败:', error);
            Utils.toast.error('加载基础数据失败，请刷新页面重试');
        } finally {
            this.isLoading = false;
            this.hideSaveLoading();
        }
    }
    
    updateFactoryOptions() {
        // 由于使用搜索下拉，这里不需要更新select选项
        // 工厂选项在下拉列表中动态渲染
        console.log('[ReceiveOrderForm] 工厂选项已准备，共', this.factories.length, '个工厂');
    }
    
    // 🔧 渲染工厂下拉列表
    renderFactoryDropdown() {
        const factoryDropdown = document.getElementById('factoryDropdown');
        if (!factoryDropdown) return;
        
        if (this.filteredFactories.length === 0) {
            factoryDropdown.innerHTML = `
                <div class="factory-dropdown-item no-result">
                    <div class="factory-item-info">
                        <div class="factory-item-name">未找到相关工厂</div>
                    </div>
                </div>
            `;
            return;
        }
        
        const factoriesHTML = this.filteredFactories.map(factory => `
            <div class="factory-dropdown-item" onclick="receiveOrderForm.selectFactoryFromDropdown('${factory.id}')">
                <div class="factory-item-info">
                    <div class="factory-item-name">${factory.name}</div>
                    <div class="factory-item-contact">
                        ${factory.contact ? `联系人: ${factory.contact}` : ''}
                        ${factory.phone ? ` | 电话: ${factory.phone}` : ''}
                    </div>
                </div>
            </div>
        `).join('');
        
        factoryDropdown.innerHTML = factoriesHTML;
    }
    
    // 🔧 更新产品小计金额
    updateProductSubtotal(index = null) {
        if (index !== null && this.formData.products[index]) {
            // 更新已添加货品的小计
            const product = this.formData.products[index];
            const quantity = parseFloat(product.quantity) || 0;
            const price = parseFloat(product.price) || 0;
            product.subtotal = quantity * price;
        } else {
            // 更新配置中货品的小计
            const quantityInput = document.getElementById('productQuantity');
            const priceInput = document.getElementById('productPrice');
            const subtotalDiv = document.getElementById('productSubtotal');
            
            if (quantityInput && priceInput && subtotalDiv) {
                const quantity = parseFloat(quantityInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const subtotal = quantity * price;
                
                subtotalDiv.textContent = `小计: ¥${subtotal.toFixed(2)}`;
                this.tempProductConfig.subtotal = subtotal;
            }
        }
    }
    
    // 🔧 更新结余金额计算
    updateBalance() {
        const totalAmount = this.formData.totalAmount || 0;
        const paymentAmount = parseFloat(document.getElementById('paymentAmount')?.value || 0);
        const balance = totalAmount - paymentAmount;
        
        // 更新应付金额显示
        const orderPayableAmount = document.getElementById('orderPayableAmount');
        if (orderPayableAmount) {
            orderPayableAmount.textContent = `¥${totalAmount.toFixed(2)}`;
        }
        
        // 更新结余金额显示
        const remainBalance = document.getElementById('remainBalance');
        if (remainBalance) {
            remainBalance.textContent = `¥${balance.toFixed(2)}`;
            remainBalance.className = 'order-amount-value ' + (balance >= 0 ? 'positive' : 'negative');
        }
        
        // 更新表单数据
        this.formData.paymentAmount = paymentAmount;
    }
    
    updateTotals() {
        const products = this.formData.products;
        console.log('计算总计，货品数量:', products.length);
        
        // 强制转换类型确保计算正确 - 对齐小程序端逻辑
        const totalQuantity = products.reduce((sum, p) => {
            const quantity = parseFloat(p.quantity) || 0;
            return sum + quantity;
        }, 0);
        
        // 计算总重量
        const totalWeight = products.reduce((sum, p) => {
            const weight = parseFloat(p.weight) || 0;
            return sum + weight;
        }, 0);
        
        const totalAmount = products.reduce((sum, p) => {
            const price = parseFloat(p.fee || p.price) || 0;
            const quantity = parseFloat(p.quantity) || 0;
            
            // 计算小计
            let subtotal = price * quantity;
            
            // 记录日志
            if (price > 0 && quantity > 0) {
                console.log(`货品小计(价格×数量): ${price}元/打 × ${quantity}打 = ${subtotal}元`);
            } else if (parseFloat(p.weight) > 0) {
                // 当重量不为0且价格或数量为0时，不产生小计
                console.log(`货品只有重量(${p.weight}kg)，不产生金额`);
                subtotal = 0;
            }
            
            return sum + subtotal;
        }, 0);
        
        console.log(`总数量: ${totalQuantity}打, 总重量: ${totalWeight}kg, 总金额: ${totalAmount}元`);
        
        this.formData.totalQuantity = totalQuantity;
        this.formData.totalWeight = totalWeight;
        this.formData.totalAmount = totalAmount;
        this.formData.orderPayableAmount = totalAmount; // 当前订单应付金额
        
        // 更新显示
        const totalQuantityEl = document.getElementById('totalQuantityDisplay');
        const totalWeightEl = document.getElementById('totalWeightDisplay');
        const totalAmountEl = document.getElementById('totalAmountDisplay');
        
        if (totalQuantityEl) totalQuantityEl.textContent = totalQuantity.toFixed(0);
        if (totalWeightEl) totalWeightEl.textContent = totalWeight.toFixed(2) + 'kg';
        if (totalAmountEl) totalAmountEl.textContent = '¥' + totalAmount.toFixed(2);
        
        // 货品变动后也要重新计算本单结余
        this.calculateRemainBalance(this.formData.paymentAmount);
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
        
        const productsHTML = this.formData.products.map((product, index) => `
            <div class="product-item">
                <div class="product-info">
                    <img class="product-image" src="${product.image || '/images/default-product.png'}" alt="${product.name}">
                    <div class="product-details">
                    <div class="product-code">${product.productNo || product.code || '-'}</div>
                    <div class="product-name">${product.name || '-'}</div>
                        <div class="product-tags">
                            <div class="product-tag">
                                <span class="tag-name">颜色:</span>
                                <span class="tag-value">${product.color || '-'}</span>
                            </div>
                            <div class="product-tag">
                                <span class="tag-name">尺码:</span>
                                <span class="tag-value">${product.size || '-'}</span>
                            </div>
                        </div>
                    </div>
                    ${this.mode !== 'view' ? `
                        <div class="product-actions-inline">
                            <button class="btn-same-product btn-small" onclick="receiveOrderForm.duplicateProduct(${index})" title="复制">
                                ⊕
                            </button>
                            <button class="btn-danger btn-small" onclick="receiveOrderForm.removeProduct(${index})" title="删除">
                                ×
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <div class="product-controls">
                    <div class="quantity-weight">
                        <div class="control-item">
                            <span class="control-label required">数量:</span>
                            ${this.mode === 'view' ? 
                                `<span class="control-value">${product.quantity || 0}</span>` :
                                `<input type="number" class="control-input" value="${product.quantity || 0}" 
                                        onchange="receiveOrderForm.updateProductQuantity(${index}, this.value)" min="0" step="1">`
                            }
            </div>
                        <div class="control-item">
                            <span class="control-label required">重量:</span>
                            ${this.mode === 'view' ? 
                                `<span class="control-value">${product.weight || 0}kg</span>` :
                                `<input type="number" class="control-input" value="${product.weight || 0}" 
                                        onchange="receiveOrderForm.updateProductWeight(${index}, this.value)" min="0" step="0.01">`
                            }
                        </div>
                        <div class="control-item">
                            <span class="control-label required">工价:</span>
                            ${this.mode === 'view' ? 
                                `<span class="control-value">¥${product.price || 0}</span>` :
                                `<input type="number" class="control-input" value="${product.price || 0}" 
                                        onchange="receiveOrderForm.updateProductPrice(${index}, this.value)" min="0" step="0.01">`
                            }
                        </div>
                        <div class="control-item">
                            <span class="control-label">小计:</span>
                            <span class="control-value">¥${product.subtotal || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        productItemsContainer.innerHTML = productsHTML;
    }
    
    updateProductQuantity(index, value) {
        if (this.formData.products[index]) {
            this.formData.products[index].quantity = parseFloat(value) || 0;
            this.updateProductSubtotal(index);
            this.updateTotals();
        }
    }
    
    updateProductWeight(index, value) {
        if (this.formData.products[index]) {
            this.formData.products[index].weight = parseFloat(value) || 0;
        }
    }
    
    updateProductPrice(index, value) {
        if (this.formData.products[index]) {
            this.formData.products[index].price = parseFloat(value) || 0;
            this.updateProductSubtotal(index);
            this.updateTotals();
        }
    }
    
    // 添加相同产品功能 - 对齐小程序端addSameProduct
    duplicateProduct(index) {
        const product = this.formData.products[index];
        if (product) {
            // 创建产品副本，但重置数量和重量 - 对齐小程序端逻辑
            const newProduct = { 
                ...product,
                quantity: 0,  // 重置数量
                weight: 0,    // 重置重量
                fee: product.fee || product.price || 0, // 保持价格
                // 确保唯一性，避免ID冲突
                tempId: Date.now() + Math.random()
            };
            
            this.formData.products.push(newProduct);
            
            // 刷新界面
            this.renderProductsList();
            this.updateTotals();
            
            // 显示提示信息 - 对齐小程序端
            Utils.toast.success('已添加相同产品，请设置数量和重量', {
                icon: 'success',
                duration: 2000
            });
            
            console.log('添加相同产品:', newProduct);
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
    
    showProductModal() {
        const modal = document.getElementById('productModalOverlay');
        if (modal) {
            modal.style.display = 'block';
            this.isShowProductModal = true;
            this.renderProductSelectList();
            
            // 清空搜索框
            const searchInput = document.getElementById('productSearchInput');
            if (searchInput) {
                searchInput.value = '';
                this.productSearchKeyword = '';
                this.filteredProducts = [...this.products];
            this.renderProductSelectList();
            }
        }
    }
    
    hideProductModal() {
        const modal = document.getElementById('productModalOverlay');
        const confirmModal = document.getElementById('productConfirmModalOverlay');
        if (modal) modal.style.display = 'none';
        if (confirmModal) confirmModal.style.display = 'none';
        
        this.isShowProductModal = false;
        this.selectedProduct = null;
        this.resetProductConfig();
    }
    
    renderProductSelectList() {
        const productSelectList = document.getElementById('productSelectList');
        if (!productSelectList) return;
        
        if (this.filteredProducts.length === 0) {
            productSelectList.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #a0aec0;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                    <div>未找到相关货品</div>
                </div>
            `;
            return;
        }
        
        const productsHTML = this.filteredProducts.map(product => `
            <div class="product-select-item" onclick="receiveOrderForm.selectProduct('${product.id}')">
                <img class="product-select-image" src="${product.image || '/images/default-product.png'}" alt="${product.name}">
                <div class="product-select-info">
                    <div class="product-select-code">${product.productNo || product.code || '-'}</div>
                    <div class="product-select-name">${product.name || '-'}</div>
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
    
    selectProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            // 复制产品对象并处理颜色/尺码选项 - 对齐小程序端逻辑
            this.selectedProduct = { ...product };
            
            // 确保 colorOptions 和 sizeOptions 是数组，并根据货品自身的 colors 和 sizes 字段生成
            this.selectedProduct.colorOptions = product.colors ? 
                product.colors.split(',').map(item => item.trim()).filter(item => item !== '') : [];
            this.selectedProduct.sizeOptions = product.sizes ? 
                product.sizes.split(',').map(item => item.trim()).filter(item => item !== '') : [];

            console.log('选择的产品 (处理后):', this.selectedProduct);
            console.log('原始 colors:', product.colors, '生成的 colorOptions:', this.selectedProduct.colorOptions);
            console.log('原始 sizes:', product.sizes, '生成的 sizeOptions:', this.selectedProduct.sizeOptions);
            
            this.hideProductModal();
            this.showProductConfigModal();
        }
    }
    
    showProductConfigModal() {
        const modal = document.getElementById('productConfirmModalOverlay');
        if (modal && this.selectedProduct) {
            modal.style.display = 'block';
            this.isShowProductConfigModal = true;
            this.renderSelectedProductDisplay();
            this.updateProductColorOptions();
            this.updateProductSizeOptions();
            this.resetProductConfig();
            
            // 聚焦到数量输入框
            setTimeout(() => {
                const quantityInput = document.getElementById('productQuantity');
                if (quantityInput) quantityInput.focus();
            }, 100);
        }
    }
    
    hideProductConfigModal() {
        const modal = document.getElementById('productConfirmModalOverlay');
        if (modal) {
            modal.style.display = 'none';
            this.isShowProductConfigModal = false;
            this.selectedProduct = null;
            this.resetProductConfig();
        }
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
        const colorSelect = document.getElementById('productColor');
        if (colorSelect && this.selectedProduct) {
            // 🎯 优先使用货品自有的颜色选项，如果没有则使用全局颜色选项
            let availableColors = [];
            
            if (this.selectedProduct.colors && this.selectedProduct.colors.trim()) {
                // 使用货品特定的颜色选项（字符串格式）
                availableColors = this.selectedProduct.colors.split(',')
                    .map(color => ({ name: color.trim(), code: color.trim() }))
                    .filter(color => color.name);
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
            
            console.log('[updateProductColorOptions] 颜色选项已更新:', availableColors.length, '（来源:', this.selectedProduct.colors ? '货品特定' : '全局可用', '）');
        }
    }
    
    updateProductSizeOptions() {
        const sizeSelect = document.getElementById('productSize');
        if (sizeSelect && this.selectedProduct) {
            // 🎯 优先使用货品自有的尺码选项，如果没有则使用全局尺码选项
            let availableSizes = [];
            
            if (this.selectedProduct.sizes && this.selectedProduct.sizes.trim()) {
                // 使用货品特定的尺码选项（字符串格式）
                availableSizes = this.selectedProduct.sizes.split(',')
                    .map(size => ({ name: size.trim(), code: size.trim() }))
                    .filter(size => size.name);
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
            
            console.log('[updateProductSizeOptions] 尺码选项已更新:', availableSizes.length, '（来源:', this.selectedProduct.sizes ? '货品特定' : '全局可用', '）');
        }
    }
    
    resetProductConfig() {
        this.tempProductConfig = {
            color: '',
            size: '',
            quantity: '',
            weight: '',
            price: ''
        };
        
        const productColor = document.getElementById('productColor');
        const productSize = document.getElementById('productSize');
        const productQuantity = document.getElementById('productQuantity');
        const productWeight = document.getElementById('productWeight');
        const productPrice = document.getElementById('productPrice');
        const productSubtotal = document.getElementById('productSubtotal');
        
        if (productColor) productColor.value = '';
        if (productSize) productSize.value = '';
        if (productQuantity) productQuantity.value = '';
        if (productWeight) productWeight.value = '';
        if (productPrice) productPrice.value = '';
        if (productSubtotal) productSubtotal.value = '¥0.00';
    }
    
    addProduct() {
        if (this.validateProductConfig()) {
            const newProduct = this.createProductFromConfig();
            this.formData.products.push(newProduct);
            this.renderProductsList();
            this.updateTotals();
            this.hideProductConfigModal();
            Utils.toast.success('货品已添加');
        }
    }
    
    addProductAndContinue() {
        if (this.validateProductConfig()) {
            const newProduct = this.createProductFromConfig();
            this.formData.products.push(newProduct);
            this.renderProductsList();
            this.updateTotals();
            this.resetProductConfig();
            Utils.toast.success('货品已添加，可继续添加');
        }
    }
    
    validateProductConfig() {
        if (!this.selectedProduct) return false;
        
        const color = document.getElementById('productColor')?.value || '';
        const size = document.getElementById('productSize')?.value || '';
        const quantity = parseFloat(document.getElementById('productQuantity')?.value || 0);
        const weight = parseFloat(document.getElementById('productWeight')?.value || 0);
        const price = parseFloat(document.getElementById('productPrice')?.value || 0);
        
        // 检查重量是否非零 - 对齐小程序端动态验证逻辑
        const weightNum = parseFloat(weight) || 0;
        const hasWeight = weightNum > 0;
        
        console.log('验证数据: quantity =', JSON.stringify(quantity), 'weight =', weight);
        console.log('重量检查: weightNum =', weightNum, 'hasWeight =', hasWeight);
        
        // 如果重量大于0，则允许其他字段为空
        if (hasWeight) {
            console.log('重量不为0，跳过其他字段验证');
            
            // 确保quantity有一个默认值以防后续计算错误
            if (!quantity) {
                document.getElementById('productQuantity').value = '0';
            }
            
            return true;
        }
        
        // 以下是重量为0时的正常验证流程
        if (this.selectedProduct.colorOptions && this.selectedProduct.colorOptions.length > 0 && !color) {
            Utils.toast.error('请选择颜色');
            return false;
        }
        
        if (this.selectedProduct.sizeOptions && this.selectedProduct.sizeOptions.length > 0 && !size) {
            Utils.toast.error('请选择尺码');
            return false;
        }
        
        // 尝试转换为数字
        const quantityNum = Number(quantity);
        console.log('转换后的数量:', quantityNum);
        if (isNaN(quantityNum)) {
            console.log('数量不是有效数字');
            Utils.toast.error('请输入有效数字');
            return false;
        }
        
        return true;
    }
    
    createProductFromConfig() {
        const color = document.getElementById('productColor')?.value || '';
        const size = document.getElementById('productSize')?.value || '';
        const quantity = parseFloat(document.getElementById('productQuantity')?.value || 0);
        const weight = parseFloat(document.getElementById('productWeight')?.value || 0);
        const price = parseFloat(document.getElementById('productPrice')?.value || 0);
        
        return {
            ...this.selectedProduct,
            color,
            size,
            quantity,
            weight,
            price,
            fee: price
        };
    }
    
    async saveOrder() {
        if (this.isSaving) return;
        
        if (!this.validateForm()) return;
        
        this.isSaving = true;
        this.showSaveLoading();
        
        try {
            // 收集表单数据
            const orderData = this.collectFormData();
            
            let response;
            if (this.mode === 'create') {
                // 生成订单号
                orderData.orderNo = this.generateOrderNumber();
                console.log('生成的收回单订单号:', orderData.orderNo);
                
                // 使用与小程序端一致的API调用方式
                response = await API.post('/receive-orders', orderData);
                    } else if (this.mode === 'edit') {
            // 🔒 禁用收回单编辑功能以保证数据一致性
            throw new Error('为保证数据一致性，收回单不允许编辑。如需修改，请先作废当前单据，然后重新创建。');
            }
            
            if (response.success && response.data && response.data.id) {
                // 处理服务器返回的最新工厂账户状态 - 对齐小程序端逻辑
                if (response.data.factoryStatus) {
                    const factoryStatus = response.data.factoryStatus;
                    console.log('服务器返回的最新工厂账户状态:', factoryStatus);
                    
                    try {
                        // 1. 更新当前页面显示
                        if (this.formData.factoryId && this.formData.factoryId === factoryStatus.id) {
                            // 更新页面中的工厂余额显示
                            const factoryBalance = document.getElementById('factoryBalance');
                            if (factoryBalance) {
                                factoryBalance.textContent = `¥${factoryStatus.balance || '0.00'}`;
                            }
                        }
                        
                        // 🛡️ 使用组织隔离的存储方式缓存工厂状态
                        const factoryCache = Utils.storage.getOrgData('factoriesCache', {});
                        factoryCache[factoryStatus.id] = factoryStatus;
                        Utils.storage.setOrgData('factoriesCache', factoryCache);
                        
                        // 记录更新时间，用于工厂管理页判断是否需要刷新
                        Utils.storage.setOrgData('factoriesUpdateTime', new Date().getTime().toString());
                        console.log('已缓存最新的工厂账户状态:', factoryStatus);
                    } catch (e) {
                        console.error('更新工厂状态失败:', e);
                    }
                }
                
                // 🛡️ 使用组织隔离的存储方式设置刷新标记
                Utils.storage.setOrgData('hasNewOrder', 'true');
                Utils.storage.setOrgData('refreshHomeData', 'true');
                console.log('设置新订单标记，相关页面将刷新数据');
                
                Utils.toast.success('保存成功', {
                    icon: 'success',
                    mask: true
                });
                
                // 保存成功后返回上一页 - 对齐小程序端延时逻辑
                setTimeout(() => {
                    try {
                        this.goBack();
                    } catch (e) {
                        console.error('返回上一页操作失败:', e);
                        // 如果返回失败，尝试导航到收发页面
                        if (window.app) {
                            window.app.navigateToPage('send-receive');
                        }
                    }
                }, 1000);
            } else {
                const errorMsg = (response && (response.message || response.error)) || '主订单或明细保存失败';
                console.error('保存收回单失败，服务器返回:', response);
                throw new Error(errorMsg);
            }
            
        } catch (error) {
            console.error('保存收回单失败:', error);
            Utils.toast.error('保存失败: ' + error.message);
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
        
        // 验证货品信息 - 对齐小程序端动态验证逻辑
        for (let i = 0; i < this.formData.products.length; i++) {
            const product = this.formData.products[i];
            
            // 检查重量是否大于0
            const weightNum = parseFloat(product.weight) || 0;
            const hasWeight = weightNum > 0;
            
            // 如果重量大于0，则跳过其他字段的验证
            if (hasWeight) {
                continue;
            }
            
            // 以下是重量为0时的必填字段验证
            if (!product.color) {
                Utils.toast.error(`请填写第${i + 1}个货品的颜色`);
                return false;
            }
            if (!product.size) {
                Utils.toast.error(`请填写第${i + 1}个货品的尺码`);
                return false;
            }
            if (!product.quantity || parseFloat(product.quantity) <= 0) {
                Utils.toast.error(`请填写第${i + 1}个货品的数量`);
                return false;
            }
            if (!product.price && !product.fee) {
                Utils.toast.error(`请填写第${i + 1}个货品的工价`);
                return false;
            }
        }
        
        // 验证支付方式
        if (!this.formData.paymentMethod) {
            Utils.toast.error('请选择支付方式');
            return false;
        }

        // 如果支付方式不是"未付"，则支付金额必须大于0
        const paymentAmount = parseFloat(this.formData.paymentAmount) || 0;
        if (this.formData.paymentMethod !== '未付' && paymentAmount <= 0) {
            Utils.toast.error('请输入有效的支付金额');
            return false;
        }
        
        return true;
    }
    
    collectFormData() {
        const orderDate = document.getElementById('orderDate')?.value;
        const remark = document.getElementById('remark')?.value;
        
        // 🛡️ 使用安全的存储方式获取当前用户信息
        const orgId = Utils.storage.get(CONFIG.STORAGE_KEYS.ORG_ID);
        const realName = Utils.storage.get(CONFIG.STORAGE_KEYS.REAL_NAME) || '';
        const employeeName = Utils.storage.get(CONFIG.STORAGE_KEYS.EMPLOYEE_NAME) || '';
        const username = Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME) || '';
        
        // 优先级：realName > employeeName > username - 与小程序端完全一致
        const staffName = realName || employeeName || username;
        
        // 组装明细数据，使用下划线格式与服务器端一致
        const items = this.formData.products.map(product => ({
            product_id: product.id || '',
            product_no: product.productNo || product.code || '',
            color_id: product.colorId || null,
            color_code: product.color || '',
            size_id: product.sizeId || null,
            size_code: product.size || '',
            weight: parseFloat(product.weight) || 0,
            quantity: parseFloat(product.quantity) || 0,
            fee: parseFloat(product.price || product.fee) || 0,
            productId: product.id || '',
            productName: product.name || ''
        }));
        
        return {
            orgId: orgId,
            factoryId: this.formData.factoryId,
            factoryName: this.formData.factoryName,
            processId: this.formData.processId,
            process: this.formData.processName,
            created_at: orderDate,
            staff: staffName, // 使用优先级制单人名称
            remark: remark || '',
            remarkImages: this.formData.remarkPhotos || [], // 添加备注照片
            totalWeight: this.formData.totalWeight,
            totalQuantity: this.formData.totalQuantity,
            fee: parseFloat(this.formData.totalAmount) || 0,
            totalFee: parseFloat(this.formData.totalAmount) || 0,
            paymentMethod: this.formData.paymentMethod,
            paymentAmount: parseFloat(this.formData.paymentAmount) || 0,
            status: 'normal',
            items: items
        };
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
    
    selectPaymentMethod(method) {
        if (this.mode === 'view') return;
        
        let newPaymentAmount = this.formData.paymentAmount;

        if (method === '未付') {
            newPaymentAmount = '0'; // 选择未付，金额设为0
        } else {
            // 选择其他方式，如果当前金额是0（因为之前选了未付或手动输入了0），则清空金额
            if (this.formData.paymentAmount === '0' || this.formData.paymentAmount === 0) {
                newPaymentAmount = ''; 
            }
            // 如果当前金额非0，则不清空，保留用户可能已输入的金额
        }
        
        this.formData.paymentMethod = method;
        this.formData.paymentAmount = newPaymentAmount;
        
        // 更新支付方式选择状态
        const methodItems = document.querySelectorAll('.payment-method-item');
        methodItems.forEach(item => {
            const isActive = item.textContent.trim() === method;
            item.classList.toggle('active', isActive);
            
            const checkbox = item.querySelector('.checkbox-inner');
            if (checkbox) {
                checkbox.classList.toggle('checked', isActive);
            }
        });
        
        // 更新支付金额输入框
        const paymentAmountInput = document.getElementById('paymentAmount');
        if (paymentAmountInput) {
            paymentAmountInput.value = newPaymentAmount;
        }
        
        // 重新计算结余
        this.calculateRemainBalance(newPaymentAmount);
    }
    
    // 新增支付金额输入事件处理 - 对齐小程序端逻辑
    onPaymentAmountInput(event) {
        const amount = event.target.value;
        let currentPaymentMethod = this.formData.paymentMethod;

        // 如果输入金额为0或空
        if (amount === '0' || amount === '' || parseFloat(amount) === 0) {
            // 自动将支付方式设置为"未付"
            currentPaymentMethod = '未付';
            this.formData.paymentAmount = '0'; // 确保存储的是 '0'
            this.formData.paymentMethod = currentPaymentMethod;
            
            // 更新UI
            this.updatePaymentMethodUI(currentPaymentMethod);
            
            // 计算本单结余
            this.calculateRemainBalance('0');
        } else {
            // 如果输入金额非0，但当前支付方式是"未付"，则清空支付方式让用户重新选择
            if (currentPaymentMethod === '未付') {
                currentPaymentMethod = ''; // 或者设置为默认值如 '现金'
            }
            this.formData.paymentAmount = amount;
            this.formData.paymentMethod = currentPaymentMethod;
            
            // 更新UI
            if (currentPaymentMethod) {
                this.updatePaymentMethodUI(currentPaymentMethod);
            }
            
            // 计算本单结余
            this.calculateRemainBalance(amount);
        }
    }
    
    // 更新支付方式UI显示
    updatePaymentMethodUI(method) {
        const methodItems = document.querySelectorAll('.payment-method-item');
        methodItems.forEach(item => {
            const isActive = item.textContent.trim() === method;
            item.classList.toggle('active', isActive);
            
            const checkbox = item.querySelector('.checkbox-inner');
            if (checkbox) {
                checkbox.classList.toggle('checked', isActive);
            }
        });
    }
    
    // 计算本单结余
    calculateRemainBalance(inputAmount) {
        // 结余 = 支付金额 - 应付金额，负数为欠款
        const orderPayable = parseFloat(this.formData.orderPayableAmount) || 0;
        const paid = parseFloat(inputAmount) || 0;
        const remainBalance = (paid - orderPayable).toFixed(2);
        
        this.formData.remainBalance = remainBalance;
        
        // 更新显示
        const remainBalanceDisplay = document.getElementById('remainBalanceDisplay');
        if (remainBalanceDisplay) {
            remainBalanceDisplay.textContent = `¥${remainBalance}`;
            
            // 根据结余金额设置颜色
            if (parseFloat(remainBalance) > 0) {
                remainBalanceDisplay.className = 'balance-amount balance-positive';
            } else if (parseFloat(remainBalance) < 0) {
                remainBalanceDisplay.className = 'balance-amount balance-negative';
            } else {
                remainBalanceDisplay.className = 'balance-amount';
            }
        }
    }
    
    async cancelOrder() {
        if (!this.orderId) {
            Utils.toast.error('订单ID不存在');
            return;
        }
        
        // 使用与小程序端完全一致的确认对话框
        const confirmed = await new Promise((resolve) => {
            // 创建自定义模态框，模拟小程序的wx.showModal
            const modal = document.createElement('div');
            modal.className = 'custom-modal-overlay';
            modal.innerHTML = `
                <div class="custom-modal-container">
                    <div class="custom-modal-header">
                        <h3>确认作废</h3>
                    </div>
                    <div class="custom-modal-body">
                        <p>确定要作废此订单吗？此操作不可撤销。</p>
                    </div>
                    <div class="custom-modal-footer">
                        <button class="modal-btn secondary" id="cancelBtn">取消</button>
                        <button class="modal-btn primary" id="confirmBtn">确定</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const cancelBtn = modal.querySelector('#cancelBtn');
            const confirmBtn = modal.querySelector('#confirmBtn');
            
            const cleanup = () => {
                document.body.removeChild(modal);
            };
            
            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            confirmBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
            
            // 点击背景关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cleanup();
                    resolve(false);
                }
            };
        });
        
        if (!confirmed) return;
        
        try {
            Utils.loading.show('作废中...');
            
            // 使用与小程序端一致的API调用 - 应该调用专门的作废接口
            const response = await API.request(`/receive-orders/${this.orderId}/cancel`, 'POST');
            
            if (response.success) {
                Utils.toast.success('订单已作废');
                
                // 修改状态值为数字0 - 对齐小程序端
                this.formData.orderStatus = 0;
                this.mode = 'view'; // 确保切换到查看模式
                
                // 设置首页数据刷新标志 - 对齐小程序端
                // 🛡️ 使用组织隔离的存储方式设置刷新标记
                Utils.storage.setOrgData('refreshHomeData', 'true');
                Utils.storage.setOrgData('hasNewOrder', 'true');
                
                // 延迟返回 - 对齐小程序端
                setTimeout(() => {
                    try {
                        this.goBack();
                    } catch (e) {
                        console.error('返回上一页操作失败:', e);
                        if (window.app) {
                            window.app.navigateToPage('send-receive');
                        }
                    }
                }, 1500);
            } else {
                throw new Error(response.message || '作废失败');
            }
        } catch (error) {
            console.error('作废收回单失败:', error);
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
    
    // 备注图片相关方法
    renderRemarkPhotos() {
        const photoList = document.getElementById('photoList');
        if (!photoList) return;
        
        const photos = this.formData.remarkPhotos || [];
        let html = '';
        
        // 渲染现有图片
        photos.forEach((photo, index) => {
            html += `
                <div class="photo-item">
                    <img src="${photo}" alt="备注图片${index + 1}" class="photo-preview" onclick="receiveOrderForm.previewPhoto('${photo}')">
                    ${this.mode !== 'view' ? `
                        <div class="photo-delete" onclick="receiveOrderForm.deleteRemarkPhoto(${index})">×</div>
                    ` : ''}
                </div>
            `;
        });
        
        // 添加上传按钮（非查看模式且图片数量少于3张）
        if (this.mode !== 'view' && photos.length < 3) {
            html += `
                <div class="photo-upload-btn" onclick="receiveOrderForm.chooseRemarkPhoto()">
                    <div class="upload-icon">+</div>
                    <div class="upload-text">照片</div>
                </div>
            `;
        }
        
        photoList.innerHTML = html;
    }
    
    chooseRemarkPhoto() {
        if (this.formData.remarkPhotos.length >= 3) {
            Utils.toast.error('最多上传3张图片');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
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
    
    // 🔧 显示工厂下拉列表
    showFactoryDropdown() {
        if (this.hideDropdownTimer) {
            clearTimeout(this.hideDropdownTimer);
            this.hideDropdownTimer = null;
        }
        
        // 如果没有搜索关键词，显示所有工厂
        const factorySearch = document.getElementById('factorySearch');
        const keyword = factorySearch ? factorySearch.value.trim() : '';
        
        if (!keyword) {
            this.filteredFactories = this.factories;
        }
        
        this.renderFactoryDropdown();
        
        const factoryDropdown = document.getElementById('factoryDropdown');
        if (factoryDropdown) {
            factoryDropdown.style.display = 'block';
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
    
    // 🔧 过滤工厂列表
    filterFactories(keyword) {
        if (!keyword) {
            this.filteredFactories = this.factories;
        } else {
            // 🎯 使用拼音搜索工具，对齐微信小程序的搜索体验
            this.filteredFactories = this.factories.filter(factory => {
                // 检查工厂名称（使用拼音搜索）
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
        const factory = this.factories.find(f => f.id == factoryId);
        if (!factory) return;
        
        const factorySearch = document.getElementById('factorySearch');
        const factoryIdInput = document.getElementById('factoryId');
        
        if (factorySearch) factorySearch.value = factory.name;
        if (factoryIdInput) factoryIdInput.value = factoryId;
        
        this.formData.factoryId = factoryId;
        this.formData.factoryName = factory.name;
        
        // 显示工厂信息
        this.showFactoryInfo(factory);
        
        // 加载工厂的工序
        this.loadFactoryProcesses(factoryId);
        
        // 加载工厂余额信息
        this.loadFactoryBalance(factoryId);
        
        // 隐藏下拉列表
        this.hideFactoryDropdown();
    }
    
    // 🔧 加载工厂的工序列表
    async loadFactoryProcesses(factoryId) {
        const processSelect = document.getElementById('processSelect');
        if (!processSelect) return;
        
        try {
            // 重置工序选择
            processSelect.innerHTML = '<option value="">加载中...</option>';
            
            // 获取工厂详情，包含工序信息
            const response = await API.get(`/factories/${factoryId}`);
            if (response.success && response.data) {
                const factory = response.data;
                const processes = factory.processes || [];
                
                if (processes.length > 0) {
                    const processOptions = processes.map(process => 
                        `<option value="${process.id || process.processId}">${process.name || process.processName}</option>`
                    ).join('');
                    processSelect.innerHTML = '<option value="">请选择工序</option>' + processOptions;
                } else {
                    processSelect.innerHTML = '<option value="">该工厂暂无可用工序</option>';
                }
            } else {
                processSelect.innerHTML = '<option value="">加载工序失败</option>';
            }
        } catch (error) {
            console.error('加载工厂工序失败:', error);
            processSelect.innerHTML = '<option value="">加载工序失败</option>';
        }
    }
    
    // 🔧 加载工厂余额信息
    async loadFactoryBalance(factoryId) {
        try {
            const response = await API.get(`/factories/${factoryId}/balance`);
            if (response.success && response.data) {
                const balance = response.data.balance || 0;
                const factoryBalance = document.getElementById('factoryBalance');
                if (factoryBalance) {
                    factoryBalance.textContent = `¥${balance.toFixed(2)}`;
                    factoryBalance.className = `factory-info-value factory-balance ${balance >= 0 ? 'positive' : 'negative'}`;
                }
                
                // 更新表单数据
                this.formData.factoryBalance = balance;
            }
        } catch (error) {
            console.error('加载工厂余额失败:', error);
            const factoryBalance = document.getElementById('factoryBalance');
            if (factoryBalance) {
                factoryBalance.textContent = '¥-';
                factoryBalance.className = 'factory-info-value factory-balance';
            }
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
            
            // 加载工厂余额信息
            this.loadFactoryBalance(factoryId);
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
        
        if (factoryInfo) {
            factoryInfo.style.display = 'block';
            
            if (factoryContact) factoryContact.textContent = factory.contact || '-';
            if (factoryPhone) factoryPhone.textContent = factory.phone || '-';
        }
    }
    
    hideFactoryInfo() {
        const factoryInfo = document.getElementById('factoryInfo');
        if (factoryInfo) {
            factoryInfo.style.display = 'none';
        }
    }
    
    onProcessChange(processId) {
        const process = this.processes.find(p => p.id === processId);
        if (process) {
            this.formData.processId = processId;
            this.formData.processName = process.name;
        } else {
            this.formData.processId = '';
            this.formData.processName = '';
        }
    }
    
    initNewOrder() {
        // 初始化新订单的默认值 - 对齐小程序端逻辑
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // 获取制单人：优先使用个人姓名，如果没有则使用登录工号 - 与小程序端完全一致
        // 🛡️ 使用安全的存储方式获取用户信息
        const realName = Utils.storage.get(CONFIG.STORAGE_KEYS.REAL_NAME) || '';
        const employeeName = Utils.storage.get(CONFIG.STORAGE_KEYS.EMPLOYEE_NAME) || '';
        const username = Utils.storage.get(CONFIG.STORAGE_KEYS.USERNAME) || '';
        // 优先级：realName > employeeName > username
        const currentStaff = realName || employeeName || username || '员工';
        
        // 当前业务日期 (YYYY-MM-DD for pickers)
        const currentDateForPicker = today;
        // 制单时间 display (YYYY-MM-DD HH:mm)
        const currentDateTimeForDisplay = this.formatDateTimeToMinute(now);
        
        this.formData.date = currentDateForPicker;
        this.formData.staff = currentStaff;
        this.formData.paymentMethod = '现金'; // 默认现金支付
        this.formData.paymentAmount = '';
        
        // 更新表单显示
        const orderDate = document.getElementById('orderDate');
        const staffInput = document.getElementById('staff');
        const staffDisplay = document.getElementById('staffDisplay');
        const dateTimeDisplay = document.getElementById('dateTimeDisplay');
        
        if (orderDate) orderDate.value = currentDateForPicker;
        if (staffInput) staffInput.value = currentStaff;
        if (staffDisplay) staffDisplay.textContent = `制单人：${currentStaff}`;
        if (dateTimeDisplay) {
            dateTimeDisplay.textContent = `制单时间：${currentDateTimeForDisplay}`;
        }
        
        console.log('[receive-order.js initNewOrder] Initial data set. date for display:', currentDateTimeForDisplay, 'currentDate for picker:', currentDateForPicker);
    }
    
    // 辅助方法：格式化日期时间为 YYYY-MM-DD HH:mm
    formatDateTimeToMinute(dateStringOrObject) {
        const d = dateStringOrObject instanceof Date ? dateStringOrObject : new Date(dateStringOrObject);
        if (isNaN(d.getTime())) {
            return '-';
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    }
    
    async loadOrderData() {
        if (!this.orderId) return;
        
        try {
            this.showSaveLoading();
            
            const response = await API.get(`/receive-orders/${this.orderId}`);
            
            if (response.success) {
                const order = response.data;
                
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
                    paymentMethod: order.paymentMethod || '现金',
                    paymentAmount: parseFloat(order.paymentAmount || 0),
                    totalQuantity: parseFloat(order.totalQuantity || 0),
                    totalWeight: parseFloat(order.totalWeight || 0),
                    totalAmount: parseFloat(order.totalAmount || order.fee || 0),
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
            this.hideSaveLoading();
        }
    }
    
    updateFormDisplay() {
        // 更新基础信息
        const orderNo = document.getElementById('orderNo');
        const orderDate = document.getElementById('orderDate');
        const factorySearch = document.getElementById('factorySearch');
        const factoryId = document.getElementById('factoryId');
        const processSelect = document.getElementById('processSelect');
        const staff = document.getElementById('staff');
        const remark = document.getElementById('remark');
        const paymentMethod = document.getElementById('paymentMethod');
        const paymentAmount = document.getElementById('paymentAmount');
        
        if (orderNo) orderNo.value = this.formData.orderNo;
        if (orderDate) orderDate.value = this.formData.date;
        if (factorySearch) factorySearch.value = this.formData.factoryName;
        if (factoryId) factoryId.value = this.formData.factoryId;
        if (processSelect) processSelect.value = this.formData.processId;
        if (staff) staff.value = this.formData.staff;
        if (remark) remark.value = this.formData.remark;
        if (paymentMethod) paymentMethod.value = this.formData.paymentMethod;
        if (paymentAmount) paymentAmount.value = this.formData.paymentAmount;
        
        // 触发工厂选择事件以显示工厂信息
        if (this.formData.factoryId) {
            this.onFactoryChange(this.formData.factoryId);
        }
        
        // 更新货品列表和总计
        this.renderProductsList();
        this.updateTotals();
        this.updateBalance();
        this.renderRemarkPhotos();
    }
}

// 全局管理器实例
let receiveOrderForm = null;

// 全局函数
function initReceiveOrderForm(mode = 'create', orderId = null) {
    receiveOrderForm = new ReceiveOrderForm(mode, orderId);
}

// 导出类
window.ReceiveOrderForm = ReceiveOrderForm; 