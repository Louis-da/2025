const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { orgId, orgName } = event;
    
    if (!orgId) {
      return {
        success: false,
        message: '缺少必要参数：orgId'
      };
    }

    // 检查组织是否已存在
    const existingOrg = await db.collection('organizations').where({
      orgId: orgId
    }).get();

    if (existingOrg.data.length > 0) {
      return {
        success: false,
        message: '组织已存在',
        data: existingOrg.data[0]
      };
    }

    // 创建新组织
    const result = await db.collection('organizations').add({
      data: {
        orgId: orgId,
        orgName: orgName || '超级管理员',
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`组织 ${orgId} 创建成功`);
    
    return {
      success: true,
      message: '组织创建成功',
      data: {
        _id: result._id,
        orgId: orgId,
        orgName: orgName || '超级管理员',
        status: 1
      }
    };
    
  } catch (error) {
    console.error('创建组织失败:', error);
    return {
      success: false,
      message: '创建组织失败: ' + error.message
    };
  }
};