const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const { username, orgId } = event;
    
    console.log('Debug user data:', { orgId, username });
    
    const result = await db.collection('users')
      .where({
        username: username,
        orgId: orgId
      })
      .get();

    console.log('Found users:', result.data.length);

    const users = result.data.map(user => ({
      _id: user._id,
      username: user.username,
      orgId: user.orgId,
      status: user.status,
      passwordFormat: user.password ? 'bcrypt' : 'none',
      passwordLength: user.password ? user.password.length : 0,
      passwordPrefix: user.password ? user.password.substring(0, 20) + '...' : 'none',
      salt: user.salt || 'missing',
      saltLength: user.salt ? user.salt.length : 0,
      needPasswordReset: user.needPasswordReset || false,
      tempPassword: user.tempPassword || 'none',
      updatedAt: user.updatedAt
    }));

    return {
      success: true,
      data: {
        totalUsers: result.data.length,
        users: users
      }
    };
  } catch (error) {
    console.error('Debug user error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};