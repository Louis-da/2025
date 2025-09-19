// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const JWT_SECRET = process.env.JWT_SECRET || 'yunsf-jwt-secret-2024'

// 内存缓存
const memoryCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5分钟
const MAX_CACHE_SIZE = 1000 // 最大缓存条目数

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, token, ...params } = event
  
  try {
    // 验证token（除了公开接口）
    const publicActions = ['get', 'warmup']
    let userInfo = null
    
    if (!publicActions.includes(action)) {
      const authResult = await verifyToken(token)
      if (!authResult.success) {
        return authResult
      }
      userInfo = authResult.data
    }
    
    // 路由到具体的处理函数
    switch (action) {
      case 'get':
        return await getCache(params)
      case 'set':
        return await setCache(userInfo, params)
      case 'delete':
        return await deleteCache(userInfo, params)
      case 'clear':
        return await clearCache(userInfo, params)
      case 'getStats':
        return await getCacheStats(userInfo, params)
      case 'warmup':
        return await warmupCache(params)
      case 'preload':
        return await preloadCache(userInfo, params)
      case 'invalidate':
        return await invalidateCache(userInfo, params)
      case 'getCacheConfig':
        return await getCacheConfig(userInfo, params)
      case 'updateCacheConfig':
        return await updateCacheConfig(userInfo, params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('缓存云函数错误:', error)
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
      error: '缺少访问令牌'
    }
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // 查询用户信息
    const userResult = await db.collection('users')
      .where({
        _id: decoded.userId,
        status: 1
      })
      .get()
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        error: '用户不存在或已被禁用'
      }
    }
    
    return {
      success: true,
      data: userResult.data[0]
    }
  } catch (error) {
    return {
      success: false,
      error: '无效的访问令牌'
    }
  }
}

// 获取缓存
async function getCache(params) {
  try {
    const { key, useMemoryCache = true, useDbCache = true } = params
    
    if (!key) {
      return {
        success: false,
        error: '缺少缓存键'
      }
    }
    
    // 首先尝试内存缓存
    if (useMemoryCache) {
      const memoryData = getFromMemoryCache(key)
      if (memoryData) {
        return {
          success: true,
          data: {
            value: memoryData.value,
            source: 'memory',
            timestamp: memoryData.timestamp
          }
        }
      }
    }
    
    // 然后尝试数据库缓存
    if (useDbCache) {
      const dbData = await getFromDbCache(key)
      if (dbData) {
        // 同时更新内存缓存
        if (useMemoryCache) {
          setToMemoryCache(key, dbData.value, dbData.ttl)
        }
        
        return {
          success: true,
          data: {
            value: dbData.value,
            source: 'database',
            timestamp: dbData.timestamp
          }
        }
      }
    }
    
    return {
      success: false,
      error: '缓存未找到'
    }
  } catch (error) {
    console.error('获取缓存失败:', error)
    return {
      success: false,
      error: '获取缓存失败'
    }
  }
}

// 设置缓存
async function setCache(userInfo, params) {
  try {
    const { 
      key, 
      value, 
      ttl = CACHE_TTL, 
      useMemoryCache = true, 
      useDbCache = true,
      tags = []
    } = params
    
    if (!key || value === undefined) {
      return {
        success: false,
        error: '缺少缓存键或值'
      }
    }
    
    const timestamp = new Date()
    const expireTime = new Date(timestamp.getTime() + ttl)
    
    // 设置内存缓存
    if (useMemoryCache) {
      setToMemoryCache(key, value, ttl)
    }
    
    // 设置数据库缓存
    if (useDbCache) {
      await setToDbCache(key, value, ttl, expireTime, tags, userInfo)
    }
    
    return {
      success: true,
      data: {
        key,
        timestamp,
        expireTime,
        ttl
      }
    }
  } catch (error) {
    console.error('设置缓存失败:', error)
    return {
      success: false,
      error: '设置缓存失败'
    }
  }
}

// 删除缓存
async function deleteCache(userInfo, params) {
  try {
    const { key, pattern } = params
    
    if (!key && !pattern) {
      return {
        success: false,
        error: '缺少缓存键或模式'
      }
    }
    
    let deletedCount = 0
    
    if (key) {
      // 删除单个缓存
      deleteFromMemoryCache(key)
      const dbResult = await deleteFromDbCache(key)
      deletedCount = dbResult ? 1 : 0
    } else if (pattern) {
      // 按模式删除
      deletedCount = await deleteCacheByPattern(pattern)
    }
    
    return {
      success: true,
      data: {
        deletedCount
      }
    }
  } catch (error) {
    console.error('删除缓存失败:', error)
    return {
      success: false,
      error: '删除缓存失败'
    }
  }
}

// 清空缓存
async function clearCache(userInfo, params) {
  try {
    const { scope = 'all' } = params
    
    let clearedCount = 0
    
    if (scope === 'memory' || scope === 'all') {
      clearedCount += memoryCache.size
      memoryCache.clear()
    }
    
    if (scope === 'database' || scope === 'all') {
      const result = await db.collection('cache_data').remove()
      clearedCount += result.stats?.removed || 0
    }
    
    return {
      success: true,
      data: {
        clearedCount,
        scope
      }
    }
  } catch (error) {
    console.error('清空缓存失败:', error)
    return {
      success: false,
      error: '清空缓存失败'
    }
  }
}

// 获取缓存统计
async function getCacheStats(userInfo, params) {
  try {
    // 内存缓存统计
    const memoryStats = {
      size: memoryCache.size,
      maxSize: MAX_CACHE_SIZE,
      usage: (memoryCache.size / MAX_CACHE_SIZE * 100).toFixed(2)
    }
    
    // 数据库缓存统计
    const [totalResult, expiredResult, hitResult] = await Promise.all([
      db.collection('cache_data').count(),
      db.collection('cache_data').where({
        expireTime: _.lt(new Date())
      }).count(),
      db.collection('cache_stats').aggregate()
        .group({
          _id: null,
          totalHits: _.sum('$hits'),
          totalMisses: _.sum('$misses')
        })
        .end()
    ])
    
    const hitStats = hitResult.list[0] || { totalHits: 0, totalMisses: 0 }
    const totalRequests = hitStats.totalHits + hitStats.totalMisses
    const hitRate = totalRequests > 0 ? (hitStats.totalHits / totalRequests * 100).toFixed(2) : 0
    
    const dbStats = {
      total: totalResult.total,
      expired: expiredResult.total,
      active: totalResult.total - expiredResult.total,
      hitRate: parseFloat(hitRate),
      totalHits: hitStats.totalHits,
      totalMisses: hitStats.totalMisses
    }
    
    return {
      success: true,
      data: {
        memory: memoryStats,
        database: dbStats,
        timestamp: new Date()
      }
    }
  } catch (error) {
    console.error('获取缓存统计失败:', error)
    return {
      success: false,
      error: '获取缓存统计失败'
    }
  }
}

// 预热缓存
async function warmupCache(params) {
  try {
    const { keys = [], collections = [] } = params
    
    let warmedCount = 0
    
    // 预热指定的缓存键
    for (const key of keys) {
      try {
        const result = await getCache({ key })
        if (result.success) {
          warmedCount++
        }
      } catch (error) {
        console.error(`预热缓存键 ${key} 失败:`, error)
      }
    }
    
    // 预热指定集合的常用数据
    for (const collection of collections) {
      try {
        const count = await warmupCollection(collection)
        warmedCount += count
      } catch (error) {
        console.error(`预热集合 ${collection} 失败:`, error)
      }
    }
    
    return {
      success: true,
      data: {
        warmedCount,
        timestamp: new Date()
      }
    }
  } catch (error) {
    console.error('预热缓存失败:', error)
    return {
      success: false,
      error: '预热缓存失败'
    }
  }
}

// 预加载缓存
async function preloadCache(userInfo, params) {
  try {
    const { orgId = userInfo.orgId } = params
    
    let preloadedCount = 0
    
    // 预加载常用的基础数据
    const collections = ['factories', 'products', 'processes', 'colors', 'sizes']
    
    for (const collectionName of collections) {
      try {
        const result = await db.collection(collectionName)
          .where({
            orgId,
            status: 1
          })
          .limit(100)
          .get()
        
        // 缓存每个记录
        for (const item of result.data) {
          const cacheKey = `${collectionName}:${item._id}`
          await setCache(userInfo, {
            key: cacheKey,
            value: item,
            ttl: 30 * 60 * 1000, // 30分钟
            tags: [collectionName, orgId]
          })
          preloadedCount++
        }
      } catch (error) {
        console.error(`预加载集合 ${collectionName} 失败:`, error)
      }
    }
    
    return {
      success: true,
      data: {
        preloadedCount,
        timestamp: new Date()
      }
    }
  } catch (error) {
    console.error('预加载缓存失败:', error)
    return {
      success: false,
      error: '预加载缓存失败'
    }
  }
}

// 失效缓存
async function invalidateCache(userInfo, params) {
  try {
    const { tags = [], keys = [] } = params
    
    let invalidatedCount = 0
    
    // 按标签失效
    for (const tag of tags) {
      const result = await db.collection('cache_data')
        .where({
          tags: _.in([tag])
        })
        .remove()
      
      invalidatedCount += result.stats?.removed || 0
    }
    
    // 按键失效
    for (const key of keys) {
      deleteFromMemoryCache(key)
      const dbResult = await deleteFromDbCache(key)
      if (dbResult) {
        invalidatedCount++
      }
    }
    
    return {
      success: true,
      data: {
        invalidatedCount,
        timestamp: new Date()
      }
    }
  } catch (error) {
    console.error('失效缓存失败:', error)
    return {
      success: false,
      error: '失效缓存失败'
    }
  }
}

// 获取缓存配置
async function getCacheConfig(userInfo, params) {
  try {
    const result = await db.collection('cache_config')
      .where({
        orgId: userInfo.orgId
      })
      .get()
    
    const config = result.data[0] || {
      defaultTtl: CACHE_TTL,
      maxCacheSize: MAX_CACHE_SIZE,
      enableMemoryCache: true,
      enableDbCache: true,
      autoCleanup: true,
      cleanupInterval: 60 * 60 * 1000 // 1小时
    }
    
    return {
      success: true,
      data: config
    }
  } catch (error) {
    console.error('获取缓存配置失败:', error)
    return {
      success: false,
      error: '获取缓存配置失败'
    }
  }
}

// 更新缓存配置
async function updateCacheConfig(userInfo, params) {
  try {
    const { config } = params
    
    if (!config) {
      return {
        success: false,
        error: '缺少配置参数'
      }
    }
    
    const updateData = {
      ...config,
      orgId: userInfo.orgId,
      updateTime: new Date(),
      updateBy: userInfo._id
    }
    
    // 尝试更新现有配置
    const existingResult = await db.collection('cache_config')
      .where({
        orgId: userInfo.orgId
      })
      .get()
    
    if (existingResult.data.length > 0) {
      await db.collection('cache_config')
        .doc(existingResult.data[0]._id)
        .update({
          data: updateData
        })
    } else {
      await db.collection('cache_config').add({
        data: {
          ...updateData,
          createTime: new Date(),
          createBy: userInfo._id
        }
      })
    }
    
    return {
      success: true,
      data: updateData
    }
  } catch (error) {
    console.error('更新缓存配置失败:', error)
    return {
      success: false,
      error: '更新缓存配置失败'
    }
  }
}

// 内存缓存操作
function getFromMemoryCache(key) {
  const item = memoryCache.get(key)
  if (!item) {
    return null
  }
  
  // 检查是否过期
  if (Date.now() > item.expireTime) {
    memoryCache.delete(key)
    return null
  }
  
  return item
}

function setToMemoryCache(key, value, ttl) {
  // 检查缓存大小限制
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    // 删除最旧的缓存项
    const firstKey = memoryCache.keys().next().value
    memoryCache.delete(firstKey)
  }
  
  const item = {
    value,
    timestamp: new Date(),
    expireTime: Date.now() + ttl
  }
  
  memoryCache.set(key, item)
}

function deleteFromMemoryCache(key) {
  return memoryCache.delete(key)
}

// 数据库缓存操作
async function getFromDbCache(key) {
  try {
    const result = await db.collection('cache_data')
      .where({
        key,
        expireTime: _.gt(new Date())
      })
      .get()
    
    if (result.data.length === 0) {
      // 记录缓存未命中
      await recordCacheStats(key, false)
      return null
    }
    
    // 记录缓存命中
    await recordCacheStats(key, true)
    
    return result.data[0]
  } catch (error) {
    console.error('从数据库获取缓存失败:', error)
    return null
  }
}

async function setToDbCache(key, value, ttl, expireTime, tags, userInfo) {
  try {
    const cacheData = {
      key,
      value,
      ttl,
      expireTime,
      tags,
      orgId: userInfo?.orgId || 'system',
      createTime: new Date(),
      createBy: userInfo?._id || 'system'
    }
    
    // 尝试更新现有缓存
    const existingResult = await db.collection('cache_data')
      .where({ key })
      .get()
    
    if (existingResult.data.length > 0) {
      await db.collection('cache_data')
        .doc(existingResult.data[0]._id)
        .update({
          data: cacheData
        })
    } else {
      await db.collection('cache_data').add({
        data: cacheData
      })
    }
    
    return true
  } catch (error) {
    console.error('设置数据库缓存失败:', error)
    return false
  }
}

async function deleteFromDbCache(key) {
  try {
    const result = await db.collection('cache_data')
      .where({ key })
      .remove()
    
    return result.stats?.removed > 0
  } catch (error) {
    console.error('删除数据库缓存失败:', error)
    return false
  }
}

async function deleteCacheByPattern(pattern) {
  try {
    // 内存缓存按模式删除
    let deletedCount = 0
    const regex = new RegExp(pattern)
    
    for (const [key] of memoryCache) {
      if (regex.test(key)) {
        memoryCache.delete(key)
        deletedCount++
      }
    }
    
    // 数据库缓存按模式删除
    const result = await db.collection('cache_data')
      .where({
        key: db.RegExp({ regexp: pattern })
      })
      .remove()
    
    deletedCount += result.stats?.removed || 0
    
    return deletedCount
  } catch (error) {
    console.error('按模式删除缓存失败:', error)
    return 0
  }
}

async function warmupCollection(collectionName) {
  try {
    const result = await db.collection(collectionName)
      .where({
        status: 1
      })
      .limit(50)
      .get()
    
    let warmedCount = 0
    
    for (const item of result.data) {
      const cacheKey = `${collectionName}:${item._id}`
      setToMemoryCache(cacheKey, item, CACHE_TTL)
      warmedCount++
    }
    
    return warmedCount
  } catch (error) {
    console.error(`预热集合 ${collectionName} 失败:`, error)
    return 0
  }
}

async function recordCacheStats(key, hit) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const statsKey = `${today}:${key.split(':')[0] || 'unknown'}`
    
    const updateData = hit ? { hits: _.inc(1) } : { misses: _.inc(1) }
    
    // 尝试更新现有统计
    const existingResult = await db.collection('cache_stats')
      .where({ key: statsKey })
      .get()
    
    if (existingResult.data.length > 0) {
      await db.collection('cache_stats')
        .doc(existingResult.data[0]._id)
        .update({
          data: updateData
        })
    } else {
      await db.collection('cache_stats').add({
        data: {
          key: statsKey,
          hits: hit ? 1 : 0,
          misses: hit ? 0 : 1,
          date: today,
          createTime: new Date()
        }
      })
    }
  } catch (error) {
    console.error('记录缓存统计失败:', error)
  }
}

// 定期清理过期缓存
setInterval(() => {
  try {
    // 清理内存缓存
    const now = Date.now()
    for (const [key, item] of memoryCache) {
      if (now > item.expireTime) {
        memoryCache.delete(key)
      }
    }
    
    // 清理数据库缓存（异步执行，不阻塞）
    db.collection('cache_data')
      .where({
        expireTime: _.lt(new Date())
      })
      .remove()
      .catch(error => {
        console.error('清理过期数据库缓存失败:', error)
      })
  } catch (error) {
    console.error('定期清理缓存失败:', error)
  }
}, 60 * 1000) // 每分钟清理一次