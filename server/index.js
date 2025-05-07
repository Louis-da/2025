const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // 解析 JSON 请求体

// 连接 MySQL 数据库
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '521qwertyuioP@',
  database: 'processing'
});

// 确认数据库连接
db.connect((err) => {
  if (err) {
    console.error('MySQL Connection Error:', err);
    return;
  }
  console.log('MySQL Connected');
});

// 一个简单的接口：获取所有组织
app.get('/organizations', (req, res) => {
  const sql = 'SELECT * FROM organizations';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching organizations:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// 登录接口
app.post('/login', (req, res) => {
  const { orgId, username, password } = req.body;
  console.log('Login attempt:', { orgId, username, password });
  const sql = 'SELECT * FROM users WHERE org_id = ? AND username = ? AND password = ?';
  db.query(sql, [orgId, username, password], (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    if (results.length > 0) {
      console.log('Login successful for:', { orgId, username });
      res.json({ success: true, message: '登录成功' });
    } else {
      console.log('Login failed for:', { orgId, username });
      res.json({ success: false, message: '组织ID、用户名或密码错误' });
    }
  });
});

// 获取流水表接口
app.get('/flow-table', (req, res) => {
  const { orgId, productNo } = req.query;
  
  let sql = 'SELECT * FROM flow_table WHERE 1=1';
  const params = [];
  
  if (orgId) {
    sql += ' AND org_id = ?';
    params.push(orgId);
  }
  
  if (productNo) {
    sql += ' AND product_no = ?';
    params.push(productNo);
  }
  
  sql += ' ORDER BY date DESC';
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching flow table:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// 获取工厂列表
app.get('/factories', (req, res) => {
  const { orgId } = req.query;
  
  let sql = 'SELECT * FROM factories WHERE 1=1';
  const params = [];
  
  if (orgId) {
    sql += ' AND org_id = ?';
    params.push(orgId);
  }
  
  sql += ' AND status = 1 ORDER BY id';
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching factories:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// 获取工序列表
app.get('/processes', (req, res) => {
  const { orgId } = req.query;
  
  let sql = 'SELECT * FROM processes WHERE 1=1';
  const params = [];
  
  if (orgId) {
    sql += ' AND org_id = ?';
    params.push(orgId);
  }
  
  sql += ' AND status = 1 ORDER BY sort_order, id';
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching processes:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// 获取产品列表
app.get('/products', (req, res) => {
  const { orgId, productNo } = req.query;
  
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];
  
  if (orgId) {
    sql += ' AND org_id = ?';
    params.push(orgId);
  }
  
  if (productNo) {
    sql += ' AND product_no LIKE ?';
    params.push(`%${productNo}%`);
  }
  
  sql += ' AND status = 1 ORDER BY id';
  
  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(results);
  });
});

// 启动服务器
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
