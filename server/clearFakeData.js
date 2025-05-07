// 清除假数据脚本
const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearFakeData() {
  // 数据库连接配置
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'processing_app',
  };
  
  console.log(`正在连接到MySQL数据库: ${dbConfig.host}/${dbConfig.database}`);
  
  try {
    // 创建连接
    const connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功!');
    
    // 清除货品假数据
    console.log('正在清除货品假数据...');
    const [productsResult] = await connection.execute('DELETE FROM products WHERE orgId = ?', ['org1']);
    console.log(`成功删除 ${productsResult.affectedRows} 条货品假数据`);
    
    // 清除工序假数据
    console.log('正在清除工序假数据...');
    const [processesResult] = await connection.execute('DELETE FROM processes WHERE orgId = ?', ['org1']);
    console.log(`成功删除 ${processesResult.affectedRows} 条工序假数据`);
    
    console.log('假数据清除完成！');
    
    // 关闭连接
    await connection.end();
    console.log('数据库连接已关闭');
  } catch (err) {
    console.error('清除假数据失败:', err);
  }
}

// 执行清除操作
clearFakeData(); 