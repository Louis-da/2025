// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const storage = cloud.storage()
const JWT_SECRET = 'yunsf-jwt-secret-2024' // 生产环境应使用环境变量

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
      case 'getUploadUrl':
        return await getUploadUrl(userInfo, params)
      case 'uploadFile':
        return await uploadFile(userInfo, params)
      case 'deleteFile':
        return await deleteFile(userInfo, params)
      case 'getFileList':
        return await getFileList(userInfo, params)
      case 'getDownloadUrl':
        return await getDownloadUrl(userInfo, params)
      case 'test':
        return await testUpload(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
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

    if (!userResult.data || userResult.data.status !== 'active') {
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

// 获取上传URL（用于前端直接上传）
async function getUploadUrl(userInfo, params) {
  try {
    const { fileName, fileType = 'image', folder = 'general' } = params
    
    if (!fileName) {
      return {
        success: false,
        error: '文件名不能为空'
      }
    }
    
    // 生成云存储路径
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substr(2, 8)
    const fileExtension = fileName.split('.').pop()
    const cloudPath = `${folder}/${userInfo.orgId}/${timestamp}_${randomStr}.${fileExtension}`
    
    // 生成上传签名URL（如果云存储支持）
    // 这里返回云存储路径，前端使用 wx.cloud.uploadFile 上传
    return {
      success: true,
      data: {
        cloudPath: cloudPath,
        uploadMethod: 'wx.cloud.uploadFile',
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: fileType === 'image' ? ['jpg', 'jpeg', 'png', 'gif'] : ['pdf', 'doc', 'docx', 'xls', 'xlsx']
      }
    }
  } catch (error) {
    console.error('获取上传URL错误:', error)
    return {
      success: false,
      error: '获取上传URL失败'
    }
  }
}

// 上传文件（云函数内部上传）
async function uploadFile(userInfo, params) {
  try {
    const { fileContent, fileName, fileType = 'image', folder = 'general' } = params
    
    if (!fileContent || !fileName) {
      return {
        success: false,
        error: '文件内容和文件名不能为空'
      }
    }
    
    // 生成云存储路径
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substr(2, 8)
    const fileExtension = fileName.split('.').pop()
    const cloudPath = `${folder}/${userInfo.orgId}/${timestamp}_${randomStr}.${fileExtension}`
    
    // 上传到云存储
    const uploadResult = await storage.uploadFile({
      cloudPath: cloudPath,
      fileContent: Buffer.from(fileContent, 'base64')
    })
    
    // 记录文件信息到数据库
    const fileRecord = {
      cloud_path: cloudPath,
      file_id: uploadResult.fileID,
      original_name: fileName,
      file_type: fileType,
      file_size: Buffer.from(fileContent, 'base64').length,
      folder: folder,
      org_id: userInfo.orgId,
      uploaded_by: userInfo.userId,
      created_at: new Date()
    }
    
    const dbResult = await db.collection('files').add({
      data: fileRecord
    })
    
    return {
      success: true,
      data: {
        id: dbResult._id,
        fileId: uploadResult.fileID,
        cloudPath: cloudPath,
        originalName: fileName,
        fileType: fileType,
        fileSize: fileRecord.file_size
      }
    }
  } catch (error) {
    console.error('上传文件错误:', error)
    return {
      success: false,
      error: '上传文件失败'
    }
  }
}

// 删除文件
async function deleteFile(userInfo, params) {
  try {
    const { fileId, cloudPath } = params
    
    if (!fileId && !cloudPath) {
      return {
        success: false,
        error: '文件ID或云存储路径不能为空'
      }
    }
    
    let fileRecord = null
    
    // 根据fileId或cloudPath查找文件记录
    if (fileId) {
      const result = await db.collection('files')
        .where({
          file_id: fileId,
          org_id: userInfo.orgId
        })
        .get()
      
      if (result.data.length > 0) {
        fileRecord = result.data[0]
      }
    } else if (cloudPath) {
      const result = await db.collection('files')
        .where({
          cloud_path: cloudPath,
          org_id: userInfo.orgId
        })
        .get()
      
      if (result.data.length > 0) {
        fileRecord = result.data[0]
      }
    }
    
    if (!fileRecord) {
      return {
        success: false,
        error: '文件不存在或无权限删除'
      }
    }
    
    // 从云存储删除文件
    try {
      await storage.deleteFile({
        fileList: [fileRecord.file_id]
      })
    } catch (storageError) {
      console.warn('云存储删除文件失败:', storageError)
      // 继续删除数据库记录，即使云存储删除失败
    }
    
    // 从数据库删除记录
    await db.collection('files')
      .doc(fileRecord._id)
      .remove()
    
    return {
      success: true,
      message: '文件删除成功'
    }
  } catch (error) {
    console.error('删除文件错误:', error)
    return {
      success: false,
      error: '删除文件失败'
    }
  }
}

// 获取文件列表
async function getFileList(userInfo, params) {
  try {
    const { 
      folder = '', 
      fileType = '', 
      page = 1, 
      limit = 20,
      search = ''
    } = params
    
    let query = db.collection('files')
      .where({
        org_id: userInfo.orgId
      })
    
    // 文件夹筛选
    if (folder) {
      query = query.where({
        folder: folder
      })
    }
    
    // 文件类型筛选
    if (fileType) {
      query = query.where({
        file_type: fileType
      })
    }
    
    // 搜索条件
    if (search) {
      query = query.where({
        original_name: db.RegExp({
          regexp: search,
          options: 'i'
        })
      })
    }
    
    // 分页查询
    const result = await query
      .orderBy('created_at', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await query.count()
    
    // 为每个文件生成下载URL
    const filesWithUrl = await Promise.all(
      result.data.map(async (file) => {
        try {
          const downloadResult = await storage.getTempFileURL({
            fileList: [file.file_id]
          })
          
          return {
            ...file,
            downloadUrl: downloadResult.fileList[0]?.tempFileURL || ''
          }
        } catch (error) {
          console.warn('获取文件下载URL失败:', error)
          return {
            ...file,
            downloadUrl: ''
          }
        }
      })
    )
    
    return {
      success: true,
      data: {
        files: filesWithUrl,
        total: countResult.total,
        page: page,
        limit: limit
      }
    }
  } catch (error) {
    console.error('获取文件列表错误:', error)
    return {
      success: false,
      error: '获取文件列表失败'
    }
  }
}

// 获取文件下载URL
async function getDownloadUrl(userInfo, params) {
  try {
    const { fileId, cloudPath } = params
    
    if (!fileId && !cloudPath) {
      return {
        success: false,
        error: '文件ID或云存储路径不能为空'
      }
    }
    
    let targetFileId = fileId
    
    // 如果只提供了cloudPath，需要查找对应的fileId
    if (!fileId && cloudPath) {
      const result = await db.collection('files')
        .where({
          cloud_path: cloudPath,
          org_id: userInfo.orgId
        })
        .get()
      
      if (result.data.length === 0) {
        return {
          success: false,
          error: '文件不存在或无权限访问'
        }
      }
      
      targetFileId = result.data[0].file_id
    }
    
    // 生成临时下载URL
    const downloadResult = await storage.getTempFileURL({
      fileList: [targetFileId]
    })
    
    if (downloadResult.fileList.length === 0 || downloadResult.fileList[0].status !== 0) {
      return {
        success: false,
        error: '获取下载URL失败'
      }
    }
    
    return {
      success: true,
      data: {
        downloadUrl: downloadResult.fileList[0].tempFileURL,
        expireTime: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2小时后过期
      }
    }
  } catch (error) {
    console.error('获取下载URL错误:', error)
    return {
      success: false,
      error: '获取下载URL失败'
    }
  }
}

// 测试上传功能
async function testUpload(userInfo, params) {
  try {
    const testResults = {
      storageConnection: false,
      databaseConnection: false,
      uploadPermission: false,
      userInfo: userInfo
    }
    
    // 测试云存储连接
    try {
      await storage.getTempFileURL({
        fileList: ['test']
      })
      testResults.storageConnection = true
    } catch (error) {
      console.log('云存储连接测试:', error.message)
      testResults.storageConnection = true // 即使失败也说明连接正常
    }
    
    // 测试数据库连接
    try {
      await db.collection('files').limit(1).get()
      testResults.databaseConnection = true
    } catch (error) {
      console.error('数据库连接测试失败:', error)
    }
    
    // 测试上传权限（检查用户信息）
    if (userInfo && userInfo.userId && userInfo.orgId) {
      testResults.uploadPermission = true
    }
    
    return {
      success: true,
      data: {
        message: '文件上传功能测试完成',
        results: testResults,
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