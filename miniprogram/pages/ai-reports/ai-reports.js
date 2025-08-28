const api = require('../../utils/api');

// AI智能助理页面
Page({
  data: {
    // 异常警报数据
    alerts: [],
    alertCount: 0,
    // 损耗率排行榜模式：'product' 或 'factory'
    lossRankingMode: 'product',
    
    // 时间筛选相关
    timeFilterType: 'month', // 默认本月：'today', 'week', 'month', 'year', 'custom'
    customStartDate: '',
    customEndDate: '',
    showCustomTimeModal: false,
    
    // 活跃排行时间筛选相关
    activeTimeFilterType: 'month', // 默认本月：'today', 'week', 'month', 'year', 'custom'
    activeCustomStartDate: '',
    activeCustomEndDate: '',
    showActiveCustomTimeModal: false,
    
    // 活跃排行数据
    activeProducts: [],
    activeFactories: [],
    
    // 智能建议数据
    suggestions: [],
    
    // 加载状态
    loading: false,
    
    // 详情弹窗
    showDetailModal: false,
    detailModalTitle: '',
    detailList: []
  },

  onLoad() {
    console.log('[AI Assistant] 页面加载');
    this.loadAIData();
  },

  onShow() {
    console.log('[AI Assistant] 页面显示');
    // 每次显示页面时刷新数据
    this.loadAIData();
  },

  // 加载AI分析数据
  async loadAIData() {
    console.log('[AI Assistant] 开始加载AI数据');
    this.setData({ loading: true });

    try {
      // 并行加载三个模块的数据
      await Promise.all([
        this.loadAlerts(),
        this.loadActiveRankings(),
        this.loadSuggestions()
      ]);
      
      console.log('[AI Assistant] AI数据加载完成');
    } catch (error) {
      console.error('[AI Assistant] AI数据加载失败:', error);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 加载异常警报（损耗率排行榜）
  async loadAlerts() {
    try {
      console.log('[AI Assistant] 加载损耗率排行榜');
      const dateRange = this.calculateDateRange();
      const params = {
        mode: this.data.lossRankingMode
      };
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      console.log('[AI Assistant] API参数:', params);
      const result = await api.getLossRanking(params);
      let alerts = [];
      let alertCount = 0;
      if (result && result.success && result.data) {
        alerts = result.data.map(item => ({
          id: item.id || `alert_${Math.random().toString(36).substr(2, 9)}`,
          title: `${item.productName || item.productNo || item.factoryName || '未知'} 损耗率 ${parseFloat(item.lossRate || 0).toFixed(2)}%`,
          description: item.description || '',
          time: item.lastActiveText || '未知时间',
          level: this.calculateLossLevel(item.lossRate),
          lossRate: parseFloat(item.lossRate || 0).toFixed(2),
          totalSendWeight: parseFloat(item.totalSendWeight || 0).toFixed(2),
          totalReceiveWeight: parseFloat(item.totalReceiveWeight || 0).toFixed(2),
          totalLossWeight: parseFloat(item.totalLossWeight || 0).toFixed(2),
          productNo: item.productNo || '',
          productName: item.productName || '',
          productImage: this.processImageUrl(item.productImage),
          factoryId: item.factoryId || '',
          factoryName: item.factoryName || '',
          process: item.process || item.processName || '',
          productCount: Math.max(0, parseInt(item.productCount) || 0),
          factoryCount: Math.max(0, parseInt(item.factoryCount) || 0),
          rank: item.rank || (alerts.length + 1)
        }));
        alertCount = alerts.length;
      }
      
      this.setData({
        alerts: alerts,
        alertCount: alertCount
      });
      console.log('[AI Assistant] 损耗率排行榜加载完成:', alertCount, '条记录');
    } catch (error) {
      console.error('[AI Assistant] 加载损耗率排行榜失败:', error);
      this.setData({
        alerts: [],
        alertCount: 0
      });
    }
  },

  // 加载活跃排行
  async loadActiveRankings() {
    try {
      console.log('[AI Assistant] 加载活跃排行');
      
      // 根据活跃排行时间筛选类型计算日期范围
      const dateRange = this.calculateActiveDateRange();
      
      // 构建API参数
      const params = {};
      
      // 添加时间筛选参数
      if (dateRange.startDate) {
        params.startDate = dateRange.startDate;
      }
      if (dateRange.endDate) {
        params.endDate = dateRange.endDate;
      }
      
      console.log('[AI Assistant] 活跃排行API参数:', params);
      
      // 调用活跃排行API
      const result = await api.getActiveRankings(params);

      if (result && result.success && result.data) {
        // 处理活跃货品数据 - 兼容新的科学算法
        const activeProducts = result.data.products ? result.data.products.map(item => ({
          ...item,
          id: item.product_no || `product_${Math.random().toString(36).substr(2, 9)}`,
          productName: item.productName || item.product_no || '未知货品',
          productNo: item.product_no || '',
          productImage: this.processImageUrl(item.productImage),
          recordCount: item.recordCount || item.totalTransactions || 0,
          totalWeight: parseFloat(item.totalWeight || 0).toFixed(2),
          factoryCount: item.factoryCount || item.sendFactoryCount || item.receiveFactoryCount || 0,
          lastActiveText: item.lastActiveText || '未知时间',
          activityScore: item.activityScore || 0,
          // 新增科学指标
          sendOrderCount: item.sendOrderCount || 0,
          receiveOrderCount: item.receiveOrderCount || 0,
          totalSendWeight: parseFloat(item.totalSendWeight || 0).toFixed(2),
          totalReceiveWeight: parseFloat(item.totalReceiveWeight || 0).toFixed(2),
          completionRate: item.completionRate || 0,
          weightCompletionRate: item.weightCompletionRate || 0
        })) : [];

        // 处理活跃工厂数据 - 兼容新的科学算法
        const activeFactories = result.data.factories ? result.data.factories.map(item => ({
          ...item,
          id: item.factory_id || `factory_${Math.random().toString(36).substr(2, 9)}`,
          factoryName: item.factoryName || '未知工厂',
          factory_id: item.factory_id || '',
          recordCount: item.recordCount || item.totalTransactions || 0,
          totalWeight: parseFloat(item.totalWeight || 0).toFixed(2),
          productCount: item.productCount || item.totalProductCount || item.sendProductCount || item.receiveProductCount || 0,
          lastActiveText: item.lastActiveText || '未知时间',
          activityScore: item.activityScore || 0,
          // 新增科学指标
          sendOrderCount: item.sendOrderCount || 0,
          receiveOrderCount: item.receiveOrderCount || 0,
          totalSendWeight: parseFloat(item.totalSendWeight || 0).toFixed(2),
          totalReceiveWeight: parseFloat(item.totalReceiveWeight || 0).toFixed(2),
          completionRate: item.completionRate || 0,
          weightCompletionRate: item.weightCompletionRate || 0
        })) : [];

        console.log('[AI Assistant] 活跃排行数据处理完成:', {
          products: activeProducts.length,
          factories: activeFactories.length,
          algorithm: (result.meta && result.meta.algorithm) || 'legacy'
        });

        this.setData({
          activeProducts,
          activeFactories,
          loading: false
        });

      } else {
        console.warn('[AI Assistant] 活跃排行数据格式异常:', result);
        this.setData({
          activeProducts: [],
          activeFactories: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('[AI Assistant] 加载活跃排行失败:', error);
      
      // 用户友好的错误提示
      if (error.statusCode === 401) {
        wx.showToast({
          title: '登录已过期，请重新登录',
          icon: 'none',
          duration: 2000
        });
      } else if (error.statusCode >= 500) {
        wx.showToast({
          title: '服务器繁忙，请稍后重试',
          icon: 'none',
          duration: 2000
        });
      } else {
        wx.showToast({
          title: '加载活跃排行失败',
          icon: 'none',
          duration: 2000
        });
      }
      
      this.setData({
        activeProducts: [],
        activeFactories: []
      });
    }
  },

  // 加载智能建议
  async loadSuggestions() {
    try {
      console.log('[AI Assistant] 加载智能建议');
      
      // 模拟智能建议数据
      const mockSuggestions = [
        {
          id: 1,
          title: '优化工序安排',
          description: '建议调整工厂A的工序顺序，可提升15%效率',
          priority: 'high'
        },
        {
          id: 2,
          title: '库存补充提醒',
          description: '建议及时补充货品B001库存，避免生产中断',
          priority: 'medium'
        },
        {
          id: 3,
          title: '质量控制建议',
          description: '建议加强工厂B的质量检查，降低损耗率',
          priority: 'low'
        }
      ];

      this.setData({ suggestions: mockSuggestions });
      console.log('[AI Assistant] 智能建议加载完成:', mockSuggestions.length, '条');
    } catch (error) {
      console.error('[AI Assistant] 加载智能建议失败:', error);
      this.setData({ suggestions: [] });
    }
  },

  // 处理图片URL
  processImageUrl(imagePath) {
    // 输入验证
    if (!imagePath || typeof imagePath !== 'string') {
      return '/images/default-product.png';
    }
    
    // 清理路径
    const cleanPath = imagePath.trim();
    if (!cleanPath) {
      return '/images/default-product.png';
    }
    
    // 已经是完整URL
    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      return cleanPath;
    }
    
    // 服务器相对路径
    if (cleanPath.startsWith('/uploads/')) {
      return `https://aiyunsf.com${cleanPath}`;
    }
    
    // 本地相对路径
    if (cleanPath.startsWith('/')) {
      return cleanPath;
    }
    
    // 其他情况，假设是文件名
    return `/images/${cleanPath}`;
  },

  // 计算损耗率等级
  calculateLossLevel(lossRate) {
    // 确保数据类型正确并处理边界情况
    const loss = parseFloat(lossRate);
    if (isNaN(loss)) return 'green'; // 无效数据默认为正常
    
    // 取绝对值处理负损耗率
    const absLoss = Math.abs(loss);
    
    // 损耗率等级分类（与后端保持一致）
    if (absLoss > 15) return 'red';      // 严重：>15%
    if (absLoss > 8) return 'orange';    // 警告：8-15%
    if (absLoss > 2) return 'yellow';    // 注意：2-8%
    return 'green';                      // 正常：≤2%
  },

  // 切换损耗率排行榜模式
  switchLossRankingMode() {
    const newMode = this.data.lossRankingMode === 'product' ? 'factory' : 'product';
    console.log('[AI Assistant] 切换损耗率排行榜模式:', this.data.lossRankingMode, '->', newMode);
    
    this.setData({ 
      lossRankingMode: newMode,
      alerts: [],
      alertCount: 0
    });
    
    // 重新加载数据
    wx.showLoading({ title: '切换中...', mask: true });
    this.loadAlerts().finally(() => {
      wx.hideLoading();
    });
  },

  // 刷新数据
  refreshData() {
    console.log('[AI Assistant] 手动刷新数据');
    wx.showLoading({ title: '刷新中...', mask: true });
    
    this.loadAIData().finally(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新完成',
        icon: 'success'
      });
    });
  },

  // 采纳建议
  applySuggestion(e) {
    const suggestionId = e.currentTarget.dataset.id;
    console.log('[AI Assistant] 采纳建议:', suggestionId);
    
    wx.showModal({
      title: '确认操作',
      content: '确定要采纳这条建议吗？',
      success: (res) => {
        if (res.confirm) {
          // 从建议列表中移除
          const suggestions = this.data.suggestions.filter(item => item.id !== suggestionId);
          this.setData({ suggestions });
          
          wx.showToast({
            title: '建议已采纳',
            icon: 'success'
          });
        }
      }
    });
  },

  // 忽略建议
  ignoreSuggestion(e) {
    const suggestionId = e.currentTarget.dataset.id;
    console.log('[AI Assistant] 忽略建议:', suggestionId);
    
    wx.showModal({
      title: '确认操作',
      content: '确定要忽略这条建议吗？',
      success: (res) => {
        if (res.confirm) {
          // 从建议列表中移除
          const suggestions = this.data.suggestions.filter(item => item.id !== suggestionId);
          this.setData({ suggestions });
          
          wx.showToast({
            title: '建议已忽略',
            icon: 'none'
          });
        }
      }
    });
  },

  // 图片加载失败处理
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    const defaultImage = '/images/default-product.png';
    
    // 更新指定索引的图片
    const key = `alerts[${index}].productImage`;
    this.setData({
      [key]: defaultImage
    });
    
    console.log('[AI Assistant] 图片加载失败，使用默认图片:', defaultImage);
  },

  // 显示工厂详情
  async showFactoryDetail(e) {
    const item = e.currentTarget.dataset.item;
    console.log('[AI Reports] 显示工厂详情:', item);
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      const dateRange = this.calculateDateRange();
      const result = await api.getLossRanking({
        mode: 'factory',
        productNo: item.productNo,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (result && result.success && result.data) {
        const factoryList = result.data
          .sort((a, b) => parseFloat(b.lossRate) - parseFloat(a.lossRate))
          .map(factory => ({
            id: factory.id || '',
            name: factory.factoryName || '',
            lossRate: parseFloat(factory.lossRate || 0).toFixed(2),
            level: factory.level || '',
            sendWeight: parseFloat(factory.totalSendWeight || 0).toFixed(2),
            receiveWeight: parseFloat(factory.totalReceiveWeight || 0).toFixed(2)
          }));
        this.setData({
          showDetailModal: true,
          detailModalTitle: `${item.productName || item.productNo || ''} - 涉及工厂`,
          detailList: factoryList
        });
      }
    } catch (error) {
      console.error('[AI Reports] 获取工厂详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 显示货品详情
  async showProductDetail(e) {
    const item = e.currentTarget.dataset.item;
    console.log('[AI Reports] 显示货品详情:', item);
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      const dateRange = this.calculateDateRange();
      const result = await api.getLossRanking({
        mode: 'product',
        factoryId: item.factoryId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      if (result && result.success && result.data) {
        const productList = result.data
          .sort((a, b) => parseFloat(b.lossRate) - parseFloat(a.lossRate))
          .map(product => ({
            id: product.id || '',
            name: `${product.productNo || ''} ${product.productName || ''}`.trim(),
            lossRate: parseFloat(product.lossRate || 0).toFixed(2),
            level: product.level || '',
            sendWeight: parseFloat(product.totalSendWeight || 0).toFixed(2),
            receiveWeight: parseFloat(product.totalReceiveWeight || 0).toFixed(2)
          }));
        // 修正主榜单对应项的 productCount
        const alerts = this.data.alerts.map(alert => {
          if (alert.factoryId === item.factoryId) {
            return { ...alert, productCount: productList.length };
          }
          return alert;
        });
        this.setData({
          showDetailModal: true,
          detailModalTitle: `${item.factoryName || ''} - 涉及货品`,
          detailList: productList,
          alerts // 更新主榜单显示
        });
      }
    } catch (error) {
      console.error('[AI Reports] 获取货品详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 隐藏详情弹窗
  hideDetailModal() {
    this.setData({
      showDetailModal: false,
      detailModalTitle: '',
      detailList: []
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 计算日期范围
  calculateDateRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (this.data.timeFilterType) {
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
          startDate: this.data.customStartDate,
          endDate: this.data.customEndDate
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

  // 选择时间筛选类型
  selectTimeFilter(e) {
    const type = e.currentTarget.dataset.type;
    console.log('[AI Assistant] 选择时间筛选:', type);
    
    this.setData({ timeFilterType: type });
    
    // 重新加载数据
    wx.showLoading({ title: '筛选中...', mask: true });
    this.loadAlerts().finally(() => {
      wx.hideLoading();
    });
  },

  // 显示自定义时间筛选弹窗
  showCustomTimeFilter() {
    console.log('[AI Assistant] 显示自定义时间筛选');
    this.setData({ showCustomTimeModal: true });
  },

  // 隐藏自定义时间筛选弹窗
  hideCustomTimeFilter() {
    this.setData({ showCustomTimeModal: false });
  },

  // 自定义开始日期改变
  onCustomStartDateChange(e) {
    this.setData({ customStartDate: e.detail.value });
  },

  // 自定义结束日期改变
  onCustomEndDateChange(e) {
    this.setData({ customEndDate: e.detail.value });
  },

  // 确认自定义时间筛选
  confirmCustomTimeFilter() {
    const { customStartDate, customEndDate } = this.data;
    
    if (!customStartDate || !customEndDate) {
      wx.showToast({
        title: '请选择完整的日期范围',
        icon: 'none'
      });
      return;
    }
    
    if (customStartDate > customEndDate) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      });
      return;
    }
    
    console.log('[AI Assistant] 确认自定义时间筛选:', customStartDate, '-', customEndDate);
    
    this.setData({ 
      timeFilterType: 'custom',
      showCustomTimeModal: false
    });
    
    // 重新加载数据
    wx.showLoading({ title: '筛选中...', mask: true });
    this.loadAlerts().finally(() => {
      wx.hideLoading();
    });
  },

  // 活跃排行时间筛选相关方法
  
  // 计算活跃排行日期范围
  calculateActiveDateRange() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (this.data.activeTimeFilterType) {
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
          startDate: this.data.activeCustomStartDate,
          endDate: this.data.activeCustomEndDate
        };
      
      default:
        return {
          startDate: null,
          endDate: null
        };
    }
  },

  // 选择活跃排行时间筛选类型
  selectActiveTimeFilter(e) {
    const type = e.currentTarget.dataset.type;
    console.log('[AI Assistant] 选择活跃排行时间筛选:', type);
    
    this.setData({ activeTimeFilterType: type });
    
    // 重新加载数据
    wx.showLoading({ title: '筛选中...', mask: true });
    this.loadActiveRankings().finally(() => {
      wx.hideLoading();
    });
  },

  // 显示活跃排行自定义时间筛选弹窗
  showActiveCustomTimeFilter() {
    console.log('[AI Assistant] 显示活跃排行自定义时间筛选');
    this.setData({ showActiveCustomTimeModal: true });
  },

  // 隐藏活跃排行自定义时间筛选弹窗
  hideActiveCustomTimeFilter() {
    this.setData({ showActiveCustomTimeModal: false });
  },

  // 活跃排行自定义开始日期改变
  onActiveCustomStartDateChange(e) {
    this.setData({ activeCustomStartDate: e.detail.value });
  },

  // 活跃排行自定义结束日期改变
  onActiveCustomEndDateChange(e) {
    this.setData({ activeCustomEndDate: e.detail.value });
  },

  // 确认活跃排行自定义时间筛选
  confirmActiveCustomTimeFilter() {
    const { activeCustomStartDate, activeCustomEndDate } = this.data;
    
    if (!activeCustomStartDate || !activeCustomEndDate) {
      wx.showToast({
        title: '请选择完整的日期范围',
        icon: 'none'
      });
      return;
    }
    
    if (activeCustomStartDate > activeCustomEndDate) {
      wx.showToast({
        title: '开始日期不能大于结束日期',
        icon: 'none'
      });
      return;
    }
    
    console.log('[AI Assistant] 确认活跃排行自定义时间筛选:', activeCustomStartDate, '-', activeCustomEndDate);
    
    this.setData({ 
      activeTimeFilterType: 'custom',
      showActiveCustomTimeModal: false
    });
    
    // 重新加载数据
    wx.showLoading({ title: '筛选中...', mask: true });
    this.loadActiveRankings().finally(() => {
      wx.hideLoading();
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('[AI Assistant] 下拉刷新');
    this.loadAIData().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '云助理 - 云收发',
      path: '/pages/ai-reports/ai-reports'
    };
  }
}); 