/**
 * 云开发请求工具
 * 替代原有的HTTP请求，直接调用云函数
 * 环境ID来源：envList.js（默认回退至历史值）
 * 
 * @author 云收发技术团队
 * @version 4.0.0
 * @since 2025-08-27
 */

// 云函数名称映射
const CLOUD_FUNCTIONS = {
  AUTH: 'auth',
  FACTORIES: 'factories',
  PROCESSES: 'processes',
  PRODUCTS: 'products',
  COLORS: 'colors',
  SIZES: 'sizes',
  SEND_ORDERS: 'sendOrders',
  RECEIVE_ORDERS: 'receiveOrders',
  FACTORY_PAYMENTS: 'factoryPayments',
  ORGANIZATIONS: 'organizations',
  USERS: 'users',
  ROLES: 'roles'
};

// 错误类型常量定义
const ERROR_TYPES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// 新增：集中读取 ENV_ID
const { envList } = require('../envList');
const DEFAULT_ENV_ID = 'cloud1-3gwlq66232d160ab';
const ENV_ID = (envList && envList[0] && envList[0].envId) || DEFAULT_ENV_ID;

/**
 * 统一错误处理类
 */
class CloudRequestError extends Error {
  constructor(type, message, originalError = null) {
    super(message);
    this.name = 'CloudRequestError';
    this.type = type;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }

  /**
   * 获取用户友好的错误提示
   */
  getUserMessage() {
    switch (this.type) {
      case ERROR_TYPES.NETWORK_ERROR:
        return '网络连接异常，请检查网络后重试';
      case ERROR_TYPES.AUTH_ERROR:
        return '登录已过期，请重新登录';
      case ERROR_TYPES.PERMISSION_ERROR:
        return '权限不足，请联系管理员';
      case ERROR_TYPES.VALIDATION_ERROR:
        return this.message || '请求参数有误，请检查后重试';
      case ERROR_TYPES.SERVER_ERROR:
        return '服务器暂时无法响应，请稍后重试';
      default:
        return '操作失败，请重试';
    }
  }
}

/**
 * 云开发请求工具类
 */
class CloudRequest {
  constructor() {
    this.isInitialized = false;
    this.initCloud();
  }

  /**
   * 初始化云开发
   */
  initCloud() {
    if (wx.cloud) {
      wx.cloud.init({
        env: ENV_ID,
        traceUser: true
      });
      this.isInitialized = true;
      console.log('云开发初始化成功');
    } else {
      console.warn('当前微信版本不支持云开发');
    }
  }

  /**
   * 调用云函数
   * @param {string} functionName 云函数名称
   * @param {object} data 请求数据
   * @returns {Promise} 返回结果
   */
  async callCloudFunction(functionName, data = {}) {
    if (!this.isInitialized) {
      throw new CloudRequestError(
        ERROR_TYPES.NETWORK_ERROR,
        '云开发未初始化'
      );
    }

    try {
      console.log(`调用云函数: ${functionName}`, data);
      
      const result = await wx.cloud.callFunction({
        name: functionName,
        data: data
      });

      console.log(`云函数返回: ${functionName}`, result);

      if (result.result && result.result.success === false) {
        throw new CloudRequestError(
          ERROR_TYPES.SERVER_ERROR,
          result.result.error || '云函数执行失败'
        );
      }

      return result.result;
    } catch (error) {
      console.error(`云函数调用失败: ${functionName}`, error);
      
      if (error instanceof CloudRequestError) {
        throw error;
      }

      // 处理云开发特定错误
      if (error.errCode) {
        switch (error.errCode) {
          case 'CLOUD_FUNCTION_NOT_FOUND':
            throw new CloudRequestError(
              ERROR_TYPES.SERVER_ERROR,
              '云函数不存在，请联系管理员'
            );
          case 'CLOUD_FUNCTION_EXECUTION_ERROR':
            throw new CloudRequestError(
              ERROR_TYPES.SERVER_ERROR,
              '云函数执行错误，请稍后重试'
            );
          default:
            throw new CloudRequestError(
              ERROR_TYPES.SERVER_ERROR,
              `云函数错误: ${error.errMsg || '未知错误'}`
            );
        }
      }

      throw new CloudRequestError(
        ERROR_TYPES.NETWORK_ERROR,
        '网络请求失败，请检查网络连接'
      );
    }
  }

  /**
   * 用户认证相关请求
   */
  auth = {
    /**
     * 用户登录
     */
    login: async (username, password, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.AUTH, {
        action: 'login',
        data: { username, password, orgId }
      });
    },

    /**
     * 用户注册
     */
    register: async (userData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.AUTH, {
        action: 'register',
        data: userData
      });
    },

    /**
     * 获取用户信息
     */
    getUserInfo: async () => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.AUTH, {
        action: 'getUserInfo'
      });
    },

    /**
     * 更新用户信息
     */
    updateUserInfo: async (userData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.AUTH, {
        action: 'updateUserInfo',
        data: userData
      });
    },

    // 新增：保留历史功能（补回被意外移除的方法）
    /**
     * 修改密码
     */
    changePassword: async (oldPassword, newPassword) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.AUTH, {
        action: 'changePassword',
        data: { oldPassword, newPassword }
      });
    },

    /**
     * 重置密码
     */
    resetPassword: async (username, orgId, newPassword) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.AUTH, {
        action: 'resetPassword',
        data: { username, orgId, newPassword }
      });
    },
  };

  /**
   * 工厂管理相关请求
   */
  factories = {
    /**
     * 获取工厂列表
     */
    getList: async (orgId, page = 1, pageSize = 20, keyword = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'getFactories',
        data: { orgId, page, pageSize, keyword, status }
      });
    },

    /**
     * 获取单个工厂
     */
    getById: async (factoryId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'getFactory',
        data: { factoryId, orgId }
      });
    },

    /**
     * 创建工厂
     */
    create: async (factoryData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'createFactory',
        data: factoryData
      });
    },

    /**
     * 更新工厂
     */
    update: async (factoryId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'updateFactory',
        data: { factoryId, orgId, ...updateData }
      });
    },

    /**
     * 删除工厂
     */
    delete: async (factoryId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'deleteFactory',
        data: { factoryId, orgId }
      });
    },

    /**
     * 获取工厂余额
     */
    getBalance: async (factoryId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'getFactoryBalance',
        data: { factoryId, orgId }
      });
    },

    /**
     * 更新工厂余额
     */
    updateBalance: async (factoryId, orgId, amount, type, remark) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORIES, {
        action: 'updateFactoryBalance',
        data: { factoryId, orgId, amount, type, remark }
      });
    }
  };

  /**
   * 工序管理相关请求
   */
  processes = {
    /**
     * 获取工序列表
     */
    getList: async (orgId, page = 1, pageSize = 20, keyword = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PROCESSES, {
        action: 'getProcesses',
        data: { orgId, page, pageSize, keyword, status }
      });
    },

    /**
     * 创建工序
     */
    create: async (processData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PROCESSES, {
        action: 'createProcess',
        data: processData
      });
    },

    /**
     * 更新工序
     */
    update: async (processId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PROCESSES, {
        action: 'updateProcess',
        data: { processId, orgId, ...updateData }
      });
    },

    /**
     * 删除工序
     */
    delete: async (processId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PROCESSES, {
        action: 'deleteProcess',
        data: { processId, orgId }
      });
    }
  };

  /**
   * 货品管理相关请求
   */
  products = {
    /**
     * 获取货品列表
     */
    getList: async (orgId, page = 1, pageSize = 20, keyword = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PRODUCTS, {
        action: 'getProducts',
        data: { orgId, page, pageSize, keyword, status }
      });
    },

    /**
     * 创建货品
     */
    create: async (productData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PRODUCTS, {
        action: 'createProduct',
        data: productData
      });
    },

    /**
     * 更新货品
     */
    update: async (productId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PRODUCTS, {
        action: 'updateProduct',
        data: { productId, orgId, ...updateData }
      });
    },

    /**
     * 删除货品
     */
    delete: async (productId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.PRODUCTS, {
        action: 'deleteProduct',
        data: { productId, orgId }
      });
    }
  };

  /**
   * 颜色管理相关请求
   */
  colors = {
    /**
     * 获取颜色列表
     */
    getList: async (orgId, page = 1, pageSize = 20, keyword = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.COLORS, {
        action: 'getColors',
        data: { orgId, page, pageSize, keyword, status }
      });
    },

    /**
     * 创建颜色
     */
    create: async (colorData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.COLORS, {
        action: 'createColor',
        data: colorData
      });
    },

    /**
     * 更新颜色
     */
    update: async (colorId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.COLORS, {
        action: 'updateColor',
        data: { colorId, orgId, ...updateData }
      });
    },

    /**
     * 删除颜色
     */
    delete: async (colorId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.COLORS, {
        action: 'deleteColor',
        data: { colorId, orgId }
      });
    }
  };

  /**
   * 尺码管理相关请求
   */
  sizes = {
    /**
     * 获取尺码列表
     */
    getList: async (orgId, page = 1, pageSize = 20, keyword = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SIZES, {
        action: 'getSizes',
        data: { orgId, page, pageSize, keyword, status }
      });
    },

    /**
     * 创建尺码
     */
    create: async (sizeData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SIZES, {
        action: 'createSize',
        data: sizeData
      });
    },

    /**
     * 更新尺码
     */
    update: async (sizeId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SIZES, {
        action: 'updateSize',
        data: { sizeId, orgId, ...updateData }
      });
    },

    /**
     * 删除尺码
     */
    delete: async (sizeId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SIZES, {
        action: 'deleteSize',
        data: { sizeId, orgId }
      });
    }
  };

  /**
   * 发出单管理相关请求
   */
  sendOrders = {
    /**
     * 获取发出单列表
     */
    getList: async (orgId, page = 1, pageSize = 20, factoryId = '', processId = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SEND_ORDERS, {
        action: 'getSendOrders',
        data: { orgId, page, pageSize, factoryId, processId, status }
      });
    },

    /**
     * 创建发出单
     */
    create: async (orderData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SEND_ORDERS, {
        action: 'createSendOrder',
        data: orderData
      });
    },

    /**
     * 更新发出单
     */
    update: async (orderId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SEND_ORDERS, {
        action: 'updateSendOrder',
        data: { orderId, orgId, ...updateData }
      });
    },

    /**
     * 删除发出单
     */
    delete: async (orderId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.SEND_ORDERS, {
        action: 'deleteSendOrder',
        data: { orderId, orgId }
      });
    }
  };

  /**
   * 收回单管理相关请求
   */
  receiveOrders = {
    /**
     * 获取收回单列表
     */
    getList: async (orgId, page = 1, pageSize = 20, factoryId = '', processId = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.RECEIVE_ORDERS, {
        action: 'getReceiveOrders',
        data: { orgId, page, pageSize, factoryId, processId, status }
      });
    },

    /**
     * 创建收回单
     */
    create: async (orderData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.RECEIVE_ORDERS, {
        action: 'createReceiveOrder',
        data: orderData
      });
    },

    /**
     * 更新收回单
     */
    update: async (orderId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.RECEIVE_ORDERS, {
        action: 'updateReceiveOrder',
        data: { orderId, orgId, ...updateData }
      });
    },

    /**
     * 删除收回单
     */
    delete: async (orderId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.RECEIVE_ORDERS, {
        action: 'deleteReceiveOrder',
        data: { orderId, orgId }
      });
    }
  };

  /**
   * 工厂付款管理相关请求
   */
  factoryPayments = {
    /**
     * 获取付款记录列表
     */
    getList: async (orgId, page = 1, pageSize = 20, factoryId = '', status = null) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORY_PAYMENTS, {
        action: 'getFactoryPayments',
        data: { orgId, page, pageSize, factoryId, status }
      });
    },

    /**
     * 创建付款记录
     */
    create: async (paymentData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORY_PAYMENTS, {
        action: 'createFactoryPayment',
        data: paymentData
      });
    },

    /**
     * 更新付款记录
     */
    update: async (paymentId, orgId, updateData) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORY_PAYMENTS, {
        action: 'updateFactoryPayment',
        data: { paymentId, orgId, ...updateData }
      });
    },

    /**
     * 删除付款记录
     */
    delete: async (paymentId, orgId) => {
      return await this.callCloudFunction(CLOUD_FUNCTIONS.FACTORY_PAYMENTS, {
        action: 'deleteFactoryPayment',
        data: { paymentId, orgId }
      });
    }
  };
}

// 创建单例实例
const cloudRequest = new CloudRequest();

// 导出工具类
module.exports = {
  cloudRequest,
  CloudRequestError,
  ERROR_TYPES,
  CLOUD_FUNCTIONS
};

// 兼容原有代码
module.exports.default = cloudRequest;