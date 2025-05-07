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
const hideLoad = typeof hideLoading !== 'undefined' ? hideLoading : localHideLoading;
const modal = typeof showModal !== 'undefined' ? showModal : localShowModal;

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isLoading: true,
    colorList: null, // 修改为null以便区分初始加载和空结果
    showAddColorModal: false,
    showEditColorModal: false,
    newColor: {
      name: ''
    },
    editingColor: {
      id: '',
      name: ''
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('颜色管理页面加载');
    this.fetchColors();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    this.fetchColors(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 获取颜色列表
   */
  fetchColors: function (callback) {
    this.setData({ isLoading: true });
    
    wx.showNavigationBarLoading();
    
    // 使用真实API获取颜色数据
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/colors', 'GET', { orgId })
      .then(res => {
        // 处理返回数据，适配不同的返回格式
        let colorData = [];
        
        if (Array.isArray(res)) {
          // 直接返回的数组格式
          colorData = res;
        } else if (res && res.data && Array.isArray(res.data)) {
          // 包装在data字段中的数组格式
          colorData = res.data;
        } else if (res && res.success && Array.isArray(res.data)) {
          // 另一种包装格式
          colorData = res.data;
        }
        
        // 排序
        colorData = colorData.sort((a, b) => {
          const orderA = a.order !== undefined ? a.order : 999;
          const orderB = b.order !== undefined ? b.order : 999;
          return orderA - orderB;
        });
        // 强制status为数字
        colorData = colorData.map(color => ({
          ...color,
          status: Number(color.status)
        }));
        
        // 更新状态
        this.setData({
          colorList: colorData,
          isLoading: false
        });
      })
      .catch(err => {
        console.error('获取颜色数据请求失败', err);
        const defaultColors = [];
        this.setData({
          colorList: defaultColors,
          isLoading: false
        });
      })
      .finally(() => {
        wx.hideNavigationBarLoading();
        if (callback && typeof callback === 'function') {
          callback();
        }
      });
  },

  /**
   * 显示添加颜色弹窗
   */
  showAddModal: function () {
    this.setData({
      showAddColorModal: true,
      newColor: {
        name: ''
      }
    });
  },

  /**
   * 关闭弹窗
   */
  hideModal: function () {
    this.setData({
      showAddColorModal: false,
      showEditColorModal: false
    });
  },

  /**
   * 显示编辑颜色弹窗
   */
  showEditModal: function (e) {
    const color = e.currentTarget.dataset.color;
    
    if (color) {
      console.log('编辑颜色:', color); // 添加日志查看color对象结构
      this.setData({
        editingColor: {
          id: color._id || color.id, // 兼容_id和id两种格式
          name: color.name
        },
        showEditColorModal: true
      });
    }
  },

  /**
   * 处理输入变化
   */
  handleInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const newColor = {...this.data.newColor};
    
    newColor[field] = value;
    
    this.setData({ newColor });
  },

  /**
   * 处理编辑输入变化
   */
  handleEditInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const editingColor = {...this.data.editingColor};
    
    editingColor[field] = value;
    
    this.setData({ editingColor });
  },

  /**
   * 验证颜色代码
   */
  isValidColorCode: function (code) {
    // 支持 #RGB 或 #RRGGBB 格式
    return /^#([0-9A-F]{3}){1,2}$/i.test(code);
  },

  /**
   * 保存新颜色
   */
  saveColor: function () {
    const { name } = this.data.newColor;
    
    if (!name.trim()) {
      toast('请输入颜色名称');
      return;
    }
    
    // 检查颜色名称是否已存在 - 添加null检查
    const { colorList } = this.data;
    const colorExists = colorList && Array.isArray(colorList) ? 
      colorList.some(color => color.name.toLowerCase() === name.trim().toLowerCase()) : 
      false;
    
    if (colorExists) {
      toast('颜色名称已存在，请使用其他名称');
      return;
    }
    
    loading('添加中');
    
    // 使用真实API添加颜色
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/colors', 'POST', {
      orgId,
      name: name.trim(),
      status: 1
    })
      .then(res => {
        this.fetchColors();
        this.setData({ showAddColorModal: false });
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
  updateColor: function () {
    const { id, name } = this.data.editingColor;
    
    console.log('更新颜色ID:', id); // 添加日志检查id值
    
    if (!name.trim()) {
      toast('请输入颜色名称');
      return;
    }
    
    if (!id) {
      toast('颜色ID无效，请重试');
      hideLoad(); // 确保loading被关闭
      return;
    }
    
    // 检查颜色名称是否已存在（排除当前编辑的颜色）- 添加null检查
    const { colorList } = this.data;
    const nameExists = colorList && Array.isArray(colorList) ? 
      colorList.some(color => {
        const colorId = color._id || color.id;
        return colorId !== id && color.name.toLowerCase() === name.trim().toLowerCase();
      }) : 
      false;
    
    if (nameExists) {
      toast('颜色名称已存在，请使用其他名称');
      return;
    }
    
    loading('更新中');
    
    // 使用真实API更新颜色
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request(`/colors/${id}`, 'PUT', {
      orgId,
      name: name.trim()
    })
      .then(res => {
        this.fetchColors();
        this.setData({ showEditColorModal: false });
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
  toggleColorStatus: function (e) {
    const id = e.currentTarget.dataset.id;
    
    console.log('切换颜色状态ID:', id); // 添加日志检查id值
    
    if (!id) {
      toast('颜色ID无效，请重试');
      return;
    }
    
    const currentStatus = e.currentTarget.dataset.status;
    const newStatus = currentStatus === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? '启用' : '禁用';
    
    modal('确认操作', `确定要${statusText}此颜色吗？`)
      .then(res => {
        if (res) {
          loading(`${statusText}中`);
          
          // 使用真实API更新状态
          const orgId = wx.getStorageSync('orgId') || 'org1';
          api.request(`/colors/${id}/status`, 'PUT', {
            orgId,
            status: newStatus
          })
            .then(res => {
              this.fetchColors();
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
   * 防止滑动穿透
   */
  preventTouchMove: function() {
    return false;
  },

  /**
   * 复制颜色代码到剪贴板
   */
  copyColorCode: function(e) {
    const code = e.currentTarget.dataset.code;
    wx.setClipboardData({
      data: code,
      success: function() {
        toast('颜色代码已复制', 'success');
      }
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 页面显示时刷新数据
    this.fetchColors();
  },
  
  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function() {
    // 如果需要分页加载，可以在这里实现
  },
  
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '颜色管理',
      path: '/pages/color-manage/color-manage'
    };
  },

  /**
   * 列表停用颜色
   */
  disableColor: function(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      toast('颜色ID无效，请重试');
      return;
    }
    modal('确认操作', '确定要停用此颜色吗？').then(res => {
      if (res) {
        loading('停用中');
        const orgId = wx.getStorageSync('orgId') || 'org1';
        api.request(`/colors/${id}/status`, 'PUT', { orgId, status: 0 })
          .then(res => {
            this.fetchColors();
            toast('已停用', 'success');
          })
          .catch(err => {
            console.error('停用失败', err);
            toast('操作失败，请检查网络');
          })
          .finally(() => {
            hideLoad();
          });
      }
    });
  },

  /**
   * 列表启用颜色
   */
  enableColor: function(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) {
      toast('颜色ID无效，请重试');
      return;
    }
    modal('确认操作', '确定要启用此颜色吗？').then(res => {
      if (res) {
        loading('启用中');
        const orgId = wx.getStorageSync('orgId') || 'org1';
        api.request(`/colors/${id}/status`, 'PUT', { orgId, status: 1 })
          .then(res => {
            this.fetchColors();
            toast('已启用', 'success');
          })
          .catch(err => {
            console.error('启用失败', err);
            toast('操作失败，请检查网络');
          })
          .finally(() => {
            hideLoad();
          });
      }
    });
  },

  /**
   * 编辑弹窗停用颜色
   */
  disableColorFromEdit: function() {
    const id = this.data.editingColor.id;
    if (!id) {
      toast('颜色ID无效，请重试');
      return;
    }
    modal('确认操作', '确定要停用此颜色吗？').then(res => {
      if (res) {
        loading('停用中');
        const orgId = wx.getStorageSync('orgId') || 'org1';
        api.request(`/colors/${id}/status`, 'PUT', { orgId, status: 0 })
          .then(res => {
            this.fetchColors();
            this.setData({ showEditColorModal: false });
            toast('已停用', 'success');
          })
          .catch(err => {
            console.error('停用失败', err);
            toast('操作失败，请检查网络');
          })
          .finally(() => {
            hideLoad();
          });
      }
    });
  },
}) 