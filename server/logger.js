const winston = require('winston');
const path = require('path');

/**
 * 云收发系统日志管理器
 * 提供分级日志记录、性能监控和错误追踪
 * 
 * @author 云收发术团队
 * @version 3.0.0
 * @since 2024-12-19
 */

// 日志级别定义
const LOG_LEVELS = {
  error: 0,   // 错误：系统错误、异常情况
  warn: 1,    // 警告：潜在问题、性能警告
  info: 2,    // 信息：重要业务操作、系统状态
  http: 3,    // HTTP：请求响应日志
  verbose: 4, // 详细：详细的业务流程
  debug: 5,   // 调试：开发调试信息
  silly: 6    // 最详细：所有信息
};

// 根据环境确定日志级别
const getLogLevel = () => {
  const env = process.env.NODE_ENV || 'development';
  const envLogLevel = process.env.LOG_LEVEL;
  
  // 优先使用环境变量指定的日志级别
  if (envLogLevel && LOG_LEVELS.hasOwnProperty(envLogLevel)) {
    return envLogLevel;
  }
  
  // 根据环境自动选择日志级别
  switch (env) {
    case 'production':
      return 'warn';    // 生产环境：只记录警告和错误
    case 'staging':
      return 'info';    // 测试环境：记录信息级别以上
    case 'development':
    default:
      return 'debug';   // 开发环境：记录调试级别以上
  }
};

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // 性能优化：只在需要时格式化元数据
    const metaStr = Object.keys(meta).length > 0 ? 
      ` ${JSON.stringify(meta)}` : '';
    
    // 错误堆栈处理
    const stackStr = stack ? `\n${stack}` : '';
    
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}${stackStr}`;
  })
);

// 确保日志目录存在
const logDir = path.join(__dirname, 'logs');
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建日志传输器
const transports = [
  // 控制台输出（开发环境）
  new winston.transports.Console({
    level: getLogLevel(),
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
    silent: process.env.NODE_ENV === 'production' && !process.env.CONSOLE_LOG_ENABLED
  }),
  
  // 错误日志文件
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    tailable: true
  }),
  
  // 组合日志文件
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    level: getLogLevel(),
    format: logFormat,
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 3,
    tailable: true
  })
];

// 创建logger实例
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: getLogLevel(),
  format: logFormat,
  transports,
  // 性能优化：异步处理
  exitOnError: false,
  silent: false
});

// 性能监控工具
logger.performance = {
  /**
   * 记录操作耗时
   * @param {string} operation - 操作名称
   * @param {number} startTime - 开始时间（Date.now()）
   * @param {Object} metadata - 额外元数据
   */
  logDuration: (operation, startTime, metadata = {}) => {
    const duration = Date.now() - startTime;
    const level = duration > 1000 ? 'warn' : 'info';
    
    logger[level](`操作耗时: ${operation}`, {
      duration: `${duration}ms`,
      ...metadata
    });
  },

  /**
   * 创建性能计时器
   * @param {string} operation - 操作名称
   * @returns {Function} 结束计时的函数
   */
  timer: (operation) => {
    const startTime = Date.now();
    return (metadata = {}) => {
      logger.performance.logDuration(operation, startTime, metadata);
    };
  }
};

// 数据库操作日志工具
logger.db = {
  /**
   * 记录数据库查询
   * @param {string} sql - SQL语句
   * @param {Array} params - 参数
   * @param {number} duration - 执行时间
   */
  query: (sql, params = [], duration = 0) => {
    if (logger.level === 'debug' || logger.level === 'silly') {
      logger.debug('数据库查询', {
        sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
        params: params.length > 0 ? params : undefined,
        duration: duration > 0 ? `${duration}ms` : undefined
      });
    }
  },

  /**
   * 记录数据库错误
   * @param {string} sql - SQL语句
   * @param {Error} error - 错误对象
   */
  error: (sql, error) => {
    logger.error('数据库操作失败', {
      sql: sql.substring(0, 200) + (sql.length > 200 ? '...' : ''),
      error: error.message,
      code: error.code
    });
  }
};

// 输出当前日志配置
logger.info('日志系统初始化完成', {
  level: getLogLevel(),
  environment: process.env.NODE_ENV || 'development',
  logDir: logDir
});

// 处理未捕获异常
process.on('uncaughtException', (err) => {
  logger.error('未捕获的异常:', { error: err.message, stack: err.stack });
  // 延迟退出以确保日志写入
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝:', { 
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

module.exports = logger;