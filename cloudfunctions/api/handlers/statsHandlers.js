// 统计分析相关处理函数
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
 * 获取统计数据
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getStats(userInfo, params) {
  try {
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    // 获取当前日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // 获取本月第一天
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    
    // 今日发出单统计
    const todaySendOrders = await db.collection('send_orders')
      .where({
        org_id: orgId,
        status: 1,
        created_at: _.gte(today).and(_.lt(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
      })
      .get()
    
    const todaySendCount = todaySendOrders.data.length
    const todaySendWeight = todaySendOrders.data.reduce((sum, order) => sum + (order.total_weight || 0), 0)
    
    // 今日收回单统计
    const todayReceiveOrders = await db.collection('receive_orders')
      .where({
        org_id: orgId,
        status: 1,
        created_at: _.gte(today).and(_.lt(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
      })
      .get()
    
    const todayReceiveCount = todayReceiveOrders.data.length
    const todayReceiveWeight = todayReceiveOrders.data.reduce((sum, order) => sum + (order.total_weight || 0), 0)
    
    // 本月发出单统计
    const monthlySendOrders = await db.collection('send_orders')
      .where({
        org_id: orgId,
        status: 1,
        created_at: _.gte(firstDayOfMonth)
      })
      .get()
    
    const monthlySendCount = monthlySendOrders.data.length
    const monthlySendWeight = monthlySendOrders.data.reduce((sum, order) => sum + (order.total_weight || 0), 0)
    
    // 本月收回单统计
    const monthlyReceiveOrders = await db.collection('receive_orders')
      .where({
        org_id: orgId,
        status: 1,
        created_at: _.gte(firstDayOfMonth)
      })
      .get()
    
    const monthlyReceiveCount = monthlyReceiveOrders.data.length
    const monthlyReceiveWeight = monthlyReceiveOrders.data.reduce((sum, order) => sum + (order.total_weight || 0), 0)
    
    // 活跃工厂数量
    const activeFactories = await db.collection('factories')
      .where({
        org_id: orgId,
        status: 'active'
      })
      .count()
    
    // 活跃用户数量
    const activeUsers = await db.collection('users')
      .where({
        org_id: orgId,
        status: 'active'
      })
      .count()
    
    return ApiResponse.success({
        today: {
          send: {
            count: todaySendCount,
            weight: Math.round(todaySendWeight * 100) / 100
          },
          receive: {
            count: todayReceiveCount,
            weight: Math.round(todayReceiveWeight * 100) / 100
          }
        },
        monthly: {
          send: {
            count: monthlySendCount,
            weight: Math.round(monthlySendWeight * 100) / 100
          },
          receive: {
            count: monthlyReceiveCount,
            weight: Math.round(monthlyReceiveWeight * 100) / 100
          }
        },
        factories: {
          active: activeFactories.total
        },
        users: {
          active: activeUsers.total
        }
      }, '操作成功')
  } catch (error) {
    console.error('获取统计数据错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取统计数据失败')
  }
}

/**
 * 获取指定日期的统计数据
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getStatsForDate(userInfo, params) {
  try {
    const { date } = params
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    if (!date) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '日期参数不能为空')
    }
    
    // 解析日期
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
    
    // 指定日期发出单统计
    const sendOrders = await db.collection('send_orders')
      .where({
        org_id: orgId,
        status: 1,
        created_at: _.gte(targetDate).and(_.lt(nextDay))
      })
      .get()
    
    const sendCount = sendOrders.data.length
    const sendWeight = sendOrders.data.reduce((sum, order) => sum + (order.total_weight || 0), 0)
    
    // 指定日期收回单统计
    const receiveOrders = await db.collection('receive_orders')
      .where({
        org_id: orgId,
        status: 1,
        created_at: _.gte(targetDate).and(_.lt(nextDay))
      })
      .get()
    
    const receiveCount = receiveOrders.data.length
    const receiveWeight = receiveOrders.data.reduce((sum, order) => sum + (order.total_weight || 0), 0)
    
    return ApiResponse.success({
        date: date,
        send: {
          count: sendCount,
          weight: Math.round(sendWeight * 100) / 100
        },
        receive: {
          count: receiveCount,
          weight: Math.round(receiveWeight * 100) / 100
        }
      }, '操作成功')
  } catch (error) {
    console.error('获取指定日期统计数据错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取指定日期统计数据失败')
  }
}

/**
 * 获取今日统计数据
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getTodayStats(userInfo, params) {
  try {
    const today = new Date().toISOString().split('T')[0]
    return await getStatsForDate(userInfo, { date: today })
  } catch (error) {
    console.error('获取今日统计数据错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取今日统计数据失败')
  }
}

/**
 * 获取在线用户统计
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getOnlineUsers(userInfo, params) {
  try {
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    // 获取最近5分钟内活跃的用户
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    
    const onlineUsers = await db.collection('users')
      .where({
        org_id: orgId,
        status: 'active',
        last_active: _.gte(fiveMinutesAgo)
      })
      .field({
        username: true,
        real_name: true,
        last_active: true,
        role_id: true
      })
      .get()
    
    return ApiResponse.success({
        count: onlineUsers.data.length,
        users: onlineUsers.data
      }, '操作成功')
  } catch (error) {
    console.error('获取在线用户统计错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取在线用户统计失败')
  }
}

/**
 * 获取登录统计
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getLoginStats(userInfo, params) {
  try {
    const { range = 'week' } = params
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    let startDate
    const endDate = new Date()
    
    switch (range) {
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'year':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    }
    
    // 获取登录记录（这里简化处理，实际可能需要专门的登录日志表）
    const loginUsers = await db.collection('users')
      .where({
        org_id: orgId,
        status: 'active',
        last_login: _.gte(startDate)
      })
      .field({
        username: true,
        real_name: true,
        last_login: true,
        role_id: true
      })
      .orderBy('last_login', 'desc')
      .get()
    
    // 按日期分组统计
    const dailyStats = {}
    loginUsers.data.forEach(user => {
      if (user.last_login) {
        const dateKey = user.last_login.toISOString().split('T')[0]
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = 0
        }
        dailyStats[dateKey]++
      }
    })
    
    return ApiResponse.success({
        range: range,
        total_logins: loginUsers.data.length,
        daily_stats: dailyStats,
        recent_users: loginUsers.data.slice(0, 10) // 最近10个登录用户
      }, '操作成功')
  } catch (error) {
    console.error('获取登录统计错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取登录统计失败')
  }
}

/**
 * 获取流水记录
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFlowRecords(userInfo, params) {
  try {
    const { page = 1, limit = 20, start_date, end_date, type, factory_id } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (type) {
      whereCondition.type = type // 'send' 或 'receive'
    }
    
    if (factory_id) {
      whereCondition.factory_id = factory_id
    }
    
    if (start_date && end_date) {
      whereCondition.created_at = _.and([
        _.gte(new Date(start_date)),
        _.lte(new Date(end_date))
      ])
    }
    
    const result = await db.collection('flow_records')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('flow_records')
      .where(whereCondition)
      .count()
    
    return ApiResponse.success({
        records: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取流水记录错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取流水记录失败')
  }
}

/**
 * 获取流水统计
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFlowStats(userInfo, params) {
  try {
    const { start_date, end_date, factory_id } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (factory_id) {
      whereCondition.factory_id = factory_id
    }
    
    if (start_date && end_date) {
      whereCondition.created_at = _.and([
        _.gte(new Date(start_date)),
        _.lte(new Date(end_date))
      ])
    }
    
    // 获取发货统计
    const sendStats = await db.collection('send_orders')
      .where({ ...whereCondition, status: { $ne: 'deleted' } })
      .get()
    
    // 获取收货统计
    const receiveStats = await db.collection('receive_orders')
      .where({ ...whereCondition, status: { $ne: 'deleted' } })
      .get()
    
    const totalSendQuantity = sendStats.data.reduce((sum, order) => sum + (order.quantity || 0), 0)
    const totalReceiveQuantity = receiveStats.data.reduce((sum, order) => sum + (order.quantity || 0), 0)
    const totalSendAmount = sendStats.data.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    const totalReceiveAmount = receiveStats.data.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    
    return ApiResponse.success({
        sendOrders: sendStats.data.length,
        receiveOrders: receiveStats.data.length,
        totalSendQuantity,
        totalReceiveQuantity,
        totalSendAmount,
        totalReceiveAmount,
        pendingQuantity: totalSendQuantity - totalReceiveQuantity,
        pendingAmount: totalSendAmount - totalReceiveAmount
      }, '操作成功')
  } catch (error) {
    console.error('获取流水统计错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取流水统计失败')
  }
}

/**
 * 获取流水异常
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getFlowAnomalies(userInfo, params) {
  try {
    const { page = 1, limit = 20, type = 'all' } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    if (type !== 'all') {
      whereCondition.anomaly_type = type
    }
    
    const result = await db.collection('flow_anomalies')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('flow_anomalies')
      .where(whereCondition)
      .count()
    
    return ApiResponse.success({
        anomalies: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取流水异常错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取流水异常失败')
  }
}

/**
 * 获取详细流水记录
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getDetailedFlowRecords(userInfo, params) {
  try {
    const { page = 1, limit = 20, factory_id, product_id, start_date, end_date } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
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
    
    // 获取发货记录
    const sendOrders = await db.collection('send_orders')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取收货记录
    const receiveOrders = await db.collection('receive_orders')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 合并并排序记录
    const allRecords = [
      ...sendOrders.data.map(order => ({ ...order, type: 'send' })),
      ...receiveOrders.data.map(order => ({ ...order, type: 'receive' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    return ApiResponse.success({
        records: allRecords.slice(0, limit),
        total: allRecords.length,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取详细流水记录错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取详细流水记录失败')
  }
}

/**
 * 获取产品统计
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getProductStats(userInfo, params) {
  try {
    const { start_date, end_date, product_id } = params
    
    let whereCondition = {
      org_id: userInfo.orgId
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
    
    // 获取产品发货统计
    const sendStats = await db.collection('send_orders')
      .where(whereCondition)
      .get()
    
    // 获取产品收货统计
    const receiveStats = await db.collection('receive_orders')
      .where(whereCondition)
      .get()
    
    // 按产品分组统计
    const productStats = {}
    
    sendStats.data.forEach(order => {
      const productId = order.product_id
      if (!productStats[productId]) {
        productStats[productId] = {
          product_id: productId,
          send_quantity: 0,
          receive_quantity: 0,
          send_amount: 0,
          receive_amount: 0
        }
      }
      productStats[productId].send_quantity += order.quantity || 0
      productStats[productId].send_amount += order.total_amount || 0
    })
    
    receiveStats.data.forEach(order => {
      const productId = order.product_id
      if (!productStats[productId]) {
        productStats[productId] = {
          product_id: productId,
          send_quantity: 0,
          receive_quantity: 0,
          send_amount: 0,
          receive_amount: 0
        }
      }
      productStats[productId].receive_quantity += order.quantity || 0
      productStats[productId].receive_amount += order.total_amount || 0
    })
    
    // 计算待收数量和金额
    Object.values(productStats).forEach(stat => {
      stat.pending_quantity = stat.send_quantity - stat.receive_quantity
      stat.pending_amount = stat.send_amount - stat.receive_amount
    })
    
    return ApiResponse.success(Object.values(productStats), '操作成功')
  } catch (error) {
    console.error('获取产品统计错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取产品统计失败')
  }
}

module.exports = {
  getStats,
  getStatsForDate,
  getTodayStats,
  getOnlineUsers,
  getLoginStats,
  getFlowRecords,
  getFlowStats,
  getFlowAnomalies,
  getDetailedFlowRecords,
  getProductStats
}