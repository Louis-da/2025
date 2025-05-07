const app = getApp()
const { request } = require('../../utils/request')
const { showToast, showModal, showLoading, hideLoading } = require('../../utils/util')
const api = require('../../utils/api')
const { getFullImageUrl } = require('../../utils/image')

Page({
  data: {
    products: [],
    loading: true,
    showEmpty: false,
    searchValue: '',
    showModal: false,
    formData: {
      productNo: '',
      name: '',
      remark: '',
      imageList: [], // 图片数组
      colorArray: [], // 确保初始化为空数组
      sizeArray: [], // 确保初始化为空数组
      processArray: [] // 确保初始化为空数组
    },
    // 清空预设数据
    allColors: [],
    allSizes: [],
    allProcesses: [],
    existingProductNos: [] // 初始化，防止undefined
  },

  onLoad: function (options) {
    this.fetchProducts(() => {
      // 兜底处理products
      const products = (this.data.products || []).map(item => {
        item.image = getFullImageUrl(item.image);
        return item;
      });
      this.setData({ products });
    });
    // 加载尺码、颜色和工序数据
    this.fetchSizes();
    this.fetchColors();
    this.fetchProcesses();
  },

  onShow: function() {
    this.fetchProducts(() => {
      // 兜底处理products
      const products = (this.data.products || []).map(item => {
        item.image = getFullImageUrl(item.image);
        return item;
      });
      this.setData({ products });
    });
  },

  onPullDownRefresh: function () {
    this.fetchProducts(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 防止滑动穿透
  preventTouchMove: function() {
    return false;
  },

  // 获取产品列表 - 使用真实接口
  fetchProducts: function (callback) {
    const app = getApp();
    this.setData({
      loading: true,
      showEmpty: false
    });
    
    const orgId = wx.getStorageSync('orgId') || 'org1';
    // 始终传递 orgId
    api.request('/products', 'GET', { orgId })
      .then(res => {
        let filteredProducts = res.data || res;
        if (this.data.searchValue) {
          const searchValue = this.data.searchValue.toLowerCase();
          filteredProducts = filteredProducts.filter(item => 
            (item.code && item.code.toLowerCase().includes(searchValue)) || 
            (item.name && item.name.toLowerCase().includes(searchValue))
          );
        }
        // 拼接图片完整URL，使用工具函数兜底
        filteredProducts = filteredProducts.map(item => {
          item.image = getFullImageUrl(item.image);
          return item;
        });
        console.log('products for render:', filteredProducts);
        this.setData({
          products: filteredProducts,
          existingProductNos: Array.isArray(filteredProducts) ? filteredProducts.map(item => item.code || '') : [],
          loading: false,
          showEmpty: filteredProducts.length === 0
        });
        console.log('setData products:', this.data.products);
        if (callback && typeof callback === 'function') {
          callback();
        }
      })
      .catch(() => {
        this.setData({ products: [], loading: false, showEmpty: true, existingProductNos: [] });
        if (callback && typeof callback === 'function') {
          callback();
        }
      });
  },

  // 搜索输入事件
  onSearchInput: function (e) {
    this.setData({
      searchValue: e.detail.value
    })
  },

  // 清除搜索
  clearSearch: function() {
    this.setData({
      searchValue: ''
    }, () => {
      this.fetchProducts();
    });
  },

  // 搜索产品
  onSearch: function () {
    this.fetchProducts()
  },

  // 显示添加弹窗
  showAddModal: function() {
    // 确保弹窗打开前已加载最新的尺码、颜色和工序数据
    this.fetchSizes();
    this.fetchColors();
    this.fetchProcesses();
    
    this.setData({
      showModal: true,
      formData: {
        productNo: '',
        name: '',
        remark: '',
        imageList: [], // 初始化为空数组
        colorArray: [],
        sizeArray: [],
        processArray: []
      }
    });
  },

  // 隐藏弹窗
  hideModal: function() {
    this.setData({
      showModal: false
    });
  },

  // 货号输入事件
  onProductNoInput: function(e) {
    this.setData({
      'formData.productNo': e.detail.value
    });
  },

  // 名称输入事件
  onNameInput: function(e) {
    this.setData({
      'formData.name': e.detail.value
    });
  },

  // 状态变更
  onStatusChange: function(e) {
    this.setData({
      'formData.status': e.detail.value
    });
  },

  // 检查货号是否唯一
  checkProductNoUnique: function(productNo) {
    return !(this.data.existingProductNos || []).includes(productNo);
  },

  // 验证表单
  validateForm: function() {
    const { productNo } = this.data.formData;

    if (!productNo.trim()) {
      showToast('请输入货号');
      return false;
    }

    if (!this.checkProductNoUnique(productNo.trim())) {
      showToast('该货号已存在，请使用其他货号');
      return false;
    }

    return true;
  },

  // 选择图片
  onChooseImage: function() {
    const currentCount = this.data.formData.imageList.length;
    const remainCount = 9 - currentCount;
    
    if (remainCount <= 0) {
      showToast('最多只能上传9张图片');
      return;
    }
    
    wx.chooseImage({
      count: remainCount, // 最多可选择的图片张数
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 获取选中图片的临时路径
        const tempFilePaths = res.tempFilePaths;
        const imageList = [...this.data.formData.imageList, ...tempFilePaths];
        
        this.setData({
          'formData.imageList': imageList
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
        showToast('选择图片失败');
      }
    });
  },
  
  // 预览图片
  previewImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.formData.imageList;
    
    wx.previewImage({
      current: images[index], // 当前显示图片的链接
      urls: images // 需要预览的图片链接列表
    });
  },
  
  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = this.data.formData.imageList;
    imageList.splice(index, 1);
    
    this.setData({
      'formData.imageList': imageList
    });
  },

  // 备注输入事件
  onRemarkInput: function(e) {
    this.setData({
      'formData.remark': e.detail.value
    });
  },

  // 颜色选择器改变事件
  onColorPickerChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedColor = this.data.allColors[selectedIndex];
    console.log('选择颜色:', selectedColor);
    
    // 检查是否已经存在
    const colorArray = [...this.data.formData.colorArray];
    if (!colorArray.includes(selectedColor)) {
      colorArray.push(selectedColor);
      this.setData({
        'formData.colorArray': colorArray
      });
      console.log('添加颜色后:', colorArray);
    }
  },
  
  // 尺码选择器改变事件
  onSizePickerChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedSize = this.data.allSizes[selectedIndex];
    console.log('选择尺码:', selectedSize);
    
    // 检查是否已经存在
    const sizeArray = [...this.data.formData.sizeArray];
    if (!sizeArray.includes(selectedSize)) {
      sizeArray.push(selectedSize);
      this.setData({
        'formData.sizeArray': sizeArray
      });
      console.log('添加尺码后:', sizeArray);
    }
  },
  
  // 工序选择器改变事件
  onProcessPickerChange: function(e) {
    const selectedIndex = e.detail.value;
    const selectedProcess = this.data.allProcesses[selectedIndex];
    console.log('选择工序:', selectedProcess);
    
    // 检查是否已经存在
    const processArray = [...this.data.formData.processArray];
    if (!processArray.includes(selectedProcess)) {
      processArray.push(selectedProcess);
      this.setData({
        'formData.processArray': processArray
      });
      console.log('添加工序后:', processArray);
    }
  },

  // 快速创建货品（使用真实API）
  quickAddProduct: function() {
    if (!this.validateForm()) {
      return;
    }

    showLoading('创建中');

    const { productNo, name, remark, imageList } = this.data.formData;
    const orgId = wx.getStorageSync('orgId') || 'org1';
    // 只传递数据库有的字段，并补充image字段
    const newProductData = {
      orgId,
      name: name.trim(),
      code: productNo.trim(),
      description: remark,
      image: imageList.length > 0 ? imageList[0] : ''
    };

    api.request('/products', 'POST', newProductData)
      .then(res => {
        this.fetchProducts();
        this.setData({ showModal: false });
        showToast('创建成功', 'success');
      })
      .catch(err => {
        console.error('创建产品请求失败:', err);
        showToast('创建失败，请检查网络');
      })
      .finally(() => {
        hideLoading();
      });
  },

  // 添加产品（跳转到详情页）
  addProduct: function () {
    wx.navigateTo({
      url: '/pages/add-product/add-product'
    })
  },

  // 编辑产品
  editProduct: function (e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.products[index]
    
    wx.navigateTo({
      url: `/pages/add-product/add-product?id=${product.id}`
    })
  },

  // 切换产品状态（使用真实API）
  toggleStatus: function (e) {
    const index = e.currentTarget.dataset.index
    const product = this.data.products[index]
    const newStatus = product.status === 1 ? 0 : 1
    const statusText = newStatus === 1 ? '启用' : '禁用';
    
    showLoading(`${statusText}中`)
    
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request(`/products/${product.id}/status`, 'PUT', {
      orgId,
      status: newStatus
    })
      .then(res => {
        const products = this.data.products;
        products[index].status = newStatus;
        this.setData({ products: products });
        showToast(newStatus === 1 ? '已启用' : '已停用', 'success');
      })
      .catch(err => {
        console.error('更新状态请求失败:', err);
        showToast('操作失败，请检查网络');
      })
      .finally(() => {
        hideLoading();
      });
  },

  // 删除已选颜色
  removeColor: function(e) {
    const index = e.currentTarget.dataset.index;
    const colorArray = Array.isArray(this.data.formData.colorArray) ? [...this.data.formData.colorArray] : [];
    colorArray.splice(index, 1);
    console.log('removeColor', index, colorArray);
    this.setData({
      'formData.colorArray': colorArray
    });
  },

  // 删除已选尺码
  removeSize: function(e) {
    const index = e.currentTarget.dataset.index;
    const sizeArray = Array.isArray(this.data.formData.sizeArray) ? [...this.data.formData.sizeArray] : [];
    sizeArray.splice(index, 1);
    console.log('removeSize', index, sizeArray);
    this.setData({
      'formData.sizeArray': sizeArray
    });
  },

  // 删除已选工序
  removeProcess: function(e) {
    const index = e.currentTarget.dataset.index;
    const processArray = Array.isArray(this.data.formData.processArray) ? [...this.data.formData.processArray] : [];
    processArray.splice(index, 1);
    console.log('removeProcess', index, processArray);
    this.setData({
      'formData.processArray': processArray
    });
  },

  // 获取尺码列表
  fetchSizes: function() {
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/sizes', 'GET', { orgId })
      .then(res => {
        console.log('尺码数据返回:', res);
        // 正确处理返回的数据结构 {success: true, data: [...]}
        const sizeData = res.data || [];
        // 提取尺码名称列表
        const sizeNames = sizeData.map(item => item.name);
        this.setData({
          allSizes: sizeNames
        });
      })
      .catch(err => {
        console.error('获取尺码数据失败:', err);
        this.setData({
          allSizes: []
        });
      });
  },

  // 获取颜色列表
  fetchColors: function() {
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/colors', 'GET', { orgId })
      .then(res => {
        console.log('颜色数据返回:', res);
        // 正确处理返回的数据结构 {success: true, data: [...]}
        const colorData = res.data || [];
        // 提取颜色名称列表
        const colorNames = colorData.map(item => item.name);
        this.setData({
          allColors: colorNames
        });
      })
      .catch(err => {
        console.error('获取颜色数据失败:', err);
        this.setData({
          allColors: []
        });
      });
  },

  // 获取工序列表
  fetchProcesses: function() {
    const orgId = wx.getStorageSync('orgId') || 'org1';
    api.request('/processes', 'GET', { orgId })
      .then(res => {
        console.log('工序数据返回:', res);
        // 正确处理返回的数据结构 {success: true, data: [...]}
        const processData = res.data || [];
        // 提取工序名称列表
        const processNames = processData.map(item => item.name);
        this.setData({
          allProcesses: processNames
        });
      })
      .catch(err => {
        console.error('获取工序数据失败:', err);
        this.setData({
          allProcesses: []
        });
    });
  },
})