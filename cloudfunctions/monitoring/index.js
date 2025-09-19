// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const JWT_SECRET = process.env.JWT_SECRET || 'yunsf-jwt-secret-2024'

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, token, ...params } = event
  
  try {
    // 记录请求日志
    await logRequest(action, params, context)
    
    // 对于监控相关的操作，需要验证token
    if (action !== 'logError' && action !== 'logPerformance' && action !== 'heartbeat') {
      const authResult = await verifyToken(token)
      if (!authResult.success) {
        return authResult
      }
      var userInfo = authResult.data
    }
    
    // 路由到具体的处理函数
    switch (action) {
      case 'getSystemStats':
        return await getSystemStats(userInfo, params)
      case 'getErrorLogs':
        return await getErrorLogs(userInfo, params)
      case 'getPerformanceLogs':
        return await getPerformanceLogs(userInfo, params)
      case 'getRequestLogs':
        return await getRequestLogs(userInfo, params)
      case 'logError':
        return await logError(params)
      case 'logPerformance':
        return await logPerformance(params)
      case 'heartbeat':
        return await heartbeat(params)
      case 'getHealthCheck':
        return await getHealthCheck(userInfo, params)
      case 'getAlerts':
        return await getAlerts(userInfo, params)
      case 'createAlert':
        return await createAlert(userInfo, params)
      case 'updateAlert':
        return await updateAlert(userInfo, params)
      case 'deleteAlert':
        return await deleteAlert(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('监控系统云函数错误:', error)
    
    // 记录错误日志
    await logError({
      source: 'monitoring-function',
      error: error.message,
      stack: error.stack,
      action,
      params
    })
    
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
      error: '缺少访问令牌'
    }
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // 查询用户信息
    const userResult = await db.collection('users')
      .where({
        _id: decoded.userId,
        status: 1
      })
      .get()
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        error: '用户不存在或已被禁用'
      }
    }
    
    return {
      success: true,
      data: userResult.data[0]
    }
  } catch (error) {
    return {
      success: false,
      error: '无效的访问令牌'
    }
  }
}

// 获取系统统计信息
async function getSystemStats(userInfo, params) {
  try {
    const { timeRange = '24h' } = params
    
    // 计算时间范围
    const now = new Date()
    let startTime
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    }
    
    // 并行查询各种统计数据
    const [requestStats, errorStats, performanceStats, userStats] = await Promise.all([
      // 请求统计
      db.collection('request_logs')
        .aggregate()
        .match({
          timestamp: _.gte(startTime)
        })
        .group({
          _id: null,
          totalRequests: _.sum(1),
          avgResponseTime: _.avg('$responseTime'),
          successCount: _.sum(_.cond([
            [_.lt(['$responseTime', 5000]), 1],
            [true, 0]
          ])),
          errorCount: _.sum(_.cond([
            [_.gte(['$responseTime', 5000]), 1],
            [true, 0]
          ]))
        })
        .end(),
      
      // 错误统计
      db.collection('error_logs')
        .aggregate()
        .match({
          timestamp: _.gte(startTime)
        })
        .group({
          _id: '$level',
          count: _.sum(1)
        })
        .end(),
      
      // 性能统计
      db.collection('performance_logs')
        .aggregate()
        .match({
          timestamp: _.gte(startTime)
        })
        .group({
          _id: null,
          avgLoadTime: _.avg('$loadTime'),
          avgApiTime: _.avg('$apiTime'),
          avgRenderTime: _.avg('$renderTime')
        })
        .end(),
      
      // 用户活跃统计
      db.collection('request_logs')
        .aggregate()
        .match({
          timestamp: _.gte(startTime),
          userId: _.exists(true)
        })
        .group({
          _id: '$userId'
        })
        .count('activeUsers')
        .end()
    ])
    
    // 处理统计结果
    const requestData = requestStats.list[0] || {
      totalRequests: 0,
      avgResponseTime: 0,
      successCount: 0,
      errorCount: 0
    }
    
    const errorData = {}
    errorStats.list.forEach(item => {
      errorData[item._id] = item.count
    })
    
    const performanceData = performanceStats.list[0] || {
      avgLoadTime: 0,
      avgApiTime: 0,
      avgRenderTime: 0
    }
    
    const activeUsers = userStats.list[0]?.activeUsers || 0
    
    // 计算成功率
    const successRate = requestData.totalRequests > 0 
      ? (requestData.successCount / requestData.totalRequests * 100).toFixed(2)
      : 100
    
    return {
      success: true,
      data: {
        timeRange,
        requests: {
          total: requestData.totalRequests,
          success: requestData.successCount,
          error: requestData.errorCount,
          successRate: parseFloat(successRate),
          avgResponseTime: Math.round(requestData.avgResponseTime || 0)
        },
        errors: {
          critical: errorData.critical || 0,
          error: errorData.error || 0,
          warning: errorData.warning || 0,
          info: errorData.info || 0
        },
        performance: {
          avgLoadTime: Math.round(performanceData.avgLoadTime || 0),
          avgApiTime: Math.round(performanceData.avgApiTime || 0),
          avgRenderTime: Math.round(performanceData.avgRenderTime || 0)
        },
        users: {
          activeUsers
        }
      }
    }
  } catch (error) {
    console.error('获取系统统计失败:', error)
    return {
      success: false,
      error: '获取系统统计失败'
    }
  }
}

// 获取错误日志
async function getErrorLogs(userInfo, params) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      level, 
      source,
      startDate, 
      endDate 
    } = params
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where = {}
    
    if (level) {
      where.level = level
    }
    
    if (source) {
      where.source = source
    }
    
    if (startDate && endDate) {
      where.timestamp = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 查询错误日志
    const result = await db.collection('error_logs')
      .where(where)
      .orderBy('timestamp', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 查询总数
    const countResult = await db.collection('error_logs')
      .where(where)
      .count()
    
    return {
      success: true,
      data: {
        logs: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取错误日志失败:', error)
    return {
      success: false,
      error: '获取错误日志失败'
    }
  }
}

// 获取性能日志
async function getPerformanceLogs(userInfo, params) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      source,
      startDate, 
      endDate 
    } = params
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where = {}
    
    if (source) {
      where.source = source
    }
    
    if (startDate && endDate) {
      where.timestamp = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 查询性能日志
    const result = await db.collection('performance_logs')
      .where(where)
      .orderBy('timestamp', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 查询总数
    const countResult = await db.collection('performance_logs')
      .where(where)
      .count()
    
    return {
      success: true,
      data: {
        logs: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取性能日志失败:', error)
    return {
      success: false,
      error: '获取性能日志失败'
    }
  }
}

// 获取请求日志
async function getRequestLogs(userInfo, params) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action,
      userId,
      startDate, 
      endDate 
    } = params
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where = {}
    
    if (action) {
      where.action = action
    }
    
    if (userId) {
      where.userId = userId
    }
    
    if (startDate && endDate) {
      where.timestamp = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 查询请求日志
    const result = await db.collection('request_logs')
      .where(where)
      .orderBy('timestamp', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 查询总数
    const countResult = await db.collection('request_logs')
      .where(where)
      .count()
    
    return {
      success: true,
      data: {
        logs: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取请求日志失败:', error)
    return {
      success: false,
      error: '获取请求日志失败'
    }
  }
}

// 记录错误日志
async function logError(params) {
  try {
    const {
      source = 'unknown',
      level = 'error',
      message,
      error,
      stack,
      userId,
      action,
      params: errorParams,
      userAgent,
      url
    } = params
    
    const errorLog = {
      source,
      level, // critical, error, warning, info
      message: message || error || '未知错误',
      error,
      stack,
      userId,
      action,
      params: errorParams,
      userAgent,
      url,
      timestamp: new Date()
    }
    
    await db.collection('error_logs').add({
      data: errorLog
    })
    
    // 如果是严重错误，触发告警
    if (level === 'critical') {
      await triggerAlert('critical_error', errorLog)
    }
    
    return {
      success: true,
      data: {
        logged: true
      }
    }
  } catch (error) {
    console.error('记录错误日志失败:', error)
    return {
      success: false,
      error: '记录错误日志失败'
    }
  }
}

// 记录性能日志
async function logPerformance(params) {
  try {
    const {
      source = 'unknown',
      loadTime,
      apiTime,
      renderTime,
      memoryUsage,
      userId,
      action,
      url
    } = params
    
    const performanceLog = {
      source,
      loadTime,
      apiTime,
      renderTime,
      memoryUsage,
      userId,
      action,
      url,
      timestamp: new Date()
    }
    
    await db.collection('performance_logs').add({
      data: performanceLog
    })
    
    // 检查性能阈值
    if (loadTime > 10000) { // 10秒
      await triggerAlert('slow_performance', performanceLog)
    }
    
    return {
      success: true,
      data: {
        logged: true
      }
    }
  } catch (error) {
    console.error('记录性能日志失败:', error)
    return {
      success: false,
      error: '记录性能日志失败'
    }
  }
}

// 记录请求日志
async function logRequest(action, params, context) {
  try {
    const startTime = Date.now()
    
    const requestLog = {
      action,
      params: JSON.stringify(params).substring(0, 1000), // 限制参数长度
      userId: params.userId || null,
      requestId: context.requestId,
      source: context.source || 'cloud-function',
      timestamp: new Date(),
      responseTime: null // 将在响应时更新
    }
    
    // 异步记录，不阻塞主流程
    db.collection('request_logs').add({
      data: requestLog
    }).catch(error => {
      console.error('记录请求日志失败:', error)
    })
    
    return {
      success: true,
      startTime
    }
  } catch (error) {
    console.error('记录请求日志失败:', error)
    return {
      success: false,
      error: '记录请求日志失败'
    }
  }
}

// 心跳检测
async function heartbeat(params) {
  try {
    const { source = 'unknown', status = 'healthy' } = params
    
    const heartbeatLog = {
      source,
      status,
      timestamp: new Date(),
      memoryUsage: process.memoryUsage ? process.memoryUsage() : null
    }
    
    await db.collection('heartbeat_logs').add({
      data: heartbeatLog
    })
    
    return {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date()
      }
    }
  } catch (error) {
    console.error('心跳检测失败:', error)
    return {
      success: false,
      error: '心跳检测失败'
    }
  }
}

// 健康检查
async function getHealthCheck(userInfo, params) {
  try {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    
    // 检查各个服务的心跳
    const heartbeatResult = await db.collection('heartbeat_logs')
      .where({
        timestamp: _.gte(fiveMinutesAgo)
      })
      .orderBy('timestamp', 'desc')
      .get()
    
    // 检查错误率
    const errorResult = await db.collection('error_logs')
      .where({
        timestamp: _.gte(fiveMinutesAgo),
        level: _.in(['critical', 'error'])
      })
      .count()
    
    // 检查请求响应时间
    const requestResult = await db.collection('request_logs')
      .aggregate()
      .match({
        timestamp: _.gte(fiveMinutesAgo)
      })
      .group({
        _id: null,
        avgResponseTime: _.avg('$responseTime'),
        totalRequests: _.sum(1)
      })
      .end()
    
    const services = {}
    heartbeatResult.data.forEach(log => {
      if (!services[log.source] || services[log.source].timestamp < log.timestamp) {
        services[log.source] = {
          status: log.status,
          timestamp: log.timestamp,
          healthy: log.status === 'healthy'
        }
      }
    })
    
    const requestStats = requestResult.list[0] || { avgResponseTime: 0, totalRequests: 0 }
    
    const overallHealth = {
      status: 'healthy',
      services,
      metrics: {
        errorCount: errorResult.total,
        avgResponseTime: Math.round(requestStats.avgResponseTime || 0),
        totalRequests: requestStats.totalRequests
      },
      timestamp: now
    }
    
    // 判断整体健康状态
    if (errorResult.total > 10 || requestStats.avgResponseTime > 5000) {
      overallHealth.status = 'warning'
    }
    
    if (errorResult.total > 50 || requestStats.avgResponseTime > 10000) {
      overallHealth.status = 'critical'
    }
    
    return {
      success: true,
      data: overallHealth
    }
  } catch (error) {
    console.error('健康检查失败:', error)
    return {
      success: false,
      error: '健康检查失败'
    }
  }
}

// 获取告警列表
async function getAlerts(userInfo, params) {
  try {
    const { page = 1, limit = 20, status, type } = params
    const skip = (page - 1) * limit
    
    const where = {
      orgId: userInfo.orgId
    }
    
    if (status !== undefined) {
      where.status = status
    }
    
    if (type) {
      where.type = type
    }
    
    const result = await db.collection('alerts')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('alerts')
      .where(where)
      .count()
    
    return {
      success: true,
      data: {
        alerts: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取告警列表失败:', error)
    return {
      success: false,
      error: '获取告警列表失败'
    }
  }
}

// 创建告警
async function createAlert(userInfo, params) {
  try {
    const { type, title, message, level = 'warning', data } = params
    
    const alert = {
      type,
      title,
      message,
      level,
      data,
      orgId: userInfo.orgId,
      createTime: new Date(),
      createBy: userInfo._id,
      status: 1 // 1: 活跃, 0: 已解决
    }
    
    const result = await db.collection('alerts').add({
      data: alert
    })
    
    return {
      success: true,
      data: {
        alertId: result._id,
        ...alert
      }
    }
  } catch (error) {
    console.error('创建告警失败:', error)
    return {
      success: false,
      error: '创建告警失败'
    }
  }
}

// 更新告警
async function updateAlert(userInfo, params) {
  try {
    const { alertId, status, resolveMessage } = params
    
    const updateData = {
      updateTime: new Date(),
      updateBy: userInfo._id
    }
    
    if (status !== undefined) {
      updateData.status = status
      if (status === 0) {
        updateData.resolveTime = new Date()
        updateData.resolveBy = userInfo._id
        updateData.resolveMessage = resolveMessage || ''
      }
    }
    
    await db.collection('alerts')
      .doc(alertId)
      .update({
        data: updateData
      })
    
    return {
      success: true,
      data: {
        alertId,
        ...updateData
      }
    }
  } catch (error) {
    console.error('更新告警失败:', error)
    return {
      success: false,
      error: '更新告警失败'
    }
  }
}

// 删除告警
async function deleteAlert(userInfo, params) {
  try {
    const { alertId } = params
    
    await db.collection('alerts')
      .doc(alertId)
      .remove()
    
    return {
      success: true,
      data: {
        alertId
      }
    }
  } catch (error) {
    console.error('删除告警失败:', error)
    return {
      success: false,
      error: '删除告警失败'
    }
  }
}

// 触发告警
async function triggerAlert(type, data) {
  try {
    const alertConfig = {
      critical_error: {
        title: '严重错误告警',
        message: `检测到严重错误: ${data.message}`,
        level: 'critical'
      },
      slow_performance: {
        title: '性能告警',
        message: `检测到性能问题，加载时间: ${data.loadTime}ms`,
        level: 'warning'
      }
    }
    
    const config = alertConfig[type]
    if (!config) {
      return
    }
    
    const alert = {
      type,
      title: config.title,
      message: config.message,
      level: config.level,
      data,
      orgId: data.orgId || 'system',
      createTime: new Date(),
      createBy: 'system',
      status: 1
    }
    
    await db.collection('alerts').add({
      data: alert
    })
  } catch (error) {
    console.error('触发告警失败:', error)
  }
}