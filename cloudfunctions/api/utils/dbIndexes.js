// 数据库索引配置和查询优化工具
// 微信云开发数据库不支持手动创建索引，此文件主要用于查询优化建议

const cloud = require('wx-server-sdk')

/**
 * 索引配置定义
 * 虽然微信云开发不支持手动创建索引，但这些配置用于：
 * 1. 查询优化建议
 * 2. 数据库设计参考
 * 3. 性能分析指导
 */
const IndexConfigs = {
  // 用户表索引配置
  users: [
    {
      name: 'idx_users_org_username',
      keys: { org_id: 1, username: 1 },
      options: { unique: true },
      description: '组织内用户名唯一索引，用于登录查询'
    },
    {
      name: 'idx_users_org_status',
      keys: { org_id: 1, status: 1 },
      description: '按组织和状态查询用户'
    },
    {
      name: 'idx_users_role',
      keys: { role_id: 1, status: 1 },
      description: '按角色查询活跃用户'
    }
  ],

  // 组织表索引配置
  organizations: [
    {
      name: 'idx_organizations_code',
      keys: { code: 1 },
      options: { unique: true },
      description: '组织代码唯一索引'
    },
    {
      name: 'idx_organizations_status',
      keys: { status: 1, created_at: -1 },
      description: '按状态和创建时间查询组织'
    }
  ],

  // 产品表索引配置
  products: [
    {
      name: 'idx_products_org_status',
      keys: { org_id: 1, status: 1 },
      description: '按组织和状态查询产品'
    },
    {
      name: 'idx_products_name_org',
      keys: { name: 1, org_id: 1 },
      description: '按产品名称和组织查询'
    }
  ],

  // 订单表索引配置
  orders: [
    {
      name: 'idx_orders_org_status',
      keys: { org_id: 1, status: 1 },
      description: '按组织和状态查询订单'
    },
    {
      name: 'idx_orders_factory_status',
      keys: { factory_id: 1, status: 1 },
      description: '按工厂和状态查询订单'
    },
    {
      name: 'idx_orders_date_range',
      keys: { order_date: -1, org_id: 1 },
      description: '按订单日期和组织查询'
    }
  ],

  // 工厂表索引配置
  factories: [
    {
      name: 'idx_factories_org_status',
      keys: { org_id: 1, status: 1 },
      description: '按组织和状态查询工厂'
    }
  ],

  // 发货单表索引配置
  send_orders: [
    {
      name: 'idx_send_orders_org_date',
      keys: { org_id: 1, send_date: -1 },
      description: '按组织和发货日期查询'
    }
  ],

  // 收货单表索引配置
  receive_orders: [
    {
      name: 'idx_receive_orders_org_date',
      keys: { org_id: 1, receive_date: -1 },
      description: '按组织和收货日期查询'
    },
    {
      name: 'idx_receive_orders_status_date',
      keys: { status: 1, receive_date: -1 },
      description: '按状态和收货日期查询'
    }
  ],

  // 用户会话表索引配置
  user_sessions: [
    {
      name: 'idx_sessions_user_active',
      keys: { userId: 1, isActive: 1 },
      description: '按用户查询活跃会话'
    },
    {
      name: 'idx_sessions_token',
      keys: { accessToken: 1 },
      options: { unique: true },
      description: '访问令牌唯一索引'
    },
    {
      name: 'idx_sessions_refresh_token',
      keys: { refreshToken: 1 },
      options: { unique: true },
      description: '刷新令牌唯一索引'
    },
    {
      name: 'idx_sessions_expires',
      keys: { expiresAt: 1, isActive: 1 },
      description: '按过期时间清理会话'
    }
  ],

  // 损耗数据表索引配置
  loss_data: [
    {
      name: 'idx_loss_org_date',
      keys: { org_id: 1, date: -1 },
      description: '按组织和日期查询损耗数据'
    },
    {
      name: 'idx_loss_factory_date',
      keys: { factory_id: 1, date: -1 },
      description: '按工厂和日期查询损耗数据'
    },
    {
      name: 'idx_loss_product_date',
      keys: { product_id: 1, date: -1 },
      description: '按产品和日期查询损耗数据'
    }
  ],

  // 统计数据表索引配置
  statistics: [
    {
      name: 'idx_stats_org_type_date',
      keys: { org_id: 1, type: 1, date: -1 },
      description: '按组织、类型和日期查询统计数据'
    },
    {
      name: 'idx_stats_factory_type_date',
      keys: { factory_id: 1, type: 1, date: -1 },
      description: '按工厂、类型和日期查询统计数据'
    }
  ],

  // 日志表索引配置
  logs: [
    {
      name: 'idx_logs_level_time',
      keys: { level: 1, timestamp: -1 },
      description: '按日志级别和时间查询'
    },
    {
      name: 'idx_logs_user_time',
      keys: { userId: 1, timestamp: -1 },
      description: '按用户和时间查询操作日志'
    },
    {
      name: 'idx_logs_context_time',
      keys: { context: 1, timestamp: -1 },
      description: '按上下文和时间查询日志'
    }
  ]
}

/**
 * 查询优化管理器
 * 提供查询优化建议和性能分析
 */
class QueryOptimizer {
  constructor() {
    this.db = cloud.database()
  }

  /**
   * 分析查询并提供优化建议
   * @param {string} collectionName 集合名称
   * @param {Object} query 查询条件
   * @param {Object} options 分析选项
   * @returns {Object} 优化建议
   */
  analyzeQuery(collectionName, query, options = {}) {
    const suggestions = []
    const indexes = IndexConfigs[collectionName] || []
    const { includePerformanceMetrics = true, includeCacheAdvice = true } = options
    
    // 检查是否有匹配的索引配置
    const queryFields = Object.keys(query)
    const matchingIndexes = []
    
    for (const indexConfig of indexes) {
      const indexFields = Object.keys(indexConfig.keys)
      const matchedFields = queryFields.filter(field => indexFields.includes(field))
      
      if (matchedFields.length > 0) {
        const indexMatch = {
          indexName: indexConfig.name,
          description: indexConfig.description,
          matchedFields,
          indexFields,
          matchScore: matchedFields.length / indexFields.length,
          recommendation: `建议在查询中使用字段: ${indexFields.join(', ')}`
        }
        matchingIndexes.push(indexMatch)
        suggestions.push(indexMatch)
      }
    }
    
    // 检查范围查询优化
    const rangeFields = this.detectRangeQueries(query)
    if (rangeFields.length > 0) {
      suggestions.push({
        type: 'range_query',
        priority: 'medium',
        message: '检测到范围查询，确保范围字段在索引的最后位置',
        rangeFields: rangeFields,
        impact: 'query_selectivity'
      })
    }
    
    // 性能评估
    const performance = includePerformanceMetrics ? 
      this.estimatePerformance(query, matchingIndexes, collectionName) : null
    
    // 缓存建议
    const cacheAdvice = includeCacheAdvice ? 
      this.generateCacheAdvice(query, collectionName, performance) : null
    
    return {
      collection: collectionName,
      query,
      matchingIndexes,
      suggestions,
      performance,
      cacheAdvice,
      optimizationTips: this.getOptimizationTips(collectionName, query),
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 获取查询优化提示
   * @param {string} collectionName 集合名称
   * @param {Object} query 查询条件
   * @returns {Array} 优化提示
   */
  getOptimizationTips(collectionName, query) {
    const tips = []
    
    // 通用优化建议
    if (Object.keys(query).length > 3) {
      tips.push('查询条件过多，建议减少查询字段或使用复合索引')
    }
    
    // 特定集合的优化建议
    switch (collectionName) {
      case 'users':
        if (query.org_id && query.username) {
          tips.push('用户登录查询：建议同时使用org_id和username字段')
        }
        break
        
      case 'orders':
        if (query.org_id && !query.status) {
          tips.push('订单查询：建议添加status字段以提高查询效率')
        }
        if (query.order_date && typeof query.order_date === 'object') {
          tips.push('日期范围查询：建议使用日期字段作为主要排序条件')
        }
        break
        
      case 'products':
        if (query.org_id && !query.status) {
          tips.push('产品查询：建议添加status字段过滤无效产品')
        }
        break
    }
    
    return tips
  }

  /**
   * 检测范围查询字段
   * @param {Object} query 查询条件
   * @returns {Array} 范围查询字段列表
   */
  detectRangeQueries(query) {
    const rangeFields = []
    
    for (const [field, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null) {
        const operators = Object.keys(value)
        const rangeOperators = ['$gt', '$gte', '$lt', '$lte', '$in', '$nin']
        
        if (operators.some(op => rangeOperators.includes(op))) {
          rangeFields.push({
            field,
            operators,
            type: this.getRangeQueryType(operators)
          })
        }
      }
    }
    
    return rangeFields
  }

  /**
   * 获取范围查询类型
   * @param {Array} operators 操作符列表
   * @returns {string} 查询类型
   */
  getRangeQueryType(operators) {
    if (operators.includes('$in') || operators.includes('$nin')) {
      return 'list_match'
    }
    if (operators.some(op => ['$gt', '$gte', '$lt', '$lte'].includes(op))) {
      return 'range'
    }
    return 'comparison'
  }

  /**
   * 估算查询性能
   * @param {Object} query 查询条件
   * @param {Array} matchingIndexes 匹配的索引
   * @param {string} collectionName 集合名称
   * @returns {Object} 性能评估
   */
  estimatePerformance(query, matchingIndexes, collectionName) {
    const queryComplexity = Object.keys(query).length
    const hasRangeQuery = this.detectRangeQueries(query).length > 0
    const bestIndexMatch = matchingIndexes.reduce((best, current) => 
      current.matchScore > (best?.matchScore || 0) ? current : best, null)
    
    let performanceScore = 100
    let performanceLevel = 'excellent'
    const issues = []
    
    // 基于索引匹配度评分
    if (!bestIndexMatch) {
      performanceScore -= 40
      issues.push('没有匹配的索引，可能导致全表扫描')
    } else if (bestIndexMatch.matchScore < 0.5) {
      performanceScore -= 20
      issues.push('索引匹配度较低，建议优化查询条件')
    }
    
    // 基于查询复杂度评分
    if (queryComplexity > 5) {
      performanceScore -= 15
      issues.push('查询条件过多，建议简化查询')
    }
    
    // 基于范围查询评分
    if (hasRangeQuery) {
      performanceScore -= 10
      issues.push('包含范围查询，注意索引字段顺序')
    }
    
    // 确定性能等级
    if (performanceScore >= 90) performanceLevel = 'excellent'
    else if (performanceScore >= 70) performanceLevel = 'good'
    else if (performanceScore >= 50) performanceLevel = 'fair'
    else performanceLevel = 'poor'
    
    return {
      score: Math.max(0, performanceScore),
      level: performanceLevel,
      queryComplexity,
      hasRangeQuery,
      bestIndexMatch,
      issues,
      estimatedExecutionTime: this.estimateExecutionTime(performanceScore, collectionName)
    }
  }

  /**
   * 估算执行时间
   * @param {number} performanceScore 性能评分
   * @param {string} collectionName 集合名称
   * @returns {string} 估算执行时间
   */
  estimateExecutionTime(performanceScore, collectionName) {
    const baseTime = this.getCollectionBaseTime(collectionName)
    const multiplier = (100 - performanceScore) / 100 + 1
    const estimatedMs = baseTime * multiplier
    
    if (estimatedMs < 10) return '<10ms'
    if (estimatedMs < 50) return '<50ms'
    if (estimatedMs < 100) return '<100ms'
    if (estimatedMs < 500) return '<500ms'
    return '>500ms'
  }

  /**
   * 获取集合基准时间
   * @param {string} collectionName 集合名称
   * @returns {number} 基准时间（毫秒）
   */
  getCollectionBaseTime(collectionName) {
    const baseTimes = {
      users: 5,
      organizations: 3,
      products: 8,
      orders: 15,
      factories: 5,
      send_orders: 12,
      receive_orders: 12,
      user_sessions: 3,
      loss_data: 20,
      statistics: 25,
      logs: 30
    }
    
    return baseTimes[collectionName] || 10
  }

  /**
   * 生成缓存建议
   * @param {Object} query 查询条件
   * @param {string} collectionName 集合名称
   * @param {Object} performance 性能评估
   * @returns {Object} 缓存建议
   */
  generateCacheAdvice(query, collectionName, performance) {
    const advice = {
      shouldCache: false,
      cacheStrategy: null,
      cacheTTL: null,
      cacheKey: null,
      reasons: []
    }
    
    // 基于性能评估决定是否缓存
    if (performance && performance.score < 70) {
      advice.shouldCache = true
      advice.reasons.push('查询性能较低，建议使用缓存')
    }
    
    // 基于查询类型决定缓存策略
    const hasRangeQuery = this.detectRangeQueries(query).length > 0
    const queryFields = Object.keys(query)
    
    if (queryFields.includes('org_id') && !hasRangeQuery) {
      advice.shouldCache = true
      advice.cacheStrategy = 'org_based'
      advice.cacheTTL = 300 // 5分钟
      advice.reasons.push('按组织查询，适合组织级缓存')
    }
    
    if (collectionName === 'user_sessions' && queryFields.includes('userId')) {
      advice.shouldCache = true
      advice.cacheStrategy = 'user_session'
      advice.cacheTTL = 60 // 1分钟
      advice.reasons.push('用户会话查询，适合短期缓存')
    }
    
    if (collectionName === 'statistics' || collectionName === 'loss_data') {
      advice.shouldCache = true
      advice.cacheStrategy = 'time_based'
      advice.cacheTTL = 1800 // 30分钟
      advice.reasons.push('统计数据查询，适合时间窗口缓存')
    }
    
    // 生成缓存键
    if (advice.shouldCache) {
      advice.cacheKey = this.generateCacheKey(collectionName, query)
    }
    
    return advice
  }

  /**
   * 生成缓存键
   * @param {string} collectionName 集合名称
   * @param {Object} query 查询条件
   * @returns {string} 缓存键
   */
  generateCacheKey(collectionName, query) {
    const sortedQuery = Object.keys(query)
      .sort()
      .reduce((result, key) => {
        result[key] = query[key]
        return result
      }, {})
    
    const queryHash = Buffer.from(JSON.stringify(sortedQuery)).toString('base64')
    return `query:${collectionName}:${queryHash}`
  }

  /**
   * 生成查询性能报告
   * @param {string} collectionName 集合名称
   * @param {Object} query 查询条件
   * @param {Object} options 报告选项
   * @returns {Object} 性能报告
   */
  generatePerformanceReport(collectionName, query, options = {}) {
    const analysis = this.analyzeQuery(collectionName, query, options)
    
    return {
      collection: collectionName,
      query,
      timestamp: new Date().toISOString(),
      analysis,
      recommendations: [
        '使用精确匹配而非模糊查询',
        '限制返回字段数量',
        '合理使用分页',
        '避免深度嵌套查询',
        '考虑使用缓存优化高频查询',
        '定期分析查询性能并优化索引'
      ],
      queryPlan: this.generateQueryPlan(query, analysis.matchingIndexes),
      optimizationSuggestions: this.generateOptimizationSuggestions(analysis)
    }
  }

  /**
   * 生成查询计划
   * @param {Object} query 查询条件
   * @param {Array} matchingIndexes 匹配的索引
   * @returns {Object} 查询计划
   */
  generateQueryPlan(query, matchingIndexes) {
    const bestIndex = matchingIndexes.reduce((best, current) => 
      current.matchScore > (best?.matchScore || 0) ? current : best, null)
    
    return {
      selectedIndex: bestIndex?.indexName || 'collection_scan',
      scanType: bestIndex ? 'index_scan' : 'collection_scan',
      estimatedDocsExamined: bestIndex ? 'low' : 'high',
      filterStages: Object.keys(query).map(field => ({
        field,
        operator: typeof query[field] === 'object' ? Object.keys(query[field])[0] : '$eq',
        indexed: bestIndex?.indexFields.includes(field) || false
      }))
    }
  }

  /**
   * 生成优化建议
   * @param {Object} analysis 查询分析结果
   * @returns {Array} 优化建议列表
   */
  generateOptimizationSuggestions(analysis) {
    const suggestions = []
    
    if (analysis.performance && analysis.performance.score < 50) {
      suggestions.push({
        priority: 'high',
        category: 'performance',
        suggestion: '查询性能较差，建议重新设计查询条件或添加合适的索引',
        impact: 'high'
      })
    }
    
    if (analysis.cacheAdvice && analysis.cacheAdvice.shouldCache) {
      suggestions.push({
        priority: 'medium',
        category: 'caching',
        suggestion: `建议使用${analysis.cacheAdvice.cacheStrategy}缓存策略，TTL设置为${analysis.cacheAdvice.cacheTTL}秒`,
        impact: 'medium'
      })
    }
    
    if (analysis.matchingIndexes.length === 0) {
      suggestions.push({
        priority: 'high',
        category: 'indexing',
        suggestion: '没有找到匹配的索引，建议为常用查询字段创建复合索引',
        impact: 'high'
      })
    }
    
    return suggestions
  }
}

/**
 * 查询优化建议配置
 */
const QueryOptimizationTips = {
  // 用户登录查询优化
  userLogin: {
    query: { org_id: 1, username: 1 },
    index: 'idx_users_org_username',
    tip: '登录查询应使用组织ID和用户名的复合条件',
    performance: 'high',
    frequency: 'very_high'
  },
  
  // 按组织查询用户
  usersByOrg: {
    query: { org_id: 1, status: 1 },
    index: 'idx_users_org_status',
    tip: '按组织查询用户时应包含状态条件以提高效率',
    performance: 'high',
    frequency: 'high'
  },
  
  // 订单日期范围查询
  ordersByDateRange: {
    query: { org_id: 1, order_date: { $gte: 'date1', $lte: 'date2' } },
    index: 'idx_orders_date_range',
    tip: '日期范围查询应使用日期字段作为索引前缀',
    performance: 'medium',
    frequency: 'high'
  },
  
  // 工厂订单查询
  factoryOrders: {
    query: { factory_id: 1, status: 1 },
    index: 'idx_orders_factory_status',
    tip: '按工厂查询订单时应包含状态筛选',
    performance: 'high',
    frequency: 'high'
  },
  
  // 用户会话查询
  activeUserSessions: {
    query: { userId: 1, isActive: true },
    index: 'idx_sessions_user_active',
    tip: '查询用户活跃会话时应同时使用用户ID和活跃状态',
    performance: 'high',
    frequency: 'very_high'
  },
  
  // 令牌验证查询
  tokenValidation: {
    query: { accessToken: 1 },
    index: 'idx_sessions_token',
    tip: '令牌验证查询应使用访问令牌的唯一索引',
    performance: 'very_high',
    frequency: 'very_high'
  },
  
  // 损耗数据查询
  lossDataByFactory: {
    query: { factory_id: 1, date: { $gte: 'date1', $lte: 'date2' } },
    index: 'idx_loss_factory_date',
    tip: '按工厂查询损耗数据时应使用工厂ID和日期范围',
    performance: 'medium',
    frequency: 'high'
  },
  
  // 统计数据查询
  statisticsByType: {
    query: { org_id: 1, type: 1, date: { $gte: 'date1', $lte: 'date2' } },
    index: 'idx_stats_org_type_date',
    tip: '统计数据查询应按组织、类型和日期进行复合索引',
    performance: 'medium',
    frequency: 'medium'
  },
  
  // 日志查询优化
  errorLogs: {
    query: { level: 'error', timestamp: { $gte: 'date1' } },
    index: 'idx_logs_level_time',
    tip: '错误日志查询应使用日志级别和时间戳索引',
    performance: 'medium',
    frequency: 'low'
  },
  
  // 用户操作日志
  userActivityLogs: {
    query: { userId: 1, timestamp: { $gte: 'date1', $lte: 'date2' } },
    index: 'idx_logs_user_time',
    tip: '用户活动日志查询应使用用户ID和时间范围',
    performance: 'medium',
    frequency: 'medium'
  },
  
  // 会话清理查询
  expiredSessions: {
    query: { expiresAt: { $lt: new Date() }, isActive: true },
    index: 'idx_sessions_expires',
    tip: '清理过期会话时应使用过期时间和活跃状态索引',
    performance: 'high',
    frequency: 'low'
  }
}

// 创建查询优化器实例
const queryOptimizer = new QueryOptimizer()

module.exports = {
  IndexConfigs,
  QueryOptimizer,
  queryOptimizer,
  QueryOptimizationTips
}