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
    paymentMethod: '', // 支付方式
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
    currentDate: '',     // 当前日期
    staff: '',           // 制单人
    date: '',             // 制单时间
    filteredProducts: [],  // 筛选后的产品列表
    orderStatus: ''      // 订单状态
  },
  onLoad(options) {
    // 导入API模块
    this.api = require('../../utils/api');

    // 设置当前日期
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // 尝试获取用户昵称或用户名
    const nickname = wx.getStorageSync('nickname'); // 假设昵称存储在 'nickname' 键中
    const username = wx.getStorageSync('username');
    // 优先使用昵称，其次用户名，最后是默认值
    const currentStaff = nickname || username || '管理员'; 
    
    // 根据参数设置模式
    if (options.id) {
      this.setData({
        orderId: options.id,
        mode: options.mode || 'view',
        currentDate,
        staff: wx.getStorageSync('username') || '管理员'
      });
      this.fetchOrderDetail(options.id);
    } else if (options.mode === 'edit') {
      this.setData({
        mode: 'edit',
        currentDate,
        staff: wx.getStorageSync('username') || '管理员',
        date: currentDate
      });
    } else {
      // 新增模式
      const defaultPaymentMethod = '现金';
      this.setData({
        mode: 'add',
        currentDate,
        staff: currentStaff,
        date: currentDate,
        paymentMethod: defaultPaymentMethod,
        paymentAmount: defaultPaymentMethod === '未付' ? '0' : ''
      });
    }
    
    // 获取工厂列表
    this.fetchFactories();
    
    // 获取产品列表
    this.fetchProducts();
    
    // 监听事件通道，接收来自收发管理页面的分享请求
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('acceptDataFromOpenerPage', (data) => {
        if (data) {
          // 如果有传递shareImagePath，说明是从列表页面分享操作过来的
          if (data.shareImagePath && data.showShareModal) {
            // 设置分享图片路径并显示分享弹窗
            this.setData({
              shareImagePath: data.shareImagePath,
              showShareModalFlag: true
            });
          }
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
    const product = this.data.filteredProducts[index];
    
    this.setData({
      selectedProductTemp: product,
      showProductModal: false,
      showProductConfirmModal: true,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: '',
      tempPrice: ''
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
  bindTempColorInput(e) {
    this.setData({
      tempColor: e.detail.value
    });
  },
  bindTempSizeInput(e) {
    this.setData({
      tempSize: e.detail.value
    });
  },
  addSelectedProduct() {
    console.log('确认添加，当前tempQuantity:', this.data.tempQuantity);
    // 强制检查
    if (!this.data.tempQuantity && this.data.tempQuantity !== '0') {
      console.log('添加前数量为空，尝试应用默认值');
      this.setData({
        tempQuantity: '1'  // 应用默认值
      });
    }
    if (this.validateProductData()) {
      const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempPrice } = this.data;
      console.log('验证通过，准备添加产品，数量值:', tempQuantity, '工价:', tempPrice, '重量:', tempWeight);
      
      // 确保工价是数字，即使为空也转为0
      const price = (tempPrice === '' || tempPrice === undefined || tempPrice === null) ? 0 : parseFloat(tempPrice);
      console.log('处理后的工价:', price);
      
      const newProduct = {
        ...selectedProductTemp,
        color: selectedColorTemp || '',
        size: selectedSizeTemp || '',
        quantity: tempQuantity ? (isNaN(parseFloat(tempQuantity)) ? 0 : parseFloat(tempQuantity)) : 0,
        weight: parseFloat(tempWeight) || 0,
        price: price
      };
      
      console.log('新增货品:', newProduct.name, '数量:', newProduct.quantity, '工价:', newProduct.price, '重量:', newProduct.weight);
      
      const selectedProducts = [...this.data.selectedProducts, newProduct];
      this.setData({
        selectedProducts,
        showProductConfirmModal: false,
        selectedProductTemp: null,
        selectedColorTemp: '',
        selectedSizeTemp: '',
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
      const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight, tempPrice } = this.data;
      
      // 确保工价是数字，即使为空也转为0
      const price = (tempPrice === '' || tempPrice === undefined || tempPrice === null) ? 0 : parseFloat(tempPrice);
      console.log('处理后的工价:', price);
      
      const newProduct = {
        ...selectedProductTemp,
        color: selectedColorTemp || '',
        size: selectedSizeTemp || '',
        quantity: tempQuantity ? (isNaN(parseFloat(tempQuantity)) ? 0 : parseFloat(tempQuantity)) : 0,
        weight: parseFloat(tempWeight) || 0,
        price: price
      };
      
      console.log('继续添加货品:', newProduct.name, '数量:', newProduct.quantity, '工价:', newProduct.price, '重量:', newProduct.weight);
      
      const selectedProducts = [...this.data.selectedProducts, newProduct];
      this.setData({
        selectedProducts,
        selectedColorTemp: '',
        selectedSizeTemp: '',
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
    
    // 更全面的空值检查
    if (tempQuantity === undefined || tempQuantity === null || tempQuantity === '' || tempQuantity === 'undefined' || tempQuantity === 'null') {
      console.log('数量为空');
      wx.showToast({
        title: '请输入数量',
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
    selectedProducts[index].price = parseFloat(e.detail.value) || 0;
    console.log('设置后工价:', selectedProducts[index].price);
    
    // 立即计算该货品的小计
    const price = selectedProducts[index].price;
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
    selectedProducts[index].price = parseFloat(e.detail.value) || 0;
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
      const price = parseFloat(p.price) || 0;
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
      if (!product.price) {
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

    console.log('开始提交收回单...');
    wx.showLoading({ title: '保存中...' });
    
    // 1. 提交主订单
    const orderMain = {
      factoryId: this.data.selectedFactory ? this.data.selectedFactory.id : '',
      factoryName: this.data.selectedFactory ? this.data.selectedFactory.name : '',
      process: this.data.selectedProcess,
      date: this.data.date,
      staff: this.data.staff,
      remark: this.data.remark,
      totalWeight: this.data.totalWeight,
      totalQuantity: this.data.totalQuantity,
      fee: this.data.fee, // 工费
      paymentMethod: this.data.paymentMethod,
      paymentAmount: this.data.paymentAmount,
      orgId: wx.getStorageSync('orgId') || 'org1',
      orderType: 'receive',
      status: 'normal'
    };
    
    console.log('即将提交的收回单数据:', orderMain);
    
    this.api.addOrder(orderMain)
      .then(res => {
        console.log('收回单主数据提交结果:', res);
        
        if (!res.success || !res.data?.id) {
        wx.hideLoading();
          wx.showToast({ title: '主订单保存失败', icon: 'none' });
          return;
        }
        const orderId = res.data.id;
        const orderNo = res.data.orderNo; // 后端返回的单号
        this.setData({ orderId, orderNo }); // 保存到页面数据

        // 2. 批量提交明细
        const items = this.data.selectedProducts.map(p => ({
          orderId,
          productId: p.id,
          quantity: p.quantity ?? null,
          weight: p.weight ?? null,
          color: p.color ?? null,
          size: p.size ?? null,
          price: p.price ?? null
        }));

        console.log('即将提交的收回单明细:', items);

        return this.api.addOrderItemsBatch(items)
          .then(res2 => {
            console.log('收回单明细提交结果:', res2);
            
            wx.hideLoading();
            if (res2.success) {
              wx.showToast({ title: '保存成功', icon: 'success' });
              
              // 设置标记，通知列表页面需要刷新数据
              wx.setStorageSync('hasNewOrder', true);
              console.log('设置新订单标记，列表页将刷新数据');
              
              // 保存成功后返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
        } else {
              wx.showToast({ title: '明细保存失败', icon: 'none' });
        }
          });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('提交收回单失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
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
    // 显示加载中提示
    wx.showLoading({ title: '获取工厂信息...', mask: true });
    
    this.api.request(`/factories/${factoryId}`, 'GET')
      .then(res => {
        wx.hideLoading();
        
        if (res.success && res.data) {
          const factoryData = res.data;
          console.log('获取到的工厂详情:', factoryData);
          console.log('工厂工序数据:', factoryData.processes);
          
          // 确保工序列表是数组
          let processesList = [];
          if (factoryData.processes && Array.isArray(factoryData.processes)) {
            processesList = factoryData.processes;
          } else if (factoryData.processes && typeof factoryData.processes === 'string') {
            try {
              // 尝试解析JSON字符串
              processesList = JSON.parse(factoryData.processes);
              if (!Array.isArray(processesList)) {
                processesList = [factoryData.processes]; // 如果解析结果不是数组，则将其作为单个元素的数组
              }
            } catch (e) {
              // 如果解析失败，则尝试按逗号分割
              processesList = factoryData.processes.split(',').map(p => p.trim()).filter(p => p);
            }
          } else if (factoryData.processes) {
            // 如果是其他类型，尝试转换为数组
            processesList = [factoryData.processes];
          }
          
          console.log('处理后的工序列表:', processesList);
          
          // 更新工厂信息及工序列表
          this.setData({
            selectedFactory: factoryData,
            factoryBalance: factoryData.balance || 0,
            // 更新工序列表
            processes: processesList,
            // 重置已选工序，避免索引错误
            selectedProcess: ''
          }, () => {
            console.log('更新后的工序列表:', this.data.processes);
            // 弹窗提示工序数量
            if (processesList.length === 0) {
              wx.showToast({
                title: '该工厂未设置工序',
                icon: 'none'
              });
            } else {
              wx.showToast({
                title: `已加载${processesList.length}个工序`,
                icon: 'none'
              });
            }
          });
        } else {
          console.error('获取工厂详情失败:', res);
          wx.showToast({
            title: '获取工厂详情失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取工厂详情请求失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
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
      tempPrice: product.price ? product.price.toString() : '',
      showProductConfirmModal: true
    });
  },
  // 新增函数: 生成分享图片
  generateShareImage(orderData) {
    const that = this;
    wx.showLoading({ title: '正在生成图片...' });

    // 动态计算画布高度
    const headerHeight = 130;  // 标题和基本信息
    const productRowHeight = 60; // 每个货品的高度
    const productsHeight = orderData.products.length * productRowHeight;
    const footerHeight = 140;  // 合计和底部信息
    const calculatedHeight = headerHeight + productsHeight + footerHeight;
    
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
    // 设置背景色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 绘制标题
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('收回单', canvasWidth / 2, 30);
    
    // 绘制单号和日期
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`单号: ${orderData.orderNo}`, 20, 60);
    ctx.fillText(`日期: ${orderData.date}`, 20, 80);
    
    // 绘制工厂和工序
    ctx.fillText(`工厂: ${orderData.factoryName || ''}`, canvasWidth/2, 60);
    ctx.fillText(`工序: ${orderData.process}`, canvasWidth/2, 80);
    
    // 绘制支付方式和支付金额
    ctx.fillText(`支付方式: ${orderData.paymentMethod}`, 20, 100);
    ctx.fillText(`支付金额: ¥${orderData.paymentAmount}`, canvasWidth/2, 100);
    
    // 绘制表头背景
    const headerY = 120;
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(20, headerY, canvasWidth - 40, 30);
    
    // 绘制表头
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('货品', 60, headerY + 20);
    ctx.fillText('颜色/尺码', 140, headerY + 20);
    ctx.fillText('数量', 200, headerY + 20);
    ctx.fillText('重量(kg)', 260, headerY + 20);
    ctx.fillText('单价', 320, headerY + 20);
    
    // 绘制货品列表
    let currentY = headerY + 30;
    const products = orderData.products;
    
    products.forEach((product, index) => {
      // 设置行背景色
      ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9f9fb';
      ctx.fillRect(20, currentY, canvasWidth - 40, 50);
      
      // 绘制货品信息
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText(product.name || product.productNo, 25, currentY + 20);
      
      const colorSize = `${product.color || ''} ${product.size || ''}`;
      ctx.fillText(colorSize, 110, currentY + 20);
      
      ctx.textAlign = 'center';
      ctx.fillText(product.quantity || '-', 200, currentY + 20);
      ctx.fillText(product.weight || '-', 260, currentY + 20);
      ctx.fillText(product.price ? `¥${product.price}` : '-', 320, currentY + 20);
      
      currentY += 50;
    });
    
    // 绘制合计信息
    const totalY = currentY + 20;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`总数量: ${orderData.totalQuantity}`, canvasWidth - 240, totalY);
    ctx.fillText(`总重量: ${orderData.totalWeight}kg`, canvasWidth - 120, totalY);
    ctx.fillText(`总金额: ¥${orderData.totalAmount}`, canvasWidth - 20, totalY + 24);
    
    // 绘制备注
    if (orderData.remark) {
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`备注: ${orderData.remark}`, 20, totalY + 50);
    }
    
    // 绘制底部信息
    const footerY = canvasHeight - 30;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#86868b';
    ctx.textAlign = 'center';
    ctx.fillText(`操作员: ${orderData.staff}`, canvasWidth/2, footerY);
    ctx.fillText(`创建时间: ${new Date().toLocaleString()}`, canvasWidth/2, footerY + 20);
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
  
  fetchProducts() {
    wx.showLoading({ title: '正在加载...', mask: true });
    
    this.api.getProducts()
      .then(res => {
        this.setData({ 
          products: res.data || [],
          filteredProducts: res.data || []
        });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取产品列表失败', err);
        this.setData({ products: [], filteredProducts: [] });
        wx.hideLoading();
        wx.showToast({ title: '获取产品数据失败', icon: 'none' });
      });
  },
  
  fetchFactories() {
    wx.showLoading({ title: '正在加载...', mask: true });
    
    this.api.getFactories()
      .then(res => {
        this.setData({ factories: res.data || [] });
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取工厂列表失败', err);
        this.setData({ factories: [] });
        wx.hideLoading();
        wx.showToast({ title: '获取工厂数据失败', icon: 'none' });
      });
  },
  
  // 获取订单详情
  fetchOrderDetail(orderId) {
    if (!orderId) return;
    
    wx.showLoading({ title: '加载订单数据' });
    
    this.api.getOrderDetail(orderId)
      .then(res => {
        wx.hideLoading();
        
        if (res.success && res.data) {
          const orderData = res.data;
          console.log('获取到的订单详情:', orderData);
          
          // 设置订单数据到表单，处理可能没有的字段
          this.setData({
            orderNo: orderData.orderNo || '',
            selectedFactory: {
              id: orderData.factoryId || '',
              name: '' // 暂不设置名称，将通过getFactoryDetail获取完整的工厂信息
            },
            // 处理可能没有process字段的情况
            selectedProcess: orderData.process || orderData.processName || '',
            selectedProducts: orderData.products || [],
            paymentMethod: orderData.paymentMethod || '',
            paymentAmount: orderData.paymentAmount || '0',
            remark: orderData.remark || '',
            remarkImages: orderData.remarkImages || [],
            totalQuantity: orderData.totalQuantity || '0',
            totalAmount: orderData.totalAmount || '0',
            totalWeight: orderData.totalWeight || '0',
            staff: orderData.staff || '',
            date: orderData.date || '',
            orderStatus: orderData.status || 'normal'
          });
          
          // 计算相关值
          this.calculateTotals();
          
          // 获取工厂详情，以便获取工序列表和工厂名称
          if (orderData.factoryId) {
            this.getFactoryDetail(orderData.factoryId);
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
        console.error('获取订单详情请求失败:', err);
        wx.hideLoading();
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
});