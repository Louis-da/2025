// 工艺流程管理相关处理函数
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
 * 获取流程列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getProcesses(userInfo, params) {
  try {
    const { page = 1, limit = 20, search = '', status = 'all', factory_id = 'all' } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    // 搜索条件
    if (search) {
      whereCondition[_.or] = [
        { name: db.RegExp({ regexp: search, options: 'i' }) },
        { description: db.RegExp({ regexp: search, options: 'i' }) }
      ]
    }
    
    // 状态过滤
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    // 工厂过滤
    if (factory_id !== 'all') {
      whereCondition.factory_id = factory_id
    }
    
    // 分页查询
    const result = await db.collection('processes')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await db.collection('processes')
      .where(whereCondition)
      .count()
    
    // 关联查询工厂信息
    const processes = await Promise.all(result.data.map(async (process) => {
      const factory = process.factory_id 
        ? await db.collection('factories').doc(process.factory_id).get().catch(() => null)
        : null
      
      return {
        ...process,
        factory_name: factory?.data?.name || ''
      }
    }))
    
    return ApiResponse.success({
        processes,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取流程列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取流程列表失败')
  }
}

/**
 * 获取流程详情
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getProcessById(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少流程ID')
    }
    
    const result = await db.collection('processes')
      .doc(id)
      .get()
    
    if (!result.data || result.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '流程不存在或无权限访问')
    }
    
    // 关联查询工厂信息
    const factory = result.data.factory_id 
      ? await db.collection('factories').doc(result.data.factory_id).get().catch(() => null)
      : null
    
    return ApiResponse.success({
        ...result.data,
        factory_name: factory?.data?.name || ''
      }, '操作成功')
  } catch (error) {
    console.error('获取流程详情错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取流程详情失败')
  }
}

/**
 * 添加流程
 * @param {Object} userInfo 用户信息
 * @param {Object} params 流程数据
 */
async function addProcess(userInfo, params) {
  try {
    const { name, description, factory_id, unit_price, estimated_time, status = 'active' } = params
    
    // 数据验证
    if (!name || !factory_id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '流程名称和工厂为必填项')
    }
    
    // 验证工厂是否存在且属于当前组织
    const factory = await db.collection('factories')
      .doc(factory_id)
      .get()
    
    if (!factory.data || factory.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂不存在或无权限访问')
    }
    
    // 检查同一工厂下流程名称是否重复
    const existingProcess = await db.collection('processes')
      .where({
        org_id: userInfo.orgId,
        factory_id: factory_id,
        name: name
      })
      .get()
    
    if (existingProcess.data.length > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '该工厂下已存在同名流程')
    }
    
    const processData = {
      name,
      description: description || '',
      factory_id,
      unit_price: parseFloat(unit_price) || 0,
      estimated_time: parseInt(estimated_time) || 0,
      status,
      org_id: userInfo.orgId,
      created_at: new Date(),
      created_by: userInfo.userId,
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    const result = await db.collection('processes')
      .add({ data: processData })
    
    return ApiResponse.success({
        id: result._id,
        ...processData
      }, '操作成功')
  } catch (error) {
    console.error('添加流程错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '添加流程失败')
  }
}

/**
 * 更新流程
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateProcess(userInfo, params) {
  try {
    const { id, name, description, factory_id, unit_price, estimated_time, status } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少流程ID')
    }
    
    // 验证流程是否存在且属于当前组织
    const process = await db.collection('processes')
      .doc(id)
      .get()
    
    if (!process.data || process.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '流程不存在或无权限修改')
    }
    
    // 如果修改了工厂，验证新工厂是否存在
    if (factory_id && factory_id !== process.data.factory_id) {
      const factory = await db.collection('factories')
        .doc(factory_id)
        .get()
      
      if (!factory.data || factory.data.org_id !== userInfo.orgId) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂不存在或无权限访问')
      }
    }
    
    // 如果修改了名称，检查是否重复
    if (name && name !== process.data.name) {
      const existingProcess = await db.collection('processes')
        .where({
          org_id: userInfo.orgId,
          factory_id: factory_id || process.data.factory_id,
          name: name,
          _id: _.neq(id)
        })
        .get()
      
      if (existingProcess.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '该工厂下已存在同名流程')
      }
    }
    
    const updateData = {
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (factory_id !== undefined) updateData.factory_id = factory_id
    if (unit_price !== undefined) updateData.unit_price = parseFloat(unit_price) || 0
    if (estimated_time !== undefined) updateData.estimated_time = parseInt(estimated_time) || 0
    if (status !== undefined) updateData.status = status
    
    await db.collection('processes')
      .doc(id)
      .update({ data: updateData })
    
    return ApiResponse.success({ id, ...updateData
    }, '操作成功')
  } catch (error) {
    console.error('更新流程错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新流程失败')
  }
}

/**
 * 删除流程
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteProcess(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少流程ID')
    }
    
    // 验证流程是否存在且属于当前组织
    const process = await db.collection('processes')
      .doc(id)
      .get()
    
    if (!process.data || process.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '流程不存在或无权限删除')
    }
    
    // 检查是否有关联的订单明细
    const [sendOrderItems, receiveOrderItems] = await Promise.all([
      db.collection('send_order_items').where({ process_id: id }).limit(1).get(),
      db.collection('receive_order_items').where({ process_id: id }).limit(1).get()
    ])
    
    if (sendOrderItems.data.length > 0 || receiveOrderItems.data.length > 0) {
      // 如果有关联订单，执行软删除
      await db.collection('processes')
        .doc(id)
        .update({
          data: {
            status: 'deleted',
            deleted_at: new Date(),
            deleted_by: userInfo.userId,
            updated_at: new Date(),
            updated_by: userInfo.userId
          }
        })
      
      return {
        success: true,
        message: '流程已标记为删除（因存在关联订单）'
      }
    } else {
      // 没有关联订单，可以物理删除
      await db.collection('processes')
        .doc(id)
        .remove()
      
      return {
        success: true,
        message: '流程删除成功'
      }
    }
  } catch (error) {
    console.error('删除流程错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除流程失败')
  }
}

/**
 * 获取工厂的流程列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getProcessesByFactory(userInfo, params) {
  try {
    const { factory_id, status = 'active' } = params
    
    if (!factory_id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少工厂ID')
    }
    
    // 验证工厂是否存在且属于当前组织
    const factory = await db.collection('factories')
      .doc(factory_id)
      .get()
    
    if (!factory.data || factory.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂不存在或无权限访问')
    }
    
    let whereCondition = {
      org_id: userInfo.orgId,
      factory_id: factory_id
    }
    
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    const result = await db.collection('processes')
      .where(whereCondition)
      .orderBy('name', 'asc')
      .get()
    
    return ApiResponse.success(result.data, '操作成功')
  } catch (error) {
    console.error('获取工厂流程列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取工厂流程列表失败')
  }
}

/**
 * 批量更新流程状态
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function batchUpdateProcessStatus(userInfo, params) {
  try {
    const { ids, status } = params
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少流程ID列表')
    }
    
    if (!['active', 'inactive'].includes(status)) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无效的状态值')
    }
    
    // 验证所有流程都属于当前组织
    const processes = await db.collection('processes')
      .where({
        _id: _.in(ids),
        org_id: userInfo.orgId
      })
      .get()
    
    if (processes.data.length !== ids.length) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '部分流程不存在或无权限修改')
    }
    
    // 批量更新
    const updatePromises = ids.map(id => 
      db.collection('processes')
        .doc(id)
        .update({
          data: {
            status,
            updated_at: new Date(),
            updated_by: userInfo.userId
          }
        })
    )
    
    await Promise.all(updatePromises)
    
    return {
      success: true,
      message: `成功更新 ${ids.length} 个流程的状态`
    }
  } catch (error) {
    console.error('批量更新流程状态错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '批量更新流程状态失败')
  }
}

module.exports = {
  getProcesses,
  getProcessById,
  addProcess,
  updateProcess,
  deleteProcess,
  getProcessesByFactory,
  batchUpdateProcessStatus
}