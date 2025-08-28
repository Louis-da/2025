const bcrypt = require('bcrypt');
const db = require('../db');

async function initAdmin() {
  try {
    // 生成密码哈希
    const password = 'Yunsf@2024';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 更新admin用户的密码
    const result = await db.executeQuery(
      `UPDATE users 
       SET password = ?,
           updated_at = NOW()
       WHERE username = 'admin'`,
      [hashedPassword]
    );
    
    if (result.affectedRows > 0) {
      console.log('超级管理员密码初始化成功');
      console.log('用户名: admin');
      console.log('密码: Yunsf@2024');
    } else {
      console.log('未找到超级管理员账户，尝试创建...');
      
      // 确保系统组织存在
      await db.executeQuery(
        `INSERT INTO organizations (id, name, code, description)
         VALUES (1, '系统管理组织', 'SYSTEM', '系统默认管理组织')
         ON DUPLICATE KEY UPDATE name='系统管理组织'`
      );
      
      // 确保超级管理员角色存在
      await db.executeQuery(
        `INSERT INTO roles (id, name, description)
         VALUES (1, '超级管理员', '系统超级管理员，拥有所有权限')
         ON DUPLICATE KEY UPDATE name='超级管理员'`
      );
      
      // 创建超级管理员账户
      const createResult = await db.executeQuery(
        `INSERT INTO users (
          username,
          password,
          real_name,
          email,
          org_id,
          role_id,
          is_super_admin,
          status,
          created_at,
          updated_at
        ) VALUES (
          'admin',
          ?,
          '超级管理员',
          'admin@aiyunsf.com',
          1,
          1,
          1,
          1,
          NOW(),
          NOW()
        )`,
        [hashedPassword]
      );
      
      if (createResult.insertId) {
        console.log('超级管理员账户创建成功');
        console.log('用户名: admin');
        console.log('密码: Yunsf@2024');
      } else {
        console.error('超级管理员账户创建失败');
      }
    }
  } catch (error) {
    console.error('初始化超级管理员失败:', error);
  } finally {
    process.exit();
  }
}

initAdmin(); 