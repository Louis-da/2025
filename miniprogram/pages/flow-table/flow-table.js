const api = require('../../utils/api')
const { searchMatch } = require('../../utils/pinyin'); // 引入拼音搜索工具

// 获取并处理流水表数据 (核心逻辑)
const fetchFlowTableData = function() {
  console.log('[flow-table.js] fetchFlowTableData called.');
  wx.showLoading({ title: '加载中...', mask: true });

  // 从data中获取筛选参数
  const { productNo, selectedFactoryId, dateRange } = this.data;
  
  let startDate = dateRange.start;
  let endDate = dateRange.end;

  // 构建参数对象，不选日期时不传日期参数
  const params = {
    productNo: productNo,
    factoryId: selectedFactoryId
  };
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  console.log('[flow-table.js] fetchFlowTableData parameters for API:', params);

  // 获取详细记录
  this.fetchDetailedFlowRecords(params, () => {
    wx.hideLoading();
    console.log('[flow-table.js] fetchFlowTableData completed.');
    // 处理详细记录
    if (this.data.detailedFlowRecords && this.data.detailedFlowRecords.length > 0) {
      console.log('[flow-table.js] fetchFlowTableData formatting detailed records.');
      this.formatDetailedFlowRecords(this.data.detailedFlowRecords);
    } else {
      console.log('[flow-table.js] No detailed flow records received.');
      this.setData({
        formattedDetailedRecords: []
      });
    }
  });
};

// 添加 formatDate 方法
const formatDate = function(date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 处理查询按钮点击事件
const onQueryTap = function() {
  console.log('[flow-table.js] Query button tapped, triggering data fetch.');
  // 直接调用 fetchFlowTableData，它会从 this.data 中获取筛选参数
  this.fetchFlowTableData();
};

Page({
  data: {
    productNo: '',
    
    // 筛选相关
    selectedProduct: '', // 选中的货品名称
    selectedProductId: '', // 选中的货品ID
    selectedFactory: '', // 选中的工厂
    selectedFactoryId: '', // 选中的工厂ID
    dateRange: { // 时间范围
      start: '',
      end: ''
    },
    hasFilter: false, // 是否有筛选条件
    
    // 货品列表
    productList: [],
    filteredProductList: [],
    productSearchKeyword: '',
    
    // 新增货品下拉相关
    showProductDropdown: false,
    hideProductDropdownTimer: null,
    productInputValue: '全部货品', // 输入框显示值
    filteredProducts: [],
    
    // 工厂列表
    factories: [],
    
    // 流水记录数据
    detailedFlowRecords: [], // 流水明细记录
    formattedDetailedRecords: [], // 格式化后的流水明细记录
    
    loadFailed: false, // 加载失败标志
    
    // 新增工厂搜索相关
    showFactoryDropdown: false,
    hideDropdownTimer: null,
    factorySearchKeyword: '',
    filteredFactories: [],
  },
  
  onLoad(options) {
    console.log('[flow-table.js] onLoad options:', options);
    wx.showLoading({ title: '加载中...', mask: true });

    // 并行加载工厂和货品数据
    Promise.all([
      this.fetchFactories(),
      this.fetchProducts()
    ]).then(() => {
      console.log('[flow-table.js] Factories and Products loaded.');

      // 检查是否有URL参数传入的productNo或通过事件通道传递
      if (options && options.productNo) {
        this.setData({ productNo: options.productNo });
      }

      // 检查是否通过事件通道传递
      const eventChannel = this.getOpenerEventChannel();
      if (eventChannel) {
        eventChannel.on('passProductNo', (data) => {
          if (data && data.productNo && !options.productNo) {
            console.log('[flow-table.js] Received productNo via event channel:', data.productNo);
            this.setData({ productNo: data.productNo });
          }
        });
      }

      // 默认加载所有流水记录
      console.log('[flow-table.js] Loading all flow records by default');
      this.fetchFlowTableData();
    }).catch(err => {
      wx.hideLoading();
      console.error('[flow-table.js] Initial data loading failed:', err);
      wx.showToast({ title: '加载基础数据失败', icon: 'none' });
      this.setData({ loadFailed: true });
    });
  },

  // 清除所有筛选条件
  clearAllFilters() {
    console.log('[flow-table.js] Clearing all filters');
    this.setData({
      selectedProduct: '',
      selectedProductId: '',
      selectedFactory: '',
      selectedFactoryId: '',
      dateRange: { start: '', end: '' },
      hasFilter: false,
      productNo: '',
      formattedDetailedRecords: [],
      // 重置货品下拉相关字段
      productInputValue: '全部货品',
      productSearchKeyword: '',
      showProductDropdown: false,
      // 重置工厂下拉相关字段
      factorySearchKeyword: '',
      showFactoryDropdown: false
    });
  },

  // 确认货品选择
  confirmProductSelection() {
    console.log('[flow-table.js] Confirming product selection');
    const { selectedProductId, productList } = this.data;
    
    if (selectedProductId) {
      const selectedProductItem = productList.find(item => item.id === selectedProductId);
      if (selectedProductItem) {
        this.setData({
          selectedProduct: selectedProductItem.name,
          productNo: selectedProductItem.productNo,
          hasFilter: true
        });
      }
    }
  },

  // 获取货品列表
  fetchProducts() {
    return new Promise((resolve, reject) => {
      api.getProducts()
        .then(res => {
          console.log('[flow-table.js] fetchProducts API response:', res);
          
          let products = [];
          if (res && res.data && Array.isArray(res.data)) {
            products = res.data;
          } else if (res && Array.isArray(res)) {
            products = res;
          } else {
            console.warn('[flow-table.js] Unexpected products response format:', res);
          }
          
          // 过滤掉已停用的货品（status = 0），只显示启用的货品（status = 1）
          const enabledProducts = products.filter(p => p.status === 1);
          console.log('[flow-table.js] 获取到货品数量:', products.length, '过滤后启用的货品数量:', enabledProducts.length);
          
          console.log('[flow-table.js] Setting productList (enabled only):', enabledProducts);
          this.setData({
            productList: enabledProducts,
            filteredProductList: enabledProducts,
            filteredProducts: enabledProducts // 同时初始化下拉列表
          });
          resolve();
        })
        .catch(err => {
          console.error('[flow-table.js] fetchProducts failed:', err);
          this.setData({
            productList: [],
            filteredProductList: [],
            filteredProducts: [] // 同时清空下拉列表
          });
          reject(err);
        });
    });
  },
  
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
    console.log('===== 流水表工厂搜索事件触发 =====');
    const keyword = e.detail.value;
    console.log('搜索关键词:', keyword);
    console.log('当前工厂总数:', this.data.factories.length);
    console.log('当前过滤工厂数:', this.data.filteredFactories.length);
    
    this.setData({
      factorySearchKeyword: keyword
    });
    
    // 显示下拉列表
    this.showFactoryDropdown();
    
    // 实时搜索过滤
    this.filterFactories(keyword);
    
    console.log('===== 流水表工厂搜索事件处理完成 =====');
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
      selectedFactory: factory.name,
      selectedFactoryId: factory.id,
      showFactoryDropdown: false,
      factorySearchKeyword: factory.name, // 显示已选择的工厂名称
      hasFilter: true
    });

    // 清除隐藏定时器
    if (this.data.hideDropdownTimer) {
      clearTimeout(this.data.hideDropdownTimer);
      this.setData({ hideDropdownTimer: null });
    }

    console.log('工厂选择完成:', factory.name);
  },

  // 清空工厂搜索
  clearFactorySearch() {
    this.setData({
      factorySearchKeyword: '',
      filteredFactories: this.data.factories,
      selectedFactory: '',
      selectedFactoryId: ''
    });
    console.log('清空工厂搜索，重置为显示所有工厂');
  },

  // 选择开始日期
  selectStartDate(e) {
    const date = e.detail.value;
    console.log('[flow-table.js] Start date selected:', date);
    this.setData({
      'dateRange.start': date,
      hasFilter: true
    });
  },

  // 选择结束日期
  selectEndDate(e) {
    const date = e.detail.value;
    console.log('[flow-table.js] End date selected:', date);
    this.setData({
      'dateRange.end': date,
      hasFilter: true
    });
  },

  // 清除筛选条件
  clearFilter(e) {
    const type = e.currentTarget.dataset.type;
    console.log('[flow-table.js] Clearing filter:', type);
    
    switch (type) {
      case 'product':
        this.setData({
          selectedProduct: '',
          selectedProductId: '',
          productNo: ''
        });
        break;
      case 'factory':
        this.setData({
          selectedFactory: '',
          selectedFactoryId: ''
        });
        break;
      case 'date':
        this.setData({
          'dateRange.start': '',
          'dateRange.end': ''
        });
        break;
    }
    
    // 检查是否还有其他筛选条件
    const hasAnyFilter = this.data.selectedProduct || this.data.selectedFactory || this.data.dateRange.start;
    this.setData({ hasFilter: hasAnyFilter });
  },
  
  // 获取工厂列表
  fetchFactories(callback) {
    return new Promise((resolve, reject) => {
      api.getFactories()
      .then(res => {
          console.log('[flow-table.js] fetchFactories API response:', res);
          
          let allFactories = [];
          if (res && res.data && Array.isArray(res.data)) {
            allFactories = res.data;
          } else if (res && Array.isArray(res)) {
            allFactories = res;
        } else {
            console.warn('[flow-table.js] Unexpected factories response format:', res);
        }
          
          // 过滤掉已停用的工厂（status = 'inactive'），只显示启用的工厂（status = 'active'）
          const enabledFactories = allFactories.filter(f => f.status === 'active');
          console.log('[flow-table.js] 获取到工厂数量:', allFactories.length, '过滤后启用的工厂数量:', enabledFactories.length);
          
          console.log('[flow-table.js] Setting factories (enabled only):', enabledFactories);
          this.setData({ 
            factories: enabledFactories,
            filteredFactories: enabledFactories // 初始化过滤后的工厂列表
          });
          
        if (callback) callback();
          resolve();
      })
      .catch(err => {
          console.error('[flow-table.js] fetchFactories failed:', err);
          this.setData({ 
            factories: [],
            filteredFactories: [] // 同时清空过滤列表
          });
        if (callback) callback();
          reject(err);
        });
      });
  },

  // 获取详细流水记录
  fetchDetailedFlowRecords(params, callback) {
    console.log('[flow-table.js] fetchDetailedFlowRecords called with params:', params);
    
    api.getDetailedFlowRecords(params)
      .then(res => {
        console.log('[flow-table.js] fetchDetailedFlowRecords API response:', res);
        
        let records = [];
        if (res && res.data && Array.isArray(res.data)) {
          records = res.data;
        } else if (res && Array.isArray(res)) {
          records = res;
        } else {
          console.warn('[flow-table.js] Unexpected detailed records response format:', res);
        }
        
        console.log('[flow-table.js] Setting detailedFlowRecords:', records);
        this.setData({ detailedFlowRecords: records });
        
        if (callback) callback();
      })
      .catch(err => {
        console.error('[flow-table.js] fetchDetailedFlowRecords failed:', err);
        this.setData({ detailedFlowRecords: [] });
        if (callback) callback();
      });
  },

  // 格式化详细流水记录
  formatDetailedFlowRecords(records) {
    console.log('[flow-table.js] formatDetailedFlowRecords called with records:', records);
    
    if (!records || !Array.isArray(records)) {
      console.warn('[flow-table.js] Invalid records data for formatting');
      this.setData({ formattedDetailedRecords: [] });
      return;
    }

    const formattedRecords = records.map(record => {
      // 格式化日期
      let date = '';
      const today = this.formatDate(new Date());
      
      // 优先使用record.date，如果为空则使用created_at
      if (record.date) {
        date = record.date;
      } else if (record.created_at) {
        // 如果是datetime格式，取日期部分
        date = record.created_at.split(' ')[0];
      }
      
      // 如果日期为空，使用今天的日期
      if (!date) {
        date = today;
      }
      
      // 确定类型和类型文本
      let type = '';
      let typeText = '';

      if (record.receive_order_id !== null) {
        type = 'receive';
        typeText = '收回';
      } else if (record.send_order_id !== null) {
        type = 'send';
        typeText = '发出';
      } else {
        // 如果两者都为null，可以根据其他字段判断或标记为未知类型
        type = 'unknown';
        typeText = '未知';
        console.warn('[flow-table.js] Unknown flow record type:', record);
      }
      
      // 打印日期信息用于调试
      console.log('[flow-table.js] Record date info:', {
        original_date: record.date,
        created_at: record.created_at,
        processed_date: date,
        today: today
      });
      
      // 🔧 修复颜色和尺码字段映射 - 支持多种字段名映射
      const colorValue = record.color_code || record.color || record.colorCode || record.colorName || '';
      const sizeValue = record.size_code || record.size || record.sizeCode || record.sizeName || '';
      
      // 调试日志：记录字段映射情况
      console.log('[flow-table.js] Color/Size field mapping:', {
        record_id: record.id,
        color_code: record.color_code,
        color: record.color,
        colorCode: record.colorCode,
        colorName: record.colorName,
        mapped_color: colorValue,
        size_code: record.size_code,
        size: record.size,
        sizeCode: record.sizeCode,
        sizeName: record.sizeName,
        mapped_size: sizeValue
      });
      
      return {
        id: record.id || Math.random().toString(36).substr(2, 9),
        date: date,
        type: type,
        typeText: typeText,
        order_no: record.order_no || record.orderNo || '-',
        product_no: record.product_no || record.productNo || '-',
        product_name: record.product_name || record.productName || '-',
        color: colorValue || '-',
        size: sizeValue || '-',
        quantity: parseInt(record.quantity) || 0,
        weight: parseFloat(record.weight) || 0,
        process_name: record.process_name || record.processName || '-',
        factory_name: record.factory_name || record.factoryName || '-'
      };
    });

    // 按日期降序排序（最新的在前面）
    formattedRecords.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date) - new Date(a.date);
      }
      return 0;
    });
    
    console.log('[flow-table.js] Formatted detailed records:', formattedRecords);
    this.setData({ formattedDetailedRecords: formattedRecords });
  },
  
  // ===== 货品下拉选择相关方法 =====
  
  // 货品输入框获取焦点时清空
  onProductInputFocus() {
    this.setData({
      productInputValue: '',
      productSearchKeyword: '',
      showProductDropdown: true,
      filteredProducts: this.data.productList // 显示所有货品
    });
  },
  
  // 货品搜索输入
  onProductSearch(e) {
    const keyword = e.detail.value;
    this.setData({
      productSearchKeyword: keyword,
      productInputValue: keyword // 同步更新输入框显示值
    });
    
    // 实时过滤货品
    this.filterProducts(keyword);
    
    // 显示下拉列表
    if (!this.data.showProductDropdown) {
      this.setData({
        showProductDropdown: true
      });
    }
  },
  
  // 过滤货品列表
  filterProducts(keyword) {
    if (!keyword) {
      this.setData({
        filteredProducts: this.data.productList
      });
      return;
    }
    
    const filteredList = this.data.productList.filter(product => {
      const productNo = (product.productNo || product.code || '').toLowerCase();
      const name = (product.name || '').toLowerCase();
      const process = (product.process || '').toLowerCase();
      const searchKey = keyword.toLowerCase();
      
      return productNo.includes(searchKey) || 
             name.includes(searchKey) || 
             process.includes(searchKey) ||
             searchMatch(name, searchKey) ||
             searchMatch(productNo, searchKey);
    });
    
    this.setData({
      filteredProducts: filteredList
    });
  },
  
  // 从下拉列表选择货品
  selectProductFromDropdown(e) {
    const selectedProduct = e.currentTarget.dataset.product;
    
    console.log('===== 流水表选择货品事件触发 =====');
    console.log('选择的货品:', selectedProduct);
    
    // 更新选中的货品
    this.setData({
      selectedProduct: selectedProduct ? selectedProduct.name : '',
      selectedProductId: selectedProduct ? selectedProduct.id : '',
      productNo: selectedProduct ? (selectedProduct.productNo || selectedProduct.code) : '',
      productSearchKeyword: '',
      productInputValue: selectedProduct ? (selectedProduct.productNo || selectedProduct.code) : '全部货品',
      showProductDropdown: false,
      hasFilter: true
    });
    
    // 清除定时器
    if (this.data.hideProductDropdownTimer) {
      clearTimeout(this.data.hideProductDropdownTimer);
      this.setData({
        hideProductDropdownTimer: null
      });
    }
    
    console.log('货品选择完成，当前选中货品:', this.data.selectedProduct);
    console.log('===== 流水表选择货品事件处理完成 =====');
  },
  
  // 显示货品下拉列表
  showProductDropdown() {
    // 清除隐藏定时器
    if (this.data.hideProductDropdownTimer) {
      clearTimeout(this.data.hideProductDropdownTimer);
      this.setData({
        hideProductDropdownTimer: null
      });
    }
    
    this.setData({
      showProductDropdown: true
    });
  },
  
  // 延迟隐藏货品下拉列表
  hideProductDropdownWithDelay() {
    const timer = setTimeout(() => {
      this.setData({
        showProductDropdown: false,
        hideProductDropdownTimer: null
      });
    }, 200);
    
    this.setData({
      hideProductDropdownTimer: timer
    });
  },
  
  // 立即隐藏货品下拉列表
  hideProductDropdown() {
    if (this.data.hideProductDropdownTimer) {
      clearTimeout(this.data.hideProductDropdownTimer);
    }
    
    this.setData({
      showProductDropdown: false,
      hideProductDropdownTimer: null
    });
  },
  
  // 绑定方法到页面实例
  fetchFlowTableData,
  formatDate,
  onQueryTap
});