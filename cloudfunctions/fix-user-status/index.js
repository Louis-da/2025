const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { username, orgId } = event;
    
    console.log('Fixing user status:', { orgId, username });
    
    // 查找用户
    const userResult = await db.collection('users')
      .where({
        username: username,
        orgId: orgId
      })
      .get();

    if (userResult.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const user = userResult.data[0];
    console.log('Current user status:', user.status);

    // 更新status为数字1
    const updateResult = await db.collection('users')
      .doc(user._id)
      .update({
        data: {
          status: 1,
          updatedAt: new Date()
        }
      });

    console.log('User status updated successfully');

    return {
      success: true,
      message: '用户状态已修复',
      data: {
        userId: user._id,
        oldStatus: user.status,
        newStatus: 1
      }
    };
  } catch (error) {
    console.error('Fix user status error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};