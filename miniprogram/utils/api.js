/**
 * API请求工具
 * 替代原有云函数调用
 */

const app = getApp && typeof getApp === 'function' ? getApp() : null;
const appConfig = app && app.globalData && app.globalData.config ? app.globalData.config : {};

// 获取API基础URL
const getBaseUrl = () => {
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
  // 自动补充orgId参数（某些API除外，因为后端强制使用登录用户的orgId）
  const storedOrgId = wx.getStorageSync('orgId');
  const secureApis = ['/statement', '/factories/', '/payments'];
  const isSecureApi = secureApis.some(api => url.includes(api));
  
  if (storedOrgId && !isSecureApi) {
    // 确保orgId字段存在，用于API兼容性
    data.orgId = storedOrgId;
    console.log(`API请求自动添加组织ID: ${storedOrgId}`);
  } else if (isSecureApi) {
    console.log('安全API不添加orgId参数，后端会自动使用登录用户的orgId');
  } else {
    // 如果没有组织ID，记录警告但不阻止请求（某些公共接口可能不需要orgId）
    console.warn('API请求缺少组织ID，请检查登录状态');
  }
  
  const baseUrl = getBaseUrl();
  const fullUrl = `${baseUrl}${url}`;
  
  // 打印实际请求的URL和参数
  console.log('请求URL:', fullUrl);
  console.log('请求方法:', method);
  console.log('请求参数:', data);
  
  // 设置请求头
  const headers = options.headers || {};
  const token = wx.getStorageSync('token');
  
  // 添加授权Token和小程序标识
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  headers['x-from-miniprogram'] = 'true';
  
  return new Promise((resolve, reject) => {
    // 超时计时器
    let timeoutTimer;
    
    // 请求配置
    const requestConfig = {
      url: fullUrl,
      method: method,
      data: data,
      header: headers,
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
            error: (res.data && res.data.error) || (res.data && res.data.message) || '请求失败',
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

// 获取发出单详情
const getSendOrderDetail = (orderId) => {
  return request(`/send-orders/${orderId}`, 'GET')
}

// 获取收回单详情
const getReceiveOrderDetail = (orderId) => {
  return request(`/receive-orders/${orderId}`, 'GET')
}

// 获取工厂列表
const getFactories = () => {
  // 设置足够大的pageSize，确保获取所有工厂
  return request('/factories?pageSize=1000', 'GET')
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
const addOrderItemsBatch = (itemsArray) => {
  // 确保有有效的订单项
  if (!itemsArray || !itemsArray.length || !itemsArray[0].orderId) {
    console.error('订单项数据无效:', itemsArray);
    return Promise.reject(new Error('订单项数据无效'));
  }
  
  const orderId = itemsArray[0].orderId;
  console.log(`批量添加订单项 - 订单ID: ${orderId}, 项目数: ${itemsArray.length}`);
  
  // 使用 orderId 构建正确的 URL 路径，并将 itemsArray 包装在 { items: ... } 对象中
  return request(`/orders/${orderId}/items`, 'POST', { items: itemsArray });
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
  
  // 映射code字段到后端期望的格式
  if (cleanData.code && !cleanData.productNo) {
    cleanData.productNo = cleanData.code;
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
  } else if (cleanData.processes === undefined || cleanData.processes === null) {
    // 如果processes未定义，设置为空字符串
    cleanData.processes = '';
  }
  
  // 确保状态字段是数字
  if (cleanData.status !== undefined) {
    cleanData.status = cleanData.status ? 1 : 0;
  }
  
  // 映射code字段到后端期望的格式
  if (cleanData.code && !cleanData.productNo) {
    cleanData.productNo = cleanData.code;
  }
  
  // 传递特殊标记
  if (cleanData._forceUpdateImage) {
    cleanData._forceUpdateImage = true;
  }
  
  if (cleanData._forceUpdateProcesses) {
    cleanData._forceUpdateProcesses = true;
  }
  
  console.log('更新产品 - 发送数据:', cleanData);
  console.log('更新产品 - 工序数据:', cleanData.processes);
  
  return request(`/products/${productId}`, 'PUT', cleanData);
}

// 删除订单
const deleteOrder = (orderId, orderType) => {
  return request(`/orders/${orderId}`, 'DELETE', { type: orderType });
}

// 新增发出单（主表+明细一体化写入）
const addSendOrder = (orderData) => {
  // 字段映射，只保留数据库实际字段
  const mappedData = {
    orgId: orderData.orgId,
    factory_id: orderData.factory_id || orderData.factoryId, // 兼容旧字段
    process_id: orderData.process_id || orderData.processId || 0, // 只传下划线风格
    process: orderData.process, // 工序名称
    total_weight: orderData.total_weight || orderData.totalWeight,
    total_quantity: orderData.total_quantity || orderData.totalQuantity,
    total_fee: orderData.total_fee || orderData.totalFee, // 前端需计算好总工费
    remark: orderData.remark,
    remarkImages: orderData.remarkImages || [], // 添加备注照片字段
    status: orderData.status || 1,
    items: orderData.items // 明细数组，字段全部下划线风格
  };
  // 移除多余字段
  delete mappedData.processId;
  delete mappedData.factoryId;
  // 增加日志，帮助调试
  console.log('提交发出单数据:', mappedData);
  if (orderData.created_at) mappedData.created_at = orderData.created_at;
  return request('/send-orders', 'POST', mappedData);
};

// 新增收回单（主表+明细一体化写入）
const addReceiveOrder = (orderData) => {
  // 只转换主表字段为驼峰，明细items保持下划线风格
  function toCamelCase(str) {
    return str.replace(/_([a-z])/g, (m, p1) => p1.toUpperCase());
  }
  function convertKeysToCamel(obj) {
    if (Array.isArray(obj)) {
      return obj.map(convertKeysToCamel);
    } else if (obj && typeof obj === 'object') {
      const newObj = {};
      Object.keys(obj).forEach(key => {
        const camelKey = toCamelCase(key);
        newObj[camelKey] = convertKeysToCamel(obj[key]);
      });
      return newObj;
    }
    return obj;
  }
  // 只处理主表字段
  const { items, ...mainData } = orderData;
  const camelMain = convertKeysToCamel(mainData);
  // items保持原样（下划线风格）
  camelMain.items = items;
  // 日志
  console.log('提交收回单数据(主表驼峰, 明细下划线):', camelMain);
  return request('/receive-orders', 'POST', camelMain);
};

// 获取流水表数据
const getFlowTable = (params) => {
  console.log('[api.js] getFlowTable called with params:', params);
  // 使用新的流水记录接口
  return request('/flow-records', 'GET', params);
}

// 获取流水记录统计数据
const getFlowStats = (params) => {
  console.log('[api.js] getFlowStats called with params:', params);
  return request('/flow-records/stats', 'GET', params);
}

// 获取异常流水记录
const getFlowAnomalies = (params) => {
  console.log('[api.js] getFlowAnomalies called with params:', params);
  return request('/flow-records/anomalies', 'GET', params);
}

// 上传文件
const uploadFile = (path, filePath) => {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl();
    const fullUrl = `${baseUrl}${path}`;
    const orgId = wx.getStorageSync('orgId');
    const token = wx.getStorageSync('token');
    
    console.log('[uploadFile] 开始上传图片，路径:', filePath);
    console.log('[uploadFile] 上传URL:', fullUrl);
    console.log('[uploadFile] 使用token:', token ? token.substring(0, 10) + '...' : '无');

    wx.uploadFile({
      url: fullUrl,
      filePath: filePath,
      name: 'file',
      formData: {
        orgId: orgId  // 使用统一的orgId字段
      },
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        'x-from-miniprogram': 'true'
      },
      success: (res) => {
        console.log('[uploadFile] 上传响应状态码:', res.statusCode);
        let responseData;

        try {
          // wx.uploadFile 的结果中 res.data 是字符串，需要解析
          responseData = JSON.parse(res.data);
          console.log('[uploadFile] 解析后的响应数据:', responseData);
        } catch (error) {
          console.error('[uploadFile] 解析响应数据失败:', error, '原始数据:', res.data);
          return reject({
            error: '服务器响应格式错误',
            detail: error,
            originalData: res.data
          });
        }

        if (res.statusCode === 200 || res.statusCode === 201) {
          // 处理不同的响应格式，尝试找到文件路径
          if (responseData.success === true) {
            // 标准格式：{success: true, data: {filePath: '/uploads/xxx.jpg'}}
            if (responseData.data && responseData.data.filePath) {
              resolve({
                success: true,
                data: {
                  filePath: responseData.data.filePath
                }
              });
            } 
            // 其他格式：{success: true, data: {url: '/uploads/xxx.jpg'}} 或 {success: true, url: '/uploads/xxx.jpg'}
            else if ((responseData.data && responseData.data.url) || responseData.url || responseData.path || 
                     (responseData.data && (responseData.data.path || responseData.data.file))) {
              const filePath = (responseData.data && responseData.data.url) || 
                              responseData.url || 
                              responseData.path || 
                              (responseData.data && responseData.data.path) || 
                              (responseData.data && responseData.data.file);
              resolve({
                success: true,
                data: {
                  filePath: filePath
                }
              });
            } else {
              // 找不到具体路径，返回整个响应
              resolve(responseData);
            }
          } else if (responseData.code === 0 || responseData.code === 200) {
            // 使用code表示成功的格式
            resolve({
              success: true,
              data: {
                filePath: responseData.data && responseData.data.filePath || 
                          responseData.data && responseData.data.url || 
                          responseData.url || ''
              }
            });
          } else {
            // 其他情况，可能是失败或格式不标准
            console.warn('[uploadFile] 非标准成功响应:', responseData);
            resolve(responseData);
          }
        } else {
          // 处理错误状态码
          console.error('[uploadFile] 上传失败，状态码:', res.statusCode);
          reject({
            error: responseData.message || '上传失败',
            statusCode: res.statusCode,
            response: responseData
          });
        }
      },
      fail: (err) => {
        console.error('[uploadFile] 请求失败:', err);
        reject({
          error: '网络请求失败',
          detail: err
        });
      }
    });
  });
};

// 获取详细的流水记录（按时间顺序的明细）
const getDetailedFlowRecords = (params = {}) => {
  console.log('[api.js] getDetailedFlowRecords called with params:', params);
  return request('/flow-records/detailed', 'GET', params);
};

// 获取损耗率排行榜数据
const getLossRanking = (params = {}) => {
  console.log('[api.js] getLossRanking called with params:', params);
  return request('/ai-reports/loss-ranking', 'GET', params);
};

// 获取活跃排行数据
const getActiveRankings = (params = {}) => {
  console.log('[api.js] getActiveRankings called with params:', params);
  return request('/ai-reports/active-rankings', 'GET', params);
};

// 删除收回单
const deleteReceiveOrder = (orderId) => {
  return request(`/receive-orders/${orderId}`, 'DELETE');
}

module.exports = {
  request,
  getBaseUrl,
  getOrders,
  getStats,
  updateOrderStatus,
  addOrder,
  addReceiveOrder,
  getOrderDetail,
  getSendOrderDetail,
  getReceiveOrderDetail,
  getFactories,
  getProducts,
  getProcesses,
  clearProducts,
  clearProcesses,
  addOrderItemsBatch,
  getProductDetail,
  addProduct,
  updateProduct,
  deleteOrder,
  deleteReceiveOrder,
  uploadFile,
  addSendOrder,
  getFlowTable,
  getFlowStats,
  getFlowAnomalies,
  getDetailedFlowRecords,
  getLossRanking,
  getActiveRankings
} 