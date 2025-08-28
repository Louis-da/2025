// const api = require('../../utils/api'); // api is usually required inside Page methods or onLoad

// Helper function for formatting date and time to YYYY-MM-DD HH:mm
function formatDateTimeToMinute(dateStringOrObject) {
  const d = dateStringOrObject instanceof Date ? dateStringOrObject : new Date(dateStringOrObject);
  if (isNaN(d.getTime())) { // Handle invalid date
    return '-'; // Or ''
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

const { formatDate, formatDateTimeToMinute: formatDateTimeToMinuteUtil } = require('../../utils/util');
const api = require('../../utils/api');
const { getFullImageUrl } = require('../../utils/image'); // + 导入 getFullImageUrl
const { searchMatch } = require('../../utils/pinyin'); // 引入拼音搜索工具

Page({
  data: {
    mode: 'add', // add, edit, view
    factories: [],  // 工厂列表
    selectedFactory: null, // 选中的工厂
    factoryBalance: 0, // 工厂余额
    processes: [], // 将硬编码的工序列表改为空数组
    selectedProcess: '', // 选中的工序
    products: [], // 所有产品
    selectedProducts: [], // 已选产品
    remarkImages: [], // 备注图片
    totalQuantity: '0', // 总数量
    totalWeight: '0', // 总重量
    totalAmount: '0', // 总金额
    orderPayableAmount: '0', // 当前订单应付金额
    paymentAmount: '0', // 支付金额
    paymentMethods: ['现金', '微信', '支付宝', '银行', '未付'], // 支付方式列表
    remainBalance: '0', // 结余
    showProductModal: false, // 是否显示产品选择弹窗
    showProductConfirmModal: false, // 是否显示产品确认弹窗
    productSearchKeyword: '', // 产品搜索关键词
    selectedProductTemp: null, // 临时选中的产品
    selectedColorTemp: '', // 临时选中的颜色
    selectedSizeTemp: '', // 临时选中的尺码
    tempQuantity: '', // 临时数量
    tempWeight: '', // 临时重量
    tempPrice: '', // 临时价格
    tempProductNo: '', // 临时货号
    remark: '', // 备注
    // 新增分享相关数据
    canvasWidth: 375,    // 画布宽度，单位px
    canvasHeight: 500,   // 画布高度，初始值
    shareImagePath: '',  // 分享图片路径
    showShareModalFlag: false, // 是否显示分享弹窗
    orderNo: '',          // 订单编号
    orderId: '',          // 订单ID
    currentDate: '',     // 当前业务日期 (YYYY-MM-DD for pickers)
    staff: '',           // 制单人
    date: '',             // 制单时间 (will be YYYY-MM-DD HH:mm for display)
    filteredProducts: [],  // 筛选后的产品列表
    orderStatus: '',      // 订单状态
    productsLoading: false, // 产品加载状态
    productSearchValue: '', // 产品搜索值
    allAvailableColors: [], // 所有可用的颜色
    allAvailableSizes: [], // 所有可用的尺码
    // 修改工厂搜索相关 - 改为下拉式
    factorySearchKeyword: '',
    filteredFactories: [],
    // 新增下拉式搜索相关
    showFactoryDropdown: false,
    hideDropdownTimer: null,
  },
  // +++ 将 getFullImageUrl 挂载到 Page 实例，以便 WXML 调用 +++
  getFullImageUrl: getFullImageUrl,
  onLoad(options) {
    this.api = require('../../utils/api');

    const now = new Date();
    // For business date logic / pickers (YYYY-MM-DD)
    const currentDateForPicker = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    // For "制单时间" display (YYYY-MM-DD HH:mm)
    const currentDateTimeForDisplay = formatDateTimeToMinute(now);
    
    // 获取制单人：优先使用个人姓名，如果没有则使用登录工号
    const realName = wx.getStorageSync('realName') || '';
    const employeeName = wx.getStorageSync('employeeName') || '';
    const username = wx.getStorageSync('username') || '';
    // 优先级：realName > employeeName > username
    const currentStaff = realName || employeeName || username || '员工';
    
    if (options.id) {
      this.setData({
        orderId: options.id,
        mode: options.mode || 'view',
        currentDate: currentDateForPicker, // Initialize for potential use
        // staff will be set from fetchOrderDetail
      });
      this.fetchOrderDetail(options.id);
    } else {
      // 新增模式
      const defaultPaymentMethod = '现金';
      this.setData({
        mode: 'add',
        currentDate: currentDateForPicker,
        staff: currentStaff,
        date: currentDateTimeForDisplay,
        paymentMethod: defaultPaymentMethod,
        paymentAmount: defaultPaymentMethod === '未付' ? '0' : ''
      });
      console.log('[receive-order.js onLoad ADD_MODE] Initial data set. date for display:', this.data.date, 'currentDate for picker:', this.data.currentDate);
    }
    
    this.fetchFactories();
    this.fetchProducts();
    
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('acceptDataFromOpenerPage', (data) => {
        if (data && data.shareImagePath && data.showShareModal) {
          this.setData({
            shareImagePath: data.shareImagePath,
            showShareModalFlag: true
          });
        }
      });
    }
  },
  
  // 确保即使JSON配置不起作用，也能设置页面标题
  onReady() {
    // 根据当前模式设置标题
    const title = this.data.mode === 'view' ? '收回单' : (this.data.mode === 'edit' ? '编辑收回单' : '新增收回单');
    wx.setNavigationBarTitle({
      title: title
    });
  },
  
  selectFactory(e) {
    const index = e.detail.value;
    const factory = this.data.factories[index];
    
    // 获取工厂详情，包括账户余额信息
    this.getFactoryDetail(factory.id);
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
    console.log('===== 收回单工厂搜索事件触发 =====');
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
    
    console.log('===== 收回单工厂搜索事件处理完成 =====');
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

    // 获取工厂详情，包括账户余额信息
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
  
  selectProcess(e) {
    const index = e.detail.value;
    this.setData({ selectedProcess: this.data.processes[index] });
  },
  selectProduct() {
    this.setData({
      showProductModal: true,
      productSearchKeyword: '',
      filteredProducts: this.data.products || []
    });
  },
  hideProductModal() {
    this.setData({
      showProductModal: false
    });
  },
  hideProductConfirmModal() {
    this.setData({
      showProductConfirmModal: false,
      selectedProductTemp: null,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: '',
      tempPrice: ''
    });
  },
  searchProducts(e) {
    const keyword = e.detail.value;
    this.setData({
      productSearchKeyword: keyword
    });
    
    if (!keyword) {
      this.setData({
        filteredProducts: this.data.products || []
      });
      return;
    }
    
    const filtered = this.data.products.filter(product => {
      return (
        (product.productNo && product.productNo.toLowerCase().includes(keyword.toLowerCase())) ||
        (product.name && product.name.toLowerCase().includes(keyword.toLowerCase()))
      );
    });
    
    this.setData({
      filteredProducts: filtered
    });
  },
  selectProductItem(e) {
    const index = e.currentTarget.dataset.index;
    const product = { ...this.data.filteredProducts[index] }; // 使用扩展运算符创建副本

    // 确保 colorOptions 和 sizeOptions 是数组，并根据货品自身的 colors 和 sizes 字段生成
    product.colorOptions = product.colors ? product.colors.split(',').map(item => item.trim()).filter(item => item !== '') : [];
    product.sizeOptions = product.sizes ? product.sizes.split(',').map(item => item.trim()).filter(item => item !== '') : [];

    console.log('选择的产品 (处理后):', product);
    console.log('原始 colors:', product.colors, '生成的 colorOptions:', product.colorOptions);
    console.log('原始 sizes:', product.sizes, '生成的 sizeOptions:', product.sizeOptions);

    this.setData({
      selectedProductTemp: product,
      showProductModal: false, // 关闭货品选择列表弹窗
      showProductConfirmModal: true, // 显示货品确认弹窗
      // 初始化 tempColor 和 tempSize 为空字符串，让 picker 显示占位符
      // 或者根据货品是否有默认颜色/尺码来设置初始值，这里保持为空以便用户选择
      tempColor: '', 
      tempSize: '',
      tempQuantity: '', // 清空临时数量
      tempWeight: '',   // 清空临时重量
      tempPrice: ''    // receive-order 特有的临时工价字段，也清空
    });
  },
  bindColorChange(e) {
    const colorOptions = this.data.selectedProductTemp.colorOptions;
    this.setData({
      selectedColorTemp: colorOptions[e.detail.value]
    });
  },
  bindSizeChange(e) {
    const sizeOptions = this.data.selectedProductTemp.sizeOptions;
    this.setData({
      selectedSizeTemp: sizeOptions[e.detail.value]
    });
  },
  bindTempQuantityInput(e) {
    console.log('数量输入值:', e.detail.value);
    // 确保始终接收字符串格式的数值，即使用户输入0
    const value = e.detail.value === 0 ? '0' : (e.detail.value || '');
    // 直接检查value是否为有效值
    if (value === '' || value === null || value === undefined) {
      console.log('警告：输入的数量为空值');
    } else {
      console.log('输入的数量为有效值:', value);
    }
    this.setData({
      tempQuantity: value
    }, () => {
      // 设置后立即检查赋值是否成功
      console.log('设置后立即检查 tempQuantity:', this.data.tempQuantity);
    });
    console.log('设置后tempQuantity:', this.data.tempQuantity);
  },
  bindTempWeightInput(e) {
    this.setData({
      tempWeight: e.detail.value
    });
  },
  bindTempPriceInput(e) {
    // 确保工价是有效数字
    const value = e.detail.value;
    console.log('临时工价输入:', value);
    // 强制转换为数字，如果无效则为0
    const numericValue = (value === '' || value === null || value === undefined) ? '' : value;
    console.log('处理后的工价值:', numericValue);
    this.setData({
      tempPrice: numericValue
    });
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
  addSelectedProduct() {
    console.log('确认添加，当前tempQuantity:', this.data.tempQuantity);
    // 强制检查
    if (!this.data.tempQuantity && this.data.tempQuantity !== '0') {
      console.log('添加前数量为空，尝试应用默认值');
      this.setData({
        tempQuantity: '0'
      });
    }
    if (this.validateProductData()) {
      const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempPrice, tempColor, tempSize } = this.data;
      console.log('验证通过，准备添加产品，数量值:', tempQuantity, '工价:', tempPrice, '重量:', tempWeight);
      
      // 确保工价是数字，即使为空也转为0
      const price = (tempPrice === '' || tempPrice === undefined || tempPrice === null) ? 0 : parseFloat(tempPrice);
      console.log('处理后的工价:', price);
      
      const newProduct = {
        ...selectedProductTemp,
        color: tempColor,
        size: tempSize,
        quantity: tempQuantity ? (isNaN(parseFloat(tempQuantity)) ? 0 : parseFloat(tempQuantity)) : 0,
        weight: parseFloat(tempWeight) || 0,
        fee: price
      };
      
      // 1. 在产品选择弹窗确认时（addSelectedProduct、addSelectedProductAndContinue），根据所选颜色、尺码名称，自动查找对应 color_id、size_id（可通过 allAvailableColors、allAvailableSizes 或接口查ID），并保存到 newProduct.color_id、newProduct.size_id。
      // 2. 在 submitOrder 时，orderItems 每项都带 color_id、size_id 字段，且为数字ID。
      // 3. 若只选了名称，自动查ID并补全。
      const colorObj = (this.data.allAvailableColors || []).find(c => c.name === selectedColorTemp);
      const colorId = colorObj ? colorObj.id : undefined;
      if (colorId) {
        newProduct.color_id = colorId;
      }
      const sizeObj = (this.data.allAvailableSizes || []).find(s => s.name === selectedSizeTemp);
      const sizeId = sizeObj ? sizeObj.id : undefined;
      if (sizeId) {
        newProduct.size_id = sizeId;
      }
      
      console.log('新增货品:', newProduct.name, '数量:', newProduct.quantity, '工价:', newProduct.fee, '重量:', newProduct.weight);
      
      const selectedProducts = [...this.data.selectedProducts, newProduct];
      this.setData({
        selectedProducts,
        showProductConfirmModal: false,
        selectedProductTemp: null,
        tempColor: '',
        tempSize: '',
        tempQuantity: '',
        tempWeight: '',
        tempPrice: ''
      }, () => {
        this.calculateTotals();
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
      });
    }
  },
  addSelectedProductAndContinue() {
    if (this.validateProductData()) {
      const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempPrice, tempColor, tempSize } = this.data;
      
      // 确保工价是数字，即使为空也转为0
      const price = (tempPrice === '' || tempPrice === undefined || tempPrice === null) ? 0 : parseFloat(tempPrice);
      console.log('处理后的工价:', price);
      
      const newProduct = {
        ...selectedProductTemp,
        color: tempColor,
        size: tempSize,
        quantity: tempQuantity ? (isNaN(parseFloat(tempQuantity)) ? 0 : parseFloat(tempQuantity)) : 0,
        weight: parseFloat(tempWeight) || 0,
        fee: price
      };
      
      // 1. 在产品选择弹窗确认时（addSelectedProduct、addSelectedProductAndContinue），根据所选颜色、尺码名称，自动查找对应 color_id、size_id（可通过 allAvailableColors、allAvailableSizes 或接口查ID），并保存到 newProduct.color_id、newProduct.size_id。
      // 2. 在 submitOrder 时，orderItems 每项都带 color_id、size_id 字段，且为数字ID。
      // 3. 若只选了名称，自动查ID并补全。
      const colorObj = (this.data.allAvailableColors || []).find(c => c.name === selectedColorTemp);
      const colorId = colorObj ? colorObj.id : undefined;
      if (colorId) {
        newProduct.color_id = colorId;
      }
      const sizeObj = (this.data.allAvailableSizes || []).find(s => s.name === selectedSizeTemp);
      const sizeId = sizeObj ? sizeObj.id : undefined;
      if (sizeId) {
        newProduct.size_id = sizeId;
      }
      
      console.log('继续添加货品:', newProduct.name, '数量:', newProduct.quantity, '工价:', newProduct.fee, '重量:', newProduct.weight);
      
      const selectedProducts = [...this.data.selectedProducts, newProduct];
      this.setData({
        selectedProducts,
        tempColor: '',
        tempSize: '',
        tempQuantity: '',
        tempWeight: '',
        tempPrice: ''
      }, () => {
        this.calculateTotals();
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        });
      });
    }
  },
  validateProductData() {
    const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempPrice } = this.data;
    
    // 检查重量是否非零
    const weightNum = parseFloat(tempWeight) || 0;
    const hasWeight = weightNum > 0;
    
    console.log('验证数据: tempQuantity =', JSON.stringify(tempQuantity), 'tempWeight =', tempWeight);
    console.log('重量检查: weightNum =', weightNum, 'hasWeight =', hasWeight);
    
    // 如果重量大于0，则允许其他字段为空
    if (hasWeight) {
      console.log('重量不为0，跳过其他字段验证');
      
      // 确保tempQuantity有一个默认值以防后续计算错误
      if (!tempQuantity) {
        this.setData({
          tempQuantity: '0'
        });
      }
      
      return true;
    }
    
    // 以下是重量为0时的正常验证流程
    if (selectedProductTemp.colorOptions && selectedProductTemp.colorOptions.length > 0 && !selectedColorTemp) {
      wx.showToast({
        title: '请选择颜色',
        icon: 'none'
      });
      return false;
    }
    
    if (selectedProductTemp.sizeOptions && selectedProductTemp.sizeOptions.length > 0 && !selectedSizeTemp) {
      wx.showToast({
        title: '请选择尺码',
        icon: 'none'
      });
      return false;
    }
    
    // 尝试转换为数字
    const quantityNum = Number(tempQuantity);
    console.log('转换后的数量:', quantityNum);
    if (isNaN(quantityNum)) {
      console.log('数量不是有效数字');
      wx.showToast({
        title: '请输入有效数字',
        icon: 'none'
      });
      return false;
    }
    
    // 强制转换数据类型确保正确处理
    this.setData({
      tempQuantity: String(tempQuantity)
    });
    console.log('校验后的tempQuantity:', this.data.tempQuantity);
    
    return true;
  },
  inputColor(e) {
    const index = e.currentTarget.dataset.index;
    const selectedProducts = this.data.selectedProducts;
    selectedProducts[index].color = e.detail.value;
    this.setData({ selectedProducts });
  },
  inputSize(e) {
    const index = e.currentTarget.dataset.index;
    const selectedProducts = this.data.selectedProducts;
    selectedProducts[index].size = e.detail.value;
    this.setData({ selectedProducts });
  },
  bindWeightInput(e) {
    const index = e.currentTarget.dataset.index;
    const selectedProducts = this.data.selectedProducts;
    selectedProducts[index].weight = parseFloat(e.detail.value) || 0;
    this.setData({ selectedProducts }, () => {
      this.calculateTotals();
    });
  },
  bindQuantityInput(e) {
    const index = e.currentTarget.dataset.index;
    const selectedProducts = this.data.selectedProducts;
    selectedProducts[index].quantity = parseInt(e.detail.value) || 0;
    this.setData({ selectedProducts }, () => {
      this.calculateTotals();
    });
  },
  bindPriceInput(e) {
    const index = e.currentTarget.dataset.index;
    console.log('修改工价:', e.detail.value, '索引:', index);
    
    const selectedProducts = this.data.selectedProducts;
    // 确保工价是数字
    selectedProducts[index].fee = parseFloat(e.detail.value) || 0;
    console.log('设置后工价:', selectedProducts[index].fee);
    
    // 立即计算该货品的小计
    const price = selectedProducts[index].fee;
    const quantity = parseFloat(selectedProducts[index].quantity) || 0;
    const subtotal = price * quantity;
    console.log(`货品小计更新: ${price}元/打 × ${quantity}打 = ${subtotal}元`);
    
    this.setData({ selectedProducts }, () => {
      // 更新总计
      this.calculateTotals();
    });
  },
  inputPrice(e) {
    const index = e.currentTarget.dataset.index;
    const selectedProducts = this.data.selectedProducts;
    // 确保工价是数字
    selectedProducts[index].fee = parseFloat(e.detail.value) || 0;
    this.setData({ selectedProducts }, () => {
      this.calculateTotals();
    });
  },
  inputRemark(e) {
    this.setData({ remark: e.detail.value });
  },
  selectPaymentMethodByTap(e) {
    const method = e.currentTarget.dataset.method;
    let newPaymentAmount = this.data.paymentAmount;

    if (method === '未付') {
      newPaymentAmount = '0'; // 选择未付，金额设为0
    } else {
      // 选择其他方式，如果当前金额是0（因为之前选了未付或手动输入了0），则清空金额
      if (this.data.paymentAmount === '0') {
          newPaymentAmount = ''; 
      }
      // 如果当前金额非0，则不清空，保留用户可能已输入的金额
    }

    this.setData({
      paymentMethod: method,
      paymentAmount: newPaymentAmount
    }, () => {
      // 重新计算结余
      this.calculateRemainBalance(newPaymentAmount);
    });
  },
  inputPaymentAmount(e) {
    const amount = e.detail.value;
    let currentPaymentMethod = this.data.paymentMethod;

    // 如果输入金额为0或空
    if (amount === '0' || amount === '' || parseFloat(amount) === 0) {
      // 自动将支付方式设置为"未付"
      currentPaymentMethod = '未付';
      this.setData({
        paymentAmount: '0', // 确保存储的是 '0'
        paymentMethod: currentPaymentMethod
      }, () => {
        // 计算本单结余
        this.calculateRemainBalance('0');
      });
    } else {
       // 如果输入金额非0，但当前支付方式是"未付"，则清空支付方式让用户重新选择
       if (currentPaymentMethod === '未付') {
         currentPaymentMethod = ''; // 或者设置为默认值如 '现金'
       }
       this.setData({
         paymentAmount: amount,
         paymentMethod: currentPaymentMethod // 更新支付方式（可能是被清空的）
       }, () => {
         // 计算本单结余
         this.calculateRemainBalance(amount);
       });
    }
  },
  calculateTotals() {
    const { selectedProducts } = this.data;
    console.log('计算总计，货品数量:', selectedProducts.length);
    // 强制转换类型确保计算正确
    const totalQuantity = selectedProducts.reduce((sum, p) => {
      const quantity = parseFloat(p.quantity) || 0;
      return sum + quantity;
    }, 0);
    
    // 计算总重量
    const totalWeight = selectedProducts.reduce((sum, p) => {
      const weight = parseFloat(p.weight) || 0;
      return sum + weight;
    }, 0);
    
    const totalAmount = selectedProducts.reduce((sum, p) => {
      const price = parseFloat(p.fee) || 0;
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
    this.setData({
      totalQuantity: totalQuantity.toFixed(0),
      totalWeight: totalWeight.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      orderPayableAmount: totalAmount.toFixed(2)
    }, () => {
      // 货品变动后也要重新计算本单结余
      this.calculateRemainBalance(this.data.paymentAmount);
    });
  },
  validateForm() {
    const { selectedFactory, selectedProcess, selectedProducts, paymentMethod, paymentAmount } = this.data;
    
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
    
    for (let i = 0; i < selectedProducts.length; i++) {
      const product = selectedProducts[i];
      
      // 检查重量是否大于0
      const weightNum = parseFloat(product.weight) || 0;
      const hasWeight = weightNum > 0;
      
      // 如果重量大于0，则跳过其他字段的验证
      if (hasWeight) {
        continue;
      }
      
      // 以下是重量为0时的必填字段验证
      if (!product.color) {
        wx.showToast({ title: `请填写第${i+1}个货品的颜色`, icon: 'none' });
        return false;
      }
      if (!product.size) {
        wx.showToast({ title: `请填写第${i+1}个货品的尺码`, icon: 'none' });
        return false;
      }
      if (!product.quantity) {
        wx.showToast({ title: `请填写第${i+1}个货品的数量`, icon: 'none' });
        return false;
      }
      if (!product.fee) {
        wx.showToast({ title: `请填写第${i+1}个货品的工价`, icon: 'none' });
        return false;
      }
    }
    
    // 验证支付方式
    if (!paymentMethod) {
      wx.showToast({ title: '请选择支付方式', icon: 'none' });
      return false;
    }

    // 如果支付方式不是"未付"，则支付金额必须大于0
    if (paymentMethod !== '未付' && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
        wx.showToast({ title: '请输入有效的支付金额', icon: 'none' });
        return false;
    }
    
    return true;
  },
  submitOrder() {
    if (!this.validateForm()) return;
    
    // 检查组织ID
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      wx.showToast({ title: '组织信息缺失，请重新登录', icon: 'none' });
      return;
    }
    
    console.log('开始提交收回单...');
    wx.showLoading({ title: '保存中...' });

    // 1. 准备订单明细数组 (items)，全部下划线风格，确保 product_id、product_no 来源准确
    const orderItems = this.data.selectedProducts.map(p => ({
      product_id: p.id || p.product_id || '', // 优先用 id
      product_no: p.code || p.productNo || p.product_no || '', // 优先用 code
      color_id: p.colorId || p.color_id || null,
      color_code: p.color || p.color_code || '',
      size_id: p.sizeId || p.size_id || null,
      size_code: p.size || p.size_code || '',
      weight: parseFloat(p.weight) || 0,
      quantity: parseFloat(p.quantity) || 0,
      fee: parseFloat(p.fee) || parseFloat(p.price) || 0, // price优先
      // 添加产品名称，以便后端处理
      productId: p.id || p.product_id || '', // 兼容字段
      productName: p.name || p.productName || '' // 产品名称
    }));

    // 计算结余金额（仅用于日志输出）
    const orderPayableAmount = parseFloat(this.data.orderPayableAmount) || 0;
    const paymentAmount = parseFloat(this.data.paymentAmount) || 0;
    const remainBalance = paymentAmount - orderPayableAmount;
    
    console.log('订单应付金额:', orderPayableAmount);
    console.log('实际支付金额:', paymentAmount);
    console.log('本次结余金额:', remainBalance);

    // 2. 准备主订单数据，并嵌入订单明细数组
    const orderMain = {
      orgId: orgId,
      factoryId: this.data.selectedFactory ? this.data.selectedFactory.id : '',
      factoryName: this.data.selectedFactory ? this.data.selectedFactory.name : '',
      processId: this.data.selectedProcess && this.data.selectedProcess.id ? this.data.selectedProcess.id : 0,
      process: this.data.selectedProcess ? this.data.selectedProcess.name || this.data.selectedProcess : '',
      created_at: this.data.date, // 用 created_at 字段
      staff: this.data.staff,
      remark: this.data.remark,
      remarkImages: this.data.remarkImages || [], // 添加备注照片
      totalWeight: this.data.totalWeight,
      totalQuantity: this.data.totalQuantity,
      fee: parseFloat(this.data.totalAmount) || 0,
      totalFee: parseFloat(this.data.totalAmount) || 0, // 添加totalFee字段与fee保持一致
      paymentMethod: this.data.paymentMethod,
      paymentAmount: parseFloat(this.data.paymentAmount) || 0,
      status: 'normal',
      items: orderItems // 明细
    };

    console.log('即将提交的收回单数据 (包含明细):', JSON.stringify(orderMain, null, 2));

    // 3. 调用 api.addReceiveOrder 一次性提交主订单和明细
    // 使用api模块而不是this.api
    require('../../utils/api').addReceiveOrder(orderMain) // 使用专门的收回单接口，确保工厂账户状态更新
      .then(res => {
        console.log('收回单提交结果 (主数据和明细):', res);
        wx.hideLoading();

        if (res.success && res.data && res.data.id) {
          // 处理服务器返回的最新工厂账户状态
          if (res.data.factoryStatus) {
            const factoryStatus = res.data.factoryStatus;
            console.log('服务器返回的最新工厂账户状态:', factoryStatus);
            
            try {
              // 1. 更新当前页面显示
              if (this.data.selectedFactory && this.data.selectedFactory.id === factoryStatus.id) {
                this.setData({
                  'selectedFactory.balance': factoryStatus.balance,
                  'selectedFactory.debt': factoryStatus.debt,
                  factoryBalance: factoryStatus.balance
                });
              }
              
              // 2. 缓存最新的工厂状态，供其他页面使用
              const factoryCache = wx.getStorageSync('factoriesCache') || {};
              factoryCache[factoryStatus.id] = factoryStatus;
              wx.setStorageSync('factoriesCache', factoryCache);
              
              // 3. 记录更新时间，用于工厂管理页判断是否需要刷新
              wx.setStorageSync('factoriesUpdateTime', new Date().getTime());
              console.log('已缓存最新的工厂账户状态:', factoryStatus);
            } catch (e) {
              console.error('更新工厂状态失败:', e);
            }
          }
          
          wx.showToast({
            title: '保存成功',
            icon: 'success',
            mask: true
          });

          // 设置标记，通知列表页面和首页需要刷新数据
          wx.setStorageSync('hasNewOrder', true);
          wx.setStorageSync('refreshHomeData', true);
          console.log('设置新订单标记，相关页面将刷新数据');

          // 保存成功后返回上一页
          setTimeout(() => {
            try {
              wx.navigateBack({
                fail: function() {
                  console.warn('navigateBack失败，尝试redirectTo send-receive页面');
                  wx.redirectTo({
                    url: '/pages/send-receive/send-receive'
                  });
                }
              });
            } catch (e) {
              console.error('返回上一页操作失败:', e);
              wx.redirectTo({
                url: '/pages/send-receive/send-receive'
              });
            }
          }, 1000);
        } else {
          const errorMsg = (res && (res.message || res.error)) || '主订单或明细保存失败';
          console.error('保存收回单失败，服务器返回:', res);
          wx.showToast({ title: errorMsg, icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('提交收回单请求失败:', err);
        const displayError = (err && err.error) ? err.error : '网络错误或保存操作失败';
        wx.showToast({ title: displayError, icon: 'none' });
      });
  },
  deleteProduct(e) {
    const index = e.currentTarget.dataset.index;
    const selectedProducts = this.data.selectedProducts.filter((_, i) => i !== index);
    this.setData({ selectedProducts }, () => {
      this.calculateTotals();
      wx.showToast({ 
        title: '已删除', 
        icon: 'success' 
      });
    });
  },
  addRemarkImage() {
    const that = this;
    wx.chooseImage({
      count: 3 - (that.data.remarkImages.length),
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const remarkImages = that.data.remarkImages.concat(res.tempFilePaths);
        that.setData({ remarkImages });
      }
    });
  },
  deleteRemarkImage(e) {
    const index = e.currentTarget.dataset.index;
    const remarkImages = this.data.remarkImages.filter((_, i) => i !== index);
    this.setData({ remarkImages });
  },
  previewRemarkImage(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.remarkImages[index],
      urls: this.data.remarkImages
    });
  },
  // 添加导航返回函数
  navigateBack() {
    wx.navigateBack();
  },
  getFactoryDetail: function(factoryId) {
    wx.showLoading({ title: '获取工厂信息...', mask: true });
    
    const orgId = wx.getStorageSync('orgId');
    const api = require('../../utils/api');
    
    // 同时获取工厂详情和组织工序列表
    Promise.all([
      api.request(`/factories/${factoryId}`, 'GET', { orgId }),
      api.request('/processes', 'GET', { orgId })
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

          // 确保工厂对象包含 balance 和 debt 属性
          factoryData.balance = factoryData.balance || 0;
          factoryData.debt = factoryData.debt || 0;

          this.setData({
            selectedFactory: factoryData,
            factoryBalance: factoryData.balance || '0.00',
            processes: processesList,
            selectedProcess: initialProcess,
          });

          if (processesList.length === 0) {
            wx.showToast({ title: '该工厂未设置工序', icon: 'none' });
          }
        } else {
          console.error('获取工厂详情失败:', factoryRes);
          wx.showToast({ title: '获取工厂详情失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取工厂详情请求失败:', err);
        wx.showToast({ title: '网络错误，请重试', icon: 'none' });
      });
  },
  calculateRemainBalance(inputAmount) {
    // 结余 = 支付金额 - 应付金额，负数为欠款
    const orderPayable = parseFloat(this.data.orderPayableAmount) || 0;
    const paid = parseFloat(inputAmount) || 0;
    const remainBalance = (paid - orderPayable).toFixed(2);
    this.setData({
      remainBalance: remainBalance
    });
  },
  // 添加相同货号的产品
  addSameProduct(e) {
    const index = e.currentTarget.dataset.index;
    const product = this.data.selectedProducts[index];
    
    this.setData({
      selectedProductTemp: product,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: '',
      tempPrice: product.fee ? product.fee.toString() : '',
      showProductConfirmModal: true
    });
  },
  // 新增函数: 生成分享图片
  generateShareImage(orderData) {
    console.log('[receive-order.js generateShareImage] Original orderData products:', orderData.products); // 添加日志
    // 兼容所有明细字段，补全 productNo 和 name 字段，保证分享图片显示
    if (orderData.products && Array.isArray(orderData.products)) {
      orderData.products = orderData.products.map(item => {
        // 货号兼容
        item.productNo = item.productNo || '';
        item.name = item.name || '';
        return item;
      });
      console.log('[receive-order.js generateShareImage] Processed products for drawing:', orderData.products); // 添加日志
    }
    
    // 动态计算画布高度（适应新的现代化设计）
    const headerHeight = 400;  // 标题、工厂信息、基本信息区域（包含支付信息）
    const tableHeaderHeight = 80; // 表格头部
    const productRowHeight = 100; // 每个货品的行高（增加以适应双行显示）
    const productsHeight = Math.max(orderData.products.length, 1) * productRowHeight; // 至少显示一行
    const summaryHeight = 160;  // 合计信息区域（收回单需要更多空间显示支付信息）
    const remarkHeight = orderData.remark ? 120 : 0; // 备注区域（如果有）
    const footerHeight = 140;  // 底部信息区域
    const calculatedHeight = headerHeight + tableHeaderHeight + productsHeight + summaryHeight + remarkHeight + footerHeight;
    
    this.setData({
      canvasHeight: calculatedHeight
    });
    
    // 获取canvas上下文
    console.log('[receive-order.js generateShareImage] Getting canvas context');
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        console.log('[receive-order.js generateShareImage] Canvas query result:', res);
        const canvas = res[0].node;
        if (!canvas) {
          console.error('[receive-order.js generateShareImage] Canvas node not found');
          wx.hideLoading();
          wx.showToast({ title: '生成图片失败: Canvas不存在', icon: 'none' });
          return;
        }
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = this.data.canvasWidth;
        canvas.height = this.data.canvasHeight;
        
        // 开始绘制
        console.log('[receive-order.js generateShareImage] Starting to draw on canvas');
        this.drawOrderImage(ctx, canvas.width, canvas.height, orderData);
        console.log('[receive-order.js generateShareImage] Finished drawing on canvas');
        
        // 将canvas内容转为图片
        console.log('[receive-order.js generateShareImage] Converting canvas to temp file');
        wx.canvasToTempFilePath({
          canvas: canvas,
          success: function(res) {
            console.log('[receive-order.js generateShareImage] Canvas to temp file success:', res.tempFilePath);
            wx.hideLoading();
            // 保存图片路径并显示分享弹窗，不自动保存到相册
            this.setData({
              shareImagePath: res.tempFilePath,
              showShareModalFlag: true
            });
          },
          fail: function(err) {
            console.error('[receive-order.js generateShareImage] Canvas to temp file failed:', err);
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
      error: '#ff3b30',          // 错误色（红色）
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
    const title = `${companyName} | ${orderData.process || '加工'} | 收回单`;
    currentY += 70;
    ctx.fillText(title, canvasWidth / 2, currentY);
    
    // 2. 绘制工厂信息区域
    currentY += 80;
    ctx.fillStyle = colors.warning;
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
    
    // 第一行：单号和日期
    ctx.fillText(`单号: ${orderData.orderNo}`, margin, currentY);
    ctx.textAlign = 'right';
    ctx.fillText(`日期: ${orderData.date}`, canvasWidth - margin, currentY);
    
    // 第二行：支付信息
    currentY += 50;
    ctx.textAlign = 'left';
    ctx.fillText(`支付方式: ${orderData.paymentMethod || '未付'}`, margin, currentY);
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.success;
    ctx.fillText(`支付金额: ¥${orderData.paymentAmount || '0'}`, canvasWidth - margin, currentY);
    
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
    
    // 定义列宽比例（收回单包含工价列）
    const colWidths = [0.3, 0.15, 0.15, 0.12, 0.13, 0.15]; // 货品、颜色、尺码、工价、数量、重量
    const colHeaders = ['货品信息', '颜色', '尺码', '工价', '数量', '重量(kg)'];
    
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
      
      // 工价列（使用警告色）
      ctx.fillStyle = colors.warning;
      ctx.font = 'bold ' + fonts.body;
      ctx.fillText(product.fee ? `¥${product.fee}` : '-', colX + tableWidth * colWidths[3] / 2, currentY + rowHeight / 2 + 8);
      colX += tableWidth * colWidths[3];
      
      // 数量列（使用强调色）
      ctx.fillStyle = colors.accent;
      ctx.fillText((product.quantity || '-') + '打', colX + tableWidth * colWidths[4] / 2, currentY + rowHeight / 2 + 8);
      colX += tableWidth * colWidths[4];
      
      // 重量列（使用成功色）
      ctx.fillStyle = colors.success;
      ctx.font = fonts.body;
      ctx.fillText(product.weight || '-', colX + tableWidth * colWidths[5] / 2, currentY + rowHeight / 2 + 8);
      
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
    ctx.fillRect(margin, currentY, tableWidth, 120);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, currentY, tableWidth, 120);
    
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.subtitle;
    ctx.textAlign = 'left';
    ctx.fillText('合计:', margin + 40, currentY + 45);
    
    // 合计信息分两行显示
    ctx.textAlign = 'right';
    ctx.fillStyle = colors.accent;
    ctx.font = fonts.header;
    ctx.fillText(`总数量: ${orderData.totalQuantity || 0}打`, canvasWidth - margin - 200, currentY + 35);
    ctx.fillStyle = colors.success;
    ctx.fillText(`总重量: ${orderData.totalWeight || 0}kg`, canvasWidth - margin - 40, currentY + 35);
    
    // 第二行：总金额和结余信息
    ctx.fillStyle = colors.warning;
    ctx.fillText(`总金额: ¥${orderData.totalAmount || 0}`, canvasWidth - margin - 200, currentY + 75);
    
    // 结余/欠款信息
    let remainBalance = 0;
    if (typeof orderData.remainBalance !== 'undefined') {
      remainBalance = parseFloat(orderData.remainBalance);
    } else if (typeof orderData.balance !== 'undefined') {
      remainBalance = parseFloat(orderData.balance);
    } else if (typeof orderData.remain_balance !== 'undefined') {
      remainBalance = parseFloat(orderData.remain_balance);
    }
    
    if (!isNaN(remainBalance)) {
      ctx.fillStyle = remainBalance >= 0 ? colors.success : colors.error;
      const label = remainBalance >= 0 ? '累计结余' : '累计欠款';
      ctx.fillText(`${label}: ¥${Math.abs(remainBalance)}`, canvasWidth - margin - 40, currentY + 75);
    }
    
    // 7. 绘制备注区域（如果有备注）
    if (orderData.remark) {
      currentY += 160;
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
        title: `收回单: ${this.data.orderNo}`,
        path: `/pages/receive-order/receive-order?id=${this.data.orderId || ''}&mode=view`,
        imageUrl: this.data.shareImagePath
      };
    }
    
    // 来自右上角菜单的分享
    return {
      title: '收回单',
      path: '/pages/send-receive/send-receive'
    };
  },
  
  // 保存图片到相册
  saveImageToAlbum() {
    const that = this;
    
    // 显示确认对话框
    wx.showModal({
      title: '保存图片',
      content: '是否保存收回单图片到手机相册？',
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
  
  async fetchProducts() {
    if (this.data.productsLoading) return;
    this.setData({ productsLoading: true });
    try {
      const res = await api.getProducts({ /* 可以添加分页或搜索参数 */ });
      if (res && res.data) {
        // 过滤掉已停用的货品（status = 0），只显示启用的货品（status = 1）
        const enabledProducts = res.data.filter(p => p.status === 1);
        
        const products = enabledProducts.map(p => ({
          ...p,
          image: this.getFullImageUrl(p.image) // 直接更新 image 字段
        }));
        console.log('[receive-order.js fetchProducts] Processed products (enabled only):', products);
        console.log('[receive-order.js fetchProducts] Filtered out disabled products, showing', products.length, 'enabled products');
        // Log the image paths of processed products
        products.forEach(p => {
          console.log('[receive-order.js fetchProducts] Product image path:', p.productNo, p.image);
        });
        this.setData({
          products: products,
          filteredProducts: products,
          productsLoading: false,
        });
      } else {
        this.setData({ products: [], filteredProducts: [], productsLoading: false });
        wx.showToast({ title: '获取货品列表失败', icon: 'none' });
      }
    } catch (error) {
      console.error('[receive-order.js fetchProducts] Error:', error);
      this.setData({ products: [], filteredProducts: [], productsLoading: false });
      wx.showToast({ title: '获取货品数据异常', icon: 'none' });
    }
  },
  
  fetchFactories() {
    wx.showLoading({ title: '正在加载...', mask: true });
    
    // 使用api模块而不是this.api
    require('../../utils/api').getFactories()
      .then(res => {
        const factories = res.data || [];
        
        // 过滤掉已停用的工厂（status = 'inactive'），只显示启用的工厂（status = 'active'）
        const enabledFactories = factories.filter(f => f.status === 'active');
        console.log('[receive-order.js fetchFactories] 获取到工厂数量:', factories.length, '过滤后启用的工厂数量:', enabledFactories.length);
        
        const updateObj = { 
          factories: enabledFactories,
          filteredFactories: enabledFactories // 初始化过滤后的工厂列表
        };
        console.log('[receive-order.js fetchFactories] setData with:', updateObj);
        this.setData(updateObj);
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取工厂列表失败', err);
        const updateObj = { 
          factories: [],
          filteredFactories: [] // 同时清空过滤列表
        };
        console.log('[receive-order.js fetchFactories CATCH] setData with:', updateObj);
        this.setData(updateObj);
        wx.hideLoading();
        wx.showToast({ title: '获取工厂数据失败', icon: 'none' });
      });
  },
  
  // 获取订单详情
  fetchOrderDetail(orderId) {
    wx.showLoading({ title: '加载订单详情...' });
    const apiModule = require('../../utils/api');
    apiModule.getReceiveOrderDetail(orderId).then(res => {
      wx.hideLoading();
      if (res.success && res.data) {
        const orderData = res.data;
        console.log('[fetchOrderDetail] 获取到的收货单详情:', orderData);
        
        // 确保状态值的正确转换
        let status = orderData.status;
        // 统一状态值：数字0或字符串'canceled'表示作废
        if (status === 'canceled' || status === 'cancelled' || status === 0 || status === '0') {
          status = 0;
        }

        // +++ 处理订单条目中的图片路径 +++
        const itemsWithFullUrls = (orderData.items || orderData.products || []).map(item => ({
          ...item,
          image: this.getFullImageUrl(item.image)
        }));
        console.log('处理后的订单条目:', itemsWithFullUrls); // 添加日志

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
        
        this.setData({
          orderNo: orderData.orderNo,
          selectedFactory: {
            id: orderData.factoryId,
            name: orderData.factoryName
          },
          selectedProcess: {
            id: orderData.processId || 0,
            name: orderData.processName || orderData.process || ''
          },
          selectedProducts: itemsWithFullUrls,
          remark: orderData.remark,
          remarkImages: (orderData.remarkImages || []).map(img => this.getFullImageUrl(img)),
          totalQuantity: orderData.totalQuantity || '0',
          totalWeight: orderData.totalWeight || '0',
          totalAmount: orderData.totalAmount || '0',
          orderPayableAmount: orderData.payableAmount || '0',
          paymentAmount: orderData.paymentAmount === undefined ? (orderData.payableAmount || '0') : String(orderData.paymentAmount),
          paymentMethod: orderData.paymentMethod || '未付',
          staff: orderData.creator || orderData.creatorName || orderData.staff || wx.getStorageSync('realName') || wx.getStorageSync('employeeName') || wx.getStorageSync('username') || '员工',
          date: dateTimeForDisplay,
          currentDate: businessDateOnly,
          factoryBalance: orderData.factoryBalance || 0,
          remainBalance: orderData.balanceAfterPayment === undefined ? (orderData.factoryBalance || 0) : orderData.balanceAfterPayment,
          orderStatus: status // 使用统一转换后的状态值
        });

        console.log('[fetchOrderDetail] After setData, selectedProcess:', this.data.selectedProcess);

        if (orderData.factoryId) {
          this.getFactoryDetail(orderData.factoryId); 
        }
        this.calculateTotals();
      } else {
        wx.showToast({ title: '获取订单详情失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('获取订单详情失败:', err);
      wx.showToast({ title: '获取订单数据失败', icon: 'none' });
    });
  },

  onShow() {
    console.log('[receive-order.js onShow] Page shown. Current this.data.date:', this.data.date);
    
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
    // ... rest of onShow logic, if any
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
          const apiModule = require('../../utils/api');
          apiModule.deleteReceiveOrder(this.data.orderId)
            .then(cancelRes => {
              wx.hideLoading();
              if (cancelRes.success) {
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
});