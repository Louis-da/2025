const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  console.log('API云函数被调用', JSON.stringify(event))
  
  try {
    const action = event && event.action ? event.action : 'test'
    
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
        try {
          const factories = await db.collection('factories').where({
            org_id: event.orgId
          }).get()
          return {
            success: true,
            data: factories.data
          }
        } catch (error) {
          console.error('getFactories error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getProcesses':
        try {
          const processes = await db.collection('processes').where({
            org_id: event.orgId
          }).get()
          return {
            success: true,
            data: processes.data
          }
        } catch (error) {
          console.error('getProcesses error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getFactoryStats':
        try {
          // 简化的统计逻辑
          return {
            success: true,
            data: {
              totalFactories: 0,
              activeFactories: 0,
              totalOrders: 0,
              completedOrders: 0
            }
          }
        } catch (error) {
          console.error('getFactoryStats error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getColors':
        try {
          const colors = await db.collection('colors').where({
            org_id: event.orgId
          }).get()
          return {
            success: true,
            data: colors.data
          }
        } catch (error) {
          console.error('getColors error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'addColor':
        try {
          const colorData = {
            name: event.name,
            orderNum: event.orderNum || 1,
            status: event.status || 1,
            org_id: event.orgId,
            createTime: new Date(),
            updateTime: new Date()
          }
          const colorResult = await db.collection('colors').add({
            data: colorData
          })
          return {
            success: true,
            data: colorResult
          }
        } catch (error) {
          console.error('addColor error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'updateColor':
        try {
          const updateColorResult = await db.collection('colors').doc(event.colorId).update({
            data: {
              name: event.name,
              orderNum: event.orderNum,
              status: event.status,
              updateTime: new Date()
            }
          })
          return {
            success: true,
            data: updateColorResult
          }
        } catch (error) {
          console.error('updateColor error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'deleteColor':
        try {
          const deleteColorResult = await db.collection('colors').doc(event.colorId).remove()
          return {
            success: true,
            data: deleteColorResult
          }
        } catch (error) {
          console.error('deleteColor error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getSizes':
        try {
          const sizes = await db.collection('sizes').where({
            orgId: event.orgId
          }).get()
          return {
            success: true,
            data: sizes.data
          }
        } catch (error) {
          console.error('getSizes error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'addSize':
        try {
          const sizeData = {
            name: event.name,
            orderNum: event.orderNum || 1,
            status: event.status || 1,
            orgId: event.orgId,
            createTime: new Date(),
            updateTime: new Date()
          }
          const sizeResult = await db.collection('sizes').add({
            data: sizeData
          })
          return {
            success: true,
            data: sizeResult
          }
        } catch (error) {
          console.error('addSize error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'updateSize':
        try {
          const updateSizeResult = await db.collection('sizes').doc(event.sizeId).update({
            data: {
              name: event.name,
              orderNum: event.orderNum,
              status: event.status,
              updateTime: new Date()
            }
          })
          return {
            success: true,
            data: updateSizeResult
          }
        } catch (error) {
          console.error('updateSize error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'deleteSize':
        try {
          const deleteSizeResult = await db.collection('sizes').doc(event.sizeId).remove()
          return {
            success: true,
            data: deleteSizeResult
          }
        } catch (error) {
          console.error('deleteSize error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'addFactory':
        try {
          const factoryData = {
            name: event.name,
            phone: event.phone || '',
            address: event.address || '',
            processes: event.processes || [],
            remark: event.remark || '',
            status: event.status || 'active',
            code: event.code || 'FC' + Date.now().toString().slice(-6),
            orgId: event.orgId,
            createTime: new Date(),
            updateTime: new Date()
          }
          const factoryResult = await db.collection('factories').add({
            data: factoryData
          })
          return {
            success: true,
            data: { id: factoryResult._id, createTime: factoryData.createTime }
          }
        } catch (error) {
          console.error('addFactory error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'updateFactory':
        try {
          const updateFactoryResult = await db.collection('factories').doc(event.factoryId).update({
            data: {
              name: event.name,
              phone: event.phone,
              address: event.address,
              processes: event.processes,
              remark: event.remark,
              status: event.status,
              updateTime: new Date()
            }
          })
          return {
            success: true,
            data: updateFactoryResult
          }
        } catch (error) {
          console.error('updateFactory error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'deleteFactory':
        try {
          const deleteFactoryResult = await db.collection('factories').doc(event.factoryId).remove()
          return {
            success: true,
            data: deleteFactoryResult
          }
        } catch (error) {
          console.error('deleteFactory error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'addProcess':
        try {
          const processData = {
            name: event.processName || event.name,
            order: event.order || 1,
            status: event.status || 1,
            orgId: event.orgId,
            createTime: new Date(),
            updateTime: new Date()
          }
          const processResult = await db.collection('processes').add({
            data: processData
          })
          return {
            success: true,
            data: processResult
          }
        } catch (error) {
          console.error('addProcess error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'updateProcess':
        try {
          const updateProcessResult = await db.collection('processes').doc(event.processId).update({
            data: {
              name: event.processName || event.name,
              order: event.order,
              status: event.status,
              updateTime: new Date()
            }
          })
          return {
            success: true,
            data: updateProcessResult
          }
        } catch (error) {
          console.error('updateProcess error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'deleteProcess':
        try {
          const deleteProcessResult = await db.collection('processes').doc(event.processId).remove()
          return {
            success: true,
            data: deleteProcessResult
          }
        } catch (error) {
          console.error('deleteProcess error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getProducts':
        try {
          const products = await db.collection('products').where({
            orgId: event.orgId
          }).get()
          
          // 将_id映射为id字段，确保前端能正确识别
          const productsWithId = products.data.map(product => ({
            ...product,
            id: product._id
          }))
          
          return {
            success: true,
            data: productsWithId
          }
        } catch (error) {
          console.error('getProducts error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'addProduct':
        try {
          const productData = {
            code: event.code || event.productNo,
            productNo: event.productNo || event.code,
            name: event.name,
            colors: event.colors || '',
            sizes: event.sizes || '',
            processes: event.processes || '',
            image: event.image || '',
            description: event.description || '',
            status: event.status !== undefined ? event.status : 1,
            orgId: event.orgId,
            createTime: new Date(),
            updateTime: new Date()
          }
          const productResult = await db.collection('products').add({
            data: productData
          })
          return {
            success: true,
            data: { 
              id: productResult._id, 
              _id: productResult._id,
              createTime: productData.createTime 
            }
          }
        } catch (error) {
          console.error('addProduct error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getProduct':
        try {
          const product = await db.collection('products').doc(event.productId).get()
          if (!product.data) {
            return {
              success: false,
              error: '产品不存在'
            }
          }
          
          // 将_id映射为id字段
          const productWithId = {
            ...product.data,
            id: product.data._id
          }
          
          return {
            success: true,
            data: productWithId
          }
        } catch (error) {
          console.error('getProduct error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'updateProduct':
        try {
          const updateProductResult = await db.collection('products').doc(event.productId).update({
            data: {
              code: event.code || event.productNo,
              productNo: event.productNo || event.code,
              name: event.name,
              colors: event.colors,
              sizes: event.sizes,
              processes: event.processes,
              image: event.image,
              description: event.description,
              status: event.status,
              updateTime: new Date()
            }
          })
          return {
            success: true,
            data: updateProductResult
          }
        } catch (error) {
          console.error('updateProduct error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'deleteProduct':
        try {
          const deleteProductResult = await db.collection('products').doc(event.productId).remove()
          return {
            success: true,
            data: deleteProductResult
          }
        } catch (error) {
          console.error('deleteProduct error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      case 'getProductStats':
        try {
          const products = await db.collection('products').where({
            orgId: event.orgId
          }).get()
          
          const totalCount = products.data.length
          const activeCount = products.data.filter(p => p.status === 1).length
          const inactiveCount = totalCount - activeCount
          
          return {
            success: true,
            data: {
              totalCount,
              activeCount,
              inactiveCount
            }
          }
        } catch (error) {
          console.error('getProductStats error:', error)
          return {
            success: false,
            error: error.message
          }
        }
      
      default:
        return {
          success: false,
          error: `未知的操作: ${action}`
        }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      error: error.message
    }
  }
}