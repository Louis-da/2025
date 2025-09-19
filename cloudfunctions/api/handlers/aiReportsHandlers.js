// AI报告生成相关处理函数
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
 * 获取AI报告列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getAiReports(userInfo, params) {
  try {
    const { page = 1, limit = 10, type, status } = params
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    let whereCondition = {
      org_id: orgId
    }
    
    if (type) {
      whereCondition.type = type
    }
    
    if (status) {
      whereCondition.status = status
    }
    
    // 获取总数
    const countResult = await db.collection('ai_reports')
      .where(whereCondition)
      .count()
    
    // 获取报告列表
    const reportsResult = await db.collection('ai_reports')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    return ApiResponse.success({
        reports: reportsResult.data,
        total: countResult.total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(countResult.total / limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取AI报告列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取AI报告列表失败')
  }
}

/**
 * 获取AI报告详情
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getAiReportById(userInfo, params) {
  try {
    const { id } = params
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告ID不能为空')
    }
    
    const reportResult = await db.collection('ai_reports')
      .where({
        _id: id,
        org_id: orgId
      })
      .get()
    
    if (reportResult.data.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告不存在或无权限访问')
    }
    
    return ApiResponse.success(reportResult.data[0], '操作成功')
  } catch (error) {
    console.error('获取AI报告详情错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取AI报告详情失败')
  }
}

/**
 * 创建AI报告
 * @param {Object} userInfo 用户信息
 * @param {Object} params 报告数据
 */
async function createAiReport(userInfo, params) {
  try {
    const { title, type, content, data_source, analysis_params } = params
    const orgId = userInfo.orgId
    const userId = userInfo.userId
    
    if (!orgId || !userId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取用户或组织信息')
    }
    
    if (!title || !type || !content) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '标题、类型和内容不能为空')
    }
    
    const reportData = {
      title,
      type,
      content,
      data_source: data_source || 'manual',
      analysis_params: analysis_params || {},
      status: 'draft',
      org_id: orgId,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('ai_reports').add({
      data: reportData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...reportData
      }, '操作成功')
  } catch (error) {
    console.error('创建AI报告错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '创建AI报告失败')
  }
}

/**
 * 更新AI报告
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateAiReport(userInfo, params) {
  try {
    const { id, title, type, content, status, analysis_params } = params
    const orgId = userInfo.orgId
    const userId = userInfo.userId
    
    if (!orgId || !userId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取用户或组织信息')
    }
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告ID不能为空')
    }
    
    // 检查报告是否存在且有权限
    const existingReport = await db.collection('ai_reports')
      .where({
        _id: id,
        org_id: orgId
      })
      .get()
    
    if (existingReport.data.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告不存在或无权限访问')
    }
    
    // 构建更新数据
    const updateData = {
      updated_at: new Date(),
      updated_by: userId
    }
    
    if (title !== undefined) updateData.title = title
    if (type !== undefined) updateData.type = type
    if (content !== undefined) updateData.content = content
    if (status !== undefined) updateData.status = status
    if (analysis_params !== undefined) updateData.analysis_params = analysis_params
    
    const result = await db.collection('ai_reports')
      .doc(id)
      .update({
        data: updateData
      })
    
    return ApiResponse.success({
        id,
        updated: result.stats.updated
      }, '操作成功')
  } catch (error) {
    console.error('更新AI报告错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新AI报告失败')
  }
}

/**
 * 删除AI报告
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteAiReport(userInfo, params) {
  try {
    const { id } = params
    const orgId = userInfo.orgId
    
    if (!orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取组织ID')
    }
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告ID不能为空')
    }
    
    // 检查报告是否存在且有权限
    const existingReport = await db.collection('ai_reports')
      .where({
        _id: id,
        org_id: orgId
      })
      .get()
    
    if (existingReport.data.length === 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告不存在或无权限访问')
    }
    
    const result = await db.collection('ai_reports')
      .doc(id)
      .remove()
    
    return ApiResponse.success({
        id,
        deleted: result.stats.removed
      }, '操作成功')
  } catch (error) {
    console.error('删除AI报告错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除AI报告失败')
  }
}

/**
 * 生成AI报告
 * @param {Object} userInfo 用户信息
 * @param {Object} params 生成参数
 */
async function generateAiReport(userInfo, params) {
  try {
    const { type, date_range, analysis_type, custom_params } = params
    const orgId = userInfo.orgId
    const userId = userInfo.userId
    
    if (!orgId || !userId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无法获取用户或组织信息')
    }
    
    if (!type) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '报告类型不能为空')
    }
    
    // 根据类型生成不同的报告内容
    let reportContent = ''
    let reportTitle = ''
    
    switch (type) {
      case 'daily_summary':
        reportTitle = `日报 - ${new Date().toLocaleDateString()}`
        reportContent = await generateDailySummary(orgId, date_range)
        break
      case 'weekly_analysis':
        reportTitle = `周报 - ${new Date().toLocaleDateString()}`
        reportContent = await generateWeeklyAnalysis(orgId, date_range)
        break
      case 'monthly_report':
        reportTitle = `月报 - ${new Date().toLocaleDateString()}`
        reportContent = await generateMonthlyReport(orgId, date_range)
        break
      case 'custom_analysis':
        reportTitle = `自定义分析 - ${new Date().toLocaleDateString()}`
        reportContent = await generateCustomAnalysis(orgId, custom_params)
        break
      default:
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '不支持的报告类型')
    }
    
    // 创建报告记录
    const reportData = {
      title: reportTitle,
      type,
      content: reportContent,
      data_source: 'auto_generated',
      analysis_params: {
        date_range,
        analysis_type,
        custom_params
      },
      status: 'completed',
      org_id: orgId,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    const result = await db.collection('ai_reports').add({
      data: reportData
    })
    
    return ApiResponse.success({
        id: result._id,
        ...reportData
      }, '操作成功')
  } catch (error) {
    console.error('生成AI报告错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '生成AI报告失败')
  }
}

/**
 * 生成日报内容
 */
async function generateDailySummary(orgId, dateRange) {
  // 这里是简化的实现，实际应该调用AI服务生成更智能的报告
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  
  try {
    // 获取今日数据
    const sendOrders = await db.collection('send_orders')
      .where({
        org_id: orgId,
        created_at: _.gte(today).and(_.lt(tomorrow))
      })
      .get()
    
    const receiveOrders = await db.collection('receive_orders')
      .where({
        org_id: orgId,
        created_at: _.gte(today).and(_.lt(tomorrow))
      })
      .get()
    
    return `# 日报摘要\n\n## 今日概况\n\n- 发出单数量: ${sendOrders.data.length}\n- 收回单数量: ${receiveOrders.data.length}\n- 总处理量: ${sendOrders.data.length + receiveOrders.data.length}\n\n## 详细分析\n\n今日业务运行正常，各项指标稳定。`
  } catch (error) {
    return '生成日报内容时出现错误'
  }
}

/**
 * 生成周报内容
 */
async function generateWeeklyAnalysis(orgId, dateRange) {
  return '# 周报分析\n\n本周业务数据分析...'
}

/**
 * 生成月报内容
 */
async function generateMonthlyReport(orgId, dateRange) {
  return '# 月报\n\n本月业务总结...'
}

/**
 * 生成自定义分析内容
 */
async function generateCustomAnalysis(orgId, customParams) {
  return '# 自定义分析\n\n根据指定参数进行的分析...'
}

module.exports = {
  getAiReports,
  getAiReportById,
  createAiReport,
  updateAiReport,
  deleteAiReport,
  generateAiReport
}