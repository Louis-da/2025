// routes/userRoutes.js
const express = require('express');
const router = express.Router();
// const bcrypt = require('bcrypt'); // 移除 bcrypt 依赖
const db = require('../db');
const { authenticate, isSuperAdmin, isOrgAdmin } = require('../middleware/auth');
const crypto = require('crypto'); // 引入 crypto 模块

// 中间件：验证权限
router.use(authenticate);

// 获取用户列表
router.get('/', async (req, res) => {
  try {
    // 构建查询条件
    let conditions = [];
    let params = [];
    let query = `
      SELECT 
        u.id, 
        u.username,
        u.real_name, 
        u.email, 
        u.phone, 
        u.orgId, 
        o.name as org_name, 
        u.role_id, 
        r.name as role_name,
        u.is_super_admin, 
        u.status, 
        u.miniprogram_authorized,
        u.last_login, 
        u.created_at,
        u.updated_at
      FROM users u 
      LEFT JOIN organizations o ON u.orgId = o.orgId
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    
    // 超级管理员可以查看所有用户
    // 老板只能查看自己组织的用户
    if (!req.user.isSuperAdmin) {
      conditions.push('u.orgId = ?');
      params.push(req.user.orgId);
    }
    
    // 应用筛选条件
    const { roleId, status, keyword } = req.query;
    const orgId = req.user.orgId; // 强制使用当前用户的组织ID
    
    if (orgId && req.user.isSuperAdmin) { // 只有超管可以筛选组织
      conditions.push('u.orgId = ?');
      params.push(orgId);
    }
    
    if (roleId) {
      conditions.push('u.role_id = ?');
      params.push(roleId);
    }
    
    if (status !== undefined) {
      conditions.push('u.status = ?');
      params.push(status);
    }
    
    if (keyword) {
      conditions.push('(u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    // 添加条件到查询
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // 添加排序和分页
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // 处理排序参数
    const orderBy = req.query.orderBy || 'u.created_at'; // 默认按创建时间排序
    const orderDirection = req.query.orderDirection || 'DESC'; // 默认降序
    
    // 允许排序的字段白名单，防止SQL注入
    const allowedOrderBy = ['u.created_at', 'u.orgId', 'o.name', 'u.username'];
    const allowedOrderDirection = ['ASC', 'DESC'];
    
    const safeOrderBy = allowedOrderBy.includes(orderBy) ? orderBy : 'u.created_at';
    const safeOrderDirection = allowedOrderDirection.includes(orderDirection.toUpperCase()) ? orderDirection.toUpperCase() : 'DESC';

    // 直接拼接排序和分页参数到SQL字符串
    query += ` ORDER BY ${safeOrderBy} ${safeOrderDirection} LIMIT ${offset}, ${limit}`;
    const queryParams = [...params];
    
    // 执行主查询
    const users = await db.executeQuery(query, queryParams);
    
    // 获取总记录数
    let countQuery = 'SELECT COUNT(*) as total FROM users u';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    const [totalResult] = await db.executeQuery(countQuery, params);
    
    // 格式化返回数据
    const formattedUsers = users.map(user => ({
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      email: user.email,
      phone: user.phone,
      orgId: user.orgId,
      orgName: user.org_name,
      roleId: user.role_id,
      roleName: user.role_name,
      isSuperAdmin: user.is_super_admin === 1,
      status: user.status,
      miniprogram_authorized: user.miniprogram_authorized === 1,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
    
    res.json({
      success: true,
      data: formattedUsers,
      pagination: {
        total: totalResult.total,
        page,
        limit,
        pages: Math.ceil(totalResult.total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '获取用户列表失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 创建用户
router.post('/', async (req, res) => {
  try {
    console.log('收到创建用户请求:', req.body);
    const { username, password, email, phone, orgId, roleId, miniprogram_authorized, status, real_name } = req.body;
    // 参数校验
    if (!username || typeof username !== 'string' || username.length > 50) {
      console.warn(`[USER_CREATE] 参数校验失败 username=${username}`);
      return res.status(400).json({ success: false, error: '用户名无效' });
    }
    if (!orgId || typeof orgId !== 'string' || orgId.length > 50) {
      console.warn(`[USER_CREATE] 参数校验失败 orgId=${orgId}`);
      return res.status(400).json({ success: false, error: '组织编码无效' });
    }
    if (!roleId || isNaN(Number(roleId))) {
      console.warn(`[USER_CREATE] 参数校验失败 roleId=${roleId}`);
      return res.status(400).json({ success: false, error: '角色无效' });
    }
    if (status !== undefined && ![0, 1].includes(Number(status))) {
      console.warn(`[USER_CREATE] 参数校验失败 status=${status}`);
      return res.status(400).json({ success: false, error: '状态参数无效' });
    }
    if (email && (typeof email !== 'string' || email.length > 100)) {
      console.warn(`[USER_CREATE] 参数校验失败 email=${email}`);
      return res.status(400).json({ success: false, error: '邮箱无效' });
    }
    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
      console.warn(`[USER_CREATE] 参数校验失败 phone=${phone}`);
      return res.status(400).json({ success: false, error: '电话无效' });
    }
    if (real_name && (typeof real_name !== 'string' || real_name.length > 50)) {
      console.warn(`[USER_CREATE] 参数校验失败 real_name=${real_name}`);
      return res.status(400).json({ success: false, error: '姓名无效' });
    }
    
    // 验证必填字段
    if (!username || !orgId || !roleId) {
      console.log('缺少必填字段:', { username, orgId, roleId });
      return res.status(400).json({ 
        success: false, 
        error: '用户名、组织和角色为必填项' 
      });
    }
    
    // 使用提供的密码或默认密码000000
    let userPassword = password;
    if (!userPassword) {
      userPassword = '000000';
      console.log('未提供密码，使用默认密码: 000000');
    }
    
    // 验证权限
    if (!req.user.isSuperAdmin && req.user.orgId != orgId) {
      return res.status(403).json({ 
        success: false, 
        error: '只能在自己的组织内创建用户' 
      });
    }
    
    // 非超级管理员不能创建超级管理员
    if (!req.user.isSuperAdmin && roleId == 1) {
      return res.status(403).json({ 
        success: false, 
        error: '无权创建超级管理员账户' 
      });
    }
    
    // 检查用户名是否已存在
    const [existingUser] = await db.executeQuery(
      'SELECT id FROM users WHERE username = ? AND orgId = ?',
      [username, orgId]
    );
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: '用户名已存在' 
      });
    }
    
    // 使用 crypto.pbkdf2 加密密码并生成盐值
    const iterations = 100000; // 和登录逻辑保持一致
    const keylen = 64;       // 和登录逻辑保持一致
    const digest = 'sha512'; // 和登录逻辑保持一致

    // 生成新的盐值
    const salt = await new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, salt) => {
        if (err) {
          return reject(err);
        }
        resolve(salt.toString('hex'));
      });
    });

    // 使用 pbkdf2 生成密码哈希
    const hashedPassword = await new Promise((resolve, reject) => {
      crypto.pbkdf2(userPassword, salt, iterations, keylen, digest, (err, hash) => {
        if (err) {
          return reject(err);
        }
        resolve(hash.toString('hex'));
      });
    });
    
    console.log('准备执行数据库插入...');
    
    // 创建用户
    const result = await db.executeQuery(
      `INSERT INTO users (
        username, 
        password,
        salt,
        email,
        phone,
        orgId,
        role_id,
        miniprogram_authorized,
        status,
        real_name,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        username,
        hashedPassword,
        salt,
        email || null,
        phone || null,
        orgId,
        roleId,
        miniprogram_authorized ? 1 : 0,
        status || 1,
        real_name || null
      ]
    );

    if (!result || !result.insertId) {
      console.error('用户创建失败:', result);
      return res.status(500).json({
        success: false,
        error: '用户创建失败'
      });
    }

    // 获取创建的用户信息
    const [newUser] = await db.executeQuery(
      `SELECT 
        u.id,
        u.username,
        u.real_name,
        u.email,
        u.phone,
        u.orgId,
        o.name as org_name,
        u.role_id,
        r.name as role_name,
        u.status,
        u.miniprogram_authorized,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN organizations o ON u.orgId = o.orgId
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?`,
      [result.insertId]
    );
    
    res.json({
      success: true, 
      data: {
        id: newUser.id,
        username: newUser.username,
        real_name: newUser.real_name,
        email: newUser.email,
        phone: newUser.phone,
        orgId: newUser.orgId,
        orgName: newUser.org_name,
        roleId: newUser.role_id,
        roleName: newUser.role_name,
        status: newUser.status,
        miniprogram_authorized: newUser.miniprogram_authorized === 1,
        createdAt: newUser.created_at,
        updatedAt: newUser.updated_at
      }
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误: ' + error.message
    });
  }
});

// 更新用户
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, phone, roleId, role_id, status, orgId, real_name } = req.body;
    
    // 🔧 修复：兼容前端发送的 role_id 和 roleId 两种字段名
    const finalRoleId = roleId || role_id;
    
    // 🔧 调试日志：记录接收到的角色更新请求
    console.log(`[USER_UPDATE] 用户 ${id} 更新请求:`, {
      originalRoleId: roleId,
      role_id: role_id,
      finalRoleId: finalRoleId,
      username: username,
      real_name: real_name,
      requestBody: req.body
    });
    
    // 参数校验
    if (username && (typeof username !== 'string' || username.length > 50)) {
      console.warn(`[USER_UPDATE] 参数校验失败 username=${username}`);
      return res.status(400).json({ success: false, error: '用户名无效' });
    }
    if (orgId && (typeof orgId !== 'string' || orgId.length > 50)) {
      console.warn(`[USER_UPDATE] 参数校验失败 orgId=${orgId}`);
      return res.status(400).json({ success: false, error: '组织编码无效' });
    }
    if (finalRoleId && isNaN(Number(finalRoleId))) {
      console.warn(`[USER_UPDATE] 参数校验失败 roleId=${finalRoleId}`);
      return res.status(400).json({ success: false, error: '角色无效' });
    }
    if (status !== undefined && ![0, 1].includes(Number(status))) {
      console.warn(`[USER_UPDATE] 参数校验失败 status=${status}`);
      return res.status(400).json({ success: false, error: '状态参数无效' });
    }
    if (email && (typeof email !== 'string' || email.length > 100)) {
      console.warn(`[USER_UPDATE] 参数校验失败 email=${email}`);
      return res.status(400).json({ success: false, error: '邮箱无效' });
    }
    if (phone && (typeof phone !== 'string' || phone.length > 20)) {
      console.warn(`[USER_UPDATE] 参数校验失败 phone=${phone}`);
      return res.status(400).json({ success: false, error: '电话无效' });
    }
    if (real_name && (typeof real_name !== 'string' || real_name.length > 50)) {
      console.warn(`[USER_UPDATE] 参数校验失败 real_name=${real_name}`);
      return res.status(400).json({ success: false, error: '姓名无效' });
    }
    
    // 查询用户
    const [user] = await db.executeQuery('SELECT * FROM users WHERE id = ?', [id]);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    // 验证权限
    if (!req.user.isSuperAdmin && req.user.orgId != user.orgId) {
      console.warn(`[PERMISSION_DENIED] user=${req.user.username}, action=update_user, targetUserId=${id}, ip=${req.ip}`);
      return res.status(403).json({ success: false, error: '只能管理自己组织内的用户' });
    }
    
    // 不能修改超级管理员（除非自己也是超级管理员）
    if (user.is_super_admin == 1 && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: '无权修改超级管理员账户' });
    }
    
    // 不能将普通账户提升为超级管理员（除非自己是超级管理员）
    if (finalRoleId == 1 && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: '无权将用户提升为超级管理员' });
    }
    
    // 用户名唯一性校验（如有修改）
    let newUsername = username ?? user.username;
    let newOrgId = orgId ?? user.orgId;
    if (newUsername !== user.username || newOrgId !== user.orgId) {
      const [existUser] = await db.executeQuery('SELECT id FROM users WHERE username = ? AND orgId = ? AND id != ?', [newUsername, newOrgId, id]);
      if (existUser) {
        return res.status(400).json({ success: false, error: '用户名已存在' });
      }
    }

    // 处理可能为undefined的值
    const emailValue = email === undefined ? user.email : (email || null);
    const phoneValue = phone === undefined ? user.phone : (phone || null);
    const roleIdValue = finalRoleId === undefined ? user.role_id : (finalRoleId || null);
    const statusValue = status === undefined ? user.status : (status || 0);
    const realNameValue = real_name === undefined ? user.real_name : (real_name || null);
    
    // 🔧 调试日志：记录处理后的值
    console.log(`[USER_UPDATE] 处理后的更新值:`, {
      userId: id,
      originalRole: user.role_id,
      newRole: roleIdValue,
      roleChanged: user.role_id !== roleIdValue,
      username: newUsername,
      realName: realNameValue
    });
    
    // 超级管理员可以修改 orgId，老板不能
    if (req.user.isSuperAdmin) {
      await db.executeQuery(
        'UPDATE users SET username = ?, email = ?, phone = ?, role_id = ?, status = ?, orgId = ?, real_name = ?, updated_at = NOW() WHERE id = ?',
        [newUsername, emailValue, phoneValue, roleIdValue, statusValue, newOrgId, realNameValue, id]
      );
    } else {
      await db.executeQuery(
        'UPDATE users SET username = ?, email = ?, phone = ?, role_id = ?, status = ?, real_name = ?, updated_at = NOW() WHERE id = ?',
        [newUsername, emailValue, phoneValue, roleIdValue, statusValue, realNameValue, id]
      );
    }
    
    // 如果角色变更为超级管理员，更新is_super_admin字段
    if (finalRoleId == 1) {
      await db.executeQuery('UPDATE users SET is_super_admin = 1 WHERE id = ?', [id]);
    } else if (user.role_id == 1 && finalRoleId != 1) {
      await db.executeQuery('UPDATE users SET is_super_admin = 0 WHERE id = ?', [id]);
    }
    
    // 🔧 调试日志：记录更新完成
    console.log(`[USER_UPDATE] 用户 ${id} 更新完成:`, {
      success: true,
      updatedFields: {
        username: newUsername !== user.username ? `${user.username} -> ${newUsername}` : '未变更',
        real_name: realNameValue !== user.real_name ? `${user.real_name} -> ${realNameValue}` : '未变更',
        role_id: roleIdValue !== user.role_id ? `${user.role_id} -> ${roleIdValue}` : '未变更'
      }
    });
    
    // 记录操作日志
    await db.executeQuery(
      'INSERT INTO operation_logs (user_id, username, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.userId, 
        req.user.username, 
        'update_user', 
        'user', 
        id, 
        `更新用户: ${user.username}${roleIdValue !== user.role_id ? ` 角色: ${user.role_id}->${roleIdValue}` : ''}`, 
        req.ip
      ]
    );
    
    res.json({ 
      success: true, 
      message: '用户更新成功'
    });
  } catch (error) {
    console.error('更新用户失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误: ' + error.message
    });
  }
});

// 重置用户密码
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    // 获取目标用户信息
    const [user] = await db.executeQuery('SELECT * FROM users WHERE id = ?', [id]);
    
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    
    // 权限验证：只能重置同组织的用户密码
    if (!req.user.isSuperAdmin && req.user.orgId !== user.orgId) {
      console.warn(`[PERMISSION_DENIED] user=${req.user.username}, action=reset_password, targetUserId=${id}, ip=${req.ip}`);
      return res.status(403).json({ success: false, error: '只能重置同组织用户的密码' });
    }
    
    // 验证操作权限：老板可以重置员工密码，超管可以重置所有人密码
    if (!req.user.isSuperAdmin && req.user.roleId !== 2) {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }
    
    // 不能重置超级管理员密码（除非自己也是超级管理员）
    if (user.is_super_admin === 1 && !req.user.isSuperAdmin) {
      return res.status(403).json({ success: false, error: '无权重置超级管理员密码' });
    }
    
    // 生成新密码（如果没有提供，则重置为默认密码）
    const defaultPassword = newPassword || '123456';
    
    // 使用与创建用户相同的加密方式
    const iterations = 100000;
    const keylen = 64;
    const digest = 'sha512';
    const crypto = require('crypto');

    // 生成新的盐值
    const salt = await new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, salt) => {
        if (err) {
          return reject(err);
        }
        resolve(salt.toString('hex'));
      });
    });

    // 使用 pbkdf2 生成密码哈希
    const hashedPassword = await new Promise((resolve, reject) => {
      crypto.pbkdf2(defaultPassword, salt, iterations, keylen, digest, (err, hash) => {
        if (err) {
          return reject(err);
        }
        resolve(hash.toString('hex'));
      });
    });
    
    // 更新密码并标记需要重置
    await db.executeQuery(
      'UPDATE users SET password = ?, salt = ?, password_reset_required = 1, updated_at = NOW() WHERE id = ?',
      [hashedPassword, salt, id]
    );
    
    // 记录操作日志
    await db.executeQuery(
      'INSERT INTO operation_logs (user_id, username, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.userId, 
        req.user.username, 
        'reset_password', 
        'user', 
        id, 
        `重置用户密码: ${user.username}`, 
        req.ip
      ]
    );
    
    console.log(`[RESET_PASSWORD] operator=${req.user.username}, target=${user.username}, action=reset_to_default`);
    
    res.json({ 
      success: true, 
      message: '密码重置成功',
      data: {
        defaultPassword: defaultPassword,
        requiresReset: true
      }
    });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误: ' + error.message
    });
  }
});

module.exports = router;