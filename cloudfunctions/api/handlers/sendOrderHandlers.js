// 发货单管理相关处理函数
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
 * 获取发货单列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getSendOrders(userInfo, params) {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      factory_id,
      process_id,
      start_date,
      end_date,
      search = '',
      created_by
    } = params
    
    // 构建查询条件
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    // 角色权限控制：专员只能查看自己制单的订单
    if (userInfo.roleId === 'specialist') {
      whereCondition.created_by = userInfo.userId
    }
    
    // 状态过滤
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    // 工厂过滤
    if (factory_id) {
      whereCondition.factory_id = factory_id
    }
    
    // 工序过滤
    if (process_id) {
      whereCondition.process_id = process_id
    }
    
    // 制单人过滤
    if (created_by) {
      whereCondition.created_by = created_by
    }
    
    // 日期范围过滤
    if (start_date || end_date) {
      whereCondition.order_date = {}
      if (start_date) {
        whereCondition.order_date[_.gte] = new Date(start_date)
      }
      if (end_date) {
        whereCondition.order_date[_.lte] = new Date(end_date + ' 23:59:59')
      }
    }
    
    // 关键词搜索
    if (search) {
      whereCondition[_.or] = [
        { order_number: db.RegExp({ regexp: search, options: 'i' }) },
        { remark: db.RegExp({ regexp: search, options: 'i' }) }
      ]
    }
    
    // 分页查询
    const result = await db.collection('send_orders')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await db.collection('send_orders')
      .where(whereCondition)
      .count()
    
    // 关联查询工厂、工序、用户信息
    const orders = await Promise.all(result.data.map(async (order) => {
      const [factory, process, creator] = await Promise.all([
        order.factory_id ? db.collection('factories').doc(order.factory_id).get().catch(() => null) : null,
        order.process_id ? db.collection('processes').doc(order.process_id).get().catch(() => null) : null,
        order.created_by ? db.collection('users').doc(order.created_by).get().catch(() => null) : null
      ])
      
      return {
        ...order,
        factory_name: factory?.data?.name || '',
        process_name: process?.data?.name || '',
        creator_name: creator?.data?.username || ''
      }
    }))
    
    return ApiResponse.success({
        orders,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取发货单列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取发货单列表失败')
  }
}

/**
 * 获取发货单详情
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getSendOrderById(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少发货单ID')
    }
    
    // 获取发货单基本信息
    const orderResult = await db.collection('send_orders')
      .doc(id)
      .get()
    
    if (!orderResult.data || orderResult.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '发货单不存在或无权限访问')
    }
    
    // 权限检查：专员只能查看自己的订单
    if (userInfo.roleId === 'specialist' && orderResult.data.created_by !== userInfo.userId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限访问此发货单')
    }
    
    // 获取发货单明细
    const itemsResult = await db.collection('send_order_items')
      .where({ send_order_id: id })
      .get()
    
    // 关联查询相关信息
    const [factory, process, creator] = await Promise.all([
      orderResult.data.factory_id ? db.collection('factories').doc(orderResult.data.factory_id).get().catch(() => null) : null,
      orderResult.data.process_id ? db.collection('processes').doc(orderResult.data.process_id).get().catch(() => null) : null,
      orderResult.data.created_by ? db.collection('users').doc(orderResult.data.created_by).get().catch(() => null) : null
    ])
    
    // 处理明细项，关联产品、颜色、尺码信息
    const items = await Promise.all(itemsResult.data.map(async (item) => {
      const [product, color, size] = await Promise.all([
        item.product_id ? db.collection('products').doc(item.product_id).get().catch(() => null) : null,
        item.color_id ? db.collection('colors').doc(item.color_id).get().catch(() => null) : null,
        item.size_id ? db.collection('sizes').doc(item.size_id).get().catch(() => null) : null
      ])
      
      return {
        ...item,
        product_name: product?.data?.name || '',
        color_name: color?.data?.name || '',
        size_name: size?.data?.name || ''
      }
    }))
    
    return ApiResponse.success({
        ...orderResult.data,
        factory_name: factory?.data?.name || '',
        process_name: process?.data?.name || '',
        creator_name: creator?.data?.username || '',
        items
      
      }, '操作成功')
  } catch (error) {
    console.error('获取发货单详情错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取发货单详情失败')
  }
}

/**
 * 创建发货单
 * @param {Object} userInfo 用户信息
 * @param {Object} params 发货单数据
 */
async function addSendOrder(userInfo, params) {
  try {
    const {
      factory_id,
      process_id,
      order_date,
      remark = '',
      items = []
    } = params
    
    // 验证必填字段
    if (!factory_id || !process_id || !order_date) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '工厂、工序和发货日期为必填项')
    }
    
    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '发货明细不能为空')
    }
    
    // 验证明细项
    for (const item of items) {
      if (!item.product_id || !item.color_id || !item.size_id || !item.quantity || item.quantity <= 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '发货明细信息不完整或数量无效')
      }
    }
    
    // 生成发货单号
    const orderNumber = await generateSendOrderNumber(userInfo.orgId)
    
    // 计算总数量
    const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.quantity), 0)
    
    // 创建发货单
    const orderData = {
      order_number: orderNumber,
      factory_id,
      process_id,
      order_date: new Date(order_date),
      total_quantity: totalQuantity,
      status: 'pending',
      remark,
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const orderResult = await db.collection('send_orders').add({
      data: orderData
    })
    
    const orderId = orderResult._id
    
    // 创建发货单明细
    const itemsData = items.map(item => ({
      send_order_id: orderId,
      product_id: item.product_id,
      color_id: item.color_id,
      size_id: item.size_id,
      quantity: parseInt(item.quantity),
      unit_price: parseFloat(item.unit_price || 0),
      total_price: parseFloat(item.unit_price || 0) * parseInt(item.quantity),
      remark: item.remark || '',
      created_at: new Date()
    }))
    
    await Promise.all(itemsData.map(itemData => 
      db.collection('send_order_items').add({ data: itemData })
    ))
    
    return ApiResponse.success({
        id: orderId,
        order_number: orderNumber,
        ...orderData
      }, '操作成功')
  } catch (error) {
    console.error('创建发货单错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '创建发货单失败')
  }
}

/**
 * 更新发货单
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateSendOrder(userInfo, params) {
  try {
    const {
      id,
      factory_id,
      process_id,
      order_date,
      status,
      remark,
      items
    } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少发货单ID')
    }
    
    // 验证发货单是否存在且有权限修改
    const orderResult = await db.collection('send_orders')
      .doc(id)
      .get()
    
    if (!orderResult.data || orderResult.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '发货单不存在或无权限修改')
    }
    
    // 权限检查：专员只能修改自己的订单，且只能在pending状态下修改
    if (userInfo.roleId === 'specialist') {
      if (orderResult.data.created_by !== userInfo.userId) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限修改此发货单')
      }
      if (orderResult.data.status !== 'pending') {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '只能修改待处理状态的发货单')
      }
    }
    
    // 构建更新数据
    const updateData = {
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    if (factory_id !== undefined) updateData.factory_id = factory_id
    if (process_id !== undefined) updateData.process_id = process_id
    if (order_date !== undefined) updateData.order_date = new Date(order_date)
    if (status !== undefined) updateData.status = status
    if (remark !== undefined) updateData.remark = remark
    
    // 如果更新了明细项
    if (items && Array.isArray(items)) {
      // 验证明细项
      for (const item of items) {
        if (!item.product_id || !item.color_id || !item.size_id || !item.quantity || item.quantity <= 0) {
          return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '发货明细信息不完整或数量无效')
        }
      }
      
      // 删除原有明细
      await db.collection('send_order_items')
        .where({ send_order_id: id })
        .remove()
      
      // 创建新明细
      const itemsData = items.map(item => ({
        send_order_id: id,
        product_id: item.product_id,
        color_id: item.color_id,
        size_id: item.size_id,
        quantity: parseInt(item.quantity),
        unit_price: parseFloat(item.unit_price || 0),
        total_price: parseFloat(item.unit_price || 0) * parseInt(item.quantity),
        remark: item.remark || '',
        created_at: new Date()
      }))
      
      await Promise.all(itemsData.map(itemData => 
        db.collection('send_order_items').add({ data: itemData })
      ))
      
      // 更新总数量
      updateData.total_quantity = items.reduce((sum, item) => sum + parseInt(item.quantity), 0)
    }
    
    // 更新发货单
    await db.collection('send_orders')
      .doc(id)
      .update({ data: updateData })
    
    return ApiResponse.success({
        id,
        ...updateData
    }, '操作成功')
  } catch (error) {
    console.error('更新发货单错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新发货单失败')
  }
}

/**
 * 删除发货单
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteSendOrder(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少发货单ID')
    }
    
    // 验证发货单是否存在且有权限删除
    const orderResult = await db.collection('send_orders')
      .doc(id)
      .get()
    
    if (!orderResult.data || orderResult.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '发货单不存在或无权限删除')
    }
    
    // 权限检查：专员只能删除自己的订单，且只能在pending状态下删除
    if (userInfo.roleId === 'specialist') {
      if (orderResult.data.created_by !== userInfo.userId) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限删除此发货单')
      }
      if (orderResult.data.status !== 'pending') {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '只能删除待处理状态的发货单')
      }
    }
    
    // 删除发货单明细
    await db.collection('send_order_items')
      .where({ send_order_id: id })
      .remove()
    
    // 删除发货单
    await db.collection('send_orders')
      .doc(id)
      .remove()
    
    return {
      success: true,
      message: '发货单删除成功'
    }
  } catch (error) {
    console.error('删除发货单错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除发货单失败')
  }
}

/**
 * 生成发货单号
 * @param {String} orgId 组织ID
 */
async function generateSendOrderNumber(orgId) {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `SO${dateStr}`
  
  // 查询今天已有的发货单数量
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  
  const countResult = await db.collection('send_orders')
    .where({
      org_id: orgId,
      created_at: _.gte(startOfDay).and(_.lt(endOfDay))
    })
    .count()
  
  const sequence = (countResult.total + 1).toString().padStart(3, '0')
  return `${prefix}${sequence}`
}

module.exports = {
  getSendOrders,
  getSendOrderById,
  addSendOrder,
  updateSendOrder,
  deleteSendOrder
}