// miniprogram/utils/insertDefaultData.js
// 默认数据插入工具

const { defaultData } = require('../cloud-database-schema.js');

/**
 * 插入所有默认数据
 * @returns {Promise<Object>} 插入结果
 */
async function insertAllDefaultData() {
  const db = wx.cloud.database();
  const results = {
    success: true,
    inserted: [],
    skipped: [],
    errors: []
  };

  console.log('开始插入默认数据...');
  
  for (const [collectionName, data] of Object.entries(defaultData)) {
    try {
      console.log(`正在处理集合: ${collectionName}`);
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`集合 ${collectionName} 没有默认数据，跳过`);
        results.skipped.push(collectionName);
        continue;
      }

      // 检查是否已有数据
      const existingData = await db.collection(collectionName).limit(1).get();
      
      if (existingData.data.length > 0) {
        console.log(`集合 ${collectionName} 已有数据，跳过插入`);
        results.skipped.push(collectionName);
        continue;
      }

      // 批量插入数据
      for (const item of data) {
        try {
          await db.collection(collectionName).add({
            data: {
              ...item,
              _createTime: new Date(),
              _updateTime: new Date()
            }
          });
        } catch (insertError) {
          console.error(`插入数据到 ${collectionName} 失败:`, insertError);
          results.errors.push({
            collection: collectionName,
            item: item,
            error: insertError.message
          });
        }
      }
      
      console.log(`集合 ${collectionName} 默认数据插入成功，共 ${data.length} 条`);
      results.inserted.push({
        collection: collectionName,
        count: data.length
      });
      
    } catch (error) {
      console.error(`处理集合 ${collectionName} 失败:`, error);
      results.errors.push({
        collection: collectionName,
        error: error.message
      });
      results.success = false;
    }
  }

  console.log('默认数据插入完成:', results);
  return results;
}

/**
 * 插入特定集合的默认数据
 * @param {string} collectionName 集合名称
 * @returns {Promise<Object>} 插入结果
 */
async function insertCollectionDefaultData(collectionName) {
  const db = wx.cloud.database();
  const data = defaultData[collectionName];
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      success: false,
      message: `集合 ${collectionName} 没有默认数据`
    };
  }

  try {
    // 检查是否已有数据
    const existingData = await db.collection(collectionName).limit(1).get();
    
    if (existingData.data.length > 0) {
      return {
        success: false,
        message: `集合 ${collectionName} 已有数据，跳过插入`
      };
    }

    // 批量插入数据
    const insertPromises = data.map(item => 
      db.collection(collectionName).add({
        data: {
          ...item,
          _createTime: new Date(),
          _updateTime: new Date()
        }
      })
    );
    
    await Promise.all(insertPromises);
    
    return {
      success: true,
      message: `集合 ${collectionName} 默认数据插入成功，共 ${data.length} 条`
    };
    
  } catch (error) {
    console.error(`插入集合 ${collectionName} 默认数据失败:`, error);
    return {
      success: false,
      message: `插入失败: ${error.message}`
    };
  }
}

/**
 * 创建管理员账户
 * @returns {Promise<Object>} 创建结果
 */
async function createAdminUser() {
  const db = wx.cloud.database();
  
  try {
    // 检查是否已有管理员账户
    const existingAdmin = await db.collection('users')
      .where({
        username: 'admin'
      })
      .get();
    
    if (existingAdmin.data.length > 0) {
      return {
        success: false,
        message: '管理员账户已存在'
      };
    }

    // 获取管理员角色ID
    const adminRole = await db.collection('roles')
      .where({
        code: 'admin'
      })
      .get();
    
    if (adminRole.data.length === 0) {
      return {
        success: false,
        message: '管理员角色不存在，请先插入角色数据'
      };
    }

    // 创建管理员用户
    const adminUser = {
      username: 'admin',
      password: 'admin123', // 注意：实际应用中应该加密
      nickname: '系统管理员',
      email: 'admin@yunsf.com',
      phone: '13800138000',
      avatar: '',
      status: 'active',
      roleIds: [adminRole.data[0]._id],
      organizationId: null,
      permissions: ['*'], // 超级管理员权限
      lastLoginTime: null,
      loginCount: 0,
      _createTime: new Date(),
      _updateTime: new Date()
    };

    const result = await db.collection('users').add({
      data: adminUser
    });

    return {
      success: true,
      message: '管理员账户创建成功',
      adminId: result._id,
      username: 'admin',
      password: 'admin123'
    };
    
  } catch (error) {
    console.error('创建管理员账户失败:', error);
    return {
      success: false,
      message: `创建失败: ${error.message}`
    };
  }
}

/**
 * 检查数据库初始化状态
 * @returns {Promise<Object>} 初始化状态
 */
async function checkInitializationStatus() {
  const db = wx.cloud.database();
  const status = {
    collectionsReady: false,
    defaultDataReady: false,
    adminUserReady: false,
    details: {
      collections: [],
      missingCollections: [],
      dataStatus: {},
      adminExists: false
    }
  };

  try {
    // 检查集合状态
    const collections = Object.keys(defaultData);
    const collectionChecks = await Promise.allSettled(
      collections.map(async (name) => {
        try {
          await db.collection(name).limit(1).get();
          return { name, exists: true };
        } catch (error) {
          return { name, exists: false };
        }
      })
    );

    collectionChecks.forEach(result => {
      if (result.status === 'fulfilled') {
        if (result.value.exists) {
          status.details.collections.push(result.value.name);
        } else {
          status.details.missingCollections.push(result.value.name);
        }
      }
    });

    status.collectionsReady = status.details.missingCollections.length === 0;

    // 检查默认数据状态
    if (status.collectionsReady) {
      for (const collectionName of collections) {
        try {
          const data = await db.collection(collectionName).limit(1).get();
          status.details.dataStatus[collectionName] = data.data.length > 0;
        } catch (error) {
          status.details.dataStatus[collectionName] = false;
        }
      }
      
      status.defaultDataReady = Object.values(status.details.dataStatus).every(hasData => hasData);
    }

    // 检查管理员账户
    if (status.collectionsReady) {
      try {
        const adminUser = await db.collection('users')
          .where({ username: 'admin' })
          .get();
        status.details.adminExists = adminUser.data.length > 0;
        status.adminUserReady = status.details.adminExists;
      } catch (error) {
        status.details.adminExists = false;
        status.adminUserReady = false;
      }
    }

  } catch (error) {
    console.error('检查初始化状态失败:', error);
  }

  return status;
}

module.exports = {
  insertAllDefaultData,
  insertCollectionDefaultData,
  createAdminUser,
  checkInitializationStatus
};