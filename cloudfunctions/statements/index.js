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
      case 'getStatements':
        return await getStatements(userInfo, params)
      case 'createStatement':
        return await createStatement(userInfo, params)
      case 'updateStatement':
        return await updateStatement(userInfo, params)
      case 'deleteStatement':
        return await deleteStatement(userInfo, params)
      case 'getStatementDetail':
        return await getStatementDetail(userInfo, params)
      case 'confirmStatement':
        return await confirmStatement(userInfo, params)
      case 'generateStatement':
        return await generateStatement(userInfo, params)
      case 'getStatementStats':
        return await getStatementStats(userInfo, params)
      case 'exportStatement':
        return await exportStatement(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('对账单云函数错误:', error)
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

// 获取对账单列表
async function getStatements(userInfo, params) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      factoryId, 
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
    
    if (status !== undefined) {
      where.status = status
    }
    
    if (startDate && endDate) {
      where.statementDate = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    if (keyword) {
      where.$or = [
        { statementNo: db.RegExp({ regexp: keyword, options: 'i' }) },
        { remark: db.RegExp({ regexp: keyword, options: 'i' }) }
      ]
    }
    
    // 查询对账单
    const result = await db.collection('statements')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()
    
    // 查询总数
    const countResult = await db.collection('statements')
      .where(where)
      .count()
    
    // 关联查询相关信息
    const statements = await enrichStatements(result.data)
    
    return {
      success: true,
      data: {
        statements,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取对账单列表失败:', error)
    return {
      success: false,
      error: '获取对账单列表失败'
    }
  }
}

// 创建对账单
async function createStatement(userInfo, params) {
  try {
    const {
      factoryId,
      statementDate,
      startDate,
      endDate,
      items,
      remark
    } = params
    
    // 验证必填字段
    if (!factoryId || !statementDate || !startDate || !endDate || !items || !Array.isArray(items)) {
      return {
        success: false,
        error: '缺少必填字段或数据格式错误'
      }
    }
    
    // 验证工厂是否存在
    const factoryResult = await db.collection('factories').doc(factoryId).get()
    if (!factoryResult.data) {
      return {
        success: false,
        error: '工厂不存在'
      }
    }
    
    // 计算总金额
    let totalAmount = 0
    let totalQuantity = 0
    
    const processedItems = items.map(item => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const amount = quantity * unitPrice
      
      totalAmount += amount
      totalQuantity += quantity
      
      return {
        ...item,
        quantity,
        unitPrice,
        amount
      }
    })
    
    // 生成对账单号
    const statementNo = await generateStatementNo()
    
    // 创建对账单
    const statementData = {
      statementNo,
      factoryId,
      statementDate: new Date(statementDate),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      items: processedItems,
      totalQuantity,
      totalAmount,
      remark: remark || '',
      orgId: userInfo.orgId,
      createTime: new Date(),
      createBy: userInfo._id,
      updateTime: new Date(),
      updateBy: userInfo._id,
      confirmTime: null,
      confirmBy: null,
      status: 1 // 1: 待确认, 2: 已确认, 0: 已删除
    }
    
    const result = await db.collection('statements').add({
      data: statementData
    })
    
    return {
      success: true,
      data: {
        statementId: result._id,
        ...statementData
      }
    }
  } catch (error) {
    console.error('创建对账单失败:', error)
    return {
      success: false,
      error: '创建对账单失败'
    }
  }
}

// 更新对账单
async function updateStatement(userInfo, params) {
  try {
    const { statementId, ...updateData } = params
    
    if (!statementId) {
      return {
        success: false,
        error: '缺少对账单ID'
      }
    }
    
    // 检查对账单是否存在
    const statementResult = await db.collection('statements')
      .doc(statementId)
      .get()
    
    if (!statementResult.data) {
      return {
        success: false,
        error: '对账单不存在'
      }
    }
    
    // 检查权限
    if (statementResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限操作此对账单'
      }
    }
    
    // 检查状态（已确认的对账单不能修改）
    if (statementResult.data.status === 2) {
      return {
        success: false,
        error: '已确认的对账单不能修改'
      }
    }
    
    // 准备更新数据
    const updateFields = {
      updateTime: new Date(),
      updateBy: userInfo._id
    }
    
    // 允许更新的字段
    const allowedFields = [
      'factoryId', 'statementDate', 'startDate', 'endDate', 'items', 'remark'
    ]
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'statementDate' || field === 'startDate' || field === 'endDate') {
          updateFields[field] = new Date(updateData[field])
        } else {
          updateFields[field] = updateData[field]
        }
      }
    })
    
    // 重新计算总金额（如果更新了items）
    if (updateFields.items) {
      let totalAmount = 0
      let totalQuantity = 0
      
      const processedItems = updateFields.items.map(item => {
        const quantity = Number(item.quantity) || 0
        const unitPrice = Number(item.unitPrice) || 0
        const amount = quantity * unitPrice
        
        totalAmount += amount
        totalQuantity += quantity
        
        return {
          ...item,
          quantity,
          unitPrice,
          amount
        }
      })
      
      updateFields.items = processedItems
      updateFields.totalQuantity = totalQuantity
      updateFields.totalAmount = totalAmount
    }
    
    // 更新对账单
    await db.collection('statements')
      .doc(statementId)
      .update({
        data: updateFields
      })
    
    return {
      success: true,
      data: {
        statementId,
        ...updateFields
      }
    }
  } catch (error) {
    console.error('更新对账单失败:', error)
    return {
      success: false,
      error: '更新对账单失败'
    }
  }
}

// 删除对账单
async function deleteStatement(userInfo, params) {
  try {
    const { statementId } = params
    
    if (!statementId) {
      return {
        success: false,
        error: '缺少对账单ID'
      }
    }
    
    // 检查对账单是否存在
    const statementResult = await db.collection('statements')
      .doc(statementId)
      .get()
    
    if (!statementResult.data) {
      return {
        success: false,
        error: '对账单不存在'
      }
    }
    
    // 检查权限
    if (statementResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限操作此对账单'
      }
    }
    
    // 检查状态（已确认的对账单不能删除）
    if (statementResult.data.status === 2) {
      return {
        success: false,
        error: '已确认的对账单不能删除'
      }
    }
    
    // 软删除对账单
    await db.collection('statements')
      .doc(statementId)
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
        statementId
      }
    }
  } catch (error) {
    console.error('删除对账单失败:', error)
    return {
      success: false,
      error: '删除对账单失败'
    }
  }
}

// 获取对账单详情
async function getStatementDetail(userInfo, params) {
  try {
    const { statementId } = params
    
    if (!statementId) {
      return {
        success: false,
        error: '缺少对账单ID'
      }
    }
    
    // 查询对账单详情
    const statementResult = await db.collection('statements')
      .doc(statementId)
      .get()
    
    if (!statementResult.data) {
      return {
        success: false,
        error: '对账单不存在'
      }
    }
    
    // 检查权限
    if (statementResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限查看此对账单'
      }
    }
    
    // 关联查询相关信息
    const enrichedStatements = await enrichStatements([statementResult.data])
    
    return {
      success: true,
      data: enrichedStatements[0]
    }
  } catch (error) {
    console.error('获取对账单详情失败:', error)
    return {
      success: false,
      error: '获取对账单详情失败'
    }
  }
}

// 确认对账单
async function confirmStatement(userInfo, params) {
  try {
    const { statementId } = params
    
    if (!statementId) {
      return {
        success: false,
        error: '缺少对账单ID'
      }
    }
    
    // 检查对账单是否存在
    const statementResult = await db.collection('statements')
      .doc(statementId)
      .get()
    
    if (!statementResult.data) {
      return {
        success: false,
        error: '对账单不存在'
      }
    }
    
    // 检查权限
    if (statementResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限操作此对账单'
      }
    }
    
    // 检查状态
    if (statementResult.data.status === 2) {
      return {
        success: false,
        error: '对账单已确认'
      }
    }
    
    if (statementResult.data.status === 0) {
      return {
        success: false,
        error: '对账单已删除'
      }
    }
    
    // 确认对账单
    await db.collection('statements')
      .doc(statementId)
      .update({
        data: {
          status: 2,
          confirmTime: new Date(),
          confirmBy: userInfo._id,
          updateTime: new Date(),
          updateBy: userInfo._id
        }
      })
    
    return {
      success: true,
      data: {
        statementId,
        status: 2,
        confirmTime: new Date(),
        confirmBy: userInfo._id
      }
    }
  } catch (error) {
    console.error('确认对账单失败:', error)
    return {
      success: false,
      error: '确认对账单失败'
    }
  }
}

// 生成对账单
async function generateStatement(userInfo, params) {
  try {
    const { factoryId, startDate, endDate } = params
    
    if (!factoryId || !startDate || !endDate) {
      return {
        success: false,
        error: '缺少必填参数'
      }
    }
    
    // 验证工厂是否存在
    const factoryResult = await db.collection('factories').doc(factoryId).get()
    if (!factoryResult.data) {
      return {
        success: false,
        error: '工厂不存在'
      }
    }
    
    // 查询指定时间段内的流水记录
    const flowRecordsResult = await db.collection('flow_records')
      .where({
        orgId: userInfo.orgId,
        factoryId,
        status: 1,
        processDate: _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
      })
      .orderBy('processDate', 'asc')
      .get()
    
    if (flowRecordsResult.data.length === 0) {
      return {
        success: false,
        error: '指定时间段内没有找到相关流水记录'
      }
    }
    
    // 按产品和工序分组汇总
    const itemsMap = {}
    
    flowRecordsResult.data.forEach(record => {
      const key = `${record.productId}_${record.processId}`
      
      if (!itemsMap[key]) {
        itemsMap[key] = {
          productId: record.productId,
          processId: record.processId,
          quantity: 0,
          unitPrice: record.unitPrice,
          amount: 0,
          recordIds: []
        }
      }
      
      itemsMap[key].quantity += record.quantity
      itemsMap[key].amount += record.totalAmount
      itemsMap[key].recordIds.push(record._id)
    })
    
    const items = Object.values(itemsMap)
    
    // 计算总金额
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0)
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    
    return {
      success: true,
      data: {
        factoryId,
        startDate,
        endDate,
        items,
        totalQuantity,
        totalAmount,
        recordCount: flowRecordsResult.data.length
      }
    }
  } catch (error) {
    console.error('生成对账单失败:', error)
    return {
      success: false,
      error: '生成对账单失败'
    }
  }
}

// 获取对账单统计
async function getStatementStats(userInfo, params) {
  try {
    const { startDate, endDate, factoryId } = params
    
    // 构建查询条件
    const where = {
      orgId: userInfo.orgId,
      status: _.neq(0)
    }
    
    if (factoryId) {
      where.factoryId = factoryId
    }
    
    if (startDate && endDate) {
      where.createTime = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
    }
    
    // 聚合统计
    const result = await db.collection('statements')
      .aggregate()
      .match(where)
      .group({
        _id: null,
        totalStatements: _.sum(1),
        totalAmount: _.sum('$totalAmount'),
        totalQuantity: _.sum('$totalQuantity'),
        confirmedCount: _.sum(_.cond([
          [_.eq(['$status', 2]), 1],
          [true, 0]
        ])),
        pendingCount: _.sum(_.cond([
          [_.eq(['$status', 1]), 1],
          [true, 0]
        ]))
      })
      .end()
    
    // 按工厂统计
    const factoryStats = await db.collection('statements')
      .aggregate()
      .match(where)
      .group({
        _id: '$factoryId',
        statementCount: _.sum(1),
        totalAmount: _.sum('$totalAmount'),
        totalQuantity: _.sum('$totalQuantity')
      })
      .sort({
        totalAmount: -1
      })
      .limit(10)
      .end()
    
    // 按月统计
    const monthlyStats = await db.collection('statements')
      .aggregate()
      .match(where)
      .group({
        _id: {
          year: _.year('$statementDate'),
          month: _.month('$statementDate')
        },
        statementCount: _.sum(1),
        totalAmount: _.sum('$totalAmount')
      })
      .sort({
        '_id.year': -1,
        '_id.month': -1
      })
      .limit(12)
      .end()
    
    const stats = result.list[0] || {
      totalStatements: 0,
      totalAmount: 0,
      totalQuantity: 0,
      confirmedCount: 0,
      pendingCount: 0
    }
    
    return {
      success: true,
      data: {
        summary: stats,
        factoryStats: factoryStats.list,
        monthlyStats: monthlyStats.list
      }
    }
  } catch (error) {
    console.error('获取对账单统计失败:', error)
    return {
      success: false,
      error: '获取对账单统计失败'
    }
  }
}

// 导出对账单
async function exportStatement(userInfo, params) {
  try {
    const { statementId } = params
    
    if (!statementId) {
      return {
        success: false,
        error: '缺少对账单ID'
      }
    }
    
    // 查询对账单详情
    const statementResult = await db.collection('statements')
      .doc(statementId)
      .get()
    
    if (!statementResult.data) {
      return {
        success: false,
        error: '对账单不存在'
      }
    }
    
    // 检查权限
    if (statementResult.data.orgId !== userInfo.orgId) {
      return {
        success: false,
        error: '无权限操作此对账单'
      }
    }
    
    // 关联查询相关信息
    const enrichedStatements = await enrichStatements([statementResult.data])
    const statement = enrichedStatements[0]
    
    // 转换为导出格式
    const exportData = {
      statementInfo: {
        statementNo: statement.statementNo,
        factoryName: statement.factory?.name || '',
        statementDate: statement.statementDate,
        startDate: statement.startDate,
        endDate: statement.endDate,
        totalQuantity: statement.totalQuantity,
        totalAmount: statement.totalAmount,
        status: statement.status === 2 ? '已确认' : '待确认',
        createTime: statement.createTime,
        remark: statement.remark
      },
      items: statement.items.map(item => ({
        productName: item.product?.name || '',
        processName: item.process?.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount
      }))
    }
    
    return {
      success: true,
      data: exportData
    }
  } catch (error) {
    console.error('导出对账单失败:', error)
    return {
      success: false,
      error: '导出对账单失败'
    }
  }
}

// 关联查询相关信息
async function enrichStatements(statements) {
  if (!statements || statements.length === 0) {
    return []
  }
  
  // 提取所有相关ID
  const factoryIds = [...new Set(statements.map(s => s.factoryId).filter(Boolean))]
  const userIds = [...new Set(statements.map(s => s.createBy).filter(Boolean))]
  
  // 从items中提取产品和工序ID
  const productIds = [...new Set(statements.flatMap(s => s.items?.map(item => item.productId) || []).filter(Boolean))]
  const processIds = [...new Set(statements.flatMap(s => s.items?.map(item => item.processId) || []).filter(Boolean))]
  
  // 并行查询相关信息
  const [factoryResult, userResult, productResult, processResult] = await Promise.all([
    factoryIds.length > 0 ? db.collection('factories').where({ _id: _.in(factoryIds) }).get() : { data: [] },
    userIds.length > 0 ? db.collection('users').where({ _id: _.in(userIds) }).get() : { data: [] },
    productIds.length > 0 ? db.collection('products').where({ _id: _.in(productIds) }).get() : { data: [] },
    processIds.length > 0 ? db.collection('processes').where({ _id: _.in(processIds) }).get() : { data: [] }
  ])
  
  // 创建映射
  const factoryMap = {}
  const userMap = {}
  const productMap = {}
  const processMap = {}
  
  factoryResult.data.forEach(item => {
    factoryMap[item._id] = item
  })
  
  userResult.data.forEach(item => {
    userMap[item._id] = item
  })
  
  productResult.data.forEach(item => {
    productMap[item._id] = item
  })
  
  processResult.data.forEach(item => {
    processMap[item._id] = item
  })
  
  // 关联数据
  return statements.map(statement => {
    // 关联items中的产品和工序信息
    const enrichedItems = statement.items?.map(item => ({
      ...item,
      product: productMap[item.productId] || null,
      process: processMap[item.processId] || null
    })) || []
    
    return {
      ...statement,
      factory: factoryMap[statement.factoryId] || null,
      createUser: userMap[statement.createBy] || null,
      confirmUser: statement.confirmBy ? userMap[statement.confirmBy] || null : null,
      items: enrichedItems
    }
  })
}

// 生成对账单号
async function generateStatementNo() {
  const now = new Date()
  const dateStr = now.getFullYear().toString() + 
                  (now.getMonth() + 1).toString().padStart(2, '0') + 
                  now.getDate().toString().padStart(2, '0')
  
  // 查询当天最大序号
  const result = await db.collection('statements')
    .where({
      statementNo: db.RegExp({ regexp: `^ST${dateStr}`, options: 'i' })
    })
    .orderBy('statementNo', 'desc')
    .limit(1)
    .get()
  
  let sequence = 1
  if (result.data.length > 0) {
    const lastStatementNo = result.data[0].statementNo
    const lastSequence = parseInt(lastStatementNo.slice(-4))
    sequence = lastSequence + 1
  }
  
  return `ST${dateStr}${sequence.toString().padStart(4, '0')}`
}