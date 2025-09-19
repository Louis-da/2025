// pages/size-manage/size-manage.js
const app = getApp();
const api = require('../../utils/api');
const { throttle } = require('../../utils/throttle');
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
const hideLoad = typeof hideLoading !== 'undefined' ? hideLoading : localHideLoading;
const modal = typeof showModal !== 'undefined' ? showModal : localShowModal;

Page({

  /**
   * 页面的初始数据
   */
  data: {
    filteredSizes: [], // 过滤后的尺码列表
    searchText: '', // 搜索文本
    isLoading: true, // 加载状态
    showModal: false, // 是否显示弹窗
    modalType: 'add', // 弹窗类型：add-添加, edit-编辑
    formData: { // 表单数据
      name: '',
      order: ''
    },
    currentEditId: '', // 当前编辑的尺码ID
    enabledCount: 0, // 启用数量
    disabledCount: 0 // 停用数量
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    console.log('尺码管理页面加载');
    this.fetchSizeList();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function() {
    this.fetchSizeList(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 获取尺码列表
   */
  fetchSizeList: throttle(function(callback) {
    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();
    const orgId = wx.getStorageSync('orgId');
    api.cloudFunctionRequest('/sizes', 'GET', { orgId })
      .then(res => {
        console.log('api.request返回的res', res);
        const sizeData = Array.isArray(res.data) ? res.data : [];
        console.log('sizeData', sizeData);
        
        // 字段映射并排序
        const mappedSizes = sizeData.map(item => ({
          ...item,
          id: item._id,
          orderNum: Number(item.orderNum) || 999 // 确保orderNum是数字类型
        })).sort((a, b) => a.orderNum - b.orderNum); // 按orderNum从小到大排序
        
        console.log('排序后的尺码列表:', mappedSizes);
        
        // 计算启用和停用数量
        const enabledCount = mappedSizes.filter(item => item.status === 1).length;
        const disabledCount = mappedSizes.filter(item => item.status === 0).length;
        
        this.setData({
          filteredSizes: mappedSizes,
          isLoading: false,
          enabledCount: enabledCount,
          disabledCount: disabledCount
        });
      })
      .catch(err => {
        console.error('获取尺码数据请求失败', err);
        this.setData({
          filteredSizes: [],
          isLoading: false,
          enabledCount: 0,
          disabledCount: 0
        });
        toast('获取尺码数据失败');
      })
      .finally(() => {
        wx.hideNavigationBarLoading();
        if (callback && typeof callback === 'function') {
          callback();
        }
      });
  }, 1000),

  /**
   * 防止滑动穿透
   */
  preventTouchMove: function() {
    return false;
  },

  /**
   * 显示添加尺码弹窗
   */
  showAddModal: function() {
    // 计算新的排序值：获取现有尺码最大排序值 + 1
    const newOrder = this.data.filteredSizes.length > 0 
      ? Math.max(...this.data.filteredSizes.map(s => s.orderNum || 0)) + 1 
      : 1;
      
    this.setData({
      showModal: true,
      modalType: 'add',
      formData: {
        name: '',
        order: newOrder
      }
    });
  },

  /**
   * 显示编辑尺码弹窗
   */
  showEditModal: function(e) {
    const size = e.currentTarget.dataset.size;
    if (size) {
      this.setData({
        showModal: true,
        modalType: 'edit',
        currentEditId: size.id,
        formData: {
          name: size.name,
          order: size.orderNum || 0
        }
      });
    }
  },

  /**
   * 关闭弹窗
   */
  hideModal: function() {
    this.setData({
      showModal: false
    });
  },

  /**
   * 处理尺码名称输入
   */
  onNameInput: function(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  /**
   * 处理显示顺序输入
   */
  onOrderInput: function(e) {
    this.setData({
      'formData.order': e.detail.value
    });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation: function(e) {
    // 阻止事件冒泡，避免触发父级的点击事件
    return false;
  },

  /**
   * 启用尺码 - 修复缺失的方法
   */
  enableSize: function(e) {
    const id = e.currentTarget.dataset.id;
    
    modal('确认操作', '确定要启用此尺码吗？')
      .then(res => {
        if (res) {
          loading('启用中');
          
          // 使用云函数更新状态
          const orgId = wx.getStorageSync('orgId');
          wx.cloud.callFunction({
            name: 'updateSizeStatus',
            data: {
              sizeId: id,
              orgId,
              status: 1 // 1表示启用
            }
          })
            .then(res => {
              if (res.result && res.result.success) {
                this.fetchSizeList();
                toast('启用成功', 'success');
              } else {
                throw new Error(res.result?.message || '启用失败');
              }
            })
            .catch(err => {
              console.error('启用失败', err);
              toast('启用失败，请检查网络');
            })
            .finally(() => {
              hideLoad();
            });
        }
      })
      .catch(err => {
        console.error('操作失败:', err);
        toast('操作失败，请重试');
      });
  },

  /**
   * 提交表单
   */
  submitForm: function() {
    const { modalType, formData, currentEditId } = this.data;
    const { name, order } = formData;
    
    if (!name.trim()) {
      toast('请输入尺码名称');
      return;
    }
    
    // 排序值处理：如果为空或无效，使用默认值
    let finalOrder = order;
    if (!order || isNaN(Number(order)) || Number(order) < 0) {
      if (modalType === 'add') {
        // 新增时，如果没有填写排序，自动计算
        finalOrder = this.data.filteredSizes.length > 0 
          ? Math.max(...this.data.filteredSizes.map(s => s.orderNum || 0)) + 1 
          : 1;
        toast('显示顺序已自动设置为 ' + finalOrder);
      } else {
        // 编辑时，如果没有填写排序，保持原有排序
        const currentSize = this.data.filteredSizes.find(s => s.id === currentEditId);
        finalOrder = currentSize ? currentSize.orderNum : 0;
      }
    }
    
    // 检查尺码名称是否已存在
    const nameExists = this.data.filteredSizes.some(size => {
      if (modalType === 'edit' && size._id === currentEditId) {
        return false; // 排除当前编辑的尺码
      }
      return size.name.toLowerCase() === name.trim().toLowerCase();
    });
    
    if (nameExists) {
      toast('尺码名称已存在，请使用其他名称');
      return;
    }
    
    // 更新表单数据中的排序值
    this.setData({
      'formData.order': finalOrder
    });
    
    if (modalType === 'add') {
      this.addSize();
    } else {
      this.updateSize();
    }
  },

  /**
   * 添加尺码
   */
  addSize: function() {
    const { name, order } = this.data.formData;
    
    loading('添加中');
    
    // 使用真实API添加尺码
    const orgId = wx.getStorageSync('orgId');
    api.cloudFunctionRequest('/sizes', 'POST', {
      orgId,
      name: name.trim(),
      orderNum: Number(order),
      status: 1
    })
      .then(res => {
        this.fetchSizeList();
        this.setData({ showModal: false });
        toast('添加成功', 'success');
      })
      .catch(err => {
        console.error('添加尺码失败', err);
        toast('添加失败，请检查网络');
      })
      .finally(() => {
        hideLoad();
      });
  },

  /**
   * 更新尺码
   */
  updateSize: function() {
    const { currentEditId, formData } = this.data;
    const { name, order } = formData;
    
    loading('更新中');
    
    // 使用云函数更新尺码
    const orgId = wx.getStorageSync('orgId');
    wx.cloud.callFunction({
      name: 'updateSize',
      data: {
        sizeId: currentEditId,
        orgId,
        name: name.trim(),
        orderNum: Number(order)
      }
    })
      .then(res => {
        if (res.result && res.result.success) {
          this.fetchSizeList();
          this.setData({ showModal: false });
          toast('更新成功', 'success');
        } else {
          throw new Error(res.result?.message || '更新失败');
        }
      })
      .catch(err => {
        console.error('更新尺码失败', err);
        toast('更新失败，请检查网络');
      })
      .finally(() => {
        hideLoad();
      });
  },

  /**
   * 切换尺码状态
   */
  toggleStatus: function(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const newStatus = status === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? '启用' : '禁用';
    
    modal('确认操作', `确定要${statusText}此尺码吗？`)
      .then(res => {
        if (res) {
          loading(`${statusText}中`);
          
          // 使用云函数更新状态
          const orgId = wx.getStorageSync('orgId');
          wx.cloud.callFunction({
            name: 'updateSizeStatus',
            data: {
              sizeId: id,
              orgId,
              status: newStatus
            }
          })
            .then(res => {
              if (res.result && res.result.success) {
                this.fetchSizeList();
                toast(`${statusText}成功`, 'success');
              } else {
                throw new Error(res.result?.message || '操作失败');
              }
            })
            .catch(err => {
              console.error('更新状态失败', err);
              toast('操作失败，请检查网络');
            })
            .finally(() => {
              hideLoad();
            });
        }
      })
      .catch(err => {
        console.error('操作失败:', err);
        toast('操作失败，请重试');
      });
  },

  /**
   * 复制文本到剪贴板
   */
  copyValue: function(e) {
    const value = e.currentTarget.dataset.value;
    wx.setClipboardData({
      data: value,
      success: function() {
        toast('复制成功', 'success');
      }
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 页面显示时刷新数据
    this.fetchSizeList();
  }
});

// 节流提示
const originalFetchSizeList = Page.prototype.fetchSizeList;
Page.prototype.fetchSizeList = function(...args) {
  if (this._lastFetchTime && Date.now() - this._lastFetchTime < 1000) {
    wx.showToast({ title: '操作频繁，福生无量，稍后再试', icon: 'none' });
    return;
  }
  this._lastFetchTime = Date.now();
  return originalFetchSizeList.apply(this, args);
};