// 云函数：用户认证
const cloud = require('wx-server-sdk');
const {
  AppError,
  ERROR_CODES,
  Logger,
  Validator,
  JWTUtils,
  PasswordUtils,
  DatabaseUtils,
  ResponseUtils,
  handleError,
  validateToken,
  checkPermission
} = require('./common/utils');
const { createRequestLogger } = require('./common/logger');
const { globalMonitoring } = require('./common/monitoring');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 用户登录云函数
 * @param {Object} event - 事件参数
 * @param {string} event.action - 操作类型：login, verify, logout, refresh, changePassword, resetPassword
 * @param {Object} event.data - 数据参数
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  // 设置请求ID用于日志追踪
  global.currentRequestId = context.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const { action, data } = event;
  const { OPENID } = cloud.getWXContext();
  
  // 创建请求日志记录器
  const logger = createRequestLogger({
    requestId: global.currentRequestId,
    action,
    openid: OPENID
  });
  
  logger.info('认证云函数调用', {
    action,
    requestId: global.currentRequestId,
    data: { ...data, password: data?.password ? '***' : undefined },
    event: { ...event, data: { ...event.data, password: event.data?.password ? '***' : undefined } }
  }, 'auth.main');
  
  // 启动性能追踪
  const performanceTracker = logger.startPerformanceTracking(`auth_${action}`, {
    action,
    hasData: !!data
  });
  
  try {
    // 参数验证
    if (!action) {
      throw new AppError(
        '缺少操作类型参数',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
    
    let result;
    switch (action) {
      case 'login':
        result = await handleLogin(data.orgId, data.username, data.password, OPENID);
        break;
      
      case 'verify':
        result = await verifyUserToken(data.token);
        break;
      
      case 'verify-token':
        // 兼容两种token传递方式：event.token 或 data.token
        const tokenToVerify = event.token || data.token;
        result = await handleVerifyToken(tokenToVerify, OPENID);
        break;
      
      case 'logout':
        result = await logout(data.token);
        break;
      
      case 'refresh':
        result = await handleTokenRefresh(data.token);
        break;
      
      case 'changePassword':
        result = await handlePasswordChange(data.token, data.oldPassword, data.newPassword);
        break;
      
      case 'resetPassword':
        result = await handlePasswordReset(data.username, data.orgId);
        break;
      
      default:
        throw new AppError(
          `不支持的操作类型: ${action}`,
          ERROR_CODES.INVALID_PARAMS,
          400
        );
    }
    
    const duration = Date.now() - startTime;
    logger.endPerformanceTracking(performanceTracker, { success: true });
    
    // 记录API请求日志
    logger.logApiRequest(event, result, duration);
    
    // 更新监控指标
    globalMonitoring.metrics.increment('auth_requests_total', 1, {
      action,
      status: 'success'
    });
    globalMonitoring.metrics.timing('auth_request_duration', duration, {
      action
    });
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.endPerformanceTracking(performanceTracker, { 
      success: false, 
      error: error.message 
    });
    
    // 更新监控指标
    globalMonitoring.metrics.increment('auth_requests_total', 1, {
      action,
      status: 'error'
    });
    globalMonitoring.metrics.increment('auth_errors_total', 1, {
      action,
      errorType: error.constructor.name
    });
    
    return handleError(error, 'auth.main');
  } finally {
    // 清理全局请求ID
    delete global.currentRequestId;
  }
}

/**
 * 处理用户登录
 */
async function handleLogin(orgId, username, password, openid) {
  const logger = createRequestLogger({
    requestId: global.currentRequestId,
    action: 'login',
    openid: openid
  });
  
  try {
    logger.info('用户登录请求', { orgId, username }, 'auth.handleLogin');
    
    // 参数验证
    Validator.validateRequired({ orgId, username, password }, ['orgId', 'username', 'password']);
    Validator.validateTypes({ orgId, username, password }, { orgId: 'string', username: 'string', password: 'string' });
    Validator.validateStringLength(
      { orgId, username, password },
      {
        orgId: { max: 50 },
        username: { max: 50 },
        password: { max: 100 }
      }
    );
    
    // 查询组织信息
    const orgQueryTracker = logger.startPerformanceTracking('database_org_query');
    const orgStartTime = Date.now();
    const orgResult = await db.collection('organizations')
      .where({
        orgId: orgId,
        status: 1
      })
      .get()
    
    const orgQueryDuration = Date.now() - orgStartTime;
    logger.endPerformanceTracking(orgQueryTracker);
    logger.logDatabaseOperation('find', 'organizations', { orgId, status: 1 }, orgResult, orgQueryDuration);
    
    if (orgResult.data.length === 0) {
      globalMonitoring.metrics.increment('login_failures_total', 1, {
        reason: 'org_not_found',
        orgId
      });
      
      throw new AppError(
        '组织编码、工号或密码错误',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }
    
    const organization = orgResult.data[0]
    
    // 查询用户信息
    const userQueryTracker = logger.startPerformanceTracking('database_user_query');
    const userStartTime = Date.now();
    const userResult = await db.collection('users')
      .where({
        username: username,
        orgId: orgId,
        status: 1
      })
      .get()
    
    const userQueryDuration = Date.now() - userStartTime;
    logger.endPerformanceTracking(userQueryTracker);
    logger.logDatabaseOperation('find', 'users', { username, orgId, status: 1 }, userResult, userQueryDuration);
    
    if (userResult.data.length === 0) {
      logger.warn('用户不存在', { orgId, username }, 'auth.handleLogin');
      
      globalMonitoring.metrics.increment('login_failures_total', 1, {
        reason: 'user_not_found',
        orgId
      });
      
      throw new AppError(
        '组织编码、工号或密码错误',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }
    
    const user = userResult.data[0]
    
    // 检查登录尝试次数
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOGIN_LOCKOUT_TIME = 15 * 60 * 1000; // 15分钟
    
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      const lockoutEndTime = user.lastFailedLogin ? new Date(user.lastFailedLogin.getTime() + LOGIN_LOCKOUT_TIME) : new Date();
      if (new Date() < lockoutEndTime) {
        const remainingTime = Math.ceil((lockoutEndTime - new Date()) / 60000);
        logger.warn('账户被锁定', { userId: user._id, username, remainingTime }, 'auth.handleLogin');
        
        globalMonitoring.metrics.increment('login_failures_total', 1, {
          reason: 'account_locked',
          orgId
        });
        
        throw new AppError(
          `账户已被锁定，请${remainingTime}分钟后重试`,
          ERROR_CODES.FORBIDDEN,
          403
        );
      } else {
        // 锁定时间已过，重置登录尝试次数
        await DatabaseUtils.safeUpdate(
          db.collection('users'),
          user._id,
          {
            loginAttempts: 0,
            lastFailedLogin: null
          }
        );
        user.loginAttempts = 0;
      }
    }
    
    // 验证密码强度（仅在首次登录或密码更新时）
    if (user.requirePasswordChange) {
      const strengthCheck = PasswordUtils.validatePasswordStrength(password);
      if (!strengthCheck.isValid) {
        logger.warn('密码强度不足', { userId: user._id, errors: strengthCheck.errors }, 'auth.handleLogin');
        throw new AppError(
          '密码强度不足，请更新密码',
          ERROR_CODES.INVALID_PARAMS,
          400
        );
      }
    }
    
    // 验证密码 - 统一使用pbkdf2+盐值格式
    const passwordTracker = logger.startPerformanceTracking('password_verification');
    const passwordMatch = PasswordUtils.verifyPassword(password, user.password, user.salt);
    logger.endPerformanceTracking(passwordTracker);
    
    if (!passwordMatch) {
      // 增加失败尝试次数
      const newAttempts = (user.loginAttempts || 0) + 1;
      await DatabaseUtils.safeUpdate(
        db.collection('users'),
        user._id,
        {
          loginAttempts: newAttempts,
          lastFailedLogin: new Date()
        }
      );
      
      logger.warn('密码验证失败', { 
        userId: user._id, 
        username, 
        attempts: newAttempts,
        maxAttempts: MAX_LOGIN_ATTEMPTS 
      }, 'auth.handleLogin');
      
      globalMonitoring.metrics.increment('login_failures_total', 1, {
        reason: 'invalid_password',
        orgId
      });
      
      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
      if (remainingAttempts > 0) {
        throw new AppError(
          `组织编码、工号或密码错误，还有${remainingAttempts}次尝试机会`,
          ERROR_CODES.UNAUTHORIZED,
          401
        );
      } else {
        throw new AppError(
          '登录失败次数过多，账户已被锁定',
          ERROR_CODES.FORBIDDEN,
          403
        );
      }
    }
    
    // 重置登录尝试次数（登录成功）
    if (user.loginAttempts > 0) {
      await DatabaseUtils.safeUpdate(
        db.collection('users'),
        user._id,
        {
          loginAttempts: 0,
          lastFailedLogin: null
        }
      );
    }
    
    // 生成会话令牌和刷新令牌
    const tokenPayload = {
      userId: user._id,
      username: user.username,
      orgId: user.orgId,
      roleId: user.roleId,
      isSuperAdmin: user.isSuperAdmin || false,
      orgName: organization.name
    };
    
    const accessToken = JWTUtils.generateToken(tokenPayload);
    const refreshToken = JWTUtils.generateRefreshToken(tokenPayload);
    
    // 创建用户会话
    await DatabaseUtils.safeAdd(db.collection('user_sessions'), {
      userId: user._id,
      username: user.username,
      orgId: user.orgId,
      openid: openid,
      accessToken: accessToken,
      refreshToken: refreshToken,
      platform: 'miniprogram',
      loginTime: new Date(),
      lastActivity: new Date(),
      isActive: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后过期
    });
    
    // 更新用户最后登录时间
    await DatabaseUtils.safeUpdate(
      db.collection('users'),
      user._id,
      {
        lastLogin: new Date(),
        currentToken: accessToken,
        currentLoginTime: new Date(),
        loginCount: (user.loginCount || 0) + 1
      }
    );
    
    logger.info('用户登录成功', { userId: user._id, username, orgId }, 'auth.handleLogin');
    
    // 记录成功登录指标
    globalMonitoring.metrics.increment('login_success_total', 1, {
      orgId,
      roleId: user.roleId
    });
    
    return ResponseUtils.success({
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7天（秒）
      tokenType: 'Bearer',
      userId: user._id,
      username: user.username,
      realName: user.realName,
      orgId: user.orgId,
      orgName: organization.name,
      roleId: user.roleId,
      isSuperAdmin: user.isSuperAdmin || false
    }, '登录成功');
    
  } catch (error) {
    return handleError(error, 'auth.handleLogin');
  }
}

/**
 * 处理令牌验证
 */
async function handleVerifyToken(token, openid) {
  if (!token) {
    return {
      success: false,
      error: '令牌不能为空'
    }
  }
  
  try {
    // 查询会话信息
    const sessionResult = await db.collection('user_sessions')
      .where({
        accessToken: token,
        openid: openid,
        isActive: true
      })
      .get()
    
    if (sessionResult.data.length === 0) {
      return {
        success: false,
        error: '会话已过期，请重新登录'
      }
    }
    
    const session = sessionResult.data[0]
    
    // 检查会话是否过期（7天）
    const now = new Date()
    const lastActivity = new Date(session.lastActivity)
    const diffHours = (now - lastActivity) / (1000 * 60 * 60)
    
    if (diffHours > 168) { // 7天 = 168小时
      // 会话过期，标记为非活跃
      await db.collection('user_sessions').doc(session._id).update({
        data: {
          isActive: false
        }
      })
      
      return {
        success: false,
        error: '会话已过期，请重新登录'
      }
    }
    
    // 更新最后活动时间
    await db.collection('user_sessions').doc(session._id).update({
      data: {
        lastActivity: now
      }
    })
    
    // 获取用户详细信息
    const userResult = await db.collection('users').doc(session.userId).get()
    
    if (!userResult.data || userResult.data.status !== 1) {
      return {
        success: false,
        error: '用户状态异常，请重新登录'
      }
    }
    
    const user = userResult.data
    
    return {
      success: true,
      data: {
        userId: user._id,
        username: user.username,
        realName: user.realName,
        orgId: user.orgId,
        roleId: user.roleId,
        isSuperAdmin: user.isSuperAdmin || false
      }
    }
    
  } catch (error) {
    console.error('令牌验证错误:', error)
    return {
      success: false,
      error: '令牌验证失败'
    }
  }
}

/**
 * 处理用户登出
 */
async function handleLogout(token, openid) {
  try {
    Logger.info('用户登出请求', { openid }, 'auth.handleLogout');
    
    if (!token) {
      throw new AppError(
        '缺少令牌参数',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
    
    // 验证Token（可能已过期，但仍需要处理登出）
    let decoded;
    try {
      decoded = JWTUtils.verifyToken(token);
    } catch (error) {
      // 如果令牌已过期或无效，尝试解码获取用户信息
      const decodedToken = JWTUtils.decodeToken(token);
      if (decodedToken && decodedToken.payload) {
        decoded = decodedToken.payload;
      } else {
        throw new AppError(
          '无效的令牌',
          ERROR_CODES.INVALID_TOKEN,
          401
        );
      }
    }
    
    // 撤销访问令牌
    JWTUtils.revokeToken(token);
    
    // 查找并撤销相关的刷新令牌
    const sessionResult = await db.collection('user_sessions')
      .where({
        userId: decoded.userId,
        accessToken: token,
        isActive: true
      })
      .get();
    
    if (sessionResult.data.length > 0) {
      const session = sessionResult.data[0];
      
      // 撤销刷新令牌
      if (session.refreshToken) {
        JWTUtils.revokeToken(session.refreshToken);
      }
      
      // 将会话标记为非活跃
      await DatabaseUtils.safeUpdate(
        db.collection('user_sessions'),
        session._id,
        {
          isActive: false,
          logoutTime: new Date(),
          logoutReason: 'user_logout'
        }
      );
    }
    
    // 更新用户最后登出时间
    await DatabaseUtils.safeUpdate(
      db.collection('users'),
      decoded.userId,
      {
        lastLogoutTime: new Date()
      }
    );
    
    Logger.info('用户登出成功', { 
      userId: decoded.userId,
      sessionId: decoded.sessionId 
    }, 'auth.handleLogout');
    
    return ResponseUtils.success(null, '登出成功');
    
  } catch (error) {
    return handleError(error, 'auth.handleLogout');
  }
}

/**
 * 验证Token
 * @param {string} token - JWT Token
 * @returns {Object} 验证结果
 */
async function verifyUserToken(token) {
  try {
    Logger.info('Token验证请求', null, 'auth.verifyUserToken');
    
    // 使用通用Token验证函数
    const tokenResult = await validateToken(token);
    const decoded = tokenResult.data;
    
    // 查询用户信息
    const userResult = await db.collection('users').doc(decoded.userId).get();
    
    if (!userResult.data) {
      throw new AppError(
        '用户不存在',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      );
    }
    
    const user = userResult.data;
    
    // 检查用户状态
    if (user.status !== 1) {
      throw new AppError(
        '用户已被禁用',
        ERROR_CODES.FORBIDDEN,
        403
      );
    }
    
    Logger.info('Token验证成功', { userId: user._id }, 'auth.verifyUserToken');
    
    return ResponseUtils.success({
      user: {
        id: user._id,
        username: user.username,
        realName: user.realName,
        role: user.role || 'user',
        status: user.status,
        permissions: user.permissions || [],
        orgId: user.orgId,
        roleId: user.roleId,
        isSuperAdmin: user.isSuperAdmin || false
      }
    }, 'Token验证成功');
    
  } catch (error) {
    return handleError(error, 'auth.verifyUserToken');
  }
}

/**
 * 用户登出
 * @param {string} token - JWT Token
 * @returns {Object} 登出结果
 */
async function logout(token) {
  try {
    Logger.info('用户登出请求', null, 'auth.logout');
    
    // 验证Token
    const tokenResult = await validateToken(token);
    const decoded = tokenResult.data;
    
    // 清除用户会话
    await db.collection('user_sessions').where({
      userId: decoded.userId,
      sessionToken: token,
      isActive: true
    }).update({
      data: {
        isActive: false,
        logoutTime: new Date(),
        updatedAt: new Date()
      }
    });
    
    // 更新用户最后登出时间
    await DatabaseUtils.safeUpdate(
      db.collection('users'),
      decoded.userId,
      {
        lastLogout: new Date(),
        currentToken: null
      }
    );
    
    Logger.info('用户登出成功', { userId: decoded.userId }, 'auth.logout');
    
    return ResponseUtils.success(null, '登出成功');
    
  } catch (error) {
    return handleError(error, 'auth.logout');
  }
}

/**
 * Token刷新
 * @param {string} refreshToken - 刷新令牌
 * @returns {Object} 刷新结果
 */
async function handleTokenRefresh(refreshToken) {
  try {
    Logger.info('开始刷新令牌', { 
      refreshToken: refreshToken ? refreshToken.substring(0, 20) + '...' : 'null' 
    }, 'auth.handleTokenRefresh');
    
    if (!refreshToken) {
      throw new AppError(
        '缺少刷新令牌参数',
        ERROR_CODES.INVALID_PARAMS,
        400
      );
    }
    
    // 验证并刷新令牌
    const tokenResult = JWTUtils.refreshToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = tokenResult;
    
    // 解码新令牌获取用户信息
    const decoded = JWTUtils.decodeToken(accessToken);
    if (!decoded || !decoded.payload) {
      throw new AppError(
        '令牌解码失败',
        ERROR_CODES.INTERNAL_ERROR,
        500
      );
    }
    
    const userId = decoded.payload.userId;
    
    // 更新数据库中的会话记录
    const sessionResult = await db.collection('user_sessions')
      .where({
        userId: userId,
        refreshToken: refreshToken,
        isActive: true
      })
      .get();
    
    if (sessionResult.data.length > 0) {
      const session = sessionResult.data[0];
      await DatabaseUtils.safeUpdate(
        db.collection('user_sessions'),
        session._id,
        {
          accessToken: accessToken,
          refreshToken: newRefreshToken,
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 更新过期时间
        }
      );
      
      // 更新用户最后活动时间
      await DatabaseUtils.safeUpdate(
        db.collection('users'),
        userId,
        {
          lastActivity: new Date()
        }
      );
    } else {
      Logger.warn('未找到对应的会话记录', { userId, refreshToken: refreshToken.substring(0, 20) + '...' }, 'auth.handleTokenRefresh');
    }
    
    Logger.info('令牌刷新成功', { userId }, 'auth.handleTokenRefresh');
    
    return ResponseUtils.success({
      accessToken: accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 7 * 24 * 60 * 60, // 7天（秒）
      tokenType: 'Bearer'
    }, '令牌刷新成功');
    
  } catch (error) {
    return handleError(error, 'auth.handleTokenRefresh');
  }
}

/**
 * 修改密码
 * @param {string} token - JWT Token
 * @param {string} oldPassword - 旧密码
 * @param {string} newPassword - 新密码
 * @returns {Object} 修改结果
 */
async function handlePasswordChange(token, oldPassword, newPassword) {
  try {
    Logger.info('密码修改请求', null, 'auth.handlePasswordChange');
    
    // 验证Token
    const tokenResult = await validateToken(token);
    const decoded = tokenResult.data;
    
    // 参数验证
    Validator.validateRequired({ oldPassword, newPassword }, ['oldPassword', 'newPassword']);
    Validator.validateStringLength(
      { oldPassword, newPassword },
      {
        oldPassword: { min: 6, max: 100 },
        newPassword: { min: 6, max: 100 }
      }
    );
    
    // 查询用户信息
    const userResult = await db.collection('users').doc(decoded.userId).get();
    
    if (!userResult.data) {
      throw new AppError(
        '用户不存在',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      );
    }
    
    const user = userResult.data;
    
    // 验证旧密码
    const isOldPasswordValid = PasswordUtils.verifyPassword(oldPassword, user.password, user.salt);
    
    if (!isOldPasswordValid) {
      throw new AppError(
        '原密码错误',
        ERROR_CODES.UNAUTHORIZED,
        401
      );
    }
    
    // 生成新的盐值和密码哈希
    const newSalt = PasswordUtils.generateSalt();
    const newPasswordHash = PasswordUtils.hashPassword(newPassword, newSalt);
    
    // 更新密码
    await DatabaseUtils.safeUpdate(
      db.collection('users'),
      decoded.userId,
      {
        password: newPasswordHash,
        salt: newSalt,
        passwordChangedAt: new Date()
      }
    );
    
    // 记录密码修改日志
    await db.collection('user_logs').add({
      data: {
        userId: decoded.userId,
        action: 'password_change',
        details: '用户主动修改密码',
        ipAddress: null, // 小程序环境无法获取IP
        userAgent: 'miniprogram',
        createdAt: new Date()
      }
    });
    
    Logger.info('密码修改成功', { userId: decoded.userId }, 'auth.handlePasswordChange');
    
    return ResponseUtils.success(null, '密码修改成功');
    
  } catch (error) {
    return handleError(error, 'auth.handlePasswordChange');
  }
}

/**
 * 重置密码
 * @param {string} username - 用户名
 * @param {string} orgId - 组织ID
 * @returns {Object} 重置结果
 */
async function handlePasswordReset(username, orgId) {
  try {
    Logger.info('密码重置请求', { username, orgId }, 'auth.handlePasswordReset');
    
    // 参数验证
    Validator.validateRequired({ username, orgId }, ['username', 'orgId']);
    
    // 查询用户
    const userResult = await db.collection('users').where({
      username: username,
      orgId: orgId,
      status: 1
    }).get();
    
    if (userResult.data.length === 0) {
      throw new AppError(
        '用户不存在',
        ERROR_CODES.RESOURCE_NOT_FOUND,
        404
      );
    }
    
    const user = userResult.data[0];
    
    // 生成临时密码
    const tempPassword = PasswordUtils.generateRandomPassword(8);
    const newSalt = PasswordUtils.generateSalt();
    const newPasswordHash = PasswordUtils.hashPassword(tempPassword, newSalt);
    
    // 更新密码
    await DatabaseUtils.safeUpdate(
      db.collection('users'),
      user._id,
      {
        password: newPasswordHash,
        salt: newSalt,
        passwordChangedAt: new Date(),
        isTemporaryPassword: true,
        mustChangePassword: true
      }
    );
    
    // 记录密码重置日志
    await db.collection('user_logs').add({
      data: {
        userId: user._id,
        action: 'password_reset',
        details: '管理员重置密码',
        ipAddress: null,
        userAgent: 'miniprogram',
        createdAt: new Date()
      }
    });
    
    Logger.info('密码重置成功', { userId: user._id }, 'auth.handlePasswordReset');
    
    return ResponseUtils.success({
      tempPassword: tempPassword,
      message: '密码已重置，请使用临时密码登录后立即修改密码'
    }, '密码重置成功');
    
  } catch (error) {
    return handleError(error, 'auth.handlePasswordReset');
  }
}