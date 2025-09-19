const api = require('../../utils/api'); // Assuming api is still needed at the top
const { formatDate } = require('../../utils/util');
const { getFullImageUrl } = require('../../utils/image'); // + 导入 getFullImageUrl
const { formatDateTimeToMinute } = require('../../utils/datetime'); // 从公共工具文件引入
const { searchMatch } = require('../../utils/pinyin'); // 引入拼音搜索工具
const request = require('../../utils/request');

Page({
  data: {
    mode: 'add', // add, edit, view
    orderId: '',
    orderNo: '',
    orderStatus: 'normal',
    factories: [],
    selectedFactory: null,
    processes: [], // 将硬编码的工序列表改为空数组
    selectedProcess: '',
    selectedProcessIndex: '',
    products: [],
    filteredProducts: [],
    selectedProducts: [],
    remark: '',
    remarkPhotos: [], // 新增: 备注图片数组
    totalWeight: 0,
    totalQuantity: 0,
    staff: '',
    date: '', // This 'date' will be used for "制单时间" display in YYYY-MM-DD HH:mm format
    showProductModal: false,
    productSearchKeyword: '',
    selectedProductTemp: null,
    selectedColorTemp: '',
    selectedSizeTemp: '',
    tempQuantity: '',
    tempWeight: '',
    currentDate: '', // This will store YYYY-MM-DD for date pickers or other business date logic
    // 新增分享相关数据
    canvasWidth: 375,    // 画布宽度，单位px
    canvasHeight: 500,   // 画布高度，初始值
    shareImagePath: '',  // 分享图片路径
    showShareModalFlag: false, // 是否显示分享弹窗
    tempColor: '',
    tempSize: '',
    productsLoading: false,
    productSearchValue: '',
    allAvailableColors: [],
    allAvailableSizes: [],
    // 新增工厂搜索相关
    factorySearchKeyword: '',
    filteredFactories: [],
    // 新增下拉式搜索相关
    showFactoryDropdown: false,
    hideDropdownTimer: null,
  },
  
  onLoad(options) {
    console.log('订单页面参数:', options);
    
    // 支持通过参数自动导出Excel（不改变UI，仅在带参数进入时生效）
    if (options && (options.action === 'exportExcel' || options.exportExcel === '1')) {
      this._autoExportExcel = true;
    }
    
    // Set current date for date pickers (YYYY-MM-DD)
    const now = new Date();
    const currentDateForPicker = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // Set creation/order date and time (YYYY-MM-DD HH:mm) for display
    const currentDateTimeForDisplay = formatDateTimeToMinute(now);
    
    // 获取制单人：优先使用个人姓名，如果没有则使用登录工号
    const realName = wx.getStorageSync('realName') || '';
    const employeeName = wx.getStorageSync('employeeName') || '';
    const username = wx.getStorageSync('username') || '';
    // 优先级：realName > employeeName > username
    const staffName = realName || employeeName || username || '员工';
    
    if (options.id) {
      // 编辑/查看模式
      this.setData({
        orderId: options.id,
        mode: options.mode || 'view',
        currentDate: currentDateForPicker // For date picker default if any
      });
      
      // 加载订单详情
      this.fetchOrderDetail(options.id);
    } else {
      // 新增模式
      this.setData({
        mode: 'add',
        date: currentDateTimeForDisplay, // For display: YYYY-MM-DD HH:mm
        currentDate: currentDateForPicker, // For date picker default: YYYY-MM-DD
        staff: staffName
      });
    }
    
    // 获取基础数据
    console.log('[onLoad] Calling fetchFactories'); // 添加日志
    this.fetchFactories();
    console.log('[onLoad] Calling fetchProducts'); // 添加日志
    this.fetchProducts();
    // 新增：获取所有可用的颜色和尺码数据
    console.log('[onLoad] Calling fetchAvailableColors'); // 添加日志
    this.fetchAvailableColors();
    console.log('[onLoad] Calling fetchAvailableSizes'); // 添加日志
    this.fetchAvailableSizes();
    
    // 监听事件通道，接收来自收发管理页面的分享请求
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('acceptDataFromOpenerPage', (data) => {
        if (data) {
          // 如果有传递shareImagePath，说明是从列表页面分享操作过来的
          if (data.shareImagePath && data.showShareModal) {
            this.setData({
              shareImagePath: data.shareImagePath,
              showShareModalFlag: true
            });
          }
        }
      });
    }
    /*
    // 防御性修正，确保关键数据结构类型正确，防止渲染崩溃
    this.setData({
      selectedProducts: Array.isArray(this.data.selectedProducts) ? this.data.selectedProducts : [],
      filteredProducts: Array.isArray(this.data.filteredProducts) ? this.data.filteredProducts : [],
      selectedProductTemp: this.data.selectedProductTemp || null
    });
    */
  },
  
  onReady() {
    // 根据当前模式设置标题
    const title = this.data.mode === 'view' ? '发出单' : (this.data.mode === 'edit' ? '编辑发出单' : '新增发出单');
    wx.setNavigationBarTitle({
      title: title
    });
  },

  onShow() {
    // 页面显示时更新制单人信息，确保使用最新的姓名
    if (this.data.mode === 'add') {
      const realName = wx.getStorageSync('realName') || '';
      const employeeName = wx.getStorageSync('employeeName') || '';
      const username = wx.getStorageSync('username') || '';
      const staffName = realName || employeeName || username || '员工';
      
      // 只有当制单人信息发生变化时才更新
      if (this.data.staff !== staffName) {
        this.setData({
          staff: staffName
        });
      }
    }
  },
  
  fetchFactories() {
    console.log('[fetchFactories] 开始获取工厂列表...');
    wx.showLoading({ title: '加载工厂列表...', mask: true });
    
    wx.cloud.callFunction({
      name: 'api',
      data: {
        action: 'getFactories'
      }
    })
      .then(result => {
        console.log('[fetchFactories] API调用成功');
        const factories = result.result && result.result.data ? result.result.data : [];
        console.log('[fetchFactories] 获取到工厂数量:', factories.length);
        
        // 过滤掉已停用的工厂（status = 'inactive'），只显示启用的工厂（status = 'active'）
        const enabledFactories = factories.filter(f => f.status === 'active');
        console.log('[fetchFactories] 过滤后启用的工厂数量:', enabledFactories.length);
        
        this.setData({ 
          factories: enabledFactories,
          filteredFactories: enabledFactories // 初始化过滤后的工厂列表
        });
        
        wx.hideLoading();
        console.log('[fetchFactories] 工厂数据初始化完成');
      })
      .catch(err => {
        console.error('[fetchFactories] API调用失败:', err);
        this.setData({ 
          factories: [],
          filteredFactories: [] // 同时清空过滤列表
        });
        wx.hideLoading();
        wx.showToast({ title: '获取工厂数据失败', icon: 'none' });
      });
  },
  
  async fetchProducts() {
    if (this.data.productsLoading) return;
    this.setData({ productsLoading: true });
    console.log('[fetchProducts] Starting product fetch...'); // 添加日志
    try {
      const result = await wx.cloud.callFunction({
        name: 'api',
        data: {
          action: 'getProducts'
          // 可以添加分页或搜索参数
          // search: this.data.productSearchValue 
        }
      });
      if (result.result && result.result.success && result.result.data) {
        // 过滤掉已停用的货品（status = 0），只显示启用的货品（status = 1）
        const enabledProducts = result.result.data.filter(p => p.status === 1);
        
        // 使用 getFullImageUrl 处理 image 字段
        const products = enabledProducts.map(p => ({
          ...p,
          image: getFullImageUrl(p.image) // 直接更新 image 字段
          // imageUrl 不再需要，相关的 setData 和 WXML 也应调整（下一步）
        }));
        console.log('[send-order.js fetchProducts] Processed products (enabled only):', products);
        console.log('[send-order.js fetchProducts] Filtered out disabled products, showing', products.length, 'enabled products');
        // 新增：打印每个货品的图片路径
        products.forEach(p => {
          console.log('[send-order.js fetchProducts] Product image path:', p.productNo, p.image);
        });
        this.setData({
          products: products,
          filteredProducts: products, // 初始时显示所有启用的产品
          productsLoading: false,
        });
      } else {
        this.setData({ products: [], filteredProducts: [], productsLoading: false });
        wx.hideLoading(); // 这个hideLoading可能在这里是不需要的，因为fetchProducts只控制productsLoading状态
        wx.showToast({ title: '获取货品列表失败', icon: 'none' });
      }
    } catch (error) {
      console.error('获取产品列表失败', error);
      this.setData({ products: [], filteredProducts: [], productsLoading: false });
      wx.hideLoading();
      wx.showToast({ title: '获取产品数据失败', icon: 'none' });
    }
  },
  
  /**
   * 获取发货单详情
   */
  fetchOrderDetail(orderId) {
    console.log('[fetchOrderDetail] Showing loading...'); // 添加日志
    wx.showLoading({ title: '获取订单数据', mask: true });
    
    api.getSendOrderDetail(orderId)
      .then(res => {
        console.log('[fetchOrderDetail] API success, hiding loading...'); // 添加日志
        wx.hideLoading();
        
        if (res.success && res.data) {
          const orderData = res.data;
          console.log('获取到的订单详情:', orderData);
          console.log('[fetchOrderDetail] 后端返回的remarkImages字段:', orderData.remarkImages);
          console.log('[fetchOrderDetail] remarkImages类型:', typeof orderData.remarkImages);
          
          // 确保状态值的正确转换
          let status = orderData.status;
          // 统一状态值：数字0或字符串'canceled'表示作废
          if (status === 'canceled' || status === 'cancelled' || status === 0 || status === '0') {
            status = 0;
          }

          let dateTimeForDisplay = '-';
          if (orderData.createdAt) {
            dateTimeForDisplay = formatDateTimeToMinute(orderData.createdAt);
          } else if (orderData.date) {
            dateTimeForDisplay = formatDateTimeToMinute(orderData.date);
          }

          let businessDateOnly = '-';
          if (orderData.date) {
            const dateObj = new Date(orderData.date);
            if (!isNaN(dateObj.getTime())) {
                businessDateOnly = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
            }
          }

          // 处理货品明细图片路径和SKU信息
          console.log('[fetchOrderDetail] Original items data structure:', typeof orderData.items, orderData.items); 
          console.log('[fetchOrderDetail] Original products data structure:', typeof orderData.products, orderData.products);
          
          let processedProducts = [];
          
          // 尝试处理items字段，这是后端 /api/orders/:id 接口返回的明细字段
          if (orderData.items && Array.isArray(orderData.items)) {
            console.log('[fetchOrderDetail] Processing items array...');
            processedProducts = orderData.items.map(item => {
              // 记录原始图片路径和SKU值
              console.log(`[fetchOrderDetail] 处理前的 item: ProductId=${item.productId}, Image=${item.image}, Color=${item.color}, ColorCode=${item.color_code}, Size=${item.size}, SizeCode=${item.size_code}`);
              
              // 确保所有必要字段存在并使用正确的字段名
              const productData = {
                ...item,
                id: item.productId || item.id || item.product_id || '', // 兼容多种ID字段
                productNo: item.productNo || item.code || item.product_no || '', // 兼容多种货号字段
                name: item.productName || item.name || '', // 兼容多种名称字段
                color: item.color || item.color_code || '', // 优先使用color，其次color_code
                size: item.size || item.size_code || '',   // 优先使用size，其次size_code
                quantity: parseFloat(item.quantity) || 0,
                weight: parseFloat(item.weight) || 0,
                // 处理图片URL，即使image字段为空，也传递空字符串给 getFullImageUrl
                image: getFullImageUrl(item.image || '')
              };
              
              console.log(`[fetchOrderDetail] Processed item: ID=${productData.id}, ProductNo=${productData.productNo}, Name=${productData.name}, Color=${productData.color}, Size=${productData.size}, Image=${productData.image}`);
              return productData;
            });
          } 
          // 如果items不存在或不是数组，尝试处理products字段 (兼容处理，虽然 /api/orders/:id 应该返回items)
          else if (orderData.products && Array.isArray(orderData.products)) {
            console.log('[fetchOrderDetail] Processing products array (fallback)...');
            processedProducts = orderData.products.map(item => {
               // 记录原始图片路径和SKU值
              console.log(`[fetchOrderDetail] 处理前的 product (fallback): ProductId=${item.productId}, Image=${item.image}, Color=${item.color}, ColorCode=${item.color_code}, Size=${item.size}, SizeCode=${item.size_code}`);
              
              const productData = {
                ...item,
                 id: item.productId || item.id || item.product_id || '', // 兼容多种ID字段
                productNo: item.productNo || item.code || item.product_no || '', // 兼容多种货号字段
                name: item.productName || item.name || '', // 兼容多种名称字段
                color: item.color || item.color_code || '', // 优先使用color，其次color_code
                size: item.size || item.size_code || '',   // 优先使用size，其次size_code
                quantity: parseFloat(item.quantity) || 0,
                weight: parseFloat(item.weight) || 0,
                // 处理图片URL
                image: getFullImageUrl(item.image || '')
              };
              
              console.log(`[fetchOrderDetail] Processed product (fallback): ID=${productData.id}, ProductNo=${productData.productNo}, Name=${productData.name}, Color=${productData.color}, Size=${productData.size}, Image=${productData.image}`);
              return productData;
            });
          }
          
          console.log('[fetchOrderDetail] Final processed products:', processedProducts);
          
          // 检查是否至少有一个货品的图片路径看起来有效（非空且不是默认图片路径）
          const hasValidImages = processedProducts.some(p => p.image && p.image !== '/images/default-product.png' && p.image !== getFullImageUrl(''));
          console.log('[fetchOrderDetail] 是否有有效图片URL (基于处理后数据):', hasValidImages);
          
          if (!hasValidImages && processedProducts.length > 0) {
            console.warn('[fetchOrderDetail] 警告: 所有货品图片路径无效或为空，可能需要检查图片URL处理逻辑或后端数据');
          }

          // 处理备注照片 - 确保转换为完整URL
          const processedRemarkImages = (orderData.remarkImages || []).map(img => {
            const fullUrl = getFullImageUrl(img);
            console.log('[fetchOrderDetail] 图片路径转换:', img, '->', fullUrl);
            return fullUrl;
          });
          console.log('[fetchOrderDetail] 处理后的remarkImages:', processedRemarkImages);

          const updateData = {
            orderId: orderData.id || '',
            orderNo: orderData.orderNo || '',
            selectedFactory: {
              id: orderData.factoryId || '',
              name: orderData.factoryName || ''
            },
            selectedProcess: typeof orderData.process === 'string' ? 
                           { id: orderData.processId || 0, name: orderData.process } : 
                           (orderData.process || { id: orderData.processId || 0, name: orderData.processName || '' }),
            selectedProcessIndex: '',
            selectedProducts: processedProducts, // 使用处理后的货品明细
            remark: orderData.remark || '',
            remarkPhotos: processedRemarkImages,
            remarkImages: processedRemarkImages, // 兼容字段
            totalWeight: orderData.totalWeight || 0,
            totalQuantity: orderData.totalQuantity || 0,
            staff: orderData.creator || orderData.staff || '', // 修正：优先用后端返回的creator
            date: dateTimeForDisplay,
            currentDate: businessDateOnly,
            orderStatus: status, // 使用统一转换后的状态值
            mode: 'view'  // 确保在查看模式下
          };

          // 仅在必要时更新 processes 列表
          if (this.data.mode !== 'view' || !this.data.processes.length) {
             // 在新增/编辑模式下，获取工厂详情以便选择工序
             // 在查看模式下，如果 processes 为空，也尝试加载一次
             if (orderData.factoryId) {
               this.getFactoryDetail(orderData.factoryId);
             }
          }

          this.setData(updateData, () => {
            // 在数据设置完成后强制更新视图
            console.log('setData complete, selectedProducts count:', this.data.selectedProducts.length);
            console.log('第一个货品信息:', this.data.selectedProducts.length > 0 ? JSON.stringify(this.data.selectedProducts[0], null, 2) : 'No products');
             // 触发一次视图更新 (可选，有时setData不足够)
            // this.forceUpdate(); // 如果有这个方法
            // 或者通过操作一个data属性来触发
            this.setData({ _tempRefresh: Math.random() }); // 添加一个临时属性强制更新

          });
          
          // 计算相关值
          this.calculateTotals();
          
          // 若通过参数要求自动导出，且当前为查看模式，则在数据就绪后触发导出
          if (this._autoExportExcel && this.data.mode === 'view') {
            this._autoExportExcel = false;
            this.exportExcel();
          }
        } else {
          console.error('获取订单详情失败:', res);
          wx.showToast({
            title: '获取订单数据失败',
            icon: 'none',
            duration: 2000
          });
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      })
      .catch(err => {
        console.error('[fetchOrderDetail] API failed, hiding loading...', err); // 添加日志
        wx.hideLoading();
        console.error('获取订单详情请求失败:', err); // 添加日志
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none',
          duration: 2000
        });
        
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      });
  },
  
  selectFactory(e) {
    const index = e.detail.value;
    const factory = this.data.factories[index];
    
    if (factory) {
      // 获取工厂详情并更新工序列表
      this.getFactoryDetail(factory.id);
    }
  },
  
  // 获取工厂详情，包括该工厂的工序列表
  getFactoryDetail(factoryId) {
    console.log('[getFactoryDetail] 尝试获取工厂详情, factoryId:', factoryId);
    wx.showLoading({ title: '获取工厂信息...', mask: true });
    
    const orgId = wx.getStorageSync('orgId');
    
    // 同时获取工厂详情和组织工序列表
    Promise.all([
      api.request(`/factories/${factoryId}`, 'GET', { orgId }),
      api.cloudFunctionRequest('/processes', 'GET', { orgId })
    ])
      .then(([factoryRes, processesRes]) => {
        wx.hideLoading();
        
        if (factoryRes.success && factoryRes.data) {
          const factoryData = factoryRes.data;
          const allProcesses = processesRes.data || [];
          
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
          
          // 根据工序名称匹配工序ID
          const processesList = factoryProcessNames
            .map(processName => {
              const matchedProcess = allProcesses.find(p => p.name === processName && p.status === 1);
              return matchedProcess ? { id: matchedProcess.id, name: matchedProcess.name } : { id: 0, name: processName };
            })
            .filter(p => p.name && p.name.replace(/[【】\[\]\s]/g, '').length > 0);
          
          console.log('处理后的工序列表:', processesList);
          
          // 选择初始工序
          let initialProcess = processesList.length > 0 ? processesList[0] : null;
          if (this.data.selectedProcess && typeof this.data.selectedProcess === 'object') {
            const matchingProcess = processesList.find(p => p.name === this.data.selectedProcess.name);
            if (matchingProcess) initialProcess = matchingProcess;
          }

          this.setData({
            selectedFactory: factoryData,
            processes: processesList,
            selectedProcess: initialProcess,
            selectedProcessIndex: 0
          });
        } else {
          console.error('获取工厂详情失败:', factoryRes);
          wx.showToast({ title: '获取工厂详情失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('[getFactoryDetail] 请求失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      });
  },
  
  selectProcess(e) {
    const index = e.detail.value;
    const process = this.data.processes[index];
    console.log('选择工序:', process, '索引:', index);
    
    this.setData({ 
      selectedProcess: process,
      selectedProcessIndex: index
    });
  },
  
  showProductSelect() {
    console.log('showProductSelect called');
    this.setData({
      showProductModal: true,
      filteredProducts: this.data.products,
      productSearchKeyword: '',
      selectedProductTemp: null,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: ''
    });
    console.log('showProductModal set to:', this.data.showProductModal);
  },

  hideProductSelect() {
    this.setData({
      showProductModal: false,
      productSearchKeyword: '',
      selectedProductTemp: null,
      selectedColorTemp: '',
      selectedSizeTemp: ''
    });
  },

  searchProducts(e) {
    const keyword = e.detail.value.toLowerCase();
    this.setData({
      productSearchKeyword: keyword
    });
    
    if (!keyword) {
      this.setData({
        filteredProducts: this.data.products
      });
      return;
    }
    
    const filtered = this.data.products.filter(product => 
      product.productNo.toLowerCase().includes(keyword) || 
      product.name.toLowerCase().includes(keyword)
    );
    
    this.setData({
      filteredProducts: filtered
    });
  },

  selectProduct(e) {
    const index = e.currentTarget.dataset.index;
    const product = { ...this.data.filteredProducts[index] }; // 使用扩展运算符创建副本

    // 确保 colorOptions 和 sizeOptions 是数组，并根据货品自身的 colors 和 sizes 字段生成
    // 添加更严格的检查和日志
    const rawColors = product.colors;
    const rawSizes = product.sizes;
    console.log(`[selectProductItem] 原始 colors: "${rawColors}", 原始 sizes: "${rawSizes}"`);

    let colorOptions = [];
    if (rawColors && typeof rawColors === 'string') {
      colorOptions = rawColors.split(',').map(item => item.trim()).filter(item => item !== '');
    }

    let sizeOptions = [];
    if (rawSizes && typeof rawSizes === 'string') {
      sizeOptions = rawSizes.split(',').map(item => item.trim()).filter(item => item !== '');
    }

    product.colorOptions = colorOptions;
    product.sizeOptions = sizeOptions;

    console.log('选择的产品 (处理后):', product);
    console.log('生成的 colorOptions:', product.colorOptions);
    console.log('生成的 sizeOptions:', product.sizeOptions);

    this.setData({
      selectedProductTemp: product,
      showProductModal: false, // 关闭货品选择列表弹窗
      // 初始化 tempColor 和 tempSize 为空字符串，让 picker 显示占位符
      tempColor: '', 
      tempSize: '',
      tempQuantity: '', // 清空临时数量
      tempWeight: '',   // 清空临时重量
      // 如果还有其他与确认弹窗相关的临时输入字段，也在此处一并重置
    });
    // 货品确认弹窗的显示由 WXML 中的 wx:if="{{selectedProductTemp}}" 控制
  },

  // 处理临时货品的数量输入
  bindTempQuantityInput(e) {
    this.setData({
      tempQuantity: e.detail.value
    });
  },

  // 处理临时货品的重量输入
  bindTempWeightInput(e) {
    this.setData({
      tempWeight: e.detail.value
    });
  },

  // 选择货品后添加到列表并继续添加同货号
  addSelectedProductAndContinue() {
    const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempColor, tempSize } = this.data;
    
    // 验证逻辑：当重量不为0时，允许颜色、尺码、数量为空
    const weight = parseFloat(tempWeight) || 0;
    if (weight <= 0) {
      // 如果重量为0，则检查必填项
      if (!selectedColorTemp && selectedProductTemp.colorOptions && selectedProductTemp.colorOptions.length > 0) {
        wx.showToast({
          title: '请选择颜色',
          icon: 'none'
        });
        return;
      }
      
      if (!selectedSizeTemp && selectedProductTemp.sizeOptions && selectedProductTemp.sizeOptions.length > 0) {
        wx.showToast({
          title: '请选择尺码',
          icon: 'none'
        });
        return;
      }
      
      if (!tempQuantity) {
        wx.showToast({
          title: '请输入数量',
          icon: 'none'
        });
        return;
      }
    }
    
    // 创建新货品对象
    const newProduct = {
      ...selectedProductTemp,
      color: tempColor || selectedColorTemp,
      size: tempSize || selectedSizeTemp,
      quantity: tempQuantity || '0',
      weight: tempWeight || '0'
    };
    
    // 添加到货品列表
    const selectedProducts = [...this.data.selectedProducts, newProduct];
    
    this.setData({
      selectedProducts,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: '',
      tempColor: '',
      tempSize: ''
    });
    
    // 重新计算总计
    this.calculateTotals();
    
    // 显示添加成功提示
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  // 添加确认添加货品的函数
  addSelectedProduct() {
    const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempColor, tempSize } = this.data;
    
    // 验证逻辑：当重量不为0时，允许颜色、尺码、数量为空
    const weight = parseFloat(tempWeight) || 0;
    if (weight <= 0) {
      // 如果重量为0，则检查必填项
      if (!selectedColorTemp && selectedProductTemp.colorOptions && selectedProductTemp.colorOptions.length > 0) {
        wx.showToast({
          title: '请选择颜色',
          icon: 'none'
        });
        return;
      }
      
      if (!selectedSizeTemp && selectedProductTemp.sizeOptions && selectedProductTemp.sizeOptions.length > 0) {
        wx.showToast({
          title: '请选择尺码',
          icon: 'none'
        });
        return;
      }
      
      if (!tempQuantity) {
        wx.showToast({
          title: '请输入数量',
          icon: 'none'
        });
        return;
      }
    }
    
    // 创建新货品对象
    const newProduct = {
      ...selectedProductTemp,
      color: tempColor || selectedColorTemp,
      size: tempSize || selectedSizeTemp,
      quantity: tempQuantity || '0',
      weight: tempWeight || '0'
    };
    
    // 添加到货品列表
    const selectedProducts = [...this.data.selectedProducts, newProduct];
    
    this.setData({
      selectedProducts,
      selectedProductTemp: null,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: '',
      tempColor: '',
      tempSize: ''
    });
    
    // 重新计算总计
    this.calculateTotals();
    
    // 隐藏弹窗
    this.hideProductSelect();
    
    // 显示添加成功提示
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  addSameProduct(e) {
    const index = e.currentTarget.dataset.index;
    const product = this.data.selectedProducts[index];
    
    this.setData({
      selectedProductTemp: {
        id: product.id,
        productNo: product.productNo,
        name: product.name,
        productCode: product.productCode,
        image: product.image, // 只用 image 字段
        colorOptions: Array.isArray(product.colorOptions) ? product.colorOptions : [],
        sizeOptions: Array.isArray(product.sizeOptions) ? product.sizeOptions : []
      },
      selectedColorTemp: '', // 不设置默认颜色
      selectedSizeTemp: '', // 不设置默认尺码
      tempQuantity: '', // 确保数量为空
      tempWeight: '' // 确保重量为空
    });
  },

  bindColorChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== undefined) {
      const products = this.data.selectedProducts;
      products[index].color = products[index].colorOptions[e.detail.value];
      this.setData({
        selectedProducts: products
      });
    } else {
      this.setData({
        selectedColorTemp: this.data.selectedProductTemp.colorOptions[e.detail.value]
      });
    }
  },

  bindSizeChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index !== undefined) {
      const products = this.data.selectedProducts;
      products[index].size = products[index].sizeOptions[e.detail.value];
      this.setData({
        selectedProducts: products
      });
    } else {
      this.setData({
        selectedSizeTemp: this.data.selectedProductTemp.sizeOptions[e.detail.value]
      });
    }
  },

  bindQuantityInput(e) {
    const index = e.currentTarget.dataset.index;
    const products = this.data.selectedProducts;
    products[index].quantity = parseFloat(e.detail.value) || 0;
    this.setData({
      selectedProducts: products
    });
    this.calculateTotals();
  },

  bindWeightInput(e) {
    const index = e.currentTarget.dataset.index;
    const products = this.data.selectedProducts;
    products[index].weight = parseFloat(e.detail.value) || 0;
    this.setData({
      selectedProducts: products
    });
    this.calculateTotals();
  },

  deleteProduct(e) {
    const index = e.currentTarget.dataset.index;
    const products = this.data.selectedProducts;
    products.splice(index, 1);
    this.setData({
      selectedProducts: products
    });
    this.calculateTotals();
  },

  inputRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  calculateTotals() {
    let totalQuantity = 0;
    let totalWeight = 0;
    
    if (this.data.selectedProducts && this.data.selectedProducts.length > 0) {
      this.data.selectedProducts.forEach(product => {
        totalQuantity += parseFloat(product.quantity) || 0;
        totalWeight += parseFloat(product.weight) || 0;
      });
    }
    
    this.setData({
      totalQuantity: totalQuantity,
      totalWeight: totalWeight.toFixed(2)
    });
  },
  
  validateForm() {
    const { selectedFactory, selectedProcess, selectedProducts } = this.data;
    
    if (!selectedFactory) {
      wx.showToast({ title: '请选择工厂', icon: 'none' });
      return false;
    }
    
    if (!selectedProcess) {
      wx.showToast({ title: '请选择工序', icon: 'none' });
      return false;
    }
    
    if (selectedProducts.length === 0) {
      wx.showToast({ title: '请添加货品', icon: 'none' });
      return false;
    }
    
    // 检查货品信息是否完整
    for (let i = 0; i < selectedProducts.length; i++) {
      const product = selectedProducts[i];
      const weight = parseFloat(product.weight) || 0;
      
      // 当重量为0时，才检查颜色、尺码、数量
      if (weight <= 0) {
        if (!product.color && product.colorOptions && product.colorOptions.length > 0) {
          wx.showToast({ title: `请选择第${i+1}个货品的颜色`, icon: 'none' });
          return false;
        }
        if (!product.size && product.sizeOptions && product.sizeOptions.length > 0) {
          wx.showToast({ title: `请选择第${i+1}个货品的尺码`, icon: 'none' });
          return false;
        }
        if (product.quantity <= 0) {
          wx.showToast({ title: `请输入第${i+1}个货品的数量`, icon: 'none' });
          return false;
        }
      }
    }
    
    return true;
  },
  
  submitOrder() {
    if (!this.validateForm()) return;
    
    console.log('开始提交发出单...');
    wx.showLoading({ title: '保存中...' });
    
    // 1. 组装明细字段，全部下划线风格，确保 product_id、product_no 来源准确
    const orderItems = this.data.selectedProducts.map(p => ({
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
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      wx.hideLoading();
      wx.showToast({ title: '组织信息缺失，请重新登录', icon: 'none' });
      return;
    }
    
    const orderMain = {
      orgId: orgId,
      factoryId: this.data.selectedFactory ? this.data.selectedFactory.id : '',
      // 从selectedProcess对象中获取processId
      processId: this.data.selectedProcess && this.data.selectedProcess.id ? this.data.selectedProcess.id : 0,
      // 传递工序名称，确保后端能正确显示
      process: this.data.selectedProcess ? this.data.selectedProcess.name || this.data.selectedProcess : '',
      totalWeight: this.data.totalWeight,
      totalQuantity: this.data.totalQuantity,
      totalFee: orderItems.reduce((sum, item) => sum + (item.fee || 0), 0), // 自动合计
      remark: this.data.remark,
      remarkImages: this.data.remarkPhotos || [], // 添加备注照片
      status: 1,
      items: orderItems
    };
    // 如需自定义制单时间
    // orderMain.created_at = this.data.date ? (this.data.date + ':00') : undefined;
    
    console.log('即将提交的发出单数据 (主表+明细):', JSON.stringify(orderMain, null, 2));
    api.addSendOrder(orderMain)
      .then(res => {
        wx.hideLoading();
        if (res.success && res.id) {
          wx.showToast({ title: '保存成功', icon: 'success', mask: true });
          wx.setStorageSync('hasNewOrder', true);
          wx.navigateBack();
        } else {
          wx.showToast({ title: res.message || '保存失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        wx.showToast({ title: err.message || '保存失败', icon: 'none' });
        console.error('发出单提交失败:', err);
      });
  },
  
  cancelOrder() {
    if (!this.data.orderId) {
      wx.showToast({ title: '订单ID不存在', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认作废',
      content: '确定要作废此订单吗？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '作废中...' });
          wx.cloud.callFunction({
            name: 'api',
            data: {
              action: 'deleteOrder',
              orderId: this.data.orderId
            }
          })
            .then(result => {
              wx.hideLoading();
              if (result.result && result.result.success) {
                wx.showToast({ title: '订单已作废', icon: 'success' });
                // 修改状态值为数字0
                this.setData({ 
                  orderStatus: 0,  // 确保使用数字0
                  mode: 'view'     // 确保切换到查看模式
                });
                // 设置首页数据刷新标志
                wx.setStorageSync('refreshHomeData', true);
                // 延迟返回
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
              } else {
                wx.showToast({ title: cancelRes.message || '作废失败', icon: 'none' });
              }
            })
            .catch(err => {
              wx.hideLoading();
              console.error('作废订单API调用失败:', err);
              wx.showToast({ title: '作废失败，请重试', icon: 'none' });
            });
        }
      }
    });
  },
  
  navigateBack() {
    wx.navigateBack();
  },

  // 输入订单编号
  bindOrderNoInput(e) {
    this.setData({ orderNo: e.detail.value });
  },

  // 选择备注照片
  chooseRemarkPhoto() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        // 限制最多3张图片
        if (that.data.remarkPhotos.length >= 3) {
          wx.showToast({
            title: '最多上传3张照片',
            icon: 'none'
          });
          return;
        }
        
        const tempFilePath = res.tempFilePaths[0];
        
        // 显示上传中
        wx.showLoading({
          title: '上传中...',
        });
        
        // 调用真实的上传API
        api.uploadFile('/upload', tempFilePath)
          .then(uploadRes => {
            wx.hideLoading();
            console.log('[chooseRemarkPhoto] 上传成功:', uploadRes);
            
            if (uploadRes.success && uploadRes.data && uploadRes.data.filePath) {
              const remarkPhotos = [...that.data.remarkPhotos, uploadRes.data.filePath];
              that.setData({
                remarkPhotos
              });
              wx.showToast({
                title: '上传成功',
                icon: 'success'
              });
            } else {
              console.error('[chooseRemarkPhoto] 上传返回格式异常:', uploadRes);
              wx.showToast({
                title: '上传失败，请重试',
                icon: 'none'
              });
            }
          })
          .catch(err => {
            wx.hideLoading();
            console.error('[chooseRemarkPhoto] 上传失败:', err);
            wx.showToast({
              title: err.error || '上传失败，请重试',
              icon: 'none'
            });
          });
      }
    });
  },
  
  // 删除备注照片
  deleteRemarkPhoto(e) {
    const index = e.currentTarget.dataset.index;
    const remarkPhotos = [...this.data.remarkPhotos];
    remarkPhotos.splice(index, 1);
    this.setData({
      remarkPhotos
    });
  },
  
  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    const urls = e.currentTarget.dataset.urls;
    wx.previewImage({
      current,
      urls
    });
  },

  // 预览备注照片
  previewRemarkImage(e) {
    const index = e.currentTarget.dataset.index;
    const imageUrls = this.data.remarkImages || [];
    if (imageUrls.length > 0) {
      wx.previewImage({
        current: imageUrls[index],
        urls: imageUrls
      });
    } else {
      wx.showToast({
        title: '没有可预览的照片',
        icon: 'none'
      });
    }
  },

  // 新增函数: 生成分享图片
  generateShareImage(orderData) {
    // 兼容所有明细字段，补全 productNo 和 name 字段，保证分享图片显示
    if (orderData.products && Array.isArray(orderData.products)) {
      orderData.products = orderData.products.map(item => {
        // 货号兼容
        let productNo = item.productNo || item.code || item.productCode || item.product_no || item.sn || '';
        // 名称兼容
        let name = item.name || item.productName || '';
        return {
          ...item,
          productNo,
          name
        };
      });
      console.log('[generateShareImage] Processed products for drawing:', orderData.products); // 添加日志
    }
    const that = this;
    console.log('[generateShareImage] Showing loading...'); // 添加日志
    wx.showLoading({ title: '正在生成图片...' });

    // 动态计算画布高度（适应新的现代化设计）
    const headerHeight = 350;  // 标题、工厂信息、基本信息区域
    const tableHeaderHeight = 80; // 表格头部
    const productRowHeight = 100; // 每个货品的行高（增加以适应双行显示）
    const productsHeight = Math.max(orderData.products.length, 1) * productRowHeight; // 至少显示一行
    const summaryHeight = 140;  // 合计信息区域
    const remarkHeight = orderData.remark ? 120 : 0; // 备注区域（如果有）
    const footerHeight = 140;  // 底部信息区域
    const calculatedHeight = headerHeight + tableHeaderHeight + productsHeight + summaryHeight + remarkHeight + footerHeight;
    
    this.setData({
      canvasHeight: calculatedHeight
    });
    
    // 获取canvas上下文
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = that.data.canvasWidth;
        canvas.height = that.data.canvasHeight;
        
        // 开始绘制
        that.drawOrderImage(ctx, canvas.width, canvas.height, orderData);
        
        // 将canvas内容转为图片
        wx.canvasToTempFilePath({
          canvas: canvas,
          success: function(res) {
            wx.hideLoading();
            // 保存图片路径并显示分享弹窗，不自动保存到相册
            that.setData({
              shareImagePath: res.tempFilePath,
              showShareModalFlag: true
            });
          },
          fail: function(err) {
            console.error('canvas转图片失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '生成图片失败',
              icon: 'none'
            });
          }
        }, this);
      });
  },
  
  // 新增函数: 绘制订单图片
  drawOrderImage(ctx, canvasWidth, canvasHeight, orderData) {
    // 设置背景色为纯白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 定义现代化设计的颜色和字体
    const colors = {
      primary: '#1d1d1f',        // 主要文字颜色
      secondary: '#8e8e93',      // 次要文字颜色
      accent: '#007aff',         // 强调色（蓝色）
      success: '#34c759',        // 成功色（绿色）
      warning: '#ff9500',        // 警告色（橙色）
      background: '#f5f7fa',     // 背景色
      border: '#e5e5ea',         // 边框色
      headerBg: '#f0f4f8',       // 表头背景色
      rowBg: '#fafbfc'           // 行背景色
    };
    
    const fonts = {
      title: 'bold 48px -apple-system, SF Pro Display, PingFang SC, Helvetica Neue',
      subtitle: 'bold 36px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue',
      header: '32px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue',
      body: '28px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue',
      small: '24px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue',
      caption: '20px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue'
    };
    
    const margin = 60;
    let currentY = margin;
    
    // 获取公司名称
    let companyName = '我的公司';
    try {
      const storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo && typeof storedUserInfo === 'object' && storedUserInfo.companyName) {
        companyName = storedUserInfo.companyName;
      } else {
        const directCompanyName = wx.getStorageSync('companyName');
        if (directCompanyName && typeof directCompanyName === 'string') {
          companyName = directCompanyName;
        }
      }
    } catch (e) {
      console.error('获取公司名称失败:', e);
    }
    
    // 1. 绘制专业化标题区域
    ctx.fillStyle = colors.background;
    ctx.fillRect(margin, currentY, canvasWidth - margin * 2, 120);
    
    // 绘制标题
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.title;
    ctx.textAlign = 'center';
    const title = `${companyName} | ${orderData.process || '加工'} | 发出单`;
    currentY += 70;
    ctx.fillText(title, canvasWidth / 2, currentY);
    
    // 2. 绘制工厂信息区域
    currentY += 80;
    ctx.fillStyle = colors.accent;
    ctx.font = fonts.subtitle;
    ctx.textAlign = 'left';
    ctx.fillText(orderData.factoryName || '工厂名称', margin, currentY);
    
    // 添加分隔线
    currentY += 50;
    ctx.fillStyle = colors.border;
    ctx.fillRect(margin, currentY, canvasWidth - margin * 2, 2);
    
    // 3. 绘制基本信息区域
    currentY += 60;
    ctx.fillStyle = colors.secondary;
    ctx.font = fonts.header;
    ctx.textAlign = 'left';
    
    // 单号和日期并排显示
    ctx.fillText(`单号: ${orderData.orderNo}`, margin, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(`日期: ${orderData.date}`, canvasWidth - margin, currentY);
    
    // 4. 绘制现代化表格
    currentY += 80;
    const tableWidth = canvasWidth - margin * 2;
    const headerHeight = 80;
    const rowHeight = 100;
    
    // 表头背景
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(margin, currentY, tableWidth, headerHeight);
    
    // 表头边框
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, currentY, tableWidth, headerHeight);
    
    // 表头文字
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.header;
    ctx.textAlign = 'center';
    
    // 定义列宽比例
    const colWidths = [0.35, 0.2, 0.15, 0.15, 0.15]; // 货品、颜色、尺码、数量、重量
    const colHeaders = ['货品信息', '颜色', '尺码', '数量', '重量(kg)'];
    
    let colX = margin;
    colHeaders.forEach((header, index) => {
      const colWidth = tableWidth * colWidths[index];
      ctx.fillText(header, colX + colWidth / 2, currentY + headerHeight / 2 + 8);
      
      // 绘制列分隔线
      if (index < colHeaders.length - 1) {
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colX + colWidth, currentY);
        ctx.lineTo(colX + colWidth, currentY + headerHeight);
        ctx.stroke();
      }
      
      colX += colWidth;
    });
    
    currentY += headerHeight;
    
    // 5. 绘制货品数据行
    const products = orderData.products || [];
    
    products.forEach((product, index) => {
      // 交替行背景色
      ctx.fillStyle = index % 2 === 0 ? '#ffffff' : colors.rowBg;
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      
      // 行边框
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      // 绘制数据
      colX = margin;
      
      // 货品信息列（货号 + 名称）
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.body;
      ctx.textAlign = 'left';
      
      let productText = '';
      if (product.productNo && product.name) {
        productText = `${product.productNo}\n${product.name}`;
      } else if (product.productNo) {
        productText = product.productNo;
      } else if (product.name) {
        productText = product.name;
      } else {
        productText = '-';
      }
      
      const lines = productText.split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, colX + 20, currentY + 35 + (i * 35));
      });
      
      colX += tableWidth * colWidths[0];
      
      // 其他列居中显示
      ctx.textAlign = 'center';
      
      // 颜色列
      ctx.fillStyle = colors.secondary;
      ctx.fillText(product.color || '-', colX + tableWidth * colWidths[1] / 2, currentY + rowHeight / 2 + 8);
      colX += tableWidth * colWidths[1];
      
      // 尺码列
      ctx.fillText(product.size || '-', colX + tableWidth * colWidths[2] / 2, currentY + rowHeight / 2 + 8);
      colX += tableWidth * colWidths[2];
      
      // 数量列（使用强调色）
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold ' + fonts.body;
      ctx.fillText((product.quantity || '-') + '打', colX + tableWidth * colWidths[3] / 2, currentY + rowHeight / 2 + 8);
      colX += tableWidth * colWidths[3];
      
      // 重量列（使用成功色）
      ctx.fillStyle = colors.success;
      ctx.fillText(product.weight || '-', colX + tableWidth * colWidths[4] / 2, currentY + rowHeight / 2 + 8);
      
      // 绘制列分隔线
      colX = margin;
      colWidths.forEach((width, i) => {
        if (i < colWidths.length - 1) {
          ctx.strokeStyle = colors.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(colX + tableWidth * width, currentY);
          ctx.lineTo(colX + tableWidth * width, currentY + rowHeight);
          ctx.stroke();
        }
        colX += tableWidth * width;
      });
      
      currentY += rowHeight;
    });
    
    // 如果没有货品数据，显示提示
    if (products.length === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.secondary;
      ctx.font = fonts.body;
      ctx.textAlign = 'center';
      ctx.fillText('暂无货品数据', canvasWidth / 2, currentY + rowHeight / 2 + 8);
      currentY += rowHeight;
    }
    
    // 6. 绘制合计信息区域
    currentY += 40;
    ctx.fillStyle = colors.background;
    ctx.fillRect(margin, currentY, tableWidth, 100);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, currentY, tableWidth, 100);
    
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.subtitle;
    ctx.textAlign = 'left';
    ctx.fillText('合计:', margin + 40, currentY + 65);
    
    // 总数量和总重量右对齐
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.accent;
    ctx.fillText(`总数量: ${orderData.totalQuantity || 0}打`, canvasWidth - margin - 200, currentY + 40);
    ctx.fillStyle = colors.success;
    ctx.fillText(`总重量: ${orderData.totalWeight || 0}kg`, canvasWidth - margin - 40, currentY + 40);
    
    // 7. 绘制备注区域（如果有备注）
    if (orderData.remark) {
      currentY += 140;
      ctx.fillStyle = colors.background;
      ctx.fillRect(margin, currentY, tableWidth, 80);
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(margin, currentY, tableWidth, 80);
      
      ctx.fillStyle = colors.secondary;
      ctx.font = fonts.header;
      ctx.textAlign = 'left';
      ctx.fillText(`备注: ${orderData.remark}`, margin + 40, currentY + 50);
      currentY += 80;
    }
    
    // 8. 绘制底部信息区域
    const footerY = canvasHeight - 100;
    
    // 底部分隔线
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 20);
    ctx.lineTo(canvasWidth - margin, footerY - 20);
    ctx.stroke();
    
    // 底部信息
    ctx.fillStyle = colors.secondary;
    ctx.font = fonts.small;
    ctx.textAlign = 'left';
    ctx.fillText(`制单人: ${orderData.staff || '-'}`, margin, footerY);
    
    ctx.textAlign = 'right';
    const createTime = orderData.originalCreatedAt || orderData.createdAt || new Date();
    const timeStr = typeof createTime === 'string' ? createTime : createTime.toLocaleString();
    ctx.fillText(`制单时间: ${timeStr}`, canvasWidth - margin, footerY);
    
    // 系统标识
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.caption;
    ctx.font = fonts.caption;
    ctx.fillText('云收发管理系统', canvasWidth / 2, footerY + 40);
  },
  
  // 新增函数: 隐藏分享弹窗
  hideShareModal() {
    this.setData({
      showShareModalFlag: false
    });
    
    // 隐藏弹窗后返回上一页
    wx.navigateBack();
  },
  
  // 新增函数: 配置分享功能
  onShareAppMessage: function(res) {
    // 来自分享按钮的分享
    if (res.from === 'button' && this.data.shareImagePath) {
      return {
        title: `发出单: ${this.data.orderNo}`,
        path: `/pages/send-order/send-order?id=${this.data.orderId}&mode=view`,
        imageUrl: this.data.shareImagePath
      };
    }
    
    // 来自右上角菜单的分享
    return {
      title: '发出单',
      path: '/pages/send-receive/send-receive'
    };
  },

  // 保存图片到相册
  saveImageToAlbum() {
    const that = this;
    
    // 显示确认对话框
    wx.showModal({
      title: '保存图片',
      content: '是否保存发出单图片到手机相册？',
      confirmText: '保存',
      cancelText: '取消',
      success(res) {
        if (res.confirm) {
          wx.showLoading({ title: '保存中...' });
          
          wx.saveImageToPhotosAlbum({
            filePath: that.data.shareImagePath,
            success: function(res) {
              wx.hideLoading();
              wx.showToast({
                title: '已保存到相册',
                icon: 'success',
                duration: 1500
              });
            },
            fail: function(err) {
              console.error('保存到相册失败:', err);
              wx.hideLoading();
              
              if (err.errMsg.indexOf('auth deny') >= 0 || err.errMsg.indexOf('authorize') >= 0) {
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存图片到相册',
                  confirmText: '去设置',
                  success(res) {
                    if (res.confirm) {
                      wx.openSetting();
                    }
                  }
                });
              } else {
                wx.showModal({
                  title: '保存失败',
                  content: '图片保存失败，请重试',
                  showCancel: false
                });
              }
            }
          });
        }
      }
    });
  },

  // 导出Excel（发出单）
  exportExcel() {
    const orderId = this.data.orderId;
    const orderNo = this.data.orderNo || orderId || '';
    const selectedFactory = this.data.selectedFactory || {};
    const selectedProcess = this.data.selectedProcess || {};
    const items = Array.isArray(this.data.selectedProducts) ? this.data.selectedProducts : [];
  
    if (!orderId || !selectedFactory || !selectedFactory.id) {
      wx.showToast({ title: '订单数据不完整', icon: 'none' });
      return;
    }
  
    const totalQuantity = items.reduce((sum, it) => sum + (parseInt(it.quantity, 10) || 0), 0);
    const totalWeight = items.reduce((sum, it) => sum + (parseFloat(it.weight) || 0), 0);
    const totalAmount = 0;
    const paidAmount = 0;
    const dateStr = (this.data.currentDate && typeof this.data.currentDate === 'string' && this.data.currentDate !== '-')
      ? this.data.currentDate
      : ((this.data.date && this.data.date.split) ? this.data.date.split(' ')[0] : '');

    const processStr = (typeof selectedProcess === 'object')
      ? (selectedProcess.name || '')
      : (typeof selectedProcess === 'string' ? selectedProcess : '');
  
    wx.showLoading({ title: '正在准备分享...' });
  
    try {
      const orderDetails = (items.length > 0 ? items : [null]).map((it, idx) => {
        const quantity = it ? parseFloat(it.quantity || 0) : totalQuantity;
        const weight = it ? parseFloat(it.weight || 0) : totalWeight;
        const unitPrice = 0;
        const rowAmount = 0;
        return {
          type: '发出',
          orderNo: orderNo,
          date: dateStr,
          process: processStr,
          quantity: isNaN(quantity) ? 0 : parseInt(quantity, 10),
          weight: isNaN(weight) ? 0 : parseFloat(weight.toFixed(2)),
          unitPrice: 0,
          totalAmount: 0,
          paymentAmount: idx === 0 ? parseFloat(paidAmount.toFixed(2)) : '',
          paymentMethod: '',
          remark: this.data.remark || ''
        };
      });
  
      const excelData = {
        basicInfo: {
          companyName: wx.getStorageSync('companyName') || '公司',
          factoryName: selectedFactory.name || '',
          dateRange: dateStr,
          generateTime: new Date().toLocaleString(),
          totalRecords: orderDetails.length
        },
        summary: {
          sendSummary: {
            title: '发出单摘要',
            orderCount: 1,
            quantity: totalQuantity,
            weight: totalWeight.toFixed(2)
          },
          receiveSummary: {
            title: '收回单摘要',
            orderCount: 0,
            quantity: 0,
            weight: '0.00'
          },
          lossSummary: {
            title: '损耗情况',
            productTypes: items.length || 0,
            lossWeight: '0.00',
            lossRate: '0.00%'
          },
          financialSummary: {
            title: '财务汇总',
            totalPayment: paidAmount.toFixed(2),
            finalBalance: (totalAmount - paidAmount).toFixed(2)
          }
        },
        productSummary: [],
        paymentSummary: {
          totalAmount: totalAmount.toFixed(2),
          totalPayment: paidAmount.toFixed(2),
          finalBalance: (totalAmount - paidAmount).toFixed(2)
        },
        paymentRecords: [],
        orderDetails
      };
  
      request.post('/export/excel', excelData)
        .then((res) => {
          if (res && res.filePath) {
            wx.hideLoading();
            this.shareExcelFileDirectly(res.filePath);
            return;
          }
  
          if (res && res.success && res.data && res.data.downloadUrl) {
            const downloadUrl = res.data.downloadUrl;
            wx.downloadFile({
              url: downloadUrl,
              header: { 'X-App-Authorization': `Bearer ${wx.getStorageSync('token')}` }, // 使用自定义头避免被 CloudBase 网关拦截
              success: (downloadRes) => {
                wx.hideLoading();
                if (downloadRes.statusCode === 200) {
                  this.shareExcelFileDirectly(downloadRes.tempFilePath);
                } else {
                  console.error('文件下载失败，状态码:', downloadRes.statusCode);
                  wx.showToast({ title: '文件准备失败，请重试', icon: 'none' });
                }
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('下载失败详情:', err);
                wx.showToast({ title: '网络异常，分享失败', icon: 'none' });
              }
            });
            return;
          }
  
          wx.hideLoading();
          if (res && res.message) {
            wx.showToast({ title: res.message, icon: 'none' });
          } else {
            wx.showToast({ title: '生成失败，请重试', icon: 'none' });
          }
        })
        .catch((error) => {
          wx.hideLoading();
          console.error('Excel导出失败:', error);
          const msg = (error && error.getUserMessage && error.getUserMessage()) || (error && error.message) || '网络异常，请检查网络连接';
          wx.showToast({ title: msg, icon: 'none' });
        });
    } catch (e) {
      wx.hideLoading();
      console.error('构建导出数据失败:', e);
      wx.showToast({ title: '数据处理失败，请重试', icon: 'none' });
    }
  },
  
  // 直接分享Excel文件
  shareExcelFileDirectly(filePath) {
    const fileName = this.generateExcelFileName();
    wx.shareFileMessage({
      filePath,
      fileName,
      success: () => {
        wx.showToast({ title: '表格分享成功', icon: 'success', duration: 2000 });
      },
      fail: (shareErr) => {
        console.log('微信分享失败，提供备选方案:', shareErr);
        wx.showModal({
          title: '分享方式选择',
          content: '微信分享失败，请选择其他方式：',
          cancelText: '打开表格',
          confirmText: '保存到本地',
          success: () => {
            this.openExcelDocument(filePath);
          },
          fail: () => {
            this.openExcelDocument(filePath);
          }
        });
      }
    });
  },
  
  // 打开Excel文档
  openExcelDocument(filePath) {
    wx.openDocument({
      filePath,
      fileType: 'xlsx',
      success: () => {
        wx.showToast({ title: '表格已打开', icon: 'success', duration: 2000 });
      },
      fail: (openErr) => {
        console.log('打开文档失败:', openErr);
        wx.showToast({ title: '表格已生成，请在文件管理中查看', icon: 'success', duration: 3000 });
      }
    });
  },
  
  // 生成文件名
  generateExcelFileName() {
    const factoryName = (this.data.selectedFactory && this.data.selectedFactory.name) || '工厂';
    const orderNo = this.data.orderNo || this.data.orderId || '';
    const ts = Date.now().toString().slice(-6);
    return `${factoryName}_发出单_${orderNo}_${ts}.xlsx`;
  },

  bindTempColorPicker(e) {
    const { selectedProductTemp } = this.data;
    const color = selectedProductTemp.colorOptions ? selectedProductTemp.colorOptions[e.detail.value] : '';
    this.setData({ tempColor: color });
  },
  bindTempSizePicker(e) {
    const { selectedProductTemp } = this.data;
    const size = selectedProductTemp.sizeOptions ? selectedProductTemp.sizeOptions[e.detail.value] : '';
    this.setData({ tempSize: size });
  },

  // 产品选择弹窗中的搜索功能
  onProductSearchInput(e) {
    const searchValue = e.detail.value.toLowerCase();
    const filtered = this.data.products.filter(p => {
      const nameMatch = p.name && p.name.toLowerCase().includes(searchValue);
      const codeMatch = p.code && p.code.toLowerCase().includes(searchValue);
      const productNoMatch = p.productNo && p.productNo.toLowerCase().includes(searchValue);
      return nameMatch || codeMatch || productNoMatch;
    });
    this.setData({ 
      productSearchValue: e.detail.value, // 更新搜索框的值
      filteredProducts: filtered 
    });
  },
  
  // 清除产品搜索
  clearProductSearch() {
    this.setData({
      productSearchValue: '',
      filteredProducts: this.data.products // 重置为显示所有产品
    });
  },

  // 新增：获取所有可用的颜色数据
  fetchAvailableColors: function() {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchAvailableColors] 组织ID缺失');
      this.setData({ allAvailableColors: [] });
      return;
    }
    
    api.cloudFunctionRequest('/colors', 'GET', { orgId })
      .then(res => {
        let colorList = [];
        if (Array.isArray(res)) {
          colorList = res;
        } else if (res && Array.isArray(res.data)) {
          colorList = res.data;
        }
        // 过滤出启用状态的颜色，只保留名称
        const activeColors = colorList.filter(item => item.status === 1).map(item => item.name).filter(name => name !== '');
        this.setData({ allAvailableColors: activeColors });
      })
      .catch(err => {
        console.error('获取可用颜色数据失败', err);
        this.setData({ allAvailableColors: [] });
      });
  },

  // 新增：获取所有可用的尺码数据
  fetchAvailableSizes: function() {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchAvailableSizes] 组织ID缺失');
      this.setData({ allAvailableSizes: [] });
      return;
    }
    
    api.cloudFunctionRequest('/sizes', 'GET', { orgId })
      .then(res => {
        let sizeList = [];
        if (Array.isArray(res)) {
          sizeList = res;
        } else if (res && Array.isArray(res.data)) {
          sizeList = res.data;
        }
        // 过滤出启用状态的尺码，只保留名称
        const activeSizes = sizeList.filter(item => item.status === 1).map(item => item.name).filter(name => name !== '');
        this.setData({ allAvailableSizes: activeSizes });
      })
      .catch(err => {
        console.error('获取可用尺码数据失败', err);
        this.setData({ allAvailableSizes: [] });
      });
  },
  
  // 处理图片加载错误
  onImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log(`[onImageError] 图片加载失败，索引: ${index}`);
    
    // 使用setData修改单个图片URL为默认图片
    if (index !== undefined && this.data.selectedProducts[index]) {
      const key = `selectedProducts[${index}].image`;
      this.setData({
        [key]: '/images/default-product.png'
      });
      console.log(`[onImageError] 已将索引${index}的图片替换为默认图片`);
    }
  },

  // 旧的工厂弹窗方法已删除，改为下拉式选择

  // 显示工厂下拉列表
  showFactoryDropdown() {
    // 清除隐藏定时器
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
      this.setData({ hideDropdownTimer: null });
    }
    
    // 确保显示当前过滤状态的工厂列表
    // 如果没有搜索关键词，显示所有工厂
    if (!this.data.factorySearchKeyword || this.data.factorySearchKeyword.trim() === '') {
      this.setData({
        showFactoryDropdown: true,
        filteredFactories: this.data.factories // 显示所有工厂
      });
    } else {
      // 如果有搜索关键词，保持当前过滤结果
      this.setData({
        showFactoryDropdown: true
      });
    }
    
    console.log('显示工厂下拉列表，当前过滤工厂数量:', this.data.filteredFactories.length);
  },

  // 隐藏工厂下拉列表（带延时）
  hideFactoryDropdownWithDelay() {
    // 设置延时隐藏，给用户点击时间
    const timer = setTimeout(() => {
      this.setData({
        showFactoryDropdown: false
      });
      console.log('延时隐藏工厂下拉列表');
    }, 200);
    
    this.setData({ hideDropdownTimer: timer });
  },

  // 立即隐藏工厂下拉列表
  hideFactoryDropdown() {
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
    }
    this.setData({
      showFactoryDropdown: false,
      hideDropdownTimer: null
    });
    console.log('立即隐藏工厂下拉列表');
  },

  // 工厂搜索输入
  onFactorySearch(e) {
    console.log('===== 工厂搜索事件触发 =====');
    const keyword = e.detail.value;
    console.log('搜索关键词:', keyword);
    console.log('事件对象:', e);
    console.log('当前工厂总数:', this.data.factories.length);
    console.log('当前过滤工厂数:', this.data.filteredFactories.length);
    
    this.setData({
      factorySearchKeyword: keyword
    });
    
    // 显示下拉列表
    this.showFactoryDropdown();
    
    // 实时搜索过滤
    this.filterFactories(keyword);
    
    console.log('===== 工厂搜索事件处理完成 =====');
  },

  // 过滤工厂列表
  filterFactories(keyword) {
    console.log('开始过滤工厂列表，关键词:', keyword);
    console.log('当前工厂总数:', this.data.factories.length);
    
    if (!keyword || keyword.trim() === '') {
      // 如果没有关键词，显示所有工厂
      this.setData({
        filteredFactories: this.data.factories
      });
      console.log('无关键词，显示所有工厂:', this.data.factories.length, '个');
      return;
    }

    const keywordLower = keyword.toLowerCase().trim();
    const filtered = this.data.factories.filter(factory => {
      // 简单字符串匹配：工厂名称、电话、地址
      const nameMatch = factory.name && factory.name.toLowerCase().includes(keywordLower);
      const phoneMatch = factory.phone && factory.phone.toLowerCase().includes(keywordLower);
      const addressMatch = factory.address && factory.address.toLowerCase().includes(keywordLower);
      
      console.log(`检查工厂: ${factory.name} - 名称匹配:${nameMatch}, 电话匹配:${phoneMatch}, 地址匹配:${addressMatch}`);
      
      return nameMatch || phoneMatch || addressMatch;
    });

    this.setData({
      filteredFactories: filtered
    });

    console.log(`工厂搜索: "${keyword}" -> ${filtered.length}个结果`);
    if (filtered.length > 0) {
      console.log('匹配的工厂:', filtered.map(f => f.name));
    }
  },

  // 从下拉列表中选择工厂
  selectFactoryFromDropdown(e) {
    const factory = e.currentTarget.dataset.factory;
    console.log('选择工厂:', factory);
    
    this.setData({
      selectedFactory: factory,
      showFactoryDropdown: false,
      factorySearchKeyword: factory.name // 显示已选择的工厂名称
    });

    // 清除隐藏定时器
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
      this.setData({ hideDropdownTimer: null });
    }

    // 获取工厂详情并更新工序列表
    this.getFactoryDetail(factory.id);

    console.log('工厂选择完成:', factory.name);
  },

  // 清空工厂搜索
  clearFactorySearch() {
    this.setData({
      factorySearchKeyword: '',
      filteredFactories: this.data.factories,
      selectedFactory: null
    });
    console.log('清空工厂搜索，重置为显示所有工厂');
  },
});

// 新增全局单号生成函数
function generateGlobalOrderNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().substr(2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  const prefix = 'F'; // F代表发出单
  const datePart = `${year}${month}${day}`;
  
  // 获取当日流水号
  const lastOrderSeq = wx.getStorageSync(`orderSeq_${datePart}_${prefix}`) || 0;
  const currentSeq = lastOrderSeq + 1;
  
  // 保存更新后的流水号
  wx.setStorageSync(`orderSeq_${datePart}_${prefix}`, currentSeq);
  
  // 生成完整订单号: F + 年月日 + 3位流水号
  return `${prefix}${datePart}${currentSeq.toString().padStart(3, '0')}`;
}