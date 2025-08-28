const api = require('../../utils/api')
const { formatDate } = require('../../utils/util');
const { getFullImageUrl } = require('../../utils/image'); // 引入 getFullImageUrl
const { formatDateTimeToMinute, fixIOSDateString } = require('../../utils/datetime'); // 从公共工具文件引入

Page({
  data: {
    activeTab: 'send', // 默认显示发出单
    searchQuery: '',
    orders: [],
    isLoading: false,
    pageSize: 20,
    currentPage: 1,
    hasMoreData: true,
    showCanceled: true, // 修改为默认显示作废单据
    
    // 筛选相关数据
    showFilter: false,
    filterStartDate: '',
    filterEndDate: '',
    filterFactoryIndex: 0,
    filterProcessIndex: 0,
    filterStatusIndex: 0,
    filterProductCode: '', // 添加货号筛选字段
    
    // 工厂搜索相关数据
    filterFactorySearchKeyword: '',
    showFilterFactoryDropdown: false,
    selectedFilterFactory: null,
    filteredFilterFactories: [],
    hideFilterFactoryDropdownTimer: null,
    
    // 下拉选项
    factoryOptions: [
      { id: '', name: '全部工厂' }
    ],
    processOptions: [
      { id: '', name: '全部工序' }
    ],
    statusOptions: ['全部', '正常', '已作废'],
    
    // 添加用户筛选标志到data，避免使用实例变量
    hasUserFiltered: false,
    
    // 调试标志
    lastRequestFilters: null, // 保存最后一次请求的筛选条件
    
    // 底部统计数据
    totalSendCount: 0, // 新增：有效发出单数量
    totalSendQuantity: 0,
    totalSendWeight: 0,
    totalReceiveCount: 0, // 新增：有效收回单数量
    totalReceiveQuantity: 0,
    totalReceiveWeight: 0,
    totalAmount: 0,
    totalPayment: 0,
    
    // 动态字体类名
    totalSendQuantityClass: '',
    totalSendWeightClass: '',
    totalReceiveQuantityClass: '',
    totalReceiveWeightClass: '',
    totalAmountClass: '',
    totalPaymentClass: ''
  },

  onLoad() {
    // 1. 设置默认活动选项卡
    const todayStr = this.formatDate(new Date());
    this.setData({
      activeTab: 'send',
      hasUserFiltered: false, // 重置用户筛选标志
      filterStartDate: todayStr,
      filterEndDate: todayStr,
      filterFactoryIndex: 0,
      filterProcessIndex: 0,
      filterStatusIndex: 0
    });
    
    // 3. 加载工厂和工序数据
    this.loadFactories();
    this.loadProcesses();
    
    // 4. 准备完毕后加载订单数据
    this.loadOrderData().then(() => {
      // 筛选完成后计算统计数据
      this.calculateStatistics();
    });
  },

  onShow() {
    // 从本地存储获取标记，检查是否有新增/编辑操作
    const hasNewOrder = wx.getStorageSync('hasNewOrder');
    
    // 强制刷新标志 - 增加检查全局变量和其他可能的标记
    let needRefresh = hasNewOrder || 
                     getApp().globalData && getApp().globalData.needRefreshOrders || 
                     wx.getStorageSync('orderListChanged');
    
    // 清除所有可能的刷新标记
    if (hasNewOrder) {
      wx.removeStorageSync('hasNewOrder');
    }
    
    if (getApp().globalData && getApp().globalData.needRefreshOrders) {
      getApp().globalData.needRefreshOrders = false;
    }
    
    if (wx.getStorageSync('orderListChanged')) {
      wx.removeStorageSync('orderListChanged');
    }
    
    // 重置用户筛选标志，确保默认显示今天日期
    this.setData({
      hasUserFiltered: false
    });
    
    if (needRefresh) {
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
        // 刷新完成后计算统计数据
        this.calculateStatistics();
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
      const isFirstShow = !this.hasShown;
      this.hasShown = true;
      
      if (isFirstShow) {
        // 第一次显示，完全刷新
        this.setData({
          currentPage: 1,
          orders: []
        });
        
        this.loadOrderData().then(() => {
          // 初次加载完成后计算统计数据
          this.calculateStatistics();
        }).catch(err => {
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
      // 下拉刷新完成后计算统计数据
      this.calculateStatistics();
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
    // 设置今天的日期
    const todayStr = this.formatDate(new Date());
    this.setData({
      activeTab: tab,
      currentPage: 1,
      hasMoreData: true,
      orders: [],
      filterStartDate: todayStr,
      filterEndDate: todayStr,
      filterStatusIndex: 0,
      showCanceled: true, // 切换标签页时显示所有订单
      hasUserFiltered: false // 重置用户筛选标志
    });
    wx.showLoading({ 
      title: `加载${tab === 'send' ? '发出单' : '收回单'}...`,
      mask: true
    });
    this.loadOrderData().then(() => {
      wx.hideLoading();
      // 加载完成后计算统计数据
      this.calculateStatistics();
    }).catch(err => {
      wx.hideLoading();
      console.error('切换标签页加载失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    });
  },

  // 搜索
  inputSearch(e) {
    this.setData({
      searchQuery: e.detail.value,
      hasUserFiltered: true // 搜索也视为用户筛选
    });
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
    const todayStr = this.formatDate(new Date());
    this.setData({
      searchQuery: '',
      currentPage: 1,
      orders: [],
      filterStartDate: todayStr,
      filterEndDate: todayStr,
      filterStatusIndex: 0,
      showCanceled: true, // 清除搜索时显示所有订单
      hasUserFiltered: false // 重置用户筛选标志
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
  
  // 显示筛选工厂下拉列表
  showFilterFactoryDropdown() {
    // 清除隐藏定时器
    if (this.data.hideFilterFactoryDropdownTimer) {
      clearTimeout(this.data.hideFilterFactoryDropdownTimer);
      this.setData({ hideFilterFactoryDropdownTimer: null });
    }
    
    // 获取实际的工厂列表（排除"全部工厂"选项）
    const actualFactories = this.data.factoryOptions.length > 1 ? 
                           this.data.factoryOptions.slice(1) : 
                           this.data.filteredFilterFactories || [];
    
    // 确保显示当前过滤状态的工厂列表
    if (!this.data.filterFactorySearchKeyword || this.data.filterFactorySearchKeyword.trim() === '') {
      this.setData({
        showFilterFactoryDropdown: true,
        filteredFilterFactories: actualFactories
      });
    } else {
      this.setData({
        showFilterFactoryDropdown: true
      });
      // 如果有搜索关键词，重新执行过滤
      this.filterFilterFactories(this.data.filterFactorySearchKeyword);
    }
    
    console.log('显示筛选工厂下拉列表，当前过滤工厂数量:', this.data.filteredFilterFactories.length);
    console.log('factoryOptions总数:', this.data.factoryOptions.length);
  },

  // 延迟隐藏筛选工厂下拉列表
  hideFilterFactoryDropdownWithDelay() {
    const timer = setTimeout(() => {
      this.setData({
        showFilterFactoryDropdown: false,
        hideFilterFactoryDropdownTimer: null
      });
    }, 200);
    
    this.setData({ hideFilterFactoryDropdownTimer: timer });
  },

  // 筛选工厂搜索输入
  onFilterFactorySearch(e) {
    const keyword = e.detail.value;
    console.log('筛选工厂搜索关键词:', keyword);
    
    this.setData({
      filterFactorySearchKeyword: keyword
    });
    
    // 显示下拉列表
    this.showFilterFactoryDropdown();
    
    // 实时搜索过滤
    this.filterFilterFactories(keyword);
  },

  // 过滤筛选工厂列表
  filterFilterFactories(keyword) {
    // 获取实际的工厂列表（排除"全部工厂"选项）
    const allFactories = this.data.factoryOptions.length > 1 ? 
                        this.data.factoryOptions.slice(1) : 
                        this.data.filteredFilterFactories || [];
    
    if (!keyword || keyword.trim() === '') {
      this.setData({
        filteredFilterFactories: allFactories
      });
      console.log('筛选工厂过滤结果（无关键词）:', allFactories.length, '个工厂');
      return;
    }
    
    const filtered = allFactories.filter(factory => {
      const name = factory.name || '';
      const phone = factory.phone || '';
      const address = factory.address || '';
      
      // 支持名称、电话、地址搜索
      return name.toLowerCase().includes(keyword.toLowerCase()) ||
             phone.includes(keyword) ||
             address.toLowerCase().includes(keyword.toLowerCase());
    });
    
    this.setData({
      filteredFilterFactories: filtered
    });
    
    console.log('筛选工厂过滤结果:', filtered.length, '个工厂，关键词:', keyword);
    console.log('原始工厂数量:', allFactories.length);
  },

  // 从下拉列表中选择筛选工厂
  selectFilterFactoryFromDropdown(e) {
    const factory = e.currentTarget.dataset.factory;
    console.log('选择筛选工厂:', factory);
    
    if (!factory || factory === '') {
      // 选择"全部工厂"
      this.setData({
        selectedFilterFactory: null,
        showFilterFactoryDropdown: false,
        filterFactorySearchKeyword: '',
        filterFactoryIndex: 0
      });
    } else {
      // 选择具体工厂
      const factoryIndex = this.data.factoryOptions.findIndex(f => f.id === factory.id);
      this.setData({
        selectedFilterFactory: factory,
        showFilterFactoryDropdown: false,
        filterFactorySearchKeyword: factory.name,
        filterFactoryIndex: factoryIndex >= 0 ? factoryIndex : 0
      });
    }

    // 清除隐藏定时器
    if (this.data.hideFilterFactoryDropdownTimer) {
      clearTimeout(this.data.hideFilterFactoryDropdownTimer);
      this.setData({ hideFilterFactoryDropdownTimer: null });
    }

    console.log('筛选工厂选择完成:', factory ? factory.name : '全部工厂');
  },

  // 工厂改变（保留原方法以兼容其他可能的调用）
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
    const todayStr = this.formatDate(new Date());
    // 获取实际的工厂列表（排除"全部工厂"选项）
    const actualFactories = this.data.factoryOptions.length > 1 ? 
                           this.data.factoryOptions.slice(1) : [];
    
    this.setData({
      filterStartDate: todayStr,
      filterEndDate: todayStr,
      filterFactoryIndex: 0,
      filterProcessIndex: 0,
      filterStatusIndex: 0,
      filterProductCode: '',
      hasUserFiltered: false, // 重置用户筛选标志
      // 重置工厂搜索相关数据
      filterFactorySearchKeyword: '',
      selectedFilterFactory: null,
      showFilterFactoryDropdown: false,
      filteredFilterFactories: actualFactories // 重置为所有工厂
    });
  },
  
  // 应用筛选
  applyFilter() {
    this.setData({
      showFilter: false,
      currentPage: 1,
      orders: [],
      hasUserFiltered: true // 设置用户筛选标志
    });
    this.loadOrderData().then(() => {
      // 筛选完成后计算统计数据
      this.calculateStatistics();
    });
  },

  // 加载订单数据
  loadOrderData() {
    console.log('[loadOrderData] 开始加载数据，activeTab:', this.data.activeTab);
    
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
      statusOptions,
      hasUserFiltered
    } = this.data;

    this.setData({ isLoading: true });

    // 构建筛选条件
    const filters = {
      keyword: searchQuery,
      page: currentPage,
      pageSize
    };

    // 🔧 新增：专员角色权限控制 - 只能查看自己制单的订单
    const roleId = wx.getStorageSync('roleId') || 3;
    const currentUserId = wx.getStorageSync('userId');
    const currentUsername = wx.getStorageSync('username');
    
    if (parseInt(roleId) === 4) { // 专员角色
      if (currentUserId) {
        filters.createdBy = currentUserId; // 按制单人ID筛选
        console.log('[loadOrderData] 专员角色权限控制 - 按用户ID筛选:', currentUserId);
      } else if (currentUsername) {
        filters.createdByUsername = currentUsername; // 备用筛选方案
        console.log('[loadOrderData] 专员角色权限控制 - 按用户名筛选:', currentUsername);
      }
    }

    // 仅当选择了具体工厂时才添加工厂筛选条件
    if (filterFactoryIndex > 0 && factoryOptions.length > filterFactoryIndex) {
      filters.factoryId = factoryOptions[filterFactoryIndex].id;
    }
    if (filterProcessIndex > 0 && processOptions.length > filterProcessIndex) {
      filters.processId = processOptions[filterProcessIndex].id;
    }
    // 设置状态筛选条件
    if (filterStatusIndex === 1) { // 正常
      filters.status = 1; // 使用status字段，1表示正常
    } else if (filterStatusIndex === 2) { // 已作废
      filters.status = 0; // 0表示已作废
    }
    // 全部状态不设置status字段

    if (this.data.filterProductCode) {
      filters.productCode = this.data.filterProductCode;
    }
    // 日期范围筛选
    if (filterStartDate) filters.startDate = filterStartDate;
    if (filterEndDate) filters.endDate = filterEndDate;

    this.setData({ lastRequestFilters: filters });
    console.log('订单查询参数:', filters);

    // 根据activeTab选择接口
    let endpoint = '/send-orders';
    let adaptData = data => (data && data.records ? data.records : []);
    if (activeTab === 'receive') {
      endpoint = '/receive-orders';
      adaptData = data => (data && data.records ? data.records : []);
    }

    wx.showLoading({ title: '加载数据中...' });
    const api = require('../../utils/api');
    return new Promise((resolve, reject) => {
      api.request(endpoint, 'GET', filters).then(res => {
        wx.hideLoading();
        let rawData = res && res.data ? res.data : res;
        let dataArr = adaptData(rawData);
        
        if (Array.isArray(dataArr)) {
          let processedOrders = dataArr.map(order => {
            const createdAtOriginal = order.createTime || order.createdAt || order.created_at;
            const createdAtObject = new Date(fixIOSDateString(createdAtOriginal));
            const createdAtFormatted = formatDateTimeToMinute(fixIOSDateString(createdAtOriginal));
            // 优先用order.date，否则用createdAtOriginal
            let orderDateRaw = order.date || createdAtOriginal || '';
            let orderDateObject = new Date(fixIOSDateString(orderDateRaw));
            let orderDateFormatted = this.formatDate(orderDateObject);
            // 如果格式异常，兜底为今天
            if (!orderDateRaw || orderDateFormatted === '1970-01-01' || orderDateFormatted === 'Invalid Date') {
              orderDateFormatted = this.formatDate(new Date());
            }
            const orderType = order.orderType || activeTab;
            // 统一制单人字段，优先级：staff > real_name > creator > created_by > username > '-'
            const staff = order.staff || order.real_name || order.creator || order.created_by || order.username || '-';
            return {
              ...order,
              staff, // 统一制单人
              date: orderDateFormatted,
              createdAt: createdAtFormatted,
              originalCreatedAt: createdAtOriginal,
              itemsCount: order.items ? order.items.length : (order.products ? order.products.length : 0),
              isMultiItem: order.items ? order.items.length > 1 : (order.products ? order.products.length > 1 : false),
              orderType: orderType
            };
          });
          
          // 确保只显示当前标签页所需的订单类型
          let validOrders = processedOrders.filter((order, index) => {
            const hasBasicFields = order && 
                                order.orderNo && 
                                order.factoryName &&
                                order.id;
            
            // 确保orderType与当前活动标签匹配
            const matchesType = order.orderType === activeTab;
            
            // 只打印第一条被处理的数据的详细判断过程
            if (index === 0) {
              console.log(`[FilterDebug] Order ID: ${order.id}`);
              console.log(`[FilterDebug] order.status: ${order.status}`);
              console.log(`[FilterDebug] hasBasicFields: ${hasBasicFields}`);
              console.log(`[FilterDebug] matchesType: ${matchesType}`);
            }
            
            return hasBasicFields && matchesType;
          });
          
          // 参考首页的实现，增加日期筛选逻辑，在前端对数据进行筛选
          if (hasUserFiltered) {
            // 如果用户主动筛选，则应用筛选器中的日期范围
            console.log('[loadOrderData] 用户已主动筛选，应用日期范围:', filterStartDate, '至', filterEndDate);
            if (filterStartDate && filterEndDate) { // 确保日期选择有效
                validOrders = validOrders.filter(order => {
                    // 假设 order.date, filterStartDate, filterEndDate 都是 'YYYY-MM-DD' 格式
                    return order.date >= filterStartDate && order.date <= filterEndDate;
                });
                console.log(`[loadOrderData] 自定义日期筛选后 ${validOrders.length} 条`);
            } else {
                console.warn('[loadOrderData] 用户主动筛选但日期范围无效，此次不按日期筛选。');
            }
          } else {
            // 如果用户没有主动筛选（刚进入页面或刚切换Tab），则恢复默认显示当天数据的逻辑
            const todayDateString = filterStartDate; // filterStartDate 在 onLoad/switchTab 时已设为今天
    

            if (validOrders.length > 0) {
                console.log(`[loadOrderData] 准备按今日筛选. 首条订单信息 قبل از فیلتر "امروز" - ID: ${validOrders[0].id}, order.date (برای فیلتر): ${validOrders[0].date}, originalCreatedAt: ${validOrders[0].originalCreatedAt}`);
            }

            const originalValidOrdersCount = validOrders.length;
            let nonMatchingDateOrderLogged = false; // Flag to log only the first non-matching order details

            validOrders = validOrders.filter(order => {
              const isToday = order.date === todayDateString;
              if (!isToday && !nonMatchingDateOrderLogged && originalValidOrdersCount > 0) {
                  // Log details for the first order that doesn't match today's date
        
                  nonMatchingDateOrderLogged = true;
              }
              return isToday;
            });
            console.log(`[loadOrderData] 今日订单筛选后: ${validOrders.length} 条 (从 ${originalValidOrdersCount} 条符合类型的订单中筛选)`);
          }
          
          // 检查原始数据和过滤后的数据数量，帮助排查问题
          console.log('原始数据:', processedOrders.length, '条');
          console.log('有效订单数据:', validOrders.length, '条');
          console.log('第一条数据示例:', validOrders.length > 0 ? validOrders[0] : '无数据');
          
          // 如果所有数据都被过滤掉了，检查原因
          if (validOrders.length === 0 && processedOrders.length > 0) {
            console.warn('警告: 所有返回的数据都被过滤掉了！');
            
            // 检查orderType分布
            const orderTypes = {};
            processedOrders.forEach(order => {
              const type = order.orderType || 'unknown';
              orderTypes[type] = (orderTypes[type] || 0) + 1;
            });
            console.warn('原始数据类型分布:', orderTypes);
            
            // 检查基本字段缺失情况
            const missingFields = {
              orderNo: 0,
              factoryName: 0,
              id: 0
            };
            processedOrders.forEach(order => {
              if (!order.orderNo) missingFields.orderNo++;
              if (!order.factoryName) missingFields.factoryName++;
              if (!order.id) missingFields.id++;
            });
            console.warn('缺失基本字段的记录数:', missingFields);
            
            // 检查日期分布情况
            if (!hasUserFiltered) {
              const todayDateString = filterStartDate;
              const dateCounts = {};
              processedOrders.forEach(order => {
                const date = order.date || 'unknown';
                dateCounts[date] = (dateCounts[date] || 0) + 1;
              });
              console.warn('原始数据日期分布:', dateCounts);
              console.warn('今日日期:', todayDateString);
            }
          }
          
          // 新增排序逻辑：最新在最上面
          const sortOrders = (arr) => {
            // 按制单时间倒序
            const desc = (a, b) => {
              // 使用 Date 对象进行可靠的日期比较，即使 created_at 是 ISO 字符串或时间戳
              const aTime = new Date(fixIOSDateString(a.originalCreatedAt || a.createdAt)).getTime();
              const bTime = new Date(fixIOSDateString(b.originalCreatedAt || b.createdAt)).getTime();
              return bTime - aTime;
            };
            return [...arr].sort(desc);
          };
          
          // 对从后端获取并校验后的 validOrders 进行排序
          const sortedOrders = sortOrders(validOrders);

          this.setData({
            // 如果是第一页，直接使用排序后的数据；否则，将新数据合并并再次排序以保持一致性
            orders: this.data.currentPage === 1 ? sortedOrders : sortOrders(this.data.orders.concat(sortedOrders)),
            hasMoreData: validOrders.length === pageSize,
            isLoading: false
          }, () => {
            // 数据设置完成后计算统计数据
            this.calculateStatistics();
          });
          
          // 如果返回空数据，向用户提示
          if (validOrders.length === 0) {
            wx.showToast({
              title: '暂无数据',
              icon: 'none',
              duration: 2000
            });
          }
          
          resolve(sortedOrders);
        } else {
          this.setData({ orders: [] });
        }
        resolve();
      }).catch(err => {
        wx.hideLoading();
        this.setData({ orders: [] });
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
      pageSize,
      hasUserFiltered,
      lastRequestFilters
    } = this.data;

    console.log('[loadMoreData] 加载更多数据，activeTab:', activeTab);

    this.setData({
      isLoading: true,
      currentPage: currentPage + 1
    });

    // 构建筛选条件 - 尽量与loadOrderData保持一致
    const filters = {
      keyword: searchQuery,
      page: currentPage + 1,
      pageSize
    };

    // 🔧 修复：专员角色权限控制 - 只能查看自己制单的订单（与loadOrderData保持一致）
    const roleId = wx.getStorageSync('roleId') || 3;
    const currentUserId = wx.getStorageSync('userId');
    const currentUsername = wx.getStorageSync('username');
    
    if (parseInt(roleId) === 4) { // 专员角色
      if (currentUserId) {
        filters.createdBy = currentUserId; // 按制单人ID筛选
        console.log('[loadMoreData] 专员角色权限控制 - 按用户ID筛选:', currentUserId);
      } else if (currentUsername) {
        filters.createdByUsername = currentUsername; // 备用筛选方案
        console.log('[loadMoreData] 专员角色权限控制 - 按用户名筛选:', currentUsername);
      }
    }

    console.log('[loadMoreData] 用户是否主动筛选:', hasUserFiltered);

    // 仅当选择了具体工厂时才添加工厂筛选条件
    if (filterFactoryIndex > 0 && factoryOptions.length > filterFactoryIndex) {
      filters.factoryId = factoryOptions[filterFactoryIndex].id;
    }

    // 仅当选择了具体工序时才添加工序筛选条件
    if (filterProcessIndex > 0 && processOptions.length > filterProcessIndex) {
      filters.processId = processOptions[filterProcessIndex].id;
    }

    // 设置状态筛选条件
    if (filterStatusIndex === 1) { // 正常
      filters.status = 1; // 使用status字段，1表示正常
    } else if (filterStatusIndex === 2) { // 已作废
      filters.status = 0; // 0表示已作废
    }
    // 全部状态不设置status字段

    // 仅当输入了货号时才添加货号筛选条件
    if (this.data.filterProductCode) {
      filters.productCode = this.data.filterProductCode;
    }

    // 保存并打印过滤条件，检查是否与前一次请求一致
    console.log('前一次请求参数:', lastRequestFilters);
    console.log('加载更多订单参数:', filters);

    // 使用统一的orders端点，通过orderType参数区分类型
    const endpoint = activeTab === 'send' ? '/send-orders' : '/receive-orders';
    let adaptData = data => (data && data.records ? data.records : []);

    console.log(`请求更多${activeTab === 'send' ? '发出单' : '收回单'}，使用端点:`, endpoint, '参数:', JSON.stringify(filters));
    
    wx.showLoading({ title: '加载更多...' });
    
    const api = require('../../utils/api');
    api.request(endpoint, 'GET', filters).then(res => {
      wx.hideLoading();
      
      if (res && res.success && Array.isArray(res.data)) {
        let processedOrders = res.data.map(order => {
          // 兼容后端返回的 createTime, createdAt, created_at
          const createdAtOriginal = order.createTime || order.createdAt || order.created_at;
          const createdAtObject = new Date(fixIOSDateString(createdAtOriginal));
          const createdAtFormatted = formatDateTimeToMinute(fixIOSDateString(createdAtOriginal));
          // 兼容date字段
          const orderDateObject = new Date(fixIOSDateString(order.date));
          const orderDateFormatted = this.formatDate(orderDateObject);
          
          // 确保orderType字段存在，优先使用数据本身的orderType，备用为当前标签
          const orderType = order.orderType || activeTab;
          
          return {
            ...order,
            date: orderDateFormatted,
            createdAt: createdAtFormatted, // 给前端统一使用
            originalCreatedAt: createdAtOriginal, // 保留原始的，可能带T Z
            itemsCount: order.items ? order.items.length : (order.products ? order.products.length : 0),
            isMultiItem: order.items ? order.items.length > 1 : (order.products ? order.products.length > 1 : false),
            orderType: orderType // 设置orderType
          };
        });
        
        // 确保只显示当前标签页所需的订单类型
        let validOrders = processedOrders.filter((order, index) => {
          const hasBasicFields = order && 
                                order.orderNo && 
                                order.factoryName &&
                                order.id;
          
          // 确保orderType与当前活动标签匹配
          const matchesType = order.orderType === activeTab;
          
          // 只打印第一条被处理的数据的详细判断过程 (LoadMore)
          if (index === 0) {
            console.log(`[FilterDebug LoadMore] Order ID: ${order.id}`);
            console.log(`[FilterDebug LoadMore] order.status: ${order.status}`);
            console.log(`[FilterDebug LoadMore] hasBasicFields: ${hasBasicFields}`);
            console.log(`[FilterDebug LoadMore] matchesType: ${matchesType}`);
          }
          
          return hasBasicFields && matchesType;
        });
        
        // 参考首页的实现，增加日期筛选逻辑，在前端对数据进行筛选
        if (!hasUserFiltered) {
          // 如果用户没有主动筛选，则默认显示今天的数据
          const todayDateString = filterStartDate; // 已经是 YYYY-MM-DD 格式
          
          validOrders = validOrders.filter(order => {
            // 使用 date 字段进行比较，已经格式化为 YYYY-MM-DD
            const isToday = order.date === todayDateString;
            return isToday;
          });
          
          console.log('[loadMoreData] 今日订单筛选结果:', validOrders.length, '条');
        } else if (filterStartDate && filterEndDate) {
          // 如果用户主动筛选了日期，则按用户选择的日期范围筛选
          if (filterStartDate === filterEndDate) {
            // 如果开始日期和结束日期相同，按精确日期查询
            console.log('[loadMoreData] 前端筛选特定日期:', filterStartDate);
            validOrders = validOrders.filter(order => order.date === filterStartDate);
          } else {
            // 日期范围查询
            console.log('[loadMoreData] 前端筛选日期范围:', filterStartDate, '-', filterEndDate);
            validOrders = validOrders.filter(order => {
              // 将日期字符串转为 Date 对象进行比较
              const orderDate = new Date(order.date);
              const startDate = new Date(filterStartDate);
              const endDate = new Date(filterEndDate);
              // 设置 endDate 为当天的 23:59:59
              endDate.setHours(23, 59, 59, 999);
              
              return orderDate >= startDate && orderDate <= endDate;
            });
          }
          console.log('[loadMoreData] 日期筛选结果:', validOrders.length, '条');
        }
        
        // 检查原始数据和过滤后的数据数量，帮助排查问题
        console.log('原始数据(加载更多):', processedOrders.length, '条');
        console.log('有效订单数据(加载更多):', validOrders.length, '条');
        
        // 排序逻辑应该作用于后端返回并经过基本处理和类型过滤的完整数据集 (validOrders)
        // 而不是在前端根据日期再次过滤后的 filteredOrders
        // 如果后端已经按日期过滤了，前端只需要按制单时间倒序排列即可
        const sortOrders = (arr) => {
          // 按制单时间倒序
          const desc = (a, b) => {
             // 使用 Date 对象进行可靠的日期比较
             const aTime = new Date(fixIOSDateString(a.originalCreatedAt || a.createdAt)).getTime();
             const bTime = new Date(fixIOSDateString(b.originalCreatedAt || b.createdAt)).getTime();
             return bTime - aTime;
          };
          return [...arr].sort(desc);
        };

        // 对从后端获取并校验后的 validOrders 进行排序
        const sortedOrders = sortOrders(validOrders);

        const allOrders = sortOrders([...orders, ...sortedOrders]); // 合并并重新排序
        this.setData({
          orders: allOrders,
          hasMoreData: validOrders.length === pageSize,
          isLoading: false
        }, () => {
          // 数据设置完成后计算统计数据
          this.calculateStatistics();
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
    console.log('尝试跳转到收发流水表');
    wx.navigateTo({ url: '/pages/flow-table/flow-table' });
  },
  
  // 跳转到对账单
  navigateToStatement() {
    wx.navigateTo({ url: '/pages/statement/statement' });
  },

  // 处理分享按钮点击
  handleShare(e) {
    console.log('[send-receive.js handleShare] Share triggered', e.currentTarget.dataset);
    const { type, id } = e.currentTarget.dataset;
    if (!type || !id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '准备分享...' });
    const order = this.data.orders.find(o => o.id === id);
    if (!order) {
      wx.hideLoading();
      wx.showToast({ title: '未找到订单', icon: 'none' });
      return;
    }

    // 获取订单明细
    const apiPath = `/${type === 'send' ? 'send' : 'receive'}-orders/${id}`;
    const orgId = wx.getStorageSync('orgId');
    api.request(apiPath, 'GET', { orgId }).then(res => {
      if (res.success && res.data) {
        // 用API返回的真实数据全量覆盖本地order对象，保证paymentMethod等字段为真实值
        Object.assign(order, res.data);
        // 明细字段兼容 items/products
        order.productDetails = res.data.items || res.data.products || [];
        order.originalCreatedAt = res.data.createdAt; // 保存原始创建时间
        // 如果是收回单类型且有factoryId，获取工厂账户状态
        if (type === 'receive' && (order.factoryId || order.factory_id)) {
          const factoryId = order.factoryId || order.factory_id;
          console.log(`[send-receive.js handleShare] Fetching factory status for factory ID: ${factoryId}`);
          
          // 获取工厂详情，包括账户状态
          api.request(`/factories/${factoryId}`, 'GET', { orgId }).then(factoryRes => {
            if (factoryRes.success && factoryRes.data) {
              console.log('[send-receive.js handleShare] Factory data:', factoryRes.data);
              // 将工厂账户状态信息添加到订单数据中
              order.factoryBalance = factoryRes.data.balance || 0;
              order.factoryDebt = factoryRes.data.debt || 0;
              console.log('[send-receive.js handleShare] Updated order with factory balance:', order.factoryBalance);
              
              // 根据工厂账户状态计算实际的累计结余/欠款
              if (order.factoryDebt > 0) {
                order.balance = -order.factoryDebt; // 如果有欠款，显示负数
              } else {
                order.balance = order.factoryBalance; // 如果没有欠款，显示余额
              }
            }
            this._doShare(type, order);
          }).catch(err => {
            console.error('[send-receive.js handleShare] Error fetching factory data:', err);
            // 即使获取工厂数据失败，也继续分享流程
            this._doShare(type, order);
          });
        } else {
          // 不是收回单或没有工厂ID，直接分享
          this._doShare(type, order);
        }
      } else {
        console.error('[send-receive.js handleShare] Failed to fetch details:', res);
        wx.hideLoading();
        wx.showToast({ title: '获取明细失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('[send-receive.js handleShare] Error fetching details:', err);
      wx.hideLoading();
      wx.showToast({ title: '获取明细失败', icon: 'none' });
    });
  },

  _doShare(type, order) {
    console.log('[send-receive.js _doShare] Preparing to generate image', { 
      type: type, 
      orderId: order.id,
      staff: order.staff,
      creator: order.creator,
      originalCreatedAt: order.originalCreatedAt,
      createdAt: order.createdAt
    });
    // 确保传递给生成图片的函数是带有明细的完整 order 对象
    if (type === 'send') {
      this.generateSendOrderShareImage(order);
    } else {
      this.generateReceiveOrderShareImage(order);
    }
  },
  
  // 生成发出单分享图片
  generateSendOrderShareImage(orderData) {
    console.log('[send-receive.js generateSendOrderShareImage] Starting generation for send order', orderData);
    
    // 使用统一的画布尺寸：1080px × 1920px
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    this._generateSendOrderCanvas(orderData, canvasWidth, canvasHeight);
  },
  
  // 生成发出单画布的具体实现
  _generateSendOrderCanvas(orderData, canvasWidth, canvasHeight) {

    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // --- 设置更新后的canvas尺寸 ---
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 加载所有货品图片
        const productsWithImages = (orderData.productDetails || []).filter(item => item.image);
        let imagesLoadedCount = 0;
        const imagesToLoad = productsWithImages.length;
        const productImages = {}; // 存储加载完成的图片对象

        // 添加默认图片加载，防止没有货品图片时报错
        const defaultImg = canvas.createImage();
        let defaultImgLoaded = false;
        let defaultImgError = false; // 新增标志，记录默认图片是否加载失败
        defaultImg.onload = () => { 
            defaultImgLoaded = true; 
            console.log('[generateSendOrderShareImage] Default image loaded successfully.');
            if (imagesToLoad === 0) checkAllImagesLoaded(); 
        };
        defaultImg.onerror = (err) => { 
            defaultImgLoaded = true; // 仍然标记为loaded以推进流程
            defaultImgError = true; // 但记录它发生了错误
            console.error('[generateSendOrderShareImage] Default image failed to load:', err, defaultImg.src);
            if (imagesToLoad === 0) checkAllImagesLoaded(); 
        }; // 即使加载失败也标记为已加载
        defaultImg.src = '/images/default-product.png'; // 替换为你的默认图片路径

        const checkAllImagesLoaded = () => {
            // 所有图片（包括默认图片如果需要）加载完成，开始绘制
            // 确保 defaultImgLoaded 在 imagesToLoad === 0 时也被考虑
            if (imagesLoadedCount === imagesToLoad && (imagesToLoad > 0 || defaultImgLoaded)) {
                // --- 传递固定尺寸给绘制函数 ---
                // 如果默认图片加载失败，则传递null
                const validDefaultImg = defaultImgError ? null : defaultImg;
                this.drawSendOrderImage(ctx, canvas.width, canvas.height, orderData, productImages, validDefaultImg);
                // 将canvas内容转为图片
                wx.canvasToTempFilePath({
                    canvas: canvas,
                    width: canvas.width,
                    height: canvas.height,
                    destWidth: canvas.width,
                    destHeight: canvas.height,
                    fileType: 'jpg',
                    quality: 0.85,
                    success: (res) => {
                        wx.hideLoading();
                        this.showShareModal(res.tempFilePath, orderData, 'send');
                    },
                    fail: (err) => {
                        console.error('canvas转图片失败:', err);
                        wx.hideLoading();
                        wx.showToast({ title: '生成图片失败', icon: 'none' });
                    }
                });
            }
        };

        if (imagesToLoad === 0) {
            // 如果没有图片，直接绘制（等待默认图片加载完成后）
             if (defaultImgLoaded) checkAllImagesLoaded();
        } else {
            // 加载图片并绘制
            productsWithImages.forEach(item => {
                const img = canvas.createImage();
                img.onload = () => {
                    imagesLoadedCount++;
                    // 使用货号作为key，确保与绘制时的映射一致
                    const styleNo = item.productNo || item.styleNo || item.id;
                    productImages[styleNo] = img;
                    checkAllImagesLoaded();
                };
                img.onerror = (err) => {
                    console.error('图片加载失败:', item.image, err);
                    imagesLoadedCount++; // Treat failed image as loaded to avoid blocking
                    const styleNo = item.productNo || item.styleNo || item.id;
                    productImages[styleNo] = null; // 标记此图片加载失败
                    checkAllImagesLoaded();
                };
                 // 使用 getFullImageUrl 处理图片路径
                const fullImageUrl = getFullImageUrl(item.image); // 添加日志
                console.log(`[generateSendOrderShareImage] Item ProductNo: ${item.productNo || item.product_no || 'N/A'}, Attempting to load image: ${fullImageUrl}`); // 添加日志
                img.src = fullImageUrl;
            });
        }
      });
  },
  
  // 绘制发出单图片 (现代化设计版本)
  drawSendOrderImage(ctx, canvasWidth, canvasHeight, orderData, productImages = {}, defaultImg = null) {
    // 设置背景色为纯白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 定义颜色和字体（适配1080px×1920px画布）
    const colors = {
      primary: '#1a1a1a',
      secondary: '#6c757d',
      accent: '#2980b9',
      success: '#27ae60',
      warning: '#ff9500',
      background: '#f0f0f0',
      border: '#000000',
      headerBg: '#e6f3ff',
      rowBg: '#fafbfc'
    };
    
    const fonts = {
      title: 'bold 48px "Microsoft YaHei", sans-serif',
      header: 'bold 36px "Microsoft YaHei", sans-serif',
      body: '32px "Microsoft YaHei", sans-serif',
      small: '28px "Microsoft YaHei", sans-serif',
      caption: '24px "Microsoft YaHei", sans-serif'
    };
    
    const margin = 40;
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
    
    // 1. 绘制页面标题 - 统一格式：公司名+工序+单据类型
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.title;
    ctx.textAlign = 'center';
    const processName = orderData.process || '加工';
    ctx.fillText(`${companyName} - ${processName} - 发出单`, canvasWidth / 2, currentY + 60);
    currentY += 120;
    
    // 2. 绘制工厂信息（在表格外面的最上面）
    if (orderData.factoryName) {
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.header;
      ctx.textAlign = 'left';
      ctx.fillText(`工厂：${orderData.factoryName}`, margin, currentY + 40);
      currentY += 80;
    }
    
    // 2. 处理数据分组（按货号分组）
    const products = orderData.productDetails || [];
    const productGroups = new Map();
    
    // 如果没有明细数据，创建一个默认分组
    if (products.length === 0) {
      const defaultKey = `${orderData.productNo || orderData.styleNo || 'DEFAULT'}_${orderData.productName || ''}`;
      productGroups.set(defaultKey, {
        styleNo: orderData.productNo || orderData.styleNo || '-',
        productName: orderData.productName || '-',
        process: orderData.process || '-',
        details: [{
          color: orderData.color || '-',
          size: orderData.size || '-',
          quantity: orderData.quantity || 0,
          weight: orderData.weight || 0
        }]
      });
    } else {
      // 按货号分组
      products.forEach(product => {
        const key = `${product.productNo || product.styleNo || 'DEFAULT'}_${product.productName || ''}`;
        if (!productGroups.has(key)) {
          productGroups.set(key, {
            styleNo: product.productNo || product.styleNo || '-',
            productName: product.productName || '-',
            process: orderData.process || '-',
            details: []
          });
        }
        productGroups.get(key).details.push({
          color: product.color || '-',
          size: product.size || '-',
          quantity: product.quantity || 0,
          weight: product.weight || 0
        });
      });
    }
    
    // 3. 绘制单据标题行（只显示一次）
    const tableWidth = canvasWidth - margin * 2;
    const rowHeight = 50;
    
    // 绘制发出单标题行（蓝色背景）
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(margin, currentY, tableWidth, rowHeight);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
    
    // 标题行内容：发出单 + 单号 + 工序 + 日期
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.small;
    ctx.textAlign = 'left';
    
    // 计算各部分位置
    const titleCellWidth = tableWidth / 6;
    let cellX = margin;
    
    // 发出单
    ctx.fillText('发出单', cellX + 10, currentY + rowHeight/2 + 8);
    cellX += titleCellWidth;
    
    // 单号
    ctx.fillText(orderData.orderNo || '-', cellX + 10, currentY + rowHeight/2 + 8);
    cellX += titleCellWidth;
    
    // 空白
    cellX += titleCellWidth;
    
    // 工序
    const orderProcessName = orderData.process || '加工';
    ctx.fillText(orderProcessName, cellX + 10, currentY + rowHeight/2 + 8);
    cellX += titleCellWidth;
    
    // 空白
    cellX += titleCellWidth;
    
    // 日期 - 向左移动一点，确保完美展示在表格内
    ctx.fillText(orderData.date || '-', cellX + 5, currentY + rowHeight/2 + 8);
    
    currentY += rowHeight;
    
    // 4. 绘制每个货号分组
    for (const [productKey, group] of productGroups) {
      
      // 绘制货号信息行 - 根据图片大小自动适配行高
      const imgSize = 100;
      const productImage = productImages[group.styleNo] || defaultImg;
      const infoRowHeight = productImage ? Math.max(rowHeight, imgSize + 10) : rowHeight; // 图片高度+10px边距，最小为原行高
      
      ctx.fillStyle = colors.rowBg;
      ctx.fillRect(margin, currentY, tableWidth, infoRowHeight);
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(margin, currentY, tableWidth, infoRowHeight);
      
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.small;
      ctx.textAlign = 'left';
      
      // 货号信息：货号 + 货品名称（两列布局）
      cellX = margin;
      const infoCellWidth = tableWidth / 2;
      
      // 在货号位置添加图片显示
      if (productImage) {
        // 绘制货品图片（调整为100×100px，在货号文字左侧）
        const imgY = currentY + (infoRowHeight - imgSize) / 2;
        ctx.drawImage(productImage, cellX + 5, imgY, imgSize, imgSize);
        // 货号文字向右偏移，为图片留出空间
        ctx.fillText(`货号：${group.styleNo}`, cellX + imgSize + 15, currentY + infoRowHeight/2 + 8);
      } else {
        ctx.fillText(`货号：${group.styleNo}`, cellX + 10, currentY + infoRowHeight/2 + 8);
      }
      cellX += infoCellWidth;
      
      ctx.fillText(`货品名称：${group.productName}`, cellX + 10, currentY + infoRowHeight/2 + 8);
      
      currentY += infoRowHeight;
      
      // 绘制明细表头
      ctx.fillStyle = colors.headerBg;
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.caption;
      ctx.textAlign = 'center';
      
      // 表头列：颜色、尺码、数量、重量
      const colWidths = [tableWidth * 0.25, tableWidth * 0.25, tableWidth * 0.25, tableWidth * 0.25];
      const headers = ['颜色', '尺码', '数量', '重量'];
      
      cellX = margin;
      headers.forEach((header, index) => {
        ctx.fillText(header, cellX + colWidths[index]/2, currentY + rowHeight/2 + 8);
        
        // 绘制列分隔线
        if (index < headers.length - 1) {
          ctx.strokeStyle = colors.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cellX + colWidths[index], currentY);
          ctx.lineTo(cellX + colWidths[index], currentY + rowHeight);
          ctx.stroke();
        }
        
        cellX += colWidths[index];
      });
      
      currentY += rowHeight;
      
      // 绘制明细数据行
      group.details.forEach((detail, index) => {
        // 交替行背景
        if (index % 2 === 1) {
          ctx.fillStyle = colors.rowBg;
          ctx.fillRect(margin, currentY, tableWidth, rowHeight);
        }
        
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
        
        ctx.fillStyle = colors.secondary;
        ctx.font = fonts.caption;
        ctx.textAlign = 'center';
        
        cellX = margin;
        
        // 颜色
        ctx.fillText(detail.color, cellX + colWidths[0]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[0];
        
        // 尺码
        ctx.fillText(detail.size, cellX + colWidths[1]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[1];
        
        // 数量（蓝色）- 取消单位"打"
        ctx.fillStyle = colors.accent;
        ctx.font = 'bold ' + fonts.caption;
        ctx.fillText(detail.quantity, cellX + colWidths[2]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[2];
        
        // 重量（绿色）- 取消单位"kg"
        ctx.fillStyle = colors.success;
        ctx.fillText(detail.weight, cellX + colWidths[3]/2, currentY + rowHeight/2 + 8);
        
        // 绘制列分隔线
        cellX = margin;
        colWidths.forEach((width, i) => {
          if (i < colWidths.length - 1) {
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cellX + width, currentY);
            ctx.lineTo(cellX + width, currentY + rowHeight);
            ctx.stroke();
          }
          cellX += width;
        });
        
        currentY += rowHeight;
      });
      
      // 绘制小计行（浅蓝背景）
      ctx.fillStyle = '#f0f8ff';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.accent;
      ctx.font = fonts.small;
      ctx.textAlign = 'left';
      ctx.fillText('小计', margin + 10, currentY + rowHeight/2 + 8);
      
      // 计算小计
      const subtotalQty = group.details.reduce((sum, detail) => sum + (parseFloat(detail.quantity) || 0), 0);
      const subtotalWeight = group.details.reduce((sum, detail) => sum + (parseFloat(detail.weight) || 0), 0);
      
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.accent;
      ctx.fillText(subtotalQty + '打', margin + colWidths[0] + colWidths[1] + colWidths[2]/2, currentY + rowHeight/2 + 8);
      ctx.fillStyle = colors.success;
      ctx.fillText(subtotalWeight.toFixed(1) + 'kg', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]/2, currentY + rowHeight/2 + 8);
      
      currentY += rowHeight; // 去除组间距，紧密连接
    }
    
    // 4. 绘制合计行（发出单）
    if (productGroups.size > 0) {
      // 计算所有分组的总计
      let totalQty = 0;
      let totalWeight = 0;
      
      for (const [productKey, group] of productGroups) {
        const subtotalQty = group.details.reduce((sum, detail) => sum + (parseFloat(detail.quantity) || 0), 0);
        const subtotalWeight = group.details.reduce((sum, detail) => sum + (parseFloat(detail.weight) || 0), 0);
        totalQty += subtotalQty;
        totalWeight += subtotalWeight;
      }
      
      // 重新定义列宽（与表头保持一致）
      const colWidths = [tableWidth * 0.25, tableWidth * 0.25, tableWidth * 0.25, tableWidth * 0.25];
      
      // 绘制合计行（深蓝背景）
      ctx.fillStyle = '#e3f2fd';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.primary;
      ctx.font = 'bold ' + fonts.body;
      ctx.textAlign = 'left';
      ctx.fillText('合计:', margin + 10, currentY + rowHeight/2 + 8);
      
      // 合计数据
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold ' + fonts.body;
      ctx.fillText(totalQty + '打', margin + colWidths[0] + colWidths[1] + colWidths[2]/2, currentY + rowHeight/2 + 8);
      ctx.fillStyle = colors.success;
      ctx.fillText(totalWeight.toFixed(1) + 'kg', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]/2, currentY + rowHeight/2 + 8);
      
      currentY += rowHeight + 40;
    }
    
    // 5. 绘制备注（如果有）
    if (orderData.remark) {
      currentY += 20;
      ctx.fillStyle = colors.secondary;
      ctx.font = fonts.body;
      ctx.textAlign = 'left';
      ctx.fillText(`备注: ${orderData.remark}`, margin, currentY);
      currentY += 60;
    }
    
    // 6. 绘制底部信息
    const footerY = canvasHeight - 120;
    
    // 底部分隔线
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 40);
    ctx.lineTo(canvasWidth - margin, footerY - 40);
    ctx.stroke();
    
    // 底部信息
    ctx.fillStyle = colors.secondary;
    ctx.font = fonts.small;
    ctx.textAlign = 'left';
    ctx.fillText(`制单人: ${orderData.staff || orderData.creator || '-'}`, margin, footerY);
    
    ctx.textAlign = 'right';
    const createTime = orderData.originalCreatedAt || orderData.createdAt || new Date();
    const timeStr = typeof createTime === 'string' ? createTime : createTime.toLocaleString();
    ctx.fillText(`制单时间: ${timeStr}`, canvasWidth - margin, footerY);
    
    // 系统标识
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.secondary;
    ctx.font = fonts.caption;
    ctx.fillText('云收发', canvasWidth / 2, footerY + 50);
  },
  
  // 生成接收单分享图片
  generateReceiveOrderShareImage(orderData) {
    console.log('[send-receive.js generateReceiveOrderShareImage] Starting generation for receive order', orderData);
    // 兼容明细字段：如果只有 price 字段，赋值给 pricePerKg
    (orderData.productDetails || []).forEach(item => {
      if (item.price && !item.pricePerKg) item.pricePerKg = item.price;
      // 动态计算金额：优先使用 pricePerKg * quantity（工价*数量）
      if (item.pricePerKg && item.quantity) {
        // 使用工价*数量计算金额
        item.fee = (parseFloat(item.pricePerKg) || 0) * (parseFloat(item.quantity) || 0);
      } else if (item.price && item.quantity) {
        // 备用：使用price*quantity计算金额
          item.fee = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
        } else if (item.price && item.weight) {
        // 如果没有数量，则使用weight
          item.fee = (parseFloat(item.price) || 0) * (parseFloat(item.weight) || 0);
      } else if (!item.fee) {
        // 如果还是没有fee，设为0
          item.fee = 0;
      }
       // +++ 确保 productName 存在，如果只有 name 就用 name
       if (!item.productName && item.name) item.productName = item.name;
    });

    // 使用统一的画布尺寸：1080px × 1920px
    const canvasWidth = 1080;
    const canvasHeight = 1920;
    this._generateReceiveOrderCanvas(orderData, canvasWidth, canvasHeight);
  },
  
  // 生成接收单画布的具体实现
  _generateReceiveOrderCanvas(orderData, canvasWidth, canvasHeight) {
    wx.showLoading({ title: '生成图片中...' });

    const query = wx.createSelectorQuery();
    query.select('#shareCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) {
          wx.hideLoading();
          wx.showToast({ title: '无法获取Canvas', icon: 'none' });
          console.error('Failed to get canvas node.');
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');

        // --- 设置更新后的canvas尺寸 ---
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 加载所有货品图片
        const productsWithImages = (orderData.productDetails || []).filter(item => item.image);
        let imagesLoadedCount = 0;
        const imagesToLoad = productsWithImages.length;
        const productImages = {}; // 存储加载完成的图片对象

        // 添加默认图片加载
        const defaultImg = canvas.createImage();
        let defaultImgLoaded = false;
        let defaultImgError = false; // 新增标志，记录默认图片是否加载失败
        defaultImg.onload = () => { 
            defaultImgLoaded = true; 
            console.log('[generateReceiveOrderShareImage] Default image loaded successfully.');
            // 如果只有默认图片需要加载 (imagesToLoad === 0)，则直接检查
            if (imagesToLoad === 0) checkAllImagesLoaded(); 
        };
        defaultImg.onerror = (err) => { 
            defaultImgLoaded = true; // 仍然标记为loaded以推进流程
            defaultImgError = true; // 但记录它发生了错误
            console.error('[generateReceiveOrderShareImage] Default image failed to load:', err, defaultImg.src);
            // 如果只有默认图片需要加载，也直接检查
            if (imagesToLoad === 0) checkAllImagesLoaded(); 
        };
        defaultImg.src = '/images/default-product.png'; // 默认图片路径

        const checkAllImagesLoaded = () => {
            // 所有图片（包括默认图片）都处理完毕后开始绘制
            if (imagesLoadedCount === imagesToLoad && defaultImgLoaded) {
                // --- 传递更新后的尺寸给绘制函数 ---
                // 如果默认图片加载失败，则传递null
                const validDefaultImg = defaultImgError ? null : defaultImg;
                this.drawReceiveOrderImage(ctx, canvas.width, canvas.height, orderData, productImages, validDefaultImg); 
                // 将canvas内容转为图片
                wx.canvasToTempFilePath({
                    canvas: canvas,
                    width: canvas.width,
                    height: canvas.height,
                    destWidth: canvas.width,
                    destHeight: canvas.height,
                    fileType: 'jpg',
                    quality: 0.85,
                    success: (res) => {
                        wx.hideLoading();
                        this.showShareModal(res.tempFilePath, orderData, 'receive');
                    },
                    fail: (err) => {
                        console.error('canvas转图片失败:', err);
                        wx.hideLoading();
                        wx.showToast({ title: '生成图片失败', icon: 'none' });
                    }
                });
            }
        };

        if (imagesToLoad === 0) {
            // 如果没有货品图片，直接绘制（等待默认图片加载完成后）
            // 这里需要确保 defaultImg.onload 或 .onerror 已经被触发了
            // 因此，如果 defaultImgLoaded 为 true，则可以调用 checkAllImagesLoaded
            if (defaultImgLoaded) {
                 checkAllImagesLoaded(); 
            }
            // 如果 defaultImgLoaded 仍为 false，则其 onload/onerror 会在稍后调用 checkAllImagesLoaded
        } else {
            // 加载图片
            productsWithImages.forEach(item => {
                const img = canvas.createImage();
                img.onload = () => {
                    imagesLoadedCount++;
                    // 使用货号作为key，确保与绘制时的映射一致
                    const styleNo = item.productNo || item.styleNo || item.id;
                    productImages[styleNo] = img;
                    checkAllImagesLoaded();
                };
                img.onerror = (err) => {
                    console.error('图片加载失败:', item.image, err);
                    imagesLoadedCount++;
                    const styleNo = item.productNo || item.styleNo || item.id;
                    productImages[styleNo] = null; // 标记加载失败
                    checkAllImagesLoaded();
                };
                const fullImageUrl = getFullImageUrl(item.image);
                console.log(`[generateReceiveOrderShareImage] Item ProductNo: ${item.productNo || 'N/A'}, Attempting to load image: ${fullImageUrl}`);
                img.src = fullImageUrl;
            });
        }
      });
  },
  
  // 绘制收回单图片 (现代化设计版本)
  drawReceiveOrderImage(ctx, canvasWidth, canvasHeight, orderData, productImages = {}, defaultImg = null) {
    // 设置背景色为纯白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 定义颜色和字体（适配1080px×1920px画布）
    const colors = {
      primary: '#1a1a1a',
      secondary: '#6c757d',
      accent: '#2980b9',
      success: '#27ae60',
      warning: '#ff9500',
      error: '#e74c3c',
      background: '#f0f0f0',
      border: '#000000',
      headerBg: '#fff8e6',
      rowBg: '#fafbfc'
    };
    
    const fonts = {
      title: 'bold 48px "Microsoft YaHei", sans-serif',
      header: 'bold 36px "Microsoft YaHei", sans-serif',
      body: '32px "Microsoft YaHei", sans-serif',
      small: '28px "Microsoft YaHei", sans-serif',
      caption: '24px "Microsoft YaHei", sans-serif'
    };
    
    const margin = 40;
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
    
    // 1. 绘制页面标题 - 统一格式：公司名+工序+单据类型
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.title;
    ctx.textAlign = 'center';
    const processName = orderData.process || '加工';
    ctx.fillText(`${companyName} - ${processName} - 收回单`, canvasWidth / 2, currentY + 60);
    currentY += 120;
    
    // 2. 绘制工厂信息（在表格外面的最上面）
    if (orderData.factoryName) {
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.header;
      ctx.textAlign = 'left';
      ctx.fillText(`工厂：${orderData.factoryName}`, margin, currentY + 40);
      currentY += 80;
    }
    
    // 2. 处理数据分组（按货号分组）
    const products = orderData.productDetails || [];
    const productGroups = new Map();
    
    // 如果没有明细数据，创建一个默认分组
    if (products.length === 0) {
      const defaultKey = `${orderData.productNo || orderData.styleNo || 'DEFAULT'}_${orderData.productName || ''}`;
      productGroups.set(defaultKey, {
        styleNo: orderData.productNo || orderData.styleNo || '-',
        productName: orderData.productName || '-',
        process: orderData.process || '-',
        details: [{
          color: orderData.color || '-',
          size: orderData.size || '-',
          pricePerKg: orderData.pricePerKg || orderData.price || 0,
          quantity: orderData.quantity || 0,
          weight: orderData.weight || 0,
          fee: orderData.fee || orderData.totalAmount || 0
        }]
      });
    } else {
      // 按货号分组
      products.forEach(product => {
        const key = `${product.productNo || product.styleNo || 'DEFAULT'}_${product.productName || ''}`;
        if (!productGroups.has(key)) {
          productGroups.set(key, {
            styleNo: product.productNo || product.styleNo || '-',
            productName: product.productName || '-',
            process: orderData.process || '-',
            details: []
          });
        }
        productGroups.get(key).details.push({
          color: product.color || '-',
          size: product.size || '-',
          pricePerKg: product.pricePerKg || product.price || 0,
          quantity: product.quantity || 0,
          weight: product.weight || 0,
          fee: product.fee || (product.pricePerKg && product.quantity ? parseFloat(product.pricePerKg) * parseFloat(product.quantity) : 0)
        });
      });
    }
    
    // 3. 绘制单据标题行（只显示一次）
    const tableWidth = canvasWidth - margin * 2;
    const rowHeight = 50;
    
    // 绘制收回单标题行（橙色背景）
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(margin, currentY, tableWidth, rowHeight);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
    
    // 标题行内容：收回单 + 单号 + 工序 + 日期
    ctx.fillStyle = colors.primary;
    ctx.font = fonts.small;
    ctx.textAlign = 'left';
    
    // 计算各部分位置
    const titleCellWidth = tableWidth / 6;
    let cellX = margin;
    
    // 收回单
    ctx.fillText('收回单', cellX + 10, currentY + rowHeight/2 + 8);
    cellX += titleCellWidth;
    
    // 单号
    ctx.fillText(orderData.orderNo || '-', cellX + 10, currentY + rowHeight/2 + 8);
    cellX += titleCellWidth;
    
    // 空白
    cellX += titleCellWidth;
    
    // 工序
    const receiveProcessName = orderData.process || '加工';
    ctx.fillText(receiveProcessName, cellX + 10, currentY + rowHeight/2 + 8);
    cellX += titleCellWidth;
    
    // 空白
    cellX += titleCellWidth;
    
    // 日期 - 向左移动一点，确保完美展示在表格内
    ctx.fillText(orderData.date || '-', cellX + 5, currentY + rowHeight/2 + 8);
    
    currentY += rowHeight;
    
    // 4. 绘制每个货号分组
    for (const [productKey, group] of productGroups) {
      
      // 绘制货号信息行 - 根据图片大小自动适配行高
      const imgSize = 100;
      const productImage = productImages[group.styleNo] || defaultImg;
      const infoRowHeight = productImage ? Math.max(rowHeight, imgSize + 10) : rowHeight; // 图片高度+10px边距，最小为原行高
      
      ctx.fillStyle = colors.rowBg;
      ctx.fillRect(margin, currentY, tableWidth, infoRowHeight);
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(margin, currentY, tableWidth, infoRowHeight);
      
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.small;
      ctx.textAlign = 'left';
      
      // 货号信息：货号 + 货品名称（两列布局）
      cellX = margin;
      const infoCellWidth = tableWidth / 2;
      
      // 在货号位置添加图片显示
      if (productImage) {
        // 绘制货品图片（调整为100×100px，在货号文字左侧）
        const imgY = currentY + (infoRowHeight - imgSize) / 2;
        ctx.drawImage(productImage, cellX + 5, imgY, imgSize, imgSize);
        // 货号文字向右偏移，为图片留出空间
        ctx.fillText(`货号：${group.styleNo}`, cellX + imgSize + 15, currentY + infoRowHeight/2 + 8);
      } else {
        ctx.fillText(`货号：${group.styleNo}`, cellX + 10, currentY + infoRowHeight/2 + 8);
      }
      cellX += infoCellWidth;
      
      ctx.fillText(`货品名称：${group.productName}`, cellX + 10, currentY + infoRowHeight/2 + 8);
      
      currentY += infoRowHeight;
      
      // 绘制明细表头
      ctx.fillStyle = colors.headerBg;
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.border;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.primary;
      ctx.font = fonts.caption;
      ctx.textAlign = 'center';
      
      // 表头列：颜色、尺码、工价、数量、重量、工费
      const colWidths = [
        tableWidth * 0.15,  // 颜色
        tableWidth * 0.15,  // 尺码
        tableWidth * 0.15,  // 工价
        tableWidth * 0.15,  // 数量
        tableWidth * 0.15,  // 重量
        tableWidth * 0.25   // 工费
      ];
      const headers = ['颜色', '尺码', '工价', '数量', '重量', '工费'];
      
      cellX = margin;
      headers.forEach((header, index) => {
        ctx.fillText(header, cellX + colWidths[index]/2, currentY + rowHeight/2 + 8);
        
        // 绘制列分隔线
        if (index < headers.length - 1) {
          ctx.strokeStyle = colors.border;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cellX + colWidths[index], currentY);
          ctx.lineTo(cellX + colWidths[index], currentY + rowHeight);
          ctx.stroke();
        }
        
        cellX += colWidths[index];
      });
      
      currentY += rowHeight;
      
      // 绘制明细数据行
      group.details.forEach((detail, index) => {
        // 交替行背景
        if (index % 2 === 1) {
          ctx.fillStyle = colors.rowBg;
          ctx.fillRect(margin, currentY, tableWidth, rowHeight);
        }
        
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
        
        ctx.fillStyle = colors.secondary;
        ctx.font = fonts.caption;
        ctx.textAlign = 'center';
        
        cellX = margin;
        
        // 颜色
        ctx.fillText(detail.color, cellX + colWidths[0]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[0];
        
        // 尺码
        ctx.fillText(detail.size, cellX + colWidths[1]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[1];
        
        // 工价（橙色）
        ctx.fillStyle = colors.warning;
        ctx.font = 'bold ' + fonts.caption;
        ctx.fillText(detail.pricePerKg || '0', cellX + colWidths[2]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[2];
        
        // 数量（蓝色）- 取消单位"打"
        ctx.fillStyle = colors.accent;
        ctx.fillText(detail.quantity, cellX + colWidths[3]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[3];
        
        // 重量（绿色）- 取消单位"kg"
        ctx.fillStyle = colors.success;
        ctx.font = fonts.caption;
        ctx.fillText(detail.weight, cellX + colWidths[4]/2, currentY + rowHeight/2 + 8);
        cellX += colWidths[4];
        
        // 工费（红色）
        ctx.fillStyle = colors.error;
        ctx.font = 'bold ' + fonts.caption;
        ctx.fillText((detail.fee || '0') + '.00', cellX + colWidths[5]/2, currentY + rowHeight/2 + 8);
        
        // 绘制列分隔线
        cellX = margin;
        colWidths.forEach((width, i) => {
          if (i < colWidths.length - 1) {
            ctx.strokeStyle = colors.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cellX + width, currentY);
            ctx.lineTo(cellX + width, currentY + rowHeight);
            ctx.stroke();
          }
          cellX += width;
        });
        
        currentY += rowHeight;
      });
      
      // 绘制小计行（浅蓝背景）
      ctx.fillStyle = '#f0f8ff';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.accent;
      ctx.font = fonts.small;
      ctx.textAlign = 'left';
      ctx.fillText('小计', margin + 10, currentY + rowHeight/2 + 8);
      
      // 计算小计
      const subtotalQty = group.details.reduce((sum, detail) => sum + (parseFloat(detail.quantity) || 0), 0);
      const subtotalWeight = group.details.reduce((sum, detail) => sum + (parseFloat(detail.weight) || 0), 0);
      const subtotalFee = group.details.reduce((sum, detail) => sum + (parseFloat(detail.fee) || 0), 0);
      
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.accent;
      ctx.fillText(subtotalQty + '打', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]/2, currentY + rowHeight/2 + 8);
      ctx.fillStyle = colors.success;
      ctx.fillText(subtotalWeight.toFixed(1) + 'kg', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]/2, currentY + rowHeight/2 + 8);
      
      // 工费小计用醒目颜色
      ctx.fillStyle = colors.error;
      ctx.font = 'bold ' + fonts.small;
      ctx.fillText(subtotalFee.toFixed(0), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5]/2, currentY + rowHeight/2 + 8);
      
      currentY += rowHeight; // 去除组间距，紧密连接
    }
    
    // 4. 计算所有分组的总计（在函数作用域内，供后续使用）
    let totalQty = 0;
    let totalWeight = 0;
    let totalFee = 0;
    
    for (const [productKey, group] of productGroups) {
      const subtotalQty = group.details.reduce((sum, detail) => sum + (parseFloat(detail.quantity) || 0), 0);
      const subtotalWeight = group.details.reduce((sum, detail) => sum + (parseFloat(detail.weight) || 0), 0);
      const subtotalFee = group.details.reduce((sum, detail) => sum + (parseFloat(detail.fee) || 0), 0);
      totalQty += subtotalQty;
      totalWeight += subtotalWeight;
      totalFee += subtotalFee;
    }
    
    // 5. 绘制合计行（收回单）
    if (productGroups.size > 0) {
      
      // 重新定义列宽（与表头保持一致）
      const colWidths = [
        tableWidth * 0.15,  // 颜色
        tableWidth * 0.15,  // 尺码
        tableWidth * 0.15,  // 工价
        tableWidth * 0.15,  // 数量
        tableWidth * 0.15,  // 重量
        tableWidth * 0.25   // 工费
      ];
      
      // 绘制合计行（深蓝背景）
      ctx.fillStyle = '#e3f2fd';
      ctx.fillRect(margin, currentY, tableWidth, rowHeight);
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.strokeRect(margin, currentY, tableWidth, rowHeight);
      
      ctx.fillStyle = colors.primary;
      ctx.font = 'bold ' + fonts.body;
      ctx.textAlign = 'left';
      ctx.fillText('合计:', margin + 10, currentY + rowHeight/2 + 8);
      
      // 合计数据
      ctx.textAlign = 'center';
      ctx.fillStyle = colors.accent;
      ctx.font = 'bold ' + fonts.body;
      ctx.fillText(totalQty + '打', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3]/2, currentY + rowHeight/2 + 8);
      ctx.fillStyle = colors.success;
      ctx.fillText(totalWeight.toFixed(1) + 'kg', margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4]/2, currentY + rowHeight/2 + 8);
      ctx.fillStyle = colors.error;
      ctx.fillText(totalFee.toFixed(0), margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5]/2, currentY + rowHeight/2 + 8);
      
      currentY += rowHeight;
    }
    
    // 6. 绘制支付信息（仅收回单显示，紧挨合计栏）
    currentY += 30;
    ctx.fillStyle = colors.primary;
    ctx.font = 'bold ' + fonts.body;
    ctx.textAlign = 'left';
    ctx.fillText('支付信息', margin, currentY);
    currentY += 50;
    
    // 支付信息背景 - 增加高度以容纳3行内容
    const paymentInfoHeight = 150;
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(margin, currentY, tableWidth, paymentInfoHeight);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(margin, currentY, tableWidth, paymentInfoHeight);
    
    // 支付信息内容
    ctx.fillStyle = colors.primary; // 改为黑色
    ctx.font = fonts.body;
    ctx.textAlign = 'left';
    
    // 垂直居中计算：框高150px，三行文字，每行间距30px，垂直居中
    const paymentY = currentY + (paymentInfoHeight - 90) / 2 + 20; // 垂直居中位置
    const leftCol = margin + 20;
    const rightCol = margin + tableWidth / 2 + 20;
    
    // 计算相关数据
    // 本单金额使用合计的总工费，如果没有则使用orderData.totalAmount
    const currentOrderAmount = parseFloat(totalFee > 0 ? totalFee : (orderData.totalAmount || 0));
    const paidAmount = parseFloat(orderData.paymentAmount || orderData.paidAmount || 0); // 修复：转换为数字类型
    const currentBalance = paidAmount - currentOrderAmount; // 计算本次结余：支付金额 - 本单金额
    
    // 左列：支付方式、支付金额、本单金额
    ctx.fillText(`支付方式: ${orderData.paymentMethod || '未设置'}`, leftCol, paymentY);
    ctx.fillText(`支付金额: ¥${paidAmount.toFixed(2)}`, leftCol, paymentY + 30);
    ctx.fillText(`本单金额: ¥${currentOrderAmount.toFixed(2)}`, leftCol, paymentY + 60);
    
    // 右列：本次结余、累计结余
    ctx.fillText(`本次结余: ¥${currentBalance.toFixed(2)}`, rightCol, paymentY);
    ctx.fillText(`累计结余: ¥${parseFloat(orderData.balance || 0).toFixed(2)}`, rightCol, paymentY + 30);
    
    currentY += paymentInfoHeight + 40;
    
    // 7. 绘制备注（如果有）
    if (orderData.remark) {
      ctx.fillStyle = colors.secondary;
      ctx.font = fonts.body;
      ctx.textAlign = 'left';
      ctx.fillText(`备注: ${orderData.remark}`, margin, currentY);
      currentY += 60;
    }
    
    // 8. 绘制底部信息
    const footerY = canvasHeight - 120;
    
    // 底部分隔线
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, footerY - 40);
    ctx.lineTo(canvasWidth - margin, footerY - 40);
    ctx.stroke();
    
    // 底部信息
    ctx.fillStyle = colors.secondary;
    ctx.font = fonts.small;
    ctx.textAlign = 'left';
    ctx.fillText(`制单人: ${orderData.staff || orderData.creator || '-'}`, margin, footerY);
    
    ctx.textAlign = 'right';
    const createTime = orderData.originalCreatedAt || orderData.createdAt || new Date();
    const timeStr = typeof createTime === 'string' ? createTime : createTime.toLocaleString();
    ctx.fillText(`制单时间: ${timeStr}`, canvasWidth - margin, footerY);
    
    // 系统标识
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.secondary;
    ctx.font = fonts.caption;
    ctx.fillText('云收发', canvasWidth / 2, footerY + 50);
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
    const orgId = wx.getStorageSync('orgId');
    // 🔧 修复：设置足够大的pageSize确保获取所有工厂数据
    api.request('/factories', 'GET', { 
      orgId, 
      pageSize: 1000  // 设置足够大的pageSize获取所有工厂
    })
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          // 添加"全部工厂"选项
          const factories = [
            { id: '', name: '全部工厂' },
            ...res.data
          ];
          
          this.setData({ 
            factoryOptions: factories,
            // 初始化筛选工厂列表（排除"全部工厂"选项）
            filteredFilterFactories: res.data
          });
          
          console.log('工厂数据加载完成，总数:', factories.length, '筛选列表数量:', res.data.length);
          console.log('后端返回的分页信息:', {
            totalCount: res.totalCount,
            page: res.page,
            pageSize: res.pageSize,
            hasMore: res.hasMore
          });
        } else {
          console.warn('工厂数据格式异常:', res);
        }
      })
      .catch(err => {
        console.error('加载工厂数据失败:', err);
        // 加载失败时设置空数组，避免undefined错误
        this.setData({
          factoryOptions: [{ id: '', name: '全部工厂' }],
          filteredFilterFactories: []
        });
      });
  },
  
  // 加载工序数据
  loadProcesses() {
    const orgId = wx.getStorageSync('orgId');
    api.request('/processes', 'GET', { orgId })
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
  },

  // 新增一个统一的排序函数作为Page的方法
  sortOrders(orderArray) {
    if (!orderArray || orderArray.length === 0) {
      return [];
    }
    // 统一按订单日期 (date) 和 创建时间 (createdAt) 降序排序
    // 确保 date 和 createdAt 都是可比较的 (Date对象或能被 new Date() 解析的字符串)
    const desc = (a, b) => {
      const dateA = new Date(a.date); // item.date已经是YYYY-MM-DD, new Date()可以解析
      const dateB = new Date(b.date);
      
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      
      // 如果订单日期相同，则按创建时间(原始的 order.createdAt) 降序
      // formatDateTimeToMinute 返回的是字符串 "YYYY-MM-DD HH:mm"
      // 直接用 new Date() 比较更可靠
      const createdAtA = new Date(fixIOSDateString(a.rawCreatedAt || a.createdAt)); // 假设我们能拿到原始的createdAt
      const createdAtB = new Date(fixIOSDateString(b.rawCreatedAt || b.createdAt)); // 或者用已经 new Date() 过的
      
      // 确保 a.createdAt 和 b.createdAt 是可比较的
      // 如果 a.createdAt 是 "YYYY-MM-DD HH:mm" 格式, new Date() 也能解析
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); 
    };
    return [...orderArray].sort(desc); // 使用扩展运算符创建新数组进行排序
  },

  // 计算底部统计数据
  calculateStatistics() {
    const orders = this.data.orders || [];
    const activeTab = this.data.activeTab;
    
    if (activeTab === 'send') {
      // 计算发出单统计 - 只统计有效单据（status=1）
      let totalCount = 0;
      let totalQuantity = 0;
      let totalWeight = 0;
      
      orders.forEach(order => {
        // 跳过作废单据
        if (order.status === 0) return;
        
        // 统计有效单据数量
        totalCount++;
        
        // 累计数量
        const quantity = parseFloat(order.totalQuantity || order.quantity || 0);
        totalQuantity += quantity;
        
        // 累计重量
        const weight = parseFloat(order.totalWeight || order.weight || 0);
        totalWeight += weight;
      });
      
      // 格式化数值并添加自适应字体类名
      const formattedQuantity = this.formatNumberWithClass(totalQuantity.toFixed(0));
      const formattedWeight = this.formatNumberWithClass(totalWeight.toFixed(1));
      
      this.setData({
        totalSendCount: totalCount,
        totalSendQuantity: formattedQuantity.value,
        totalSendQuantityClass: formattedQuantity.className,
        totalSendWeight: formattedWeight.value,
        totalSendWeightClass: formattedWeight.className
      });
      
    } else if (activeTab === 'receive') {
      // 计算收回单统计 - 只统计有效单据（status=1）
      let totalCount = 0;
      let totalQuantity = 0;
      let totalWeight = 0;
      let totalAmount = 0;
      let totalPayment = 0;
      
      orders.forEach(order => {
        // 跳过作废单据
        if (order.status === 0) return;
        
        // 统计有效单据数量
        totalCount++;
        
        // 累计数量
        const quantity = parseFloat(order.totalQuantity || order.quantity || 0);
        totalQuantity += quantity;
        
        // 累计重量
        const weight = parseFloat(order.totalWeight || order.weight || 0);
        totalWeight += weight;
        
        // 累计金额
        const amount = parseFloat(order.fee || order.totalAmount || 0);
        totalAmount += amount;
        
        // 累计支付金额 - 修复：优先使用paymentAmount字段
        const payment = parseFloat(order.paymentAmount || order.payableAmount || order.paidAmount || 0);
        totalPayment += payment;
      });
      
      // 格式化数值并添加自适应字体类名
      const formattedQuantity = this.formatNumberWithClass(totalQuantity.toFixed(0));
      const formattedWeight = this.formatNumberWithClass(totalWeight.toFixed(1));
      const formattedAmount = this.formatNumberWithClass(totalAmount.toFixed(2));
      const formattedPayment = this.formatNumberWithClass(totalPayment.toFixed(2));
      
      this.setData({
        totalReceiveCount: totalCount,
        totalReceiveQuantity: formattedQuantity.value,
        totalReceiveQuantityClass: formattedQuantity.className,
        totalReceiveWeight: formattedWeight.value,
        totalReceiveWeightClass: formattedWeight.className,
        totalAmount: formattedAmount.value,
        totalAmountClass: formattedAmount.className,
        totalPayment: formattedPayment.value,
        totalPaymentClass: formattedPayment.className
      });
    }
  },
  
  // 根据数字长度格式化并返回对应的CSS类名
  formatNumberWithClass(numberStr) {
    const length = numberStr.toString().length;
    let className = '';
    let value = numberStr;
    
    // 根据字符长度决定字体大小类名
    if (length >= 8) {
      className = 'very-long-number';
      // 超长数字可以考虑使用科学计数法或简化显示
      const num = parseFloat(numberStr);
      if (num >= 100000) {
        value = (num / 10000).toFixed(1) + '万';
      }
    } else if (length >= 6) {
      className = 'long-number';
      // 长数字可以考虑使用千分位
      const num = parseFloat(numberStr);
      if (num >= 10000) {
        value = (num / 10000).toFixed(1) + '万';
      }
    }
    
    return {
      value: value,
      className: className
    };
  },

  // 微信原生转发钩子
  onShareAppMessage: function(res) {
    // 支持从按钮触发和右上角菜单触发
    let shareTitle = '单据分享';
    let shareImageUrl = '';
    let sharePath = '/pages/send-receive/send-receive';

    // 如果是从按钮触发，且有当前单据信息
    if (res && res.from === 'button' && res.target && res.target.dataset) {
      const { id, type } = res.target.dataset;
      shareTitle = `单据分享 - ${type === 'send' ? '发出单' : '收回单'}`;
      // 拼接页面路径，带上单据id和类型参数
      sharePath = `/pages/send-receive/send-receive?id=${id}&type=${type}`;
      // 如果已生成分享图片，带上图片
      if (this.shareImagePath) {
        shareImageUrl = this.shareImagePath;
      }
    }

    return {
      title: shareTitle,
      path: sharePath,
      imageUrl: shareImageUrl || undefined
    };
  }
});