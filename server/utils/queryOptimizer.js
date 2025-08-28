/**
 * 查询性能优化工具
 * 提供查询缓存、性能监控和优化建议
 */

const NodeCache = require('node-cache');

// 创建缓存实例，TTL为5分钟
const queryCache = new NodeCache({ 
  stdTTL: 300, // 5分钟
  checkperiod: 60, // 每60秒检查过期缓存
  useClones: false 
});

// 性能监控数据
const performanceStats = {
  slowQueries: [],
  queryCounts: {},
  cacheHits: 0,
  cacheMisses: 0
};

/**
 * 生成缓存键
 * @param {string} sql - SQL查询语句
 * @param {Array} params - 查询参数
 * @param {string} orgId - 组织ID
 * @returns {string} 缓存键
 */
function generateCacheKey(sql, params, orgId) {
  const normalizedSql = sql.replace(/\s+/g, ' ').trim();
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${orgId}:${Buffer.from(normalizedSql + paramsStr).toString('base64')}`;
}

/**
 * 检查查询是否可以缓存
 * @param {string} sql - SQL查询语句
 * @returns {boolean} 是否可以缓存
 */
function isCacheable(sql) {
  const normalizedSql = sql.toLowerCase().trim();
  
  // 只缓存SELECT查询
  if (!normalizedSql.startsWith('select')) {
    return false;
  }
  
  // 不缓存包含当前时间函数的查询
  const timeFunctions = ['now()', 'curdate()', 'curtime()', 'current_timestamp'];
  if (timeFunctions.some(fn => normalizedSql.includes(fn))) {
    return false;
  }
  
  // 不缓存包含随机函数的查询
  if (normalizedSql.includes('rand()')) {
    return false;
  }
  
  return true;
}

/**
 * 记录慢查询
 * @param {string} sql - SQL查询语句
 * @param {Array} params - 查询参数
 * @param {number} duration - 执行时间（毫秒）
 * @param {string} orgId - 组织ID
 */
function recordSlowQuery(sql, params, duration, orgId) {
  if (duration > 1000) { // 超过1秒的查询被认为是慢查询
    const slowQuery = {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      params: params ? JSON.stringify(params).substring(0, 100) : '',
      duration,
      orgId,
      timestamp: new Date().toISOString()
    };
    
    performanceStats.slowQueries.push(slowQuery);
    
    // 只保留最近50条慢查询记录
    if (performanceStats.slowQueries.length > 50) {
      performanceStats.slowQueries = performanceStats.slowQueries.slice(-50);
    }
    
    console.warn('[SLOW_QUERY]', slowQuery);
  }
}

/**
 * 记录查询统计
 * @param {string} sql - SQL查询语句
 */
function recordQueryStats(sql) {
  const queryType = sql.trim().split(' ')[0].toUpperCase();
  performanceStats.queryCounts[queryType] = (performanceStats.queryCounts[queryType] || 0) + 1;
}

/**
 * 缓存查询结果
 * @param {string} cacheKey - 缓存键
 * @param {any} result - 查询结果
 * @param {number} ttl - 缓存时间（秒）
 */
function cacheResult(cacheKey, result, ttl = 300) {
  try {
    queryCache.set(cacheKey, result, ttl);
  } catch (error) {
    console.warn('[CACHE_SET_ERROR]', error.message);
  }
}

/**
 * 获取缓存结果
 * @param {string} cacheKey - 缓存键
 * @returns {any} 缓存的结果或null
 */
function getCachedResult(cacheKey) {
  try {
    const result = queryCache.get(cacheKey);
    if (result !== undefined) {
      performanceStats.cacheHits++;
      return result;
    } else {
      performanceStats.cacheMisses++;
      return null;
    }
  } catch (error) {
    console.warn('[CACHE_GET_ERROR]', error.message);
    performanceStats.cacheMisses++;
    return null;
  }
}

/**
 * 优化的查询执行器
 * @param {Function} executeQuery - 原始查询执行函数
 * @param {string} sql - SQL查询语句
 * @param {Array} params - 查询参数
 * @param {string} orgId - 组织ID
 * @returns {Promise<any>} 查询结果
 */
async function optimizedQuery(executeQuery, sql, params = [], orgId) {
  const startTime = Date.now();
  
  try {
    // 记录查询统计
    recordQueryStats(sql);
    
    // 检查是否可以使用缓存
    if (isCacheable(sql) && orgId) {
      const cacheKey = generateCacheKey(sql, params, orgId);
      const cachedResult = getCachedResult(cacheKey);
      
      if (cachedResult !== null) {
        console.log('[CACHE_HIT]', { orgId, sql: sql.substring(0, 50) + '...' });
        return cachedResult;
      }
    }
    
    // 执行查询
    const result = await executeQuery(sql, params);
    const duration = Date.now() - startTime;
    
    // 记录慢查询
    if (orgId) {
      recordSlowQuery(sql, params, duration, orgId);
    }
    
    // 缓存查询结果
    if (isCacheable(sql) && orgId && result) {
      const cacheKey = generateCacheKey(sql, params, orgId);
      cacheResult(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[QUERY_ERROR]', {
      sql: sql.substring(0, 100) + '...',
      params: params ? JSON.stringify(params).substring(0, 50) : '',
      duration,
      error: error.message,
      orgId
    });
    throw error;
  }
}

/**
 * 清除组织的所有缓存
 * @param {string} orgId - 组织ID
 */
function clearOrgCache(orgId) {
  const keys = queryCache.keys();
  const orgKeys = keys.filter(key => key.startsWith(`${orgId}:`));
  
  orgKeys.forEach(key => {
    queryCache.del(key);
  });
  
  console.log('[CACHE_CLEAR]', { orgId, clearedKeys: orgKeys.length });
}

/**
 * 获取性能统计
 * @returns {Object} 性能统计信息
 */
function getPerformanceStats() {
  const cacheStats = queryCache.getStats();
  
  return {
    ...performanceStats,
    cache: {
      keys: cacheStats.keys,
      hits: performanceStats.cacheHits,
      misses: performanceStats.cacheMisses,
      hitRate: performanceStats.cacheHits + performanceStats.cacheMisses > 0 
        ? (performanceStats.cacheHits / (performanceStats.cacheHits + performanceStats.cacheMisses) * 100).toFixed(2) + '%'
        : '0%'
    }
  };
}

/**
 * 重置性能统计
 */
function resetStats() {
  performanceStats.slowQueries = [];
  performanceStats.queryCounts = {};
  performanceStats.cacheHits = 0;
  performanceStats.cacheMisses = 0;
  queryCache.flushAll();
}

module.exports = {
  optimizedQuery,
  clearOrgCache,
  getPerformanceStats,
  resetStats,
  isCacheable,
  generateCacheKey
}; 