// 工厂管理相关处理函数
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
 * 获取工厂列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFactories(userInfo, params) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      status = 'all' 
    } = params
    
    // 构建查询条件
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
    const result = await db.collection('factories')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数和统计信息
    const [countResult, activeCountResult, inactiveCountResult] = await Promise.all([
      db.collection('factories').where({ org_id: userInfo.orgId }).count(),
      db.collection('factories').where({ org_id: userInfo.orgId, status: 'active' }).count(),
      db.collection('factories').where({ org_id: userInfo.orgId, status: 'inactive' }).count()
    ])
    
    // 处理工厂数据
    const factories = result.data.map(factory => {
      // 安全解析processes字段
      let processes = []
      if (factory.processes) {
        try {
          processes = typeof factory.processes === 'string' 
            ? JSON.parse(factory.processes) 
            : factory.processes
        } catch (e) {
          console.warn('解析工厂processes字段失败:', e)
          processes = []
        }
      }
      
      return {
        ...factory,
        processes,
        status: factory.status || 'active' // 确保状态字段存在
      }
    })
    
    return ApiResponse.success({
        factories,
        total: countResult.total,
        activeCount: activeCountResult.total,
        inactiveCount: inactiveCountResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      
      }, '操作成功')
  } catch (error) {
    console.error('获取工厂列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取工厂列表失败')
  }
}

/**
 * 添加工厂
 * @param {Object} userInfo 用户信息
 * @param {Object} params 工厂数据
 */
async function addFactory(userInfo, params) {
  try {
    const { name, address, contact, phone, processes = [] } = params
    
    // 验证必填字段
    if (!name || !address) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂名称和地址为必填项')
    }
    
    // 检查工厂名称是否重复
    const existingFactory = await db.collection('factories')
      .where({
        org_id: userInfo.orgId,
        name: name
      })
      .get()
    
    if (existingFactory.data.length > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂名称已存在')
    }
    
    // 创建工厂记录
    const factoryData = {
      name,
      address,
      contact: contact || '',
      phone: phone || '',
      processes: Array.isArray(processes) ? processes : [],
      status: 'active',
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('factories').add({
      data: factoryData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...factoryData
      }, '操作成功')
  } catch (error) {
    console.error('添加工厂错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '添加工厂失败')
  }
}

/**
 * 更新工厂
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateFactory(userInfo, params) {
  try {
    const { id, name, address, contact, phone, processes, status } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少工厂ID')
    }
    
    // 验证工厂是否存在且属于当前组织
    const factory = await db.collection('factories')
      .doc(id)
      .get()
    
    if (!factory.data || factory.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂不存在或无权限修改')
    }
    
    // 如果修改名称，检查是否重复
    if (name && name !== factory.data.name) {
      const existingFactory = await db.collection('factories')
        .where({
          org_id: userInfo.orgId,
          name: name,
          _id: _.neq(id)
        })
        .get()
      
      if (existingFactory.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂名称已存在')
      }
    }
    
    // 构建更新数据
    const updateData = {
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    if (name !== undefined) updateData.name = name
    if (address !== undefined) updateData.address = address
    if (contact !== undefined) updateData.contact = contact
    if (phone !== undefined) updateData.phone = phone
    if (processes !== undefined) updateData.processes = Array.isArray(processes) ? processes : []
    if (status !== undefined) updateData.status = status
    
    await db.collection('factories')
      .doc(id)
      .update({
        data: updateData
      })
    
    return ApiResponse.success({
        id,
        ...updateData
    }, '操作成功')
  } catch (error) {
    console.error('更新工厂错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新工厂失败')
  }
}

/**
 * 删除工厂
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteFactory(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少工厂ID')
    }
    
    // 验证工厂是否存在且属于当前组织
    const factory = await db.collection('factories')
      .doc(id)
      .get()
    
    if (!factory.data || factory.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂不存在或无权限删除')
    }
    
    // 检查是否有关联的订单
    const [sendOrdersCount, receiveOrdersCount] = await Promise.all([
      db.collection('send_orders').where({ factory_id: id }).count(),
      db.collection('receive_orders').where({ factory_id: id }).count()
    ])
    
    if (sendOrdersCount.total > 0 || receiveOrdersCount.total > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '该工厂存在关联订单，无法删除')
    }
    
    // 软删除：更新状态为deleted
    await db.collection('factories')
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
      message: '工厂删除成功'
    }
  } catch (error) {
    console.error('删除工厂错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除工厂失败')
  }
}

/**
 * 获取工厂详情
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFactoryById(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少工厂ID')
    }
    
    const result = await db.collection('factories')
      .doc(id)
      .get()
    
    if (!result.data || result.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂不存在或无权限访问')
    }
    
    // 处理processes字段
    let processes = []
    if (result.data.processes) {
      try {
        processes = typeof result.data.processes === 'string' 
          ? JSON.parse(result.data.processes) 
          : result.data.processes
      } catch (e) {
        console.warn('解析工厂processes字段失败:', e)
        processes = []
      }
    }
    
    return ApiResponse.success({
        ...result.data,
        processes
      }, '操作成功')
  } catch (error) {
    console.error('获取工厂详情错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取工厂详情失败')
  }
}

/**
 * 更新工厂状态
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新参数
 */
async function updateFactoryStatus(userInfo, params) {
  try {
    const { id, status } = params
    
    if (!id || !status) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂ID和状态为必填项')
    }
    
    const result = await db.collection('factories')
      .doc(id)
      .update({
        data: {
          status: status,
          updated_at: new Date(),
          updated_by: userInfo.userId
        }
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('更新工厂状态错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新工厂状态失败')
  }
}

/**
 * 获取工厂账户信息
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFactoryAccounts(userInfo, params) {
  try {
    const { factory_id, page = 1, limit = 20 } = params
    
    if (!factory_id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂ID为必填项')
    }
    
    // 获取工厂账户记录
    const result = await db.collection('factory_accounts')
      .where({
        org_id: userInfo.orgId,
        factory_id: factory_id
      })
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('factory_accounts')
      .where({
        org_id: userInfo.orgId,
        factory_id: factory_id
      })
      .count()
    
    return ApiResponse.success({
        accounts: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取工厂账户错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取工厂账户失败')
  }
}

/**
 * 添加工厂付款记录
 * @param {Object} userInfo 用户信息
 * @param {Object} params 付款数据
 */
async function addFactoryPayment(userInfo, params) {
  try {
    const { factory_id, amount, type, description = '', payment_date } = params
    
    if (!factory_id || !amount || !type) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂ID、金额和类型为必填项')
    }
    
    const paymentData = {
      factory_id,
      amount: parseFloat(amount),
      type, // 'payment' 付款, 'receivable' 应收
      description,
      payment_date: payment_date ? new Date(payment_date) : new Date(),
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('factory_accounts').add({
      data: paymentData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...paymentData
      }, '操作成功')
  } catch (error) {
    console.error('添加工厂付款记录错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '添加工厂付款记录失败')
  }
}

/**
 * 获取工厂统计信息
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFactoryStats(userInfo, params) {
  try {
    const { factory_id } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (factory_id) {
      whereCondition.factory_id = factory_id
    }
    
    // 获取发货订单统计
    const sendOrdersStats = await db.collection('send_orders')
      .where(whereCondition)
      .get()
    
    // 获取收货订单统计
    const receiveOrdersStats = await db.collection('receive_orders')
      .where(whereCondition)
      .get()
    
    // 计算统计数据
    const totalSendOrders = sendOrdersStats.data.length
    const totalReceiveOrders = receiveOrdersStats.data.length
    
    const totalSendQuantity = sendOrdersStats.data.reduce((sum, order) => {
      return sum + (order.quantity || 0)
    }, 0)
    
    const totalReceiveQuantity = receiveOrdersStats.data.reduce((sum, order) => {
      return sum + (order.quantity || 0)
    }, 0)
    
    return ApiResponse.success({
        totalSendOrders,
        totalReceiveOrders,
        totalSendQuantity,
        totalReceiveQuantity,
        pendingQuantity: totalSendQuantity - totalReceiveQuantity
      }, '操作成功')
  } catch (error) {
    console.error('获取工厂统计错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取工厂统计失败')
  }
}

module.exports = {
  getFactories,
  addFactory,
  updateFactory,
  deleteFactory,
  getFactoryById,
  updateFactoryStatus,
  getFactoryAccounts,
  addFactoryPayment,
  getFactoryStats
}