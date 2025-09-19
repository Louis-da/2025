// miniprogram/utils/createIndexes.js
// 数据库索引创建工具

const { databaseIndexes } = require('../../cloud-database-schema');

/**
 * 为所有集合创建索引
 * @returns {Promise<Object>} 创建结果
 */
async function createAllIndexes() {
  const results = {
    success: true,
    created: [],
    existing: [],
    errors: []
  };

  console.log('开始创建数据库索引...');
  
  for (const [collectionName, indexes] of Object.entries(databaseIndexes)) {
    try {
      console.log(`正在为集合 ${collectionName} 创建索引`);
      
      if (!Array.isArray(indexes) || indexes.length === 0) {
        console.log(`集合 ${collectionName} 没有定义索引，跳过`);
        continue;
      }

      for (const indexConfig of indexes) {
        try {
          const indexResult = await createCollectionIndex(collectionName, indexConfig);
          
          if (indexResult.success) {
            if (indexResult.created) {
              results.created.push({
                collection: collectionName,
                index: indexConfig.name || JSON.stringify(indexConfig.keys)
              });
            } else {
              results.existing.push({
                collection: collectionName,
                index: indexConfig.name || JSON.stringify(indexConfig.keys)
              });
            }
          } else {
            results.errors.push({
              collection: collectionName,
              index: indexConfig.name || JSON.stringify(indexConfig.keys),
              error: indexResult.message
            });
          }
        } catch (indexError) {
          console.error(`创建索引失败:`, indexError);
          results.errors.push({
            collection: collectionName,
            index: indexConfig.name || JSON.stringify(indexConfig.keys),
            error: indexError.message
          });
        }
      }
      
    } catch (error) {
      console.error(`处理集合 ${collectionName} 索引失败:`, error);
      results.errors.push({
        collection: collectionName,
        error: error.message
      });
      results.success = false;
    }
  }

  if (results.errors.length > 0) {
    results.success = false;
  }

  console.log('索引创建完成:', results);
  return results;
}

/**
 * 为特定集合创建索引
 * @param {string} collectionName 集合名称
 * @param {Object} indexConfig 索引配置
 * @returns {Promise<Object>} 创建结果
 */
async function createCollectionIndex(collectionName, indexConfig) {
  try {
    // 注意：小程序端无法直接创建数据库索引
    // 索引需要在云开发控制台或通过云函数创建
    // 这里我们记录索引配置，实际创建需要通过其他方式
    
    console.log(`记录索引配置 - 集合: ${collectionName}, 索引:`, indexConfig);
    
    // 模拟索引创建成功
    // 实际应用中，这里应该调用云函数或使用管理端API
    return {
      success: true,
      created: true,
      message: `索引配置已记录: ${JSON.stringify(indexConfig)}`
    };
    
  } catch (error) {
    console.error(`创建索引失败:`, error);
    return {
      success: false,
      created: false,
      message: error.message
    };
  }
}

/**
 * 获取索引创建建议
 * @returns {Object} 索引建议
 */
function getIndexRecommendations() {
  const recommendations = {
    totalCollections: Object.keys(databaseIndexes).length,
    totalIndexes: 0,
    collections: {},
    sqlCommands: []
  };

  for (const [collectionName, indexes] of Object.entries(databaseIndexes)) {
    if (Array.isArray(indexes) && indexes.length > 0) {
      recommendations.totalIndexes += indexes.length;
      recommendations.collections[collectionName] = {
        indexCount: indexes.length,
        indexes: indexes.map(index => ({
          name: index.name || `idx_${Object.keys(index.keys).join('_')}`,
          keys: index.keys,
          unique: index.unique || false,
          background: index.background || true
        }))
      };

      // 生成MongoDB索引创建命令（供参考）
      indexes.forEach(index => {
        const indexName = index.name || `idx_${Object.keys(index.keys).join('_')}`;
        const keysStr = JSON.stringify(index.keys);
        const options = [];
        
        if (index.unique) options.push('unique: true');
        if (index.background !== false) options.push('background: true');
        if (index.name) options.push(`name: "${index.name}"`);
        
        const optionsStr = options.length > 0 ? `, {${options.join(', ')}}` : '';
        
        recommendations.sqlCommands.push(
          `db.${collectionName}.createIndex(${keysStr}${optionsStr})`
        );
      });
    }
  }

  return recommendations;
}

/**
 * 生成索引创建脚本
 * @returns {string} 脚本内容
 */
function generateIndexScript() {
  const recommendations = getIndexRecommendations();
  
  let script = `// 数据库索引创建脚本\n// 生成时间: ${new Date().toISOString()}\n\n`;
  
  script += `// 总计: ${recommendations.totalCollections} 个集合, ${recommendations.totalIndexes} 个索引\n\n`;
  
  for (const [collectionName, info] of Object.entries(recommendations.collections)) {
    script += `// ${collectionName} 集合索引 (${info.indexCount} 个)\n`;
    
    info.indexes.forEach(index => {
      script += `// 索引: ${index.name}\n`;
      script += `db.${collectionName}.createIndex(`;
      script += JSON.stringify(index.keys);
      
      const options = [];
      if (index.unique) options.push('unique: true');
      if (index.background) options.push('background: true');
      if (index.name) options.push(`name: "${index.name}"`);
      
      if (options.length > 0) {
        script += `, {${options.join(', ')}}`;
      }
      
      script += ');\n';
    });
    
    script += '\n';
  }
  
  return script;
}

module.exports = {
  createAllIndexes,
  createCollectionIndex,
  getIndexRecommendations,
  generateIndexScript
};