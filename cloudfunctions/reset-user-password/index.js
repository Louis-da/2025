const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 密码工具类
class PasswordUtils {
  static generateSalt() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  static hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }
}

exports.main = async (event, context) => {
  try {
    const { username, orgId, newPassword } = event;
    
    console.log('Resetting password for user:', { orgId, username });
    
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
    console.log('Current user password format:', user.password ? user.password.substring(0, 10) + '...' : 'none');

    // 生成新的salt和密码哈希
    const salt = PasswordUtils.generateSalt();
    const hashedPassword = PasswordUtils.hashPassword(newPassword, salt);

    // 更新用户密码
    const updateResult = await db.collection('users')
      .doc(user._id)
      .update({
        data: {
          password: hashedPassword,
          salt: salt,
          loginAttempts: 0,
          lastFailedLogin: null,
          updatedAt: new Date()
        }
      });

    console.log('User password reset successfully');

    return {
      success: true,
      message: '用户密码已重置',
      data: {
        userId: user._id,
        newPasswordFormat: 'pbkdf2+salt',
        saltLength: salt.length
      }
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      error: error.message
    };
  }
};