// 最简化的云函数测试
const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  try {
    console.log('收到请求:', JSON.stringify(event))
    
    if (event.action === 'login') {
      return {
        success: true,
        message: '简化版登录测试成功',
        data: {
          received: event
        }
      }
    }
    
    return {
      success: true,
      message: '云函数运行正常',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}