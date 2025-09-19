// 云函数入口文件
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const JWT_SECRET = 'yunsf-jwt-secret-2024' // 生产环境应使用环境变量

// 云函数入口函数
exports.main = async (event, context) => {
  const { action, username, password, code, token, orgCode } = event
  
  try {
    switch (action) {
      case 'login':
        return await handleLogin(username, password, orgCode)
      case 'wxLogin':
        return await handleWxLogin(code)
      case 'logout':
        return await handleLogout(context.OPENID)
      case 'verifyToken':
        return await verifyToken(token)
      case 'test':
        return await testAuth(event)
      case 'createTestUser':
        return await createTestUser(event)
      default:
        return {
          success: false,
          error: '不支持的操作类型'
        }
    }
  } catch (error) {
    console.error('登录云函数错误:', error)
    return {
      success: false,
      error: error.message || '服务器内部错误'
    }
  }
}

// 处理用户名密码登录
async function handleLogin(username, password, orgCode) {
  if (!username || !password || !orgCode) {
    return {
      success: false,
      error: '组织编码、工号或密码不能为空'
    }
  }

  try {
    // 查询组织信息（兼容多种字段与状态值）
    const _ = db.command
    const orgResult = await db.collection('organizations')
      .where(
        _.and([
          _.or([
            { code: orgCode },
            { orgCode: orgCode },
            { orgId: orgCode }
          ]),
          _.or([
            { status: 'active' },
            { status: 1 }
          ])
        ])
      )
      .limit(1)
      .get()

    if (orgResult.data.length === 0) {
      return {
        success: false,
        error: '组织编码、工号或密码错误'
      }
    }

    const organization = orgResult.data[0]

    // 查询用户信息（限定组织，兼容 org_id/orgId 与状态）
    const userResult = await db.collection('users')
      .where(
        _.and([
          { username: username },
          _.or([
            { status: 'active' },
            { status: 1 }
          ]),
          _.or([
            { org_id: organization._id },
            { orgId: organization._id }
          ])
        ])
      )
      .limit(1)
      .get()

    if (userResult.data.length === 0) {
      return {
        success: false,
        error: '组织编码、工号或密码错误'
      }
    }

    const user = userResult.data[0]
    
    // 验证密码（兼容 bcrypt 与历史 PBKDF2 存储）
    let isPasswordValid = false
    try {
      isPasswordValid = await bcrypt.compare(password, user.password)
    } catch (e) {
      // 忽略 bcrypt 内部异常，走回退校验
    }

    // 回退：若 bcrypt 未通过，尝试 PBKDF2（历史方案）
    if (!isPasswordValid && user.salt && typeof user.password === 'string') {
      try {
        const iterations = 100000
        const keylen = 64
        const digest = 'sha512'
        const pbkdf2Hash = await new Promise((resolve, reject) => {
          crypto.pbkdf2(password, user.salt, iterations, keylen, digest, (err, hash) => {
            if (err) return reject(err)
            resolve(hash.toString('hex'))
          })
        })
        isPasswordValid = pbkdf2Hash === user.password
      } catch (e) {
        // 忽略回退异常
      }
    }
    
    if (!isPasswordValid) {
      return {
        success: false,
        error: '组织编码、工号或密码错误'
      }
    }

    // 生成JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        orgId: user.org_id || user.orgId || organization._id,
        roleId: user.role_id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 更新最后登录时间
    await db.collection('users')
      .doc(user._id)
      .update({
        data: {
          last_login: new Date(),
          updated_at: new Date()
        }
      })

    // 记录登录日志
    await db.collection('login_attempts').add({
      data: {
        user_id: user._id,
        username: username,
        org_id: organization._id,
        success: true,
        ip_address: '', // 云函数中无法直接获取IP
        user_agent: '',
        created_at: new Date()
      }
    })

    return {
      success: true,
      data: {
        token: token,
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          orgId: user.org_id || user.orgId || organization._id,
          roleId: user.role_id,
          avatar: user.avatar
        }
      }
    }
  } catch (error) {
    console.error('登录处理错误:', error)
    return {
      success: false,
      error: '登录失败，请稍后重试'
    }
  }
}

// 处理微信登录
async function handleWxLogin(code) {
  if (!code) {
    return {
      success: false,
      error: '微信授权码不能为空'
    }
  }

  try {
    // 获取微信用户信息
    const { OPENID, UNIONID } = cloud.getWXContext()
    
    // 查找或创建用户
    let userResult = await db.collection('users')
      .where({
        openid: OPENID
      })
      .get()

    let user
    if (userResult.data.length === 0) {
      // 创建新用户
      const newUser = {
        openid: OPENID,
        unionid: UNIONID,
        username: `wx_${OPENID.slice(-8)}`,
        name: '微信用户',
        status: 'active',
        org_id: null, // 需要管理员分配组织
        role_id: null, // 需要管理员分配角色
        created_at: new Date(),
        updated_at: new Date()
      }
      
      const addResult = await db.collection('users').add({
        data: newUser
      })
      
      user = {
        _id: addResult._id,
        ...newUser
      }
    } else {
      user = userResult.data[0]
    }

    // 生成JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        orgId: user.org_id,
        roleId: user.role_id,
        openid: OPENID
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 更新最后登录时间
    await db.collection('users')
      .doc(user._id)
      .update({
        data: {
          last_login: new Date(),
          updated_at: new Date()
        }
      })

    return {
      success: true,
      data: {
        token: token,
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          orgId: user.org_id,
          roleId: user.role_id,
          avatar: user.avatar,
          openid: OPENID
        }
      }
    }
  } catch (error) {
    console.error('微信登录错误:', error)
    return {
      success: false,
      error: '微信登录失败，请稍后重试'
    }
  }
}

// 处理登出
async function handleLogout(openid) {
  try {
    // 可以在这里添加登出日志记录
    return {
      success: true,
      message: '登出成功'
    }
  } catch (error) {
    console.error('登出错误:', error)
    return {
      success: false,
      error: '登出失败'
    }
  }
}

// 验证token
async function verifyToken(token) {
  if (!token) {
    return {
      success: false,
      error: 'Token不能为空'
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    
    // 查询用户是否仍然有效
    const userResult = await db.collection('users')
      .doc(decoded.userId)
      .get()

    if (!userResult.data || userResult.data.status !== 'active') {
      return {
        success: false,
        error: '用户已被禁用'
      }
    }

    return {
      success: true,
      data: {
        userId: decoded.userId,
        username: decoded.username,
        orgId: decoded.orgId,
        roleId: decoded.roleId
      }
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        success: false,
        error: 'token_expired',
        message: 'Token已过期'
      }
    } else if (error.name === 'JsonWebTokenError') {
      return {
        success: false,
        error: 'token_invalid',
        message: 'Token无效'
      }
    }
    
    console.error('Token验证错误:', error)
    return {
      success: false,
      error: 'Token验证失败'
    }
  }
}

// 测试认证系统
async function testAuth(params) {
  try {
    const { message = 'Auth system test' } = params
    
    // 测试数据库连接
    const usersCount = await db.collection('users').count()
    
    // 测试JWT功能
    const testToken = jwt.sign(
      {
        userId: 'test_user_id',
        username: 'test_user',
        orgId: 'test_org',
        roleId: 'test_role'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    )
    
    const verifyResult = jwt.verify(testToken, JWT_SECRET)
    
    return {
      success: true,
      data: {
        message: message,
        timestamp: new Date().toISOString(),
        cloudFunction: 'login',
        environment: cloud.DYNAMIC_CURRENT_ENV || 'unknown',
        databaseConnection: 'success',
        usersCount: usersCount.total,
        jwtTest: 'success',
        testTokenPayload: verifyResult
      }
    }
  } catch (error) {
    console.error('认证系统测试失败:', error)
    return {
      success: false,
      error: error.message,
      details: {
        timestamp: new Date().toISOString(),
        cloudFunction: 'login',
        environment: cloud.DYNAMIC_CURRENT_ENV || 'unknown'
      }
    }
  }
}

// 创建测试用户
async function createTestUser(params) {
  try {
    const {
      username = 'test_user',
      password = 'test123456',
      name = '测试用户',
      email = 'test@example.com',
      organizationId = 'test_org_001'
    } = params
    
    // 检查用户是否已存在
    const existingUser = await db.collection('users')
      .where({
        username: username
      })
      .get()
    
    if (existingUser.data.length > 0) {
      return {
        success: false,
        error: '测试用户已存在',
        data: {
          existingUser: existingUser.data[0]._id
        }
      }
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // 创建测试用户
    const userData = {
      username: username,
      password: hashedPassword,
      name: name,
      email: email,
      organizationId: organizationId,
      role: 'user',
      status: 'active',
      isTestUser: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    const result = await db.collection('users').add({
      data: userData
    })
    
    // 生成测试token
    const testToken = jwt.sign(
      {
        userId: result._id,
        username: username,
        organizationId: organizationId,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    )
    
    return {
      success: true,
      data: {
        message: '测试用户创建成功',
        userId: result._id,
        username: username,
        testToken: testToken,
        loginCredentials: {
          username: username,
          password: password
        }
      }
    }
  } catch (error) {
    console.error('创建测试用户失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}