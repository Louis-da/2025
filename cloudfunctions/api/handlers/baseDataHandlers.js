// 基础数据管理相关处理函数
const cloud = require('wx-server-sdk')
const { 
  performanceMonitor, 
  ErrorTypes, 
  createErrorResponse, 
  createSuccessResponse,
  validateParams,
  dbWrapper
} = require('../utils/common')
const { ApiResponse, BusinessErrorCodes } = require('../config/apiStandards')

const db = cloud.database()
const _ = db.command

/**
 * 获取产品列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getProducts(userInfo, params) {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    // 搜索条件
    if (search) {
      whereCondition.name = db.RegExp({
        regexp: search,
        options: 'i'
      })
    }
    
    // 状态过滤
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    // 分页查询
    const result = await db.collection('products')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await db.collection('products')
      .where(whereCondition)
      .count()
    
    return ApiResponse.paginated(
      result.data,
      countResult.total,
      parseInt(page),
      parseInt(limit),
      '产品列表获取成功'
    )
  } catch (error) {
    console.error('获取产品列表错误:', error)
    return ApiResponse.error(
      BusinessErrorCodes.DATABASE_ERROR,
      '获取产品列表失败',
      error.message
    )
  }
}

/**
 * 添加产品
 * @param {Object} userInfo 用户信息
 * @param {Object} params 产品数据
 */
async function addProduct(userInfo, params) {
  try {
    const { name, code, description = '', status = 'active' } = params
    
    if (!name) {
      return ApiResponse.error(
        BusinessErrorCodes.INVALID_PARAMETER,
        '产品名称为必填项'
      )
    }
    
    // 检查产品名称是否重复
    const existingProduct = await db.collection('products')
      .where({
        org_id: userInfo.orgId,
        name: name
      })
      .get()
    
    if (existingProduct.data.length > 0) {
      return ApiResponse.error(
        BusinessErrorCodes.DUPLICATE_RESOURCE,
        '产品名称已存在'
      )
    }
    
    // 检查产品编码是否重复
    if (code) {
      const existingCode = await db.collection('products')
        .where({
          org_id: userInfo.orgId,
          code: code
        })
        .get()
      
      if (existingCode.data.length > 0) {
        return ApiResponse.error(
          BusinessErrorCodes.DUPLICATE_RESOURCE,
          '产品编码已存在'
        )
      }
    }
    
    const productData = {
      name,
      code: code || '',
      description,
      status,
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('products').add({
      data: productData
    })
    
    return ApiResponse.success(
      {
        id: result._id,
        ...productData
      },
      '产品添加成功'
    )
  } catch (error) {
    console.error('添加产品错误:', error)
    return ApiResponse.error(
      BusinessErrorCodes.DATABASE_ERROR,
      '添加产品失败',
      error.message
    )
  }
}

/**
 * 更新产品
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateProduct(userInfo, params) {
  try {
    const { id, name, code, description, status } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少产品ID')
    }
    
    // 验证产品是否存在且属于当前组织
    const product = await db.collection('products')
      .doc(id)
      .get()
    
    if (!product.data || product.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '产品不存在或无权限修改')
    }
    
    // 检查名称重复
    if (name && name !== product.data.name) {
      const existingProduct = await db.collection('products')
        .where({
          org_id: userInfo.orgId,
          name: name,
          _id: _.neq(id)
        })
        .get()
      
      if (existingProduct.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '产品名称已存在')
      }
    }
    
    // 检查编码重复
    if (code && code !== product.data.code) {
      const existingCode = await db.collection('products')
        .where({
          org_id: userInfo.orgId,
          code: code,
          _id: _.neq(id)
        })
        .get()
      
      if (existingCode.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '产品编码已存在')
      }
    }
    
    const updateData = {
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    if (name !== undefined) updateData.name = name
    if (code !== undefined) updateData.code = code
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    
    await db.collection('products')
      .doc(id)
      .update({ data: updateData })
    
    return ApiResponse.success({ id, ...updateData
    }, '操作成功')
  } catch (error) {
    console.error('更新产品错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新产品失败')
  }
}

/**
 * 删除产品
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteProduct(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少产品ID')
    }
    
    // 验证产品是否存在且属于当前组织
    const product = await db.collection('products')
      .doc(id)
      .get()
    
    if (!product.data || product.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '产品不存在或无权限删除')
    }
    
    // 检查是否有关联的订单明细
    const [sendItemsCount, receiveItemsCount] = await Promise.all([
      db.collection('send_order_items').where({ product_id: id }).count(),
      db.collection('receive_order_items').where({ product_id: id }).count()
    ])
    
    if (sendItemsCount.total > 0 || receiveItemsCount.total > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '该产品存在关联订单，无法删除')
    }
    
    // 软删除
    await db.collection('products')
      .doc(id)
      .update({
        data: {
          status: 'deleted',
          deleted_at: new Date(),
          deleted_by: userInfo.userId
        }
      })
    
    return {
      success: true,
      message: '产品删除成功'
    }
  } catch (error) {
    console.error('删除产品错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除产品失败')
  }
}

/**
 * 获取颜色列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getColors(userInfo, params) {
  try {
    const { page = 1, limit = 50, search = '' } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (search) {
      whereCondition.name = db.RegExp({
        regexp: search,
        options: 'i'
      })
    }
    
    const result = await db.collection('colors')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('colors')
      .where(whereCondition)
      .count()
    
    return ApiResponse.success({
        colors: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      
      }, '操作成功')
  } catch (error) {
    console.error('获取颜色列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取颜色列表失败')
  }
}

/**
 * 添加颜色
 * @param {Object} userInfo 用户信息
 * @param {Object} params 颜色数据
 */
async function addColor(userInfo, params) {
  try {
    const { name, code = '', hex_code = '' } = params
    
    if (!name) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '颜色名称为必填项')
    }
    
    // 检查颜色名称是否重复
    const existingColor = await db.collection('colors')
      .where({
        org_id: userInfo.orgId,
        name: name
      })
      .get()
    
    if (existingColor.data.length > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '颜色名称已存在')
    }
    
    const colorData = {
      name,
      code,
      hex_code,
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('colors').add({
      data: colorData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...colorData
      
      }, '操作成功')
  } catch (error) {
    console.error('添加颜色错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '添加颜色失败')
  }
}

/**
 * 获取尺码列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getSizes(userInfo, params) {
  try {
    const { page = 1, limit = 50, search = '' } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (search) {
      whereCondition.name = db.RegExp({
        regexp: search,
        options: 'i'
      })
    }
    
    const result = await db.collection('sizes')
      .where(whereCondition)
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('sizes')
      .where(whereCondition)
      .count()
    
    return ApiResponse.success({
        sizes: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取尺码列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取尺码列表失败')
  }
}

/**
 * 添加尺码
 * @param {Object} userInfo 用户信息
 * @param {Object} params 尺码数据
 */
async function addSize(userInfo, params) {
  try {
    const { name, code = '', sort_order = 0 } = params
    
    if (!name) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '尺码名称为必填项')
    }
    
    // 检查尺码名称是否重复
    const existingSize = await db.collection('sizes')
      .where({
        org_id: userInfo.orgId,
        name: name
      })
      .get()
    
    if (existingSize.data.length > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '尺码名称已存在')
    }
    
    const sizeData = {
      name,
      code,
      sort_order: parseInt(sort_order),
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('sizes').add({
      data: sizeData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...sizeData
      }, '操作成功')
  } catch (error) {
    console.error('添加尺码错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '添加尺码失败')
  }
}

/**
 * 获取工序列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getProcesses(userInfo, params) {
  try {
    const { page = 1, limit = 50, search = '', status = 'all' } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (search) {
      whereCondition.name = db.RegExp({
        regexp: search,
        options: 'i'
      })
    }
    
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    const result = await db.collection('processes')
      .where(whereCondition)
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('processes')
      .where(whereCondition)
      .count()
    
    return ApiResponse.success({
        processes: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取工序列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取工序列表失败')
  }
}

/**
 * 添加工序
 * @param {Object} userInfo 用户信息
 * @param {Object} params 工序数据
 */
async function addProcess(userInfo, params) {
  try {
    const { name, description = '', sort_order = 0, status = 'active' } = params
    
    if (!name) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工序名称为必填项')
    }
    
    // 检查工序名称是否重复
    const existingProcess = await db.collection('processes')
      .where({
        org_id: userInfo.orgId,
        name: name
      })
      .get()
    
    if (existingProcess.data.length > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工序名称已存在')
    }
    
    const processData = {
      name,
      description,
      sort_order: parseInt(sort_order),
      status,
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('processes').add({
      data: processData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...processData
      }, '操作成功')
  } catch (error) {
    console.error('添加工序错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '添加工序失败')
  }
}

/**
 * 更新工序
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateProcess(userInfo, params) {
  try {
    const { id, name, description, sort_order, status } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少工序ID')
    }
    
    // 验证工序是否存在且属于当前组织
    const process = await db.collection('processes')
      .doc(id)
      .get()
    
    if (!process.data || process.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工序不存在或无权限修改')
    }
    
    // 检查名称重复
    if (name && name !== process.data.name) {
      const existingProcess = await db.collection('processes')
        .where({
          org_id: userInfo.orgId,
          name: name,
          _id: _.neq(id)
        })
        .get()
      
      if (existingProcess.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工序名称已存在')
      }
    }
    
    const updateData = {
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order)
    if (status !== undefined) updateData.status = status
    
    await db.collection('processes')
      .doc(id)
      .update({ data: updateData })
    
    return ApiResponse.success({ id, ...updateData
    }, '操作成功')
  } catch (error) {
    console.error('更新工序错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新工序失败')
  }
}

/**
 * 更新颜色状态
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function updateColorStatus(userInfo, params) {
  try {
    const { id, status } = params
    
    if (!id || status === undefined) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '颜色ID和状态为必填项')
    }
    
    const result = await db.collection('colors')
      .doc(id)
      .update({
        data: {
          status: status,
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('更新颜色状态错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新颜色状态失败')
  }
}

/**
 * 更新颜色信息
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function updateColor(userInfo, params) {
  try {
    const { id, name, code, hex_code } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '颜色ID为必填项')
    }
    
    const updateData = {
      updated_at: new Date()
    }
    
    if (name) updateData.name = name
    if (code !== undefined) updateData.code = code
    if (hex_code !== undefined) updateData.hex_code = hex_code
    
    const result = await db.collection('colors')
      .doc(id)
      .update({
        data: updateData
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('更新颜色错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新颜色失败')
  }
}

/**
 * 更新尺码状态
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function updateSizeStatus(userInfo, params) {
  try {
    const { id, status } = params
    
    if (!id || status === undefined) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '尺码ID和状态为必填项')
    }
    
    const result = await db.collection('sizes')
      .doc(id)
      .update({
        data: {
          status: status,
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('更新尺码状态错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新尺码状态失败')
  }
}

/**
 * 更新尺码信息
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function updateSize(userInfo, params) {
  try {
    const { id, name, code } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '尺码ID为必填项')
    }
    
    const updateData = {
      updated_at: new Date()
    }
    
    if (name) updateData.name = name
    if (code !== undefined) updateData.code = code
    
    const result = await db.collection('sizes')
      .doc(id)
      .update({
        data: updateData
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('更新尺码错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新尺码失败')
  }
}

/**
 * 更新工序状态
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function updateProcessStatus(userInfo, params) {
  try {
    const { id, status } = params
    
    if (!id || status === undefined) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工序ID和状态为必填项')
    }
    
    const result = await db.collection('processes')
      .doc(id)
      .update({
        data: {
          status: status,
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('更新工序状态错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新工序状态失败')
  }
}

module.exports = {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getColors,
  addColor,
  updateColorStatus,
  updateColor,
  getSizes,
  addSize,
  updateSizeStatus,
  updateSize,
  getProcesses,
  addProcess,
  updateProcess,
  updateProcessStatus
}