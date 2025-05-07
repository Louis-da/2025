const api = require('../../utils/api')

function formatDateTimeToMinute(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

Page({
  data: {
    activeTab: 'send', // 默认显示发出单
    searchQuery: '',
    orders: [],
    isLoading: false,
    pageSize: 20,
    currentPage: 1,
    hasMoreData: true,
    showCanceled: false, // 是否显示作废单据
    
    // 筛选相关数据
    showFilter: false,
    filterStartDate: '',
    filterEndDate: '',
    filterFactoryIndex: 0,
    filterProcessIndex: 0,
    filterStatusIndex: 0,
    filterProductCode: '', // 添加货号筛选字段
    
    // 下拉选项
    factoryOptions: [
      { id: '', name: '全部工厂' }
    ],
    processOptions: [
      { id: '', name: '全部工序' }
    ],
    statusOptions: ['全部状态', '正常', '已作废']
  },

  onLoad() {
    // 1. 设置默认活动选项卡
    this.setData({
      activeTab: 'send'
    });
    
    // 2. 初始化默认筛选条件
    // 设置默认日期范围为近30天
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.setData({
      filterStartDate: this.formatDate(thirtyDaysAgo),
      filterEndDate: this.formatDate(today),
      filterFactoryIndex: 0,
      filterProcessIndex: 0,
      filterStatusIndex: 0
    });
    
    // 3. 加载工厂和工序数据
    this.loadFactories();
    this.loadProcesses();
    
    // 4. 准备完毕后加载订单数据
    this.loadOrderData();
  },

  onShow() {
    console.log('==== 页面显示，准备刷新数据... ====');
    
    // 从本地存储获取标记，检查是否有新增/编辑操作
    const hasNewOrder = wx.getStorageSync('hasNewOrder');
    console.log('检测hasNewOrder标记:', hasNewOrder);
    
    // 强制刷新标志 - 增加检查全局变量和其他可能的标记
    let needRefresh = hasNewOrder || 
                     getApp().globalData?.needRefreshOrders || 
                     wx.getStorageSync('orderListChanged');
    
    // 清除所有可能的刷新标记
    if (hasNewOrder) {
      wx.removeStorageSync('hasNewOrder');
      console.log('已清除hasNewOrder标记');
    }
    
    if (getApp().globalData?.needRefreshOrders) {
      getApp().globalData.needRefreshOrders = false;
      console.log('已清除全局needRefreshOrders标记');
    }
    
    if (wx.getStorageSync('orderListChanged')) {
      wx.removeStorageSync('orderListChanged');
      console.log('已清除orderListChanged标记');
    }
    
    if (needRefresh) {
      console.log('检测到数据变更，强制刷新数据');
      // 显示加载提示
      wx.showLoading({
        title: '刷新数据...',
        mask: true
      });
      
      // 重置为第一页，并清空当前数据
      this.setData({
        currentPage: 1,
        orders: [],
        hasMoreData: true
      });
      
      // 立即执行刷新，不延迟
      this.loadOrderData().then(() => {
        wx.hideLoading();
        console.log('数据刷新完成');
      }).catch(err => {
        wx.hideLoading();
        console.error('数据刷新失败:', err);
        wx.showToast({
          title: '刷新失败，请下拉重试',
          icon: 'none'
        });
      });
    } else {
      // 标准刷新 - 只有在初次显示时才完全刷新，避免频繁刷新
      console.log('标准页面刷新');
      const isFirstShow = !this.hasShown;
      this.hasShown = true;
      
      if (isFirstShow) {
        // 第一次显示，完全刷新
        this.setData({
          currentPage: 1,
          orders: []
        });
        
        this.loadOrderData().catch(err => {
          console.error('标准刷新失败:', err);
        });
      }
    }
  },
  
  // 日期格式化
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      hasMoreData: true
    });
    this.loadOrderData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMoreData && !this.data.isLoading) {
      this.loadMoreData();
    }
  },

  // 切换选项卡
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      currentPage: 1,
      hasMoreData: true,
      orders: []
    });
    this.loadOrderData();
  },

  // 搜索
  inputSearch(e) {
    this.setData({
      searchQuery: e.detail.value
    });
    
    // 延迟执行搜索，避免频繁请求
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    this.searchTimer = setTimeout(() => {
      this.setData({
        currentPage: 1,
        orders: []
      });
      this.loadOrderData();
    }, 500);
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchQuery: '',
      currentPage: 1,
      orders: []
    });
    this.loadOrderData();
  },

  // 打开筛选
  openFilter() {
    this.setData({
      showFilter: true
    });
  },
  
  // 关闭筛选
  closeFilter() {
    this.setData({
      showFilter: false
    });
  },
  
  // 开始日期改变
  onStartDateChange(e) {
    this.setData({
      filterStartDate: e.detail.value
    });
  },
  
  // 结束日期改变
  onEndDateChange(e) {
    this.setData({
      filterEndDate: e.detail.value
    });
  },
  
  // 工厂改变
  onFactoryChange(e) {
    this.setData({
      filterFactoryIndex: parseInt(e.detail.value)
    });
  },
  
  // 工序改变
  onProcessChange(e) {
    this.setData({
      filterProcessIndex: parseInt(e.detail.value)
    });
  },
  
  // 状态改变
  onStatusChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      filterStatusIndex: index,
      showCanceled: index === 2 // 当选择"已作废"时，显示作废单据
    });
  },
  
  // 货号输入
  onProductCodeInput(e) {
    this.setData({
      filterProductCode: e.detail.value
    });
  },
  
  // 重置筛选
  resetFilter() {
    // 设置默认日期范围为近30天
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    this.setData({
      filterStartDate: this.formatDate(thirtyDaysAgo),
      filterEndDate: this.formatDate(today),
      filterFactoryIndex: 0,
      filterProcessIndex: 0,
      filterStatusIndex: 0,
      filterProductCode: '' // 重置货号筛选字段
    });
  },
  
  // 应用筛选
  applyFilter() {
    this.setData({
      showFilter: false,
      currentPage: 1,
      orders: []
    });
    this.loadOrderData();
  },

  // 加载订单数据
  loadOrderData() {
    const {
      activeTab,
      currentPage,
      pageSize,
      searchQuery,
      filterStartDate,
      filterEndDate,
      filterFactoryIndex,
      filterProcessIndex,
      filterStatusIndex,
      factoryOptions,
      processOptions,
      statusOptions
    } = this.data;

    this.setData({ isLoading: true });

    // 构建筛选条件
    const filters = {
      orderType: activeTab, // activeTab值为'send'或'receive'
      keyword: searchQuery,
      startDate: filterStartDate,
      endDate: filterEndDate,
      page: currentPage,
      pageSize
    };

    // 仅当选择了具体工厂时才添加工厂筛选条件
    if (filterFactoryIndex > 0 && factoryOptions.length > filterFactoryIndex) {
      filters.factoryId = factoryOptions[filterFactoryIndex].id;
    }

    // 仅当选择了具体工序时才添加工序筛选条件
    if (filterProcessIndex > 0 && processOptions.length > filterProcessIndex) {
      filters.processId = processOptions[filterProcessIndex].id;
    }

    // 设置状态筛选条件
    if (filterStatusIndex === 1) {
      filters.status = 'normal';
    } else if (filterStatusIndex === 2) {
      filters.status = 'canceled';
    }

    // 仅当输入了货号时才添加货号筛选条件
    if (this.data.filterProductCode) {
      filters.productCode = this.data.filterProductCode;
    }

    console.log('订单查询参数:', filters);

    // 使用通用订单端点，不使用特定类型端点
    const endpoint = '/orders';
    console.log(`请求${activeTab}单列表，使用端点:`, endpoint);

    // 用真实接口请求
    wx.showLoading({ title: '加载数据中...' });
    
    const api = require('../../utils/api');
    
    // 返回Promise以支持链式调用
    return new Promise((resolve, reject) => {
      api.request(endpoint, 'GET', filters).then(res => {
        wx.hideLoading();
        console.log(`${activeTab}单列表返回数据:`, res);
        
        if (res && res.success && Array.isArray(res.data)) {
          // 增强的数据过滤逻辑 - 更严格的有效性检查
          const validOrders = res.data.filter(order => {
            // 必须有这些基本字段才是有效订单
            const hasBasicFields = order && 
                                  order.orderNo && 
                                  order.factoryName &&
                                  order.id;
                                  
            // 检查产品字段 - 至少应该有一个产品
            const hasProducts = order.products && 
                               Array.isArray(order.products) && 
                               order.products.length > 0;
            
            // 检查订单类型是否与当前标签一致
            const correctType = order.orderType === activeTab;
            
            // 综合判断
            return hasBasicFields && correctType;
          });
          
          console.log('有效订单数据:', validOrders.length, '条');
          console.log('第一条数据示例:', validOrders.length > 0 ? validOrders[0] : '无数据');
          
          // 如果过滤后数据为空但原始数据不为空，记录警告
          if (validOrders.length === 0 && res.data.length > 0) {
            console.warn('警告: 所有返回的数据都被过滤掉了！原始数据:', res.data);
          }
          
        this.setData({
            orders: validOrders,
            hasMoreData: validOrders.length === pageSize,
          isLoading: false
        });
          
          // 如果返回空数据，向用户提示
          if (validOrders.length === 0) {
            wx.showToast({
              title: '暂无数据',
              icon: 'none',
              duration: 2000
            });
          }
          
          resolve(validOrders);
      } else {
          console.error('无法解析订单数据:', res);
        this.setData({ orders: [], hasMoreData: false, isLoading: false });
          wx.showToast({ 
            title: '获取数据失败', 
            icon: 'none' 
          });
          reject(new Error('无法解析订单数据'));
      }
      }).catch((err) => {
        wx.hideLoading();
        console.error('请求订单数据出错:', err);
      this.setData({ orders: [], hasMoreData: false, isLoading: false });
        wx.showToast({ title: '获取订单数据失败', icon: 'none' });
        reject(err);
      });
    });
  },

  loadMoreData() {
    const {
      currentPage,
      orders,
      activeTab,
      filterStartDate,
      filterEndDate,
      filterFactoryIndex,
      filterProcessIndex,
      filterStatusIndex,
      factoryOptions,
      processOptions,
      searchQuery,
      pageSize
    } = this.data;

    this.setData({
      isLoading: true,
      currentPage: currentPage + 1
    });

    // 构建筛选条件
    const filters = {
      orderType: activeTab, // send 或 receive
      keyword: searchQuery,
      startDate: filterStartDate,
      endDate: filterEndDate,
      page: currentPage + 1,
      pageSize
    };

    // 仅当选择了具体工厂时才添加工厂筛选条件
    if (filterFactoryIndex > 0 && factoryOptions.length > filterFactoryIndex) {
      filters.factoryId = factoryOptions[filterFactoryIndex].id;
    }

    // 仅当选择了具体工序时才添加工序筛选条件
    if (filterProcessIndex > 0 && processOptions.length > filterProcessIndex) {
      filters.processId = processOptions[filterProcessIndex].id;
    }

    // 设置状态筛选条件
    if (filterStatusIndex === 1) {
      filters.status = 'normal';
    } else if (filterStatusIndex === 2) {
      filters.status = 'canceled';
    }

    // 仅当输入了货号时才添加货号筛选条件
    if (this.data.filterProductCode) {
      filters.productCode = this.data.filterProductCode;
    }

    console.log('加载更多订单参数:', filters);

    // 使用通用订单端点，不使用特定类型端点
    const endpoint = '/orders';
    
    wx.showLoading({ title: '加载更多...' });
    
    const api = require('../../utils/api');
    api.request(endpoint, 'GET', filters).then(res => {
      wx.hideLoading();
      
      if (res && res.success && Array.isArray(res.data)) {
        // 使用与loadOrderData相同的增强过滤逻辑
        const validOrders = res.data.filter(order => {
          // 必须有这些基本字段才是有效订单
          const hasBasicFields = order && 
                                order.orderNo && 
                                order.factoryName &&
                                order.id;
                                
          // 检查产品字段 - 至少应该有一个产品
          const hasProducts = order.products && 
                             Array.isArray(order.products) && 
                             order.products.length > 0;
          
          // 检查订单类型是否与当前标签一致
          const correctType = order.orderType === activeTab;
          
          // 综合判断
          return hasBasicFields && correctType;
        });
        
        console.log('加载更多有效数据:', validOrders.length, '条');
        
        const allOrders = [...orders, ...validOrders];
        this.setData({
          orders: allOrders,
          hasMoreData: validOrders.length === pageSize,
          isLoading: false
        });
        
        // 如果没有加载到新数据，提示用户
        if (validOrders.length === 0) {
          wx.showToast({
            title: '没有更多数据',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        console.error('无法解析更多订单数据:', res);
        this.setData({
          isLoading: false,
          hasMoreData: false
        });
        wx.showToast({
          title: '加载更多失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('加载更多数据出错:', err);
      wx.hideLoading();
      this.setData({
        isLoading: false,
        hasMoreData: false
      });
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      });
    });
  },

  // 查看订单详情
  viewOrderDetail(e) {
    const id = e.currentTarget.dataset.id;
    const type = this.data.activeTab === 'send' ? 'send-order' : 'receive-order';
    wx.navigateTo({ 
      url: `/pages/${type}/${type}?id=${id}&mode=view` 
    });
  },

  // 跳转到添加页面
  navigateToAdd() {
    const url = this.data.activeTab === 'send' ? '/pages/send-order/send-order' : '/pages/receive-order/receive-order';
    wx.navigateTo({ url });
  },

  // 跳转到收发流水表
  navigateToFlowTable() {
    wx.navigateTo({ url: '/pages/flow-table/flow-table' });
  },
  
  // 跳转到对账单
  navigateToStatement() {
    wx.navigateTo({ url: '/pages/statement/statement' });
  },

  // 处理分享按钮点击
  handleShare(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    wx.showLoading({ title: '正在生成...' });
    const { orders } = this.data;
    let order = orders.find(item => item.id === id);
    // 明细字段兼容 products/productDetails
    const hasDetails = (order.productDetails && order.productDetails.length > 0) || (order.products && order.products.length > 0);
    if (!hasDetails) {
      // 请求明细
      api.request(`/order_items?orderId=${id}`, 'GET').then(res => {
        // 兼容明细字段
        order.productDetails = res.data || [];
        this._doShare(type, order);
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '获取明细失败', icon: 'none' });
      });
    } else {
      // 若只有products字段，赋值给productDetails，保证绘图兼容
      if (!order.productDetails && order.products) {
        order.productDetails = order.products;
      }
      this._doShare(type, order);
    }
  },
  _doShare(type, order) {
    if (type === 'send') {
      this.generateSendOrderShareImage(order);
    } else {
      this.generateReceiveOrderShareImage(order);
    }
  },
  
  // 生成发出单分享图片
  generateSendOrderShareImage(orderData) {
    // 创建临时画布上下文
    const canvasWidth = 1100; // 保持宽度为1100
    const canvasHeight = 1900; // 保持高度为1900
    
    wx.showLoading({ title: '生成图片中...' });
    
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // 开始绘制
        this.drawSendOrderImage(ctx, canvas.width, canvas.height, orderData);
        
        // 将canvas内容转为图片，限制大小在300kb左右
        wx.canvasToTempFilePath({
          canvas: canvas,
          width: canvasWidth,
          height: canvasHeight,
          destWidth: canvasWidth,
          destHeight: canvasHeight,
          fileType: 'jpg',
          quality: 0.85, // 调整质量以控制文件大小
          success: (res) => {
            wx.hideLoading();
            // 弹出分享窗口
            this.showShareModal(res.tempFilePath, orderData, 'send');
          },
          fail: (err) => {
            console.error('canvas转图片失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '生成图片失败',
              icon: 'none'
            });
          }
        });
      });
  },
  
  // 生成收回单分享图片
  generateReceiveOrderShareImage(orderData) {
    // 创建临时画布上下文
    const canvasWidth = 1100; // 保持宽度为1100
    const canvasHeight = 1900; // 保持高度为1900
    
    wx.showLoading({ title: '生成图片中...' });
    
    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // 开始绘制
        this.drawReceiveOrderImage(ctx, canvas.width, canvas.height, orderData);
        
        // 将canvas内容转为图片，限制大小在300kb左右
        wx.canvasToTempFilePath({
          canvas: canvas,
          width: canvasWidth,
          height: canvasHeight,
          destWidth: canvasWidth,
          destHeight: canvasHeight,
          fileType: 'jpg',
          quality: 0.85, // 调整质量以控制文件大小
          success: (res) => {
            wx.hideLoading();
            // 弹出分享窗口
            this.showShareModal(res.tempFilePath, orderData, 'receive');
          },
          fail: (err) => {
            console.error('canvas转图片失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '生成图片失败',
              icon: 'none'
            });
          }
        });
      });
  },
  
  // 绘制发出单图片
  drawSendOrderImage(ctx, canvasWidth, canvasHeight, orderData) {
    // 设置背景色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 设置字体和颜色（苹果风格）
    const titleFont = 'bold 60px -apple-system, SF Pro Display, SF Pro Text, PingFang SC, Helvetica Neue';
    const headerFont = '40px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const subheaderFont = '36px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const bodyFont = '34px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const smallFont = '28px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const detailFont = '30px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    
    const primaryColor = '#000000';
    const secondaryColor = '#8e8e93';
    const accentColor = '#007aff';
    const bgColor = '#f5f7fa';
    const borderColor = '#e5e5ea';
    
    // 页面边距
    const margin = 80;
    
    // 绘制标题 - 格式为：公司名称 | 工序 | 单据类型
    ctx.fillStyle = primaryColor;
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    const title = `${orderData.factoryName} | ${orderData.process} | 发出单`;
    ctx.fillText(title, canvasWidth / 2, margin + 40);
    
    // 添加一条分隔线
    ctx.fillStyle = borderColor;
    ctx.fillRect(margin, margin + 80, canvasWidth - margin * 2, 2);
    
    // 绘制单号和日期
    ctx.font = subheaderFont;
    ctx.fillStyle = secondaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(`单号: ${orderData.orderNo}`, margin, margin + 160);
    ctx.fillText(`日期: ${orderData.date}`, canvasWidth - margin - 300, margin + 160);
    
    // 绘制货品表格
    const tableTop = margin + 200;
    
    // 绘制表头背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(margin, tableTop, canvasWidth - margin * 2, 80);
    
    // 绘制表头
    ctx.fillStyle = secondaryColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    
    // 表头列
    const colHeaders = ['货号/名称', '颜色', '尺码', '数量', '重量(kg)'];
    const colWidths = [0.35, 0.15, 0.15, 0.15, 0.2]; // 占比
    const tableWidth = canvasWidth - margin * 2;
    
    let colX = margin;
    colHeaders.forEach((header, index) => {
      const colWidth = tableWidth * colWidths[index];
      if (index === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(header, colX + 40, tableTop + 50);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(header, colX + colWidth / 2, tableTop + 50);
      }
      colX += colWidth;
    });
    
    // 添加表格线
    ctx.fillStyle = borderColor;
    ctx.fillRect(margin, tableTop + 80, canvasWidth - margin * 2, 1);
    
    // 绘制货品列表
    let currentY = tableTop + 80;
    const rowHeight = 120;
    
    (orderData.productDetails || []).forEach((product, index) => {
      // 设置行背景色
      ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9f9fb';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      
      // 绘制货品信息
      colX = margin;
      ctx.fillStyle = primaryColor;
      ctx.font = bodyFont;
      
      // 货号/名称列
      ctx.textAlign = 'left';
      const productName = `${product.productNo || '-'}\n${product.name || ''}`;
      const lines = productName.split('\n');
      
      lines.forEach((line, i) => {
        ctx.fillText(line, colX + 40, currentY + 40 + (i * 40));
      });
      colX += tableWidth * colWidths[0];
      
      // 颜色列
      ctx.textAlign = 'center';
      ctx.fillText(product.color || '-', colX + tableWidth * colWidths[1] / 2, currentY + 60);
      colX += tableWidth * colWidths[1];
      
      // 尺码列
      ctx.fillText(product.size || '-', colX + tableWidth * colWidths[2] / 2, currentY + 60);
      colX += tableWidth * colWidths[2];
      
      // 数量列
      ctx.fillText(product.quantity || '-', colX + tableWidth * colWidths[3] / 2, currentY + 60);
      colX += tableWidth * colWidths[3];
      
      // 重量列
      ctx.fillText(product.weight || '-', colX + tableWidth * colWidths[4] / 2, currentY + 60);
      
      // 添加行分隔线
      ctx.fillStyle = borderColor;
      ctx.fillRect(margin, currentY + rowHeight, tableWidth, 1);
      
      currentY += rowHeight;
    });
    
    if (!orderData.productDetails || orderData.productDetails.length === 0) {
      // 如果没有货品，绘制一行空数据
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.fillStyle = secondaryColor;
      ctx.textAlign = 'center';
      ctx.fillText('暂无货品数据', canvasWidth / 2, currentY + 60);
      
      // 添加行分隔线
      ctx.fillStyle = borderColor;
      ctx.fillRect(margin, currentY + rowHeight, tableWidth, 1);
      
      currentY += rowHeight;
    }
    
    // 绘制合计信息 - 确保与明细列对齐
    const totalBoxY = currentY + 40;
    ctx.fillStyle = bgColor;
    ctx.fillRect(margin, totalBoxY, tableWidth, 120);
    
    // 绘制合计标题和数据
    ctx.fillStyle = primaryColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    ctx.fillText('合计:', margin + 40, totalBoxY + 70);
    
    // 计算总数量和总重量
    const totalQuantity = (orderData.productDetails || []).reduce((sum, product) => sum + (parseFloat(product.quantity) || 0), 0) || orderData.quantity || 0;
    const totalWeight = (orderData.productDetails || []).reduce((sum, product) => sum + parseFloat(product.weight || 0), 0).toFixed(1) || orderData.weight || 0;
    
    // 绘制总计数据，与上方列对齐
    const colPos = [];
    let tmpColX = margin;
    colWidths.forEach(width => {
      colPos.push(tmpColX + tableWidth * width / 2);
      tmpColX += tableWidth * width;
    });
    
    ctx.textAlign = 'center';
    ctx.fillText(`${totalQuantity}`, colPos[3], totalBoxY + 70); // 数量列对齐
    ctx.fillText(`${totalWeight}`, colPos[4], totalBoxY + 70); // 重量列对齐
    
    // 绘制备注区域
    const remarkY = totalBoxY + 160;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(margin, remarkY, tableWidth, 140);
    
    ctx.fillStyle = secondaryColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    ctx.fillText('备注:', margin + 40, remarkY + 60);
    
    ctx.fillStyle = primaryColor;
    ctx.font = detailFont;
    const remark = orderData.remark || '无';
    ctx.fillText(remark, margin + 140, remarkY + 60);
    
    // 绘制底部信息
    const footerY = canvasHeight - margin - 40;
    ctx.font = smallFont;
    ctx.fillStyle = secondaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(`制单人: ${orderData.staff || ''}`, margin, footerY);
    ctx.textAlign = 'right';
    // 时间只显示到分钟
    ctx.fillText(`制单日期: ${formatDateTimeToMinute(orderData.date || new Date())}`, canvasWidth - margin, footerY);
  },
  
  // 绘制收回单图片
  drawReceiveOrderImage(ctx, canvasWidth, canvasHeight, orderData) {
    // 设置背景色
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 设置字体和颜色（苹果风格）
    const titleFont = 'bold 60px -apple-system, SF Pro Display, SF Pro Text, PingFang SC, Helvetica Neue';
    const headerFont = '40px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const subheaderFont = '36px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const bodyFont = '34px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const smallFont = '28px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    const detailFont = '30px -apple-system, SF Pro Text, PingFang SC, Helvetica Neue';
    
    const primaryColor = '#000000';
    const secondaryColor = '#8e8e93';
    const accentColor = '#007aff';
    const bgColor = '#f5f7fa';
    const borderColor = '#e5e5ea';
    const successColor = '#34c759';
    const warningColor = '#ff9500';
    
    // 页面边距
    const margin = 80;
    
    // 绘制标题 - 格式为：公司名称 | 工序 | 单据类型
    ctx.fillStyle = primaryColor;
    ctx.font = titleFont;
    ctx.textAlign = 'center';
    const title = `${orderData.factoryName} | ${orderData.process} | 收回单`;
    ctx.fillText(title, canvasWidth / 2, margin + 40);
    
    // 添加一条分隔线
    ctx.fillStyle = borderColor;
    ctx.fillRect(margin, margin + 80, canvasWidth - margin * 2, 2);
    
    // 绘制单号和日期
    ctx.font = subheaderFont;
    ctx.fillStyle = secondaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(`单号: ${orderData.orderNo}`, margin, margin + 160);
    ctx.fillText(`日期: ${orderData.date}`, canvasWidth - margin - 300, margin + 160);
    
    // 绘制货品表格
    const tableTop = margin + 200;
    
    // 绘制表头背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(margin, tableTop, canvasWidth - margin * 2, 80);
    
    // 绘制表头
    ctx.fillStyle = secondaryColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    
    // 表头列 - 收回单需要添加工费和工价列
    const tableWidth = canvasWidth - margin * 2;
    // 总是包含工费和工价列
    const colHeaders = ['货号/名称', '颜色', '尺码', '数量', '重量(kg)', '工费(¥)', '工价(¥/kg)'];
    const colWidths = [0.25, 0.1, 0.1, 0.1, 0.15, 0.15, 0.15]; // 比例调整
    
    let colX = margin;
    colHeaders.forEach((header, index) => {
      const colWidth = tableWidth * colWidths[index];
      if (index === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(header, colX + 40, tableTop + 50);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(header, colX + colWidth / 2, tableTop + 50);
      }
      colX += colWidth;
    });
    
    // 添加表格线
    ctx.fillStyle = borderColor;
    ctx.fillRect(margin, tableTop + 80, tableWidth, 1);
    
    // 绘制货品列表
    let currentY = tableTop + 80;
    const rowHeight = 120;
    
    (orderData.productDetails || []).forEach((product, index) => {
      // 设置行背景色
      ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f9f9fb';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      
      // 绘制货品信息
      colX = margin;
      ctx.fillStyle = primaryColor;
      ctx.font = bodyFont;
      
      // 货号/名称列
      ctx.textAlign = 'left';
      const productName = `${product.productNo || '-'}\n${product.name || ''}`;
      const lines = productName.split('\n');
      
      lines.forEach((line, i) => {
        ctx.fillText(line, colX + 40, currentY + 40 + (i * 40));
      });
      colX += tableWidth * colWidths[0];
      
      // 颜色列
      ctx.textAlign = 'center';
      ctx.fillText(product.color || '-', colX + tableWidth * colWidths[1] / 2, currentY + 60);
      colX += tableWidth * colWidths[1];
      
      // 尺码列
      ctx.fillText(product.size || '-', colX + tableWidth * colWidths[2] / 2, currentY + 60);
      colX += tableWidth * colWidths[2];
      
      // 数量列
      ctx.fillText(product.quantity || '-', colX + tableWidth * colWidths[3] / 2, currentY + 60);
      colX += tableWidth * colWidths[3];
      
      // 重量列
      ctx.fillText(product.weight || '-', colX + tableWidth * colWidths[4] / 2, currentY + 60);
      colX += tableWidth * colWidths[4];
      
      // 工费列
      ctx.fillText(product.fee || '-', colX + tableWidth * colWidths[5] / 2, currentY + 60);
      colX += tableWidth * colWidths[5];
      
      // 工价列
      ctx.fillText(product.pricePerKg || '-', colX + tableWidth * colWidths[6] / 2, currentY + 60);
      
      // 添加行分隔线
      ctx.fillStyle = borderColor;
      ctx.fillRect(margin, currentY + rowHeight, tableWidth, 1);
      
      currentY += rowHeight;
    });
    
    if (!orderData.productDetails || orderData.productDetails.length === 0) {
      // 如果没有货品，绘制一行空数据
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.fillStyle = secondaryColor;
      ctx.textAlign = 'center';
      ctx.fillText('暂无货品数据', canvasWidth / 2, currentY + 60);
      
      // 添加行分隔线
      ctx.fillStyle = borderColor;
      ctx.fillRect(margin, currentY + rowHeight, tableWidth, 1);
      
      currentY += rowHeight;
    }
    
    // 绘制合计信息
    const totalBoxY = currentY + 40;
    ctx.fillStyle = bgColor;
    ctx.fillRect(margin, totalBoxY, tableWidth, 120);
    
    // 绘制合计标题
    ctx.fillStyle = primaryColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    ctx.fillText('合计:', margin + 40, totalBoxY + 70);
    
    // 计算总计
    const totalQuantity = (orderData.productDetails || []).reduce((sum, product) => sum + (parseFloat(product.quantity) || 0), 0) || orderData.quantity || 0;
    const totalWeight = (orderData.productDetails || []).reduce((sum, product) => sum + (parseFloat(product.weight) || 0), 0).toFixed(1) || orderData.weight || 0;
    const totalFee = (orderData.productDetails || []).reduce((sum, product) => sum + (parseFloat(product.fee) || 0), 0).toFixed(2) || orderData.fee || 0;
    
    // 绘制总计数据，与上方列对齐
    const colPos = [];
    let tmpColX = margin;
    colWidths.forEach(width => {
      colPos.push(tmpColX + tableWidth * width / 2);
      tmpColX += tableWidth * width;
    });
    
    ctx.textAlign = 'center';
    ctx.fillText(`${totalQuantity}`, colPos[3], totalBoxY + 70); // 数量列对齐
    ctx.fillText(`${totalWeight}`, colPos[4], totalBoxY + 70); // 重量列对齐
    ctx.fillText(`¥${totalFee}`, colPos[5], totalBoxY + 70); // 工费列对齐
    
    // 绘制支付信息块
    const paymentTop = totalBoxY + 160;
    ctx.fillStyle = bgColor;
    ctx.fillRect(margin, paymentTop, tableWidth, 200);
    
    // 添加支付信息标题
    ctx.fillStyle = accentColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    ctx.fillText('支付信息', margin + 40, paymentTop + 50);
    
    // 添加支付方式
    const paymentMethod = orderData.paymentMethod || '微信支付'; // 默认值
    const paymentAmount = orderData.paymentAmount || totalFee || 0;
    const balance = orderData.balance || 0; // 累计结余
    
    ctx.fillStyle = secondaryColor;
    ctx.font = bodyFont;
    ctx.textAlign = 'left';
    ctx.fillText('支付方式:', margin + 40, paymentTop + 100);
    
    ctx.fillStyle = primaryColor;
    ctx.fillText(paymentMethod, margin + 200, paymentTop + 100);
    
    // 添加支付金额
    ctx.fillStyle = secondaryColor;
    ctx.fillText('支付金额:', margin + 40, paymentTop + 150);
    
    ctx.fillStyle = primaryColor;
    ctx.fillText(`¥${paymentAmount}`, margin + 200, paymentTop + 150);
    
    // 添加累计结余/欠款
    ctx.fillStyle = secondaryColor;
    ctx.fillText(balance >= 0 ? '累计结余:' : '累计欠款:', margin + 400, paymentTop + 150);
    
    // 结余为正显示绿色，为负显示橙色
    ctx.fillStyle = balance >= 0 ? successColor : warningColor;
    ctx.fillText(`¥${Math.abs(balance)}`, margin + 560, paymentTop + 150);
    
    // 绘制备注区域
    const remarkY = paymentTop + 210;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(margin, remarkY, tableWidth, 140);
    
    ctx.fillStyle = secondaryColor;
    ctx.font = subheaderFont;
    ctx.textAlign = 'left';
    ctx.fillText('备注:', margin + 40, remarkY + 60);
    
    ctx.fillStyle = primaryColor;
    ctx.font = detailFont;
    const remark = orderData.remark || '无';
    ctx.fillText(remark, margin + 140, remarkY + 60);
    
    // 绘制底部信息
    const footerY = canvasHeight - margin - 40;
    ctx.font = smallFont;
    ctx.fillStyle = secondaryColor;
    ctx.textAlign = 'left';
    ctx.fillText(`制单人: ${orderData.staff || ''}`, margin, footerY);
    ctx.textAlign = 'right';
    // 时间只显示到分钟
    ctx.fillText(`制单日期: ${formatDateTimeToMinute(orderData.date || new Date())}`, canvasWidth - margin, footerY);
  },
  
  // 显示分享弹窗
  showShareModal(imagePath, orderData, type) {
    // 直接弹出操作菜单，提供保存图片和分享给好友的选项
    wx.hideLoading();
    
    // 将图片路径临时保存，以便后续使用
    this.shareImagePath = imagePath;
    
    wx.showActionSheet({
      itemList: ['保存图片到相册', '分享给微信好友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 保存图片到相册
          wx.saveImageToPhotosAlbum({
            filePath: imagePath,
            success: () => {
              wx.showToast({
                title: '已保存到相册',
                icon: 'success'
              });
            },
            fail: (err) => {
              console.error('保存图片失败:', err);
              if (err.errMsg.indexOf('auth deny') >= 0) {
                wx.showModal({
                  title: '提示',
                  content: '需要您授权保存相册',
                  confirmText: '去设置',
                  success: (res) => {
                    if (res.confirm) {
                      wx.openSetting();
                    }
                  }
                });
              } else {
                wx.showToast({
                  title: '保存失败，请重试',
                  icon: 'none'
                });
              }
            }
          });
        } else if (res.tapIndex === 1) {
          // 使用微信转发
          wx.showShareImageMenu({
            path: imagePath,
            fail: (err) => {
              console.error('分享失败:', err);
              wx.showToast({
                title: '分享失败，请重试',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },
  
  // 加载工厂数据
  loadFactories() {
    api.request('/factories', 'GET')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          // 添加"全部工厂"选项
          const factories = [
            { id: '', name: '全部工厂' },
            ...res.data
          ];
          
          this.setData({ factoryOptions: factories });
        }
      })
      .catch(err => {
        console.error('加载工厂数据失败:', err);
      });
  },
  
  // 加载工序数据
  loadProcesses() {
    api.request('/processes', 'GET')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          // 添加"全部工序"选项
          const processes = [
            { id: '', name: '全部工序' },
            ...res.data
          ];
          
          this.setData({ processOptions: processes });
        }
      })
      .catch(err => {
        console.error('加载工序数据失败:', err);
      });
  }
});