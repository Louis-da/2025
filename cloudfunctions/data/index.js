/**
 * 数据管理云函数
 * 提供统一的数据操作接口，包括CRUD操作、数据验证、权限控制等
 * 
 * @author 云收发技术团队
 * @version 3.0.0
 * @since 2024-12-19
 */

const cloud = require('wx-server-sdk');
const {
  AppError,
  ERROR_CODES,
  Logger,
  Validator,
  JWTUtils,
  PasswordUtils,
  DatabaseUtils,
  ResponseUtils,
  handleError,
  validateToken,
  checkPermission
} = require('../common/utils');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 数据操作权限映射
const PERMISSION_MAP = {
  'users': {
    read: 'user:read',
    create: 'user:create',
    update: 'user:update',
    delete: 'user:delete'
  },
  'organizations': {
    read: 'org:read',
    create: 'org:create',
    update: 'org:update',
    delete: 'org:delete'
  },
  'products': {
    read: 'product:read',
    create: 'product:create',
    update: 'product:update',
    delete: 'product:delete'
  },
  'orders': {
    read: 'order:read',
    create: 'order:create',
    update: 'order:update',
    delete: 'order:delete'
  },
  'roles': {
    read: 'role:read',
    create: 'role:create',
    update: 'role:update',
    delete: 'role:delete'
  }
};

// 数据验证规则
const VALIDATION_RULES = {
  users: {
    required: ['username', 'password', 'orgId'],
    types: {
      username: 'string',
      password: 'string',
      realName: 'string',
      orgId: 'string',
      roleId: 'string',
      status: 'number',
      isSuperAdmin: 'boolean'
    },
    lengths: {
      username: { min: 3, max: 50 },
      password: { min: 6, max: 100 },
      realName: { max: 100 },
      orgId: { max: 50 },
      roleId: { max: 50 }
    }
  },
  organizations: {
    required: ['name', 'code'],
    types: {
      name: 'string',
      code: 'string',
      description: 'string',
      status: 'number'
    },
    lengths: {
      name: { min: 2, max: 100 },
      code: { min: 2, max: 50 },
      description: { max: 500 }
    }
  },
  products: {
    required: ['name', 'price', 'orgId'],
    types: {
      name: 'string',
      description: 'string',
      price: 'number',
      stock: 'number',
      orgId: 'string',
      status: 'number'
    },
    lengths: {
      name: { min: 1, max: 200 },
      description: { max: 1000 },
      orgId: { max: 50 }
    },
    ranges: {
      price: { min: 0 },
      stock: { min: 0 }
    }
  },
  orders: {
    required: ['productId', 'quantity', 'orgId'],
    types: {
      productId: 'string',
      quantity: 'number',
      totalAmount: 'number',
      orgId: 'string',
      status: 'string'
    },
    lengths: {
      productId: { max: 50 },
      orgId: { max: 50 },
      status: { max: 20 }
    },
    ranges: {
      quantity: { min: 1 },
      totalAmount: { min: 0 }
    }
  }
};

/**
 * 数据验证函数
 */
function validateData(collection, data, isUpdate = false) {
  const rules = VALIDATION_RULES[collection];
  if (!rules) {
    throw new AppError(
      `不支持的数据集合: ${collection}`,
      ERROR_CODES.INVALID_PARAMS,
      400
    );
  }
  
  // 必填字段验证（创建时）
  if (!isUpdate && rules.required) {
    Validator.validateRequired(data, rules.required);
  }
  
  // 数据类型验证
  if (rules.types) {
    const typesToValidate = {};
    Object.keys(rules.types).forEach(field => {
      if (data[field] !== undefined) {
        typesToValidate[field] = rules.types[field];
      }
    });
    if (Object.keys(typesToValidate).length > 0) {
      Validator.validateTypes(data, typesToValidate);
    }
  }
  
  // 字符串长度验证
  if (rules.lengths) {
    const lengthsToValidate = {};
    Object.keys(rules.lengths).forEach(field => {
      if (data[field] !== undefined) {
        lengthsToValidate[field] = rules.lengths[field];
      }
    });
    if (Object.keys(lengthsToValidate).length > 0) {
      Validator.validateStringLength(data, lengthsToValidate);
    }
  }
  
  // 数值范围验证
  if (rules.ranges) {
    const rangesToValidate = {};
    Object.keys(rules.ranges).forEach(field => {
      if (data[field] !== undefined) {
        rangesToValidate[field] = rules.ranges[field];
      }
    });
    if (Object.keys(rangesToValidate).length > 0) {
      Validator.validateNumberRange(data, rangesToValidate);
    }
  }
}

/**
 * 查询数据
 * @param {string} token - JWT Token
 * @param {string} collection - 集合名称
 * @param {Object} query - 查询条件
 * @param {Object} options - 查询选项
 * @returns {Object} 查询结果
 */
async function queryData(token, collection, query = {}, options = {}) {
  try {
    Logger.info('数据查询请求', { collection, query, options }, 'data.queryData');
    
    // Token验证
    const tokenResult = await validateToken(token);
    const userInfo = tokenResult.data;
    
    // 权限检查
    const permission = PERMISSION_MAP[collection]?.read;
    if (permission) {
      await checkPermission(userInfo, permission, collection);
    }
    
    // 构建查询
    let dbQuery = db.collection(collection);
    
    // 应用查询条件
    if (Object.keys(query).length > 0) {
      dbQuery = dbQuery.where(query);
    }
    
    // 应用排序
    if (options.orderBy) {
      const { field, direction = 'asc' } = options.orderBy;
      dbQuery = dbQuery.orderBy(field, direction);
    }
    
    // 应用分页
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100); // 最大限制100条
    
    if (options.paginated !== false) {
      dbQuery = DatabaseUtils.buildPaginationQuery(dbQuery, page, limit);
    }
    
    // 执行查询
    const result = await dbQuery.get();
    
    // 如果需要分页信息，获取总数
    let total = null;
    if (options.paginated !== false) {
      const countResult = await db.collection(collection).where(query).count();
      total = countResult.total;
    }
    
    Logger.info('数据查询成功', {
      collection,
      count: result.data.length,
      total
    }, 'data.queryData');
    
    if (options.paginated !== false && total !== null) {
      return ResponseUtils.paginated(result.data, total, page, limit);
    } else {
      return ResponseUtils.success(result.data, '查询成功');
    }
    
  } catch (error) {
    return handleError(error, 'data.queryData');
  }
}

/**
 * 创建数据
 * @param {string} token - JWT Token
 * @param {string} collection - 集合名称
 * @param {Object} data - 数据内容
 * @returns {Object} 创建结果
 */
async function createData(token, collection, data) {
  try {
    Logger.info('数据创建请求', { collection, data }, 'data.createData');
    
    // Token验证
    const tokenResult = await validateToken(token);
    const userInfo = tokenResult.data;
    
    // 权限检查
    const permission = PERMISSION_MAP[collection]?.create;
    if (permission) {
      await checkPermission(userInfo, permission, collection);
    }
    
    // 数据验证
    validateData(collection, data, false);
    
    // 特殊处理：用户创建时加密密码
    if (collection === 'users' && data.password) {
      const salt = PasswordUtils.generateSalt();
      data.password = PasswordUtils.hashPassword(data.password, salt);
      data.salt = salt;
      data.status = data.status || 1; // 默认激活状态
    }
    
    // 添加创建者信息
    data.createdBy = userInfo.userId;
    data.updatedBy = userInfo.userId;
    
    // 创建数据
    const result = await DatabaseUtils.safeAdd(db.collection(collection), data);
    
    Logger.info('数据创建成功', {
      collection,
      docId: result._id
    }, 'data.createData');
    
    return ResponseUtils.success({
      id: result._id,
      ...data
    }, '创建成功');
    
  } catch (error) {
    return handleError(error, 'data.createData');
  }
}

/**
 * 更新数据
 * @param {string} token - JWT Token
 * @param {string} collection - 集合名称
 * @param {string} docId - 文档ID
 * @param {Object} data - 更新数据
 * @returns {Object} 更新结果
 */
async function updateData(token, collection, docId, data) {
  try {
    Logger.info('数据更新请求', { collection, docId, data }, 'data.updateData');
    
    // Token验证
    const tokenResult = await validateToken(token);
    const userInfo = tokenResult.data;
    
    // 权限检查
    const permission = PERMISSION_MAP[collection]?.update;
    if (permission) {
      await checkPermission(userInfo, permission, collection);
    }
    
    // 数据验证
    validateData(collection, data, true);
    
    // 检查文档是否存在
    const existingDoc = await db.collection(collection).doc(docId).get();
    if (!existingDoc.data) {
      throw new AppError(
        '文档不存在',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      );
    }
    
    // 特殊处理：用户密码更新
    if (collection === 'users' && data.password) {
      const salt = PasswordUtils.generateSalt();
      data.password = PasswordUtils.hashPassword(data.password, salt);
      data.salt = salt;
      data.passwordChangedAt = new Date();
    }
    
    // 添加更新者信息
    data.updatedBy = userInfo.userId;
    
    // 更新数据
    await DatabaseUtils.safeUpdate(db.collection(collection), docId, data);
    
    Logger.info('数据更新成功', {
      collection,
      docId
    }, 'data.updateData');
    
    return ResponseUtils.success({
      id: docId,
      ...data
    }, '更新成功');
    
  } catch (error) {
    return handleError(error, 'data.updateData');
  }
}

/**
 * 删除数据
 * @param {string} token - JWT Token
 * @param {string} collection - 集合名称
 * @param {string} docId - 文档ID
 * @returns {Object} 删除结果
 */
async function deleteData(token, collection, docId) {
  try {
    Logger.info('数据删除请求', { collection, docId }, 'data.deleteData');
    
    // Token验证
    const tokenResult = await validateToken(token);
    const userInfo = tokenResult.data;
    
    // 权限检查
    const permission = PERMISSION_MAP[collection]?.delete;
    if (permission) {
      await checkPermission(userInfo, permission, collection);
    }
    
    // 检查文档是否存在
    const existingDoc = await db.collection(collection).doc(docId).get();
    if (!existingDoc.data) {
      throw new AppError(
        '文档不存在',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      );
    }
    
    // 软删除：标记为已删除而不是物理删除
    await DatabaseUtils.safeUpdate(db.collection(collection), docId, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userInfo.userId
    });
    
    Logger.info('数据删除成功', {
      collection,
      docId
    }, 'data.deleteData');
    
    return ResponseUtils.success(null, '删除成功');
    
  } catch (error) {
    return handleError(error, 'data.deleteData');
  }
}

/**
 * 批量操作
 * @param {string} token - JWT Token
 * @param {string} operation - 操作类型
 * @param {string} collection - 集合名称
 * @param {Array} items - 操作项目
 * @returns {Object} 批量操作结果
 */
async function batchOperation(token, operation, collection, items) {
  try {
    Logger.info('批量操作请求', {
      operation,
      collection,
      itemCount: items.length
    }, 'data.batchOperation');
    
    // Token验证
    const tokenResult = await validateToken(token);
    const userInfo = tokenResult.data;
    
    // 权限检查
    const permission = PERMISSION_MAP[collection]?.[operation];
    if (permission) {
      await checkPermission(userInfo, permission, collection);
    }
    
    // 限制批量操作数量
    if (items.length > 100) {
      throw new AppError(
        '批量操作数量不能超过100条',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
    
    const results = [];
    const errors = [];
    
    // 执行批量操作
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        let result;
        
        switch (operation) {
          case 'create':
            result = await createData(token, collection, item);
            break;
          case 'update':
            result = await updateData(token, collection, item.id, item.data);
            break;
          case 'delete':
            result = await deleteData(token, collection, item.id);
            break;
          default:
            throw new AppError(
              `不支持的批量操作: ${operation}`,
              ERROR_CODES.INVALID_PARAMS,
              400
            );
        }
        
        results.push({
          index: i,
          success: true,
          data: result.data
        });
        
      } catch (error) {
        errors.push({
          index: i,
          error: error.message || '操作失败',
          item: item
        });
      }
    }
    
    Logger.info('批量操作完成', {
      operation,
      collection,
      successCount: results.length,
      errorCount: errors.length
    }, 'data.batchOperation');
    
    return ResponseUtils.success({
      results,
      errors,
      summary: {
        total: items.length,
        success: results.length,
        failed: errors.length
      }
    }, '批量操作完成');
    
  } catch (error) {
    return handleError(error, 'data.batchOperation');
  }
}

/**
 * 数据统计
 * @param {string} token - JWT Token
 * @param {string} collection - 集合名称
 * @param {Object} aggregation - 聚合条件
 * @returns {Object} 统计结果
 */
async function aggregateData(token, collection, aggregation) {
  try {
    Logger.info('数据统计请求', { collection, aggregation }, 'data.aggregateData');
    
    // Token验证
    const tokenResult = await validateToken(token);
    const userInfo = tokenResult.data;
    
    // 权限检查
    const permission = PERMISSION_MAP[collection]?.read;
    if (permission) {
      await checkPermission(userInfo, permission, collection);
    }
    
    // 构建聚合管道
    const pipeline = [];
    
    // 匹配条件
    if (aggregation.match) {
      pipeline.push({ $match: aggregation.match });
    }
    
    // 分组统计
    if (aggregation.group) {
      pipeline.push({ $group: aggregation.group });
    }
    
    // 排序
    if (aggregation.sort) {
      pipeline.push({ $sort: aggregation.sort });
    }
    
    // 限制结果数量
    if (aggregation.limit) {
      pipeline.push({ $limit: Math.min(aggregation.limit, 1000) });
    }
    
    // 执行聚合查询
    const result = await db.collection(collection).aggregate().pipeline(pipeline).end();
    
    Logger.info('数据统计成功', {
      collection,
      resultCount: result.list.length
    }, 'data.aggregateData');
    
    return ResponseUtils.success(result.list, '统计成功');
    
  } catch (error) {
    return handleError(error, 'data.aggregateData');
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  // 设置请求ID用于日志追踪
  global.currentRequestId = context.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const { action, data } = event;
  
  Logger.info('数据云函数调用', {
    action,
    requestId: global.currentRequestId,
    dataKeys: data ? Object.keys(data) : []
  }, 'data.main');
  
  try {
    // 参数验证
    if (!action) {
      throw new AppError(
        '缺少操作类型参数',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
    
    switch (action) {
      case 'query':
        return await queryData(
          data.token,
          data.collection,
          data.query,
          data.options
        );
      
      case 'create':
        return await createData(
          data.token,
          data.collection,
          data.data
        );
      
      case 'update':
        return await updateData(
          data.token,
          data.collection,
          data.docId,
          data.data
        );
      
      case 'delete':
        return await deleteData(
          data.token,
          data.collection,
          data.docId
        );
      
      case 'batch':
        return await batchOperation(
          data.token,
          data.operation,
          data.collection,
          data.items
        );
      
      case 'aggregate':
        return await aggregateData(
          data.token,
          data.collection,
          data.aggregation
        );
      
      default:
        throw new AppError(
          `不支持的操作类型: ${action}`,
          ERROR_CODES.INVALID_PARAMS,
          400
        );
    }
  } catch (error) {
    return handleError(error, 'data.main');
  } finally {
    // 清理全局请求ID
    delete global.currentRequestId;
  }
};