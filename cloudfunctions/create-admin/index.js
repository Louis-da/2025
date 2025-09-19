// 创建超级管理员云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 生成密码哈希
 * @param {string} password 原始密码
 * @param {string} salt 盐值
 * @returns {string} 哈希后的密码
 */
function generatePasswordHash(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

/**
 * 确保组织存在
 */
async function ensureOrganizationExists(orgCode) {
  try {
    // 检查组织是否存在
    const existingOrg = await db.collection('organizations')
      .where({
        code: orgCode
      })
      .get();
    
    if (existingOrg.data.length > 0) {
      console.log('组织已存在:', existingOrg.data[0]);
      return existingOrg.data[0];
    }
    
    // 创建新组织
    const newOrg = {
      code: orgCode,
      name: `组织${orgCode}`,
      type: 'company',
      status: 'active',
      description: '超级管理员组织',
      createTime: new Date(),
      updateTime: new Date()
    };
    
    const result = await db.collection('organizations').add({
      data: newOrg
    });
    
    console.log('✅ 组织创建成功:', result);
    return { ...newOrg, _id: result._id };
    
  } catch (error) {
    console.error('❌ 创建组织失败:', error);
    throw error;
  }
}

/**
 * 创建超级管理员用户
 */
async function createSuperAdmin(orgId, username, password) {
  try {
    console.log('开始创建超级管理员用户...');
    
    // 检查用户是否已存在
    const existingUser = await db.collection('users')
      .where({
        username: username,
        orgId: orgId
      })
      .get();
    
    if (existingUser.data.length > 0) {
      console.log('用户已存在，更新为超级管理员权限...');
      
      // 生成新的密码哈希（如果密码不同）
      const salt = crypto.randomBytes(16).toString('hex');
      const hashedPassword = generatePasswordHash(password, salt);
      
      // 更新现有用户为超级管理员
      const updateResult = await db.collection('users')
        .doc(existingUser.data[0]._id)
        .update({
          data: {
            password: hashedPassword,
            salt: salt,
            roleId: 1,
            isSuperAdmin: true,
            status: 'active',
            updateTime: new Date()
          }
        });
      
      console.log('✅ 用户权限更新成功:', updateResult);
      return {
        success: true,
        message: '用户已存在，权限和密码已更新为超级管理员',
        userId: existingUser.data[0]._id,
        action: 'updated'
      };
    }
    
    // 生成盐值和密码哈希
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = generatePasswordHash(password, salt);
    
    // 创建新的超级管理员用户
    const newUser = {
      username: username,
      password: hashedPassword,
      salt: salt,
      realName: '超级管理员',
      orgId: orgId,
      roleId: 1, // 超级管理员角色ID
      isSuperAdmin: true,
      status: 'active',
      miniprogramAuthorized: true,
      email: '',
      phone: '',
      avatar: '',
      createTime: new Date(),
      updateTime: new Date()
    };
    
    const result = await db.collection('users').add({
      data: newUser
    });
    
    console.log('✅ 超级管理员创建成功:', result);
    
    return {
      success: true,
      message: '超级管理员创建成功',
      userId: result._id,
      action: 'created',
      userInfo: {
        orgId: orgId,
        username: username,
        realName: '超级管理员',
        isSuperAdmin: true
      }
    };
    
  } catch (error) {
    console.error('❌ 创建超级管理员失败:', error);
    return {
      success: false,
      error: error.message || '创建失败'
    };
  }
}

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  try {
    console.log('=== 开始创建超级管理员 ===');
    console.log('请求参数:', event);
    
    // 从事件中获取参数，如果没有则使用默认值
    const {
      orgId = '18933087569',
      username = '9527',
      password = '9527888'
    } = event;
    
    // 参数验证
    if (!orgId || !username || !password) {
      return {
        success: false,
        error: '组织ID、用户名和密码都是必填参数'
      };
    }
    
    // 1. 确保组织存在
    console.log('1. 检查并创建组织...');
    await ensureOrganizationExists(orgId);
    
    // 2. 创建超级管理员用户
    console.log('2. 创建超级管理员用户...');
    const result = await createSuperAdmin(orgId, username, password);
    
    if (result.success) {
      console.log('=== 创建完成 ===');
      console.log('组织编码:', orgId);
      console.log('用户名:', username);
      console.log('密码:', password);
      console.log('角色:', '超级管理员');
      console.log('用户ID:', result.userId);
      console.log('操作类型:', result.action);
      
      return {
        success: true,
        message: result.message,
        data: {
          orgId: orgId,
          username: username,
          userId: result.userId,
          action: result.action,
          isSuperAdmin: true
        }
      };
    } else {
      console.error('创建失败:', result.error);
      return {
        success: false,
        error: result.error
      };
    }
    
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      success: false,
      error: error.message || '执行失败'
    };
  }
};