const app = getApp()
const api = require('../../utils/api')
const request = require('../../utils/request')

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 改进的日期格式化函数，更加健壮
function formatDateToYYYYMMDD(dateValue) {
  if (!dateValue) return null;
  
  try {
    let date;
    if (typeof dateValue === 'string') {
      // 首先尝试提取YYYY-MM-DD部分
      const dateMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch && dateMatch[1]) {
        return dateMatch[1]; // 直接返回匹配到的YYYY-MM-DD部分
      }
      
      // 如果没有匹配到，尝试完整解析
      date = new Date(dateValue.replace(/\s/, 'T'));
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      return null; // 不支持的类型
    }

    if (isNaN(date.getTime())) {
      return null; // 无效日期
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
  }
}

Page({
  data: {
    activeTab: 'sent',
    sendList: [],
    receiveList: [],
    // Add new data properties for today's stats
    todaySendOrderCount: 0,
    todaySendTotalWeight: "0.00",
    todayReceiveOrderCount: 0,
    todayReceiveTotalWeight: "0.00",
    loadSendError: false,
    loadReceiveError: false,
    sendRequestParams: { page: 1, limit: 10 },
    receiveRequestParams: { page: 1, limit: 10 },
    isSendLastPage: false,
    isReceiveLastPage: false,
    sendTotal: 0,
    receiveTotal: 0,
    showAIHelperText: true, // 新增：控制是否显示AI助理文本
    qualifiedLossRanking: [], // 新增：损耗率合格排行数据
    qualifiedRankingLoading: false, // 新增：合格排行加载状态
    
    // 时间筛选相关
    qualifiedTimeFilterType: 'month', // 默认本月：'today', 'week', 'month', 'year', 'custom'
    qualifiedCustomStartDate: '',
    qualifiedCustomEndDate: '',
    showQualifiedCustomTimeModal: false
  },

  onLoad: function(options) {
    this.checkTokenAndLoadData();
  },

  onShow: function() {
    this.checkTokenAndLoadData();
  },

  /**
   * 检查token有效性并加载数据
   */
  async checkTokenAndLoadData() {
    const token = wx.getStorageSync('token');
    const orgId = wx.getStorageSync('orgId');
    const userId = wx.getStorageSync('userId');
    
    console.log('[Index] 检查Token和数据加载:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : '无',
      orgId,
      userId
    });
    
    if (!token) {
      console.log('[Index] 没有token，跳转到登录页');
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }

    try {
      // 验证token有效性
      console.log('[Index] 开始验证token有效性');
      const res = await request.post('auth', {
        action: 'verify-token',
        data: {
          token: token
        }
      }, {
        showLoading: false,
        showError: false
      });
      
      console.log('[Index] Token验证响应:', res);

      if (res.success) {
        // token有效，加载页面数据
        this.loadInitialData();
      } else {
        // token无效，清除存储并跳转登录页
        console.log('[Index] Token无效，跳转登录页');
        wx.clearStorageSync();
        wx.reLaunch({ url: '/pages/login/login' });
      }
    } catch (error) {
      // token验证失败，清除存储并跳转登录页
      console.log('[Index] Token验证失败，跳转登录页:', error);
      wx.clearStorageSync();
      wx.reLaunch({ url: '/pages/login/login' });
    }
  },

  async loadInitialData() {
    // 重置页面状态
    this.setData({
      'sendRequestParams.page': 1,
      'receiveRequestParams.page': 1,
      sendList: [],
      receiveList: [],
      isSendLastPage: false,
      isReceiveLastPage: false,
      loadSendError: false,
      loadReceiveError: false,
      // 重置今日数据
      todaySendOrderCount: 0,
      todaySendTotalWeight: "0.00",
      todayReceiveOrderCount: 0,
      todayReceiveTotalWeight: "0.00",
      qualifiedRankingLoading: true
    });

    wx.showLoading({ title: '加载中...' });
    
    try {
      // 并行加载数据，提升性能
      const [todayStats, qualifiedRanking] = await Promise.allSettled([
        this.fetchTodayStats(),
        this.fetchQualifiedLossRanking()
      ]);
      
      // 处理今日统计数据结果
      if (todayStats.status === 'rejected') {
        console.warn('[Index] 今日统计数据加载失败:', todayStats.reason);
        wx.showToast({ 
          title: '统计数据加载失败', 
          icon: 'none',
          duration: 2000
        });
      }
      
      // 处理损耗率排行数据结果
      if (qualifiedRanking.status === 'rejected') {
        console.warn('[Index] 损耗率排行数据加载失败:', qualifiedRanking.reason);
      }
      
      // 设置列表为空（根据业务需求）
      this.setData({
        sendList: [],
        receiveList: [],
        isSendLastPage: true,
        isReceiveLastPage: true,
        qualifiedRankingLoading: false
      });
      
      console.log('[Index] 数据加载完成，页面状态:', {
        showAIHelperText: this.data.showAIHelperText,
        qualifiedLossRanking: this.data.qualifiedLossRanking,
        qualifiedCount: this.data.qualifiedLossRanking.length,
        todayStats: {
          sendCount: this.data.todaySendOrderCount,
          receiveCount: this.data.todayReceiveOrderCount
        }
      });
      
    } catch (error) {
      console.error('[Index] 数据加载异常:', error);
      this.setData({
        qualifiedRankingLoading: false
      });
      wx.showToast({ 
        title: '数据加载失败，请重试', 
        icon: 'none',
        duration: 3000
      });
    } finally {
      wx.hideLoading();
      wx.stopPullDownRefresh();
    }
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      activeTab: tab
    });
  },

  // 跳转到AI智能流水表
  navigateToAIFlowTable: function() {
    console.log('[Index] 跳转到AI智能流水表');
    wx.navigateTo({
      url: '/pages/ai-reports/ai-reports',
      success: function() {
        console.log('[Index] 成功跳转到AI智能流水表');
      },
      fail: function(error) {
        console.error('[Index] 跳转AI智能流水表失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 辅助函数：从多种可能的日期字段和格式中提取日期
  // 这部分代码将被移除

  // 递归获取所有订单数据（不受分页影响）
  // fetchAllOrders: function (type, orgId, page = 1, limit = 100, allRecords = []) { ... },

  async fetchTodayStats() {
    try {
      const todayDateString = getTodayDateString();
      const orgId = wx.getStorageSync('orgId');
      
      if (!orgId) {
        console.warn('[Index] 组织ID为空，跳过统计数据获取');
        return;
      }
      
      console.log('[Index] 获取今日统计数据:', { orgId, date: todayDateString });
      
      const res = await request.get('stats/for-date', {
        orgId,
        date: todayDateString
      }, {
        showLoading: false,
        timeout: 8000
      });
      
      if (res && res.success && res.data) {
        const statsData = res.data;
        const updateData = {
          todaySendOrderCount: statsData.sendOrders?.count || 0,
          todaySendTotalWeight: statsData.sendOrders?.totalWeight || "0.00",
          todayReceiveOrderCount: statsData.receiveOrders?.count || 0,
          todayReceiveTotalWeight: statsData.receiveOrders?.totalWeight || "0.00"
        };
        
        this.setData(updateData);
        
        console.log('[Index] 今日统计数据更新成功:', updateData);
      } else {
        console.warn('[Index] 统计数据响应格式异常:', res);
        this.setData({
          todaySendOrderCount: 0,
          todaySendTotalWeight: "0.00",
          todayReceiveOrderCount: 0,
          todayReceiveTotalWeight: "0.00"
        });
      }
    } catch (error) {
      console.error('[Index] 获取今日统计数据失败:', error);
      // 设置默认值，不阻断页面加载
      this.setData({
        todaySendOrderCount: 0,
        todaySendTotalWeight: "0.00",
        todayReceiveOrderCount: 0,
        todayReceiveTotalWeight: "0.00"
      });
      throw error; // 重新抛出错误，让上层处理
     }
   },

  async fetchQualifiedLossRanking() {
    try {
      console.log('[Index] 开始获取损耗率合格排行数据');
      console.log('[Index] 当前showAIHelperText值:', this.data.showAIHelperText);
      
      // 设置加载状态
      this.setData({
        qualifiedRankingLoading: true
      });
      
      // 根据时间筛选类型计算日期范围
      const dateRange = this.calculateQualifiedDateRange();
      
      // 构建API参数
      const params = {
        mode: 'product',
        qualified: true,
        limit: 10
      };
      
      // 添加时间筛选参数
      if (dateRange.startDate) {
        params.startDate = dateRange.startDate;
      }
      if (dateRange.endDate) {
        params.endDate = dateRange.endDate;
      }
      
      console.log('[Index] API参数:', params);
      
      const result = await request.get('loss-ranking', params, {
        showLoading: false,
        timeout: 10000
      });
      console.log('[Index] 损耗率合格排行API完整返回结果:', result);
      
      let qualifiedList = [];
      
      if (result && result.success && result.data && Array.isArray(result.data)) {
        console.log('[Index] API调用成功，原始数据数量:', result.data.length);
        
        // 过滤出损耗率合格的数据（≤2%），并格式化
        qualifiedList = result.data
          .filter(item => {
            const lossRate = parseFloat(item.lossRate || 0);
            const isQualified = Math.abs(lossRate) <= 2; // 绝对值≤2%认为是合格的
            console.log(`[Index] 检查货品 ${item.productName || item.productNo}: 损耗率=${lossRate}%, 合格=${isQualified}`);
            return isQualified;
          })
          .map((item, index) => {
            const formattedItem = {
              id: `qualified_${item.id || index}`,
              name: item.productName || item.productNo || '未知货品',
              productNo: item.productNo || '-',
              productName: item.productName || '-',
              productImage: this.processImageUrl(item.productImage), // 使用与AI助理相同的图片处理
              lossRate: parseFloat(item.lossRate || 0).toFixed(2),
              sendWeight: parseFloat(item.totalSendWeight || 0).toFixed(2),
              receiveWeight: parseFloat(item.totalReceiveWeight || 0).toFixed(2),
              factoryCount: parseInt(item.factoryCount || 0),
              rank: index + 1
            };
            console.log('[Index] 格式化后的数据项:', formattedItem);
            return formattedItem;
          })
          .slice(0, 10); // 取前10条
      } else {
        console.warn('[Index] API返回数据格式异常或为空:', result);
      }
      
      console.log('[Index] 最终合格数据列表:', qualifiedList);
      
      this.setData({
        qualifiedLossRanking: qualifiedList,
        qualifiedRankingLoading: false
      });
      
      console.log('[Index] 数据已设置到页面，当前页面数据:', {
        qualifiedLossRanking: this.data.qualifiedLossRanking,
        showAIHelperText: this.data.showAIHelperText,
        loading: this.data.qualifiedRankingLoading
      });
      
    } catch (error) {
      console.error('[Index] 获取损耗率合格排行异常:', error);
      console.error('[Index] 错误详情:', error.message, error.stack);
      
      // 设置空数据和结束加载状态
      this.setData({
        qualifiedLossRanking: [],
        qualifiedRankingLoading: false
      });
      
      console.log('[Index] 异常时设置空数据，showAIHelperText:', this.data.showAIHelperText);
      
      throw error; // 重新抛出错误，让上层处理
     }
   },

  // 处理图片URL - 与AI助理界面保持一致
  processImageUrl(imagePath) {
    console.log('[Index] 处理图片URL:', imagePath);
    
    // 处理无效输入
    if (!imagePath || imagePath === 'undefined' || imagePath === 'null') {
      console.warn('[Index] 图片路径为空或无效');
      return '';
    }
    
    // 如果已经是完整的 http/https URL，直接返回
    if (/^https?:\/\//.test(imagePath)) {
      console.log('[Index] 完整HTTP(S)路径:', imagePath);
      return imagePath;
    }
    
    // 规范化路径
    let localPath = String(imagePath);
    while (localPath.startsWith('//')) {
      localPath = localPath.substring(1);
    }
    if (!localPath.startsWith('/')) {
      localPath = '/' + localPath;
    }
    
    // 检查是否已包含_thumb后缀，避免重复添加
    if (localPath.includes('_thumb')) {
      console.log('[Index] 图片已包含_thumb后缀:', localPath);
      const fullUrl = `https://aiyunsf.com${localPath}`;
      console.log('[Index] 最终图片URL:', fullUrl);
      return fullUrl;
    }
    
    // 为没有_thumb后缀的图片添加_thumb
    const pathParts = localPath.split('.');
    if (pathParts.length > 1) {
      const extension = pathParts.pop();
      const basePath = pathParts.join('.');
      localPath = `${basePath}_thumb.${extension}`;
    }
    
    const fullUrl = `https://aiyunsf.com${localPath}`;
    console.log('[Index] 处理后的图片URL:', fullUrl);
    return fullUrl;
  },

  fetchSendList: function(isRefresh = false) {
    return Promise.resolve();
    // this.setData({ loadSendError: false });
  },

  fetchReceiveList: function(isRefresh = false) {
    return Promise.resolve();
    // this.setData({ loadReceiveError: false });
  },

  onAddOrder: function() {
    if (this.data.activeTab === 'sent') {
      wx.navigateTo({
        url: '/pages/send-order/send-order'
      });
    } else if (this.data.activeTab === 'received') {
      wx.navigateTo({
        url: '/pages/receive-order/receive-order'
      });
    }
  },

  // 获取订单状态的文本描述
  getStatusText: function(status) {
    const statusMap = {
      'pending': '待处理',
      'normal': '正常',
      'completed': '已完成',
      'cancelled': '已作废',
      'deleted': '已删除'
    };
    return statusMap[status] || status || '未知';
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadInitialData(); // 重新加载今日统计数据和清空列表
    // 保持AI助理文本显示，不重新获取列表
    // this.loadInitialData();
  },

  // 上拉触底加载更多列表数据
  onReachBottom: function() {
      // 不再加载更多列表数据
      // if (this.data.activeTab === 'sent' && !this.data.isSendLastPage && !this.data.loadSendError) { ... }
      // else if (this.data.activeTab === 'received' && !this.data.isReceiveLastPage && !this.data.loadReceiveError) { ... }
  },

  // 图片加载失败处理
  onImageError: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log('[Index] 图片加载失败，索引:', index);
    console.log('[Index] 图片错误事件详情:', e.detail);
    
    // 可以在这里处理图片加载失败的逻辑
    // 例如更新数据中的图片字段，设置为空以显示占位符
    if (typeof index !== 'undefined' && this.data.qualifiedLossRanking[index]) {
      const updatePath = `qualifiedLossRanking[${index}].productImage`;
      console.log(`[Index] 清除失败的图片路径: ${updatePath}`);
      this.setData({
        [updatePath]: '' // 清除图片路径，显示占位符
      });
    }
  },

  // 时间筛选相关方法

  // 计算合格排行日期范围
  calculateQualifiedDateRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (this.data.qualifiedTimeFilterType) {
      case 'today':
        return {
          startDate: this.formatDate(today),
          endDate: this.formatDate(today)
        };
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return {
          startDate: this.formatDate(weekStart),
          endDate: this.formatDate(weekEnd)
        };
      
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          startDate: this.formatDate(monthStart),
          endDate: this.formatDate(monthEnd)
        };
      
      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        const yearEnd = new Date(today.getFullYear(), 11, 31);
        return {
          startDate: this.formatDate(yearStart),
          endDate: this.formatDate(yearEnd)
        };
      
      case 'custom':
        return {
          startDate: this.data.qualifiedCustomStartDate,
          endDate: this.data.qualifiedCustomEndDate
        };
      
      default:
        return {
          startDate: null,
          endDate: null
        };
    }
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 选择合格排行时间筛选类型
  selectQualifiedTimeFilter(e) {
    const type = e.currentTarget.dataset.type;
    console.log('[Index] 选择合格排行时间筛选:', type);
    
    if (type === 'custom') {
      this.showQualifiedCustomTimeFilter();
      return;
    }
    
    this.setData({ qualifiedTimeFilterType: type });
    
    // 重新加载数据
    wx.showLoading({ title: '筛选中...', mask: true });
    this.fetchQualifiedLossRanking().finally(() => {
      wx.hideLoading();
    });
  },

  // 显示自定义时间筛选弹窗
  showQualifiedCustomTimeFilter() {
    console.log('[Index] 显示自定义时间筛选');
    this.setData({ showQualifiedCustomTimeModal: true });
  },

  // 隐藏自定义时间筛选弹窗
  hideQualifiedCustomTimeFilter() {
    this.setData({ showQualifiedCustomTimeModal: false });
  },

  // 自定义开始日期改变
  onQualifiedCustomStartDateChange(e) {
    this.setData({ qualifiedCustomStartDate: e.detail.value });
  },

  // 自定义结束日期改变
  onQualifiedCustomEndDateChange(e) {
    this.setData({ qualifiedCustomEndDate: e.detail.value });
  },

  // 确认自定义时间筛选
  confirmQualifiedCustomTimeFilter() {
    const { qualifiedCustomStartDate, qualifiedCustomEndDate } = this.data;
    
    if (!qualifiedCustomStartDate || !qualifiedCustomEndDate) {
      wx.showToast({
        title: '请选择完整的日期范围',
        icon: 'none'
      });
      return;
    }
    
    if (qualifiedCustomStartDate > qualifiedCustomEndDate) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      });
      return;
    }
    
    console.log('[Index] 确认自定义时间筛选:', qualifiedCustomStartDate, '-', qualifiedCustomEndDate);
    
    this.setData({ 
      qualifiedTimeFilterType: 'custom',
      showQualifiedCustomTimeModal: false
    });
    
    // 重新加载数据
    wx.showLoading({ title: '筛选中...', mask: true });
    this.fetchQualifiedLossRanking().finally(() => {
      wx.hideLoading();
    });
  },

  // 空函数，用于阻止事件冒泡
  doNothing() {
    // 空函数，用于阻止事件冒泡
  },
});