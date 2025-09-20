const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { processId, status, orgId } = event
    
    // 验证必要参数
    if (!processId) {
      return {
        success: false,
        message: '工序ID不能为空'
      }
    }
    
    if (!orgId) {
      return {
        success: false,
        message: '组织ID不能为空'
      }
    }
    
    if (status === undefined || status === null) {
      return {
        success: false,
        message: '状态值不能为空'
      }
    }
    
    // 更新工序状态
    const result = await db.collection('processes')
      .doc(processId)
      .update({
        data: {
          status: Number(status),
          updateTime: new Date()
        }
      })
    
    return {
      success: true,
      data: result,
      message: '状态更新成功'
    }
    
  } catch (error) {
    console.error('更新工序状态失败:', error)
    return {
      success: false,
      message: error.message || '状态更新失败'
    }
  }
}