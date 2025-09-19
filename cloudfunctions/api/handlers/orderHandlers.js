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
 * 获取订单列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getOrders(userInfo, params) {
  try {
    const { page = 1, limit = 20, status, factory_id, product_id, start_date, end_date } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (status) {
      whereCondition.status = status
    }
    
    if (factory_id) {
      whereCondition.factory_id = factory_id
    }
    
    if (product_id) {
      whereCondition.product_id = product_id
    }
    
    if (start_date && end_date) {
      whereCondition.created_at = _.and([
        _.gte(new Date(start_date)),
        _.lte(new Date(end_date))
      ])
    }
    
    const result = await db.collection('orders')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('orders')
      .where(whereCondition)
      .count()
    
    return ApiResponse.paginated(
      result.data,
      countResult.total,
      parseInt(page),
      parseInt(limit),
      '订单列表获取成功'
    )
  } catch (error) {
    console.error('获取订单列表错误:', error)
    return ApiResponse.error(
      BusinessErrorCodes.DATABASE_ERROR,
      '获取订单列表失败',
      error.message
    )
  }
}

/**
 * 添加订单
 * @param {Object} userInfo 用户信息
 * @param {Object} params 订单数据
 */
async function addOrder(userInfo, params) {
  try {
    const { 
      factory_id, 
      product_id, 
      quantity, 
      unit_price, 
      total_amount, 
      delivery_date, 
      notes = '',
      order_type = 'normal'
    } = params
    
    if (!factory_id || !product_id || !quantity) {
      return ApiResponse.error(
        BusinessErrorCodes.INVALID_PARAMETER,
        '工厂ID、产品ID和数量为必填项'
      )
    }
    
    const orderData = {
      factory_id,
      product_id,
      quantity: parseInt(quantity),
      unit_price: parseFloat(unit_price || 0),
      total_amount: parseFloat(total_amount || 0),
      delivery_date: delivery_date ? new Date(delivery_date) : null,
      notes,
      order_type,
      status: 'pending',
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('orders').add({
      data: orderData
    })
    
    return ApiResponse.success(
      {
        id: result._id,
        ...orderData
      },
      '订单添加成功'
    )
  } catch (error) {
    console.error('添加订单错误:', error)
    return ApiResponse.error(
      BusinessErrorCodes.DATABASE_ERROR,
      '添加订单失败',
      error.message
    )
  }
}

/**
 * 删除订单
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteOrder(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '订单ID为必填项')
    }
    
    // 验证订单是否存在且属于当前组织
    const order = await db.collection('orders')
      .doc(id)
      .get()
    
    if (!order.data || order.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '订单不存在或无权限删除')
    }
    
    // 软删除：更新状态为deleted
    await db.collection('orders')
      .doc(id)
      .update({
        data: {
          status: 'deleted',
          deleted_at: new Date(),
          deleted_by: userInfo.userId
        }
      })
    
    return ApiResponse.success({ id 
      }, '操作成功')
  } catch (error) {
    console.error('删除订单错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除订单失败')
  }
}

/**
 * 取消订单
 * @param {Object} userInfo 用户信息
 * @param {Object} params 取消参数
 */
async function cancelOrder(userInfo, params) {
  try {
    const { id, reason = '' } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '订单ID为必填项')
    }
    
    const result = await db.collection('orders')
      .doc(id)
      .update({
        data: {
          status: 'cancelled',
          cancel_reason: reason,
          cancelled_at: new Date(),
          cancelled_by: userInfo.userId,
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success(result, '操作成功')
  } catch (error) {
    console.error('取消订单错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '取消订单失败')
  }
}

module.exports = {
  getOrders,
  addOrder,
  deleteOrder,
  cancelOrder
}