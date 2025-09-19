// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')
const moment = require('moment')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const JWT_SECRET = 'yunsf-jwt-secret-2024' // 生产环境应使用环境变量

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, token, ...params } = event
  
  try {
    // 验证token
    const authResult = await verifyToken(token)
    if (!authResult.success) {
      return authResult
    }
    const userInfo = authResult.data
    
    // 路由到具体的处理函数
    switch (action) {
      // 订单查询
      case 'getOrders':
        return await getOrders(userInfo, params)
      case 'getOrderDetail':
        return await getOrderDetail(userInfo, params)
      case 'searchOrders':
        return await searchOrders(userInfo, params)
      
      // 发货订单
      case 'addSendOrder':
        return await addSendOrder(userInfo, params)
      case 'updateSendOrder':
        return await updateSendOrder(userInfo, params)
      case 'deleteSendOrder':
        return await deleteSendOrder(userInfo, params)
      
      // 收货订单
      case 'addReceiveOrder':
        return await addReceiveOrder(userInfo, params)
      case 'updateReceiveOrder':
        return await updateReceiveOrder(userInfo, params)
      case 'deleteReceiveOrder':
        return await deleteReceiveOrder(userInfo, params)
      
      // 订单状态管理
      case 'updateOrderStatus':
        return await updateOrderStatus(userInfo, params)
      case 'batchUpdateStatus':
        return await batchUpdateStatus(userInfo, params)
      
      // 订单统计
      case 'getOrderStats':
        return await getOrderStats(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('订单云函数错误:', error)
    return {
      success: false,
      error: error.message || '服务器内部错误'
    }
  }
}

// 验证token
async function verifyToken(token) {
  if (!token) {
    return {
      success: false,
      error: '未提供认证token'
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // 查询用户是否仍然有效
    const userResult = await db.collection('users')
      .doc(decoded.userId)
      .get()

    if (!userResult.data || userResult.data.status !== 'active') {
      return {
        success: false,
        error: '用户已被禁用'
      }
    }

    return {
      success: true,
      data: {
        userId: decoded.userId,
        username: decoded.username,
        orgId: decoded.orgId,
        roleId: decoded.roleId
      }
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        success: false,
        error: 'token_expired',
        message: 'Token已过期'
      }
    }
    
    return {
      success: false,
      error: 'Token无效'
    }
  }
}

// 获取订单列表
async function getOrders(userInfo, params) {
  try {
    const { 
      type = 'all', // all, send, receive
      page = 1, 
      limit = 20, 
      status = '',
      startDate = '',
      endDate = ''
    } = params
    
    let collections = []
    
    // 根据类型确定查询的集合
    if (type === 'all' || type === 'send') {
      collections.push('send_orders')
    }
    if (type === 'all' || type === 'receive') {
      collections.push('receive_orders')
    }
    
    let allOrders = []
    
    // 查询每个集合
    for (const collection of collections) {
      let query = db.collection(collection)
        .where({
          org_id: userInfo.orgId
        })
      
      // 状态筛选
      if (status) {
        query = query.where({
          status: status
        })
      }
      
      // 日期筛选
      if (startDate || endDate) {
        const dateFilter = {}
        if (startDate) dateFilter[_.gte] = new Date(startDate)
        if (endDate) dateFilter[_.lte] = new Date(endDate)
        
        query = query.where({
          created_at: dateFilter
        })
      }
      
      const result = await query
        .orderBy('created_at', 'desc')
        .get()
      
      // 添加订单类型标识
      const ordersWithType = result.data.map(order => ({
        ...order,
        orderType: collection === 'send_orders' ? 'send' : 'receive'
      }))
      
      allOrders = allOrders.concat(ordersWithType)
    }
    
    // 按创建时间排序
    allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    // 分页
    const total = allOrders.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedOrders = allOrders.slice(startIndex, endIndex)
    
    return {
      success: true,
      data: {
        orders: paginatedOrders,
        total: total,
        page: page,
        limit: limit
      }
    }
  } catch (error) {
    console.error('获取订单列表错误:', error)
    return {
      success: false,
      error: '获取订单列表失败'
    }
  }
}

// 获取订单详情
async function getOrderDetail(userInfo, params) {
  try {
    const { id, type } = params
    
    if (!id || !type) {
      return {
        success: false,
        error: '订单ID和类型不能为空'
      }
    }
    
    const collection = type === 'send' ? 'send_orders' : 'receive_orders'
    const itemCollection = type === 'send' ? 'send_order_items' : 'receive_order_items'
    
    // 获取订单基本信息
    const orderResult = await db.collection(collection)
      .doc(id)
      .get()
    
    if (!orderResult.data) {
      return {
        success: false,
        error: '订单不存在'
      }
    }
    
    // 获取订单明细
    const itemsResult = await db.collection(itemCollection)
      .where({
        order_id: id
      })
      .get()
    
    const order = {
      ...orderResult.data,
      orderType: type,
      items: itemsResult.data
    }
    
    return {
      success: true,
      data: order
    }
  } catch (error) {
    console.error('获取订单详情错误:', error)
    return {
      success: false,
      error: '获取订单详情失败'
    }
  }
}

// 搜索订单
async function searchOrders(userInfo, params) {
  try {
    const { keyword, type = 'all' } = params
    
    if (!keyword) {
      return {
        success: false,
        error: '搜索关键词不能为空'
      }
    }
    
    let collections = []
    
    // 根据类型确定查询的集合
    if (type === 'all' || type === 'send') {
      collections.push('send_orders')
    }
    if (type === 'all' || type === 'receive') {
      collections.push('receive_orders')
    }
    
    let allOrders = []
    
    // 查询每个集合
    for (const collection of collections) {
      // 按订单号搜索
      const orderNoResult = await db.collection(collection)
        .where({
          org_id: userInfo.orgId,
          order_no: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        })
        .get()
      
      // 按备注搜索
      const remarkResult = await db.collection(collection)
        .where({
          org_id: userInfo.orgId,
          remark: db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        })
        .get()
      
      // 合并结果并去重
      const combinedResults = [...orderNoResult.data, ...remarkResult.data]
      const uniqueResults = combinedResults.filter((order, index, self) => 
        index === self.findIndex(o => o._id === order._id)
      )
      
      // 添加订单类型标识
      const ordersWithType = uniqueResults.map(order => ({
        ...order,
        orderType: collection === 'send_orders' ? 'send' : 'receive'
      }))
      
      allOrders = allOrders.concat(ordersWithType)
    }
    
    // 按创建时间排序
    allOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    return {
      success: true,
      data: allOrders
    }
  } catch (error) {
    console.error('搜索订单错误:', error)
    return {
      success: false,
      error: '搜索订单失败'
    }
  }
}

// 添加发货订单
async function addSendOrder(userInfo, params) {
  try {
    const { 
      factory_id, 
      order_no, 
      remark = '', 
      items = [] 
    } = params
    
    if (!factory_id || !order_no) {
      return {
        success: false,
        error: '工厂和订单号不能为空'
      }
    }
    
    if (!items || items.length === 0) {
      return {
        success: false,
        error: '订单明细不能为空'
      }
    }
    
    // 生成订单号（如果没有提供）
    const finalOrderNo = order_no || `SO${moment().format('YYYYMMDD')}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    
    // 创建订单
    const order = {
      factory_id,
      order_no: finalOrderNo,
      remark,
      status: 'pending',
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const orderResult = await db.collection('send_orders').add({
      data: order
    })
    
    // 创建订单明细
    const orderItems = items.map(item => ({
      order_id: orderResult._id,
      product_id: item.product_id,
      process_id: item.process_id,
      color_id: item.color_id,
      size_id: item.size_id,
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      total_price: (item.quantity || 0) * (item.unit_price || 0),
      remark: item.remark || '',
      created_at: new Date()
    }))
    
    // 批量插入订单明细
    for (const item of orderItems) {
      await db.collection('send_order_items').add({
        data: item
      })
    }
    
    return {
      success: true,
      data: {
        id: orderResult._id,
        order_no: finalOrderNo,
        ...order
      }
    }
  } catch (error) {
    console.error('添加发货订单错误:', error)
    return {
      success: false,
      error: '添加发货订单失败'
    }
  }
}

// 添加收货订单
async function addReceiveOrder(userInfo, params) {
  try {
    const { 
      factory_id, 
      order_no, 
      remark = '', 
      items = [] 
    } = params
    
    if (!factory_id || !order_no) {
      return {
        success: false,
        error: '工厂和订单号不能为空'
      }
    }
    
    if (!items || items.length === 0) {
      return {
        success: false,
        error: '订单明细不能为空'
      }
    }
    
    // 生成订单号（如果没有提供）
    const finalOrderNo = order_no || `RO${moment().format('YYYYMMDD')}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    
    // 创建订单
    const order = {
      factory_id,
      order_no: finalOrderNo,
      remark,
      status: 'pending',
      org_id: userInfo.orgId,
      created_by: userInfo.userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const orderResult = await db.collection('receive_orders').add({
      data: order
    })
    
    // 创建订单明细
    const orderItems = items.map(item => ({
      order_id: orderResult._id,
      product_id: item.product_id,
      process_id: item.process_id,
      color_id: item.color_id,
      size_id: item.size_id,
      quantity: item.quantity,
      unit_price: item.unit_price || 0,
      total_price: (item.quantity || 0) * (item.unit_price || 0),
      remark: item.remark || '',
      created_at: new Date()
    }))
    
    // 批量插入订单明细
    for (const item of orderItems) {
      await db.collection('receive_order_items').add({
        data: item
      })
    }
    
    return {
      success: true,
      data: {
        id: orderResult._id,
        order_no: finalOrderNo,
        ...order
      }
    }
  } catch (error) {
    console.error('添加收货订单错误:', error)
    return {
      success: false,
      error: '添加收货订单失败'
    }
  }
}

// 更新订单状态
async function updateOrderStatus(userInfo, params) {
  try {
    const { id, type, status } = params
    
    if (!id || !type || !status) {
      return {
        success: false,
        error: '订单ID、类型和状态不能为空'
      }
    }
    
    const collection = type === 'send' ? 'send_orders' : 'receive_orders'
    
    await db.collection(collection)
      .doc(id)
      .update({
        data: {
          status: status,
          updated_at: new Date()
        }
      })
    
    return {
      success: true,
      message: '订单状态更新成功'
    }
  } catch (error) {
    console.error('更新订单状态错误:', error)
    return {
      success: false,
      error: '更新订单状态失败'
    }
  }
}

// 获取订单统计
async function getOrderStats(userInfo, params) {
  try {
    const { startDate, endDate } = params
    
    // 构建查询条件
    let dateFilter = {}
    if (startDate || endDate) {
      dateFilter.created_at = {}
      if (startDate) dateFilter.created_at[_.gte] = new Date(startDate)
      if (endDate) dateFilter.created_at[_.lte] = new Date(endDate)
    }
    
    // 获取发货订单统计
    const sendOrdersResult = await db.collection('send_orders')
      .where({
        org_id: userInfo.orgId,
        ...dateFilter
      })
      .get()
    
    // 获取收货订单统计
    const receiveOrdersResult = await db.collection('receive_orders')
      .where({
        org_id: userInfo.orgId,
        ...dateFilter
      })
      .get()
    
    // 按状态分组统计
    const sendOrdersByStatus = {}
    const receiveOrdersByStatus = {}
    
    sendOrdersResult.data.forEach(order => {
      sendOrdersByStatus[order.status] = (sendOrdersByStatus[order.status] || 0) + 1
    })
    
    receiveOrdersResult.data.forEach(order => {
      receiveOrdersByStatus[order.status] = (receiveOrdersByStatus[order.status] || 0) + 1
    })
    
    return {
      success: true,
      data: {
        sendOrders: {
          total: sendOrdersResult.data.length,
          byStatus: sendOrdersByStatus
        },
        receiveOrders: {
          total: receiveOrdersResult.data.length,
          byStatus: receiveOrdersByStatus
        },
        totalOrders: sendOrdersResult.data.length + receiveOrdersResult.data.length,
        period: {
          startDate,
          endDate
        }
      }
    }
  } catch (error) {
    console.error('获取订单统计错误:', error)
    return {
      success: false,
      error: '获取订单统计失败'
    }
  }
}

// 批量更新订单状态
async function batchUpdateStatus(userInfo, params) {
  try {
    const { orders, status } = params
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return {
        success: false,
        error: '订单列表不能为空'
      }
    }
    
    if (!status) {
      return {
        success: false,
        error: '状态不能为空'
      }
    }
    
    // 按类型分组
    const sendOrders = orders.filter(order => order.type === 'send')
    const receiveOrders = orders.filter(order => order.type === 'receive')
    
    // 批量更新发货订单
    for (const order of sendOrders) {
      await db.collection('send_orders')
        .doc(order.id)
        .update({
          data: {
            status: status,
            updated_at: new Date()
          }
        })
    }
    
    // 批量更新收货订单
    for (const order of receiveOrders) {
      await db.collection('receive_orders')
        .doc(order.id)
        .update({
          data: {
            status: status,
            updated_at: new Date()
          }
        })
    }
    
    return {
      success: true,
      message: `成功更新${orders.length}个订单状态`
    }
  } catch (error) {
    console.error('批量更新订单状态错误:', error)
    return {
      success: false,
      error: '批量更新订单状态失败'
    }
  }
}

// 更新发货订单
async function updateSendOrder(userInfo, params) {
  try {
    const { id, factory_id, order_no, remark, status, items } = params
    
    if (!id) {
      return {
        success: false,
        error: '订单ID不能为空'
      }
    }
    
    // 更新订单基本信息
    const updateData = {
      updated_at: new Date()
    }
    
    if (factory_id !== undefined) updateData.factory_id = factory_id
    if (order_no !== undefined) updateData.order_no = order_no
    if (remark !== undefined) updateData.remark = remark
    if (status !== undefined) updateData.status = status
    
    await db.collection('send_orders')
      .doc(id)
      .update({
        data: updateData
      })
    
    // 如果提供了订单明细，则更新明细
    if (items && Array.isArray(items)) {
      // 删除原有明细
      const existingItems = await db.collection('send_order_items')
        .where({
          order_id: id
        })
        .get()
      
      for (const item of existingItems.data) {
        await db.collection('send_order_items')
          .doc(item._id)
          .remove()
      }
      
      // 添加新明细
      for (const item of items) {
        await db.collection('send_order_items').add({
          data: {
            order_id: id,
            product_id: item.product_id,
            process_id: item.process_id,
            color_id: item.color_id,
            size_id: item.size_id,
            quantity: item.quantity,
            unit_price: item.unit_price || 0,
            total_price: (item.quantity || 0) * (item.unit_price || 0),
            remark: item.remark || '',
            created_at: new Date()
          }
        })
      }
    }
    
    return {
      success: true,
      message: '发货订单更新成功'
    }
  } catch (error) {
    console.error('更新发货订单错误:', error)
    return {
      success: false,
      error: '更新发货订单失败'
    }
  }
}

// 更新收货订单
async function updateReceiveOrder(userInfo, params) {
  try {
    const { id, factory_id, order_no, remark, status, items } = params
    
    if (!id) {
      return {
        success: false,
        error: '订单ID不能为空'
      }
    }
    
    // 更新订单基本信息
    const updateData = {
      updated_at: new Date()
    }
    
    if (factory_id !== undefined) updateData.factory_id = factory_id
    if (order_no !== undefined) updateData.order_no = order_no
    if (remark !== undefined) updateData.remark = remark
    if (status !== undefined) updateData.status = status
    
    await db.collection('receive_orders')
      .doc(id)
      .update({
        data: updateData
      })
    
    // 如果提供了订单明细，则更新明细
    if (items && Array.isArray(items)) {
      // 删除原有明细
      const existingItems = await db.collection('receive_order_items')
        .where({
          order_id: id
        })
        .get()
      
      for (const item of existingItems.data) {
        await db.collection('receive_order_items')
          .doc(item._id)
          .remove()
      }
      
      // 添加新明细
      for (const item of items) {
        await db.collection('receive_order_items').add({
          data: {
            order_id: id,
            product_id: item.product_id,
            process_id: item.process_id,
            color_id: item.color_id,
            size_id: item.size_id,
            quantity: item.quantity,
            unit_price: item.unit_price || 0,
            total_price: (item.quantity || 0) * (item.unit_price || 0),
            remark: item.remark || '',
            created_at: new Date()
          }
        })
      }
    }
    
    return {
      success: true,
      message: '收货订单更新成功'
    }
  } catch (error) {
    console.error('更新收货订单错误:', error)
    return {
      success: false,
      error: '更新收货订单失败'
    }
  }
}

// 删除发货订单
async function deleteSendOrder(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return {
        success: false,
        error: '订单ID不能为空'
      }
    }
    
    // 删除订单明细
    const items = await db.collection('send_order_items')
      .where({
        order_id: id
      })
      .get()
    
    for (const item of items.data) {
      await db.collection('send_order_items')
        .doc(item._id)
        .remove()
    }
    
    // 删除订单
    await db.collection('send_orders')
      .doc(id)
      .remove()
    
    return {
      success: true,
      message: '发货订单删除成功'
    }
  } catch (error) {
    console.error('删除发货订单错误:', error)
    return {
      success: false,
      error: '删除发货订单失败'
    }
  }
}

// 删除收货订单
async function deleteReceiveOrder(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return {
        success: false,
        error: '订单ID不能为空'
      }
    }
    
    // 删除订单明细
    const items = await db.collection('receive_order_items')
      .where({
        order_id: id
      })
      .get()
    
    for (const item of items.data) {
      await db.collection('receive_order_items')
        .doc(item._id)
        .remove()
    }
    
    // 删除订单
    await db.collection('receive_orders')
      .doc(id)
      .remove()
    
    return {
      success: true,
      message: '收货订单删除成功'
    }
  } catch (error) {
    console.error('删除收货订单错误:', error)
    return {
      success: false,
      error: '删除收货订单失败'
    }
  }
}