const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
  host: '175.178.33.180',
  user: 'yunsf',
  password: '521qwertyuioP@',
  database: 'processing_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 最大重试次数
const MAX_RETRIES = 3;
// 重试延迟（毫秒）
const RETRY_DELAY = 1000;

// 测试数据库连接
async function testConnection() {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const connection = await pool.getConnection();
      console.log('数据库连接成功');
      connection.release();
      return true;
    } catch (err) {
      retries++;
      console.error(`数据库连接失败 (尝试 ${retries}/${MAX_RETRIES}):`, err.message);
      if (retries < MAX_RETRIES) {
        console.log(`等待 ${RETRY_DELAY/1000} 秒后重试...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  console.log('将使用默认数据继续运行...');
  return false;
}

// 执行SQL查询（带重试机制）
async function executeQuery(sql, params = [], retries = 0) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('SQL执行错误:', {
      sql,
      params,
      error: error.message
    });

    // 如果是连接错误且未超过最大重试次数，则重试
    if (error.code === 'PROTOCOL_CONNECTION_LOST' && retries < MAX_RETRIES) {
      console.log(`等待 ${RETRY_DELAY/1000} 秒后重试... (${retries + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return executeQuery(sql, params, retries + 1);
    }

    // 根据错误类型返回适当的默认值
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return [];
    } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      return { insertId: null };
    } else if (sql.trim().toUpperCase().startsWith('UPDATE')) {
      return { affectedRows: 0 };
    } else {
      return null;
    }
  }
}

// 初始化连接
testConnection().then(connected => {
  if (!connected) {
    console.log('数据库连接失败，服务将使用默认数据运行');
  }
});

// 定期检查连接
setInterval(async () => {
  try {
    const connection = await pool.getConnection();
    connection.release();
  } catch (err) {
    console.error('定期连接检查失败:', err.message);
    testConnection();
  }
}, 60000); // 每分钟检查一次

module.exports = {
  pool,
  executeQuery
}; 