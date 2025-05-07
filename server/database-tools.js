/**
 * 数据库管理工具
 * 用于初始化和管理MySQL数据库
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true // 允许执行多条SQL语句
};

// 数据库名称
const dbName = process.env.DB_NAME || 'processing_app';

/**
 * 初始化数据库
 */
async function initDatabase() {
  let connection;
  
  try {
    console.log('正在连接到MySQL服务器...');
    connection = await mysql.createConnection(dbConfig);
    
    // 读取初始化SQL脚本
    const sqlFilePath = path.join(__dirname, 'init-database.sql');
    const sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('正在执行数据库初始化脚本...');
    await connection.query(sqlScript);
    
    console.log('数据库初始化成功!');
  } catch (err) {
    console.error('数据库初始化失败:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

/**
 * 清除假数据
 */
async function clearFakeData() {
  let connection;
  
  try {
    // 连接到特定数据库
    const config = { ...dbConfig, database: dbName };
    console.log(`正在连接到MySQL数据库: ${config.host}/${config.database}`);
    
    connection = await mysql.createConnection(config);
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
  } catch (err) {
    console.error('清除假数据失败:', err);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 打印帮助信息
function printHelp() {
  console.log('\n数据库管理工具使用方法:');
  console.log('  node database-tools.js init    - 初始化数据库');
  console.log('  node database-tools.js clear   - 清除假数据');
  console.log('  node database-tools.js help    - 显示帮助信息\n');
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'init':
      await initDatabase();
      break;
    case 'clear':
      await clearFakeData();
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

// 执行主函数
main().catch(console.error); 