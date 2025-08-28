const app = getApp()
const { request } = require('../../utils/request')
// const { showToast, showModal, showLoading, hideLoading } = require('../../utils/util') // 暂时不使用这些导入
const api = require('../../utils/api')
const { getFullImageUrl } = require('../../utils/image')

// EnsureIsArrayAndNotEmpty 函数应在Page({})外部或作为辅助函数引入
function EnsureIsArrayAndNotEmpty(arr, strFallback) {
  if (Array.isArray(arr) && arr.length > 0 && arr.every(val => val !== null && val !== undefined && val !== '')) {
    return arr.filter(val => String(val).trim() !== '');
  }
  if (typeof strFallback === 'string' && strFallback.trim() !== '') {
    return strFallback.split(',').map(s => s.trim()).filter(s => s !== '');
  }
  return [];
}

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
      processArray: [], // 确保初始化为空数组
      createTime: '' // 添加创建时间字段
    },
    // 清空预设数据
    allColors: [],
    allSizes: [],
    allProcesses: [],
    // 新增：用于渲染的选项数组
    displayableColors: [],
    displayableSizes: [],
    displayableProcesses: [],
    existingProductNos: [], // 初始化，防止undefined
    // 新增：产品统计信息
    productStats: {
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0
    },
    // 选择器弹出层显示状态
    showColorModal: false,
    showSizeModal: false,
    showProcessModal: false,
    // 强制视图更新的key
    forceUpdateKey: 0,
    // 当前日期（北京时间）
    currentDate: ''
  },

  onLoad: function (options) {
    this.setCurrentDate(); // 设置当前日期
    // 检查登录状态
    const token = wx.getStorageSync('token');
    const orgId = wx.getStorageSync('orgId');
    
    if (!token) {
      wx.showModal({
        title: '登录提示',
        content: '请先登录后再使用此功能',
        showCancel: false,
        success: () => {
          wx.reLaunch({ url: '/pages/login/login' });
        }
      });
      return;
    }
    
    if (!orgId) {
      wx.showModal({
        title: '数据错误',
        content: '组织信息缺失，请重新登录',
        showCancel: false,
        success: () => {
          wx.clearStorageSync();
          wx.reLaunch({ url: '/pages/login/login' });
        }
      });
      return;
    }
    
    console.log('[ProductManage] 当前登录状态 - orgId:', orgId, 'token:', token ? '有效' : '无效');
    
    this.loadInitialData();
  },

  onShow: function() {
    this.loadInitialData();
  },

  // 统一的初始数据加载方法
  loadInitialData: function() {
    this.fetchProducts(() => {
      // fetchProducts 已经完成了数据的获取、处理和 setData。
      // 这个回调现在可以用于确认产品数据加载完成，以便执行依赖产品数据的其他操作。
      // 之前在此处对 this.data.products 的 map 和 setData 是冗余的，已移除。
      console.log('[loadInitialData] fetchProducts has completed and set data.');
    });
    this.fetchProductStats(); // 获取统计信息
    // 以下方法是为弹窗内的picker准备数据源，可以在点击新增/编辑时按需加载，或保留在此处预加载
    this.fetchSizes();
    this.fetchColors();
    this.fetchProcesses();
  },

  onPullDownRefresh: function () {
    this.fetchProducts(() => {
      wx.stopPullDownRefresh();
      this.fetchProductStats(); // 下拉刷新时也更新统计信息
    });
  },

  // 防止滑动穿透
  preventTouchMove: function() {
    return false;
  },

  // 阻止事件冒泡
  stopPropagation: function() {
    return false;
  },

  // 获取产品列表 - 使用真实接口
  fetchProducts: function (callback) {
    const app = getApp();
    this.setData({
      loading: true,
      showEmpty: false
    });
    
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchProducts] 组织ID缺失');
      this.setData({
        loading: false,
        showEmpty: true,
        products: []
      });
      wx.showToast({ title: '组织信息缺失，请重新登录', icon: 'none' });
      return;
    }
    
    console.log('[fetchProducts] 开始请求产品列表, orgId:', orgId);
    api.request('/products', 'GET', { orgId })
      .then(res => {
        console.log('[fetchProducts] API返回原始数据:', JSON.parse(JSON.stringify(res)));
        let filteredProducts = res.data || res;
         if (res && res.success === false) {
          console.error("fetchProducts API error:", res.message);
          filteredProducts = [];
        } else if (res && res.data) {
          filteredProducts = res.data;
        } else if (!Array.isArray(res)) {
            console.warn("fetchProducts received non-standard response, attempting to use as is:", res);
            filteredProducts = []; // Or handle as an error
        } else {
          // res is an array directly
          console.log('[fetchProducts] API直接返回数组 (未包含success标志)');
        }

        let processedProducts = [];
        if (Array.isArray(filteredProducts)) {
          // 在 mapping 之前过滤搜索结果
          if (this.data.searchValue) {
            const searchValueLowerCase = this.data.searchValue.toLowerCase();
            filteredProducts = filteredProducts.filter(item => 
              (item.code && String(item.code).toLowerCase().includes(searchValueLowerCase)) || 
              (item.name && String(item.name).toLowerCase().includes(searchValueLowerCase))
            );
          }

          console.log('[fetchProducts] 搜索过滤后的原始数据 (前2条):', JSON.parse(JSON.stringify(filteredProducts.slice(0, 2))));
          processedProducts = filteredProducts.map(originalItem => {
            let item = { ...originalItem }; // 创建副本
            
            item.productNo = item.productNo || item.code;

            // 处理列表项图片
            console.log(`[fetchProducts] 处理产品[${item.id}]的图片路径，原始路径: image=${item.image}, imageUrl=${item.imageUrl}`);
            
            // 检查并修复可能存在的双重_thumb后缀
            if (item.image && item.image.includes('_thumb_thumb')) {
              console.log(`[fetchProducts] 检测到重复的_thumb后缀: ${item.image}`);
              item.image = item.image.replace('_thumb_thumb', '_thumb');
            }
            if (item.imageUrl && item.imageUrl.includes('_thumb_thumb')) {
              console.log(`[fetchProducts] 检测到重复的_thumb后缀: ${item.imageUrl}`);
              item.imageUrl = item.imageUrl.replace('_thumb_thumb', '_thumb');
            }

            item.imageUrl = getFullImageUrl(item.image || item.imageUrl || ''); 
            item.originalImageUrl = getFullImageUrl(item.image_original || originalItem.image || item.imageUrl || '');
            
            console.log(`[fetchProducts] 处理后的图片路径: imageUrl=${item.imageUrl}, originalImageUrl=${item.originalImageUrl}`);
            
            item.colorOptions = EnsureIsArrayAndNotEmpty(item.colorOptions, item.colors);
            item.sizeOptions = EnsureIsArrayAndNotEmpty(item.sizeOptions, item.sizes);
            item.processOptions = EnsureIsArrayAndNotEmpty(item.processOptions, item.processes);

            item.colorStr = Array.isArray(item.colorOptions) && item.colorOptions.length > 0 ? item.colorOptions.join(', ') : '';
            item.sizeStr = Array.isArray(item.sizeOptions) && item.sizeOptions.length > 0 ? item.sizeOptions.join(', ') : '';
            item.processStr = Array.isArray(item.processOptions) && item.processOptions.length > 0 ? item.processOptions.join(', ') : '';

            // 格式化创建时间为日期格式
            item.createTime = this.formatDateFromDateTime(item.createTime);

            return item;
          });
        } else {
          console.error('[fetchProducts] filteredProducts 不是一个数组:', filteredProducts);
        }
        
        // 打印处理后的第一条产品数据
        if (processedProducts.length > 0) {
          const firstProduct = processedProducts[0];
          console.log('[fetchProducts] 处理后的第一个产品：', {
            id: firstProduct.id,
            name: firstProduct.name,
            imageUrl: firstProduct.imageUrl,
            originalImageUrl: firstProduct.originalImageUrl
          });
        }
        
        this.setData({
          products: processedProducts,
          loading: false,
          showEmpty: processedProducts.length === 0
        }, () => {
          if (callback && typeof callback === 'function') {
            callback();
          }
        });
      })
      .catch(error => {
        console.error('[fetchProducts] 请求失败:', error);
        this.setData({
          loading: false,
          showEmpty: true,
          products: []
        });
      });
  },

  // 新增：获取产品统计信息
  fetchProductStats: function() {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchProductStats] 组织ID缺失');
      this.setData({ productStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 } });
      return;
    }
    
    api.request('/products/stats', 'GET', { orgId })
      .then(res => {
        if (res && res.success && res.data) {
          const stats = {
            totalCount: parseInt(res.data.totalCount) || 0,
            activeCount: parseInt(res.data.activeCount) || 0,
            inactiveCount: parseInt(res.data.inactiveCount) || 0,
          };
          this.setData({
            productStats: stats
          });
        } else {
          console.error('[fetchProductStats] 获取产品统计失败或数据格式无效:', res);
           this.setData({ productStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 } });
        }
      })
      .catch(err => {
        console.error('[fetchProductStats] 请求产品统计接口异常:', err);
        this.setData({ productStats: { totalCount: 0, activeCount: 0, inactiveCount: 0 } });
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
    // 每次弹窗打开都强制拉取最新的基础数据
    Promise.all([
      new Promise(resolve => this.fetchColors(resolve)),
      new Promise(resolve => this.fetchSizes(resolve)),
      new Promise(resolve => this.fetchProcesses(resolve))
    ]).then(() => {
      // 拉取完毕后再显示弹窗，重置表单
      this.setData({
        showModal: true,
        formData: { // 重置表单
          id: null, // 区分新增和编辑
          productNo: '',
          name: '',
          status: 1, // 默认启用
          image: '', // 存储上传后的文件名
          imageList: [], 
          colors: '', // 存储逗号分隔的字符串
          sizes: '',  // 存储逗号分隔的字符串
          processes: '', // 存储逗号分隔的字符串
          description: '', // 修改为 description
          colorArray: [], // picker选择的结果 (name 数组)
          sizeArray: [],  // picker选择的结果 (name 数组)
          processArray: [], // picker选择的结果 (name 数组)
          createTime: this.data.currentDate // 设置当前日期
        }
      }, () => {
        // 新增时，基于空的 formData 更新 displayable 选项
        this._updateDisplayableOptions('colors');
        this._updateDisplayableOptions('sizes');
        this._updateDisplayableOptions('processes');
      });
    });
  },

  // 隐藏弹窗
  hideModal: function() {
    this.setData({
      showModal: false,
      // 当主弹窗关闭时，也确保所有选择器小弹窗都关闭
      showColorModal: false,
      showSizeModal: false,
      showProcessModal: false
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

  // 状态变更 (如果表单中有status字段)
  onStatusChange: function(e) {
    this.setData({
      // 'formData.status': e.detail.value // 如果是 switch 或 checkbox，可能是 boolean
      'formData.status': e.detail.value ? 1: 0 // 假设 e.detail.value 是 true/false
    });
  },

  // 检查货号是否唯一
  checkProductNoUnique: function(productNo, productIdToExclude = null) {
    const currentProductNo = String(productNo).trim();
    const existingNos = (this.data.products || [])
        .filter(p => p.id !== productIdToExclude) 
        .map(p => String(p.code || '').trim());
    return !existingNos.includes(currentProductNo);
  },

  // 选择图片
  onChooseImage: function() {
    const currentCount = this.data.formData.imageList.length;
    const remainCount = 1 - currentCount; // 只允许上传一张图片
    if (remainCount <= 0) {
      wx.showToast({ title: '最多只能上传1张图片', icon: 'none' });
      return;
    }
    wx.chooseImage({
      count: remainCount,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePaths = res.tempFilePaths;
        console.log('[ImageDebug] 选择了新图片:', tempFilePaths[0]);
        this.setData({
          'formData.imageList': tempFilePaths.slice(0, 1),
          'formData.isImageChanged': true // 标记图片已更改
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
        // wx.showToast({ title: '选择图片失败', icon: 'none' }); // 系统一般有提示
      }
    });
  },
  
  // 预览图片
  previewImage: function(e) {
    const images = this.data.formData.imageList; // 这是表单中的预览图
    if (!images || images.length === 0) return;
    
    wx.previewImage({
      current: images[0], 
      urls: images 
    });
  },
  // 列表图片预览 (新增)
  previewListItemImage: function(e) {
    const imageUrl = e.currentTarget.dataset.url;
    if (imageUrl) {
      wx.previewImage({
        current: imageUrl,
        urls: [imageUrl]
      });
    }
  },

  
  // 删除图片
  deleteImage: function(e) {
    this.setData({
      'formData.imageList': [] // 直接清空
    });
  },

  onRemarkInput: function(e) {
    this.setData({ 'formData.remark': e.detail.value });
  },

  // 提交表单 (新增/编辑产品)
  submitForm: function() {
    const { productNo, name, status, imageList, colorArray, sizeArray, processArray, remark, /* category, */ id, isImageChanged } = this.data.formData; // 增加isImageChanged
    const orgId = wx.getStorageSync('orgId');

    // 检查登录状态和组织信息
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/login/login' });
      }, 1500);
      return;
    }

    if (!orgId) {
      wx.showToast({ title: '组织信息缺失，请重新登录', icon: 'none' });
      setTimeout(() => {
        wx.clearStorageSync();
        wx.reLaunch({ url: '/pages/login/login' });
      }, 1500);
      return;
    }

    // 数据验证
    if (!String(productNo).trim()) {
      wx.showToast({ title: '请输入货号', icon: 'none' }); return;
    }
    if (!String(name).trim()) {
      wx.showToast({ title: '请输入货品名称', icon: 'none' }); return;
    }

    // 确保数组不为undefined
    const safeColorArray = colorArray || [];
    const safeSizeArray = sizeArray || [];
    const safeProcessArray = processArray || [];

    // 打印工序信息，便于调试
    console.log('[ProcessDebug] 即将保存的工序信息:', JSON.stringify(safeProcessArray));

    wx.showLoading({ title: '正在保存...' });

    let finalImageToSave = '';
    const promises = [];

    // 增加调试日志，帮助分析问题
    console.log('[ProductSubmitDebug] imageList:', JSON.stringify(imageList));
    console.log('[ProductSubmitDebug] isImageChanged:', isImageChanged);
    if (id) {
      const originalProduct = this.data.products.find(p => p.id === id);
      console.log('[ProductSubmitDebug] 原始产品图片路径:', originalProduct ? originalProduct.image : '无');
    }

    // 如果有新图片需要上传
    if (imageList.length > 0 && imageList[0] && (!imageList[0].startsWith('http') || isImageChanged === true)) {
        console.log('[ProductUploadDebug] Attempting to upload new image:', imageList[0]);
        promises.push(
            api.uploadFile('/upload', imageList[0])
                .then(uploadRes => {
                    console.log('[ProductUploadDebug] api.uploadFile response:', JSON.stringify(uploadRes)); // 打印上传响应
                    if (uploadRes && uploadRes.success && uploadRes.data && uploadRes.data.filePath) {
                        // 确保路径以 /uploads/ 开头且不是完整URL
                        let imagePath = uploadRes.data.filePath;
                        if (imagePath.includes('://')) {
                            const urlParts = imagePath.split('/');
                            imagePath = '/uploads/' + urlParts.pop(); // 取最后一部分作为文件名
                            console.log('[ProductUploadDebug] Converted full URL to relative path:', imagePath);
                        } else if (!imagePath.startsWith('/uploads/')) {
                            imagePath = '/uploads/' + imagePath.split('/').pop();
                            console.log('[ProductUploadDebug] Ensured path starts with /uploads/:', imagePath);
                        }
                        finalImageToSave = imagePath;
                        console.log('[ProductUploadDebug] New image uploaded. finalImageToSave set to:', finalImageToSave);
                    } else {
                        console.warn('[ProductUploadDebug] Image upload failed or filePath missing in response. uploadRes:', uploadRes);
                        // 根据实际情况，这里可能需要提示用户上传失败，或者使用之前的图片
                        // 为了保持逻辑，如果上传失败，finalImageToSave 将保留其初始值（旧图片或空）
                    }
                })
                .catch(uploadErr => {
                    console.error('[ProductUploadDebug] api.uploadFile error:', uploadErr);
                    // 检查是否是登录过期错误
                    if (uploadErr.statusCode === 401) {
                        wx.hideLoading();
                        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
                        setTimeout(() => {
                            wx.reLaunch({ url: '/pages/login/login' });
                        }, 1500);
                        return Promise.reject(uploadErr);
                    }
                    wx.showToast({ title: '图片上传失败，将保存其他信息', icon: 'none' });
                    // 上传失败，也标记一下，避免使用未定义的 finalImageToSave
                    // 但因为 finalImageToSave 已在外部声明，所以这里不需要特别处理，除非要中断流程
                })
        );
    } else if (imageList.length > 0 && imageList[0] && imageList[0].startsWith('http') && !isImageChanged) {
        // 保留已有的网络图片路径，但确保我们获取的是原始上传的图片路径而非默认路径
        let originalProduct = null;
        if (id) {
          originalProduct = this.data.products.find(p => p.id === id);
        }
        
        // 优先使用原始图片路径，避免使用默认图片路径
        if (originalProduct && originalProduct.image && !originalProduct.image.includes('default-product')) {
          finalImageToSave = originalProduct.image;
        } else if (imageList[0] && !imageList[0].includes('default-product')) {
          // 尝试从当前选择的图片中获取路径
          const urlObj = new URL(imageList[0]);
          finalImageToSave = urlObj.pathname;
        } else {
          // 如果仍然是默认图片，则清空字段让后端保持原值
          finalImageToSave = '';
        }
        
        // 如果 finalImageToSave 是完整 URL，尝试转换为相对路径
        if (finalImageToSave.includes('://')) {
            try {
                const url = new URL(finalImageToSave);
                if (url.pathname.startsWith('/uploads/')) {
                    finalImageToSave = url.pathname;
                }
            } catch (e) {
                console.warn('[ProductUploadDebug] Failed to parse existing image URL, keeping original:', finalImageToSave);
            }
        }
        console.log('[ProductUploadDebug] Using existing image. finalImageToSave:', finalImageToSave);
    } else {
        // 没有图片或图片被移除
        finalImageToSave = ''; // 明确设置为空字符串
        console.log('[ProductUploadDebug] No image selected or image removed. finalImageToSave set to empty string.');
    }

    Promise.all(promises).then(() => {
        // 确保processArray不为undefined或null
        const finalProcessArray = safeProcessArray;
        
        const productApiData = {
            orgId,
            code: String(productNo).trim(),
            name: String(name).trim(),
            status: status === undefined ? 1 : status, 
            image: finalImageToSave, // 使用处理后的图片路径
            colors: safeColorArray.join(','), // 使用 picker 选择的结果
            sizes: safeSizeArray.join(','),
            processes: finalProcessArray.join(','), // 确保不会因为processArray为undefined而出错
            description: remark || '', // 修改为 description
            _forceUpdateImage: true, // 强制后端更新图片字段
            _forceUpdateProcesses: true // 强制更新工序字段
            // createTime字段由数据库自动生成，无需提交
        };

        console.log('[ProcessDebug] 最终发送的工序数据:', productApiData.processes);
        console.log('[ProductUploadDebug] Data to be sent to api.updateProduct or api.addProduct:', JSON.stringify(productApiData));

        let requestPromise;
        if (id) {
            requestPromise = api.updateProduct(id, productApiData);
        } else {
            requestPromise = api.addProduct(productApiData);
        }

        return requestPromise
            .then(res => {
                wx.hideLoading();
                if (res && res.success) {
                    wx.showToast({ title: id ? '修改成功' : '添加成功', icon: 'success' });
                    this.hideModal();
                    this.fetchProducts(); // 重新获取产品列表
                } else {
                    const errorMsg = res.message || res.error || '操作失败';
                    console.error('保存产品失败:', errorMsg);
                    wx.showToast({ title: errorMsg, icon: 'none' });
                }
            })
            .catch(err => {
                wx.hideLoading();
                console.error('保存产品失败:', err);
                
                // 处理特定错误
                let errorMessage = '保存失败，请重试';
                if (err.statusCode === 401) {
                    errorMessage = '登录已过期，请重新登录';
                    setTimeout(() => {
                        wx.reLaunch({ url: '/pages/login/login' });
                    }, 1500);
                } else if (err.error && err.error.includes('orgId')) {
                    errorMessage = '数据权限错误，请联系管理员';
                } else if (err.error && err.error.includes('Unknown column')) {
                    errorMessage = '数据库结构错误，请联系技术支持';
                } else if (err.response && err.response.message) {
                    errorMessage = err.response.message;
                } else if (err.error) {
                    errorMessage = err.error;
                }
                
                wx.showToast({ title: errorMessage, icon: 'none' });
            });
    }).catch(err => {
        wx.hideLoading();
        console.error('处理失败:', err);
        
        // 如果是图片上传失败导致的Promise.reject，不重复显示错误
        if (err.statusCode === 401) {
            return; // 已经在上面处理过了
        }
        
        wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    });
  },

  // 编辑产品按钮事件
  editProduct: async function(e) {
    const productId = e.currentTarget.dataset.id;
    if (!productId) {
      wx.showToast({ title: '无效的产品ID', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加载数据...' });
    try {
      const orgId = wx.getStorageSync('orgId');
      const productRes = await api.request(`/products/${productId}`, 'GET', { orgId });
      if (!productRes || !productRes.success || !productRes.data) {
        throw new Error(productRes.message || '获取产品详情失败');
      }
      const product = productRes.data;
      console.log('[ProductEditDebug] 获取到的产品详情:', JSON.stringify(product));

      const selectedColors = product.colors ? product.colors.split(',').map(c => c.trim()).filter(Boolean) : [];
      const selectedSizes = product.sizes ? product.sizes.split(',').map(s => s.trim()).filter(Boolean) : [];
      // 确保工序数据正确处理
      const selectedProcesses = product.processes ? product.processes.split(',').map(p => p.trim()).filter(Boolean) : [];
      console.log('[ProductEditDebug] 解析出的工序:', selectedProcesses);

      // 确保图片路径处理正确
      let imageUrl = '';
      if (product.originalImageUrl) {
        imageUrl = getFullImageUrl(product.originalImageUrl);
      } else if (product.image && !product.image.includes('default-product')) {
        imageUrl = getFullImageUrl(product.image);
      } else if (product.imageUrl && !product.imageUrl.includes('default-product')) {
        imageUrl = getFullImageUrl(product.imageUrl);
      }
      
      console.log('[ProductEditDebug] 最终使用的图片URL:', imageUrl);

      const productFormData = {
        id: product.id,
        productNo: product.code || '',
        name: product.name || '',
        status: product.status === undefined ? 1 : product.status,
        image: product.image || product.imageUrl || '',
        imageList: imageUrl ? [imageUrl] : [], 
        colors: selectedColors.join(','), 
        sizes: selectedSizes.join(','),
        processes: selectedProcesses.join(','),
        colorArray: selectedColors, 
        sizeArray: selectedSizes,
        processArray: selectedProcesses,
        description: product.description || '', // 修改为 description
        isImageChanged: false, // 标记图片未更改
        createTime: product.createTime // 添加创建时间
      };

      this.setData({
        showModal: true,
        formData: productFormData
      }, () => {
        this._updateDisplayableOptions('colors');
        this._updateDisplayableOptions('sizes');
        this._updateDisplayableOptions('processes');
      });
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      console.error('编辑产品加载数据失败:', err);
    }
  },

  // 更新产品状态
  updateProductStatus: function(e) {
    const { id, status } = e.currentTarget.dataset;
    // status 从服务端来，应该是 0 或 1
    const newStatus = Number(status) === 1 ? 0 : 1; // 切换状态
    const confirmText = newStatus === 1 ? '确定要启用该货品吗？' : '确定要停用该货品吗？';

    wx.showModal({
      title: '提示',
      content: confirmText,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '更新中...' });
          api.request(`/products/${id}/status`, 'PUT', { status: newStatus })
            .then(updateRes => {
              wx.hideLoading();
              if (updateRes && updateRes.success) {
                wx.showToast({ title: '状态更新成功', icon: 'success' });
                const products = this.data.products.map(p => {
                  if (p.id === id) {
                    return { ...p, status: newStatus };
                  }
                  return p;
                });
                this.setData({ products });
                this.fetchProductStats(); 
              } else {
                throw new Error(updateRes.message || '状态更新失败');
              }
            })
            .catch(err => {
              wx.hideLoading();
              wx.showToast({ title: err.message || '操作失败', icon: 'none' });
            });
        }
      }
    });
  },
  
  // 处理颜色选择
  onColorChange: function(e) {
    // e.detail.value 是选中项的索引数组
    const selectedColorNames = e.detail.value.map(index => this.data.allColors[Number(index)]).filter(Boolean);
    this.setData({
      'formData.colorArray': selectedColorNames, 
    });
  },
  // 处理尺码选择
  onSizeChange: function(e) {
    const selectedSizeNames = e.detail.value.map(index => this.data.allSizes[Number(index)]).filter(Boolean);
    this.setData({
      'formData.sizeArray': selectedSizeNames,
    });
  },
  // 处理工序选择
  onProcessChange: function(e) {
     const selectedProcessNames = e.detail.value.map(index => this.data.allProcesses[Number(index)]).filter(Boolean);
    this.setData({
      'formData.processArray': selectedProcessNames,
    });
  },

  // --- 获取颜色、尺码、工序的方法 ---
  fetchColors: function(callback) {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchColors] 组织ID缺失');
      if (callback) callback();
      return;
    }
    api.request('/colors', 'GET', { orgId })
      .then(res => {
        if (res && res.success && res.data) {
          // 过滤掉已停用的颜色（status = 0），只显示启用的颜色（status = 1）
          const enabledColors = res.data.filter(item => item.status === 1);
          const colorNames = enabledColors.map(item => item.name);
          console.log('[product-manage.js fetchColors] Filtered out disabled colors, showing', enabledColors.length, 'enabled colors');
          
          this.setData({
            colorOptions: enabledColors,
            allColors: colorNames // 同步allColors
          });
        }
        if (callback) callback();
      })
      .catch(err => {
        console.error('获取颜色列表失败:', err);
        if (callback) callback();
      });
  },

  // 获取尺码列表
  fetchSizes: function(callback) {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchSizes] 组织ID缺失');
      if (callback) callback();
      return;
    }
    api.request('/sizes', 'GET', { orgId })
      .then(res => {
        if (res && res.success && res.data) {
          // 过滤掉已停用的尺码（status = 0），只显示启用的尺码（status = 1）
          const enabledSizes = res.data.filter(item => item.status === 1);
          const sizeNames = enabledSizes.map(item => item.name);
          console.log('[product-manage.js fetchSizes] Filtered out disabled sizes, showing', enabledSizes.length, 'enabled sizes');
          
          this.setData({
            sizeOptions: enabledSizes,
            allSizes: sizeNames // 同步allSizes
          });
        }
        if (callback) callback();
      })
      .catch(err => {
        console.error('获取尺码列表失败:', err);
        if (callback) callback();
      });
  },

  // 获取工序列表
  fetchProcesses: function(callback) {
    const orgId = wx.getStorageSync('orgId');
    if (!orgId) {
      console.error('[fetchProcesses] 组织ID缺失');
      if (callback) callback();
      return;
    }
    api.request('/processes', 'GET', { orgId })
      .then(res => {
        if (res && res.success && res.data) {
          // 过滤掉已停用的工序（status = 0），只显示启用的工序（status = 1）
          const enabledProcesses = res.data.filter(item => item.status === 1);
          const processNames = enabledProcesses.map(item => item.name);
          console.log('[product-manage.js fetchProcesses] Filtered out disabled processes, showing', enabledProcesses.length, 'enabled processes');
          
          this.setData({
            processOptions: enabledProcesses,
            allProcesses: processNames // 同步allProcesses
          });
        }
        if (callback) callback();
      })
      .catch(err => {
        console.error('获取工序列表失败:', err);
        if (callback) callback();
      });
  },

  // 颜色选择切换
  toggleColorSelection: function(e) {
    const color = e.currentTarget.dataset.color;
    let colorArray = [...this.data.formData.colorArray];
    
    // 检查颜色是否已被选中
    const index = colorArray.indexOf(color);
    if (index >= 0) {
      // 如果已选中，则移除
      colorArray.splice(index, 1);
    } else {
      // 如果未选中，则添加
      colorArray.push(color);
    }
    
    // 直接克隆整个formData对象并更新
    const formData = JSON.parse(JSON.stringify(this.data.formData));
    formData.colorArray = colorArray;
    
    this.setData({
      formData: formData
    });
    
    console.log('当前选中的颜色:', colorArray);
  },
  
  // 显示颜色选择器
  showColorSelector: function() {
    console.log('显示颜色选择器，当前已选颜色:', this.data.formData.colorArray);
    this.setData({
      showColorModal: true
    });
  },
  
  // 隐藏颜色选择器
  hideColorSelector: function() {
    // formData.colorArray 已经被 simpleToggleColor 更新了
    // 此处 setData 主要用于关闭弹窗，并确保主表单的预览区得到刷新
    this.setData({
      showColorModal: false,
      formData: { ...this.data.formData } // 传入 formData 的一个新副本，确保视图更新
    });
    console.log('颜色选择器关闭，最终颜色预览:', this.data.formData.colorArray.join(', '));
  },
  
  // 尺码选择切换
  toggleSizeSelection: function(e) {
    const size = e.currentTarget.dataset.size;
    let sizeArray = [...this.data.formData.sizeArray];
    
    // 检查尺码是否已被选中
    const index = sizeArray.indexOf(size);
    if (index >= 0) {
      // 如果已选中，则移除
      sizeArray.splice(index, 1);
    } else {
      // 如果未选中，则添加
      sizeArray.push(size);
    }
    
    // 直接克隆整个formData对象并更新
    const formData = JSON.parse(JSON.stringify(this.data.formData));
    formData.sizeArray = sizeArray;
    
    this.setData({
      formData: formData
    });
    
    console.log('当前选中的尺码:', sizeArray);
  },
  
  // 显示尺码选择器
  showSizeSelector: function() {
    console.log('显示尺码选择器，当前已选尺码:', this.data.formData.sizeArray);
    this.setData({
      showSizeModal: true
    });
  },
  
  // 隐藏尺码选择器
  hideSizeSelector: function() {
    this.setData({
      showSizeModal: false,
      formData: { ...this.data.formData } // 传入 formData 的一个新副本
    });
    console.log('尺码选择器关闭，最终尺码预览:', this.data.formData.sizeArray.join(', '));
  },

  // 工序选择切换
  toggleProcessSelection: function(e) {
    const process = e.currentTarget.dataset.process;
    let processArray = [...this.data.formData.processArray];
    
    // 检查工序是否已被选中
    const index = processArray.indexOf(process);
    if (index >= 0) {
      // 如果已选中，则移除
      processArray.splice(index, 1);
    } else {
      // 如果未选中，则添加
      processArray.push(process);
    }
    
    // 直接克隆整个formData对象并更新
    const formData = JSON.parse(JSON.stringify(this.data.formData));
    formData.processArray = processArray;
    
    this.setData({
      formData: formData
    });
    
    console.log('当前选中的工序:', processArray);
  },
  
  // 显示工序选择器
  showProcessSelector: function() {
    console.log('显示工序选择器，当前已选工序:', this.data.formData.processArray);
    this.setData({
      showProcessModal: true
    });
  },
  
  // 隐藏工序选择器
  hideProcessSelector: function() {
    this.setData({
      showProcessModal: false,
      formData: { ...this.data.formData } // 传入 formData 的一个新副本
    });
    console.log('工序选择器关闭，最终工序预览:', this.data.formData.processArray.join(', '));
  },

  // 辅助函数：更新用于显示的选项列表
  _updateDisplayableOptions: function(type) {
    let sourceArray = [];
    let selectedArray = [];
    let displayKey = '';

    if (type === 'colors') {
      sourceArray = this.data.allColors;
      selectedArray = this.data.formData.colorArray || [];
      displayKey = 'displayableColors';
    } else if (type === 'sizes') {
      sourceArray = this.data.allSizes;
      selectedArray = this.data.formData.sizeArray || [];
      displayKey = 'displayableSizes';
    } else if (type === 'processes') {
      sourceArray = this.data.allProcesses;
      selectedArray = this.data.formData.processArray || [];
      displayKey = 'displayableProcesses';
    }

    console.log(`[UpdateOptions] 更新${type}选项，已选项:`, selectedArray);

    if (sourceArray.length > 0) {
      const displayableItems = sourceArray.map(name => ({
        name: name,
        isSelected: selectedArray.includes(name)
      }));
      this.setData({
        [displayKey]: displayableItems
      });
    } else {
       this.setData({
        [displayKey]: [] // 如果源数组为空，确保显示数组也为空
      });
    }
  },

  // 简单颜色切换函数
  simpleToggleColor: function(e) {
    const colorName = e.currentTarget.dataset.color;
    let currentSelectedColors = [...this.data.formData.colorArray];
    const index = currentSelectedColors.indexOf(colorName);

    if (index > -1) {
      currentSelectedColors.splice(index, 1);
    } else {
      currentSelectedColors.push(colorName);
    }

    const newFormData = {
      ...this.data.formData,
      colorArray: currentSelectedColors
    };

    this.setData({
      formData: newFormData
    }, () => {
      this._updateDisplayableOptions('colors'); // 更新显示数组
    });
    console.log('Updated formData.colorArray:', this.data.formData.colorArray);
  },
  
  simpleToggleSize: function(e) {
    const sizeName = e.currentTarget.dataset.size;
    let currentSelectedSizes = [...this.data.formData.sizeArray];
    const index = currentSelectedSizes.indexOf(sizeName);

    if (index > -1) {
      currentSelectedSizes.splice(index, 1);
    } else {
      currentSelectedSizes.push(sizeName);
    }

    const newFormData = {
      ...this.data.formData,
      sizeArray: currentSelectedSizes
    };

    this.setData({
      formData: newFormData
    }, () => {
      this._updateDisplayableOptions('sizes');
    });
    console.log('Updated formData.sizeArray:', this.data.formData.sizeArray);
  },
  
  simpleToggleProcess: function(e) {
    const processName = e.currentTarget.dataset.process;
    let currentSelectedProcesses = [...this.data.formData.processArray];
    const index = currentSelectedProcesses.indexOf(processName);

    if (index > -1) {
      currentSelectedProcesses.splice(index, 1);
    } else {
      currentSelectedProcesses.push(processName);
    }

    const newFormData = {
      ...this.data.formData,
      processArray: currentSelectedProcesses
    };

    this.setData({
      formData: newFormData
    }, () => {
      this._updateDisplayableOptions('processes');
    });
    console.log('Updated formData.processArray:', this.data.formData.processArray);
  },

  // 新增：用于从弹窗主界面的标签上移除已选颜色
  removeColorTagFromModal: function(e) {
    const colorNameToRemove = e.currentTarget.dataset.colorName;
    let currentSelectedColors = [...this.data.formData.colorArray];
    const index = currentSelectedColors.indexOf(colorNameToRemove);

    if (index > -1) {
      currentSelectedColors.splice(index, 1);
      const newFormData = {
        ...this.data.formData,
        colorArray: currentSelectedColors
      };
      this.setData({
        formData: newFormData
      }, () => {
        // 当从主弹窗移除标签时，也需要同步更新颜色选择器弹窗内的选中状态
        this._updateDisplayableOptions('colors'); 
      });
      console.log('Removed color from modal tag:', colorNameToRemove, 'New colorArray:', this.data.formData.colorArray);
    }
  },

  // 新增：用于从弹窗主界面的标签上移除已选尺码
  removeSizeTagFromModal: function(e) {
    const sizeNameToRemove = e.currentTarget.dataset.sizeName;
    let currentSelectedSizes = [...this.data.formData.sizeArray];
    const index = currentSelectedSizes.indexOf(sizeNameToRemove);

    if (index > -1) {
      currentSelectedSizes.splice(index, 1);
      const newFormData = {
        ...this.data.formData,
        sizeArray: currentSelectedSizes
      };
      this.setData({
        formData: newFormData
      }, () => {
        this._updateDisplayableOptions('sizes');
      });
      console.log('Removed size from modal tag:', sizeNameToRemove, 'New sizeArray:', this.data.formData.sizeArray);
    }
  },

  // 新增：用于从弹窗主界面的标签上移除已选工序
  removeProcessTagFromModal: function(e) {
    const processNameToRemove = e.currentTarget.dataset.processName;
    let currentSelectedProcesses = [...this.data.formData.processArray];
    const index = currentSelectedProcesses.indexOf(processNameToRemove);

    if (index > -1) {
      currentSelectedProcesses.splice(index, 1);
      const newFormData = {
        ...this.data.formData,
        processArray: currentSelectedProcesses
      };
      this.setData({
        formData: newFormData
      }, () => {
        this._updateDisplayableOptions('processes');
      });
      console.log('Removed process from modal tag:', processNameToRemove, 'New processArray:', this.data.formData.processArray);
    }
  },

  // 设置当前日期
  setCurrentDate: function() {
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
  formatDateFromDateTime: function(dateTimeString) {
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
})