/**
 * 日志记录和监控工具类
 * 提供结构化日志记录、性能监控和错误追踪功能
 */

const cloud = require('wx-server-sdk');
const { AppError } = require('./utils');

// 日志级别定义
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// 日志级别名称映射
const LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG',
  4: 'TRACE'
};

/**
 * 结构化日志记录器
 */
class Logger {
  constructor(context = 'default', options = {}) {
    this.context = context;
    this.level = options.level || LOG_LEVELS.INFO;
    this.enableConsole = options.enableConsole !== false;
    this.enableDatabase = options.enableDatabase !== false;
    this.enablePerformanceTracking = options.enablePerformanceTracking !== false;
    this.metadata = options.metadata || {};
    
    // 性能追踪存储
    this.performanceTrackers = new Map();
    
    // 初始化数据库连接
    if (this.enableDatabase) {
      this.db = cloud.database();
      this.logsCollection = this.db.collection('logs');
    }
  }

  /**
   * 记录错误日志
   * @param {string|Error} message - 错误信息或错误对象
   * @param {Object} meta - 附加元数据
   * @param {Error} error - 错误对象（当message为字符串时）
   */
  error(message, meta = {}, error = null) {
    this._log(LOG_LEVELS.ERROR, message, meta, error);
  }

  /**
   * 记录警告日志
   * @param {string} message - 警告信息
   * @param {Object} meta - 附加元数据
   */
  warn(message, meta = {}) {
    this._log(LOG_LEVELS.WARN, message, meta);
  }

  /**
   * 记录信息日志
   * @param {string} message - 信息内容
   * @param {Object} meta - 附加元数据
   */
  info(message, meta = {}) {
    this._log(LOG_LEVELS.INFO, message, meta);
  }

  /**
   * 记录调试日志
   * @param {string} message - 调试信息
   * @param {Object} meta - 附加元数据
   */
  debug(message, meta = {}) {
    this._log(LOG_LEVELS.DEBUG, message, meta);
  }

  /**
   * 记录追踪日志
   * @param {string} message - 追踪信息
   * @param {Object} meta - 附加元数据
   */
  trace(message, meta = {}) {
    this._log(LOG_LEVELS.TRACE, message, meta);
  }

  /**
   * 内部日志记录方法
   * @param {number} level - 日志级别
   * @param {string|Error} message - 日志信息
   * @param {Object} meta - 附加元数据
   * @param {Error} error - 错误对象
   */
  async _log(level, message, meta = {}, error = null) {
    if (level > this.level) {
      return; // 跳过低于当前级别的日志
    }

    const timestamp = new Date();
    const logEntry = {
      timestamp: timestamp.toISOString(),
      level: LEVEL_NAMES[level],
      context: this.context,
      message: this._formatMessage(message),
      metadata: {
        ...this.metadata,
        ...meta
      }
    };

    // 处理错误对象
    if (error || message instanceof Error) {
      const errorObj = error || message;
      logEntry.error = {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
        code: errorObj.code || null
      };
    }

    // 添加请求追踪信息
    if (meta.requestId) {
      logEntry.requestId = meta.requestId;
    }

    // 添加用户信息
    if (meta.userId) {
      logEntry.userId = meta.userId;
    }

    // 控制台输出
    if (this.enableConsole) {
      this._consoleLog(level, logEntry);
    }

    // 数据库存储
    if (this.enableDatabase) {
      try {
        await this._saveToDatabase(logEntry);
      } catch (dbError) {
        console.error('Failed to save log to database:', dbError);
      }
    }
  }

  /**
   * 格式化日志消息
   * @param {string|Error} message - 原始消息
   * @returns {string} 格式化后的消息
   */
  _formatMessage(message) {
    if (message instanceof Error) {
      return message.message;
    }
    return String(message);
  }

  /**
   * 控制台日志输出
   * @param {number} level - 日志级别
   * @param {Object} logEntry - 日志条目
   */
  _consoleLog(level, logEntry) {
    const prefix = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.context}]`;
    const message = `${prefix} ${logEntry.message}`;

    switch (level) {
      case LOG_LEVELS.ERROR:
        console.error(message, logEntry.error || '');
        break;
      case LOG_LEVELS.WARN:
        console.warn(message);
        break;
      case LOG_LEVELS.INFO:
        console.info(message);
        break;
      case LOG_LEVELS.DEBUG:
      case LOG_LEVELS.TRACE:
        console.log(message);
        break;
    }
  }

  /**
   * 保存日志到数据库
   * @param {Object} logEntry - 日志条目
   */
  async _saveToDatabase(logEntry) {
    if (!this.logsCollection) {
      return;
    }

    try {
      await this.logsCollection.add({
        data: {
          ...logEntry,
          createdAt: new Date()
        }
      });
    } catch (error) {
      // 避免日志记录失败导致的循环错误
      console.error('Database log save failed:', error.message);
    }
  }

  /**
   * 开始性能追踪
   * @param {string} operationName - 操作名称
   * @param {Object} meta - 附加元数据
   * @returns {string} 追踪ID
   */
  startPerformanceTracking(operationName, meta = {}) {
    if (!this.enablePerformanceTracking) {
      return null;
    }

    const trackingId = `${operationName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.performanceTrackers.set(trackingId, {
      operationName,
      startTime: process.hrtime.bigint(),
      startTimestamp: new Date(),
      metadata: meta
    });

    this.debug(`Performance tracking started: ${operationName}`, { trackingId, ...meta });
    
    return trackingId;
  }

  /**
   * 结束性能追踪
   * @param {string} trackingId - 追踪ID
   * @param {Object} meta - 附加元数据
   */
  endPerformanceTracking(trackingId, meta = {}) {
    if (!trackingId || !this.performanceTrackers.has(trackingId)) {
      return;
    }

    const tracker = this.performanceTrackers.get(trackingId);
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - tracker.startTime) / 1000000; // 转换为毫秒

    const performanceData = {
      operationName: tracker.operationName,
      duration: `${duration.toFixed(2)}ms`,
      durationMs: Math.round(duration),
      startTime: tracker.startTimestamp.toISOString(),
      endTime: new Date().toISOString(),
      metadata: {
        ...tracker.metadata,
        ...meta
      }
    };

    // 根据执行时间选择日志级别
    const logLevel = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'debug';
    this[logLevel](`Performance: ${tracker.operationName} completed`, performanceData);

    this.performanceTrackers.delete(trackingId);
  }

  /**
   * 记录数据库操作
   * @param {string} operation - 操作类型
   * @param {string} collection - 集合名称
   * @param {Object} query - 查询条件
   * @param {Object} result - 操作结果
   * @param {number} duration - 执行时间（毫秒）
   */
  logDatabaseOperation(operation, collection, query = {}, result = {}, duration = 0) {
    const meta = {
      operation,
      collection,
      query: this._sanitizeQuery(query),
      resultCount: result.data?.length || result.stats?.updated || result.stats?.removed || 0,
      duration: `${duration}ms`
    };

    if (duration > 100) {
      this.warn(`Slow database operation: ${operation} on ${collection}`, meta);
    } else {
      this.debug(`Database operation: ${operation} on ${collection}`, meta);
    }
  }

  /**
   * 记录API请求
   * @param {Object} event - 云函数事件对象
   * @param {Object} result - 响应结果
   * @param {number} duration - 处理时间
   */
  logApiRequest(event, result = {}, duration = 0) {
    const meta = {
      action: event.action || 'unknown',
      userId: event.userId || 'anonymous',
      userInfo: event.userInfo ? {
        openId: event.userInfo.openId,
        nickName: event.userInfo.nickName
      } : null,
      requestData: this._sanitizeRequestData(event),
      responseStatus: result.success ? 'success' : 'error',
      duration: `${duration}ms`
    };

    if (result.success) {
      this.info(`API Request: ${event.action || 'unknown'}`, meta);
    } else {
      this.error(`API Request Failed: ${event.action || 'unknown'}`, meta, result.error);
    }
  }

  /**
   * 清理查询条件中的敏感信息
   * @param {Object} query - 原始查询条件
   * @returns {Object} 清理后的查询条件
   */
  _sanitizeQuery(query) {
    const sanitized = { ...query };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * 清理请求数据中的敏感信息
   * @param {Object} data - 原始请求数据
   * @returns {Object} 清理后的请求数据
   */
  _sanitizeRequestData(data) {
    const sanitized = { ...data };
    const sensitiveFields = ['password', 'oldPassword', 'newPassword', 'token', 'secret'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    // 移除用户信息中的敏感数据
    if (sanitized.userInfo) {
      delete sanitized.userInfo.signature;
      delete sanitized.userInfo.rawData;
      delete sanitized.userInfo.encryptedData;
      delete sanitized.userInfo.iv;
    }
    
    return sanitized;
  }

  /**
   * 创建子日志记录器
   * @param {string} subContext - 子上下文名称
   * @param {Object} additionalMeta - 附加元数据
   * @returns {Logger} 子日志记录器
   */
  child(subContext, additionalMeta = {}) {
    return new Logger(`${this.context}:${subContext}`, {
      level: this.level,
      enableConsole: this.enableConsole,
      enableDatabase: this.enableDatabase,
      enablePerformanceTracking: this.enablePerformanceTracking,
      metadata: {
        ...this.metadata,
        ...additionalMeta
      }
    });
  }
}

/**
 * 监控指标收集器
 */
class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.timers = new Map();
  }

  /**
   * 增加计数器
   * @param {string} name - 计数器名称
   * @param {number} value - 增加值
   * @param {Object} tags - 标签
   */
  increment(name, value = 1, tags = {}) {
    const key = this._getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * 记录时间指标
   * @param {string} name - 指标名称
   * @param {number} duration - 持续时间（毫秒）
   * @param {Object} tags - 标签
   */
  timing(name, duration, tags = {}) {
    const key = this._getMetricKey(name, tags);
    if (!this.timers.has(key)) {
      this.timers.set(key, []);
    }
    this.timers.get(key).push(duration);
  }

  /**
   * 设置仪表盘指标
   * @param {string} name - 指标名称
   * @param {number} value - 指标值
   * @param {Object} tags - 标签
   */
  gauge(name, value, tags = {}) {
    const key = this._getMetricKey(name, tags);
    this.metrics.set(key, {
      value,
      timestamp: new Date(),
      tags
    });
  }

  /**
   * 获取指标摘要
   * @returns {Object} 指标摘要
   */
  getSummary() {
    const summary = {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.metrics),
      timers: {}
    };

    // 计算时间指标统计
    for (const [key, values] of this.timers) {
      if (values.length > 0) {
        const sorted = values.sort((a, b) => a - b);
        summary.timers[key] = {
          count: values.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        };
      }
    }

    return summary;
  }

  /**
   * 生成指标键
   * @param {string} name - 指标名称
   * @param {Object} tags - 标签
   * @returns {string} 指标键
   */
  _getMetricKey(name, tags) {
    const tagString = Object.keys(tags)
      .sort()
      .map(key => `${key}=${tags[key]}`)
      .join(',');
    return tagString ? `${name}|${tagString}` : name;
  }

  /**
   * 重置所有指标
   */
  reset() {
    this.metrics.clear();
    this.counters.clear();
    this.timers.clear();
  }
}

// 全局实例
const globalLogger = new Logger('global');
const globalMetrics = new MetricsCollector();

/**
 * 创建带有请求上下文的日志记录器
 * @param {Object} event - 云函数事件对象
 * @returns {Logger} 日志记录器实例
 */
function createRequestLogger(event) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const context = event.action || 'unknown';
  
  return new Logger(context, {
    metadata: {
      requestId,
      userId: event.userId || null,
      openId: event.userInfo?.openId || null
    }
  });
}

/**
 * 性能监控装饰器
 * @param {string} operationName - 操作名称
 * @returns {Function} 装饰器函数
 */
function performanceMonitor(operationName) {
  return function(target, propertyName, descriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(...args) {
      const logger = this.logger || globalLogger;
      const trackingId = logger.startPerformanceTracking(operationName, {
        method: propertyName,
        args: args.length
      });
      
      try {
        const result = await method.apply(this, args);
        logger.endPerformanceTracking(trackingId, { success: true });
        return result;
      } catch (error) {
        logger.endPerformanceTracking(trackingId, { success: false, error: error.message });
        throw error;
      }
    };
    
    return descriptor;
  };
}

module.exports = {
  Logger,
  MetricsCollector,
  LOG_LEVELS,
  globalLogger,
  globalMetrics,
  createRequestLogger,
  performanceMonitor
};