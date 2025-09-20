// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const JWT_SECRET = process.env.JWT_SECRET || 'yunsf-jwt-secret-2024-default-key-for-development'

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('收到请求:', JSON.stringify(event))
  
  const { action, token, ...params } = event || {}
  
  try {
    // 基本参数检查
    if (!action) {
      return {
        success: false,
        error: '缺少action参数'
      }
    }
    
    // 验证token
    const authResult = await verifyToken(token)
    if (!authResult.success) {
      return authResult
    }
    const userInfo = authResult.data
    
    console.log('用户信息:', JSON.stringify(userInfo))
    console.log('操作类型:', action)
    console.log('参数:', JSON.stringify(params))
    
    // 路由到具体的处理函数
    switch (action) {
      case 'uploadFromMiniprogram':
        return await uploadFromMiniprogram(userInfo, params)
      case 'test':
        return await testUpload(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型: ' + action
        }
    }
  } catch (error) {
    console.error('上传云函数错误:', error)
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

    if (!userResult.data || userResult.data.status !== 1) {
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

// 小程序端文件上传
async function uploadFromMiniprogram(userInfo, params) {
  try {
    const { filePath, fileName, fileType = 'image', folder = 'uploads' } = params
    
    if (!filePath) {
      return {
        success: false,
        error: '文件路径不能为空'
      }
    }
    
    // 生成云存储路径
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substr(2, 8)
    let fileExtension = 'jpg' // 默认扩展名
    
    if (fileName) {
      fileExtension = fileName.split('.').pop() || 'jpg'
    } else if (filePath.includes('.')) {
      fileExtension = filePath.split('.').pop() || 'jpg'
    }
    
    const cloudPath = `${folder}/${userInfo.orgId}/${timestamp}_${randomStr}.${fileExtension}`
    
    // 在云函数中无法直接处理小程序的临时文件路径
    // 返回云存储路径，让小程序端直接上传
    return {
      success: true,
      data: {
        cloudPath: cloudPath,
        needDirectUpload: true,
        message: '请使用小程序端直接上传到云存储'
      }
    }
    
    // 获取文件下载链接
    const downloadResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    })
    
    let downloadUrl = ''
    if (downloadResult.fileList && downloadResult.fileList.length > 0) {
      downloadUrl = downloadResult.fileList[0].tempFileURL
    }
    
    // 记录文件信息到数据库
    const fileRecord = {
      cloud_path: cloudPath,
      file_id: uploadResult.fileID,
      original_name: fileName || `upload_${timestamp}.${fileExtension}`,
      file_type: fileType,
      file_size: 0, // 云函数中无法直接获取文件大小
      folder: folder,
      org_id: userInfo.orgId,
      uploaded_by: userInfo.userId,
      created_at: new Date(),
      download_url: downloadUrl
    }
    
    const dbResult = await db.collection('files').add({
      data: fileRecord
    })
    
    // 生成相对路径用于前端显示
    const relativePath = `/${folder}/${userInfo.orgId}/${timestamp}_${randomStr}.${fileExtension}`
    
    return {
      success: true,
      data: {
        id: dbResult._id,
        fileId: uploadResult.fileID,
        cloudPath: cloudPath,
        filePath: relativePath, // 返回相对路径
        url: relativePath, // 兼容性字段
        downloadUrl: downloadUrl,
        originalName: fileRecord.original_name,
        fileType: fileType
      }
    }
  } catch (error) {
    console.error('小程序文件上传错误:', error)
    return {
      success: false,
      error: '文件上传失败: ' + error.message
    }
  }
}

// 测试上传功能
async function testUpload(userInfo, params) {
  try {
    return {
      success: true,
      data: {
        message: '文件上传功能测试完成',
        userInfo: userInfo,
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('测试上传功能错误:', error)
    return {
      success: false,
      error: '测试上传功能失败: ' + error.message
    }
  }
}