// miniprogram/utils/cloudDatabase.js
const app = getApp();

/**
 * 云开发数据库集合创建和初始化
 */
class CloudDatabase {
  constructor() {
    this.db = app.globalData.cloud.database();
  }

  /**
   * 创建所有必需的集合
   */
  async createAllCollections() {
    const collections = [
      // 用户管理
      'users',
      'roles', 
      'organizations',
      'user_sessions',
      
      // 基础数据
      'factories',
      'processes',
      'products',
      'colors',
      'sizes',
      'product_colors',
      'product_sizes',
      
      // 业务流程
      'send_orders',
      'send_order_items', 
      'receive_orders',
      'receive_order_items',
      
      // 财务管理
      'factory_payments',
      
      // 系统日志
      'operation_logs',
      'login_attempts'
    ];

    const results = [];
    
    for (const collectionName of collections) {
      try {
        await this.createCollection(collectionName);
        results.push({ collection: collectionName, status: 'success' });
        console.log(`✅ 集合 ${collectionName} 创建成功`);
      } catch (error) {
        results.push({ 
          collection: collectionName, 
          status: 'error', 
          error: error.message 
        });
        console.error(`❌ 集合 ${collectionName} 创建失败:`, error);
      }
    }
    
    return results;
  }

  /**
   * 创建单个集合
   */
  async createCollection(collectionName) {
    try {
      // 先检查集合是否存在
      const result = await this.db.collection(collectionName).limit(1).get();
      console.log(`集合 ${collectionName} 已存在`);
      return { exists: true };
    } catch (error) {
      if (error.errCode === -502001) {
        // 集合不存在，需要创建
        console.log(`开始创建集合: ${collectionName}`);
        
        // 通过插入一条临时数据来创建集合
        const tempDoc = {
          _temp: true,
          createTime: new Date(),
          orgId: 'temp'
        };
        
        const addResult = await this.db.collection(collectionName).add({
          data: tempDoc
        });
        
        // 立即删除临时数据
        await this.db.collection(collectionName).doc(addResult._id).remove();
        
        console.log(`✅ 集合 ${collectionName} 创建成功`);
        return { created: true };
      } else {
        throw error;
      }
    }
  }

  /**
   * 初始化基础数据
   */
  async initializeBaseData() {
    try {
      // 初始化角色数据
      await this.initRoles();
      
      // 初始化测试组织
      await this.initOrganizations();
      
      // 初始化超级管理员
      await this.initSuperAdmin();
      
      console.log('✅ 基础数据初始化完成');
    } catch (error) {
      console.error('❌ 基础数据初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化角色数据
   */
  async initRoles() {
    const roles = [
      {
        id: 1,
        name: '超级管理员',
        description: '系统超级管理员，拥有所有权限',
        permissions: '*',
        createTime: new Date(),
        updateTime: new Date()
      },
      {
        id: 2,
        name: '组织管理员', 
        description: '组织管理员，管理本组织内的所有数据',
        permissions: 'org_manage',
        createTime: new Date(),
        updateTime: new Date()
      },
      {
        id: 3,
        name: '操作员',
        description: '普通操作员，只能进行基本操作', 
        permissions: 'basic_operation',
        createTime: new Date(),
        updateTime: new Date()
      },
      {
        id: 4,
        name: '专员',
        description: '专员角色，只能查看自己制单的发出单和收回单',
        permissions: 'view_own_orders',
        createTime: new Date(),
        updateTime: new Date()
      }
    ];

    for (const role of roles) {
      try {
        // 检查角色是否已存在
        const existing = await this.db.collection('roles')
          .where({ id: role.id })
          .get();
          
        if (existing.data.length === 0) {
          await this.db.collection('roles').add({ data: role });
          console.log(`✅ 角色 ${role.name} 创建成功`);
        } else {
          console.log(`角色 ${role.name} 已存在`);
        }
      } catch (error) {
        console.error(`❌ 角色 ${role.name} 创建失败:`, error);
      }
    }
  }

  /**
   * 初始化组织数据
   */
  async initOrganizations() {
    const org = {
      orgId: '000',
      name: '测试组织',
      contact: '管理员',
      phone: '13800138000', 
      address: '测试地址',
      status: 'active',
      createTime: new Date(),
      updateTime: new Date()
    };

    try {
      const existing = await this.db.collection('organizations')
        .where({ orgId: org.orgId })
        .get();
        
      if (existing.data.length === 0) {
        await this.db.collection('organizations').add({ data: org });
        console.log(`✅ 组织 ${org.name} 创建成功`);
      } else {
        console.log(`组织 ${org.name} 已存在`);
      }
    } catch (error) {
      console.error(`❌ 组织 ${org.name} 创建失败:`, error);
    }
  }

  /**
   * 初始化超级管理员
   */
  async initSuperAdmin() {
    const admin = {
      username: 'admin',
      password: 'da7b9a0f4c8e65c97cf46c5b8bf1b7e91f4a47a4f5a95f5e08a3c1f2b9e7d4c6a8b5f2e1d4c7a9b6e3f8d1c4a7b2e5f9c2a5b8e1d6f3c9a2b5e8f1c4a7b2e5f',
      salt: 'test_salt',
      realName: '系统管理员',
      orgId: '000',
      roleId: 1,
      isSuperAdmin: true,
      status: 'active',
      miniprogramAuthorized: true,
      createTime: new Date(),
      updateTime: new Date()
    };

    try {
      const existing = await this.db.collection('users')
        .where({ username: admin.username, orgId: admin.orgId })
        .get();
        
      if (existing.data.length === 0) {
        await this.db.collection('users').add({ data: admin });
        console.log(`✅ 超级管理员 ${admin.username} 创建成功`);
      } else {
        console.log(`超级管理员 ${admin.username} 已存在`);
      }
    } catch (error) {
      console.error(`❌ 超级管理员 ${admin.username} 创建失败:`, error);
    }
  }

  /**
   * 验证所有集合是否创建成功
   */
  async validateCollections() {
    const collections = [
      'users', 'roles', 'organizations', 'user_sessions',
      'factories', 'processes', 'products', 'colors', 'sizes',
      'product_colors', 'product_sizes',
      'send_orders', 'send_order_items',
      'receive_orders', 'receive_order_items',
      'factory_payments', 'operation_logs', 'login_attempts'
    ];

    const results = [];
    
    for (const collectionName of collections) {
      try {
        const result = await this.db.collection(collectionName).limit(1).get();
        results.push({ 
          collection: collectionName, 
          status: 'success',
          exists: true
        });
        console.log(`✅ 集合 ${collectionName} 验证成功`);
      } catch (error) {
        results.push({ 
          collection: collectionName, 
          status: 'error',
          exists: false,
          error: error.message 
        });
        console.error(`❌ 集合 ${collectionName} 验证失败:`, error);
      }
    }
    
    return results;
  }

  /**
   * 验证基础数据是否初始化成功
   */
  async validateBaseData() {
    const results = [];
    
    try {
      // 验证角色数据 - 限制查询数量避免全量扫描
      const roles = await this.db.collection('roles').limit(100).get();
      results.push({
        type: 'roles',
        count: roles.data.length,
        status: roles.data.length >= 4 ? 'success' : 'warning',
        data: roles.data
      });
      
      // 验证组织数据 - 限制查询数量避免全量扫描
      const orgs = await this.db.collection('organizations').limit(100).get();
      results.push({
        type: 'organizations',
        count: orgs.data.length,
        status: orgs.data.length >= 1 ? 'success' : 'warning',
        data: orgs.data
      });
      
      // 验证管理员账户
      const admin = await this.db.collection('users')
        .where({ username: 'admin' })
        .get();
      results.push({
        type: 'admin_user',
        count: admin.data.length,
        status: admin.data.length >= 1 ? 'success' : 'error',
        data: admin.data
      });
      
    } catch (error) {
      console.error('验证基础数据失败:', error);
      results.push({
        type: 'validation_error',
        status: 'error',
        error: error.message
      });
    }
    
    return results;
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats() {
    const collections = [
      'users', 'roles', 'organizations', 'user_sessions',
      'factories', 'processes', 'products', 'colors', 'sizes',
      'product_colors', 'product_sizes',
      'send_orders', 'send_order_items',
      'receive_orders', 'receive_order_items',
      'factory_payments', 'operation_logs', 'login_attempts'
    ];

    const stats = [];
    
    for (const collectionName of collections) {
      try {
        const result = await this.db.collection(collectionName).count();
        stats.push({
          collection: collectionName,
          count: result.total,
          status: 'success'
        });
      } catch (error) {
        stats.push({
          collection: collectionName,
          count: 0,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return stats;
  }
}

module.exports = CloudDatabase;