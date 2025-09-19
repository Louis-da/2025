// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate
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
      case 'analyzeProduction':
        return await analyzeProduction(userInfo, params)
      case 'detectAnomalies':
        return await detectAnomalies(userInfo, params)
      case 'predictTrends':
        return await predictTrends(userInfo, params)
      case 'analyzeEfficiency':
        return await analyzeEfficiency(userInfo, params)
      case 'analyzeQuality':
        return await analyzeQuality(userInfo, params)
      case 'analyzeCosts':
        return await analyzeCosts(userInfo, params)
      case 'generateInsights':
        return await generateInsights(userInfo, params)
      case 'getAnalysisHistory':
        return await getAnalysisHistory(userInfo, params)
      case 'exportAnalysisReport':
        return await exportAnalysisReport(userInfo, params)
      case 'getRecommendations':
        return await getRecommendations(userInfo, params)
      case 'analyzeFactoryPerformance':
        return await analyzeFactoryPerformance(userInfo, params)
      case 'analyzeWorkerPerformance':
        return await analyzeWorkerPerformance(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('AI分析云函数错误:', error)
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

// 生产分析
async function analyzeProduction(userInfo, params) {
  try {
    const { 
      startDate, 
      endDate, 
      factoryId, 
      productId, 
      processId,
      analysisType = 'overview'
    } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    if (factoryId) baseFilter.factoryId = factoryId
    if (productId) baseFilter.productId = productId
    if (processId) baseFilter.processId = processId
    
    // 获取流水记录数据
    const flowRecords = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .group({
        _id: {
          date: $.dateToString({
            format: '%Y-%m-%d',
            date: '$createTime'
          }),
          factoryId: '$factoryId',
          productId: '$productId',
          processId: '$processId'
        },
        totalQuantity: $.sum('$quantity'),
        totalDefects: $.sum('$defectQuantity'),
        recordCount: $.sum(1),
        avgEfficiency: $.avg('$efficiency')
      })
      .sort({ '_id.date': 1 })
      .end()
    
    // 计算生产指标
    const analysis = {
      totalProduction: 0,
      totalDefects: 0,
      averageEfficiency: 0,
      qualityRate: 0,
      dailyTrends: [],
      factoryComparison: [],
      productAnalysis: [],
      processAnalysis: []
    }
    
    const dailyData = new Map()
    const factoryData = new Map()
    const productData = new Map()
    const processData = new Map()
    
    for (const record of flowRecords.list) {
      const { _id, totalQuantity, totalDefects, recordCount, avgEfficiency } = record
      
      analysis.totalProduction += totalQuantity
      analysis.totalDefects += totalDefects
      
      // 按日期统计
      if (!dailyData.has(_id.date)) {
        dailyData.set(_id.date, {
          date: _id.date,
          production: 0,
          defects: 0,
          efficiency: 0,
          count: 0
        })
      }
      const dayData = dailyData.get(_id.date)
      dayData.production += totalQuantity
      dayData.defects += totalDefects
      dayData.efficiency += avgEfficiency * recordCount
      dayData.count += recordCount
      
      // 按工厂统计
      if (!factoryData.has(_id.factoryId)) {
        factoryData.set(_id.factoryId, {
          factoryId: _id.factoryId,
          production: 0,
          defects: 0,
          efficiency: 0,
          count: 0
        })
      }
      const factory = factoryData.get(_id.factoryId)
      factory.production += totalQuantity
      factory.defects += totalDefects
      factory.efficiency += avgEfficiency * recordCount
      factory.count += recordCount
      
      // 按产品统计
      if (!productData.has(_id.productId)) {
        productData.set(_id.productId, {
          productId: _id.productId,
          production: 0,
          defects: 0,
          efficiency: 0,
          count: 0
        })
      }
      const product = productData.get(_id.productId)
      product.production += totalQuantity
      product.defects += totalDefects
      product.efficiency += avgEfficiency * recordCount
      product.count += recordCount
      
      // 按工序统计
      if (!processData.has(_id.processId)) {
        processData.set(_id.processId, {
          processId: _id.processId,
          production: 0,
          defects: 0,
          efficiency: 0,
          count: 0
        })
      }
      const process = processData.get(_id.processId)
      process.production += totalQuantity
      process.defects += totalDefects
      process.efficiency += avgEfficiency * recordCount
      process.count += recordCount
    }
    
    // 计算平均效率和质量率
    const totalRecords = flowRecords.list.reduce((sum, r) => sum + r.recordCount, 0)
    analysis.averageEfficiency = totalRecords > 0 ? 
      flowRecords.list.reduce((sum, r) => sum + r.avgEfficiency * r.recordCount, 0) / totalRecords : 0
    analysis.qualityRate = analysis.totalProduction > 0 ? 
      ((analysis.totalProduction - analysis.totalDefects) / analysis.totalProduction * 100) : 0
    
    // 处理日期趋势
    analysis.dailyTrends = Array.from(dailyData.values()).map(day => ({
      ...day,
      efficiency: day.count > 0 ? day.efficiency / day.count : 0,
      qualityRate: day.production > 0 ? ((day.production - day.defects) / day.production * 100) : 0
    }))
    
    // 处理工厂对比
    analysis.factoryComparison = Array.from(factoryData.values()).map(factory => ({
      ...factory,
      efficiency: factory.count > 0 ? factory.efficiency / factory.count : 0,
      qualityRate: factory.production > 0 ? ((factory.production - factory.defects) / factory.production * 100) : 0
    }))
    
    // 处理产品分析
    analysis.productAnalysis = Array.from(productData.values()).map(product => ({
      ...product,
      efficiency: product.count > 0 ? product.efficiency / product.count : 0,
      qualityRate: product.production > 0 ? ((product.production - product.defects) / product.production * 100) : 0
    }))
    
    // 处理工序分析
    analysis.processAnalysis = Array.from(processData.values()).map(process => ({
      ...process,
      efficiency: process.count > 0 ? process.efficiency / process.count : 0,
      qualityRate: process.production > 0 ? ((process.production - process.defects) / process.production * 100) : 0
    }))
    
    // 保存分析结果
    await saveAnalysisResult(userInfo, 'production', analysis, params)
    
    return {
      success: true,
      data: analysis
    }
  } catch (error) {
    console.error('生产分析失败:', error)
    return {
      success: false,
      error: '生产分析失败'
    }
  }
}

// 异常检测
async function detectAnomalies(userInfo, params) {
  try {
    const { 
      startDate, 
      endDate, 
      threshold = 2, // 标准差阈值
      analysisType = 'all'
    } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    // 获取历史数据进行异常检测
    const flowRecords = await db.collection('flow_records')
      .where(baseFilter)
      .orderBy('createTime', 'desc')
      .limit(1000)
      .get()
    
    const anomalies = {
      efficiencyAnomalies: [],
      qualityAnomalies: [],
      quantityAnomalies: [],
      timeAnomalies: [],
      summary: {
        totalAnomalies: 0,
        severityDistribution: {
          high: 0,
          medium: 0,
          low: 0
        }
      }
    }
    
    if (flowRecords.data.length === 0) {
      return {
        success: true,
        data: anomalies
      }
    }
    
    // 计算统计指标
    const efficiencies = flowRecords.data.map(r => r.efficiency || 0)
    const quantities = flowRecords.data.map(r => r.quantity || 0)
    const defectRates = flowRecords.data.map(r => {
      const total = r.quantity || 0
      const defects = r.defectQuantity || 0
      return total > 0 ? (defects / total) : 0
    })
    
    const efficiencyStats = calculateStats(efficiencies)
    const quantityStats = calculateStats(quantities)
    const defectRateStats = calculateStats(defectRates)
    
    // 检测异常
    for (const record of flowRecords.data) {
      const efficiency = record.efficiency || 0
      const quantity = record.quantity || 0
      const defectRate = record.quantity > 0 ? (record.defectQuantity || 0) / record.quantity : 0
      
      // 效率异常
      const efficiencyZScore = Math.abs((efficiency - efficiencyStats.mean) / efficiencyStats.stdDev)
      if (efficiencyZScore > threshold) {
        const severity = getSeverity(efficiencyZScore, threshold)
        anomalies.efficiencyAnomalies.push({
          recordId: record._id,
          type: 'efficiency',
          value: efficiency,
          expected: efficiencyStats.mean,
          deviation: efficiencyZScore,
          severity,
          timestamp: record.createTime,
          factoryId: record.factoryId,
          productId: record.productId,
          processId: record.processId
        })
        anomalies.summary.severityDistribution[severity]++
      }
      
      // 数量异常
      const quantityZScore = Math.abs((quantity - quantityStats.mean) / quantityStats.stdDev)
      if (quantityZScore > threshold) {
        const severity = getSeverity(quantityZScore, threshold)
        anomalies.quantityAnomalies.push({
          recordId: record._id,
          type: 'quantity',
          value: quantity,
          expected: quantityStats.mean,
          deviation: quantityZScore,
          severity,
          timestamp: record.createTime,
          factoryId: record.factoryId,
          productId: record.productId,
          processId: record.processId
        })
        anomalies.summary.severityDistribution[severity]++
      }
      
      // 质量异常
      const defectRateZScore = Math.abs((defectRate - defectRateStats.mean) / defectRateStats.stdDev)
      if (defectRateZScore > threshold) {
        const severity = getSeverity(defectRateZScore, threshold)
        anomalies.qualityAnomalies.push({
          recordId: record._id,
          type: 'quality',
          value: defectRate,
          expected: defectRateStats.mean,
          deviation: defectRateZScore,
          severity,
          timestamp: record.createTime,
          factoryId: record.factoryId,
          productId: record.productId,
          processId: record.processId
        })
        anomalies.summary.severityDistribution[severity]++
      }
    }
    
    anomalies.summary.totalAnomalies = 
      anomalies.efficiencyAnomalies.length + 
      anomalies.quantityAnomalies.length + 
      anomalies.qualityAnomalies.length
    
    // 保存异常检测结果
    await saveAnalysisResult(userInfo, 'anomaly_detection', anomalies, params)
    
    return {
      success: true,
      data: anomalies
    }
  } catch (error) {
    console.error('异常检测失败:', error)
    return {
      success: false,
      error: '异常检测失败'
    }
  }
}

// 趋势预测
async function predictTrends(userInfo, params) {
  try {
    const { 
      startDate, 
      endDate, 
      predictDays = 30,
      metric = 'production'
    } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    // 获取历史数据
    const historicalData = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .group({
        _id: {
          date: $.dateToString({
            format: '%Y-%m-%d',
            date: '$createTime'
          })
        },
        totalQuantity: $.sum('$quantity'),
        totalDefects: $.sum('$defectQuantity'),
        avgEfficiency: $.avg('$efficiency'),
        recordCount: $.sum(1)
      })
      .sort({ '_id.date': 1 })
      .end()
    
    if (historicalData.list.length < 7) {
      return {
        success: false,
        error: '历史数据不足，无法进行趋势预测'
      }
    }
    
    // 准备时间序列数据
    const timeSeriesData = historicalData.list.map((item, index) => {
      const value = getMetricValue(item, metric)
      return {
        x: index,
        y: value,
        date: item._id.date
      }
    })
    
    // 简单线性回归预测
    const regression = calculateLinearRegression(timeSeriesData)
    
    // 生成预测数据
    const predictions = []
    const lastDate = new Date(timeSeriesData[timeSeriesData.length - 1].date)
    
    for (let i = 1; i <= predictDays; i++) {
      const predictDate = new Date(lastDate)
      predictDate.setDate(lastDate.getDate() + i)
      
      const x = timeSeriesData.length + i - 1
      const predictedValue = regression.slope * x + regression.intercept
      
      predictions.push({
        date: predictDate.toISOString().split('T')[0],
        predictedValue: Math.max(0, predictedValue), // 确保预测值非负
        confidence: calculateConfidence(i, predictDays)
      })
    }
    
    // 计算趋势指标
    const trendAnalysis = {
      trend: regression.slope > 0 ? 'increasing' : regression.slope < 0 ? 'decreasing' : 'stable',
      trendStrength: Math.abs(regression.slope),
      correlation: regression.correlation,
      seasonality: detectSeasonality(timeSeriesData),
      volatility: calculateVolatility(timeSeriesData)
    }
    
    const result = {
      metric,
      historicalData: timeSeriesData,
      predictions,
      trendAnalysis,
      regression: {
        slope: regression.slope,
        intercept: regression.intercept,
        rSquared: regression.rSquared
      }
    }
    
    // 保存预测结果
    await saveAnalysisResult(userInfo, 'trend_prediction', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('趋势预测失败:', error)
    return {
      success: false,
      error: '趋势预测失败'
    }
  }
}

// 效率分析
async function analyzeEfficiency(userInfo, params) {
  try {
    const { startDate, endDate, factoryId, processId } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    if (factoryId) baseFilter.factoryId = factoryId
    if (processId) baseFilter.processId = processId
    
    // 获取效率数据
    const efficiencyData = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .group({
        _id: {
          factoryId: '$factoryId',
          processId: '$processId',
          workerId: '$workerId'
        },
        avgEfficiency: $.avg('$efficiency'),
        totalQuantity: $.sum('$quantity'),
        totalTime: $.sum('$actualTime'),
        recordCount: $.sum(1)
      })
      .end()
    
    // 分析效率分布
    const efficiencies = efficiencyData.list.map(item => item.avgEfficiency)
    const efficiencyStats = calculateStats(efficiencies)
    
    // 识别高效和低效的工厂、工序、工人
    const topPerformers = efficiencyData.list
      .filter(item => item.avgEfficiency > efficiencyStats.mean + efficiencyStats.stdDev)
      .sort((a, b) => b.avgEfficiency - a.avgEfficiency)
      .slice(0, 10)
    
    const lowPerformers = efficiencyData.list
      .filter(item => item.avgEfficiency < efficiencyStats.mean - efficiencyStats.stdDev)
      .sort((a, b) => a.avgEfficiency - b.avgEfficiency)
      .slice(0, 10)
    
    const result = {
      overview: {
        averageEfficiency: efficiencyStats.mean,
        efficiencyRange: {
          min: efficiencyStats.min,
          max: efficiencyStats.max
        },
        standardDeviation: efficiencyStats.stdDev,
        totalRecords: efficiencyData.list.length
      },
      topPerformers,
      lowPerformers,
      recommendations: generateEfficiencyRecommendations(topPerformers, lowPerformers, efficiencyStats)
    }
    
    await saveAnalysisResult(userInfo, 'efficiency_analysis', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('效率分析失败:', error)
    return {
      success: false,
      error: '效率分析失败'
    }
  }
}

// 质量分析
async function analyzeQuality(userInfo, params) {
  try {
    const { startDate, endDate, factoryId, productId } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    if (factoryId) baseFilter.factoryId = factoryId
    if (productId) baseFilter.productId = productId
    
    // 获取质量数据
    const qualityData = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .group({
        _id: {
          factoryId: '$factoryId',
          productId: '$productId',
          processId: '$processId'
        },
        totalQuantity: $.sum('$quantity'),
        totalDefects: $.sum('$defectQuantity'),
        recordCount: $.sum(1)
      })
      .end()
    
    // 计算质量指标
    const qualityAnalysis = qualityData.list.map(item => {
      const defectRate = item.totalQuantity > 0 ? (item.totalDefects / item.totalQuantity) : 0
      const qualityRate = 1 - defectRate
      
      return {
        ...item,
        defectRate: defectRate * 100,
        qualityRate: qualityRate * 100
      }
    })
    
    // 整体质量统计
    const totalQuantity = qualityAnalysis.reduce((sum, item) => sum + item.totalQuantity, 0)
    const totalDefects = qualityAnalysis.reduce((sum, item) => sum + item.totalDefects, 0)
    const overallQualityRate = totalQuantity > 0 ? ((totalQuantity - totalDefects) / totalQuantity * 100) : 0
    
    // 识别质量问题
    const qualityIssues = qualityAnalysis
      .filter(item => item.defectRate > 5) // 次品率超过5%
      .sort((a, b) => b.defectRate - a.defectRate)
    
    const result = {
      overview: {
        overallQualityRate,
        totalQuantity,
        totalDefects,
        averageDefectRate: totalQuantity > 0 ? (totalDefects / totalQuantity * 100) : 0
      },
      qualityAnalysis,
      qualityIssues,
      recommendations: generateQualityRecommendations(qualityIssues, overallQualityRate)
    }
    
    await saveAnalysisResult(userInfo, 'quality_analysis', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('质量分析失败:', error)
    return {
      success: false,
      error: '质量分析失败'
    }
  }
}

// 成本分析
async function analyzeCosts(userInfo, params) {
  try {
    const { startDate, endDate, factoryId, productId } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    if (factoryId) baseFilter.factoryId = factoryId
    if (productId) baseFilter.productId = productId
    
    // 获取成本相关数据
    const costData = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .lookup({
        from: 'processes',
        localField: 'processId',
        foreignField: '_id',
        as: 'process'
      })
      .unwind('$process')
      .group({
        _id: {
          factoryId: '$factoryId',
          productId: '$productId',
          processId: '$processId'
        },
        totalQuantity: $.sum('$quantity'),
        totalTime: $.sum('$actualTime'),
        avgUnitPrice: $.avg('$process.unitPrice'),
        recordCount: $.sum(1)
      })
      .end()
    
    // 计算成本指标
    const costAnalysis = costData.list.map(item => {
      const unitCost = item.avgUnitPrice || 0
      const totalCost = item.totalQuantity * unitCost
      const timePerUnit = item.totalQuantity > 0 ? (item.totalTime / item.totalQuantity) : 0
      
      return {
        ...item,
        unitCost,
        totalCost,
        timePerUnit,
        efficiency: timePerUnit > 0 ? (1 / timePerUnit) : 0
      }
    })
    
    // 成本统计
    const totalCost = costAnalysis.reduce((sum, item) => sum + item.totalCost, 0)
    const totalQuantity = costAnalysis.reduce((sum, item) => sum + item.totalQuantity, 0)
    const averageUnitCost = totalQuantity > 0 ? (totalCost / totalQuantity) : 0
    
    // 识别高成本项目
    const highCostItems = costAnalysis
      .filter(item => item.unitCost > averageUnitCost * 1.5)
      .sort((a, b) => b.unitCost - a.unitCost)
    
    const result = {
      overview: {
        totalCost,
        totalQuantity,
        averageUnitCost,
        costEfficiency: totalCost > 0 ? (totalQuantity / totalCost) : 0
      },
      costAnalysis,
      highCostItems,
      recommendations: generateCostRecommendations(highCostItems, averageUnitCost)
    }
    
    await saveAnalysisResult(userInfo, 'cost_analysis', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('成本分析失败:', error)
    return {
      success: false,
      error: '成本分析失败'
    }
  }
}

// 生成洞察
async function generateInsights(userInfo, params) {
  try {
    const { analysisTypes = ['production', 'efficiency', 'quality', 'cost'] } = params
    
    const insights = {
      keyFindings: [],
      recommendations: [],
      alerts: [],
      opportunities: []
    }
    
    // 获取最近的分析结果
    for (const analysisType of analysisTypes) {
      try {
        const recentAnalysis = await db.collection('analysis_results')
          .where({
            orgId: userInfo.orgId,
            analysisType,
            createTime: _.gte(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 最近7天
          })
          .orderBy('createTime', 'desc')
          .limit(1)
          .get()
        
        if (recentAnalysis.data.length > 0) {
          const analysis = recentAnalysis.data[0]
          const typeInsights = extractInsights(analysisType, analysis.result)
          
          insights.keyFindings.push(...typeInsights.findings)
          insights.recommendations.push(...typeInsights.recommendations)
          insights.alerts.push(...typeInsights.alerts)
          insights.opportunities.push(...typeInsights.opportunities)
        }
      } catch (error) {
        console.error(`获取${analysisType}分析结果失败:`, error)
      }
    }
    
    // 生成综合洞察
    const comprehensiveInsights = generateComprehensiveInsights(insights)
    
    const result = {
      ...insights,
      comprehensive: comprehensiveInsights,
      generatedAt: new Date()
    }
    
    await saveAnalysisResult(userInfo, 'insights', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('生成洞察失败:', error)
    return {
      success: false,
      error: '生成洞察失败'
    }
  }
}

// 获取分析历史
async function getAnalysisHistory(userInfo, params) {
  try {
    const { 
      analysisType, 
      startDate, 
      endDate, 
      page = 1, 
      pageSize = 20 
    } = params
    
    const filter = {
      orgId: userInfo.orgId
    }
    
    if (analysisType) filter.analysisType = analysisType
    if (startDate) filter.createTime = _.gte(new Date(startDate))
    if (endDate) filter.createTime = _.and([filter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const [countResult, dataResult] = await Promise.all([
      db.collection('analysis_results').where(filter).count(),
      db.collection('analysis_results')
        .where(filter)
        .orderBy('createTime', 'desc')
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .get()
    ])
    
    return {
      success: true,
      data: {
        total: countResult.total,
        page,
        pageSize,
        totalPages: Math.ceil(countResult.total / pageSize),
        list: dataResult.data
      }
    }
  } catch (error) {
    console.error('获取分析历史失败:', error)
    return {
      success: false,
      error: '获取分析历史失败'
    }
  }
}

// 导出分析报告
async function exportAnalysisReport(userInfo, params) {
  try {
    const { analysisId, format = 'json' } = params
    
    if (!analysisId) {
      return {
        success: false,
        error: '缺少分析ID'
      }
    }
    
    const analysisResult = await db.collection('analysis_results')
      .doc(analysisId)
      .get()
    
    if (!analysisResult.data) {
      return {
        success: false,
        error: '分析结果不存在'
      }
    }
    
    // 生成报告
    const report = generateAnalysisReport(analysisResult.data, format)
    
    return {
      success: true,
      data: {
        report,
        format,
        generatedAt: new Date()
      }
    }
  } catch (error) {
    console.error('导出分析报告失败:', error)
    return {
      success: false,
      error: '导出分析报告失败'
    }
  }
}

// 获取推荐建议
async function getRecommendations(userInfo, params) {
  try {
    const { category = 'all', priority = 'all' } = params
    
    // 获取最近的分析结果
    const recentAnalyses = await db.collection('analysis_results')
      .where({
        orgId: userInfo.orgId,
        createTime: _.gte(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // 最近30天
      })
      .orderBy('createTime', 'desc')
      .limit(50)
      .get()
    
    const recommendations = []
    
    for (const analysis of recentAnalyses.data) {
      const typeRecommendations = extractRecommendations(analysis.analysisType, analysis.result)
      recommendations.push(...typeRecommendations)
    }
    
    // 过滤和排序推荐
    let filteredRecommendations = recommendations
    
    if (category !== 'all') {
      filteredRecommendations = filteredRecommendations.filter(r => r.category === category)
    }
    
    if (priority !== 'all') {
      filteredRecommendations = filteredRecommendations.filter(r => r.priority === priority)
    }
    
    // 按优先级和影响度排序
    filteredRecommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      const aPriority = priorityOrder[a.priority] || 0
      const bPriority = priorityOrder[b.priority] || 0
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority
      }
      
      return (b.impact || 0) - (a.impact || 0)
    })
    
    return {
      success: true,
      data: {
        recommendations: filteredRecommendations.slice(0, 20), // 返回前20个
        total: filteredRecommendations.length,
        categories: [...new Set(recommendations.map(r => r.category))],
        priorities: [...new Set(recommendations.map(r => r.priority))]
      }
    }
  } catch (error) {
    console.error('获取推荐建议失败:', error)
    return {
      success: false,
      error: '获取推荐建议失败'
    }
  }
}

// 工厂绩效分析
async function analyzeFactoryPerformance(userInfo, params) {
  try {
    const { startDate, endDate, factoryIds = [] } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    if (factoryIds.length > 0) {
      baseFilter.factoryId = _.in(factoryIds)
    }
    
    // 获取工厂绩效数据
    const performanceData = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .group({
        _id: '$factoryId',
        totalQuantity: $.sum('$quantity'),
        totalDefects: $.sum('$defectQuantity'),
        avgEfficiency: $.avg('$efficiency'),
        totalTime: $.sum('$actualTime'),
        recordCount: $.sum(1)
      })
      .lookup({
        from: 'factories',
        localField: '_id',
        foreignField: '_id',
        as: 'factory'
      })
      .unwind('$factory')
      .end()
    
    // 计算绩效指标
    const factoryPerformance = performanceData.list.map(item => {
      const qualityRate = item.totalQuantity > 0 ? ((item.totalQuantity - item.totalDefects) / item.totalQuantity * 100) : 0
      const productivity = item.totalTime > 0 ? (item.totalQuantity / item.totalTime) : 0
      
      return {
        factoryId: item._id,
        factoryName: item.factory.name,
        totalQuantity: item.totalQuantity,
        qualityRate,
        efficiency: item.avgEfficiency,
        productivity,
        recordCount: item.recordCount,
        score: calculateFactoryScore(qualityRate, item.avgEfficiency, productivity)
      }
    })
    
    // 排序和排名
    factoryPerformance.sort((a, b) => b.score - a.score)
    factoryPerformance.forEach((factory, index) => {
      factory.rank = index + 1
    })
    
    const result = {
      factoryPerformance,
      summary: {
        totalFactories: factoryPerformance.length,
        averageScore: factoryPerformance.reduce((sum, f) => sum + f.score, 0) / factoryPerformance.length,
        topPerformer: factoryPerformance[0],
        improvementNeeded: factoryPerformance.filter(f => f.score < 60)
      }
    }
    
    await saveAnalysisResult(userInfo, 'factory_performance', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('工厂绩效分析失败:', error)
    return {
      success: false,
      error: '工厂绩效分析失败'
    }
  }
}

// 工人绩效分析
async function analyzeWorkerPerformance(userInfo, params) {
  try {
    const { startDate, endDate, factoryId, processId } = params
    
    const dateFilter = {}
    if (startDate) dateFilter.createTime = _.gte(new Date(startDate))
    if (endDate) dateFilter.createTime = _.and([dateFilter.createTime || _.exists(true), _.lte(new Date(endDate))])
    
    const baseFilter = {
      orgId: userInfo.orgId,
      ...dateFilter
    }
    
    if (factoryId) baseFilter.factoryId = factoryId
    if (processId) baseFilter.processId = processId
    
    // 获取工人绩效数据
    const workerData = await db.collection('flow_records')
      .aggregate()
      .match(baseFilter)
      .group({
        _id: {
          workerId: '$workerId',
          factoryId: '$factoryId',
          processId: '$processId'
        },
        totalQuantity: $.sum('$quantity'),
        totalDefects: $.sum('$defectQuantity'),
        avgEfficiency: $.avg('$efficiency'),
        totalTime: $.sum('$actualTime'),
        recordCount: $.sum(1)
      })
      .lookup({
        from: 'users',
        localField: '_id.workerId',
        foreignField: '_id',
        as: 'worker'
      })
      .unwind('$worker')
      .end()
    
    // 计算工人绩效指标
    const workerPerformance = workerData.list.map(item => {
      const qualityRate = item.totalQuantity > 0 ? ((item.totalQuantity - item.totalDefects) / item.totalQuantity * 100) : 0
      const productivity = item.totalTime > 0 ? (item.totalQuantity / item.totalTime) : 0
      
      return {
        workerId: item._id.workerId,
        workerName: item.worker.name,
        factoryId: item._id.factoryId,
        processId: item._id.processId,
        totalQuantity: item.totalQuantity,
        qualityRate,
        efficiency: item.avgEfficiency,
        productivity,
        recordCount: item.recordCount,
        score: calculateWorkerScore(qualityRate, item.avgEfficiency, productivity)
      }
    })
    
    // 排序和分析
    workerPerformance.sort((a, b) => b.score - a.score)
    
    const topPerformers = workerPerformance.slice(0, 10)
    const lowPerformers = workerPerformance.slice(-10).reverse()
    
    const result = {
      workerPerformance,
      topPerformers,
      lowPerformers,
      summary: {
        totalWorkers: workerPerformance.length,
        averageScore: workerPerformance.reduce((sum, w) => sum + w.score, 0) / workerPerformance.length,
        averageEfficiency: workerPerformance.reduce((sum, w) => sum + w.efficiency, 0) / workerPerformance.length,
        averageQualityRate: workerPerformance.reduce((sum, w) => sum + w.qualityRate, 0) / workerPerformance.length
      }
    }
    
    await saveAnalysisResult(userInfo, 'worker_performance', result, params)
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('工人绩效分析失败:', error)
    return {
      success: false,
      error: '工人绩效分析失败'
    }
  }
}

// 辅助函数
function calculateStats(values) {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0 }
  }
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  return {
    mean,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values)
  }
}

function getSeverity(zScore, threshold) {
  if (zScore > threshold * 2) return 'high'
  if (zScore > threshold * 1.5) return 'medium'
  return 'low'
}

function getMetricValue(item, metric) {
  switch (metric) {
    case 'production':
      return item.totalQuantity
    case 'quality':
      return item.totalQuantity > 0 ? ((item.totalQuantity - item.totalDefects) / item.totalQuantity * 100) : 0
    case 'efficiency':
      return item.avgEfficiency
    case 'defects':
      return item.totalDefects
    default:
      return item.totalQuantity
  }
}

function calculateLinearRegression(data) {
  const n = data.length
  const sumX = data.reduce((sum, point) => sum + point.x, 0)
  const sumY = data.reduce((sum, point) => sum + point.y, 0)
  const sumXY = data.reduce((sum, point) => sum + point.x * point.y, 0)
  const sumXX = data.reduce((sum, point) => sum + point.x * point.x, 0)
  const sumYY = data.reduce((sum, point) => sum + point.y * point.y, 0)
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  
  // 计算相关系数
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY))
  
  // 计算R²
  const rSquared = correlation * correlation
  
  return { slope, intercept, correlation, rSquared }
}

function calculateConfidence(dayIndex, totalDays) {
  // 简单的置信度计算：距离越远，置信度越低
  return Math.max(0.5, 1 - (dayIndex / totalDays) * 0.5)
}

function detectSeasonality(data) {
  // 简单的季节性检测
  if (data.length < 14) return false
  
  const weeklyPattern = []
  for (let i = 0; i < 7; i++) {
    const dayValues = data.filter((_, index) => index % 7 === i).map(d => d.y)
    if (dayValues.length > 0) {
      weeklyPattern.push(dayValues.reduce((sum, val) => sum + val, 0) / dayValues.length)
    }
  }
  
  const weeklyStats = calculateStats(weeklyPattern)
  return weeklyStats.stdDev > weeklyStats.mean * 0.1 // 如果标准差超过均值的10%，认为有季节性
}

function calculateVolatility(data) {
  if (data.length < 2) return 0
  
  const changes = []
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].y !== 0) {
      changes.push((data[i].y - data[i - 1].y) / data[i - 1].y)
    }
  }
  
  const changeStats = calculateStats(changes)
  return changeStats.stdDev
}

function generateEfficiencyRecommendations(topPerformers, lowPerformers, stats) {
  const recommendations = []
  
  if (topPerformers.length > 0) {
    recommendations.push({
      type: 'best_practice',
      title: '学习最佳实践',
      description: `分析高效工厂/工序的操作方法，平均效率达到${topPerformers[0].avgEfficiency.toFixed(2)}`,
      priority: 'high',
      impact: 'high'
    })
  }
  
  if (lowPerformers.length > 0) {
    recommendations.push({
      type: 'improvement',
      title: '改进低效环节',
      description: `重点关注效率低于${(stats.mean - stats.stdDev).toFixed(2)}的工厂/工序`,
      priority: 'high',
      impact: 'medium'
    })
  }
  
  return recommendations
}

function generateQualityRecommendations(qualityIssues, overallQualityRate) {
  const recommendations = []
  
  if (qualityIssues.length > 0) {
    recommendations.push({
      type: 'quality_improvement',
      title: '质量问题整改',
      description: `${qualityIssues.length}个环节存在质量问题，需要重点关注`,
      priority: 'high',
      impact: 'high'
    })
  }
  
  if (overallQualityRate < 95) {
    recommendations.push({
      type: 'quality_control',
      title: '加强质量控制',
      description: `整体质量率为${overallQualityRate.toFixed(2)}%，建议加强质量管控`,
      priority: 'medium',
      impact: 'medium'
    })
  }
  
  return recommendations
}

function generateCostRecommendations(highCostItems, averageUnitCost) {
  const recommendations = []
  
  if (highCostItems.length > 0) {
    recommendations.push({
      type: 'cost_optimization',
      title: '成本优化',
      description: `${highCostItems.length}个项目成本偏高，建议优化`,
      priority: 'medium',
      impact: 'high'
    })
  }
  
  return recommendations
}

function extractInsights(analysisType, result) {
  const insights = {
    findings: [],
    recommendations: [],
    alerts: [],
    opportunities: []
  }
  
  // 根据分析类型提取洞察
  switch (analysisType) {
    case 'production':
      if (result.averageEfficiency < 80) {
        insights.alerts.push({
          type: 'efficiency_low',
          message: '生产效率偏低，需要关注',
          severity: 'medium'
        })
      }
      break
    case 'quality':
      if (result.overview.overallQualityRate < 95) {
        insights.alerts.push({
          type: 'quality_low',
          message: '质量率偏低，需要改进',
          severity: 'high'
        })
      }
      break
    // 其他分析类型...
  }
  
  return insights
}

function generateComprehensiveInsights(insights) {
  return {
    summary: `发现${insights.keyFindings.length}个关键发现，${insights.alerts.length}个警告，${insights.opportunities.length}个改进机会`,
    priorityActions: insights.recommendations.filter(r => r.priority === 'high').slice(0, 5),
    riskLevel: insights.alerts.filter(a => a.severity === 'high').length > 0 ? 'high' : 'medium'
  }
}

function extractRecommendations(analysisType, result) {
  // 从分析结果中提取推荐建议
  return result.recommendations || []
}

function generateAnalysisReport(analysisData, format) {
  if (format === 'json') {
    return JSON.stringify(analysisData, null, 2)
  }
  
  // 其他格式的报告生成...
  return analysisData
}

function calculateFactoryScore(qualityRate, efficiency, productivity) {
  // 综合评分：质量率40% + 效率30% + 生产力30%
  return (qualityRate * 0.4 + efficiency * 0.3 + productivity * 100 * 0.3)
}

function calculateWorkerScore(qualityRate, efficiency, productivity) {
  // 工人评分：质量率50% + 效率30% + 生产力20%
  return (qualityRate * 0.5 + efficiency * 0.3 + productivity * 100 * 0.2)
}

// 保存分析结果
async function saveAnalysisResult(userInfo, analysisType, result, params) {
  try {
    await db.collection('analysis_results').add({
      data: {
        orgId: userInfo.orgId,
        analysisType,
        result,
        parameters: params,
        createTime: new Date(),
        createBy: userInfo._id
      }
    })
  } catch (error) {
    console.error('保存分析结果失败:', error)
  }
}