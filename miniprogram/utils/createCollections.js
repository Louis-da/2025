// miniprogram/utils/createCollections.js
// 数据库集合创建工具

const { cloudDatabaseSchema } = require('../cloud-database-schema.js');

/**
 * 创建所有数据库集合
 * @returns {Promise<Object>} 创建结果
 */
async function createAllCollections() {
  const db = wx.cloud.database();
  const results = {
    success: true,
    created: [],
    existing: [],
    errors: []
  };

  console.log('开始创建数据库集合...');
  
  for (const [collectionName, schema] of Object.entries(cloudDatabaseSchema)) {
    try {
      console.log(`正在创建集合: ${collectionName}`);
      
      // 尝试获取集合信息来检查是否存在
      try {
        await db.collection(collectionName).limit(1).get();
        console.log(`集合 ${collectionName} 已存在`);
        results.existing.push(collectionName);
      } catch (error) {
        // 如果集合不存在，会抛出错误，我们创建它
        if (error.errCode === -502001 || error.errCode === -502005 || error.message.includes('collection not exist') || error.message.includes('Db or Table not exist')) {
          console.log(`检测到集合 ${collectionName} 不存在，错误码: ${error.errCode}`);
          console.log(`完整错误信息:`, error);
          
          // 检查云开发环境状态（移除云函数调用，避免 -501000 错误）
          try {
            // 简单检查云开发是否可用
            const testResult = await db.collection('_test_connection').limit(1).get();
            console.log('云开发环境连接正常');
          } catch (envError) {
            console.warn('云开发环境连接检查:', envError.message);
          }
          
          try {
            // 在云开发中，集合在第一次插入数据时自动创建
            // 插入一个临时文档来创建集合
            console.log(`尝试通过插入文档创建集合 ${collectionName}`);
            const tempDoc = await db.collection(collectionName).add({
              data: {
                _temp: true,
                _createTime: new Date(),
                _description: `临时文档用于创建集合 ${collectionName}`
              }
            });
            
            console.log(`集合 ${collectionName} 创建成功，临时文档ID: ${tempDoc._id}`);
            
            // 立即删除临时文档
            try {
              await db.collection(collectionName).doc(tempDoc._id).remove();
              console.log(`集合 ${collectionName} 临时文档已删除`);
            } catch (removeError) {
              console.warn(`删除临时文档失败，但集合已创建:`, removeError.message);
            }
            
            results.created.push(collectionName);
          } catch (insertError) {
            console.error(`集合 ${collectionName} 创建失败:`, insertError);
            console.error(`插入错误详情:`, {
              errCode: insertError.errCode,
              errMsg: insertError.errMsg,
              message: insertError.message
            });
            
            // 如果是权限问题，提供更详细的错误信息
            if (insertError.errCode === -502005) {
              console.error(`❌ 数据库权限配置问题检测:`);
              console.error(`1. 请检查云开发控制台 -> 数据库 -> 权限设置`);
              console.error(`2. 确保数据库权限设置为 "所有用户可读，仅创建者可读写" 或更宽松的权限`);
              console.error(`3. 检查环境ID是否正确: cloud1-3gwlq66232d160ab`);
              console.error(`4. 确认小程序已关联到正确的云开发环境`);
            }
            
            throw insertError;
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`创建集合 ${collectionName} 失败:`, error);
      results.errors.push({
        collection: collectionName,
        error: error.message
      });
      results.success = false;
    }
  }

  console.log('集合创建完成:', results);
  return results;
}

/**
 * 检查集合是否存在
 * @param {string} collectionName 集合名称
 * @returns {Promise<boolean>} 是否存在
 */
async function checkCollectionExists(collectionName) {
  const db = wx.cloud.database();
  
  try {
    await db.collection(collectionName).limit(1).get();
    return true;
  } catch (error) {
    if (error.errCode === -502001 || error.message.includes('collection not exist')) {
      return false;
    }
    throw error;
  }
}

/**
 * 获取所有集合状态
 * @returns {Promise<Object>} 集合状态信息
 */
async function getAllCollectionsStatus() {
  const status = {
    total: 0,
    existing: [],
    missing: []
  };

  const collections = Object.keys(cloudDatabaseSchema);
  status.total = collections.length;

  for (const collectionName of collections) {
    try {
      const exists = await checkCollectionExists(collectionName);
      if (exists) {
        status.existing.push(collectionName);
      } else {
        status.missing.push(collectionName);
      }
    } catch (error) {
      console.error(`检查集合 ${collectionName} 状态失败:`, error);
      status.missing.push(collectionName);
    }
  }

  return status;
}

module.exports = {
  createAllCollections,
  checkCollectionExists,
  getAllCollectionsStatus
};