const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { username, orgId } = event;
    
    if (!username || !orgId) {
      return {
        success: false,
        message: '缺少必要参数：username, orgId'
      };
    }

    // 查找用户
    const userResult = await db.collection('users').where({
      username: username,
      orgId: orgId
    }).get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      };
    }

    const user = userResult.data[0];
    
    // 清除临时密码和重置标志
    await db.collection('users').doc(user._id).update({
      data: {
        tempPassword: db.command.remove(),
        needPasswordReset: false,
        updatedAt: new Date()
      }
    });

    console.log(`用户 ${username} (${orgId}) 标志已清除`);
    
    return {
      success: true,
      message: '用户标志已清除',
      data: {
        username: username,
        orgId: orgId,
        updateTime: new Date().toISOString()
      }
    };
    
  } catch (error) {
    console.error('清除用户标志失败:', error);
    return {
      success: false,
      message: '清除用户标志失败: ' + error.message
    };
  }
};