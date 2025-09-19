// 组织管理相关处理函数
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
 * 获取组织列表
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getOrganizations(userInfo, params) {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = params
    
    // 权限检查：只有超级管理员可以查看所有组织
    if (!userInfo.isSuperAdmin) {
      // 普通用户只能查看自己的组织
      const orgResult = await db.collection('organizations')
        .doc(userInfo.orgId)
        .get()
      
      if (!orgResult.data) {
        return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织不存在')
      }
      
      return ApiResponse.success({
          organizations: [orgResult.data],
          total: 1,
          page: 1,
          limit: 1
        }, '操作成功')
    }
    
    // 构建查询条件
    let whereCondition = {}
    
    // 搜索条件
    if (search) {
      whereCondition[_.or] = [
        { name: db.RegExp({ regexp: search, options: 'i' }) },
        { code: db.RegExp({ regexp: search, options: 'i' }) }
      ]
    }
    
    // 状态过滤
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    // 分页查询
    const result = await db.collection('organizations')
      .where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await db.collection('organizations')
      .where(whereCondition)
      .count()
    
    return ApiResponse.success({
        organizations: result.data,
        total: countResult.total,
        page: parseInt(page),
        limit: parseInt(limit)
      }, '操作成功')
  } catch (error) {
    console.error('获取组织列表错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取组织列表失败')
  }
}

/**
 * 获取组织详情
 * @param {Object} userInfo 用户信息
 * @param {Object} params 查询参数
 */
async function getOrganizationById(userInfo, params) {
  try {
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织ID不能为空')
    }
    
    // 权限检查：超级管理员可以查看任何组织，普通用户只能查看自己的组织
    if (!userInfo.isSuperAdmin && id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限访问该组织信息')
    }
    
    const result = await db.collection('organizations')
      .doc(id)
      .get()
    
    if (!result.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织不存在')
    }
    
    return ApiResponse.success(result.data, '操作成功')
  } catch (error) {
    console.error('获取组织详情错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '获取组织详情失败')
  }
}

/**
 * 创建组织
 * @param {Object} userInfo 用户信息
 * @param {Object} params 组织数据
 */
async function addOrganization(userInfo, params) {
  try {
    // 权限检查：只有超级管理员可以创建组织
    if (!userInfo.isSuperAdmin) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限创建组织')
    }
    
    const { name, code, description, contact_person, contact_phone, contact_email } = params
    
    if (!name || !code) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织名称和代码不能为空')
    }
    
    // 检查组织代码是否已存在
    const existingOrg = await db.collection('organizations')
      .where({ code: code })
      .get()
    
    if (existingOrg.data.length > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织代码已存在')
    }
    
    // 创建组织
    const orgData = {
      name,
      code,
      description: description || '',
      contact_person: contact_person || '',
      contact_phone: contact_phone || '',
      contact_email: contact_email || '',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: userInfo.userId
    }
    
    const result = await db.collection('organizations')
      .add({
        data: orgData
      })
    
    return ApiResponse.success({
        id: result._id,
        ...orgData
      }, '操作成功')
  } catch (error) {
    console.error('创建组织错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '创建组织失败')
  }
}

/**
 * 更新组织
 * @param {Object} userInfo 用户信息
 * @param {Object} params 更新数据
 */
async function updateOrganization(userInfo, params) {
  try {
    const { id, name, description, contact_person, contact_phone, contact_email } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织ID不能为空')
    }
    
    // 权限检查：超级管理员可以更新任何组织，组织管理员只能更新自己的组织
    if (!userInfo.isSuperAdmin && id !== userInfo.orgId) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限更新该组织')
    }
    
    // 检查组织是否存在
    const orgResult = await db.collection('organizations')
      .doc(id)
      .get()
    
    if (!orgResult.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织不存在')
    }
    
    // 构建更新数据
    const updateData = {
      updated_at: new Date()
    }
    
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (contact_person !== undefined) updateData.contact_person = contact_person
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone
    if (contact_email !== undefined) updateData.contact_email = contact_email
    
    // 更新组织
    await db.collection('organizations')
      .doc(id)
      .update({
        data: updateData
      })
    
    return ApiResponse.success({
        message: '组织更新成功'
      }, '操作成功')
  } catch (error) {
    console.error('更新组织错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新组织失败')
  }
}

/**
 * 删除组织
 * @param {Object} userInfo 用户信息
 * @param {Object} params 删除参数
 */
async function deleteOrganization(userInfo, params) {
  try {
    // 权限检查：只有超级管理员可以删除组织
    if (!userInfo.isSuperAdmin) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限删除组织')
    }
    
    const { id } = params
    
    if (!id) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织ID不能为空')
    }
    
    // 检查组织是否存在
    const orgResult = await db.collection('organizations')
      .doc(id)
      .get()
    
    if (!orgResult.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织不存在')
    }
    
    // 检查是否有关联的用户
    const userCount = await db.collection('users')
      .where({ org_id: id })
      .count()
    
    if (userCount.total > 0) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '该组织下还有用户，无法删除')
    }
    
    // 删除组织（软删除）
    await db.collection('organizations')
      .doc(id)
      .update({
        data: {
          status: 'deleted',
          deleted_at: new Date(),
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success({
        message: '组织删除成功'
      }, '操作成功')
  } catch (error) {
    console.error('删除组织错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '删除组织失败')
  }
}

/**
 * 更新组织状态
 * @param {Object} userInfo 用户信息
 * @param {Object} params 状态更新参数
 */
async function updateOrganizationStatus(userInfo, params) {
  try {
    // 权限检查：只有超级管理员可以更新组织状态
    if (!userInfo.isSuperAdmin) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无权限更新组织状态')
    }
    
    const { id, status } = params
    
    if (!id || !status) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织ID和状态不能为空')
    }
    
    if (!['active', 'inactive'].includes(status)) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '无效的状态值')
    }
    
    // 检查组织是否存在
    const orgResult = await db.collection('organizations')
      .doc(id)
      .get()
    
    if (!orgResult.data) {
      return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '组织不存在')
    }
    
    // 更新状态
    await db.collection('organizations')
      .doc(id)
      .update({
        data: {
          status: status,
          updated_at: new Date()
        }
      })
    
    return ApiResponse.success({
        message: '组织状态更新成功'
      }, '操作成功')
  } catch (error) {
    console.error('更新组织状态错误:', error)
    return ApiResponse.error(BusinessErrorCodes.GENERAL_ERROR, '更新组织状态失败')
  }
}

module.exports = {
  getOrganizations,
  getOrganizationById,
  addOrganization,
  updateOrganization,
  deleteOrganization,
  updateOrganizationStatus
}