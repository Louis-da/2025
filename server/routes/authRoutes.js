// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// 导入 Node.js 内置的 crypto 模块
const crypto = require('crypto');

// 尝试导入JWT，如果失败则提供错误处理
let jwt;
try {
  jwt = require('jsonwebtoken');
} catch (err) {
  console.error('缺少jsonwebtoken依赖，请运行: npm install jsonwebtoken');
  // 创建一个简单的替代对象，避免程序崩溃
  jwt = {
    verify: (token, secret) => {
      throw new Error('JWT模块未安装，无法验证令牌');
    },
    sign: (payload, secret, options) => {
      console.error('JWT模块未安装，无法生成令牌');
      return 'INVALID-TOKEN';
    }
  };
}

// JWT密钥，必须从环境变量获取
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ 严重安全错误: JWT_SECRET 环境变量未设置');
  console.error('请在环境变量中设置 JWT_SECRET，建议使用强随机字符串，长度至少32位');
  process.exit(1);
}

// 用户登录（不需要认证）
router.post('/login', async (req, res) => {
  try {
    console.log('----------收到登录请求----------');
    
    // 验证请求体是否存在
    if (!req.body || typeof req.body !== 'object') {
      console.log('请求体格式错误:', req.body);
      return res.status(400).json({ 
        success: false, 
        error: '请求格式错误' 
      });
    }
    
    // 打印请求体，便于排查web端和小程序端参数问题
    console.log('登录请求体:', JSON.stringify(req.body));
    
    // 兼容orgCode和orgId，并进行数据清理
    const orgId = (req.body.orgId || req.body.orgCode || req.body.org_code || '').toString().trim();
    const username = (req.body.username || '').toString().trim();
    const password = (req.body.password || '').toString().trim();
    
    // 参数验证
    if (!orgId || !username || !password) {
      console.log('参数验证失败:', { orgId: !!orgId, username: !!username, hasPassword: !!password });
      return res.status(400).json({ 
        success: false, 
        error: '组织编号、工号和密码不能为空' 
      });
    }
    
    // 参数长度验证
    if (orgId.length > 50 || username.length > 50 || password.length > 100) {
      console.log('参数长度超限');
      return res.status(400).json({ 
        success: false, 
        error: '参数长度超出限制' 
      });
    }
    
    console.log('验证参数:', { orgId, username, hasPassword: !!password });
    
    // 先查组织id - 增加错误处理
    let orgRows;
    try {
      orgRows = await db.executeQuery(
        'SELECT orgId, name FROM organizations WHERE orgId = ? AND status = 1', 
        [orgId]
      );
    } catch (dbError) {
      console.error('查询组织信息失败:', dbError.message);
      return res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
      });
    }
    
    if (!orgRows || orgRows.length === 0) {
      console.log('组织不存在或已禁用:', orgId);
      return res.status(401).json({ 
        success: false, 
        error: '组织编码、工号或密码错误' 
      });
    }
    
    const orgIdValue = orgRows[0].orgId;
    console.log('找到组织:', { orgId: orgIdValue, name: orgRows[0].name });
    
    // 查询用户信息 - 增加错误处理
    const query = `
      SELECT 
        u.id, u.username, u.real_name, u.orgId, u.role_id, u.status,
        u.password, u.salt, u.is_super_admin, u.password_reset_required,
        o.name as orgName,
        r.name as roleName, r.permissions
      FROM users u
      LEFT JOIN organizations o ON u.orgId = o.orgId
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.username = ? AND u.orgId = ? AND u.status = 1
    `;
    
    let users;
    try {
      users = await db.executeQuery(query, [username, orgIdValue]);
    } catch (dbError) {
      console.error('查询用户信息失败:', dbError.message);
      return res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
      });
    }
    
    if (!users || users.length === 0) {
      console.log('用户不存在或状态禁用:', { username, orgId: orgIdValue });
      return res.status(401).json({ 
        success: false, 
        error: '组织编码、工号或密码错误' 
      });
    }
    
    const user = users[0];
    console.log('查到用户:', { 
      id: user.id, 
      username: user.username, 
      orgId: user.orgId, 
      status: user.status, 
      is_super_admin: user.is_super_admin 
    });

    // 验证密码 - 增加错误处理
    if (!user.password || !user.salt) {
      console.log('用户密码数据不完整');
      return res.status(401).json({ 
        success: false, 
        error: '组织编码、工号或密码错误' 
      });
    }

    const storedHash = user.password;
    const storedSalt = user.salt;

    // 使用 crypto.pbkdf2 对输入的明文密码进行哈希
    const iterations = 100000;
    const keylen = 64;
    const digest = 'sha512';

    let hashedPassword;
    try {
      hashedPassword = await new Promise((resolve, reject) => {
        crypto.pbkdf2(password, storedSalt, iterations, keylen, digest, (err, hash) => {
          if (err) {
            return reject(err);
          }
          resolve(hash);
        });
      });
    } catch (cryptoError) {
      console.error('密码哈希计算失败:', cryptoError.message);
      return res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
      });
    }

    // 将计算出的哈希值与数据库中存储的哈希值进行比较
    const passwordMatch = hashedPassword.toString('hex') === storedHash;
    console.log('密码比较结果:', passwordMatch);

    if (!passwordMatch) {
      console.log('密码不匹配');
      return res.status(401).json({ 
        success: false, 
        error: '组织编码、工号或密码错误' 
      });
    }

    // 生成JWT令牌 - 增加错误处理
    let token;
    try {
      token = jwt.sign(
        {
          userId: user.id,
          username: user.username,
          orgId: user.orgId,
          orgName: user.orgName,
          roleId: user.role_id,
          roleName: user.roleName,
          isSuperAdmin: user.is_super_admin === 1,
          loginTime: new Date().getTime() // 添加登录时间戳，用于单点登录验证
        },
        JWT_SECRET,
        { expiresIn: '15d' }
      );
    } catch (jwtError) {
      console.error('JWT令牌生成失败:', jwtError.message);
      return res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
      });
    }

    // 单点登录：更新用户的当前token，使旧token失效
    try {
      await db.executeQuery(
        'UPDATE users SET current_token = ?, current_login_time = NOW(), last_login = NOW() WHERE id = ?', 
        [token, user.id]
      );
      console.log('单点登录：已更新用户token，工号:', user.username);
    } catch (dbError) {
      console.error('更新用户token失败:', dbError.message);
      return res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
      });
    }

    // 新增：创建用户会话记录，确保组织数据隔离
    try {
      const platform = req.headers['user-agent']?.includes('MicroMessenger') ? 'miniprogram' : 
                      req.headers['user-agent']?.includes('Chrome') || req.headers['user-agent']?.includes('Firefox') ? 'web' : 'admin';
      
      await db.executeQuery(
        'INSERT INTO user_sessions (user_id, session_token, platform, ip_address, orgId, device_info) VALUES (?, ?, ?, ?, ?, ?)',
        [
          user.id,
          token,
          platform,
          req.ip || 'unknown',
          user.orgId, // 确保组织隔离
          JSON.stringify({
            userAgent: req.get('User-Agent') || 'unknown',
            platform: platform,
            timestamp: new Date().toISOString()
          })
        ]
      );
      console.log('会话记录创建成功，用户:', user.username, '组织:', user.orgId);
    } catch (sessionError) {
      console.error('创建会话记录失败:', sessionError.message);
      // 不影响登录流程，继续执行
    }

    // 记录登录日志 - 增加错误处理
    try {
      await db.executeQuery(
        'INSERT INTO operation_logs (user_id, username, action, ip_address, details) VALUES (?, ?, ?, ?, ?)',
        [
          user.id,
          user.username,
          'login',
          req.ip || 'unknown',
          'Web系统登录'
        ]
      );
    } catch (dbError) {
      console.error('记录登录日志失败:', dbError.message);
      // 不影响登录流程，继续执行
    }

    // 返回令牌和用户信息
    const responseData = {
      success: true,
      message: '登录成功',
      data: {
        token,
        userId: user.id,
        username: user.username,
        orgId: user.orgId,
        orgCode: user.orgId, // 兼容性
        orgName: user.orgName,
        realName: user.real_name || user.username,
        roleId: user.role_id,
        roleName: user.roleName,
        isSuperAdmin: user.is_super_admin === 1,
        password_reset_required: user.password_reset_required === 1
      }
    };
    
    console.log('----------登录成功----------');
    res.json(responseData);
    
  } catch (error) {
    console.error('登录接口异常:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 获取当前用户信息（需要认证）
router.get('/current-user', authenticate, async (req, res) => {
  try {
    const [user] = await db.executeQuery(
      `SELECT 
        u.id, u.username, u.real_name, u.orgId, u.role_id, u.status,
        o.name as orgName,
        r.name as roleName, r.permissions
      FROM users u
      LEFT JOIN organizations o ON u.orgId = o.orgId
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.orgId = ? AND u.status = 1`,
      [req.user.userId, req.user.orgId]
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        orgId: user.orgId,
        orgName: user.orgName,
        roleId: user.role_id,
        roleName: user.roleName,
        isSuperAdmin: user.is_super_admin === 1,
        status: user.status
      }
    });
  } catch (error) {
    console.error('获取当前用户信息失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// Token验证接口：检查当前token是否为最新有效token（单点登录）
router.get('/verify-token', authenticate, async (req, res) => {
  try {
    // 先检查current_token字段是否存在
    let user;
    try {
      [user] = await db.executeQuery(
        'SELECT current_token FROM users WHERE id = ?',
        [req.user.userId]
      );
    } catch (dbError) {
      // 如果查询失败，可能是字段不存在，返回成功（向后兼容）
      console.warn('查询current_token字段失败，可能数据库尚未迁移:', dbError.message);
      return res.json({
        success: true,
        message: 'Token有效（数据库未迁移，跳过单点登录检查）'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'token_invalid',
        message: '用户不存在'
      });
    }

    // 如果current_token字段存在但为空，说明是旧token或首次登录，允许通过
    if (!user.current_token) {
      console.log('用户current_token为空，可能是首次登录或旧系统数据，允许通过');
      return res.json({
        success: true,
        message: 'Token有效（首次登录）'
      });
    }

    // 获取请求头中的token
    const requestToken = req.headers.authorization?.replace('Bearer ', '') || req.headers.token;
    
    // 比较当前请求的token与数据库中的最新token
    if (user.current_token !== requestToken) {
      console.log('Token验证失败：用户在其他地方登录', {
        userId: req.user.userId,
        username: req.user.username,
        hasCurrentToken: !!user.current_token,
        tokenMatch: user.current_token === requestToken
      });
      
      return res.status(401).json({
        success: false,
        error: 'token_expired',
        message: '您的账号在其他地方登录，当前登录已失效'
      });
    }

    // Token有效
    res.json({
      success: true,
      message: 'Token有效'
    });
    
  } catch (error) {
    console.error('Token验证失败:', error);
    // 为了避免影响系统正常使用，在发生错误时返回成功
    res.json({
      success: true,
      message: 'Token有效（验证失败，允许通过）'
    });
  }
});

// 修改密码（需要认证）
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    // 验证必填参数
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: '原密码和新密码不能为空' 
      });
    }

    // 验证新密码长度
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: '新密码长度不能小于6位' 
      });
    }

    // 查询用户当前密码和盐值
    const [user] = await db.executeQuery(
      'SELECT password, salt FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user) {
       // 理论上 authenticate 中已检查用户存在，这里作为额外防御
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const storedHash = user.password;
    const storedSalt = user.salt;

    // 使用 crypto.pbkdf2 验证原密码
    const iterations = 100000; // 和登录逻辑保持一致
    const keylen = 64;       // 和登录逻辑保持一致
    const digest = 'sha512'; // 和登录逻辑保持一致

    const oldPasswordHashed = await new Promise((resolve, reject) => {
      crypto.pbkdf2(oldPassword, storedSalt, iterations, keylen, digest, (err, hash) => {
        if (err) {
          return reject(err);
        }
        resolve(hash);
      });
    });

    const passwordMatch = oldPasswordHashed.toString('hex') === storedHash;

    // 验证原密码
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        error: '原密码不正确' 
      });
    }

    // 生成新的盐值和哈希
    const newSalt = await new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, salt) => {
        if (err) {
          return reject(err);
        }
        resolve(salt.toString('hex'));
      });
    });

    const newHashedPassword = await new Promise((resolve, reject) => {
      crypto.pbkdf2(newPassword, newSalt, iterations, keylen, digest, (err, hash) => {
        if (err) {
          return reject(err);
        }
        resolve(hash.toString('hex'));
      });
    });

    // 更新密码和盐值
    await db.executeQuery(
      'UPDATE users SET password = ?, salt = ?, password_reset_required = 0, updated_at = NOW() WHERE id = ?',
      [newHashedPassword, newSalt, req.user.userId]
    );

    // 记录操作日志
    await db.executeQuery(
      'INSERT INTO operation_logs (user_id, username, action, ip_address, details) VALUES (?, ?, ?, ?, ?)',
      [
        req.user.userId,
        req.user.username,
        'change_password',
        req.ip,
        '修改密码'
      ]
    );

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 新增：会话心跳更新接口，用于维护用户活跃状态
router.post('/session/heartbeat', authenticate, async (req, res) => {
  try {
    // 获取当前用户的token
    const requestToken = req.headers.authorization?.replace('Bearer ', '') || req.headers.token;
    
    if (!requestToken) {
      return res.status(401).json({
        success: false,
        error: '未提供有效token'
      });
    }

    // 更新会话活跃时间，确保组织隔离
    const result = await db.executeQuery(
      'UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ? AND user_id = ? AND orgId = ? AND is_active = 1',
      [requestToken, req.user.userId, req.user.orgId]
    );

    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: '会话活跃时间已更新'
      });
    } else {
      // 会话可能已过期或不存在，但不影响用户操作
      res.json({
        success: true,
        message: '会话状态已同步'
      });
    }
  } catch (error) {
    console.error('更新会话心跳失败:', error);
    // 心跳失败不影响用户正常使用
    res.json({
      success: true,
      message: '会话状态已同步'
    });
  }
});

// 新增：会话登出接口，用于清理会话记录
router.post('/logout', authenticate, async (req, res) => {
  try {
    // 获取当前用户的token
    const requestToken = req.headers.authorization?.replace('Bearer ', '') || req.headers.token;
    
    if (requestToken) {
      // 标记会话为非活跃状态，确保组织隔离
      await db.executeQuery(
        'UPDATE user_sessions SET is_active = 0 WHERE session_token = ? AND user_id = ? AND orgId = ?',
        [requestToken, req.user.userId, req.user.orgId]
      );

      // 清除用户表中的当前token
      await db.executeQuery(
        'UPDATE users SET current_token = NULL, current_login_time = NULL WHERE id = ? AND orgId = ?',
        [req.user.userId, req.user.orgId]
      );
    }

    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出处理失败:', error);
    res.json({
      success: true,
      message: '登出成功'
    });
  }
});

module.exports = router;