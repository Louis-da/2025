const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// 默认角色数据
const defaultRoles = [
  { id: 1, name: '超级管理员', description: '系统超级管理员，拥有所有权限' },
  { id: 2, name: '老板', description: '组织内的老板，可以管理组织内的用户和数据' },
  { id: 3, name: '员工', description: '员工，只能查看和操作被授权的功能' },
  { id: 4, name: '专员', description: '专员角色，只能查看自己制单的发出单和收回单' }
];

// 中间件：验证权限
router.use(authenticate);

// 获取角色列表
router.get('/', async (req, res) => {
  try {
    console.log('获取角色列表...');
    const roles = await db.executeQuery(
      'SELECT id, name, description, created_at, updated_at FROM roles ORDER BY id ASC'
    );
    
    // 如果数据库中没有数据，返回默认角色
    if (!roles || roles.length === 0) {
      console.log('使用默认角色数据');
      return res.json({
        success: true,
        data: defaultRoles
      });
    }
    
    console.log('从数据库获取到角色数据:', roles.length, '条记录');
    res.json({
      success: true,
      data: roles.map(role => {
        let name = role.name;
        let description = role.description;
        if (role.id === 2) {
          name = '老板';
          description = '组织内的老板，可以管理组织内的用户和数据';
        } else if (role.id === 3) {
          name = '员工';
          description = '员工，只能查看和操作被授权的功能';
        }
        return {
          id: role.id,
          name,
          description,
          createdAt: role.created_at,
          updatedAt: role.updated_at
        };
      })
    });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    // 发生错误时返回默认角色数据
    res.json({ 
      success: true, 
      data: defaultRoles,
      isDefault: true
    });
  }
});

module.exports = router; 