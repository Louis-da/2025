# MySQL数据库配置指南

## 环境配置文件

请在server目录下创建`.env`文件，内容如下：

```
# 数据库配置
DB_HOST=localhost
DB_USER=你的MySQL用户名
DB_PASSWORD=你的MySQL密码
DB_NAME=processing_app

# 服务器配置
PORT=3000
NODE_ENV=development
```

请将上述配置中的MySQL用户名和密码替换为实际值。

## 数据库表结构

请在MySQL中创建以下表结构：

### products表
```sql
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  description TEXT,
  category VARCHAR(100),
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### processes表
```sql
CREATE TABLE processes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  description TEXT,
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### orders表
```sql
CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderNo VARCHAR(100) NOT NULL,
  productId INT,
  quantity INT,
  status VARCHAR(50),
  factoryId INT,
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### factories表
```sql
CREATE TABLE factories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  address TEXT,
  contact VARCHAR(100),
  phone VARCHAR(50),
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 清除假数据

清除org1组织的假数据可以使用以下方法：

1. 运行Node.js脚本:
```bash
node clearFakeData.js
```

2. 直接在MySQL中执行SQL:
```sql
DELETE FROM products WHERE orgId = 'org1';
DELETE FROM processes WHERE orgId = 'org1';
```

3. 使用小程序的数据清理工具页面。 