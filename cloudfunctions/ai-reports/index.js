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
    // 验证token
    const authResult = await verifyToken(token)
    if (!authResult.success) {
      return authResult
    }
    const userInfo = authResult.data
    
    // 路由到具体的处理函数
    switch (action) {
      case 'getAiReports':
        return await getAiReports(userInfo, params)
      case 'getLossRanking':
        return await getLossRanking(userInfo, params)
      case 'getActiveRankings':
        return await getActiveRankings(userInfo, params)
      case 'getAiStats':
        return await getAiStats(userInfo, params)
      case 'generateReport':
        return await generateReport(userInfo, params)
      case 'getReportHistory':
        return await getReportHistory(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('AI报告云函数错误:', error)
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

// 获取AI报告列表
async function getAiReports(userInfo, params) {
  try {
    const { page = 1, limit = 20, type, startDate, endDate } = params
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where = {
      orgId: userInfo.orgId
    }
    
    if (type) {
      where.type = type
    }
    
    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 查询报告列表
    const result = await db.collection('ai_reports')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 查询总数
    const countResult = await db.collection('ai_reports')
      .where(where)
      .count()
    
    return {
      success: true,
      data: {
        reports: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取AI报告列表失败:', error)
    return {
      success: false,
      error: '获取AI报告列表失败'
    }
  }
}

// 获取损耗排名
async function getLossRanking(userInfo, params) {
  try {
    const { startDate, endDate, limit = 10 } = params
    
    // 聚合查询损耗数据
    const result = await db.collection('shipments')
      .aggregate()
      .match({
        orgId: userInfo.orgId,
        status: 1,
        createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
      })
      .group({
        _id: '$factoryId',
        totalQuantity: _.sum('$totalQuantity'),
        totalLoss: _.sum('$lossQuantity'),
        orderCount: _.sum(1)
      })
      .sort({
        totalLoss: -1
      })
      .limit(limit)
      .end()
    
    // 关联工厂信息
    const factoryIds = result.list.map(item => item._id)
    const factoryResult = await db.collection('factories')
      .where({
        _id: _.in(factoryIds)
      })
      .get()
    
    const factoryMap = {}
    factoryResult.data.forEach(factory => {
      factoryMap[factory._id] = factory
    })
    
    // 组装数据
    const rankings = result.list.map(item => ({
      factory: factoryMap[item._id] || { name: '未知工厂' },
      totalQuantity: item.totalQuantity,
      totalLoss: item.totalLoss,
      lossRate: item.totalQuantity > 0 ? (item.totalLoss / item.totalQuantity * 100).toFixed(2) : 0,
      orderCount: item.orderCount
    }))
    
    return {
      success: true,
      data: rankings
    }
  } catch (error) {
    console.error('获取损耗排名失败:', error)
    return {
      success: false,
      error: '获取损耗排名失败'
    }
  }
}

// 获取活跃度排名
async function getActiveRankings(userInfo, params) {
  try {
    const { startDate, endDate, limit = 10 } = params
    
    // 聚合查询活跃度数据
    const result = await db.collection('shipments')
      .aggregate()
      .match({
        orgId: userInfo.orgId,
        status: 1,
        createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
      })
      .group({
        _id: '$factoryId',
        totalQuantity: _.sum('$totalQuantity'),
        orderCount: _.sum(1),
        lastOrderTime: _.max('$createTime')
      })
      .sort({
        orderCount: -1
      })
      .limit(limit)
      .end()
    
    // 关联工厂信息
    const factoryIds = result.list.map(item => item._id)
    const factoryResult = await db.collection('factories')
      .where({
        _id: _.in(factoryIds)
      })
      .get()
    
    const factoryMap = {}
    factoryResult.data.forEach(factory => {
      factoryMap[factory._id] = factory
    })
    
    // 组装数据
    const rankings = result.list.map(item => ({
      factory: factoryMap[item._id] || { name: '未知工厂' },
      totalQuantity: item.totalQuantity,
      orderCount: item.orderCount,
      lastOrderTime: item.lastOrderTime,
      avgQuantityPerOrder: item.orderCount > 0 ? Math.round(item.totalQuantity / item.orderCount) : 0
    }))
    
    return {
      success: true,
      data: rankings
    }
  } catch (error) {
    console.error('获取活跃度排名失败:', error)
    return {
      success: false,
      error: '获取活跃度排名失败'
    }
  }
}

// 获取AI统计数据
async function getAiStats(userInfo, params) {
  try {
    const { startDate, endDate } = params
    
    // 获取基础统计数据
    const [ordersResult, factoriesResult, productsResult] = await Promise.all([
      // 订单统计
      db.collection('shipments')
        .where({
          orgId: userInfo.orgId,
          status: 1,
          createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
        })
        .count(),
      
      // 活跃工厂统计
      db.collection('shipments')
        .aggregate()
        .match({
          orgId: userInfo.orgId,
          status: 1,
          createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
        })
        .group({
          _id: '$factoryId'
        })
        .count('activeFactories')
        .end(),
      
      // 产品统计
      db.collection('shipments')
        .aggregate()
        .match({
          orgId: userInfo.orgId,
          status: 1,
          createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
        })
        .group({
          _id: '$productId'
        })
        .count('activeProducts')
        .end()
    ])
    
    // 计算趋势数据（最近7天）
    const trendData = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      
      const dayResult = await db.collection('shipments')
        .aggregate()
        .match({
          orgId: userInfo.orgId,
          status: 1,
          createTime: _.gte(startOfDay).and(_.lt(endOfDay))
        })
        .group({
          _id: null,
          totalQuantity: _.sum('$totalQuantity'),
          orderCount: _.sum(1)
        })
        .end()
      
      trendData.push({
        date: startOfDay.toISOString().split('T')[0],
        orderCount: dayResult.list[0]?.orderCount || 0,
        totalQuantity: dayResult.list[0]?.totalQuantity || 0
      })
    }
    
    return {
      success: true,
      data: {
        totalOrders: ordersResult.total,
        activeFactories: factoriesResult.list[0]?.activeFactories || 0,
        activeProducts: productsResult.list[0]?.activeProducts || 0,
        trendData
      }
    }
  } catch (error) {
    console.error('获取AI统计数据失败:', error)
    return {
      success: false,
      error: '获取AI统计数据失败'
    }
  }
}

// 生成AI报告
async function generateReport(userInfo, params) {
  try {
    const { type, startDate, endDate, config = {} } = params
    
    // 生成报告数据
    const reportData = await generateReportData(userInfo, type, startDate, endDate, config)
    
    // 保存报告记录
    const reportRecord = {
      orgId: userInfo.orgId,
      type,
      title: getReportTitle(type, startDate, endDate),
      data: reportData,
      config,
      createTime: new Date(),
      createBy: userInfo._id,
      status: 1
    }
    
    const result = await db.collection('ai_reports').add({
      data: reportRecord
    })
    
    return {
      success: true,
      data: {
        reportId: result._id,
        ...reportRecord
      }
    }
  } catch (error) {
    console.error('生成AI报告失败:', error)
    return {
      success: false,
      error: '生成AI报告失败'
    }
  }
}

// 获取报告历史
async function getReportHistory(userInfo, params) {
  try {
    const { page = 1, limit = 20, type } = params
    const skip = (page - 1) * limit
    
    const where = {
      orgId: userInfo.orgId,
      status: 1
    }
    
    if (type) {
      where.type = type
    }
    
    const result = await db.collection('ai_reports')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    const countResult = await db.collection('ai_reports')
      .where(where)
      .count()
    
    return {
      success: true,
      data: {
        reports: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取报告历史失败:', error)
    return {
      success: false,
      error: '获取报告历史失败'
    }
  }
}

// 生成报告数据
async function generateReportData(userInfo, type, startDate, endDate, config) {
  switch (type) {
    case 'loss_analysis':
      return await generateLossAnalysisReport(userInfo, startDate, endDate, config)
    case 'efficiency_analysis':
      return await generateEfficiencyAnalysisReport(userInfo, startDate, endDate, config)
    case 'trend_analysis':
      return await generateTrendAnalysisReport(userInfo, startDate, endDate, config)
    default:
      throw new Error('不支持的报告类型')
  }
}

// 生成损耗分析报告
async function generateLossAnalysisReport(userInfo, startDate, endDate, config) {
  // 实现损耗分析逻辑
  const result = await db.collection('shipments')
    .aggregate()
    .match({
      orgId: userInfo.orgId,
      status: 1,
      createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    })
    .group({
      _id: null,
      totalQuantity: _.sum('$totalQuantity'),
      totalLoss: _.sum('$lossQuantity'),
      orderCount: _.sum(1)
    })
    .end()
  
  const data = result.list[0] || { totalQuantity: 0, totalLoss: 0, orderCount: 0 }
  
  return {
    summary: {
      totalOrders: data.orderCount,
      totalQuantity: data.totalQuantity,
      totalLoss: data.totalLoss,
      lossRate: data.totalQuantity > 0 ? (data.totalLoss / data.totalQuantity * 100).toFixed(2) : 0
    },
    analysis: {
      conclusion: data.totalLoss > 0 ? '存在损耗，需要关注' : '损耗控制良好',
      suggestions: [
        '加强质量控制',
        '优化生产流程',
        '定期检查设备'
      ]
    }
  }
}

// 生成效率分析报告
async function generateEfficiencyAnalysisReport(userInfo, startDate, endDate, config) {
  // 实现效率分析逻辑
  const result = await db.collection('shipments')
    .aggregate()
    .match({
      orgId: userInfo.orgId,
      status: 1,
      createTime: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    })
    .group({
      _id: '$factoryId',
      totalQuantity: _.sum('$totalQuantity'),
      orderCount: _.sum(1),
      avgProcessTime: _.avg('$processTime')
    })
    .sort({
      totalQuantity: -1
    })
    .end()
  
  return {
    summary: {
      totalFactories: result.list.length,
      avgEfficiency: result.list.reduce((sum, item) => sum + (item.totalQuantity / item.orderCount), 0) / result.list.length || 0
    },
    factoryRanking: result.list.slice(0, 10),
    analysis: {
      conclusion: '效率分析完成',
      suggestions: [
        '提升低效工厂的生产能力',
        '推广高效工厂的经验',
        '优化资源配置'
      ]
    }
  }
}

// 生成趋势分析报告
async function generateTrendAnalysisReport(userInfo, startDate, endDate, config) {
  // 实现趋势分析逻辑
  const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
  const trendData = []
  
  for (let i = 0; i < days; i++) {
    const date = new Date(new Date(startDate).getTime() + i * 24 * 60 * 60 * 1000)
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    
    const dayResult = await db.collection('shipments')
      .aggregate()
      .match({
        orgId: userInfo.orgId,
        status: 1,
        createTime: _.gte(date).and(_.lt(nextDate))
      })
      .group({
        _id: null,
        totalQuantity: _.sum('$totalQuantity'),
        orderCount: _.sum(1)
      })
      .end()
    
    trendData.push({
      date: date.toISOString().split('T')[0],
      orderCount: dayResult.list[0]?.orderCount || 0,
      totalQuantity: dayResult.list[0]?.totalQuantity || 0
    })
  }
  
  return {
    summary: {
      totalDays: days,
      avgOrdersPerDay: trendData.reduce((sum, item) => sum + item.orderCount, 0) / days,
      avgQuantityPerDay: trendData.reduce((sum, item) => sum + item.totalQuantity, 0) / days
    },
    trendData,
    analysis: {
      conclusion: '趋势分析完成',
      suggestions: [
        '关注订单量波动',
        '优化生产计划',
        '预测未来需求'
      ]
    }
  }
}

// 获取报告标题
function getReportTitle(type, startDate, endDate) {
  const typeMap = {
    'loss_analysis': '损耗分析报告',
    'efficiency_analysis': '效率分析报告',
    'trend_analysis': '趋势分析报告'
  }
  
  return `${typeMap[type] || '分析报告'} (${startDate} 至 ${endDate})`
}