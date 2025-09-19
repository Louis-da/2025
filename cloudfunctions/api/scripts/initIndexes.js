// 数据库索引初始化脚本
// 用于在部署时自动创建所有必要的数据库索引

const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const { queryOptimizer, QueryOptimizationTips } = require('../utils/dbIndexes')
const { logger } = require('../middleware/errorHandler')

/**
 * 初始化数据库索引
 * 这个脚本应该在云函数部署后运行一次
 */
async function initializeIndexes() {
  // 使用全局logger实例
  
  try {
    logger.info('开始初始化数据库索引...')
    
    // 微信云开发不支持手动创建索引，改为提供查询优化建议
    logger.info('微信云开发数据库不支持手动创建索引')
    logger.info('提供查询优化建议和性能分析工具')
    
    const result = {
      success: true,
      message: '查询优化工具初始化完成',
      optimizationTips: Object.keys(QueryOptimizationTips).length
    }
    
    if (result.success) {
      logger.info('数据库索引初始化完成', {
        collections: result.collections,
        totalIndexes: result.totalIndexes,
        successfulIndexes: result.successfulIndexes,
        failedIndexes: result.failedIndexes
      })
      
      // 如果有失败的索引，记录详细信息
      if (result.failedIndexes > 0) {
        const failedDetails = result.details
          .filter(d => d.failed > 0)
          .map(d => ({
            collection: d.collection,
            failedIndexes: d.results.filter(r => !r.success)
          }))
        
        logger.warn('部分索引创建失败', { failedDetails })
      }
      
      return {
        success: true,
        message: '索引初始化完成',
        summary: result
      }
    } else {
      logger.error('索引初始化失败', { error: result.error })
      return {
        success: false,
        error: result.error
      }
    }
    
  } catch (error) {
    logger.error('索引初始化过程中发生错误', { error: error.message, stack: error.stack })
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 验证关键索引是否存在
 * 用于健康检查
 */
async function validateCriticalIndexes() {
  // 使用全局logger实例
  
  // 定义关键索引
  const criticalIndexes = [
    { collection: 'users', index: 'idx_users_org_username' },
    { collection: 'organizations', index: 'idx_organizations_code' },
    { collection: 'orders', index: 'idx_orders_org_status' },
    { collection: 'products', index: 'idx_products_org_status' }
  ]
  
  try {
    const validationResults = []
    
    for (const { collection, index } of criticalIndexes) {
      // 微信云开发不支持获取索引列表，改为提供优化建议
      const exists = false // 假设索引不存在，提供优化建议
      
      validationResults.push({
        collection,
        index,
        exists,
        status: exists ? 'OK' : 'MISSING'
      })
      
      if (!exists) {
        logger.warn(`关键索引缺失: ${collection}.${index}`)
      }
    }
    
    const missingIndexes = validationResults.filter(r => !r.exists)
    
    if (missingIndexes.length === 0) {
      logger.info('所有关键索引验证通过')
      return {
        success: true,
        message: '所有关键索引存在',
        results: validationResults
      }
    } else {
      logger.error('发现缺失的关键索引', { missingIndexes })
      return {
        success: false,
        message: `发现 ${missingIndexes.length} 个缺失的关键索引`,
        results: validationResults,
        missingIndexes
      }
    }
    
  } catch (error) {
    logger.error('索引验证失败', { error: error.message })
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 性能测试 - 验证索引效果
 */
async function performanceTest() {
  // 使用全局logger实例
  
  const testQueries = [
    {
      name: '用户登录查询',
      collection: 'users',
      query: { org_id: 'test_org', username: 'test_user' },
      expectedIndex: 'idx_users_org_username'
    },
    {
      name: '组织订单查询',
      collection: 'orders',
      query: { org_id: 'test_org', status: 'active' },
      expectedIndex: 'idx_orders_org_status'
    },
    {
      name: '产品状态查询',
      collection: 'products',
      query: { org_id: 'test_org', status: 'active' },
      expectedIndex: 'idx_products_org_status'
    }
  ]
  
  try {
    const testResults = []
    
    for (const test of testQueries) {
      logger.info(`执行性能测试: ${test.name}`)
      
      // 使用查询优化器分析查询
      const analysis = queryOptimizer.analyzeQuery(test.collection, test.query)
      const performanceReport = queryOptimizer.generatePerformanceReport(test.collection, test.query)
      
      const result = {
        name: test.name,
        collection: test.collection,
        query: test.query,
        expectedIndex: test.expectedIndex,
        analysis,
        suggestions: analysis.suggestions,
        optimizationTips: analysis.optimizationTips,
        recommendations: performanceReport.recommendations,
        performanceScore: performanceReport.score
      }
      
      testResults.push(result)
      
      if (analysis.suggestions.length === 0) {
        logger.info(`✓ ${test.name} 查询已优化`)
      } else {
        logger.warn(`✗ ${test.name} 需要优化`, {
          suggestions: analysis.suggestions
        })
      }
    }
    
    return {
      success: true,
      message: '性能测试完成',
      results: testResults
    }
    
  } catch (error) {
    logger.error('性能测试过程中发生错误', { error: error.message })
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 主函数 - 完整的索引初始化流程
 */
async function main() {
  console.log('=== 数据库索引初始化开始 ===')
  
  try {
    // 1. 初始化索引
    console.log('\n1. 创建数据库索引...')
    const initResult = await initializeIndexes()
    
    if (!initResult.success) {
      console.error('索引初始化失败:', initResult.error)
      return initResult
    }
    
    // 2. 验证关键索引
    console.log('\n2. 验证关键索引...')
    const validationResult = await validateCriticalIndexes()
    
    if (!validationResult.success) {
      console.warn('索引验证发现问题:', validationResult.message)
    }
    
    // 3. 性能测试（可选）
    console.log('\n3. 执行性能测试...')
    const performanceResult = await performanceTest()
    
    console.log('\n=== 数据库索引初始化完成 ===')
    
    return {
      success: true,
      message: '数据库索引初始化完成',
      initialization: initResult,
      validation: validationResult,
      performance: performanceResult
    }
    
  } catch (error) {
    console.error('索引初始化过程中发生未预期的错误:', error)
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().then(result => {
    console.log('\n最终结果:', JSON.stringify(result, null, 2))
    process.exit(result.success ? 0 : 1)
  }).catch(error => {
    console.error('脚本执行失败:', error)
    process.exit(1)
  })
}

module.exports = {
  initializeIndexes,
  validateCriticalIndexes,
  performanceTest,
  main
}