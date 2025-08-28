-- 创建角色表
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建组织表
CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  org_code VARCHAR(50) NOT NULL UNIQUE COMMENT '组织编码',
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  address VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  status TINYINT(1) DEFAULT 1 COMMENT '1:活跃，0:禁用',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  salt VARCHAR(64) COMMENT '密码盐值',
  email VARCHAR(100),
  phone VARCHAR(20),
  real_name VARCHAR(50) COMMENT '真实姓名',
  orgId VARCHAR(50) NOT NULL COMMENT '组织ID',
  role_id INT,
  is_super_admin TINYINT(1) DEFAULT 0 COMMENT '是否超级管理员',
  miniprogram_authorized TINYINT(1) DEFAULT 0 COMMENT '是否授权小程序',
  status TINYINT(1) DEFAULT 1 COMMENT '1:活跃，0:禁用',
  password_reset_required TINYINT(1) DEFAULT 0 COMMENT '是否需要重置密码',
  current_token VARCHAR(512) COMMENT '当前有效的登录token',
  current_login_time TIMESTAMP NULL COMMENT '当前token的登录时间',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
  INDEX idx_orgId (orgId),
  INDEX idx_username_orgId (username, orgId),
  INDEX idx_current_token (current_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认角色
INSERT INTO roles (name, description) VALUES 
('超级管理员', '系统超级管理员，拥有所有权限'),
('老板', '组织内的老板，可以管理组织内的用户和数据'),
('员工', '员工，只能查看和操作被授权的功能')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- 插入默认组织
INSERT INTO organizations (org_code, name, description) VALUES 
('SYS001', '系统管理组织', '用于管理系统的默认组织')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- 插入超级管理员账户（密码: admin123）
INSERT INTO users (
  username, 
  password, 
  email, 
  orgId, 
  role_id, 
  is_super_admin, 
  status
) 
SELECT 
  'admin', 
  '$2b$10$3wVQaSXvNtJ0Uy1CTMKlb.vPRbZsT0h5OZ5yXLW2UlNPaJHgc2Yde', 
  'admin@aiyunsf.com',
  'SYS001', 
  (SELECT id FROM roles WHERE name='超级管理员'),
  1, 
  1
FROM dual 
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin'); 