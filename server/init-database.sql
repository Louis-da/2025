-- MySQL数据库初始化脚本

-- 创建数据库(如果不存在)
CREATE DATABASE IF NOT EXISTS processing_app DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE processing_app;

-- 创建products表
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  description TEXT,
  category VARCHAR(100),
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orgId (orgId)
);

-- 创建processes表
CREATE TABLE IF NOT EXISTS processes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  description TEXT,
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orgId (orgId)
);

-- 创建orders表
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderNo VARCHAR(100) NOT NULL,
  productId INT,
  quantity INT,
  status VARCHAR(50),
  factoryId INT,
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orgId (orgId),
  INDEX idx_status (status)
);

-- 创建factories表
CREATE TABLE IF NOT EXISTS factories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  address TEXT,
  contact VARCHAR(100),
  phone VARCHAR(50),
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orgId (orgId)
);

-- 创建users表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  role VARCHAR(50),
  orgId VARCHAR(100) NOT NULL,
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP,
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_orgId (orgId),
  UNIQUE KEY unique_username (username)
);

-- 添加管理员用户(密码需要修改)
INSERT INTO users (username, password, name, role, orgId)
VALUES ('admin', 'password', '管理员', 'admin', 'org1')
ON DUPLICATE KEY UPDATE name='管理员', role='admin';

-- 完成消息
SELECT 'MySQL数据库初始化完成' as message; 