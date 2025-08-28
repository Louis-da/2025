/**
 * 组织数据安全验证工具
 * 确保数据隔离和组织访问控制
 */

class OrgSecurityError extends Error {
  constructor(message, code = 'ORG_ACCESS_DENIED') {
    super(message);
    this.name = 'OrgSecurityError';
    this.code = code;
  }
}

/**
 * 验证组织访问权限
 * @param {string} requestOrgId - 请求中的组织ID
 * @param {string} userOrgId - 用户所属组织ID
 * @param {string} operation - 操作类型（用于日志）
 * @throws {OrgSecurityError} 当访问被拒绝时抛出异常
 */
function validateOrgAccess(requestOrgId, userOrgId, operation = 'unknown') {
  if (!requestOrgId) {
    throw new OrgSecurityError('请求中缺少组织ID', 'MISSING_ORG_ID');
  }
  
  if (!userOrgId) {
    throw new OrgSecurityError('用户组织ID缺失', 'MISSING_USER_ORG_ID');
  }
  
  if (requestOrgId !== userOrgId) {
    console.warn('[ORG_SECURITY] 跨组织访问被拒绝:', {
      operation,
      requestOrgId,
      userOrgId,
      timestamp: new Date().toISOString()
    });
    throw new OrgSecurityError('无权访问其他组织的数据', 'CROSS_ORG_ACCESS_DENIED');
  }
  
  // 记录正常访问日志（开发环境）
  if (process.env.NODE_ENV === 'development') {
    console.log('[ORG_SECURITY] 组织访问验证通过:', {
      operation,
      orgId: userOrgId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 为数据对象强制添加组织ID
 * @param {Object} data - 数据对象
 * @param {string} userOrgId - 用户组织ID
 * @returns {Object} 添加了组织ID的数据对象
 */
function enforceOrgId(data, userOrgId) {
  if (!userOrgId) {
    throw new OrgSecurityError('无法确定用户组织ID', 'MISSING_USER_ORG_ID');
  }
  
  return {
    ...data,
    orgId: userOrgId
  };
}

/**
 * 验证数据是否属于当前组织
 * @param {Object|Array} data - 要验证的数据
 * @param {string} userOrgId - 用户组织ID
 * @param {boolean} throwError - 是否抛出异常
 * @returns {boolean} 验证结果
 */
function validateDataOwnership(data, userOrgId, throwError = true) {
  if (!userOrgId) {
    const error = '用户组织ID缺失';
    if (throwError) {
      throw new OrgSecurityError(error, 'MISSING_USER_ORG_ID');
    }
    return false;
  }
  
  // 检查单个数据对象
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (data.orgId && data.orgId !== userOrgId) {
      const error = `数据组织ID不匹配: 期望 ${userOrgId}, 实际 ${data.orgId}`;
      console.warn('[ORG_SECURITY] 数据归属验证失败:', {
        expectedOrgId: userOrgId,
        actualOrgId: data.orgId,
        timestamp: new Date().toISOString()
      });
      if (throwError) {
        throw new OrgSecurityError(error, 'DATA_OWNERSHIP_MISMATCH');
      }
      return false;
    }
  }
  
  // 检查数组数据
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (item && item.orgId && item.orgId !== userOrgId) {
        const error = `数组项 ${i} 组织ID不匹配: 期望 ${userOrgId}, 实际 ${item.orgId}`;
        console.warn('[ORG_SECURITY] 数组数据归属验证失败:', {
          index: i,
          expectedOrgId: userOrgId,
          actualOrgId: item.orgId,
          timestamp: new Date().toISOString()
        });
        if (throwError) {
          throw new OrgSecurityError(error, 'DATA_OWNERSHIP_MISMATCH');
        }
        return false;
      }
    }
  }
  
  return true;
}

/**
 * 构建安全的WHERE条件
 * @param {string} userOrgId - 用户组织ID
 * @param {string} tableAlias - 表别名
 * @returns {Object} 包含WHERE条件和参数的对象
 */
function buildSecureWhereClause(userOrgId, tableAlias = '') {
  if (!userOrgId) {
    throw new OrgSecurityError('无法构建安全查询条件：用户组织ID缺失', 'MISSING_USER_ORG_ID');
  }
  
  const prefix = tableAlias ? `${tableAlias}.` : '';
  return {
    condition: `${prefix}orgId = ?`,
    params: [userOrgId]
  };
}

/**
 * 记录组织访问日志
 * @param {string} operation - 操作类型
 * @param {Object} details - 操作详情
 * @param {string} level - 日志级别
 */
function logOrgAccess(operation, details, level = 'info') {
  const logData = {
    timestamp: new Date().toISOString(),
    operation,
    ...details
  };
  
  switch (level) {
    case 'warn':
      console.warn('[ORG_ACCESS_LOG]', logData);
      break;
    case 'error':
      console.error('[ORG_ACCESS_LOG]', logData);
      break;
    default:
      if (process.env.NODE_ENV === 'development') {
        console.log('[ORG_ACCESS_LOG]', logData);
      }
  }
}

module.exports = {
  OrgSecurityError,
  validateOrgAccess,
  enforceOrgId,
  validateDataOwnership,
  buildSecureWhereClause,
  logOrgAccess
}; 