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
    filteredColors: [], // 过滤后的颜色列表
    searchText: '', // 搜索文本
    isLoading: true, // 加载状态
    showModal: false, // 是否显示弹窗
    modalType: 'add', // 弹窗类型：add-添加, edit-编辑
    formData: { // 表单数据
      name: '',
      order: ''
    },
    currentEditId: '', // 当前编辑的颜色ID
    enabledCount: 0, // 启用数量
    disabledCount: 0 // 停用数量
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    console.log('颜色管理页面加载');
    this.fetchColorList();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function() {
    this.fetchColorList(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 获取颜色列表
   */
  fetchColorList: throttle(function(callback) {
    this.setData({ isLoading: true });
    wx.showNavigationBarLoading();
    const orgId = wx.getStorageSync('orgId');
    api.request('/colors', 'GET', { orgId })
      .then(res => {
        console.log('api.request返回的res', res); // 新增日志
        // 直接用res.data
        const colorData = Array.isArray(res.data) ? res.data : [];
        console.log('colorData', colorData); // 打印后端返回的原始数据
        // 字段映射
        const mappedColors = colorData.map(item => ({
          ...item,
          id: item._id,
          orderNum: item.orderNum
        }));
        console.log('mappedColors', mappedColors); // 打印映射后的数据
        // 排序
        const sortedColors = mappedColors.sort((a, b) => 
          ((a.orderNum !== undefined && a.orderNum !== null) ? a.orderNum : 999) - 
          ((b.orderNum !== undefined && b.orderNum !== null) ? b.orderNum : 999)
        );
        console.log('filteredColors', sortedColors); // 打印最终用于渲染的数据
        
        // 计算启用和停用数量
        const enabledCount = sortedColors.filter(item => item.status === 1).length;
        const disabledCount = sortedColors.filter(item => item.status === 0).length;
        
        this.setData({
          filteredColors: sortedColors,
          isLoading: false,
          enabledCount: enabledCount,
          disabledCount: disabledCount
        });
      })
      .catch(err => {
        console.error('获取颜色数据请求失败', err);
        this.setData({
          filteredColors: [],
          isLoading: false,
          enabledCount: 0,
          disabledCount: 0
        });
        toast('获取颜色数据失败');
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
   * 显示添加颜色弹窗
   */
  showAddModal: function() {
    // 计算新的排序值：获取现有颜色最大排序值 + 1
    const newOrder = this.data.filteredColors.length > 0 
      ? Math.max(...this.data.filteredColors.map(s => s.orderNum || 0)) + 1 
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
   * 显示编辑颜色弹窗
   */
  showEditModal: function(e) {
    const color = e.currentTarget.dataset.color;
    if (color) {
      this.setData({
        showModal: true,
        modalType: 'edit',
        currentEditId: color.id,
        formData: {
          name: color.name,
          order: color.orderNum
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
   * 处理颜色名称输入
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
   * 启用颜色
   */
  enableColor: function(e) {
    const id = e.currentTarget.dataset.id;
    
    modal('确认操作', '确定要启用此颜色吗？')
      .then(res => {
        if (res) {
          loading('启用中');
          
          // 使用真实API更新状态
          const orgId = wx.getStorageSync('orgId');
          api.request(`/colors/${id}/status`, 'PUT', {
            orgId,
            status: 1 // 1表示启用
          })
            .then(res => {
              this.fetchColorList();
              toast('启用成功', 'success');
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
      toast('请输入颜色名称');
      return;
    }
    
    // 排序值处理：如果为空或无效，使用默认值
    let finalOrder = order;
    if (!order || isNaN(Number(order)) || Number(order) < 0) {
      if (modalType === 'add') {
        // 新增时，如果没有填写排序，自动计算
        finalOrder = this.data.filteredColors.length > 0 
          ? Math.max(...this.data.filteredColors.map(c => c.orderNum || 0)) + 1 
          : 1;
        toast('显示顺序已自动设置为 ' + finalOrder);
      } else {
        // 编辑时，如果没有填写排序，保持原有排序
        const currentColor = this.data.filteredColors.find(c => c.id === currentEditId);
        finalOrder = currentColor ? currentColor.orderNum : 0;
      }
    }
    
    // 检查颜色名称是否已存在
    const nameExists = this.data.filteredColors.some(color => {
      if (modalType === 'edit' && color._id === currentEditId) {
        return false; // 排除当前编辑的颜色
      }
      return color.name.toLowerCase() === name.trim().toLowerCase();
    });
    
    if (nameExists) {
      toast('颜色名称已存在，请使用其他名称');
      return;
    }
    
    // 更新表单数据中的排序值
    this.setData({
      'formData.order': finalOrder
    });
    
    if (modalType === 'add') {
      this.addColor();
    } else {
      this.updateColor();
    }
  },

  /**
   * 添加颜色
   */
  addColor: function() {
    const { name, order } = this.data.formData;
    
    loading('添加中');
    
    // 使用真实API添加颜色
    const orgId = wx.getStorageSync('orgId');
    api.request('/colors', 'POST', {
      orgId,
      name: name.trim(),
      orderNum: Number(order),
      status: 1
    })
      .then(res => {
        this.fetchColorList();
        this.setData({ showModal: false });
        toast('添加成功', 'success');
      })
      .catch(err => {
        console.error('添加颜色失败', err);
        toast('添加失败，请检查网络');
      })
      .finally(() => {
        hideLoad();
      });
  },

  /**
   * 更新颜色
   */
  updateColor: function() {
    const { currentEditId, formData } = this.data;
    const { name, order } = formData;
    
    loading('更新中');
    
    // 使用真实API更新颜色
    const orgId = wx.getStorageSync('orgId');
    api.request(`/colors/${currentEditId}`, 'PUT', {
      orgId,
      name: name.trim(),
      orderNum: Number(order)
    })
      .then(res => {
        this.fetchColorList();
        this.setData({ showModal: false });
        toast('更新成功', 'success');
      })
      .catch(err => {
        console.error('更新颜色失败', err);
        toast('更新失败，请检查网络');
      })
      .finally(() => {
        hideLoad();
      });
  },

  /**
   * 切换颜色状态
   */
  toggleStatus: function(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const newStatus = status === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? '启用' : '禁用';
    
    modal('确认操作', `确定要${statusText}此颜色吗？`)
      .then(res => {
        if (res) {
          loading(`${statusText}中`);
          
          // 使用真实API更新状态
          const orgId = wx.getStorageSync('orgId');
          api.request(`/colors/${id}/status`, 'PUT', {
            orgId,
            status: newStatus
          })
            .then(res => {
              this.fetchColorList();
              toast(`${statusText}成功`, 'success');
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
    this.fetchColorList();
  }
});

// 节流提示
const originalFetchColorList = Page.prototype.fetchColorList;
Page.prototype.fetchColorList = function(...args) {
  if (this._lastFetchTime && Date.now() - this._lastFetchTime < 1000) {
    wx.showToast({ title: '操作频繁，福生无量，稍后再试', icon: 'none' });
    return;
  }
  this._lastFetchTime = Date.now();
  return originalFetchColorList.apply(this, args);
}; 