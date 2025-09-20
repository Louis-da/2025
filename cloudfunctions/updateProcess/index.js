const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const { processId, processName, name, order, status, orgId } = event
    
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
    
    // 构建更新数据，兼容 processName 和 name 字段
    const updateData = {
      name: processName || name,
      updateTime: new Date()
    }
    
    // 只有提供了有效值才更新对应字段
    if (order !== undefined && order !== null) {
      updateData.order = Number(order)
    }
    
    if (status !== undefined && status !== null) {
      updateData.status = Number(status)
    }
    
    // 更新工序
    const result = await db.collection('processes')
      .doc(processId)
      .update({
        data: updateData
      })
    
    return {
      success: true,
      data: result,
      message: '更新成功'
    }
    
  } catch (error) {
    console.error('更新工序失败:', error)
    return {
      success: false,
      message: error.message || '更新失败'
    }
  }
}