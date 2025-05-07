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
    products: [],
    filteredProducts: [],
    selectedProducts: [],
    remark: '',
    remarkPhotos: [], // 新增: 备注图片数组
    totalWeight: 0,
    totalQuantity: 0,
    staff: '',
    date: '',
    showProductModal: false,
    productSearchKeyword: '',
    selectedProductTemp: null,
    selectedColorTemp: '',
    selectedSizeTemp: '',
    tempQuantity: '',
    tempWeight: '',
    currentDate: '',
    availableProducts: [
      {
        id: '1',
        name: '男装T恤',
        code: 'TS001',
        image: '/images/product-placeholder.png'
      },
      {
        id: '2',
        name: '女装连衣裙',
        code: 'DRS002',
        image: '/images/product-placeholder.png'
      },
      {
        id: '3',
        name: '牛仔裤',
        code: 'JN003',
        image: '/images/product-placeholder.png'
      }
    ],
    colorOptions: ['红色', '蓝色', '黑色', '白色', '灰色'],
    sizeOptions: ['S', 'M', 'L', 'XL', 'XXL'],
    // 新增分享相关数据
    canvasWidth: 375,    // 画布宽度，单位px
    canvasHeight: 500,   // 画布高度，初始值
    shareImagePath: '',  // 分享图片路径
    showShareModalFlag: false // 是否显示分享弹窗
  },
  
  onLoad(options) {
    // 导入API模块
    this.api = require('../../utils/api');
    
    console.log('订单页面参数:', options);
    
    // 获取当前日期
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    
    // 获取用户名或默认值
    const staffName = wx.getStorageSync('username') || '管理员';
    
    if (options.id) {
      // 编辑/查看模式
      this.setData({
        orderId: options.id,
        mode: options.mode || 'view'
      });
      
      // 加载订单详情
      this.fetchOrderDetail(options.id);
    } else {
      // 新增模式
      this.setData({
        mode: 'add',
        date: currentDate,
        staff: staffName
      });
    }
    
    // 获取基础数据
    this.fetchFactories();
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
  
  onReady() {
    // 根据当前模式设置标题
    const title = this.data.mode === 'view' ? '发出单' : (this.data.mode === 'edit' ? '编辑发出单' : '新增发出单');
    wx.setNavigationBarTitle({
      title: title
    });
  },
  
  fetchFactories() {
    wx.showLoading({ title: '加载工厂列表...', mask: true });
    
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
  
  fetchProducts() {
    wx.showLoading({ title: '加载产品列表...', mask: true });
    
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
  
  /**
   * 获取发货单详情
   */
  fetchOrderDetail(orderId) {
    wx.showLoading({ title: '获取订单数据', mask: true });
    
    this.api.getOrderDetail(orderId)
      .then(res => {
        wx.hideLoading();
        
        if (res.success && res.data) {
          const orderData = res.data;
          console.log('获取到的订单详情:', orderData);
          
          // 设置订单数据，处理可能没有的字段
          this.setData({
            orderNo: orderData.orderNo || '',
            selectedFactory: {
              id: orderData.factoryId || '',
              name: '' // 暂不设置名称，将通过getFactoryDetail获取完整的工厂信息
            },
            // 处理可能没有process字段的情况
            selectedProcess: orderData.process || orderData.processName || '',
            selectedProducts: orderData.products || [],
            remark: orderData.remark || '',
            remarkPhotos: orderData.remarkImages || [],
            totalWeight: orderData.totalWeight || 0,
            totalQuantity: orderData.totalQuantity || 0,
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
          
          // 将所选工厂保存到data中
          this.setData({
            selectedFactory: factoryData,
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
  
  selectProcess(e) {
    const index = e.detail.value;
    this.setData({ selectedProcess: this.data.processes[index] });
  },
  
  showProductSelect() {
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
    const product = this.data.filteredProducts[index];
    
    this.setData({
      selectedProductTemp: product,
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: '',
      showProductModal: false
    });
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
    const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight } = this.data;
    
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
      color: selectedColorTemp,
      size: selectedSizeTemp,
      quantity: tempQuantity || '0',
      weight: tempWeight || '0'
    };
    
    // 添加到货品列表
    const selectedProducts = [...this.data.selectedProducts, newProduct];
    
    this.setData({
      selectedProducts,
      // 重置所有输入项，包括颜色和尺码
      selectedColorTemp: '',
      selectedSizeTemp: '',
      tempQuantity: '',
      tempWeight: ''
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
    const { selectedProductTemp, selectedColorTemp, selectedSizeTemp, tempQuantity, tempWeight } = this.data;
    
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
      color: selectedColorTemp,
      size: selectedSizeTemp,
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
      tempWeight: ''
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
        imageUrl: product.imageUrl,
        colorOptions: product.colorOptions,
        sizeOptions: product.sizeOptions
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
      orgId: wx.getStorageSync('orgId') || 'org1',
      orderType: 'send',
      status: 'normal'
    };
    
    console.log('即将提交的订单数据:', orderMain);
    
    this.api.addOrder(orderMain)
      .then(res => {
        console.log('订单主数据提交结果:', res);
        
        if (!res.success || !res.data?.id) {
          wx.hideLoading();
          wx.showToast({ title: '主订单保存失败', icon: 'none' });
          return;
        }
        const orderId = res.data.id;
        const orderNo = res.data.orderNo;
        this.setData({ orderId, orderNo });
        console.log('获取到的订单ID:', orderId);

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

        console.log('即将提交的订单明细:', items);

        return this.api.addOrderItemsBatch(items)
          .then(res2 => {
            console.log('订单明细提交结果:', res2);
            
            wx.hideLoading();
            if (res2.success) {
              wx.showToast({
                title: '保存成功', 
                icon: 'success',
                mask: true  // 防止用户点击其他内容
              });
              
              // 设置标记，通知列表页面需要刷新数据
              wx.setStorageSync('hasNewOrder', true);
              console.log('设置新订单标记，列表页将刷新数据');
              
              // 保存成功后返回上一页 - 增加可靠性的修改
              setTimeout(() => {
                try {
                  wx.navigateBack({
                    fail: function() {
                      // 如果返回失败，可能是因为没有上一页，尝试重定向到列表页
                      wx.redirectTo({
                        url: '/pages/send-receive/send-receive'
                      });
                    }
                  });
                } catch (e) {
                  console.error('返回上一页失败:', e);
                  // 兜底方案：直接跳转到列表页
                  wx.redirectTo({
                    url: '/pages/send-receive/send-receive'
                  });
                }
              }, 1000);  // 缩短延迟时间到1秒
            } else {
              wx.showToast({ title: '明细保存失败', icon: 'none' });
            }
          });
      })
      .catch(err => {
        wx.hideLoading();
        console.error('提交发出单失败:', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },
  
  cancelOrder() {
    wx.showModal({
      title: '确认作废',
      content: '确定要作废此单据吗？作废后不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中' });
          
          // 调用API取消订单
          this.api.updateOrderStatus(this.data.orderId, 'canceled')
            .then(res => {
              wx.hideLoading();
              if (res.success) {
                this.setData({ orderStatus: 'canceled' });
                
                // 设置标记，通知列表页面需要刷新数据
                wx.setStorageSync('hasNewOrder', true);
                console.log('设置订单状态变更标记，列表页将刷新数据');
                
                wx.showToast({ 
                  title: '作废成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({ 
                  title: '作废失败，请重试',
                  icon: 'none'
                });
              }
            })
            .catch(err => {
              console.error('取消订单失败', err);
              wx.hideLoading();
              wx.showToast({
                title: '网络错误，请重试',
                icon: 'none'
              });
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
        
        // 模拟上传过程，实际项目中应该调用上传API
        setTimeout(() => {
          const remarkPhotos = [...that.data.remarkPhotos, tempFilePath];
          that.setData({
            remarkPhotos
          });
          wx.hideLoading();
          
          // 实际项目中的上传代码可能类似这样：
          // url: 'https://example.com/upload', // TODO: 替换为实际上传接口
        }, 1000);
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

  // 新增函数: 生成分享图片
  generateShareImage(orderData) {
    const that = this;
    wx.showLoading({ title: '正在生成图片...' });

    // 动态计算画布高度
    const headerHeight = 120;  // 标题和基本信息
    const productRowHeight = 60; // 每个货品的高度
    const productsHeight = orderData.products.length * productRowHeight;
    const footerHeight = 120;  // 合计和底部信息
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
    ctx.fillText('发出单', canvasWidth / 2, 30);
    
    // 绘制单号和日期
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`单号: ${orderData.orderNo}`, 20, 60);
    ctx.fillText(`日期: ${orderData.date}`, 20, 80);
    
    // 绘制工厂和工序
    ctx.fillText(`工厂: ${orderData.factoryName || ''}`, canvasWidth/2, 60);
    ctx.fillText(`工序: ${orderData.process}`, canvasWidth/2, 80);
    
    // 绘制表头背景
    const headerY = 100;
    ctx.fillStyle = '#f5f5f7';
    ctx.fillRect(20, headerY, canvasWidth - 40, 30);
    
    // 绘制表头
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText('货品', 60, headerY + 20);
    ctx.fillText('颜色/尺码', 140, headerY + 20);
    ctx.fillText('数量', 220, headerY + 20);
    ctx.fillText('重量(kg)', 290, headerY + 20);
    
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
      ctx.fillText(colorSize, 120, currentY + 20);
      
      ctx.textAlign = 'center';
      ctx.fillText(product.quantity || '-', 220, currentY + 20);
      ctx.fillText(product.weight || '-', 290, currentY + 20);
      
      currentY += 50;
    });
    
    // 绘制合计信息
    const totalY = currentY + 20;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`总数量: ${orderData.totalQuantity}`, canvasWidth - 150, totalY);
    ctx.fillText(`总重量: ${orderData.totalWeight}kg`, canvasWidth - 20, totalY);
    
    // 绘制备注
    if (orderData.remark) {
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`备注: ${orderData.remark}`, 20, totalY + 30);
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