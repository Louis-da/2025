// routes/orgRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, isSuperAdmin } = require('../middleware/auth');
// 导入 Node.js 内置的 crypto 模块
const crypto = require('crypto');

// 尝试导入bcrypt，如果失败则提供错误处理
// let bcrypt;
// try {
//   bcrypt = require('bcrypt');
// } catch (err) {
//   console.error('缺少bcrypt依赖，请运行: npm install bcrypt');
//   bcrypt = {
//     hash: async (data) => {
//       console.warn('使用原始密码替代bcrypt加密');
//       return data;
//     }
//   };
// }

// 中间件：验证权限
router.use(authenticate);

// 获取组织列表
router.get('/', async (req, res) => {
  try {
    // 非超级管理员只能查看自己的组织
    let query = 'SELECT * FROM organizations WHERE 1=1';
    let params = [];
    
    if (!req.user.isSuperAdmin) {
      query += ' AND orgId = ?';
      params.push(req.user.orgId);
    }
    
    // 添加排序
    query += ' ORDER BY created_at DESC';
    
    const orgs = await db.executeQuery(query, params);
    
    res.json({ success: true, data: orgs });
  } catch (error) {
    console.error('获取组织列表失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 创建组织（仅超级管理员）
router.post('/', isSuperAdmin, async (req, res) => {
  let connection;
  try {
    const { orgId, name, contact, phone, email, address, status } = req.body;
    // 参数校验
    if (!orgId || typeof orgId !== 'string' || orgId.length > 50) {
      console.warn(`[ORG_CREATE] 参数校验失败 orgId=${orgId}`);
      return res.status(400).json({ success: false, error: '组织编码无效' });
    }
    if (!name || typeof name !== 'string' || name.length > 100) {
      console.warn(`[ORG_CREATE] 参数校验失败 name=${name}`);
      return res.status(400).json({ success: false, error: '组织名称无效' });
    }
    if (status !== undefined && ![0, 1].includes(Number(status))) {
      console.warn(`[ORG_CREATE] 参数校验失败 status=${status}`);
      return res.status(400).json({ success: false, error: '状态参数无效' });
    }
    // 获取数据库连接
    connection = await db.getConnection();
    await connection.beginTransaction();
    // 唯一性校验
    const [orgIdExists] = await connection.query('SELECT id FROM organizations WHERE orgId = ?', [orgId]);
    if (orgIdExists[0]) {
      await connection.rollback();
      console.warn(`[ORG_CREATE] 组织编码已存在 orgId=${orgId}`);
      return res.status(400).json({ success: false, error: '组织编码已存在' });
    }
    const [orgNameExists] = await connection.query('SELECT id FROM organizations WHERE name = ?', [name]);
    if (orgNameExists[0]) {
      await connection.rollback();
      console.warn(`[ORG_CREATE] 组织名称已存在 name=${name}`);
      return res.status(400).json({ success: false, error: '组织名称已存在' });
    }
    
    // 检查老板和员工角色是否存在
    let bossRoleId = 2; // 老板角色ID
    let employeeRoleId = 3; // 员工角色ID
    
    const [bossRoleExists] = await connection.query(
      'SELECT id FROM roles WHERE id = ?', 
      [bossRoleId]
    );
    const [employeeRoleExists] = await connection.query(
      'SELECT id FROM roles WHERE id = ?', 
      [employeeRoleId]
    );
    
    if (!bossRoleExists[0] || !employeeRoleExists[0]) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        error: '系统中缺少必要的角色定义（老板或员工角色），无法创建用户'
      });
    }
    
    // 创建组织
    const [orgResult] = await connection.query(
      `INSERT INTO organizations (
        orgId, name, contact, phone, email, address, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        orgId,
        name,
        contact ?? null,
        phone ?? null,
        email ?? null,
        address ?? null,
        status ?? 1
      ]
    );
    
    const orgDbId = orgResult.insertId;
    
    // 生成密码哈希和 salt (使用 crypto)
    const defaultPassword = '000000';
    const salt = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await new Promise((resolve, reject) => {
      crypto.pbkdf2(defaultPassword, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });

    // 生成6位数工号
    function generate6DigitId() {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    // 确保工号唯一性的函数
    async function generateUniqueUsername(baseId, maxAttempts = 10) {
      for (let i = 0; i < maxAttempts; i++) {
        const username = baseId || generate6DigitId();
        const [existing] = await connection.query(
          'SELECT id FROM users WHERE username = ?', 
          [username]
        );
        if (!existing[0]) {
          return username;
        }
        baseId = null; // 第一次之后使用随机生成
      }
      throw new Error('无法生成唯一工号');
    }
    
    // 生成老板工号和员工工号
    const bossUsername = await generateUniqueUsername();
    const employeeUsername = await generateUniqueUsername();
    
    // 创建老板角色用户
    const [bossUserResult] = await connection.query(
      `INSERT INTO users (
        username, 
        password,
        salt,
        orgId,
        role_id,
        real_name,
        miniprogram_authorized,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        bossUsername,
        hashedPassword,
        salt,
        orgId,
        bossRoleId,
        '老板',
        1,
        1
      ]
    );
    
    // 创建员工角色用户
    const [employeeUserResult] = await connection.query(
      `INSERT INTO users (
        username, 
        password,
        salt,
        orgId,
        role_id,
        real_name,
        miniprogram_authorized,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        employeeUsername,
        hashedPassword,
        salt,
        orgId,
        employeeRoleId,
        '员工',
        1,
        1
      ]
    );
    
    // 记录操作日志
    await connection.query(
      'INSERT INTO operation_logs (user_id, username, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.userId, 
        req.user.username, 
        'create_organization', 
        'organization', 
        orgDbId, 
        `创建组织: ${name}，并自动生成老板工号${bossUsername}和员工工号${employeeUsername}`, 
        req.ip
      ]
    );
    
    // 提交事务
    await connection.commit();
    
    res.status(201).json({ 
      success: true, 
      message: `组织创建成功，已自动生成老板工号${bossUsername}和员工工号${employeeUsername}`,
      data: {
        id: orgDbId,
        orgId,
        name,
        default_users: [
          {
            username: bossUsername,
            role: '老板',
            password: '000000'
          },
          {
            username: employeeUsername,
            role: '员工',
            password: '000000'
          }
        ]
      }
    });
  } catch (error) {
    // 回滚事务
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('事务回滚失败:', rollbackError);
      }
    }
    
    console.error('创建组织失败:', error);
    
    // 提供更详细的错误信息
    let errorMessage = '服务器内部错误';
    if (error.code) {
      switch(error.code) {
        case 'ER_DUP_ENTRY':
          errorMessage = '创建失败：存在重复数据';
          break;
        case 'ER_NO_REFERENCED_ROW':
        case 'ER_NO_REFERENCED_ROW_2':
          errorMessage = '创建失败：关联数据不存在';
          break;
        default:
          errorMessage = `服务器内部错误 (${error.code})`;
      }
    }
    
    res.status(500).json({ success: false, error: errorMessage });
  } finally {
    // 释放连接
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('释放数据库连接失败:', releaseError);
      }
    }
  }
});

// 获取组织详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 非超级管理员只能查看自己的组织
    if (!req.user.isSuperAdmin && req.user.orgId != id) {
      return res.status(403).json({ success: false, error: '没有权限查看此组织' });
    }
    
    const [org] = await db.executeQuery('SELECT * FROM organizations WHERE id = ?', [id]);
    
    if (!org) {
      return res.status(404).json({ success: false, error: '组织不存在' });
    }
    
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('获取组织详情失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 更新组织
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId, name, contact, phone, email, address, status } = req.body;
    // 参数校验
    if (orgId && (typeof orgId !== 'string' || orgId.length > 50)) {
      console.warn(`[ORG_UPDATE] 参数校验失败 orgId=${orgId}`);
      return res.status(400).json({ success: false, error: '组织编码无效' });
    }
    if (name && (typeof name !== 'string' || name.length > 100)) {
      console.warn(`[ORG_UPDATE] 参数校验失败 name=${name}`);
      return res.status(400).json({ success: false, error: '组织名称无效' });
    }
    if (status !== undefined && ![0, 1].includes(Number(status))) {
      console.warn(`[ORG_UPDATE] 参数校验失败 status=${status}`);
      return res.status(400).json({ success: false, error: '状态参数无效' });
    }
    // 查询组织
    const [org] = await db.executeQuery('SELECT * FROM organizations WHERE id = ?', [id]);
    if (!org) {
      console.warn(`[ORG_UPDATE] 组织不存在 id=${id}`);
      return res.status(404).json({ success: false, error: '组织不存在' });
    }
    // 唯一性校验（排除自身）
    if (orgId && orgId !== org.orgId) {
      const orgIdExists = await db.executeQuery('SELECT id FROM organizations WHERE orgId = ? AND id != ?', [orgId, id]);
      if (orgIdExists && orgIdExists[0]) {
        console.warn(`[ORG_UPDATE] 组织编码已存在 orgId=${orgId}`);
        return res.status(400).json({ success: false, error: '组织编码已存在' });
      }
    }
    if (name && name !== org.name) {
      const orgNameExists = await db.executeQuery('SELECT id FROM organizations WHERE name = ? AND id != ?', [name, id]);
      if (orgNameExists && orgNameExists[0]) {
        console.warn(`[ORG_UPDATE] 组织名称已存在 name=${name}`);
        return res.status(400).json({ success: false, error: '组织名称已存在' });
      }
    }
    // 更新组织
    await db.executeQuery(
      'UPDATE organizations SET orgId = ?, name = ?, contact = ?, phone = ?, email = ?, address = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [
        orgId ?? org.orgId,
        name ?? org.name,
        contact ?? org.contact,
        phone ?? org.phone,
        email ?? org.email,
        address ?? org.address,
        status ?? org.status,
        id
      ]
    );
    
    // 记录操作日志
    await db.executeQuery(
      'INSERT INTO operation_logs (user_id, username, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.userId, 
        req.user.username, 
        'update_organization', 
        'organization', 
        id, 
        `更新组织: ${org.name}`, 
        req.ip
      ]
    );
    
    res.json({ 
      success: true, 
      message: '组织更新成功'
    });
  } catch (error) {
    console.error('更新组织失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

// 更改组织状态（启用/禁用）
router.patch('/:id/status', isSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (status === undefined) {
      return res.status(400).json({ success: false, error: '状态为必填项' });
    }
    
    // 查询组织
    const [org] = await db.executeQuery('SELECT * FROM organizations WHERE id = ?', [id]);
    
    if (!org) {
      return res.status(404).json({ success: false, error: '组织不存在' });
    }
    
    // 更新状态
    await db.executeQuery('UPDATE organizations SET status = ?, updated_at = NOW() WHERE id = ?', [status, id]);
    
    // 记录操作日志
    await db.executeQuery(
      'INSERT INTO operation_logs (user_id, username, action, target_type, target_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.userId, 
        req.user.username, 
        status ? 'enable_organization' : 'disable_organization', 
        'organization', 
        id, 
        `${status ? '启用' : '禁用'}组织: ${org.name}`, 
        req.ip
      ]
    );
    
    res.json({ 
      success: true, 
      message: `组织${status ? '启用' : '禁用'}成功`
    });
  } catch (error) {
    console.error('更改组织状态失败:', error);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
});

module.exports = router; 