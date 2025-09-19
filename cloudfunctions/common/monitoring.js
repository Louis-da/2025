/**
 * 监控配置和告警系统
 * 定义监控规则、告警阈值和性能指标
 */

const { Logger, MetricsCollector } = require('./logger');
const cloud = require('wx-server-sdk');

/**
 * 监控配置
 */
const MONITORING_CONFIG = {
  // 性能阈值配置
  performance: {
    // API响应时间阈值（毫秒）
    apiResponseTime: {
      warning: 1000,
      critical: 3000
    },
    // 数据库查询时间阈值（毫秒）
    databaseQueryTime: {
      warning: 500,
      critical: 2000
    },
    // 内存使用阈值（MB）
    memoryUsage: {
      warning: 100,
      critical: 200
    },
    // CPU使用率阈值（%）
    cpuUsage: {
      warning: 70,
      critical: 90
    }
  },
  
  // 错误率阈值配置
  errorRates: {
    // API错误率阈值（%）
    apiErrorRate: {
      warning: 5,
      critical: 10
    },
    // 数据库错误率阈值（%）
    databaseErrorRate: {
      warning: 2,
      critical: 5
    },
    // 认证失败率阈值（%）
    authFailureRate: {
      warning: 10,
      critical: 20
    }
  },
  
  // 业务指标阈值
  business: {
    // 登录失败次数阈值
    loginFailures: {
      warning: 10,
      critical: 50
    },
    // 并发用户数阈值
    concurrentUsers: {
      warning: 100,
      critical: 200
    },
    // 数据同步延迟阈值（分钟）
    dataSyncDelay: {
      warning: 5,
      critical: 15
    }
  },
  
  // 监控检查间隔（秒）
  checkIntervals: {
    performance: 60,
    errors: 30,
    business: 300
  }
};

/**
 * 告警级别定义
 */
const ALERT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * 监控系统主类
 */
class MonitoringSystem {
  constructor() {
    this.logger = new Logger('monitoring');
    this.metrics = new MetricsCollector();
    this.alerts = [];
    this.isRunning = false;
    this.checkTimers = new Map();
    
    // 初始化数据库连接
    this.db = cloud.database();
    this.alertsCollection = this.db.collection('alerts');
    this.metricsCollection = this.db.collection('metrics');
  }

  /**
   * 启动监控系统
   */
  start() {
    if (this.isRunning) {
      this.logger.warn('Monitoring system is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting monitoring system');

    // 启动各类监控检查
    this._startPerformanceMonitoring();
    this._startErrorMonitoring();
    this._startBusinessMonitoring();
    
    // 启动指标收集
    this._startMetricsCollection();
    
    this.logger.info('Monitoring system started successfully');
  }

  /**
   * 停止监控系统
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.logger.info('Stopping monitoring system');

    // 清理所有定时器
    for (const timer of this.checkTimers.values()) {
      clearInterval(timer);
    }
    this.checkTimers.clear();

    this.logger.info('Monitoring system stopped');
  }

  /**
   * 启动性能监控
   */
  _startPerformanceMonitoring() {
    const interval = MONITORING_CONFIG.checkIntervals.performance * 1000;
    
    const timer = setInterval(async () => {
      try {
        await this._checkPerformanceMetrics();
      } catch (error) {
        this.logger.error('Performance monitoring check failed', {}, error);
      }
    }, interval);
    
    this.checkTimers.set('performance', timer);
    this.logger.debug('Performance monitoring started', { interval });
  }

  /**
   * 启动错误监控
   */
  _startErrorMonitoring() {
    const interval = MONITORING_CONFIG.checkIntervals.errors * 1000;
    
    const timer = setInterval(async () => {
      try {
        await this._checkErrorRates();
      } catch (error) {
        this.logger.error('Error monitoring check failed', {}, error);
      }
    }, interval);
    
    this.checkTimers.set('errors', timer);
    this.logger.debug('Error monitoring started', { interval });
  }

  /**
   * 启动业务监控
   */
  _startBusinessMonitoring() {
    const interval = MONITORING_CONFIG.checkIntervals.business * 1000;
    
    const timer = setInterval(async () => {
      try {
        await this._checkBusinessMetrics();
      } catch (error) {
        this.logger.error('Business monitoring check failed', {}, error);
      }
    }, interval);
    
    this.checkTimers.set('business', timer);
    this.logger.debug('Business monitoring started', { interval });
  }

  /**
   * 启动指标收集
   */
  _startMetricsCollection() {
    const interval = 60000; // 每分钟收集一次指标
    
    const timer = setInterval(async () => {
      try {
        await this._collectAndSaveMetrics();
      } catch (error) {
        this.logger.error('Metrics collection failed', {}, error);
      }
    }, interval);
    
    this.checkTimers.set('metrics', timer);
    this.logger.debug('Metrics collection started', { interval });
  }

  /**
   * 检查性能指标
   */
  async _checkPerformanceMetrics() {
    // 检查API响应时间
    const apiResponseTimes = await this._getRecentApiResponseTimes();
    if (apiResponseTimes.length > 0) {
      const avgResponseTime = apiResponseTimes.reduce((a, b) => a + b, 0) / apiResponseTimes.length;
      this._checkThreshold('api_response_time', avgResponseTime, MONITORING_CONFIG.performance.apiResponseTime);
    }

    // 检查数据库查询时间
    const dbQueryTimes = await this._getRecentDatabaseQueryTimes();
    if (dbQueryTimes.length > 0) {
      const avgQueryTime = dbQueryTimes.reduce((a, b) => a + b, 0) / dbQueryTimes.length;
      this._checkThreshold('database_query_time', avgQueryTime, MONITORING_CONFIG.performance.databaseQueryTime);
    }

    // 检查内存使用情况
    const memoryUsage = this._getMemoryUsage();
    this._checkThreshold('memory_usage', memoryUsage, MONITORING_CONFIG.performance.memoryUsage);
  }

  /**
   * 检查错误率
   */
  async _checkErrorRates() {
    const timeWindow = 5 * 60 * 1000; // 5分钟窗口
    const now = new Date();
    const startTime = new Date(now.getTime() - timeWindow);

    // 检查API错误率
    const apiStats = await this._getApiStats(startTime, now);
    if (apiStats.total > 0) {
      const errorRate = (apiStats.errors / apiStats.total) * 100;
      this._checkThreshold('api_error_rate', errorRate, MONITORING_CONFIG.errorRates.apiErrorRate);
    }

    // 检查数据库错误率
    const dbStats = await this._getDatabaseStats(startTime, now);
    if (dbStats.total > 0) {
      const errorRate = (dbStats.errors / dbStats.total) * 100;
      this._checkThreshold('database_error_rate', errorRate, MONITORING_CONFIG.errorRates.databaseErrorRate);
    }

    // 检查认证失败率
    const authStats = await this._getAuthStats(startTime, now);
    if (authStats.total > 0) {
      const failureRate = (authStats.failures / authStats.total) * 100;
      this._checkThreshold('auth_failure_rate', failureRate, MONITORING_CONFIG.errorRates.authFailureRate);
    }
  }

  /**
   * 检查业务指标
   */
  async _checkBusinessMetrics() {
    // 检查登录失败次数
    const loginFailures = await this._getRecentLoginFailures();
    this._checkThreshold('login_failures', loginFailures, MONITORING_CONFIG.business.loginFailures);

    // 检查并发用户数
    const concurrentUsers = await this._getConcurrentUsers();
    this._checkThreshold('concurrent_users', concurrentUsers, MONITORING_CONFIG.business.concurrentUsers);

    // 检查数据同步延迟
    const syncDelay = await this._getDataSyncDelay();
    this._checkThreshold('data_sync_delay', syncDelay, MONITORING_CONFIG.business.dataSyncDelay);
  }

  /**
   * 检查阈值并触发告警
   * @param {string} metric - 指标名称
   * @param {number} value - 当前值
   * @param {Object} thresholds - 阈值配置
   */
  _checkThreshold(metric, value, thresholds) {
    let level = null;
    
    if (value >= thresholds.critical) {
      level = ALERT_LEVELS.CRITICAL;
    } else if (value >= thresholds.warning) {
      level = ALERT_LEVELS.WARNING;
    }

    if (level) {
      this._triggerAlert(metric, value, level, thresholds);
    } else {
      // 记录正常状态
      this.metrics.gauge(`${metric}_status`, 0, { level: 'normal' });
    }

    // 记录指标值
    this.metrics.gauge(metric, value);
  }

  /**
   * 触发告警
   * @param {string} metric - 指标名称
   * @param {number} value - 当前值
   * @param {string} level - 告警级别
   * @param {Object} thresholds - 阈值配置
   */
  async _triggerAlert(metric, value, level, thresholds) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metric,
      value,
      level,
      thresholds,
      timestamp: new Date(),
      resolved: false,
      message: this._generateAlertMessage(metric, value, level, thresholds)
    };

    this.alerts.push(alert);
    
    // 记录告警日志
    const logMethod = level === ALERT_LEVELS.CRITICAL ? 'error' : 'warn';
    this.logger[logMethod](`Alert triggered: ${alert.message}`, {
      alertId: alert.id,
      metric,
      value,
      level,
      thresholds
    });

    // 保存告警到数据库
    try {
      await this.alertsCollection.add({ data: alert });
    } catch (error) {
      this.logger.error('Failed to save alert to database', {}, error);
    }

    // 发送通知（如果配置了通知渠道）
    await this._sendAlertNotification(alert);
    
    // 更新指标
    this.metrics.increment('alerts_triggered', 1, { level, metric });
  }

  /**
   * 生成告警消息
   * @param {string} metric - 指标名称
   * @param {number} value - 当前值
   * @param {string} level - 告警级别
   * @param {Object} thresholds - 阈值配置
   * @returns {string} 告警消息
   */
  _generateAlertMessage(metric, value, level, thresholds) {
    const metricNames = {
      api_response_time: 'API响应时间',
      database_query_time: '数据库查询时间',
      memory_usage: '内存使用量',
      api_error_rate: 'API错误率',
      database_error_rate: '数据库错误率',
      auth_failure_rate: '认证失败率',
      login_failures: '登录失败次数',
      concurrent_users: '并发用户数',
      data_sync_delay: '数据同步延迟'
    };

    const metricName = metricNames[metric] || metric;
    const threshold = level === ALERT_LEVELS.CRITICAL ? thresholds.critical : thresholds.warning;
    
    return `${metricName}异常: 当前值${value}超过${level}阈值${threshold}`;
  }

  /**
   * 发送告警通知
   * @param {Object} alert - 告警对象
   */
  async _sendAlertNotification(alert) {
    // 这里可以集成各种通知渠道，如微信、邮件、短信等
    // 目前只记录日志
    this.logger.info('Alert notification sent', {
      alertId: alert.id,
      metric: alert.metric,
      level: alert.level
    });
  }

  /**
   * 收集并保存指标
   */
  async _collectAndSaveMetrics() {
    const summary = this.metrics.getSummary();
    const timestamp = new Date();

    const metricsData = {
      timestamp,
      counters: summary.counters,
      gauges: summary.gauges,
      timers: summary.timers,
      system: {
        memoryUsage: this._getMemoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version
      }
    };

    try {
      await this.metricsCollection.add({ data: metricsData });
      this.logger.debug('Metrics saved to database', {
        countersCount: Object.keys(summary.counters).length,
        gaugesCount: Object.keys(summary.gauges).length,
        timersCount: Object.keys(summary.timers).length
      });
    } catch (error) {
      this.logger.error('Failed to save metrics to database', {}, error);
    }

    // 重置计数器和定时器（保留仪表盘指标）
    this.metrics.counters.clear();
    this.metrics.timers.clear();
  }

  /**
   * 获取最近的API响应时间
   * @returns {Array} 响应时间数组
   */
  async _getRecentApiResponseTimes() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = await this.db.collection('logs')
        .where({
          timestamp: cloud.database().command.gte(fiveMinutesAgo.toISOString()),
          'metadata.duration': cloud.database().command.exists(true)
        })
        .field({ 'metadata.duration': true })
        .get();

      return result.data
        .map(log => parseInt(log.metadata.duration.replace('ms', '')))
        .filter(time => !isNaN(time));
    } catch (error) {
      this.logger.error('Failed to get API response times', {}, error);
      return [];
    }
  }

  /**
   * 获取最近的数据库查询时间
   * @returns {Array} 查询时间数组
   */
  async _getRecentDatabaseQueryTimes() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = await this.db.collection('logs')
        .where({
          timestamp: cloud.database().command.gte(fiveMinutesAgo.toISOString()),
          message: cloud.database().command.regex({
            regexp: 'Database operation',
            options: 'i'
          }),
          'metadata.duration': cloud.database().command.exists(true)
        })
        .field({ 'metadata.duration': true })
        .get();

      return result.data
        .map(log => parseInt(log.metadata.duration.replace('ms', '')))
        .filter(time => !isNaN(time));
    } catch (error) {
      this.logger.error('Failed to get database query times', {}, error);
      return [];
    }
  }

  /**
   * 获取内存使用情况
   * @returns {number} 内存使用量（MB）
   */
  _getMemoryUsage() {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024); // 转换为MB
  }

  /**
   * 获取API统计信息
   * @param {Date} startTime - 开始时间
   * @param {Date} endTime - 结束时间
   * @returns {Object} API统计信息
   */
  async _getApiStats(startTime, endTime) {
    try {
      const result = await this.db.collection('logs')
        .where({
          timestamp: cloud.database().command.gte(startTime.toISOString()).and(cloud.database().command.lte(endTime.toISOString())),
          message: cloud.database().command.regex({
            regexp: 'API Request',
            options: 'i'
          })
        })
        .field({ level: true, 'metadata.responseStatus': true })
        .get();

      const total = result.data.length;
      const errors = result.data.filter(log => 
        log.level === 'ERROR' || log.metadata?.responseStatus === 'error'
      ).length;

      return { total, errors };
    } catch (error) {
      this.logger.error('Failed to get API stats', {}, error);
      return { total: 0, errors: 0 };
    }
  }

  /**
   * 获取数据库统计信息
   * @param {Date} startTime - 开始时间
   * @param {Date} endTime - 结束时间
   * @returns {Object} 数据库统计信息
   */
  async _getDatabaseStats(startTime, endTime) {
    try {
      const result = await this.db.collection('logs')
        .where({
          timestamp: cloud.database().command.gte(startTime.toISOString()).and(cloud.database().command.lte(endTime.toISOString())),
          message: cloud.database().command.regex({
            regexp: 'Database operation',
            options: 'i'
          })
        })
        .field({ level: true })
        .get();

      const total = result.data.length;
      const errors = result.data.filter(log => log.level === 'ERROR').length;

      return { total, errors };
    } catch (error) {
      this.logger.error('Failed to get database stats', {}, error);
      return { total: 0, errors: 0 };
    }
  }

  /**
   * 获取认证统计信息
   * @param {Date} startTime - 开始时间
   * @param {Date} endTime - 结束时间
   * @returns {Object} 认证统计信息
   */
  async _getAuthStats(startTime, endTime) {
    try {
      const result = await this.db.collection('logs')
        .where({
          timestamp: cloud.database().command.gte(startTime.toISOString()).and(cloud.database().command.lte(endTime.toISOString())),
          context: 'auth'
        })
        .field({ level: true, message: true })
        .get();

      const total = result.data.length;
      const failures = result.data.filter(log => 
        log.level === 'ERROR' || log.message.includes('failed') || log.message.includes('失败')
      ).length;

      return { total, failures };
    } catch (error) {
      this.logger.error('Failed to get auth stats', {}, error);
      return { total: 0, failures: 0 };
    }
  }

  /**
   * 获取最近登录失败次数
   * @returns {number} 登录失败次数
   */
  async _getRecentLoginFailures() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await this.db.collection('logs')
        .where({
          timestamp: cloud.database().command.gte(oneHourAgo.toISOString()),
          context: 'auth',
          level: 'ERROR',
          message: cloud.database().command.regex({
            regexp: 'login.*failed|登录.*失败',
            options: 'i'
          })
        })
        .count();

      return result.total;
    } catch (error) {
      this.logger.error('Failed to get login failures', {}, error);
      return 0;
    }
  }

  /**
   * 获取当前并发用户数
   * @returns {number} 并发用户数
   */
  async _getConcurrentUsers() {
    try {
      const result = await this.db.collection('user_sessions')
        .where({
          isActive: true,
          expiresAt: cloud.database().command.gt(new Date())
        })
        .count();

      return result.total;
    } catch (error) {
      this.logger.error('Failed to get concurrent users', {}, error);
      return 0;
    }
  }

  /**
   * 获取数据同步延迟
   * @returns {number} 同步延迟（分钟）
   */
  async _getDataSyncDelay() {
    // 这里需要根据实际的数据同步机制来实现
    // 暂时返回0作为占位符
    return 0;
  }

  /**
   * 获取监控状态
   * @returns {Object} 监控状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeChecks: Array.from(this.checkTimers.keys()),
      alertsCount: this.alerts.length,
      unresolvedAlerts: this.alerts.filter(alert => !alert.resolved).length,
      uptime: process.uptime(),
      memoryUsage: this._getMemoryUsage()
    };
  }

  /**
   * 获取最近的告警
   * @param {number} limit - 限制数量
   * @returns {Array} 告警列表
   */
  getRecentAlerts(limit = 10) {
    return this.alerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * 解决告警
   * @param {string} alertId - 告警ID
   * @param {string} resolvedBy - 解决人
   * @param {string} resolution - 解决方案
   */
  async resolveAlert(alertId, resolvedBy, resolution) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      alert.resolvedBy = resolvedBy;
      alert.resolution = resolution;

      this.logger.info(`Alert resolved: ${alertId}`, {
        alertId,
        resolvedBy,
        resolution
      });

      // 更新数据库中的告警状态
      try {
        await this.alertsCollection
          .where({ id: alertId })
          .update({
            data: {
              resolved: true,
              resolvedAt: alert.resolvedAt,
              resolvedBy,
              resolution
            }
          });
      } catch (error) {
        this.logger.error('Failed to update alert in database', {}, error);
      }
    }
  }
}

// 全局监控实例
const globalMonitoring = new MonitoringSystem();

/**
 * 健康检查函数
 * @returns {Object} 健康状态
 */
async function healthCheck() {
  const status = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    checks: {}
  };

  // 检查数据库连接
  try {
    const db = cloud.database();
    await db.collection('users').limit(1).get();
    status.checks.database = 'healthy';
  } catch (error) {
    status.checks.database = 'unhealthy';
    status.status = 'unhealthy';
  }

  // 检查监控系统状态
  const monitoringStatus = globalMonitoring.getStatus();
  status.checks.monitoring = monitoringStatus.isRunning ? 'healthy' : 'unhealthy';
  
  if (!monitoringStatus.isRunning) {
    status.status = 'degraded';
  }

  return status;
}

module.exports = {
  MonitoringSystem,
  MONITORING_CONFIG,
  ALERT_LEVELS,
  globalMonitoring,
  healthCheck
};