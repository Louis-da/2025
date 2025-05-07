// 数据库连接
const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'processing_app',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试连接
pool.getConnection()
  .then(conn => {
    console.log('数据库连接成功');
    conn.release();
    return true;
  })
  .catch(err => {
    console.error('数据库连接失败:', err);
    process.exit(1);
  });

// 通用查询方法
const executeQuery = async (sql, params = []) => {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('SQL执行错误:', error);
    throw error;
  }
};

// 导出数据库操作方法
module.exports = {
  // 直接执行SQL查询
  executeQuery,
  
  orders: {
    find: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      return executeQuery(`SELECT * FROM orders ${whereClause}`, params);
    },
    findOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const results = await executeQuery(`SELECT * FROM orders WHERE ${whereClause} LIMIT 1`, params);
      return results[0] || null;
    },
    insertOne: async (doc) => {
      const keys = Object.keys(doc);
      const placeholders = keys.map(() => '?').join(', ');
      const values = Object.values(doc);
      const result = await executeQuery(
        `INSERT INTO orders (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    updateOne: async (condition, update) => {
      const setClause = Object.keys(update.$set || update).map(key => `${key} = ?`).join(', ');
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = [...Object.values(update.$set || update), ...Object.values(condition)];
      const result = await executeQuery(
        `UPDATE orders SET ${setClause} WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteOne: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM orders WHERE ${whereClause} LIMIT 1`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    deleteMany: async (condition) => {
      const whereClause = Object.keys(condition).map(key => `${key} = ?`).join(' AND ');
      const params = Object.values(condition);
      const result = await executeQuery(
        `DELETE FROM orders WHERE ${whereClause}`,
        params
      );
      return { affectedRows: result.affectedRows };
    },
    countDocuments: async (condition = {}) => {
      const whereClause = Object.keys(condition).length > 0 
        ? 'WHERE ' + Object.keys(condition).map(key => `${key} = ?`).join(' AND ')
        : '';
      const params = Object.values(condition);
      const result = await executeQuery(`SELECT COUNT(*) as count FROM orders ${whereClause}`, params);
      return result[0].count;
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
      return executeQuery(`SELECT * FROM sizes ${whereClause} ORDER BY sort_order ASC`, params);
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