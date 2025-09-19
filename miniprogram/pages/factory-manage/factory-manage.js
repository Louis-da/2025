const app = getApp();
const api = require('../../utils/api');
const { searchMatch } = require('../../utils/pinyin'); // 引入拼音搜索工具
try {
  // 尝试导入util模块，如果失败，使用内部定义的函数
  const { showToast, showLoading, hideLoading, showModal } = require('../../utils/util');
} catch (error) {
  console.error('无法加载util.js', error);
}

// 定义本地工具函数，以防utils/util.js无法加载
const localShowToast = (title, icon = 'none') => {
  wx.showToast({
    title: title,
    icon: icon
  });
};

const localShowLoading = (title = '加载中') => {
  wx.showLoading({
    title: title,
    mask: true
  });
};

const localHideLoading = () => {
  wx.hideLoading();
};

const localShowModal = (title, content, showCancel = true) => {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: title,
      content: content,
      showCancel: showCancel,
      success(res) {
        if (res.confirm) {
          resolve(true);
        } else if (res.cancel) {
          resolve(false);
        }
      },
      fail(err) {
        reject(err);
      }
    });
  });
};

// 更安全的工具函数初始化
let showToast = localShowToast;
let showLoading = localShowLoading;
let hideLoadingFn = localHideLoading;
let showModal = localShowModal;

try {
  const util = require('../../utils/util');
  showToast = util.showToast || showToast;
  showLoading = util.showLoading || showLoading;
  hideLoadingFn = util.hideLoading || hideLoadingFn;
  showModal = util.showModal || showModal;
} catch (error) {
  console.error('无法加载util.js', error);
}

// 使用本地函数或导入的函数
const toast = typeof showToast !== 'undefined' ? showToast : localShowToast;
const loading = typeof showLoading !== 'undefined' ? showLoading : localShowLoading;
const modal = typeof showModal !== 'undefined' ? showModal : localShowModal;

Page({
  data: {
    factories: [],
    showEdit: false,
    editFactory: { name: '', phone: '', processes: [], address: '', remark: '', status: 'active' },
    isLoading: false,
    keyword: '',
    hasMore: true,
    page: 1,
    pageSize: 10,
    totalCount: 0,
    showAccountDetail: false,
    currentFactoryId: '',
    accountRecords: [],
    factoryList: [],
    searchValue: '',
    noSearchResult: false,
    addModalVisible: false,
    editModalVisible: false,
    showEditModal: false,
    isAdding: false,
    editingFactory: {
      name: '', 
      phone: '', 
      processes: [], 
      address: '', 
      remark: '', 
      status: 'active',
      createTime: ''
    },
    accountDetailModalVisible: false,
    currentFactoryName: '',
    isLoadingRecords: false,
    nameReadOnly: false,
    phoneReadOnly: false,
    showPayDebtModal: false,
    payingFactory: {
      _id: '',
      name: '',
      debt: 0
    },
    payAmount: '',
    selectedPaymentMethod: 'cash',
    paymentRemark: '',
    paymentMethods: [
      { value: 'cash', label: '现金' },
      { value: 'bank', label: '银行' },
      { value: 'wechat', label: '微信' },
      { value: 'alipay', label: '支付宝' }
    ],
    canSubmitPayment: false,
    // 新增：付款历史相关数据
    showPaymentHistoryModal: false,
    paymentHistoryRecords: [],
    isLoadingHistory: false,
    currentHistoryPage: 1,
    historyPageSize: 20,
    hasMoreHistory: true,
    // 新增：拍照备注相关数据
    remarkImages: [], // 存储拍照的图片路径
    isUploadingImage: false, // 是否正在上传图片
    // 修复：添加图片预览相关数据
    showImagePreviewModal: false, // 是否显示图片预览弹窗
    previewImageUrls: [], // 预览的图片URL列表
    currentImageIndex: 0, // 当前预览的图片索引
    // 存储从服务器获取的工序列表
    allProcesses: [],
    // 预设工序列表已移除，完全依赖服务器数据
    showProcessSelector: false,
    isLoadingProcesses: false,
    lastCacheCheckTime: 0,
    // 新增工厂筛选搜索相关
    allFactories: [], // 存储所有工厂数据
    filteredFactories: [], // 过滤后的工厂数据
    searchKeyword: '', // 搜索关键词
    isSearchMode: false, // 是否处于搜索模式
    // 工厂统计信息
    factoryStats: {
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0
    },
    // 当前日期（北京时间）
    currentDate: '',
    // 新增：控制备注区域显示
    hasRemarksToShow: false,
  },

  onLoad() {
    this.setCurrentDate(); // 设置当前日期
    this.fetchFactories(); // 🎯 主要接口：获取工厂列表
    this.fetchProcesses(); // 加载组织内的工序数据
    
    // 🎯 优化：使用专用统计接口，参考货品管理的简洁做法
    this.fetchFactoryStats(); // 专用统计接口，独立于分页数据
  },

  onShow() {
    // 检查是否有新的工厂状态数据缓存
    const factoriesCache = wx.getStorageSync('factoriesCache') || {};
    const factoriesUpdateTime = wx.getStorageSync('factoriesUpdateTime') || 0;
    const lastCheckTime = this.data.lastCacheCheckTime || 0;
    
    // 如果缓存更新时间大于上次检查时间，应用缓存数据
    if (factoriesUpdateTime > lastCheckTime && Object.keys(factoriesCache).length > 0) {
      console.log('检测到工厂账户状态缓存已更新，应用最新数据');
      
      // 更新工厂列表中的账户状态数据
      const updatedFactories = this.data.factories.map(factory => {
        if (factoriesCache[factory.id] || factoriesCache[factory._id]) {
          const cachedFactory = factoriesCache[factory.id] || factoriesCache[factory._id];
          console.log(`更新工厂[${factory.name}]的账户状态`, cachedFactory);
          return {
            ...factory,
            balance: cachedFactory.balance,
            debt: cachedFactory.debt
          };
        }
        return factory;
      });
      
      this.setData({
        factories: updatedFactories,
        lastCacheCheckTime: new Date().getTime()
      });
    }
  },

  onPullDownRefresh() {
    this.setData({
      factories: [],
      page: 1,
      hasMore: true
    }, () => {
      // 🎯 优化：并行获取列表和统计数据，提高刷新效率
      Promise.all([
        new Promise(resolve => this.fetchFactories(resolve)),
        new Promise(resolve => {
          this.fetchFactoryStats();
          resolve();
        })
      ]).then(() => {
        wx.stopPullDownRefresh();
      }).catch(() => {
        wx.stopPullDownRefresh();
      });
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadMoreFactories();
    }
  },

  fetchFactories(callback) {
    if (this.data.isLoading) return;
    this.setData({ isLoading: true });
    loading('加载中');
    
    const orgId = wx.getStorageSync('orgId');
    const timestamp = new Date().getTime();
    
    api.cloudFunctionRequest('/factories', 'GET', { 
      page: this.data.page,
      pageSize: this.data.pageSize,
      keyword: this.data.keyword,
      _t: timestamp
    })
    .then(res => {
      console.log('后端返回工厂数据：', res);
      
      // 处理工厂数据
      const factoriesData = res.data || [];
      console.log('工厂数据处理前：', factoriesData.length, '条');
      
      // 终极健壮处理工序数据
      const processedFactories = factoriesData.map(factory => {
        let processes = [];
        if (Array.isArray(factory.processes)) {
          processes = factory.processes.map(p => String(p).trim()).filter(p => !!p);
        } else if (typeof factory.processes === 'string') {
          processes = factory.processes.split(/[,，、]/).map(p => p.trim()).filter(p => !!p);
        }
        if (!Array.isArray(processes)) {
          processes = [];
        }
        
        // 格式化创建时间为日期格式
        const formattedCreateTime = this.formatDateFromDateTime(factory.createTime);
        
        // 🔧 确保字段完整性和类型正确性
        return {
          ...factory,
          _id: factory.id || factory._id, // 确保有_id字段
          processes,
          createTime: formattedCreateTime, // 格式化后的创建时间
          status: factory.status, // 🔧 修复：后端已经转换为字符串格式，直接使用
          debt: parseFloat(factory.debt) || 0,      // 确保有debt字段
          balance: parseFloat(factory.balance) || 0 // 确保有balance字段
        };
      });

      // 打印最终的工厂数据
      console.log('最终处理的工厂数据:', processedFactories.map(f => ({
        name: f.name,
        processes: f.processes,
        processesLength: f.processes.length,
        status: f.status,
        debt: f.debt,
        balance: f.balance
      })));

      this.setData({
        factories: this.data.page === 1 ? processedFactories : [...this.data.factories, ...processedFactories],
        allFactories: this.data.page === 1 ? processedFactories : [...this.data.allFactories, ...processedFactories], // 保存所有工厂数据
        filteredFactories: this.data.page === 1 ? processedFactories : [...this.data.filteredFactories, ...processedFactories], // 初始化过滤后的数据
        totalCount: res.totalCount || processedFactories.length,
        hasMore: res.hasMore !== undefined ? res.hasMore : (processedFactories.length === this.data.pageSize),
        isLoading: false,
        noSearchResult: this.data.page === 1 && processedFactories.length === 0
      }, () => {
        // 如果当前处于搜索模式，应用搜索过滤
        if (this.data.isSearchMode && this.data.searchKeyword) {
          this.filterFactories(this.data.searchKeyword);
        }
      });
    })
    .catch(err => {
      console.error('获取工厂列表失败:', err);
      toast('获取工厂列表失败');
    })
    .finally(() => {
      hideLoadingFn();
      if (typeof callback === 'function') {
        callback();
      }
    });
  },

  loadMoreFactories() {
    this.setData({
      page: this.data.page + 1
    }, () => {
      this.fetchFactories();
    });
  },

  // 工厂搜索输入处理
  onFactorySearch(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword
    });
  },

  // 查询按钮点击处理
  onSearchButtonClick() {
    const keyword = this.data.searchKeyword;
    console.log('点击查询按钮，关键词:', keyword);
    
    if (!keyword || keyword.trim() === '') {
      // 如果没有关键词，显示所有工厂
      this.setData({
        factories: this.data.allFactories,
        filteredFactories: this.data.allFactories,
        isSearchMode: false
      });
      console.log('无关键词，显示所有工厂:', this.data.allFactories.length, '个');
      return;
    }

    // 执行搜索过滤
    this.filterFactories(keyword);
  },

  // 清除搜索
  clearFactorySearch() {
    this.setData({
      searchKeyword: '',
      isSearchMode: false,
      factories: this.data.allFactories,
      filteredFactories: this.data.allFactories
    });
    // 🎯 优化：统计信息不需要重新获取，因为使用专用接口，不受搜索影响
    console.log('清空工厂搜索，重置为显示所有工厂');
  },

  // 筛选工厂列表
  filterFactories(keyword) {
    console.log('开始过滤工厂列表，关键词:', keyword);
    console.log('当前工厂总数:', this.data.allFactories.length);
    
    if (!keyword || keyword.trim() === '') {
      // 如果没有关键词，显示所有工厂
      this.setData({
        factories: this.data.allFactories,
        filteredFactories: this.data.allFactories,
        isSearchMode: false
      });
      console.log('无关键词，显示所有工厂:', this.data.allFactories.length, '个');
      return;
    }

    const keywordLower = keyword.toLowerCase().trim();
    const filtered = this.data.allFactories.filter(factory => {
      // 简单字符串匹配：工厂名称、电话、地址
      const nameMatch = factory.name && factory.name.toLowerCase().includes(keywordLower);
      const phoneMatch = factory.phone && factory.phone.toLowerCase().includes(keywordLower);
      const addressMatch = factory.address && factory.address.toLowerCase().includes(keywordLower);
      // 搜索工序
      const processMatch = factory.processes && factory.processes.some && factory.processes.some(process => 
        process && process.toLowerCase().includes(keywordLower)
      );
      
      console.log(`检查工厂: ${factory.name} - 名称匹配:${nameMatch}, 电话匹配:${phoneMatch}, 地址匹配:${addressMatch}, 工序匹配:${processMatch}`);
      
      return nameMatch || phoneMatch || addressMatch || processMatch;
    });

    this.setData({
      factories: filtered,
      filteredFactories: filtered,
      isSearchMode: true
    });

    console.log(`工厂搜索: "${keyword}" -> ${filtered.length}个结果`);
    if (filtered.length > 0) {
      console.log('匹配的工厂:', filtered.map(f => f.name));
    }
  },

  navigateToEdit() {
    this.setData({
      showEditModal: true,
      isAdding: true,
      nameReadOnly: false,
      phoneReadOnly: false,
      editingFactory: {
        name: '',
        phone: '',
        processes: [],
        address: '',
        remark: '',
        status: 'active',
        createTime: this.data.currentDate // 设置当前日期
      }
    });
  },

  editFactory(e) {
    const id = e.currentTarget.dataset.id;
    const factory = this.data.factories.find(f => f._id === id);
    
    if (!factory) {
      toast('未找到工厂信息');
      return;
    }
    
    console.log('编辑工厂原始数据:', factory);
    console.log('工厂状态值:', factory.status, '类型:', typeof factory.status);
    console.log('工序字段类型:', typeof factory.processes, '内容:', factory.processes);
    
    const hasTransaction = (factory.balance > 0 || factory.debt > 0);
    const processesArray = Array.isArray(factory.processes) ? [...factory.processes] : [];
    
    // 确保status是字符串类型
    const status = typeof factory.status === 'string' ? factory.status : (factory.status === 0 ? 'inactive' : 'active');
    
    console.log('处理后的工序数组:', processesArray);
    
    this.setData({
      showEditModal: true,
      isAdding: false,
      nameReadOnly: hasTransaction,
      phoneReadOnly: hasTransaction,
      editingFactory: {
        _id: factory._id,
        name: factory.name,
        phone: factory.phone,
        processes: processesArray,
        address: factory.address || '',
        remark: factory.remark || '',
        status: status, // 使用数字类型的status
        createTime: factory.createTime || ''
      }
    }, () => {
      console.log('设置editingFactory后的状态:', this.data.editingFactory.status);
    });
  },

  closeEditModal() {
    this.setData({ 
      showEditModal: false 
    });
  },

  inputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`editingFactory.${field}`]: value
    });
  },

  submitFactory() {
    const { editingFactory, isAdding } = this.data;
    
    // 表单验证
    if (!editingFactory.name) {
      toast('请输入工厂名称');
      return;
    }
    
    // 🔧 新增验证：工序信息为必填
    if (!editingFactory.processes || !Array.isArray(editingFactory.processes) || editingFactory.processes.length === 0) {
      toast('请选择至少一个工序');
      return;
    }
    
    // 检查名称和电话是否重复
    const factories = this.data.factories;
    const existingFactories = isAdding 
      ? factories 
      : factories.filter(f => f._id !== editingFactory._id);
    
    // 检查名称是否重复
    const nameExists = existingFactories.some(f => f.name === editingFactory.name.trim());
    if (nameExists) {
      toast('工厂名称已存在，请使用其他名称');
      return;
    }
    
    // 检查电话是否重复（仅当填写了电话时）
    if (editingFactory.phone && editingFactory.phone.trim()) {
      const phoneExists = existingFactories.some(f => f.phone === editingFactory.phone.trim());
      if (phoneExists) {
        toast('联系电话已存在，请确认后重新输入');
        return;
      }
    }
    
    loading('保存中');
    
    // 🔒 安全准备：只提交业务数据，不包含任何组织ID字段
    // 组织ID将由后端从认证用户信息中自动获取
    const factoryData = {
      name: editingFactory.name.trim(),
      phone: editingFactory.phone ? editingFactory.phone.trim() : '',
      address: editingFactory.address ? editingFactory.address.trim() : '',
      remark: editingFactory.remark ? editingFactory.remark.trim() : '',
      status: editingFactory.status, // 🔧 修复：直接使用状态值，后端会处理转换
      code: 'FC' + Date.now().toString().slice(-6),
      processes: editingFactory.processes || [] // 新增：提交工序
      // 🔒 安全注意：不再手动添加orgId，完全依赖后端认证系统
      // createTime字段由数据库自动生成，无需提交
    };
    
    if (isAdding) {
      // 添加新工厂 - 使用API请求
      api.cloudFunctionRequest('/factories', 'POST', factoryData)
        .then(res => {
          if (res.success) {
            // 后端返回的数据可能包含数据库生成的ID等信息
            const newFactory = {
              ...factoryData,
              _id: res.data.id, // 使用后端返回的ID
              id: res.data.id,
              debt: 0,
              balance: 0,
              createTime: this.formatDateFromDateTime(res.data.createTime) || this.data.currentDate // 使用后端返回的创建时间
            };
            
            this.setData({
              factories: [newFactory, ...this.data.factories],
              totalCount: this.data.totalCount + 1,
              showEditModal: false
            });
            
            toast('添加成功', 'success');
            
            // 🎯 优化：并行刷新列表和统计数据
            setTimeout(() => {
              this.setData({ page: 1, factories: [] });
              Promise.all([
                new Promise(resolve => this.fetchFactories(resolve)),
                new Promise(resolve => {
                  this.fetchFactoryStats();
                  resolve();
                })
              ]);
            }, 500);
          } else {
            toast(res.message || '添加失败');
          }
        })
        .catch(err => {
          console.error('添加工厂失败:', err);
          toast('添加失败，请稍后重试');
        })
        .finally(() => {
          hideLoadingFn();
        });
    } else {
      // 更新现有工厂 - 使用云函数请求
      wx.cloud.callFunction({
        name: 'api',
        data: {
          action: 'updateFactory',
          factoryId: editingFactory._id || editingFactory.id,
          factoryData: factoryData
        }
      })
        .then(result => {
          if (result.result && result.result.success) {
            toast('更新成功', 'success');
            // 🎯 优化：并行刷新列表和统计数据
            setTimeout(() => {
              this.setData({ page: 1, factories: [] });
              Promise.all([
                new Promise(resolve => this.fetchFactories(resolve)),
                new Promise(resolve => {
                  this.fetchFactoryStats();
                  resolve();
                })
              ]);
            }, 500);
            this.setData({ showEditModal: false });
          } else {
            toast(result.result?.message || '更新失败');
          }
        })
        .catch(err => {
          console.error('更新工厂失败:', err);
          toast('更新失败，请稍后重试');
        })
        .finally(() => {
          hideLoadingFn();
        });
    }
  },

  async toggleStatus(e) {
    try {
      const id = e.currentTarget.dataset.id;
      const factory = this.data.factories.find(item => item._id === id || item.id === id);
      if (!factory) {
        toast('未找到工厂信息');
        return;
      }
      
      const newStatus = factory.status === 'active' ? 'inactive' : 'active';
      const actionText = newStatus === 'active' ? '启用' : '停用';
      
      let confirmMessage = `确定要${actionText}工厂"${factory.name}"吗？`;
      
      // 添加提示信息，让用户知道停用而非删除是业务规则
      if (newStatus === 'inactive') {
        confirmMessage += "\n\n注意：根据业务规则，工厂只能停用不能删除。";
      }
      
      const confirmed = await modal('确认操作', confirmMessage);
      if (!confirmed) return;
      
      loading(`${actionText}中...`);
      
      // 调用云函数更新工厂状态
      const factoryId = factory._id || factory.id;
      wx.cloud.callFunction({
        name: 'api',
        data: {
          action: 'updateFactoryStatus',
          factoryId: factoryId,
          status: newStatus
        }
      })
        .then(result => {
          if (result.result && result.result.success) {
            // 更新本地数据
            const updatedFactories = this.data.factories.map(item => {
              if (item._id === factoryId || item.id === factoryId) {
                return { ...item, status: newStatus };
              }
              return item;
            });
            
            // 同时更新allFactories数据
            const updatedAllFactories = this.data.allFactories.map(item => {
              if (item._id === factoryId || item.id === factoryId) {
                return { ...item, status: newStatus };
              }
              return item;
            });
            
            this.setData({
              factories: updatedFactories,
              allFactories: updatedAllFactories
            });
            
            // 重新计算统计信息
            this.fetchFactoryStats();
            
            if (newStatus === 'inactive') {
              toast(`工厂已停用，可随时重新启用`, 'success');
            } else {
              toast(`工厂已启用`, 'success');
            }
          } else {
            toast(result.result?.message || `${actionText}失败`);
          }
        })
        .catch(err => {
          console.error(`${actionText}工厂失败:`, err);
          toast(`${actionText}失败，请稍后重试`);
        })
        .finally(() => {
          hideLoadingFn();
        });
    } catch (error) {
      console.error('操作失败', error);
      hideLoadingFn();
      toast('操作失败，请稍后重试');
    }
  },

  // 删除工厂 - 此功能已被移除，工厂只允许停用不允许删除
  async deleteFactory(e) {
    // 由于业务规则变更，工厂只允许停用不允许删除
    toast('根据业务规则，工厂只能停用不能删除');
    return;
    
    // 以下代码保留但不再执行
    const id = e.currentTarget.dataset.id;
    const factory = this.data.factories.find(f => f._id === id);
    
    if (!factory) {
      toast('未找到工厂信息');
      return;
    }
    
    const confirmed = await modal('确认删除', `确定要删除工厂"${factory.name}"吗？此操作不可恢复！`);
    if (!confirmed) return;
    
    loading('删除中');
    
    // 模拟删除
    setTimeout(() => {
      hideLoadingFn();
      
      // 从本地数据中移除
      const factories = this.data.factories.filter(f => f._id !== id);
      this.setData({ 
        factories,
        totalCount: factories.length
      });
      
      toast('删除成功', 'success');
    }, 500);
  },

  viewAccountDetail(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    
    this.setData({
      showAccountDetail: true,
      currentFactoryId: id,
      currentFactoryName: name,
      isLoadingRecords: true,
      accountRecords: []
    });
    
    this.fetchAccountRecords(id);
  },

  closeAccountDetail() {
    this.setData({
      showAccountDetail: false,
      accountRecords: []
    });
  },

  /**
   * 获取工厂账款记录
   */
  fetchAccountRecords: function(factoryId) {
    loading('获取账款记录');
    this.setData({ isLoadingRecords: true });
    
    // 使用真实API获取工厂账款记录
    api.request(`/factories/${factoryId}/accounts`, 'GET')
      .then(res => {
        let accountData = [];
        
        // 处理API返回的不同格式
        if (res && res.success && Array.isArray(res.data)) {
          accountData = res.data;
        } else if (Array.isArray(res)) {
          accountData = res;
        }
        
        console.log('[fetchAccountRecords] 原始账款数据:', accountData);
        
        if (accountData.length > 0) {
          // 按日期降序排序，最近的日期在最上面
          accountData.sort((a, b) => {
            const dateA = new Date(a.date || a.createTime || 0);
            const dateB = new Date(b.date || b.createTime || 0);
            return dateB - dateA; // 降序排序
          });
          
          // 修复：正确计算总欠款，使用后端返回的实际字段
          let totalAmountDue = 0;  // 总应付金额
          let totalPaid = 0;       // 总已付金额
          let finalBalance = 0;    // 最终结余（从最后一条记录获取）
          
          accountData.forEach((record, index) => {
            // 使用后端实际返回的字段名
            const fee = parseFloat(record.fee || 0);           // 应付金额
            const payAmount = parseFloat(record.payAmount || 0); // 已付金额
            
            totalAmountDue += fee;
            totalPaid += payAmount;
            
            // 最后一条记录的累计结余就是当前总结余
            if (index === 0) { // 因为已经按日期降序排序，第一条就是最新的
              finalBalance = parseFloat(record.remainBalance || 0);
            }
            
            console.log(`[fetchAccountRecords] 记录${index + 1}:`, {
              date: record.date,
              orderNo: record.orderNo,
              fee: fee,
              payAmount: payAmount,
              remainBalance: record.remainBalance,
              payMethod: record.payMethod
            });
          });
          
          // 计算总欠款：正数表示欠款，负数表示余款
          const totalOwing = finalBalance;
          
          console.log('[fetchAccountRecords] 财务汇总:', {
            totalAmountDue: totalAmountDue.toFixed(2),
            totalPaid: totalPaid.toFixed(2),
            finalBalance: finalBalance.toFixed(2),
            totalOwing: totalOwing.toFixed(2)
          });
          
          this.setData({
            accountRecords: accountData,
            totalAmountDue: totalAmountDue.toFixed(2),
            totalPaid: totalPaid.toFixed(2),
            totalOwing: Math.abs(totalOwing).toFixed(2), // 显示绝对值
            isLoadingRecords: false
          });
        } else {
          console.log('[fetchAccountRecords] 没有账款记录');
          this.setData({
            accountRecords: [],
            totalAmountDue: '0.00',
            totalPaid: '0.00',
            totalOwing: '0.00',
            isLoadingRecords: false
          });
        }
      })
      .catch(err => {
        console.error('[fetchAccountRecords] 获取账款记录失败:', err);
        this.setData({
          accountRecords: [],
          totalAmountDue: '0.00',
          totalPaid: '0.00',
          totalOwing: '0.00',
          isLoadingRecords: false
        });
        toast('获取账款记录失败');
      })
      .finally(() => {
        hideLoadingFn();
      });
  },

  payDebt(event) {
    // 兼容旧方法，调用新的打开支付弹窗方法
    this.openPayDebtModal(event);
  },

  openPayDebtModal(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const debt = e.currentTarget.dataset.debt;
    
    this.setData({
      showPayDebtModal: true,
      payingFactory: {
        _id: id,
        name: name,
        debt: debt
      },
      payAmount: '',
      selectedPaymentMethod: 'cash',
      paymentRemark: '',
      canSubmitPayment: false,
      remarkImages: [], // 重置拍照图片
      isUploadingImage: false
    });
  },

  closePayDebtModal() {
    this.setData({
      showPayDebtModal: false,
      payingFactory: { _id: '', name: '', debt: 0 },
      payAmount: '',
      selectedPaymentMethod: 'cash',
      paymentRemark: '',
      canSubmitPayment: false,
      remarkImages: [], // 重置拍照图片
      isUploadingImage: false // 重置上传状态
    });
  },

  inputPayAmount(e) {
    const amount = e.detail.value.trim();
    const amountNum = parseFloat(amount);
    
    // 验证金额是否有效，备注可以是文字或图片
    const canSubmit = amount !== '' && !isNaN(amountNum) && amountNum > 0 && 
                     (this.data.paymentRemark.trim() !== '' || this.data.remarkImages.length > 0);
    
    this.setData({
      payAmount: amount,
      canSubmitPayment: canSubmit
    });
  },

  selectPaymentMethod(e) {
    const method = e.detail.value;
    
    // 验证是否可以提交，备注可以是文字或图片
    const canSubmit = this.data.payAmount.trim() !== '' && 
                     (this.data.paymentRemark.trim() !== '' || this.data.remarkImages.length > 0);
    
    this.setData({
      selectedPaymentMethod: method,
      canSubmitPayment: canSubmit
    });
  },

  inputPaymentRemark(e) {
    const remark = e.detail.value;
    
    // 验证是否可以提交：有文字备注或有图片备注，且金额有效
    const canSubmit = this.data.payAmount.trim() !== '' && 
                     (remark.trim() !== '' || this.data.remarkImages.length > 0);
    
    this.setData({
      paymentRemark: remark,
      canSubmitPayment: canSubmit
    });
  },

  confirmPayDebt() {
    const { payingFactory, payAmount, selectedPaymentMethod, paymentRemark, remarkImages } = this.data;
    const amountNum = parseFloat(payAmount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      toast('请输入有效的金额');
      return;
    }
    
    // 所有支付方式都必须填写备注
    if (paymentRemark.trim() === '' && remarkImages.length === 0) {
      toast('请输入付款备注信息或添加图片');
      return;
    }
    
    // 显示加载提示
    loading('处理中');
    
    // 修复：分别提交文字备注和图片URLs
    const paymentData = {
      amount: amountNum,
      paymentMethod: selectedPaymentMethod,
      remark: paymentRemark.trim(),
      imageUrls: remarkImages.map(img => img.url).filter(url => url) // 提取图片URLs
    };
    
    api.request(`/factories/${payingFactory._id}/payments`, 'POST', paymentData)
      .then(res => {
        if (res && res.success) {
          // 更新工厂列表中的余额和欠款
          const factories = this.data.factories.map(factory => {
            if (factory._id === payingFactory._id) {
              return {
                ...factory,
                debt: res.data.newDebt || 0,
                balance: res.data.newBalance || 0
              };
            }
            return factory;
          });
          
          // 更新UI
          this.setData({
            factories: factories,
            showPayDebtModal: false
          });
          
          // 更新工厂账户状态缓存，以便对账单同步
          const factoriesCache = wx.getStorageSync('factoriesCache') || {};
          factoriesCache[payingFactory._id] = {
            balance: res.data.newBalance || 0,
            debt: res.data.newDebt || 0,
            lastPaymentTime: new Date().getTime()
          };
          wx.setStorageSync('factoriesCache', factoriesCache);
          wx.setStorageSync('factoriesUpdateTime', new Date().getTime());
          
          console.log('[confirmPayDebt] 工厂账户状态缓存已更新:', {
            factoryId: payingFactory._id,
            factoryName: payingFactory.name,
            newBalance: res.data.newBalance,
            newDebt: res.data.newDebt,
            paymentOrderNo: res.data.paymentNo,
            hasImages: remarkImages.length > 0
          });
          
          toast(`支付成功，单号：${res.data.paymentNo}`, 'success');
        } else {
          toast(res.message || '支付失败');
        }
      })
      .catch(err => {
        console.error('支付失败:', err);
        toast('支付失败，请重试');
      })
      .finally(() => {
        hideLoadingFn();
      });
  },

  // 🔧 修复：辅助方法：获取支付方式显示文本，增强容错性
  getPaymentMethodText(methodValue) {
    console.log('[getPaymentMethodText] 输入的支付方式值:', methodValue, '类型:', typeof methodValue);
    
    // 🛠️ 增强容错：处理空值、undefined、null等情况
    if (!methodValue || methodValue === '' || methodValue === 'null' || methodValue === 'undefined') {
      console.log('[getPaymentMethodText] 支付方式值为空，返回"未知"');
      return '未知';
    }
    
    // 🔍 确保值为字符串类型进行比较
    const normalizedValue = String(methodValue).toLowerCase().trim();
    
    const method = this.data.paymentMethods.find(m => m.value === normalizedValue);
    const result = method ? method.label : '其他';
    
    console.log('[getPaymentMethodText] 支付方式映射结果:', {
      原始值: methodValue,
      标准化值: normalizedValue,
      映射结果: result,
      可用方式: this.data.paymentMethods.map(m => m.value)
    });
    
    return result;
  },

  addReceipt(factoryId, orderNo, amount, isPaid = true) {
    const factoryIndex = this.data.factories.findIndex(f => f._id === factoryId);
    if (factoryIndex === -1) return false;
    
    const factory = this.data.factories[factoryIndex];
    const factories = [...this.data.factories];
    const date = new Date().toISOString().split('T')[0];
    
    if (isPaid) {
      if (amount > 0) {
        if (factory.debt > 0) {
          if (amount >= factory.debt) {
            const remainingAmount = amount - factory.debt;
            factory.balance += remainingAmount;
            factory.debt = 0;
            
            factory.accountRecords = factory.accountRecords || [];
            factory.accountRecords.push({
              date,
              type: 'payment',
              amount,
              orderNo,
              desc: `支付工费并抵消欠款${factory.debt}，余额增加${remainingAmount}`
            });
          } else {
            factory.debt -= amount;
            
            factory.accountRecords = factory.accountRecords || [];
            factory.accountRecords.push({
              date,
              type: 'payment',
              amount,
              orderNo,
              desc: `支付工费，欠款减少${amount}`
            });
          }
        } else {
          factory.balance += amount;
          
          factory.accountRecords = factory.accountRecords || [];
          factory.accountRecords.push({
            date,
            type: 'payment',
            amount,
            orderNo,
            desc: `支付工费，余额增加${amount}`
          });
        }
      }
    } else {
      if (factory.balance > 0) {
        if (factory.balance >= amount) {
          factory.balance -= amount;
          
          factory.accountRecords = factory.accountRecords || [];
          factory.accountRecords.push({
            date,
            type: 'expense',
            amount,
            orderNo,
            desc: `工费${amount}已从余额中扣除`
          });
        } else {
          const remainingAmount = amount - factory.balance;
          factory.debt += remainingAmount;
          
          factory.accountRecords = factory.accountRecords || [];
          factory.accountRecords.push({
            date,
            type: 'expense',
            amount,
            orderNo,
            desc: `工费${amount}，从余额扣除${factory.balance}，新增欠款${remainingAmount}`
          });
          
          factory.balance = 0;
        }
      } else {
        factory.debt += amount;
        
        factory.accountRecords = factory.accountRecords || [];
        factory.accountRecords.push({
          date,
          type: 'expense',
          amount,
          orderNo,
          desc: `工费${amount}(未付)，新增欠款${amount}`
        });
      }
    }
    
    factories[factoryIndex] = factory;
    this.setData({ factories });
    return true;
  },

  preventTouchMove() {
    // 防止背景滚动
    return false;
  },

  // 阻止事件冒泡
  stopPropagation() {
    return false;
  },

  // 显示工序选择器前，确保已获取最新的工序数据
  showProcessSelector: function() {
    const selectedProcesses = this.data.editingFactory.processes || [];
    
    // 如果还没有获取到工序数据，先获取
    if (this.data.allProcesses.length === 0 && !this.data.isLoadingProcesses) {
      this.fetchProcesses(() => {
        this.showProcessSelectorUI(selectedProcesses);
      });
    } else {
      this.showProcessSelectorUI(selectedProcesses);
    }
  },
  
  // 获取工序列表数据
  fetchProcesses: function(callback) {
    this.setData({ isLoadingProcesses: true });
    
    // 获取当前组织ID
    const orgId = wx.getStorageSync('orgId');
    
    // 调用工序API
    api.cloudFunctionRequest('/processes', 'GET', { orgId })
      .then(res => {
        console.log('获取工序数据成功:', res);
        
        let processNames = [];
        
        // 处理API返回的不同数据格式
        if (res.success && Array.isArray(res.data)) {
          // 格式: {success: true, data: [...]}
          processNames = res.data.map(p => p.name || p.processName || '').filter(name => name);
        } else if (Array.isArray(res)) {
          // 格式: 直接返回数组
          processNames = res.map(p => p.name || p.processName || '').filter(name => name);
        }
        
        // 设置工序数据
        this.setData({ 
          allProcesses: processNames,
          isLoadingProcesses: false 
        });
        
        if (callback && typeof callback === 'function') {
          callback();
        }
      })
      .catch(err => {
        console.error('获取工序数据失败:', err);
        
        // 显示错误提示
        toast('获取工序数据失败，请稍后重试');
        
        this.setData({ 
          isLoadingProcesses: false 
        });
        
        if (callback && typeof callback === 'function') {
          callback();
        }
      });
  },
  
  // 显示工序选择器UI
  showProcessSelectorUI: function(selectedProcesses) {
    const availableProcesses = this.data.allProcesses.filter(
      process => !selectedProcesses.includes(process)
    );
    
    if (availableProcesses.length === 0) {
      if (this.data.allProcesses.length === 0) {
        toast('未能获取到工序数据，请稍后重试');
        this.fetchProcesses(); // 尝试重新获取工序数据
        return;
      }
      toast('没有更多可选工序');
      return;
    }

    // 如果可选工序超过6个，需要分批显示
    if (availableProcesses.length <= 6) {
      wx.showActionSheet({
        itemList: availableProcesses,
        success: (res) => {
          if (!res.cancel) {
            const selectedProcess = availableProcesses[res.tapIndex];
            const newProcesses = [...selectedProcesses, selectedProcess];
            
            this.setData({
              'editingFactory.processes': newProcesses
            });
          }
        }
      });
    } else {
      // 当选项超过6个时，显示前6个，并添加一个"更多"选项
      this.showProcessesBatch(availableProcesses, selectedProcesses, 0);
    }
  },
  
  // 分批显示工序选项
  showProcessesBatch: function(availableProcesses, selectedProcesses, startIndex) {
    const batchSize = 5; // 每批显示5个选项，第6个位置留给"更多"
    const endIndex = Math.min(startIndex + batchSize, availableProcesses.length);
    const batch = availableProcesses.slice(startIndex, endIndex);
    
    // 添加"更多"选项，如果还有更多可选项
    const itemList = [...batch];
    if (endIndex < availableProcesses.length) {
      itemList.push('更多...');
    }
    
    wx.showActionSheet({
      itemList: itemList,
      success: (res) => {
        if (!res.cancel) {
          // 如果用户选择了"更多"
          if (res.tapIndex === batchSize && endIndex < availableProcesses.length) {
            this.showProcessesBatch(availableProcesses, selectedProcesses, endIndex);
          } else if (res.tapIndex < batch.length) {
            // 用户选择了具体的工序
            const selectedProcess = batch[res.tapIndex];
            const newProcesses = [...selectedProcesses, selectedProcess];
            
            this.setData({
              'editingFactory.processes': newProcesses
            });
          }
        }
      }
    });
  },
  
  // 移除选择的工序
  removeProcess: function(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) {
      console.error('移除工序失败：未找到索引');
      return;
    }
    
    try {
      const processes = [...this.data.editingFactory.processes];
      processes.splice(index, 1);
      
      this.setData({
        'editingFactory.processes': processes
      });
    } catch (error) {
      console.error('移除工序失败：', error);
      toast('移除工序失败');
    }
  },

  /**
   * 停用工厂
   */
  disableFactory() {
    const that = this;
    const { editingFactory } = this.data;
    if (!editingFactory || (!editingFactory._id && !editingFactory.id)) {
      toast('未找到工厂信息');
      return;
    }
    // 更健壮的判断：只要为0、'0'、0.00、'0.00'、undefined、null、''都视为0
    function isZero(val) {
      return val === undefined || val === null || val === '' || Number(val) === 0;
    }
    if (!isZero(editingFactory.balance) || !isZero(editingFactory.debt)) {
      toast('该工厂有余额或欠款，不能停用');
      return;
    }
    wx.showModal({
      title: '确认停用',
      content: '确定要停用该工厂吗？',
      confirmColor: '#f56c6c',
      success(res) {
        if (res.confirm) {
          loading('正在停用...');
          const factoryId = editingFactory._id || editingFactory.id;
          // 发送字符串类型的状态值
          api.request(`/factories/${factoryId}/status`, 'PUT', { 
            status: 'inactive'
          })
            .then(resp => {
              hideLoadingFn();
              if (resp.success) {
                toast('已停用', 'success');
                that.setData({ showEditModal: false });
                setTimeout(() => {
                  that.setData({ page: 1, factories: [] });
                  // 🎯 优化：并行刷新列表和统计数据
                  Promise.all([
                    new Promise(resolve => that.fetchFactories(resolve)),
                    new Promise(resolve => {
                      that.fetchFactoryStats();
                      resolve();
                    })
                  ]);
                }, 500);
              } else {
                toast(resp.message || '停用失败', 'none');
              }
            })
            .catch(() => {
              hideLoadingFn();
              toast('网络错误', 'none');
            });
        }
      }
    });
  },

  /**
   * 启用工厂
   */
  enableFactory() {
    const that = this;
    const { editingFactory } = this.data;
    if (!editingFactory || (!editingFactory._id && !editingFactory.id)) {
      toast('未找到工厂信息');
      return;
    }
    
    wx.showModal({
      title: '确认启用',
      content: '确定要启用该工厂吗？',
      confirmColor: '#34c759',
      success(res) {
        if (res.confirm) {
          loading('正在启用...');
          const factoryId = editingFactory._id || editingFactory.id;
          // 发送字符串类型的状态值
          api.request(`/factories/${factoryId}/status`, 'PUT', { 
            status: 'active'
          })
            .then(resp => {
              hideLoadingFn();
              if (resp.success) {
                toast('已启用', 'success');
                that.setData({ showEditModal: false });
                setTimeout(() => {
                  that.setData({ page: 1, factories: [] });
                  // 🎯 优化：并行刷新列表和统计数据
                  Promise.all([
                    new Promise(resolve => that.fetchFactories(resolve)),
                    new Promise(resolve => {
                      that.fetchFactoryStats();
                      resolve();
                    })
                  ]);
                }, 500);
              } else {
                toast(resp.message || '启用失败', 'none');
              }
            })
            .catch(() => {
              hideLoadingFn();
              toast('网络错误', 'none');
            });
        }
      }
    });
  },

  // 获取工厂统计信息
  fetchFactoryStats() {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchFactoryStats] 组织ID缺失');
      this.setData({ 
        factoryStats: { 
          totalCount: 0, 
          activeCount: 0, 
          inactiveCount: 0 
        } 
      });
      return;
    }
    
    console.log('[fetchFactoryStats] 🎯 开始请求专用统计接口');
    
    // 🎯 优化：参考货品管理，使用专用统计接口，不依赖分页数据
    api.cloudFunctionRequest('/factories/stats', 'GET')
      .then(res => {
        console.log('[fetchFactoryStats] 专用统计API响应:', res);
        if (res && res.success && res.data) {
          const stats = {
            totalCount: parseInt(res.data.totalCount) || 0,
            activeCount: parseInt(res.data.activeCount) || 0,
            inactiveCount: parseInt(res.data.inactiveCount) || 0,
          };
          this.setData({
            factoryStats: stats
          });
          console.log('[fetchFactoryStats] ✅ 专用统计接口更新成功:', stats);
        } else {
          console.error('[fetchFactoryStats] 获取工厂统计失败或数据格式无效:', res);
          this.setData({ 
            factoryStats: { 
              totalCount: 0, 
              activeCount: 0, 
              inactiveCount: 0 
            } 
          });
        }
      })
      .catch(err => {
        console.error('[fetchFactoryStats] 请求工厂统计接口异常:', err);
        this.setData({ 
          factoryStats: { 
            totalCount: 0, 
            activeCount: 0, 
            inactiveCount: 0 
          } 
        });
      });
  },

  // 🎯 移除复杂的本地统计逻辑，统一使用专用统计接口
  // 参考货品管理的简洁做法，统计数据独立于分页数据

  loadMoreFactories() {
    this.setData({
      page: this.data.page + 1
    }, () => {
      this.fetchFactories();
    });
  },

  // 设置当前北京时间日期
  setCurrentDate() {
    const now = new Date();
    // 转换为北京时间（UTC+8）
    const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    const currentDate = `${year}-${month}-${day}`;
    
    this.setData({
      currentDate: currentDate
    });
    
    console.log('当前北京时间日期:', currentDate);
  },

  // 格式化日期时间为日期格式
  formatDateFromDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    
    try {
      // 处理数据库返回的datetime格式 (如: 2025-05-31 14:30:25)
      // 修复iOS兼容性问题：将空格替换为T，或者手动解析
      let formattedDateString = dateTimeString;
      
      // 如果是 "YYYY-MM-DD HH:mm:ss" 格式，转换为iOS兼容的格式
      if (formattedDateString.includes(' ') && formattedDateString.length === 19) {
        formattedDateString = formattedDateString.replace(' ', 'T');
      }
      
      const date = new Date(formattedDateString);
      
      // 如果转换失败，尝试手动解析
      if (isNaN(date.getTime())) {
        console.warn('日期格式解析失败，尝试手动解析:', dateTimeString);
        
        // 手动解析 "YYYY-MM-DD HH:mm:ss" 格式
        const match = dateTimeString.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (match) {
          const [, year, month, day] = match;
          return `${year}-${month}-${day}`;
        }
        
        // 如果无法解析，返回原字符串
        return dateTimeString;
      }
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('日期格式化失败:', error, '原始字符串:', dateTimeString);
      
      // 最后的备选方案：正则提取日期部分
      try {
        const match = dateTimeString.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) {
          return match[1];
        }
      } catch (regexError) {
        console.error('正则提取日期失败:', regexError);
      }
      
      return dateTimeString;
    }
  },

  // 新增：打开付款历史弹窗
  openPaymentHistory() {
    this.setData({
      showPaymentHistoryModal: true,
      paymentHistoryRecords: [],
      currentHistoryPage: 1,
      hasMoreHistory: true
    });
    this.loadPaymentHistory();
  },

  // 新增：关闭付款历史弹窗
  closePaymentHistory() {
    this.setData({
      showPaymentHistoryModal: false,
      paymentHistoryRecords: [],
      isLoadingHistory: false
    });
  },

  // 新增：加载付款历史记录
  loadPaymentHistory(loadMore = false, forceRefresh = false) {
    if (this.data.isLoadingHistory && !forceRefresh) return;
    
    const { payingFactory, currentHistoryPage, historyPageSize } = this.data;
    
    this.setData({ isLoadingHistory: true });
    
    const page = loadMore ? currentHistoryPage + 1 : currentHistoryPage;
    
    // 添加时间戳防止缓存
    const timestamp = forceRefresh ? `&_t=${Date.now()}` : '';
    const url = `/factories/${payingFactory._id}/payment-history?page=${page}&limit=${historyPageSize}${timestamp}`;
    
    console.log('[loadPaymentHistory] 请求URL:', url, { loadMore, forceRefresh });
    
    api.request(url, 'GET')
      .then(res => {
        console.log('[loadPaymentHistory] API响应:', res);
        
        if (res && res.success && res.data) {
          const newRecords = res.data.records || [];
          const existingRecords = loadMore ? this.data.paymentHistoryRecords : [];
          
          console.log('[loadPaymentHistory] 原始记录数据:', newRecords.map(r => ({
            id: r.id,
            payment_no: r.payment_no,
            status: r.status,
            amount: r.amount
          })));
          
          // 修复：处理支付方式显示文本和图片数据
          const processedRecords = newRecords.map(record => ({
            ...record,
            paymentMethodText: this.getPaymentMethodText(record.payment_method),
            statusText: record.status === 1 ? '有效' : '已作废',
            canVoid: record.status === 1, // 只有有效记录才能作废
            // 修复：处理图片数据
            imageUrls: Array.isArray(record.image_urls) ? record.image_urls : 
                      (record.image_urls ? [record.image_urls] : []),
            hasImages: Array.isArray(record.image_urls) ? record.image_urls.length > 0 : 
                      !!record.image_urls
          }));
          
          console.log('[loadPaymentHistory] 处理后记录数据:', processedRecords.map(r => ({
            id: r.id,
            payment_no: r.payment_no,
            status: r.status,
            statusText: r.statusText,
            canVoid: r.canVoid
          })));
          
          const allRecords = [...existingRecords, ...processedRecords];
          
          // 计算是否有备注信息需要显示
          const hasRemarksToShow = allRecords.some(item => item.remark && item.remark.trim() !== '');
          
          this.setData({
            paymentHistoryRecords: allRecords,
            currentHistoryPage: page,
            hasMoreHistory: newRecords.length === historyPageSize,
            isLoadingHistory: false,
            hasRemarksToShow: hasRemarksToShow
          });
          
          console.log('[loadPaymentHistory] 加载成功:', {
            page,
            count: newRecords.length,
            total: this.data.paymentHistoryRecords.length,
            hasRemarksToShow
          });
        } else {
          this.setData({ isLoadingHistory: false });
          if (!loadMore) {
            console.log('[loadPaymentHistory] 无付款历史记录');
            toast('暂无付款历史记录');
          }
        }
      })
      .catch(err => {
        console.error('[loadPaymentHistory] 加载失败:', err);
        this.setData({ isLoadingHistory: false });
        toast('获取付款历史失败');
      });
  },

  // 新增：加载更多历史记录
  loadMorePaymentHistory() {
    if (this.data.hasMoreHistory && !this.data.isLoadingHistory) {
      this.loadPaymentHistory(true);
    }
  },

  // 新增：作废付款记录
  voidPaymentRecord(e) {
    const dataset = e.currentTarget.dataset;
    console.log('[voidPaymentRecord] 完整dataset内容:', dataset);
    console.log('[voidPaymentRecord] dataset所有属性:', Object.keys(dataset));
    
    // 尝试多种属性名
    const id = dataset.id;
    const paymentNo = dataset.paymentNo || dataset['payment-no'] || dataset.paymentno;
    
    console.log('[voidPaymentRecord] 获取参数:', {
      id: id,
      paymentNo: paymentNo,
      idType: typeof id,
      paymentNoType: typeof paymentNo,
      originalDataset: dataset
    });
    
    if (!id || !paymentNo) {
      console.error('[voidPaymentRecord] 缺少必要参数:', { 
        id, 
        paymentNo,
        allDataset: dataset 
      });
      toast('参数错误，请重试');
      return;
    }
    
    console.log('[voidPaymentRecord] 准备显示确认对话框');
    modal(
      '确认作废',
      `确定要作废付款记录 ${paymentNo} 吗？作废后不可恢复，但仍可查看。`
    ).then((confirmed) => {
      console.log('[voidPaymentRecord] Modal结果:', confirmed);
      if (confirmed) {
        console.log('[voidPaymentRecord] 用户点击了确认按钮，开始执行作废操作');
        this.performVoidPayment(id, paymentNo);
      } else {
        console.log('[voidPaymentRecord] 用户取消了作废操作');
      }
    }).catch((err) => {
      console.error('[voidPaymentRecord] Modal错误:', err);
    });
  },

  // 新增：执行作废操作
  performVoidPayment(paymentId, paymentNo) {
    console.log('[performVoidPayment] 🚀 开始执行作废操作');
    loading('作废中');
    
    const { payingFactory } = this.data;
    
    console.log('[performVoidPayment] 开始作废:', {
      factoryId: payingFactory._id,
      paymentId: paymentId,
      paymentNo: paymentNo,
      factoryName: payingFactory.name
    });
    
    const apiUrl = `/factories/${payingFactory._id}/payments/${paymentId}/void`;
    console.log('[performVoidPayment] 📡 准备调用API:', apiUrl);
    
    api.request(apiUrl, 'PUT')
      .then(res => {
        console.log('[performVoidPayment] 📥 API响应完整数据:', JSON.stringify(res, null, 2));
        
        if (res && res.success) {
          console.log('[performVoidPayment] ✅ 作废成功，开始更新界面状态');
          
          // 更新工厂列表中的余额和欠款
          const factories = this.data.factories.map(factory => {
            if (factory._id === payingFactory._id) {
              console.log('[performVoidPayment] 🔄 更新工厂账户状态:', {
                factoryName: factory.name,
                oldDebt: factory.debt,
                newDebt: res.data.newDebt,
                oldBalance: factory.balance,
                newBalance: res.data.newBalance
              });
              return {
                ...factory,
                debt: res.data.newDebt || 0,
                balance: res.data.newBalance || 0
              };
            }
            return factory;
          });
          
          this.setData({
            factories: factories,
            payingFactory: {
              ...payingFactory,
              debt: res.data.newDebt || 0,
              balance: res.data.newBalance || 0
            }
          });
          
          console.log('[performVoidPayment] 💾 工厂账户状态已更新');
          
          // 🔄 修复：同步刷新账户明细数据，确保作废记录不再显示
          if (this.data.showAccountDetail && this.data.currentFactoryId === payingFactory._id) {
            console.log('[performVoidPayment] 🔄 检测到账户明细页面打开，同步刷新明细数据');
            this.fetchAccountRecords(payingFactory._id);
          }
          
          // 强制重新加载付款历史数据确保状态同步
          console.log('[performVoidPayment] 🔄 开始重新加载付款历史');
          this.setData({
            paymentHistoryRecords: [],
            currentHistoryPage: 1,
            hasMoreHistory: true,
            isLoadingHistory: false
          });
          
          // 延迟一点时间再加载，确保后端数据已更新
          console.log('[performVoidPayment] ⏰ 延迟300ms后刷新历史记录');
          setTimeout(() => {
            console.log('[performVoidPayment] 🔄 执行强制刷新付款历史');
            this.loadPaymentHistory(false, true); // 使用强制刷新
          }, 300);
          
          toast(`付款记录 ${paymentNo} 已作废`, 'success');
          
          console.log('[performVoidPayment] 🎉 作废成功完成:', {
            paymentNo,
            newBalance: res.data.newBalance,
            newDebt: res.data.newDebt
          });
        } else {
          console.error('[performVoidPayment] ❌ API返回失败:', res);
          const errorMsg = (res && res.message) || (res && res.error) || '作废失败';
          toast(errorMsg);
        }
      })
      .catch(err => {
        console.error('[performVoidPayment] 💥 API调用异常:', err);
        console.error('[performVoidPayment] 错误详情:', {
          message: err.message,
          stack: err.stack,
          url: apiUrl
        });
        if (err.message) {
          toast(`作废失败: ${err.message}`);
        } else {
          toast('作废失败，请检查网络连接');
        }
      })
      .finally(() => {
        console.log('[performVoidPayment] 🏁 作废操作结束，隐藏加载中');
        hideLoadingFn();
      });
  },

  // 新增：拍照备注
  takePhoto() {
    if (this.data.isUploadingImage) {
      toast('正在处理图片，请稍候');
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'], // 只允许拍照，不允许从相册选择
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadRemarkImage(tempFilePath);
      },
      fail: (err) => {
        console.error('拍照失败:', err);
        if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
          toast('拍照失败，请重试');
        }
      }
    });
  },

  // 修复：上传拍照图片到服务器
  uploadRemarkImage(tempFilePath) {
    this.setData({ isUploadingImage: true });
    loading('上传图片中');

    // 压缩图片
    wx.compressImage({
      src: tempFilePath,
      quality: 70,
      success: (compressRes) => {
        const currentImages = this.data.remarkImages;
        
        // 限制最多3张图片
        if (currentImages.length >= 3) {
          this.setData({ isUploadingImage: false });
          hideLoadingFn();
          toast('最多只能添加3张图片');
          return;
        }

        // 上传图片到服务器
        console.log('[uploadRemarkImage] 开始上传图片:', {
          url: api.getBaseUrl() + '/upload/remark-image',
          filePath: compressRes.tempFilePath,
          token: wx.getStorageSync('token') ? '有token' : '无token'
        });
        
        wx.uploadFile({
          url: api.getBaseUrl() + '/upload/remark-image',
          filePath: compressRes.tempFilePath,
          name: 'file',
          header: {
            'X-App-Authorization': 'Bearer ' + (wx.getStorageSync('token') || '') // 使用自定义头避免被 CloudBase 网关拦截
          },
          formData: {
            type: 'payment_remark'
          },
          success: (uploadRes) => {
            console.log('[uploadRemarkImage] 上传响应状态码:', uploadRes.statusCode);
            console.log('[uploadRemarkImage] 上传响应数据:', uploadRes.data);
            
            try {
              const result = JSON.parse(uploadRes.data);
              console.log('[uploadRemarkImage] 解析后的结果:', result);
              
              if (result.success && result.data && result.data.url) {
                // 添加到图片列表，保存服务器返回的URL
                const newImages = [...currentImages, {
                  id: Date.now(),
                  path: compressRes.tempFilePath, // 本地路径用于预览
                  url: result.data.url, // 服务器URL用于保存
                  isLocal: false
                }];

                // 重新验证是否可以提交
                const canSubmit = this.data.payAmount.trim() !== '' && 
                                 (this.data.paymentRemark.trim() !== '' || newImages.length > 0);

                this.setData({
                  remarkImages: newImages,
                  isUploadingImage: false,
                  canSubmitPayment: canSubmit
                });

                hideLoadingFn();
                toast('图片上传成功', 'success');
              } else {
                throw new Error(result.message || '上传失败');
              }
            } catch (error) {
              console.error('解析上传结果失败:', error);
              this.setData({ isUploadingImage: false });
              hideLoadingFn();
              toast('图片上传失败，请重试');
            }
          },
          fail: (err) => {
            console.error('图片上传失败:', err);
            this.setData({ isUploadingImage: false });
            hideLoadingFn();
            toast('图片上传失败，请检查网络');
          }
        });
      },
      fail: (err) => {
        console.error('图片压缩失败:', err);
        this.setData({ isUploadingImage: false });
        hideLoadingFn();
        toast('图片处理失败，请重试');
      }
    });
  },

  // 新增：预览图片
  previewRemarkImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.remarkImages;
    
    if (index >= 0 && index < images.length) {
      const currentUrl = images[index].path;
      const urls = images.map(img => img.path);
      
      wx.previewImage({
        current: currentUrl,
        urls: urls
      });
    }
  },

  // 新增：删除备注图片
  deleteRemarkImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.remarkImages];
    
    if (index >= 0 && index < images.length) {
      images.splice(index, 1);
      
      // 重新验证是否可以提交
      const canSubmit = this.data.payAmount.trim() !== '' && 
                       (this.data.paymentRemark.trim() !== '' || images.length > 0);
      
      this.setData({
        remarkImages: images,
        canSubmitPayment: canSubmit
      });
      toast('图片已删除', 'success');
    }
  },

  // 修复：查看付款历史备注图片
  viewPaymentImages(e) {
    const dataset = e.currentTarget.dataset;
    const paymentId = dataset.paymentId;
    const images = dataset.images;
    
    console.log('[viewPaymentImages] 查看付款备注图片:', { paymentId, images });
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      toast('该记录没有备注图片');
      return;
    }
    
    // 处理图片URL，确保是完整的URL
    const imageUrls = images.map(url => {
      if (url.startsWith('http')) {
        return url;
      } else {
        return api.getBaseUrl() + url; // 补全相对路径
      }
    });
    
    this.setData({
      showImagePreviewModal: true,
      previewImageUrls: imageUrls,
      currentImageIndex: 0
    });
  },
  
  // 修复：关闭图片预览弹窗
  closeImagePreview() {
    this.setData({
      showImagePreviewModal: false,
      previewImageUrls: [],
      currentImageIndex: 0
    });
  },
  
  // 修复：预览图片（微信原生预览）
  previewImages() {
    if (this.data.previewImageUrls.length === 0) return;
    
    wx.previewImage({
      current: this.data.previewImageUrls[this.data.currentImageIndex],
      urls: this.data.previewImageUrls,
      fail: (err) => {
        console.error('预览图片失败:', err);
        toast('预览图片失败');
      }
    });
  },

  // 🔧 新增：主动获取所有工厂数据，确保统计准确性
  ensureAllFactoriesLoaded() {
    console.log('[ensureAllFactoriesLoaded] 开始获取所有工厂数据用于统计');
    this.fetchAllFactoriesForStats();
  },
});