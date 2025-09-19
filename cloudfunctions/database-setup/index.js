/**
 * 云函数：数据库设置
 * 用于创建集合、索引和配置权限
 */

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      case 'createCollection':
        return await createCollection(data);
      case 'createIndexes':
        return await createIndexes(data);
      case 'setupPermissions':
        return await setupPermissions(data);
      case 'checkCollectionExists':
        return await checkCollectionExists(data);
      default:
        throw new Error(`未知操作: ${action}`);
    }
  } catch (error) {
    console.error('云函数执行错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 创建数据库集合
 */
async function createCollection(data) {
  const { collectionName, schema } = data;
  
  try {
    // 检查集合是否已存在
    const exists = await checkCollectionExists({ collectionName });
    if (exists.exists) {
      return {
        success: true,
        message: `集合 ${collectionName} 已存在`,
        exists: true
      };
    }
    
    // 创建集合（通过插入一条临时数据然后删除）
    const tempDoc = await db.collection(collectionName).add({
      data: {
        _temp: true,
        created_at: new Date()
      }
    });
    
    // 删除临时数据
    await db.collection(collectionName).doc(tempDoc._id).remove();
    
    console.log(`集合 ${collectionName} 创建成功`);
    return {
      success: true,
      message: `集合 ${collectionName} 创建成功`,
      collectionName
    };
  } catch (error) {
    console.error(`创建集合 ${collectionName} 失败:`, error);
    throw error;
  }
}

/**
 * 检查集合是否存在
 */
async function checkCollectionExists(data) {
  const { collectionName } = data;
  
  try {
    await db.collection(collectionName).limit(1).get();
    return {
      success: true,
      exists: true,
      collectionName
    };
  } catch (error) {
    if (error.errCode === -502006) {
      return {
        success: true,
        exists: false,
        collectionName
      };
    }
    throw error;
  }
}

/**
 * 创建索引
 */
async function createIndexes(data) {
  const { collectionName, indexes } = data;
  
  try {
    const results = [];
    
    for (const index of indexes) {
      try {
        // 注意：云开发数据库的索引创建需要通过控制台手动操作
        // 这里我们记录需要创建的索引信息
        console.log(`需要为集合 ${collectionName} 创建索引:`, index);
        results.push({
          index,
          status: 'logged',
          message: '索引信息已记录，请在云开发控制台手动创建'
        });
      } catch (error) {
        console.error(`为集合 ${collectionName} 创建索引失败:`, error);
        results.push({
          index,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      message: `集合 ${collectionName} 索引处理完成`,
      results
    };
  } catch (error) {
    console.error(`处理集合 ${collectionName} 索引失败:`, error);
    throw error;
  }
}

/**
 * 设置数据库权限
 */
async function setupPermissions(data) {
  const { collections } = data;
  
  try {
    // 云开发数据库权限需要在控制台设置
    // 这里记录推荐的权限配置
    const permissionConfig = {
      // 用户相关集合 - 仅创建者及管理员可读写
      users: {
        read: 'auth',
        write: 'auth'
      },
      roles: {
        read: 'auth',
        write: 'auth'
      },
      organizations: {
        read: 'auth',
        write: 'auth'
      },
      
      // 业务数据集合 - 仅创建者及管理员可读写
      factories: {
        read: 'auth',
        write: 'auth'
      },
      processes: {
        read: 'auth',
        write: 'auth'
      },
      products: {
        read: 'auth',
        write: 'auth'
      },
      colors: {
        read: 'auth',
        write: 'auth'
      },
      sizes: {
        read: 'auth',
        write: 'auth'
      },
      
      // 订单相关集合 - 仅创建者及管理员可读写
      send_orders: {
        read: 'auth',
        write: 'auth'
      },
      send_order_items: {
        read: 'auth',
        write: 'auth'
      },
      receive_orders: {
        read: 'auth',
        write: 'auth'
      },
      receive_order_items: {
        read: 'auth',
        write: 'auth'
      },
      
      // 支付记录 - 仅创建者及管理员可读写
      factory_payments: {
        read: 'auth',
        write: 'auth'
      },
      
      // 日志集合 - 仅创建者及管理员可读写
      operation_logs: {
        read: 'auth',
        write: 'auth'
      },
      login_attempts: {
        read: 'auth',
        write: 'auth'
      },
      user_sessions: {
        read: 'auth',
        write: 'auth'
      }
    };
    
    console.log('推荐的数据库权限配置:', permissionConfig);
    
    return {
      success: true,
      message: '权限配置信息已生成，请在云开发控制台手动设置',
      permissionConfig
    };
  } catch (error) {
    console.error('生成权限配置失败:', error);
    throw error;
  }
}