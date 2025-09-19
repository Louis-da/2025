const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('API云函数被调用', event)
  console.log('event.action:', event.action)
  console.log('typeof event:', typeof event)
  console.log('Object.keys(event):', Object.keys(event))
  
  const { action } = event || {}
  
  try {
    switch (action) {
      case 'test':
      case undefined:
      case null:
        return {
          success: true,
          message: 'API云函数运行正常',
          timestamp: new Date().toISOString(),
          receivedEvent: event
        }
      
      case 'getFactories':
        const factories = await db.collection('factories').get()
        return {
          success: true,
          data: factories.data
        }
      
      case 'getProducts':
        const products = await db.collection('products').get()
        return {
          success: true,
          data: products.data
        }
      
      case 'getProcesses':
        const processes = await db.collection('processes').get()
        return {
          success: true,
          data: processes.data
        }
      
      case 'addFactory':
        const factoryResult = await db.collection('factories').add({
          data: event.factory
        })
        return {
          success: true,
          data: factoryResult
        }
      
      case 'updateFactory':
        const updateResult = await db.collection('factories').doc(event.factoryId).update({
          data: event.factory
        })
        return {
          success: true,
          data: updateResult
        }
      
      case 'updateFactoryStatus':
        const statusResult = await db.collection('factories').doc(event.factoryId).update({
          data: {
            status: event.status
          }
        })
        return {
          success: true,
          data: statusResult
        }
      
      case 'addSendOrder':
        const sendOrderResult = await db.collection('send_orders').add({
          data: event.order
        })
        return {
          success: true,
          data: sendOrderResult
        }
      
      case 'addReceiveOrder':
        const receiveOrderResult = await db.collection('receive_orders').add({
          data: event.order
        })
        return {
          success: true,
          data: receiveOrderResult
        }
      
      case 'getOrderDetail':
        const orderDetail = await db.collection('send_orders').doc(event.orderId).get()
        return {
          success: true,
          data: orderDetail.data
        }
      
      case 'getReceiveOrderDetail':
        const receiveOrderDetail = await db.collection('receive_orders').doc(event.orderId).get()
        return {
          success: true,
          data: receiveOrderDetail.data
        }
      
      case 'deleteOrder':
        const deleteResult = await db.collection('send_orders').doc(event.orderId).remove()
        return {
          success: true,
          data: deleteResult
        }
      
      case 'deleteReceiveOrder':
        const deleteReceiveResult = await db.collection('receive_orders').doc(event.orderId).remove()
        return {
          success: true,
          data: deleteReceiveResult
        }
      
      case 'cancelOrder':
        const cancelResult = await db.collection('send_orders').doc(event.orderId).update({
          data: {
            status: 'cancelled'
          }
        })
        return {
          success: true,
          data: cancelResult
        }
      
      case 'getFactoryAccounts':
        const accounts = await db.collection('factory_accounts').get()
        return {
          success: true,
          data: accounts.data
        }
      
      case 'login':
        try {
          const resp = await cloud.callFunction({
            name: 'login',
            data: {
              action: 'login',
              username: event.username,
              password: event.password,
              orgCode: event.orgCode
            }
          })
          return resp.result
        } catch (e) {
          console.error('调用login云函数失败:', e)
          return {
            success: false,
            message: e.message || '登录失败'
          }
        }
      
      default:
        return {
          success: false,
          message: `未知的操作类型: ${action}`
        }
    }
  } catch (error) {
    console.error('API云函数执行错误:', error)
    return {
      success: false,
      message: error.message || '服务器内部错误'
    }
  }
}