const path = require('path');
const fs = require('fs');
const logger = require('../logger');
const { promisify } = require('util');

// 使用异步文件检查
const fileExists = promisify(fs.access);

// 图片文件路径缓存
const imagePathCache = new Map();
// 设置缓存过期时间（10分钟）
const CACHE_TTL = 10 * 60 * 1000;

/**
 * 清理图片路径缓存
 */
const cleanCache = () => {
  const now = Date.now();
  for (const [key, value] of imagePathCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      imagePathCache.delete(key);
    }
  }
};

// 每5分钟清理一次缓存
setInterval(cleanCache, 5 * 60 * 1000);

/**
 * 检查文件是否存在（带缓存）
 * @param {string} filePath - 文件路径
 * @returns {Promise<boolean>} 文件是否存在
 */
async function checkFileExistsWithCache(filePath) {
  // 检查缓存
  if (imagePathCache.has(filePath)) {
    const cacheEntry = imagePathCache.get(filePath);
    // 如果缓存未过期，直接返回缓存结果
    if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
      return cacheEntry.exists;
    }
  }
  
  // 缓存不存在或已过期，执行文件检查
  try {
    await fileExists(filePath, fs.constants.F_OK);
    // 文件存在，更新缓存
    imagePathCache.set(filePath, { exists: true, timestamp: Date.now() });
    return true;
  } catch (error) {
    // 文件不存在，更新缓存
    imagePathCache.set(filePath, { exists: false, timestamp: Date.now() });
    return false;
  }
}

/**
 * 统一的图片URL处理函数
 * @param {string} originalDbPath - 数据库中存储的原始图片路径
 * @param {string} context - 调用上下文（用于日志）
 * @returns {Promise<Object>} 包含缩略图和原图URL的对象
 */
const processImageUrl = async (originalDbPath, context = 'General') => {
  try {
    let thumbnailUrl = '';
    let originalImageUrl = '';

    // 处理空路径
    if (!originalDbPath) {
      logger.debug(`[${context}] 空图片路径，使用默认图片`);
      return {
        thumbnailUrl: '/images/default-product.png',
        originalImageUrl: '/images/default-product.png'
      };
    }

    // 清理和规范化路径
    originalDbPath = originalDbPath.trim();
    if (!originalDbPath.startsWith('/uploads/')) {
      originalDbPath = '/uploads/' + originalDbPath.replace(/^\/?uploads\/?/, '');
    }
    originalImageUrl = originalDbPath;

    // 构造缩略图URL
    const parts = originalDbPath.split('/');
    const filenameWithExt = parts.pop();
    const pathToDir = parts.join('/');
    
    if (!filenameWithExt) {
      logger.warn(`[${context}] 无效的图片文件名:`, { path: originalDbPath });
      return {
        thumbnailUrl: '/images/default-product.png',
        originalImageUrl: '/images/default-product.png'
      };
    }

    const ext = path.extname(filenameWithExt);
    const basename = path.basename(filenameWithExt, ext);
    thumbnailUrl = `${pathToDir}/${basename}_thumb${ext}`;

    // 检查文件是否存在
    const uploadBasePath = '/var/www/aiyunsf.com/public';
    const thumbFullPath = path.join(uploadBasePath, thumbnailUrl);
    const originalFullPath = path.join(uploadBasePath, originalImageUrl);

    logger.debug(`[${context}] 检查图片路径`, { 
      thumbPath: thumbFullPath, 
      originalPath: originalFullPath 
    });

    // 异步文件存在性检查
    const thumbExists = await checkFileExistsWithCache(thumbFullPath);
    
    if (!thumbExists) {
      logger.debug(`[${context}] 缩略图不存在: ${thumbFullPath}`);
      
      const originalExists = await checkFileExistsWithCache(originalFullPath);
      
      if (!originalExists) {
        logger.warn(`[${context}] 原图也不存在: ${originalFullPath}`);
        return {
          thumbnailUrl: '/images/default-product.png',
          originalImageUrl: '/images/default-product.png'
        };
      }
      
      logger.debug(`[${context}] 使用原图: ${originalImageUrl}`);
      thumbnailUrl = originalImageUrl;
    }

    return { thumbnailUrl, originalImageUrl };
  } catch (error) {
    logger.error(`[${context}] 处理图片URL时出错:`, { 
      error: error.message, 
      stack: error.stack,
      path: originalDbPath 
    });
    
    return {
      thumbnailUrl: '/images/default-product.png',
      originalImageUrl: '/images/default-product.png'
    };
  }
};

/**
 * 同步版本的图片URL处理函数（兼容旧代码）
 */
const processImageUrlSync = (originalDbPath, context = 'General') => {
  try {
    let thumbnailUrl = '';
    let originalImageUrl = '';

    if (!originalDbPath) {
      return {
        thumbnailUrl: '/images/default-product.png',
        originalImageUrl: '/images/default-product.png'
      };
    }

    // 清理和规范化路径
    originalDbPath = originalDbPath.trim();
    if (!originalDbPath.startsWith('/uploads/')) {
      if (originalDbPath.startsWith('/images/')) {
        // 如果已经是/images/路径，直接使用
        return {
          thumbnailUrl: originalDbPath,
          originalImageUrl: originalDbPath
        };
      }
      originalDbPath = '/uploads/' + originalDbPath.replace(/^\/?uploads\/?/, '');
    }
    originalImageUrl = originalDbPath;

    // 构造缩略图URL
    const parts = originalDbPath.split('/');
    const filenameWithExt = parts.pop();
    const pathToDir = parts.join('/');
    
    if (!filenameWithExt) {
      logger.warn(`[${context}] 无效的图片文件名:`, { path: originalDbPath });
      return {
        thumbnailUrl: '/images/default-product.png',
        originalImageUrl: '/images/default-product.png'
      };
    }

    const ext = path.extname(filenameWithExt);
    const basename = path.basename(filenameWithExt, ext);
    thumbnailUrl = `${pathToDir}/${basename}_thumb${ext}`;

    return { thumbnailUrl, originalImageUrl };
  } catch (error) {
    logger.error(`[${context}] 处理图片URL时出错:`, { 
      error: error.message, 
      stack: error.stack,
      path: originalDbPath 
    });
    
    return {
      thumbnailUrl: '/images/default-product.png',
      originalImageUrl: '/images/default-product.png'
    };
  }
};

module.exports = {
  processImageUrl,
  processImageUrlSync
}; 