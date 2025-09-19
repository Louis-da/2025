// 用户管理相关处理函数
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
 * 获取用户列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getUsers(userInfo, params) {
  try {
    const { page = 1, limit = 20, search = '', role_id = 'all', status = 'all' } = params
    
    // 权限检查：只有管理员和主管可以查看用户列表
    if (!['admin', 'manager'].includes(userInfo.roleId)) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限访问用户列表')
    }
    
    let whereCondition = {
      org_id: userInfo.orgId
    }
    
    // 搜索条件
    if (search) {
      whereCondition[_.or] = [
        { username: db.RegExp({ regexp: search, options: 'i' }) },
        { email: db.RegExp({ regexp: search, options: 'i' }) },
        { phone: db.RegExp({ regexp: search, options: 'i' }) }
      ]
    }
    
    // 角色过滤
    if (role_id !== 'all') {
      whereCondition.role_id = role_id
    }
    
    // 状态过滤
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    // 分页查询
    const result = await db.collection('users')
      .where(whereCondition)
      .field({
        password: false // 不返回密码字段
      })
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await db.collection('users')
      .where(whereCondition)
      .count()
    
    // 关联查询角色和组织信息
    const users = await Promise.all(result.data.map(async (user) => {
      const [role, org] = await Promise.all([
        user.role_id ? db.collection('roles').doc(user.role_id).get().catch(() => null) : null,
        user.org_id ? db.collection('organizations').doc(user.org_id).get().catch(() => null) : null
      ])
      
      return {
        ...user,
        role_name: role?.data?.name || '',
        org_name: org?.data?.name || ''
      }
    }))
    
    return ApiResponse.success({
        users,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取用户列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取用户列表失败')
  }
}

/**
 * 获取当前用户信息
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getCurrentUser(userInfo, params) {
  try {
    const userResult = await db.collection('users')
      .doc(userInfo.userId)
      .field({
        password: false // 不返回密码字段
      })
      .get()
    
    if (!userResult.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '用户不存在')
    }
    
    // 关联查询角色和组织信息
    const [role, org] = await Promise.all([
      userResult.data.role_id ? db.collection('roles').doc(userResult.data.role_id).get().catch(() => null) : null,
      userResult.data.org_id ? db.collection('organizations').doc(userResult.data.org_id).get().catch(() => null) : null
    ])
    
    return ApiResponse.success({
        ...userResult.data,
        role_name: role?.data?.name || '',
        org_name: org?.data?.name || '',
        permissions: role?.data?.permissions || []
      }, '操作成功')
  } catch (error) {
    console.error('获取当前用户信息错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取用户信息失败')
  }
}

/**
 * 更新用户信息
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateUser(userInfo, params) {
  try {
    const { id, username, email, phone, role_id, status } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '缺少用户ID')
    }
    
    // 权限检查：只有管理员可以修改其他用户，用户可以修改自己的基本信息
    if (id !== userInfo.userId && userInfo.roleId !== 'admin') {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限修改此用户信息')
    }
    
    // 验证用户是否存在且属于当前组织
    const user = await db.collection('users')
      .doc(id)
      .get()
    
    if (!user.data || user.data.org_id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '用户不存在或无权限修改')
    }
    
    // 检查用户名重复
    if (username && username !== user.data.username) {
      const existingUser = await db.collection('users')
        .where({
          org_id: userInfo.orgId,
          username: username,
          _id: _.neq(id)
        })
        .get()
      
      if (existingUser.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '用户名已存在')
      }
    }
    
    // 检查邮箱重复
    if (email && email !== user.data.email) {
      const existingEmail = await db.collection('users')
        .where({
          org_id: userInfo.orgId,
          email: email,
          _id: _.neq(id)
        })
        .get()
      
      if (existingEmail.data.length > 0) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '邮箱已存在')
      }
    }
    
    const updateData = {
      updated_at: new Date(),
      updated_by: userInfo.userId
    }
    
    // 普通用户只能修改基本信息
    if (id === userInfo.userId) {
      if (username !== undefined) updateData.username = username
      if (email !== undefined) updateData.email = email
      if (phone !== undefined) updateData.phone = phone
    } else {
      // 管理员可以修改所有信息
      if (username !== undefined) updateData.username = username
      if (email !== undefined) updateData.email = email
      if (phone !== undefined) updateData.phone = phone
      if (role_id !== undefined) updateData.role_id = role_id
      if (status !== undefined) updateData.status = status
    }
    
    await db.collection('users')
      .doc(id)
      .update({ data: updateData })
    
    return ApiResponse.success({ id, ...updateData
    }, '操作成功')
  } catch (error) {
    console.error('更新用户信息错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新用户信息失败')
  }
}

/**
 * 修改密码
 * @param {Object} userInfo 用户信息
 * @param {Object} params 密码数据
 */
async function changePassword(userInfo, params) {
  try {
    const { old_password, new_password } = params
    
    if (!old_password || !new_password) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '旧密码和新密码为必填项')
    }
    
    if (new_password.length < 6) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '新密码长度不能少于6位')
    }
    
    // 获取用户当前密码
    const userResult = await db.collection('users')
      .doc(userInfo.userId)
      .get()
    
    if (!userResult.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '用户不存在')
    }
    
    // 验证旧密码（这里简化处理，实际应该使用加密比较）
    if (userResult.data.password !== old_password) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '旧密码错误')
    }
    
    // 更新密码
    await db.collection('users')
      .doc(userInfo.userId)
      .update({
        data: {
          password: new_password, // 实际应该加密存储
          updated_at: new Date()
        }
      })
    
    return {
      success: true,
      message: '密码修改成功'
    }
  } catch (error) {
    console.error('修改密码错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '修改密码失败')
  }
}

/**
 * 获取统计数据
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getStats(userInfo, params) {
  try {
    const { start_date, end_date } = params
    
    // 构建日期过滤条件
    let dateFilter = {}
    if (start_date || end_date) {
      if (start_date) {
        dateFilter[_.gte] = new Date(start_date)
      }
      if (end_date) {
        dateFilter[_.lte] = new Date(end_date + ' 23:59:59')
      }
    }
    
    // 基础查询条件
    const baseCondition = { org_id: userInfo.orgId }
    const dateCondition = Object.keys(dateFilter).length > 0 
      ? { ...baseCondition, created_at: dateFilter }
      : baseCondition
    
    // 并行查询各种统计数据
    const [
      // 订单统计
      sendOrdersCount,
      receiveOrdersCount,
      pendingSendOrders,
      pendingReceiveOrders,
      
      // 基础数据统计
      factoriesCount,
      productsCount,
      processesCount,
      usersCount,
      
      // 数量统计
      sendOrdersResult,
      receiveOrdersResult
    ] = await Promise.all([
      db.collection('send_orders').where(dateCondition).count(),
      db.collection('receive_orders').where(dateCondition).count(),
      db.collection('send_orders').where({ ...dateCondition, status: 'pending' }).count(),
      db.collection('receive_orders').where({ ...dateCondition, status: 'pending' }).count(),
      
      db.collection('factories').where({ ...baseCondition, status: 'active' }).count(),
      db.collection('products').where({ ...baseCondition, status: 'active' }).count(),
      db.collection('processes').where({ ...baseCondition, status: 'active' }).count(),
      db.collection('users').where({ ...baseCondition, status: 'active' }).count(),
      
      db.collection('send_orders').where(dateCondition).field({ total_quantity: true }).get(),
      db.collection('receive_orders').where(dateCondition).field({ total_quantity: true }).get()
    ])
    
    // 计算总数量
    const totalSendQuantity = sendOrdersResult.data.reduce((sum, order) => sum + (order.total_quantity || 0), 0)
    const totalReceiveQuantity = receiveOrdersResult.data.reduce((sum, order) => sum + (order.total_quantity || 0), 0)
    
    // 获取最近7天的订单趋势
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().slice(0, 10)
      
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      
      const [sendCount, receiveCount] = await Promise.all([
        db.collection('send_orders').where({
          org_id: userInfo.orgId,
          created_at: _.gte(dayStart).and(_.lt(dayEnd))
        }).count(),
        db.collection('receive_orders').where({
          org_id: userInfo.orgId,
          created_at: _.gte(dayStart).and(_.lt(dayEnd))
        }).count()
      ])
      
      last7Days.push({
        date: dateStr,
        sendOrders: sendCount.total,
        receiveOrders: receiveCount.total
      })
    }
    
    return ApiResponse.success({
        // 订单统计
        orders: {
          totalSendOrders: sendOrdersCount.total,
          totalReceiveOrders: receiveOrdersCount.total,
          pendingSendOrders: pendingSendOrders.total,
          pendingReceiveOrders: pendingReceiveOrders.total,
          totalSendQuantity,
          totalReceiveQuantity
        },
        
        // 基础数据统计
        baseData: {
          factories: factoriesCount.total,
          products: productsCount.total,
          processes: processesCount.total,
          users: usersCount.total
        },
        
        // 趋势数据
        trends: {
          last7Days
        }
      }, '操作成功')
  } catch (error) {
    console.error('获取统计数据错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取统计数据失败')
  }
}

/**
 * 获取公开统计数据（无需登录）
 * @param {Object} params 查询参数
 */
async function getPublicStats(params) {
  try {
    // 获取系统总体统计（所有组织）
    const [organizationsCount, usersCount, ordersCount] = await Promise.all([
      db.collection('organizations').where({ status: 'active' }).count(),
      db.collection('users').where({ status: 'active' }).count(),
      db.collection('send_orders').count()
    ])
    
    return ApiResponse.success({
        organizations: organizationsCount.total,
        users: usersCount.total,
        orders: ordersCount.total
      }, '操作成功')
  } catch (error) {
    console.error('获取公开统计数据错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取统计数据失败')
  }
}

module.exports = {
  getUsers,
  getCurrentUser,
  updateUser,
  changePassword,
  getStats,
  getPublicStats
}