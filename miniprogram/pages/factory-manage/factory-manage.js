const app = getApp();
const api = require('../../utils/api');
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

// 使用本地函数或导入的函数
const toast = typeof showToast !== 'undefined' ? showToast : localShowToast;
const loading = typeof showLoading !== 'undefined' ? showLoading : localShowLoading;
const hideLoading = typeof hideLoading !== 'undefined' ? hideLoading : localHideLoading;
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
      status: 'active'
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
      { value: 'bank', label: '银行转账' },
      { value: 'wechat', label: '微信支付' },
      { value: 'alipay', label: '支付宝' }
    ],
    canSubmitPayment: false,
    preventTouchMove: function() {},
    // 存储从服务器获取的工序列表
    allProcesses: [],
    // 预设工序列表已移除，完全依赖服务器数据
    showProcessSelector: false,
    isLoadingProcesses: false
  },

  onLoad() {
    this.fetchFactories();
    this.fetchProcesses(); // 加载组织内的工序数据
  },

  onPullDownRefresh() {
    this.setData({
      factories: [],
      page: 1,
      hasMore: true
    }, () => {
      this.fetchFactories(() => {
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
    
    // 启用真实接口
    const orgId = wx.getStorageSync('orgId') || 'org1';
    
    // 添加随机参数避免缓存问题
    const timestamp = new Date().getTime();
    
    api.request('/factories', 'GET', { 
      orgId,
      page: this.data.page,
      pageSize: this.data.pageSize,
      keyword: this.data.keyword,
      _t: timestamp // 添加时间戳防止缓存
    })
      .then(res => {
        console.log('工厂接口原始数据:', JSON.stringify(res)); // 调试打印
        // 兼容不同的API返回格式
        let factoryItems = [];
        let total = 0;
        
        try {
          // 处理新格式 {success: true, data: [...]} 
          if (res && res.success === true && Array.isArray(res.data)) {
            factoryItems = res.data;
            total = res.totalCount || res.data.length;
            console.log('使用新格式数据', factoryItems.length, '项, 总计:', total);
          } 
          // 处理旧格式 {items: [...], totalCount: number}
          else if (res && Array.isArray(res.items)) {
            factoryItems = res.items;
            total = res.totalCount || factoryItems.length;
            console.log('使用旧格式数据', factoryItems.length, '项, 总计:', total);
          }
          // 处理直接返回数组的情况
          else if (Array.isArray(res)) {
            factoryItems = res;
            total = res.length;
            console.log('使用数组格式数据', factoryItems.length, '项');
          } else {
            console.warn('未知的返回数据格式', res);
            factoryItems = [];
            total = 0;
          }
        } catch (error) {
          console.error('处理返回数据时出错', error);
          factoryItems = [];
          total = 0;
        }
        
        // 确保数据是数组
        if (!Array.isArray(factoryItems)) {
          console.warn('工厂数据不是数组，已转换为空数组');
          factoryItems = [];
        }
        
        console.log('工厂原始数据检查:', JSON.stringify(factoryItems[0])); // 检查第一个工厂数据
        
        // 特别处理：确保每个工厂的processes是非空数组
        factoryItems = factoryItems.map(factory => {
          // 确保_id字段
          if (!factory._id && factory.id) {
            factory._id = factory.id;
          }
          
          // 处理processes字段
          let processes = factory.processes;
          if (!processes) {
            processes = []; // 为空时设为空数组
          } else if (Array.isArray(processes)) {
            // 如果已经是数组，不做处理
          } else if (typeof processes === 'string') {
            try {
              processes = JSON.parse(processes);
              if (!Array.isArray(processes)) {
                processes = [];
              }
            } catch (e) {
              // 解析失败时，尝试字符串分割
              processes = processes.replace(/[\[\]"]/g, '')
                .split(',')
                .map(p => p.trim())
                .filter(Boolean);
            }
          } else {
            processes = []; // 其他情况设为空数组
          }
          
          // 强制status为数字
          factory.status = Number(factory.status);
          
          // 返回处理后的工厂对象
          return { ...factory, processes };
        });
        
        console.log('处理后第一个工厂:', factoryItems[0]);  // 看看处理后的样子
        
        this.setData({ 
          factories: this.data.page === 1 ? factoryItems : [...this.data.factories, ...factoryItems],
          totalCount: total,
          hasMore: this.data.page * this.data.pageSize < total && factoryItems.length > 0,
          isLoading: false
        });
        
        console.log('前端处理后工厂数据:', factoryItems); // 调试打印
        
        hideLoading();
        
        if (callback) callback();
      })
      .catch(err => {
        console.error('获取工厂数据失败', err);
        toast('获取数据失败，请检查网络');
        
        this.setData({ 
          isLoading: false,
          hasMore: false,
          factories: this.data.page === 1 ? [] : this.data.factories
        });
        
        hideLoading();
        
        if (callback) callback();
      });
  },

  loadMoreFactories() {
    this.setData({
      page: this.data.page + 1
    }, () => {
      this.fetchFactories();
    });
  },

  searchFactories(e) {
    this.setData({
      keyword: e.detail.value,
      page: 1,
      factories: []
    }, () => {
      this.fetchFactories();
    });
  },

  clearSearch() {
    if (this.data.keyword) {
      this.setData({
        keyword: '',
        page: 1,
        factories: []
      }, () => {
        this.fetchFactories();
      });
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
        status: 'active'
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
    console.log('工序字段类型:', typeof factory.processes, '内容:', factory.processes);
    
    const hasTransaction = (factory.balance > 0 || factory.debt > 0);
    const processesArray = Array.isArray(factory.processes) ? [...factory.processes] : [];
    
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
        status: factory.status
      }
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
    
    // 准备需要提交的数据
    const factoryData = {
      name: editingFactory.name.trim(),
      phone: editingFactory.phone ? editingFactory.phone.trim() : '',
      address: editingFactory.address ? editingFactory.address.trim() : '',
      remark: editingFactory.remark ? editingFactory.remark.trim() : '',
      status: editingFactory.status === 'active' ? 1 : 0, // 数据库使用1/0
      orgId: wx.getStorageSync('orgId') || 'org1', // 数据库字段 orgId
      code: 'FC' + Date.now().toString().slice(-6),
      processes: editingFactory.processes || [] // 新增：提交工序
    };
    
    if (isAdding) {
      // 添加新工厂 - 使用API请求
      api.request('/factories', 'POST', factoryData)
        .then(res => {
          if (res.success) {
            // 后端返回的数据可能包含数据库生成的ID等信息
            const newFactory = {
              ...factoryData,
              _id: res.data.id, // 使用后端返回的ID
              id: res.data.id,
              debt: 0,
              balance: 0,
              createdAt: new Date().toISOString().split('T')[0]
            };
            
            this.setData({
              factories: [newFactory, ...this.data.factories],
              totalCount: this.data.totalCount + 1,
              showEditModal: false
            });
            
            toast('添加成功', 'success');
            
            // 刷新列表，确保显示最新数据
            setTimeout(() => {
              this.setData({ page: 1, factories: [] });
              this.fetchFactories();
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
          hideLoading();
        });
    } else {
      // 更新现有工厂 - 使用API请求
      api.request(`/factories/${editingFactory._id || editingFactory.id}`, 'PUT', factoryData)
        .then(res => {
          if (res.success) {
            toast('更新成功', 'success');
            // 强制刷新列表，确保数据与后端一致
            setTimeout(() => {
              this.setData({ page: 1, factories: [] });
              this.fetchFactories();
            }, 500);
            this.setData({ showEditModal: false });
          } else {
            toast(res.message || '更新失败');
          }
        })
        .catch(err => {
          console.error('更新工厂失败:', err);
          toast('更新失败，请稍后重试');
        })
        .finally(() => {
          hideLoading();
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
      
      // 调用API更新工厂状态
      const factoryId = factory._id || factory.id;
      api.request(`/factories/${factoryId}/status`, 'PUT', {
        status: newStatus,
        orgId: wx.getStorageSync('orgId') || 'org1'
      })
        .then(res => {
          if (res.success) {
            // 更新本地数据
            const updatedFactories = this.data.factories.map(item => {
              if (item._id === factoryId || item.id === factoryId) {
                return { ...item, status: newStatus };
              }
              return item;
            });
            
            this.setData({
              factories: updatedFactories
            });
            
            if (newStatus === 'inactive') {
              toast(`工厂已停用，可随时重新启用`, 'success');
            } else {
              toast(`工厂已启用`, 'success');
            }
          } else {
            toast(res.message || `${actionText}失败`);
          }
        })
        .catch(err => {
          console.error(`${actionText}工厂失败:`, err);
          toast(`${actionText}失败，请稍后重试`);
        })
        .finally(() => {
          hideLoading();
        });
    } catch (error) {
      console.error('操作失败', error);
      hideLoading();
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
      hideLoading();
      
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
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request(`/factories/${factoryId}/accounts`, 'GET', { orgId })
      .then(res => {
        let accountData = [];
        
        // 处理API返回的不同格式
        if (res && res.success && Array.isArray(res.data)) {
          accountData = res.data;
        } else if (Array.isArray(res)) {
          accountData = res;
        }
        
        if (accountData.length > 0) {
          let totalAmountDue = 0;
          let totalPaid = 0;
          let totalOwing = 0;
          
          accountData.forEach(record => {
            totalAmountDue += Number(record.amountDue) || 0;
            totalPaid += Number(record.paid) || 0;
          });
          
          totalOwing = totalAmountDue - totalPaid;
          
          this.setData({
            accountRecords: accountData,
            totalAmountDue: totalAmountDue.toFixed(2),
            totalPaid: totalPaid.toFixed(2),
            totalOwing: totalOwing.toFixed(2),
            isLoadingRecords: false
          });
        } else {
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
        console.error('获取账款记录失败', err);
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
        hideLoading();
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
      canSubmitPayment: false
    });
  },

  closePayDebtModal() {
    this.setData({
      showPayDebtModal: false,
      payingFactory: { _id: '', name: '', debt: 0 },
      payAmount: '',
      selectedPaymentMethod: 'cash',
      paymentRemark: '',
      canSubmitPayment: false
    });
  },

  inputPayAmount(e) {
    const amount = e.detail.value.trim();
    const amountNum = parseFloat(amount);
    
    // 验证金额是否有效
    const canSubmit = amount !== '' && !isNaN(amountNum) && amountNum > 0 && 
                     (this.data.selectedPaymentMethod !== 'bank' || this.data.paymentRemark.trim() !== '');
    
    this.setData({
      payAmount: amount,
      canSubmitPayment: canSubmit
    });
  },

  selectPaymentMethod(e) {
    const method = e.detail.value;
    
    // 验证是否可以提交
    const canSubmit = this.data.payAmount.trim() !== '' && 
                     (method !== 'bank' || this.data.paymentRemark.trim() !== '');
    
    this.setData({
      selectedPaymentMethod: method,
      canSubmitPayment: canSubmit
    });
  },

  inputPaymentRemark(e) {
    const info = e.detail.value;
    
    // 验证是否可以提交
    const canSubmit = this.data.payAmount.trim() !== '' && 
                     (this.data.selectedPaymentMethod !== 'bank' || info.trim() !== '');
    
    this.setData({
      paymentRemark: info,
      canSubmitPayment: canSubmit
    });
  },

  confirmPayDebt() {
    const { payingFactory, payAmount, selectedPaymentMethod, paymentRemark } = this.data;
    const amountNum = parseFloat(payAmount);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      toast('请输入有效的金额');
      return;
    }
    
    if (selectedPaymentMethod === 'bank' && paymentRemark.trim() === '') {
      toast('请输入银行转账信息');
      return;
    }
    
    // 显示加载提示
    loading('处理中');
    
    // 模拟API调用
    setTimeout(() => {
      // 更新工厂欠款
      const factories = this.data.factories.map(factory => {
        if (factory._id === payingFactory._id) {
          // 计算新的欠款金额和余额
          const newDebt = Math.max(0, factory.debt - amountNum);
          let newBalance = factory.balance || 0;
          
          // 如果支付金额大于欠款，将剩余部分计入余额
          if (amountNum > factory.debt) {
            newBalance += (amountNum - factory.debt);
          }
          
          // 更新或创建账户记录
          const date = new Date().toISOString().split('T')[0];
          const payMethodText = this.getPaymentMethodText(selectedPaymentMethod);
          
          // 确保factory有accountRecords属性
          if (!factory.accountRecords) {
            factory.accountRecords = [];
          }
          
          // 添加新的支付记录
          factory.accountRecords.push({
            id: Date.now(),
            date: date,
            orderNo: '付款记录',
            fee: 0, // 这不是工费记录，而是支付记录
            payAmount: amountNum,
            payMethod: payMethodText,
            balance: newBalance - newDebt, // 当前余额减去欠款就是实际结余
            remainBalance: newBalance > 0 ? newBalance : (newDebt > 0 ? -newDebt : 0), // 使用与工厂账户状态相同的逻辑
            isBalance: newBalance > 0 || newDebt === 0
          });
          
          return {
            ...factory,
            debt: newDebt,
            balance: newBalance
          };
        }
        return factory;
      });
      
      // 更新UI
      this.setData({
        factories: factories,
        showPayDebtModal: false
      });
      
      hideLoading();
      toast('支付成功', 'success');
    }, 800);
  },

  // 辅助方法：获取支付方式显示文本
  getPaymentMethodText(methodValue) {
    const method = this.data.paymentMethods.find(m => m.value === methodValue);
    return method ? method.label : '其他';
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
    const orgId = wx.getStorageSync('orgId') || 'org1';
    
    // 调用工序API
    api.request('/processes', 'GET', { orgId })
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
          api.request(`/factories/${factoryId}/status`, 'PUT', { status: 0 })
            .then(resp => {
              hideLoading();
              if (resp.success) {
                toast('已停用', 'success');
                that.setData({ showEditModal: false });
                setTimeout(() => {
                  that.setData({ page: 1, factories: [] });
                  that.fetchFactories();
                }, 500);
              } else {
                toast(resp.message || '停用失败', 'none');
              }
            })
            .catch(() => {
              hideLoading();
              toast('网络错误', 'none');
            });
        }
      }
    });
  }
});