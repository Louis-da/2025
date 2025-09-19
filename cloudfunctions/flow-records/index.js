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
      case 'getFlowRecords':
        return await getFlowRecords(userInfo, params)
      case 'createFlowRecord':
        return await createFlowRecord(userInfo, params)
      case 'updateFlowRecord':
        return await updateFlowRecord(userInfo, params)
      case 'deleteFlowRecord':
        return await deleteFlowRecord(userInfo, params)
      case 'getFlowRecordDetail':
        return await getFlowRecordDetail(userInfo, params)
      case 'getFlowStats':
        return await getFlowStats(userInfo, params)
      case 'exportFlowRecords':
        return await exportFlowRecords(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('流水记录云函数错误:', error)
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

// 获取流水记录列表
async function getFlowRecords(userInfo, params) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      factoryId, 
      productId, 
      processId,
      status,
      startDate, 
      endDate,
      keyword
    } = params
    
    const skip = (page - 1) * limit
    
    // 构建查询条件
    const where = {
      orgId: userInfo.orgId
    }
    
    if (factoryId) {
      where.factoryId = factoryId
    }
    
    if (productId) {
      where.productId = productId
    }
    
    if (processId) {
      where.processId = processId
    }
    
    if (status !== undefined) {
      where.status = status
    }
    
    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    if (keyword) {
      where.$or = [
        { orderNo: db.RegExp({ regexp: keyword, options: 'i' }) },
        { batchNo: db.RegExp({ regexp: keyword, options: 'i' }) },
        { remark: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]
    }
    
    // 查询流水记录
    const result = await db.collection('flow_records')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 查询总数
    const countResult = await db.collection('flow_records')
      .where(where)
      .count()
    
    // 关联查询相关信息
    const records = await enrichFlowRecords(result.data)
    
    return {
      success: true,
      data: {
        records,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取流水记录失败:', error)
    return {
      success: false,
      error: '获取流水记录失败'
    }
  }
}

// 创建流水记录
async function createFlowRecord(userInfo, params) {
  try {
    const {
      orderNo,
      batchNo,
      factoryId,
      productId,
      processId,
      quantity,
      unitPrice,
      totalAmount,
      processDate,
      remark
    } = params
    
    // 验证必填字段
    if (!orderNo || !factoryId || !productId || !processId || !quantity) {
      return {
        success: false,
        error: '缺少必填字段'
      }
    }
    
    // 验证工厂、产品、工序是否存在
    const [factoryResult, productResult, processResult] = await Promise.all([
      db.collection('factories').doc(factoryId).get(),
      db.collection('products').doc(productId).get(),
      db.collection('processes').doc(processId).get()
    ])
    
    if (!factoryResult.data || !productResult.data || !processResult.data) {
      return {
        success: false,
        error: '工厂、产品或工序不存在'
      }
    }
    
    // 生成流水记录号
    const recordNo = await generateRecordNo()
    
    // 创建流水记录
    const recordData = {
      recordNo,
      orderNo,
      batchNo: batchNo || '',
      factoryId,
      productId,
      processId,
      quantity: Number(quantity),
      unitPrice: Number(unitPrice) || 0,
      totalAmount: Number(totalAmount) || (Number(quantity) * Number(unitPrice || 0)),
      processDate: processDate ? new Date(processDate) : new Date(),
      remark: remark || '',
      orgId: userInfo.orgId,
      createTime: new Date(),
      createBy: userInfo._id,
      updateTime: new Date(),
      updateBy: userInfo._id,
      status: 1
    }
    
    const result = await db.collection('flow_records').add({
      data: recordData
    })
    
    return {
      success: true,
      data: {
        recordId: result._id,
        ...recordData
      }
    }
  } catch (error) {
    console.error('创建流水记录失败:', error)
    return {
      success: false,
      error: '创建流水记录失败'
    }
  }
}

// 更新流水记录
async function updateFlowRecord(userInfo, params) {
  try {
    const { recordId, ...updateData } = params
    
    if (!recordId) {
      return {
        success: false,
        error: '缺少记录ID'
      }
    }
    
    // 检查记录是否存在
    const recordResult = await db.collection('flow_records')
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      return {
        success: false,
        error: '流水记录不存在'
      }
    }
    
    // 检查权限
    if (recordResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限操作此记录'
      }
    }
    
    // 准备更新数据
    const updateFields = {
      updateTime: new Date(),
      updateBy: userInfo._id
    }
    
    // 允许更新的字段
    const allowedFields = [
      'orderNo', 'batchNo', 'factoryId', 'productId', 'processId',
      'quantity', 'unitPrice', 'totalAmount', 'processDate', 'remark'
    ]
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'quantity' || field === 'unitPrice' || field === 'totalAmount') {
          updateFields[field] = Number(updateData[field])
        } else if (field === 'processDate') {
          updateFields[field] = new Date(updateData[field])
        } else {
          updateFields[field] = updateData[field]
        }
      }
    })
    
    // 重新计算总金额
    if (updateFields.quantity !== undefined || updateFields.unitPrice !== undefined) {
      const quantity = updateFields.quantity !== undefined ? updateFields.quantity : recordResult.data.quantity
      const unitPrice = updateFields.unitPrice !== undefined ? updateFields.unitPrice : recordResult.data.unitPrice
      updateFields.totalAmount = quantity * unitPrice
    }
    
    // 更新记录
    await db.collection('flow_records')
      .doc(recordId)
      .update({
        data: updateFields
      })
    
    return {
      success: true,
      data: {
        recordId,
        ...updateFields
      }
    }
  } catch (error) {
    console.error('更新流水记录失败:', error)
    return {
      success: false,
      error: '更新流水记录失败'
    }
  }
}

// 删除流水记录
async function deleteFlowRecord(userInfo, params) {
  try {
    const { recordId } = params
    
    if (!recordId) {
      return {
        success: false,
        error: '缺少记录ID'
      }
    }
    
    // 检查记录是否存在
    const recordResult = await db.collection('flow_records')
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      return {
        success: false,
        error: '流水记录不存在'
      }
    }
    
    // 检查权限
    if (recordResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限操作此记录'
      }
    }
    
    // 软删除记录
    await db.collection('flow_records')
      .doc(recordId)
      .update({
        data: {
          status: 0,
          updateTime: new Date(),
          updateBy: userInfo._id
        }
      })
    
    return {
      success: true,
      data: {
        recordId
      }
    }
  } catch (error) {
    console.error('删除流水记录失败:', error)
    return {
      success: false,
      error: '删除流水记录失败'
    }
  }
}

// 获取流水记录详情
async function getFlowRecordDetail(userInfo, params) {
  try {
    const { recordId } = params
    
    if (!recordId) {
      return {
        success: false,
        error: '缺少记录ID'
      }
    }
    
    // 查询记录详情
    const recordResult = await db.collection('flow_records')
      .doc(recordId)
      .get()
    
    if (!recordResult.data) {
      return {
        success: false,
        error: '流水记录不存在'
      }
    }
    
    // 检查权限
    if (recordResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限查看此记录'
      }
    }
    
    // 关联查询相关信息
    const enrichedRecords = await enrichFlowRecords([recordResult.data])
    
    return {
      success: true,
      data: enrichedRecords[0]
    }
  } catch (error) {
    console.error('获取流水记录详情失败:', error)
    return {
      success: false,
      error: '获取流水记录详情失败'
    }
  }
}

// 获取流水统计
async function getFlowStats(userInfo, params) {
  try {
    const { startDate, endDate, factoryId, productId, processId } = params
    
    // 构建查询条件
    const where = {
      orgId: userInfo.orgId,
      status: 1
    }
    
    if (factoryId) {
      where.factoryId = factoryId
    }
    
    if (productId) {
      where.productId = productId
    }
    
    if (processId) {
      where.processId = processId
    }
    
    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 聚合统计
    const result = await db.collection('flow_records')
      .aggregate()
      .match(where)
      .group({
        _id: null,
        totalRecords: _.sum(1),
        totalQuantity: _.sum('$quantity'),
        totalAmount: _.sum('$totalAmount'),
        avgQuantity: _.avg('$quantity'),
        avgAmount: _.avg('$totalAmount')
      })
      .end()
    
    // 按工厂统计
    const factoryStats = await db.collection('flow_records')
      .aggregate()
      .match(where)
      .group({
        _id: '$factoryId',
        recordCount: _.sum(1),
        totalQuantity: _.sum('$quantity'),
        totalAmount: _.sum('$totalAmount')
      })
      .sort({
        totalAmount: -1
      })
      .limit(10)
      .end()
    
    // 按产品统计
    const productStats = await db.collection('flow_records')
      .aggregate()
      .match(where)
      .group({
        _id: '$productId',
        recordCount: _.sum(1),
        totalQuantity: _.sum('$quantity'),
        totalAmount: _.sum('$totalAmount')
      })
      .sort({
        totalQuantity: -1
      })
      .limit(10)
      .end()
    
    // 按工序统计
    const processStats = await db.collection('flow_records')
      .aggregate()
      .match(where)
      .group({
        _id: '$processId',
        recordCount: _.sum(1),
        totalQuantity: _.sum('$quantity'),
        totalAmount: _.sum('$totalAmount')
      })
      .sort({
        recordCount: -1
      })
      .limit(10)
      .end()
    
    const stats = result.list[0] || {
      totalRecords: 0,
      totalQuantity: 0,
      totalAmount: 0,
      avgQuantity: 0,
      avgAmount: 0
    }
    
    return {
      success: true,
      data: {
        summary: stats,
        factoryStats: factoryStats.list,
        productStats: productStats.list,
        processStats: processStats.list
      }
    }
  } catch (error) {
    console.error('获取流水统计失败:', error)
    return {
      success: false,
      error: '获取流水统计失败'
    }
  }
}

// 导出流水记录
async function exportFlowRecords(userInfo, params) {
  try {
    const { startDate, endDate, factoryId, productId, processId } = params
    
    // 构建查询条件
    const where = {
      orgId: userInfo.orgId,
      status: 1
    }
    
    if (factoryId) {
      where.factoryId = factoryId
    }
    
    if (productId) {
      where.productId = productId
    }
    
    if (processId) {
      where.processId = processId
    }
    
    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 查询所有记录（限制最大1000条）
    const result = await db.collection('flow_records')
      .where(where)
      .orderBy('createTime', 'desc')
      .limit(1000)
      .get()
    
    // 关联查询相关信息
    const records = await enrichFlowRecords(result.data)
    
    // 转换为导出格式
    const exportData = records.map(record => ({
      recordNo: record.recordNo,
      orderNo: record.orderNo,
      batchNo: record.batchNo,
      factoryName: record.factory?.name || '',
      productName: record.product?.name || '',
      processName: record.process?.name || '',
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      totalAmount: record.totalAmount,
      processDate: record.processDate,
      createTime: record.createTime,
      remark: record.remark
    }))
    
    return {
      success: true,
      data: {
        records: exportData,
        total: exportData.length
      }
    }
  } catch (error) {
    console.error('导出流水记录失败:', error)
    return {
      success: false,
      error: '导出流水记录失败'
    }
  }
}

// 关联查询相关信息
async function enrichFlowRecords(records) {
  if (!records || records.length === 0) {
    return []
  }
  
  // 提取所有相关ID
  const factoryIds = [...new Set(records.map(r => r.factoryId).filter(Boolean))]
  const productIds = [...new Set(records.map(r => r.productId).filter(Boolean))]
  const processIds = [...new Set(records.map(r => r.processId).filter(Boolean))]
  const userIds = [...new Set(records.map(r => r.createBy).filter(Boolean))]
  
  // 并行查询相关信息
  const [factoryResult, productResult, processResult, userResult] = await Promise.all([
    factoryIds.length > 0 ? db.collection('factories').where({ _id: _.in(factoryIds) }).get() : { data: [] },
    productIds.length > 0 ? db.collection('products').where({ _id: _.in(productIds) }).get() : { data: [] },
    processIds.length > 0 ? db.collection('processes').where({ _id: _.in(processIds) }).get() : { data: [] },
    userIds.length > 0 ? db.collection('users').where({ _id: _.in(userIds) }).get() : { data: [] }
  ])
  
  // 创建映射
  const factoryMap = {}
  const productMap = {}
  const processMap = {}
  const userMap = {}
  
  factoryResult.data.forEach(item => {
    factoryMap[item._id] = item
  })
  
  productResult.data.forEach(item => {
    productMap[item._id] = item
  })
  
  processResult.data.forEach(item => {
    processMap[item._id] = item
  })
  
  userResult.data.forEach(item => {
    userMap[item._id] = item
  })
  
  // 关联数据
  return records.map(record => ({
    ...record,
    factory: factoryMap[record.factoryId] || null,
    product: productMap[record.productId] || null,
    process: processMap[record.processId] || null,
    createUser: userMap[record.createBy] || null
  }))
}

// 生成流水记录号
async function generateRecordNo() {
  const now = new Date()
  const dateStr = now.getFullYear().toString() + 
                  (now.getMonth() + 1).toString().padStart(2, '0') + 
                  now.getDate().toString().padStart(2, '0')
  
  // 查询当天最大序号
  const result = await db.collection('flow_records')
    .where({
      recordNo: db.RegExp({ regexp: `^FR${dateStr}`, options: 'i' })
    })
    .orderBy('recordNo', 'desc')
    .limit(1)
    .get()
  
  let sequence = 1
  if (result.data.length > 0) {
    const lastRecordNo = result.data[0].recordNo
    const lastSequence = parseInt(lastRecordNo.slice(-4))
    sequence = lastSequence + 1
  }
  
  return `FR${dateStr}${sequence.toString().padStart(4, '0')}`
}