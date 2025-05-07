const app = getApp();
const api = require('../../utils/api');
const { getFullImageUrl } = require('../../utils/image');
try {
  // 尝试导入util模块，如果失败，使用内部定义的函数
  const { showToast, showLoading, hideLoading } = require('../../utils/util');
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

// 使用本地函数或导入的函数
const toast = typeof showToast !== 'undefined' ? showToast : localShowToast;
const loading = typeof showLoading !== 'undefined' ? showLoading : localShowLoading;
const hideLoad = typeof hideLoading !== 'undefined' ? hideLoading : localHideLoading;

Page({
  data: {
    product: {
      productNo: '',
      name: '',
      colors: '',
      sizes: '',
      processes: '',
      status: true,
      remark: '',
      createDate: ''
    },
    // 数组形式存储颜色、尺码和工序，便于多选显示
    colorArray: [],
    sizeArray: [],
    processArray: [],
    tempImageUrl: '',
    tempFilePath: '',
    isEdit: false,
    productId: '',
    existingProductNos: [],
    processesData: [], // 新增：存储从API获取的工序数据
    allColors: [], // 新增：存储从API获取的颜色数据
    allSizes: [] // 新增：存储从API获取的尺码数据
  },

  onLoad: function(options) {
    console.log('add-product onLoad', options);
    // 设置默认创建日期为今天
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const dateStr = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
    
    this.setData({
      'product.createDate': dateStr
    });
    
    // 获取已存在的货号列表用于唯一性验证
    this.getExistingProductNos();
    
    // 如果有productId参数，表示是编辑模式
    if (options && options.id) {
      this.setData({
        isEdit: true,
        productId: options.id
      });
      this.loadProductData();
    } else {
      // 新增模式下不再自动填充任何假数据，全部留空，用户手动输入
      this.setData({
        colorArray: [],
        sizeArray: [],
        processArray: [],
        'product.colors': '',
        'product.sizes': '',
        'product.processes': '',
        'product.productNo': '',
        'product.name': '',
        'product.remark': '',
        'product.status': true,
        tempImageUrl: '',
        tempFilePath: ''
      });
    }
    
    // 初始化颜色、尺码和工序数据
    this.loadBaseData();
    
    // 获取真实工序数据
    this.fetchProcesses();
  },
  
  onShow: function() {
    console.log('add-product onShow');
    // 加载颜色和尺码数据
    this.fetchColors();
    this.fetchSizes();
  },
  
  // 加载基础数据（颜色、尺码、工序等）
  loadBaseData: function() {
    // 从API加载基础数据
    console.log('加载基础数据');
    this.fetchColors();
    this.fetchSizes();
  },

  // 获取颜色数据
  fetchColors: function() {
    const app = getApp();
    const orgId = wx.getStorageSync('orgId') || 'org1';
    const defaultColors = [];
    const apiEndpoint = '/api/colors';
    const apiUrl = app.getAPIUrl(apiEndpoint);
    if (!apiUrl) {
      this.setData({ allColors: defaultColors });
      return;
    }
    api.request('/colors', 'GET', { orgId })
      .then(res => {
        let colorList = [];
        if (Array.isArray(res)) {
          colorList = res;
        } else if (res && Array.isArray(res.data)) {
          colorList = res.data;
        }
        const activeColors = colorList.filter(item => item.status === 1);
        this.setData({ allColors: activeColors });
      })
      .catch(err => {
        console.error('获取颜色数据请求失败', err);
        this.setData({ allColors: defaultColors });
      });
  },
  
  // 获取尺码数据
  fetchSizes: function() {
    const app = getApp();
    const orgId = wx.getStorageSync('orgId') || 'org1';
    const defaultSizes = [];
    const apiEndpoint = '/api/sizes';
    const apiUrl = app.getAPIUrl(apiEndpoint);
    if (!apiUrl) {
      this.setData({ allSizes: defaultSizes });
      return;
    }
    api.request('/sizes', 'GET', { orgId })
      .then(res => {
        let sizeList = [];
        if (Array.isArray(res)) {
          sizeList = res;
        } else if (res && Array.isArray(res.data)) {
          sizeList = res.data;
        }
        const activeSizes = sizeList.filter(item => item.status === 1);
        this.setData({ allSizes: activeSizes });
      })
      .catch(err => {
        console.error('获取尺码数据请求失败', err);
        this.setData({ allSizes: defaultSizes });
      });
  },

  /**
   * 加载产品数据（编辑模式）
   */
  loadProductData: function() {
    const { productId } = this.data;
    if (!productId) return;
    loading('加载中');
    const defaultProduct = {
      id: productId,
      productNo: '',
      name: '',
      colors: '',
      sizes: '',
      processes: '',
      status: true,
      remark: '',
      createDate: this.data.product.createDate,
      imageUrl: ''
    };
    api.getProductDetail(productId)
      .then(res => {
        const product = res.data || res;
        if (!product || !product.id) {
          throw new Error('获取产品详情失败');
        }
        // 回显字段映射
        const status = product.status === 1 || product.status === true || product.status === 'true';
        const fullImageUrl = getFullImageUrl(product.image);
        this.setData({
          product: {
            ...product,
            status: status,
            imageUrl: product.image,
            productNoOrigin: product.code,
            productNo: product.code,
            remark: product.description || ''
          },
          colorArray: product.colors ? product.colors.split(',') : [],
          sizeArray: product.sizes ? product.sizes.split(',') : [],
          processArray: product.processes ? product.processes.split(',') : [],
          tempImageUrl: fullImageUrl
        });
      })
      .catch(err => {
        this.setData({
          product: defaultProduct,
          colorArray: [],
          sizeArray: [],
          processArray: [],
          tempImageUrl: ''
        });
        toast('获取产品数据失败，已载入默认数据');
      })
      .finally(() => {
        hideLoad();
      });
  },

  // 处理输入变化
  onInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`product.${field}`]: value
    });
  },
  
  // 处理日期选择变化
  onDateChange: function(e) {
    this.setData({
      'product.createDate': e.detail.value
    });
  },

  // 处理状态开关变化
  onStatusChange: function(e) {
    this.setData({
      'product.status': e.detail.value
    });
  },
  
  // 显示颜色选择器
  showColorSelector: function() {
    // 从API获取的颜色数据
    const colors = this.data.allColors || [];
    const allColors = colors.map(c => c.name).filter(name => name !== '');
    const selectedColors = this.data.colorArray;
    
    // 如果API未返回数据，提示用户
    if (allColors.length === 0) {
      toast('未获取到颜色数据');
      return;
    }
    
    // 过滤掉已选择的颜色
    const availableColors = allColors.filter(color => !selectedColors.includes(color));
    
    if (availableColors.length === 0) {
      toast('没有更多可选颜色');
      return;
    }
    
    wx.showActionSheet({
      itemList: availableColors,
      success: (res) => {
        if (!res.cancel) {
          const selectedColor = availableColors[res.tapIndex];
          const newColorArray = [...selectedColors, selectedColor];
          
          this.setData({
            colorArray: newColorArray,
            'product.colors': newColorArray.join(',')
          });
        }
      }
    });
  },
  
  // 移除颜色
  removeColor: function(e) {
    const index = e.currentTarget.dataset.index;
    const colorArray = this.data.colorArray;
    colorArray.splice(index, 1);
    
    this.setData({
      colorArray,
      'product.colors': colorArray.join(',')
    });
  },
  
  // 显示尺码选择器
  showSizeSelector: function() {
    // 从API获取的尺码数据
    const sizes = this.data.allSizes || [];
    const allSizes = sizes.map(s => s.name).filter(name => name !== '');
    const selectedSizes = this.data.sizeArray;
    
    // 如果API未返回数据，提示用户
    if (allSizes.length === 0) {
      toast('未获取到尺码数据');
      return;
    }
    
    // 过滤掉已选择的尺码
    const availableSizes = allSizes.filter(size => !selectedSizes.includes(size));
    
    if (availableSizes.length === 0) {
      toast('没有更多可选尺码');
      return;
    }
    
    wx.showActionSheet({
      itemList: availableSizes,
      success: (res) => {
        if (!res.cancel) {
          const selectedSize = availableSizes[res.tapIndex];
          const newSizeArray = [...selectedSizes, selectedSize];
          
          this.setData({
            sizeArray: newSizeArray,
            'product.sizes': newSizeArray.join(',')
          });
        }
      }
    });
  },
  
  // 移除尺码
  removeSize: function(e) {
    const index = e.currentTarget.dataset.index;
    const sizeArray = this.data.sizeArray;
    sizeArray.splice(index, 1);
    
    this.setData({
      sizeArray,
      'product.sizes': sizeArray.join(',')
    });
  },
  
  // 获取工序数据
  fetchProcesses: function() {
    const app = getApp();
    const orgId = wx.getStorageSync('orgId') || 'org1';
    const defaultProcesses = [];
    const apiEndpoint = '/api/processes';
    const apiUrl = app.getAPIUrl(apiEndpoint);
    if (!apiUrl) {
      this.setData({ processesData: defaultProcesses });
      return;
    }
    api.request('/processes', 'GET', { orgId })
      .then(res => {
        let processList = [];
        if (Array.isArray(res)) {
          processList = res;
        } else if (res && Array.isArray(res.data)) {
          processList = res.data;
        }
        // 只用真实API数据，不再用默认工序
        if (processList.length > 0) {
          // 排序处理
          const sortedData = processList.sort((a, b) => {
            const orderA = a.sort_order !== undefined ? a.sort_order : 999;
            const orderB = b.sort_order !== undefined ? b.sort_order : 999;
            return orderA - orderB;
          });
          this.setData({ processesData: sortedData });
        } else {
          this.setData({ processesData: [] });
        }
      })
      .catch(err => {
        console.error('获取工序数据请求失败', err);
        this.setData({ processesData: defaultProcesses });
      });
  },
  
  // 显示工序选择器
  showProcessSelector: function() {
    // 从API获取的工序数据中提取名称列表
    const processes = this.data.processesData || [];
    const allProcesses = processes.map(p => {
      // 兼容不同的API返回格式，优先使用processName，其次使用name
      return p.processName || p.name || '';
    }).filter(name => name !== ''); // 过滤掉空名称
    
    const selectedProcesses = this.data.processArray;
    
    // 如果API未返回数据，提示用户
    if (allProcesses.length === 0) {
      toast('未获取到工序数据');
      return;
    }
    
    // 过滤掉已选择的工序
    const availableProcesses = allProcesses.filter(process => !selectedProcesses.includes(process));
    
    if (availableProcesses.length === 0) {
      toast('没有更多可选工序');
      return;
    }
    
    wx.showActionSheet({
      itemList: availableProcesses,
      success: (res) => {
        if (!res.cancel) {
          const selectedProcess = availableProcesses[res.tapIndex];
          const newProcessArray = [...selectedProcesses, selectedProcess];
          
          this.setData({
            processArray: newProcessArray,
            'product.processes': newProcessArray.join(',')
          });
        }
      }
    });
  },
  
  // 移除工序
  removeProcess: function(e) {
    const index = e.currentTarget.dataset.index;
    const processArray = this.data.processArray;
    processArray.splice(index, 1);
    
    this.setData({
      processArray,
      'product.processes': processArray.join(',')
    });
  },

  // 选择图片
  onChooseImage: function() {
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照'],
      success: (res) => {
        if (res.tapIndex === 0 || res.tapIndex === 1) {
          const sourceType = res.tapIndex === 0 ? ['album'] : ['camera'];
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
            sourceType: sourceType,
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
              wx.compressImage({
                src: tempFilePath,
                quality: 70,
                success: (compressRes) => {
                  this.setData({
                    tempImageUrl: compressRes.tempFilePath,
                    tempFilePath: compressRes.tempFilePath
                  });
                },
                fail: (err) => {
        this.setData({
          tempImageUrl: tempFilePath,
          tempFilePath: tempFilePath
        });
                }
              });
            }
          });
        }
      }
    });
  },

  // 上传图片到云存储
  uploadImage: function() {
    return new Promise((resolve, reject) => {
      if (!this.data.tempFilePath) {
        console.log('没有选择图片，tempFilePath为空');
        if (this.data.isEdit && this.data.product.imageUrl) {
          resolve(this.data.product.imageUrl);
        } else {
          resolve('');
        }
        return;
      }
      loading('上传图片中');
      wx.uploadFile({
        url: 'https://aiyunsf.com/api/upload',
        filePath: this.data.tempFilePath,
        name: 'file',
        formData: {
          'type': 'product',
          'orgId': wx.getStorageSync('orgId') || 'org1'
        },
        header: {
          'Authorization': wx.getStorageSync('token') || '',
          'content-type': 'multipart/form-data'
        },
        success: (res) => {
          try {
            if (res.statusCode === 200 || res.statusCode === 201) {
              const data = typeof res.data === 'object' ? res.data : JSON.parse(res.data);
              const imageUrl = data.url || data.imageUrl || (data.data && data.data.url);
              console.log('图片上传返回:', res);
              console.log('解析后的imageUrl:', imageUrl);
              if (imageUrl) {
                resolve(imageUrl);
              } else {
                toast('图片上传失败，请稍后重试');
                resolve('');
              }
            } else {
              toast('图片上传失败，请稍后重试');
              resolve('');
            }
          } catch (err) {
            toast('图片处理失败，请稍后重试');
            resolve('');
          }
        },
        fail: (err) => {
          toast('网络错误，图片上传失败');
          resolve('');
        },
        complete: () => {
          hideLoad();
        }
        });
    });
  },

  // 获取已存在的货号列表
  getExistingProductNos: function() {
    // 使用真实API获取产品列表
    api.request('/products', 'GET')
      .then(res => {
        const existingProductNos = res.map(item => item.productNo);
        this.setData({ existingProductNos: existingProductNos });
      })
      .catch(err => {
        console.error('获取产品列表失败', err);
        this.setData({ existingProductNos: [] });
      });
  },

  // 检查货号是否唯一（本地校验+接口二次校验）
  async checkProductNoUniqueAsync(productNo) {
    // 本地已加载的货号校验
    if (this.data.existingProductNos && this.data.existingProductNos.includes(productNo)) {
      return false;
    }
    // 远程接口二次校验（防止并发）
    try {
      const res = await api.request('/products', 'GET', { productNo });
      if (Array.isArray(res.data) && res.data.length > 0) {
        // 已存在同名货号
        return false;
      }
    } catch (e) {
      // 网络异常时只依赖本地校验
      console.warn('远程校验货号唯一性失败:', e);
    }
    return true;
  },

  // 强制校验所有关键字段必须真实有效
  validateStrongForm: function() {
    const { productNo, name } = this.data.product;
    const colorArray = this.data.colorArray;
    const sizeArray = this.data.sizeArray;
    const processArray = this.data.processArray;
    // 货号、名称不能为空
    if (!productNo || !productNo.trim()) {
      toast('货号不能为空');
      return false;
    }
    if (!name || !name.trim()) {
      toast('名称不能为空');
      return false;
    }
    // 颜色、尺码、工序必须有数据
    if (!Array.isArray(colorArray) || colorArray.length === 0) {
      toast('请添加颜色');
      return false;
    }
    if (!Array.isArray(sizeArray) || sizeArray.length === 0) {
      toast('请添加尺码');
      return false;
    }
    if (!Array.isArray(processArray) || processArray.length === 0) {
      toast('请添加工序');
      return false;
    }
    return true;
  },

  // 保存产品
  onSave: async function() {
    // 强逻辑校验，所有字段必须真实有效
    if (!this.validateStrongForm()) {
      return;
    }
    // 前端强校验货号
    const productNo = (this.data.product.productNo || '').trim();
    if (!productNo) {
      toast('货号不能为空');
      return;
    }
    // 新增时校验唯一性，编辑时如果货号有变也校验
    if (!this.data.isEdit || (this.data.isEdit && productNo !== (this.data.product.productNoOrigin || ''))) {
      const unique = await this.checkProductNoUniqueAsync(productNo);
      if (!unique) {
        toast('该货号已存在，请使用其他货号');
        return;
      }
    }
    
    loading('保存中');
    
    try {
      // 上传图片（如果有）
      const imageUrl = await this.uploadImage();
      // 只保留相对路径
      let imagePath = imageUrl;
      if (imagePath && imagePath.startsWith('https://aiyunsf.com')) {
        imagePath = imagePath.replace('https://aiyunsf.com', '');
      }
      // 构造与数据库一致的字段
      const productData = {
        name: this.data.product.name,
        code: productNo,
        description: this.data.product.remark || '',
        category: this.data.product.category || '',
        orgId: wx.getStorageSync('orgId') || 'org1',
        colors: Array.isArray(this.data.colorArray) ? this.data.colorArray.join(',') : '',
        sizes: Array.isArray(this.data.sizeArray) ? this.data.sizeArray.join(',') : '',
        processes: Array.isArray(this.data.processArray) ? this.data.processArray.join(',') : '',
        status: this.data.product.status ? 1 : 0,
        image: imagePath || this.data.product.imageUrl || ''
      };
      if (this.data.isEdit) {
        if (!this.data.productId) {
          throw new Error('缺少产品ID，无法更新');
        }
        productData.id = this.data.productId;
        api.request(`/products/${this.data.productId}`, 'PUT', productData)
          .then(res => {
            hideLoad();
            toast('更新成功', 'success');
            wx.setStorageSync('productListChanged', true);
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          })
          .catch(err => {
            hideLoad();
            toast('更新失败，请检查网络');
          });
      } else {
        api.request('/products', 'POST', productData)
          .then(res => {
            hideLoad();
            toast('添加成功', 'success');
            wx.setStorageSync('productListChanged', true);
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          })
          .catch(err => {
            hideLoad();
            toast('添加失败，请检查网络');
          });
      }
    } catch (error) {
      hideLoad();
      toast('保存失败: ' + (error.message || '请重试'));
    }
  },

  // 取消
  onCancel: function() {
    // 返回上一页
    wx.navigateBack();
  }
}); 