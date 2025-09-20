/**
 * API请求工具
 * 替代原有云函数调用
 */

const app = getApp && typeof getApp === 'function' ? getApp() : null;
const appConfig = app && app.globalData && app.globalData.config ? app.globalData.config : {};
// 新增：集中读取 ENV_ID，默认回退到历史值
const { envList } = require('../envList');
const DEFAULT_ENV_ID = 'cloud1-3gwlq66232d160ab';
const ENV_ID = (envList && envList[0] && envList[0].envId) || DEFAULT_ENV_ID;
const cloudRequest = require('./cloudRequest');



// 通用请求方法
const request = (url, method, data = {}, options = {}) => {
  // 优先使用云函数调用
  return cloudFunctionRequest(url, method, data, options);
}

// 云函数请求函数 - 用于替代 HTTP 请求避免网关拦截
const cloudFunctionRequest = async (url, method, data = {}, options = {}) => {
  // 根据 URL 路径映射到对应的云函数和 action
  const pathMapping = {
    '/products': { cloudFunction: 'api', action: method === 'GET' ? 'getProducts' : 'addProduct' },
    '/products/stats': { cloudFunction: 'api', action: 'getProductStats' },
    '/colors': { cloudFunction: 'api', action: method === 'GET' ? 'getColors' : 'addColor' },
    '/sizes': { cloudFunction: 'api', action: method === 'GET' ? 'getSizes' : 'addSize' },
    '/processes': { cloudFunction: 'api', action: method === 'GET' ? 'getProcesses' : 'addProcess' },
    '/factories': { cloudFunction: 'api', action: method === 'GET' ? 'getFactories' : 'addFactory' },
    '/factories/stats': { cloudFunction: 'api', action: 'getFactoryStats' },
    '/statement': { cloudFunction: 'api', action: 'getStatement' },
    '/orders': { cloudFunction: 'api', action: method === 'GET' ? 'getOrders' : 'addOrder' },
    '/stats': { cloudFunction: 'api', action: 'getStats' },
    '/send-orders': { cloudFunction: 'api', action: 'addSendOrder' },
    '/receive-orders': { cloudFunction: 'api', action: 'addReceiveOrder' },
    '/flow-records': { cloudFunction: 'api', action: 'getFlowRecords' },
    '/flow-records/stats': { cloudFunction: 'api', action: 'getFlowStats' },
    '/flow-records/anomalies': { cloudFunction: 'api', action: 'getFlowAnomalies' },
    '/flow-records/detailed': { cloudFunction: 'api', action: 'getDetailedFlowRecords' }
  };

  // 处理带查询参数的 URL 和动态路径参数
  let cleanUrl = url.split('?')[0];
  let mapping = pathMapping[cleanUrl];
  
  // 处理动态路径，如 /factories/{id}、/factories/{id}/accounts 等
  if (!mapping) {
    // 匹配 /factories/{id} 模式
    if (cleanUrl.match(/^\/factories\/[^/]+$/)) {
      mapping = { cloudFunction: 'api', action: method === 'GET' ? 'getFactory' : method === 'PUT' ? 'updateFactory' : 'deleteFactory' };
      // 提取factoryId
      const factoryId = cleanUrl.split('/')[2];
      data.factoryId = factoryId;
    }
    // 匹配 /factories/{id}/accounts 模式
    else if (cleanUrl.match(/^\/factories\/[^/]+\/accounts$/)) {
      mapping = { cloudFunction: 'api', action: 'getFactoryAccounts' };
      const factoryId = cleanUrl.split('/')[2];
      data.factoryId = factoryId;
    }
    // 匹配 /factories/{id}/payments 模式
    else if (cleanUrl.match(/^\/factories\/[^/]+\/payments$/)) {
      mapping = { cloudFunction: 'api', action: 'addFactoryPayment' };
      const factoryId = cleanUrl.split('/')[2];
      data.factoryId = factoryId;
    }
    // 匹配 /factories/{id}/status 模式
    else if (cleanUrl.match(/^\/factories\/[^/]+\/status$/)) {
      mapping = { cloudFunction: 'api', action: 'updateFactoryStatus' };
      const factoryId = cleanUrl.split('/')[2];
      data.factoryId = factoryId;
    }
    // 匹配 /products/{id} 模式
    else if (cleanUrl.match(/^\/products\/[^/]+$/)) {
      mapping = { cloudFunction: 'api', action: method === 'GET' ? 'getProduct' : method === 'PUT' ? 'updateProduct' : 'deleteProduct' };
      const productId = cleanUrl.split('/')[2];
      data.productId = productId;
    }
    // 匹配 /orders/{id} 模式
    else if (cleanUrl.match(/^\/orders\/[^/]+$/)) {
      mapping = { cloudFunction: 'api', action: method === 'GET' ? 'getOrder' : method === 'PUT' ? 'updateOrder' : 'deleteOrder' };
      const orderId = cleanUrl.split('/')[2];
      data.orderId = orderId;
    }
    // 匹配 /send-orders/{id} 模式
    else if (cleanUrl.match(/^\/send-orders\/[^/]+$/)) {
      mapping = { cloudFunction: 'api', action: method === 'GET' ? 'getSendOrder' : method === 'PUT' ? 'updateSendOrder' : 'deleteSendOrder' };
      const orderId = cleanUrl.split('/')[2];
      data.orderId = orderId;
    }
    // 匹配 /receive-orders/{id} 模式
    else if (cleanUrl.match(/^\/receive-orders\/[^/]+$/)) {
      mapping = { cloudFunction: 'api', action: method === 'GET' ? 'getReceiveOrder' : method === 'PUT' ? 'updateReceiveOrder' : 'deleteReceiveOrder' };
      const orderId = cleanUrl.split('/')[2];
      data.orderId = orderId;
    }
  }
  
  if (!mapping) {
    throw new Error(`未找到对应的云函数映射: ${url}`);
  }

  console.log('使用云函数调用:', mapping.cloudFunction, mapping.action, data);
  
  // 调用云函数
  const result = await cloudRequest.callCloudFunction(mapping.cloudFunction, {
    action: mapping.action,
    ...data
  });

  return result;
};



// 获取订单列表
const getOrders = (params) => {
  return cloudFunctionRequest('/orders', 'GET', params)
}

// 获取统计数据
const getStats = (params) => {
  return cloudFunctionRequest('/stats', 'GET', params)
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
  
  return cloudFunctionRequest('/orders', 'POST', cleanData);
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
const getFactories = (orgId) => {
  // 如果没有传递orgId，尝试从存储中获取
  const finalOrgId = orgId || (typeof wx !== 'undefined' ? wx.getStorageSync('orgId') : null);
  // 设置足够大的pageSize，确保获取所有工厂
  return cloudFunctionRequest('/factories', 'GET', { pageSize: 1000, orgId: finalOrgId })
}

// 获取产品列表
const getProducts = () => {
  return cloudFunctionRequest('/products', 'GET')
}

// 获取工序列表
const getProcesses = () => {
  return cloudFunctionRequest('/processes', 'GET')
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
  return cloudFunctionRequest('/products', 'POST', cleanData);
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
  return cloudFunctionRequest('/send-orders', 'POST', mappedData);
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
  return cloudFunctionRequest('/receive-orders', 'POST', camelMain);
};

// 获取流水表数据
const getFlowTable = (params) => {
  console.log('[api.js] getFlowTable called with params:', params);
  // 使用新的流水记录接口
  return cloudFunctionRequest('/flow-records', 'GET', params);
}

// 获取流水记录统计数据
const getFlowStats = (params) => {
  console.log('[api.js] getFlowStats called with params:', params);
  return cloudFunctionRequest('/flow-records/stats', 'GET', params);
}

// 获取异常流水记录
const getFlowAnomalies = (params) => {
  console.log('[api.js] getFlowAnomalies called with params:', params);
  return cloudFunctionRequest('/flow-records/anomalies', 'GET', params);
}

// 上传文件（使用云函数）
const uploadFile = (path, filePath, formData = {}) => {
  return new Promise((resolve, reject) => {
    console.log('[uploadFile] 开始上传图片，路径:', filePath);
    console.log('[uploadFile] 使用小程序直接上传到云存储');

    // 获取token和orgId
    const token = wx.getStorageSync('token');
    const orgId = wx.getStorageSync('orgId');
    console.log('[uploadFile] 认证信息检查:', {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      hasOrgId: !!orgId,
      orgId: orgId
    });
    
    if (!token || !orgId) {
      console.error('[uploadFile] 缺少认证信息:', { token: !!token, orgId: !!orgId });
      reject({
        error: '未登录，请先登录',
        detail: 'No token or orgId found'
      });
      return;
    }

    // 生成云存储路径
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 8);
    let fileExtension = 'jpg';
    
    if (formData.fileName) {
      fileExtension = formData.fileName.split('.').pop() || 'jpg';
    } else if (filePath.includes('.')) {
      fileExtension = filePath.split('.').pop() || 'jpg';
    }
    
    const folder = formData.folder || 'uploads';
    const cloudPath = `${folder}/${orgId}/${timestamp}_${randomStr}.${fileExtension}`;

    // 直接使用小程序云存储上传
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: (uploadRes) => {
        console.log('[uploadFile] 上传成功:', uploadRes);
        
        // 获取下载链接
        wx.cloud.getTempFileURL({
          fileList: [uploadRes.fileID],
          success: (urlRes) => {
            const downloadUrl = urlRes.fileList && urlRes.fileList[0] ? urlRes.fileList[0].tempFileURL : '';
            
            // 生成相对路径
            const relativePath = `/${folder}/${orgId}/${timestamp}_${randomStr}.${fileExtension}`;
            
            resolve({
              success: true,
              data: {
                url: relativePath,
                filePath: relativePath,
                fileId: uploadRes.fileID,
                downloadUrl: downloadUrl
              }
            });
          },
          fail: (urlErr) => {
            console.error('[uploadFile] 获取下载链接失败:', urlErr);
            // 即使获取下载链接失败，也返回成功，因为文件已上传
            const relativePath = `/${folder}/${orgId}/${timestamp}_${randomStr}.${fileExtension}`;
            resolve({
              success: true,
              data: {
                url: relativePath,
                filePath: relativePath,
                fileId: uploadRes.fileID,
                downloadUrl: ''
              }
            });
          }
        });
      },
      fail: (uploadErr) => {
        console.error('[uploadFile] 上传失败:', uploadErr);
        reject({
          error: '文件上传失败: ' + (uploadErr.errMsg || '未知错误'),
          detail: uploadErr
        });
      }
    });
  });
};

// 获取详细的流水记录（按时间顺序的明细）
const getDetailedFlowRecords = (params = {}) => {
  console.log('[api.js] getDetailedFlowRecords called with params:', params);
  return cloudFunctionRequest('/flow-records/detailed', 'GET', params);
};

// 获取损耗率排行榜数据
const getLossRanking = (params = {}) => {
  console.log('[api.js] getLossRanking called with params:', params);
  // 直接调用云函数，避免 CloudBase 网关拦截
  const cloudRequest = require('./cloudRequest');
  return cloudRequest.callCloudFunction('ai-reports', {
    action: 'getLossRanking',
    ...params
  });
};

// 获取活跃排行数据
const getActiveRankings = (params = {}) => {
  console.log('[api.js] getActiveRankings called with params:', params);
  // 直接调用云函数，避免 CloudBase 网关拦截
  const cloudRequest = require('./cloudRequest');
  return cloudRequest.callCloudFunction('ai-reports', {
    action: 'getActiveRankings',
    ...params
  });
};

// 删除收回单
const deleteReceiveOrder = (orderId) => {
  return request(`/receive-orders/${orderId}`, 'DELETE');
}

module.exports = {
  request,
  cloudFunctionRequest,
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