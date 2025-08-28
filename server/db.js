// 数据库连接
const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库连接配置 - 优化连接稳定性和安全性
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || (() => {
    console.error('❌ 严重安全警告: 数据库密码未在环境变量中设置，请立即配置 DB_PASSWORD');
    if (process.env.NODE_ENV === 'production') {
    process.exit(1);
    }
    return '';
  })(),
  database: process.env.DB_NAME || 'processing_app',
  waitForConnections: true,
  // 🚀 优化：根据环境动态调整连接池大小，支持环境变量配置
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 
    (process.env.NODE_ENV === 'production' ? 20 : 10),
  queueLimit: 0,
  // 🚀 优化：增加超时时间，提高稳定性，支持环境变量配置
  connectTimeout: parseInt(process.env.DB_TIMEOUT) || 60000, // 60秒连接超时
  // 移除 acquireTimeout 和 timeout，这些在 MySQL2 中不是有效的连接选项
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // 🚀 新增配置项提高稳定性
  idleTimeout: 300000, // 5分钟空闲超时
  // 移除 reconnect，这在 MySQL2 连接池中不是有效选项
  // 字符集配置
  charset: 'utf8mb4',
  // SSL配置（如果需要）
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false,
  // 防止连接包错误
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
  // 🚀 新增：连接池健康检查
  multipleStatements: false, // 安全考虑，禁用多语句
  typeCast: true // 自动类型转换
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 优化连接池监控 - 智能监控策略
let poolStatusInterval;
if (process.env.NODE_ENV === 'development') {
  // 开发环境：仅在连接池状态变化时记录，避免无意义的定时日志
  let lastConnectionCount = 0;
  
  poolStatusInterval = setInterval(() => {
    const currentConnections = pool._allConnections ? pool._allConnections.length : 0;
    const freeConnections = pool._freeConnections ? pool._freeConnections.length : 0;
    
    // 只有连接数发生变化时才记录日志
    if (currentConnections !== lastConnectionCount) {
      console.log('[DB Pool Status]', {
        totalConnections: currentConnections,
        freeConnections: freeConnections,
        activeConnections: currentConnections - freeConnections,
        connectionLimit: dbConfig.connectionLimit,
        timestamp: new Date().toISOString()
      });
      lastConnectionCount = currentConnections;
    }
  }, 30000); // 30秒检查一次，但只在状态变化时输出
}

// 测试连接 - 增强错误处理
const testConnection = async () => {
  try {
    const conn = await pool.getConnection();
    console.log('数据库连接成功');
    await conn.ping(); // 测试连接是否有效
    conn.release();
    return true;
  } catch (err) {
    console.error('数据库连接失败:', err.message);
    // 不要立即退出，给重连机会
    setTimeout(testConnection, 5000);
    return false;
  }
};

// 初始连接测试
testConnection();

// 通用查询方法 - 增强错误处理和重试机制 + 🚀 性能监控
const executeQuery = async (sql, params = [], retryCount = 0) => {
  const maxRetries = 3;
  const startTime = Date.now(); // 🚀 新增：性能监控开始时间
  
  try {
    // 只在开发环境打印详细日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB_EXECUTE] SQL: ${sql}`);
      console.log(`[DB_EXECUTE] PARAMS: ${JSON.stringify(params)}`);
    }
    
    const [results, fields] = await pool.execute(sql, params);
    
    // 🚀 新增：性能监控和慢查询检测
    const duration = Date.now() - startTime;
    if (duration > 1000) { // 超过1秒的查询
      console.warn(`⚠️ 慢查询警告: ${duration}ms`);
      console.warn(`SQL: ${sql.substring(0, 200)}${sql.length > 200 ? '...' : ''}`);
    } else if (process.env.NODE_ENV === 'development' && duration > 100) {
      console.log(`📊 查询耗时: ${duration}ms - ${sql.substring(0, 100)}...`);
    }
    
    // 根据SQL语句类型返回不同的结果
    if (sql.trim().toUpperCase().startsWith('INSERT') ||
        sql.trim().toUpperCase().startsWith('UPDATE') ||
        sql.trim().toUpperCase().startsWith('DELETE')) {
      return { affectedRows: results.affectedRows, insertId: results.insertId };
    } else {
      return results;
    }
  } catch (error) {
    const duration = Date.now() - startTime; // 🚀 错误情况下也记录耗时
    
    console.error('[DB_EXECUTE_ERROR] 数据库执行错误:');
    console.error(`[DB_EXECUTE_ERROR] 错误信息: ${error.message}`);
    console.error(`[DB_EXECUTE_ERROR] 错误代码: ${error.code}`);
    console.error(`[DB_EXECUTE_ERROR] 查询耗时: ${duration}ms`); // 🚀 新增
    
    // 只在严重错误时打印SQL
    if (error.code === 'ER_MALFORMED_PACKET' || 
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT') {
      console.error(`[DB_EXECUTE_ERROR] 问题SQL: ${sql}`);
    }
    
    // 重试机制
    if ((error.code === 'PROTOCOL_CONNECTION_LOST' || 
         error.code === 'ECONNRESET' || 
         error.code === 'ETIMEDOUT' ||
         error.code === 'ER_MALFORMED_PACKET') && 
        retryCount < maxRetries) {
      console.log(`[DB_EXECUTE] 重试第 ${retryCount + 1} 次，等待 ${2000 * (retryCount + 1)}ms`);
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return executeQuery(sql, params, retryCount + 1);
    }
    
    throw error;
  }
};

// 优雅关闭连接池
const closePool = async () => {
  try {
    if (poolStatusInterval) {
      clearInterval(poolStatusInterval);
    }
    await pool.end();
    console.log('数据库连接池已关闭');
  } catch (error) {
    console.error('关闭数据库连接池时出错:', error);
  }
};

// 监听进程退出事件
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);
process.on('exit', closePool);

// 导出数据库操作方法
module.exports = {
  // 直接执行SQL查询
  executeQuery,
  // 获取数据库连接，用于事务处理
  getConnection: async () => {
    return await pool.getConnection();
  },
  pool,
  
  /**
   * 事务管理工具
   * 提供统一的事务处理，确保数据操作的原子性和一致性
   */
  transaction: {
    /**
     * 执行事务操作
     * @param {Function} callback - 事务操作回调函数，接收connection参数
     * @returns {Promise<any>} 事务执行结果
     * 
     * @example
     * const result = await db.transaction(async (conn) => {
     *   await conn.execute('INSERT INTO orders ...', []);
     *   await conn.execute('UPDATE products ...', []);
     *   return { success: true };
     * });
     */
    execute: async (callback) => {
      const connection = await pool.getConnection();
      
      try {
        // 开始事务
        await connection.beginTransaction();
        console.log('[Transaction] 事务开始');
        
        // 执行事务操作
        const result = await callback(connection);
        
        // 提交事务
        await connection.commit();
        console.log('[Transaction] 事务提交成功');
        
        return result;
      } catch (error) {
        // 回滚事务
        try {
          await connection.rollback();
          console.log('[Transaction] 事务回滚成功');
        } catch (rollbackError) {
          console.error('[Transaction] 事务回滚失败:', rollbackError);
        }
        
        console.error('[Transaction] 事务执行失败:', error);
        throw error;
      } finally {
        // 释放连接
        try {
          connection.release();
          console.log('[Transaction] 数据库连接已释放');
        } catch (releaseError) {
          console.error('[Transaction] 释放数据库连接失败:', releaseError);
        }
      }
    },

    /**
     * 批量执行SQL语句（事务中）
     * @param {Array} sqlStatements - SQL语句数组，格式：[{sql: '', params: []}]
     * @returns {Promise<Array>} 执行结果数组
     * 
     * @example
     * const results = await db.transaction.batch([
     *   { sql: 'INSERT INTO orders (name) VALUES (?)', params: ['订单1'] },
     *   { sql: 'UPDATE products SET stock = stock - ? WHERE id = ?', params: [10, 1] }
     * ]);
     */
    batch: async (sqlStatements) => {
      return await module.exports.transaction.execute(async (connection) => {
        const results = [];
        
        for (const statement of sqlStatements) {
          const { sql, params = [] } = statement;
          
          try {
            const [result] = await connection.execute(sql, params);
            results.push(result);
            
            console.log(`[Transaction.Batch] SQL执行成功: ${sql.substring(0, 50)}...`);
          } catch (error) {
            console.error(`[Transaction.Batch] SQL执行失败: ${sql}`, error);
            throw error;
          }
        }
        
        return results;
      });
    }
  },
  
  products: {
    find: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      return executeQuery(`SELECT * FROM products ${whereClause}`, params);
    },
    findOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const results = await executeQuery(`SELECT * FROM products WHERE ${whereClause} LIMIT 1`, params);
      return results[0] || null;
    },
    insertOne: async (doc) => {
      const keys = Object.keys(doc);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(doc);
      const result = await executeQuery(
        `INSERT INTO products (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    updateOne: async (condition, update) => {
      const setClause = Object.keys(update.$set || update).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = [...Object.values(update.$set || update), ...Object.values(condition)];
      const result = await executeQuery(
        `UPDATE products SET ${setClause} WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM products WHERE ${whereClause} LIMIT 1`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteMany: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM products WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    }
  },
  processes: {
    find: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      return executeQuery(`SELECT * FROM processes ${whereClause}`, params);
    },
    findOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const results = await executeQuery(`SELECT * FROM processes WHERE ${whereClause} LIMIT 1`, params);
      return results[0] || null;
    },
    insertOne: async (doc) => {
      const keys = Object.keys(doc);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(doc);
      const result = await executeQuery(
        `INSERT INTO processes (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    updateOne: async (condition, update) => {
      const setClause = Object.keys(update.$set || update).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = [...Object.values(update.$set || update), ...Object.values(condition)];
      const result = await executeQuery(
        `UPDATE processes SET ${setClause} WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM processes WHERE ${whereClause} LIMIT 1`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteMany: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM processes WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    }
  },
  factories: {
    find: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      return executeQuery(`SELECT * FROM factories ${whereClause}`, params);
    },
    count: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      const result = await executeQuery(`SELECT COUNT(*) as count FROM factories ${whereClause}`, params);
      return result[0].count;
    },
    findOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const results = await executeQuery(`SELECT * FROM factories WHERE ${whereClause} LIMIT 1`, params);
      return results[0] || null;
    },
    insertOne: async (doc) => {
      const keys = Object.keys(doc);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(doc);
      const result = await executeQuery(
        `INSERT INTO factories (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    updateOne: async (condition, update) => {
      const setClause = Object.keys(update.$set || update).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = [...Object.values(update.$set || update), ...Object.values(condition)];
      const result = await executeQuery(
        `UPDATE factories SET ${setClause} WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM factories WHERE ${whereClause} LIMIT 1`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteMany: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM factories WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    }
  },
  colors: {
    find: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      return executeQuery(`SELECT * FROM colors ${whereClause}`, params);
    },
    findOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const results = await executeQuery(`SELECT * FROM colors WHERE ${whereClause} LIMIT 1`, params);
      return results[0] || null;
    },
    insertOne: async (doc) => {
      const keys = Object.keys(doc);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(doc);
      const result = await executeQuery(
        `INSERT INTO colors (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    updateOne: async (condition, update) => {
      const setClause = Object.keys(update.$set || update).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = [...Object.values(update.$set || update), ...Object.values(condition)];
      const result = await executeQuery(
        `UPDATE colors SET ${setClause} WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM colors WHERE ${whereClause} LIMIT 1`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteMany: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM colors WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    }
  },
  sizes: {
    find: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      return executeQuery(`SELECT * FROM sizes ${whereClause} ORDER BY orderNum ASC`, params);
    },
    findOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const results = await executeQuery(`SELECT * FROM sizes WHERE ${whereClause} LIMIT 1`, params);
      return results[0] || null;
    },
    insertOne: async (doc) => {
      const keys = Object.keys(doc);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(doc);
      const result = await executeQuery(
        `INSERT INTO sizes (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    updateOne: async (condition, update) => {
      const setClause = Object.keys(update.$set || update).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = [...Object.values(update.$set || update), ...Object.values(condition)];
      const result = await executeQuery(
        `UPDATE sizes SET ${setClause} WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM sizes WHERE ${whereClause} LIMIT 1`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteMany: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM sizes WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    }
  },
  close: async () => {
    try {
      await pool.end();
      console.log('数据库连接已关闭');
    } catch (err) {
      console.error('关闭数据库连接失败:', err);
    }
  }
}; 