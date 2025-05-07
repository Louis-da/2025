/**
 * API请求工具
 * 替代原有云函数调用
 */

const app = getApp()

// 获取API基础URL
const getBaseUrl = () => {
  // 获取全局配置
  const appConfig = getApp()?.globalData?.config || {};
  
  // 开发环境可以通过config设置API地址
  if (appConfig.apiBaseUrl) {
    console.log('使用配置的API地址:', appConfig.apiBaseUrl);
    return appConfig.apiBaseUrl;
  }
  
  // 默认返回正式环境地址
  return 'https://aiyunsf.com/api';
}

// 通用请求方法
const request = (url, method, data = {}, options = {}) => {
  // 自动补充orgId参数
  if (!data.orgId) {
    data.orgId = wx.getStorageSync('orgId') || 'org1';
  }
  
  const baseUrl = getBaseUrl();
  const fullUrl = `${baseUrl}${url}`;
  
  // 打印实际请求的URL和参数
  console.log('请求URL:', fullUrl);
  console.log('请求方法:', method);
  console.log('请求参数:', data);
  
  return new Promise((resolve, reject) => {
    // 超时计时器
    let timeoutTimer;
    
    // 请求配置
    const requestConfig = {
      url: fullUrl,
      method: method,
      data: data,
      header: {
        'content-type': 'application/json',
        'Authorization': wx.getStorageSync('token') || ''
      },
      timeout: options.timeout || 30000, // 默认30秒超时
      success: res => {
        // 清除超时计时器
        if (timeoutTimer) clearTimeout(timeoutTimer);
        
        console.log('API响应状态码:', res.statusCode);
        console.log('API响应数据:', res.data);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          // 处理服务器返回的不同格式数据
          if (typeof res.data === 'object') {
            // 如果服务器返回的是成功格式的对象
            if (res.data.success === true || res.data.code === 0 || res.data.code === 200) {
              resolve(res.data);
            } 
            // 如果直接返回了数据数组或对象，没有包装
            else if (Array.isArray(res.data) || (res.data && !res.data.error && !res.data.message && res.data.success !== false)) {
              resolve(res.data);
            } 
            // 如果服务器明确返回了失败
            else if (res.data.success === false || res.data.code === -1 || res.data.error) {
              const errorMsg = res.data.message || res.data.error || '服务器返回错误';
              console.error('API响应错误:', errorMsg);
              reject({
                error: errorMsg,
                statusCode: res.statusCode,
                response: res.data
              });
            } else {
              // 不确定的格式，但状态码正常，尝试返回
              resolve(res.data);
            }
          } else {
            // 不是对象格式，可能是字符串或其他
            resolve(res.data);
          }
        } else {
          // 处理错误状态码
          console.error('API错误:', res.statusCode, res.data);
          reject({
            error: res.data?.error || res.data?.message || '请求失败',
            statusCode: res.statusCode,
            response: res.data
          });
        }
      },
      fail: err => {
        // 清除超时计时器
        if (timeoutTimer) clearTimeout(timeoutTimer);
        
        console.error('请求失败:', err);
        
        // 处理不同类型的错误
        let errorMessage = '网络请求失败';
        if (err.errMsg) {
          if (err.errMsg.indexOf('timeout') > -1) {
            errorMessage = '请求超时，请检查网络';
          } else if (err.errMsg.indexOf('fail') > -1) {
            errorMessage = '网络连接失败，请检查网络设置';
          }
        }
        
        reject({
          error: errorMessage,
          detail: err,
          url: fullUrl
        });
      }
    };
    
    // 附加额外选项
    if (options.filePath) {
      requestConfig.filePath = options.filePath;
    }
    
    // 设置超时处理
    if (options.timeout !== 0) { // 如果timeout为0则禁用超时
      timeoutTimer = setTimeout(() => {
        timeoutTimer = null;
        reject({
          error: '请求超时',
          url: fullUrl
        });
      }, options.timeout || 30000); // 默认30秒
    }
    
    // 发起请求
    wx.request(requestConfig);
  });
}

// 获取订单列表
const getOrders = (params) => {
  return request('/orders', 'GET', params)
}

// 获取统计数据
const getStats = (params) => {
  return request('/stats', 'GET', params)
}

// 更新订单状态
const updateOrderStatus = (orderId, status) => {
  return request(`/orders/${orderId}/status`, 'PUT', { status })
}

// 添加订单 - 只清理无关字段，不做orderType/type转换
const addOrder = (orderData) => {
  const cleanData = { ...orderData };
  // 只移除与数据库不匹配的字段
  delete cleanData.remarkPhotos;
  delete cleanData.remarkImages;
  
  // 确保orderType字段存在且有效
  if (!cleanData.orderType || (cleanData.orderType !== 'send' && cleanData.orderType !== 'receive')) {
    // 如果orderType无效，根据其他字段猜测
    if (cleanData.type && (cleanData.type === 'send' || cleanData.type === 'receive')) {
      cleanData.orderType = cleanData.type;
    } else {
      // 默认值，防止API请求失败
      cleanData.orderType = 'send'; 
    }
    console.log('固定orderType字段为:', cleanData.orderType);
  }
  
  // 记录最终请求数据
  console.log('发送订单数据:', cleanData);
  
  return request('/orders', 'POST', cleanData);
}

// 获取订单详情
const getOrderDetail = (orderId) => {
  return request(`/orders/${orderId}`, 'GET')
}

// 获取工厂列表
const getFactories = () => {
  return request('/factories', 'GET')
}

// 获取产品列表
const getProducts = () => {
  return request('/products', 'GET')
}

// 获取工序列表
const getProcesses = () => {
  return request('/processes', 'GET')
}

// 清除指定组织的所有产品
const clearProducts = (orgId) => {
  return request(`/products/org/${orgId}`, 'DELETE')
}

// 清除指定组织的所有工序
const clearProcesses = (orgId) => {
  return request(`/processes/org/${orgId}`, 'DELETE')
}

// 新增：批量插入订单明细
const addOrderItemsBatch = (items) => {
  return request('/order_items/batch', 'POST', items);
};

// 获取产品详情
const getProductDetail = (productId) => {
  return request(`/products/${productId}`, 'GET');
}

// 添加产品
const addProduct = (productData) => {
  // 清理和转换数据
  const cleanData = { ...productData };
  
  // 确保颜色、尺码和工序数据是字符串格式
  if (Array.isArray(cleanData.colors)) {
    cleanData.colors = cleanData.colors.join(',');
  }
  
  if (Array.isArray(cleanData.sizes)) {
    cleanData.sizes = cleanData.sizes.join(',');
  }
  
  if (Array.isArray(cleanData.processes)) {
    cleanData.processes = cleanData.processes.join(',');
  }
  
  // 确保状态字段是数字
  if (cleanData.status !== undefined) {
    cleanData.status = cleanData.status ? 1 : 0;
  }
  
  console.log('添加产品 - 发送数据:', cleanData);
  return request('/products', 'POST', cleanData);
}

// 更新产品
const updateProduct = (productId, productData) => {
  // 清理和转换数据
  const cleanData = { ...productData };
  
  // 确保颜色、尺码和工序数据是字符串格式
  if (Array.isArray(cleanData.colors)) {
    cleanData.colors = cleanData.colors.join(',');
  }
  
  if (Array.isArray(cleanData.sizes)) {
    cleanData.sizes = cleanData.sizes.join(',');
  }
  
  if (Array.isArray(cleanData.processes)) {
    cleanData.processes = cleanData.processes.join(',');
  }
  
  // 确保状态字段是数字
  if (cleanData.status !== undefined) {
    cleanData.status = cleanData.status ? 1 : 0;
  }
  
  console.log('更新产品 - 发送数据:', cleanData);
  return request(`/products/${productId}`, 'PUT', cleanData);
}

module.exports = {
  request,
  getOrders,
  getStats,
  updateOrderStatus,
  addOrder,
  getOrderDetail,
  getFactories,
  getProducts,
  getProcesses,
  clearProducts,
  clearProcesses,
  addOrderItemsBatch,
  getProductDetail,
  addProduct,
  updateProduct
} 